import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';



import { db } from './init';
import { createBlogPost, getBlogPosts } from './blog';
import { getCategories, manageCategories } from './categories';
import { corsMiddleware } from './corsConfig';

const REGION = 'europe-west3'; // Frankfurt

/**
 * Hash a token using SHA-256 (must match client-side implementation)
 */
const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Validate an API token and return the token data if valid
 */
const validateAPIToken = async (
    token: string,
    requiredPermission: 'newsletter:write' | 'recipients:read'
): Promise<{ valid: boolean; tokenData?: any; tenantId?: string; error?: string }> => {
    try {
        const tokenHash = hashToken(token);

        // Search all tenants for the token (we could optimize this with a global tokens collection)
        const tenantsSnapshot = await db.collection('tenants').get();

        for (const tenantDoc of tenantsSnapshot.docs) {
            const tokensQuery = await db
                .collection('tenants')
                .doc(tenantDoc.id)
                .collection('api_tokens')
                .where('tokenHash', '==', tokenHash)
                .limit(1)
                .get();

            if (!tokensQuery.empty) {
                const tokenDoc = tokensQuery.docs[0];
                const tokenData = tokenDoc.data();

                // Check expiration
                if (tokenData.expiresAt) {
                    const expiresAt = tokenData.expiresAt.toDate();
                    if (new Date() > expiresAt) {
                        return { valid: false, error: 'Token expired' };
                    }
                }

                // Check permissions
                if (!tokenData.permissions.includes(requiredPermission)) {
                    return { valid: false, error: 'Insufficient permissions' };
                }

                // Update lastUsedAt
                await tokenDoc.ref.update({
                    lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                return {
                    valid: true,
                    tokenData,
                    tenantId: tenantDoc.id
                };
            }
        }

        return { valid: false, error: 'Invalid token' };
    } catch (error: any) {
        console.error('Token validation error:', error);
        return { valid: false, error: error.message };
    }
};

/**
 * Newsletter Subscribe Endpoint
 * POST /api/newsletter/subscribe
 * 
 * Headers:
 *   Authorization: Bearer <api_token>
 * 
 * Body:
 *   {
 *     email: string (required)
 *     firstName?: string
 *     lastName?: string
 *     projectId: string (required)
 *     groupIds?: string[]
 *     customFields?: Record<string, any>
 *   }
 */
export const newsletterSubscribe = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        // Extract token from Authorization header or body
        let token = '';
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else if (req.body.token) {
            token = req.body.token;
        }

        if (!token) {
            res.status(401).json({ success: false, error: 'Missing API token' });
            return;
        }

        // Validate token
        const validation = await validateAPIToken(token, 'newsletter:write');
        if (!validation.valid) {
            res.status(401).json({ success: false, error: validation.error });
            return;
        }

        const tenantId = validation.tenantId!;
        const tokenData = validation.tokenData;

        // Extract body parameters
        const { email, firstName, lastName, projectId, customFields } = req.body;

        // Parse groupIds - handle both array (JSON) and comma-separated string (HTML form)
        let groupIds: string[] = [];
        if (req.body.groupIds) {
            if (Array.isArray(req.body.groupIds)) {
                groupIds = req.body.groupIds;
            } else if (typeof req.body.groupIds === 'string') {
                groupIds = req.body.groupIds.split(',').map((id: string) => id.trim()).filter((id: string) => id);
            }
        }

        // Validate required fields
        if (!email || typeof email !== 'string') {
            res.status(400).json({ success: false, error: 'Email is required' });
            return;
        }

        if (!projectId || typeof projectId !== 'string') {
            res.status(400).json({ success: false, error: 'Project ID is required' });
            return;
        }

        // Check project scope if token is scoped
        if (tokenData.projectScope && tokenData.projectScope !== projectId) {
            res.status(403).json({
                success: false,
                error: 'Token not authorized for this project'
            });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, error: 'Invalid email format' });
            return;
        }

        try {
            // Check if recipient already exists
            const recipientsRef = db
                .collection('tenants')
                .doc(tenantId)
                .collection('projects')
                .doc(projectId)
                .collection('marketing_recipients');

            const existingQuery = await recipientsRef
                .where('email', '==', email.toLowerCase())
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                // Recipient exists - update if needed
                const existingDoc = existingQuery.docs[0];
                const updates: any = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };

                // Add to groups if provided
                if (groupIds.length > 0) {
                    updates.groupIds = admin.firestore.FieldValue.arrayUnion(...groupIds);
                }

                // Update custom fields if provided
                if (customFields && typeof customFields === 'object') {
                    for (const [key, value] of Object.entries(customFields)) {
                        updates[`customFields.${key}`] = value;
                    }
                }

                await existingDoc.ref.update(updates);

                res.status(200).json({
                    success: true,
                    message: 'Subscriber updated',
                    recipientId: existingDoc.id,
                    isNew: false
                });
                return;
            }

            // Create new recipient
            const recipientData: any = {
                email: email.toLowerCase(),
                status: 'Subscribed',
                source: 'Signup Form',
                projectId,
                unsubscribeToken: crypto.randomUUID(), // Secure unique token for unsubscribe links
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (firstName) recipientData.firstName = firstName;
            if (lastName) recipientData.lastName = lastName;
            if (groupIds.length > 0) recipientData.groupIds = groupIds;
            if (customFields && typeof customFields === 'object') {
                recipientData.customFields = customFields;
            }

            const newRecipientRef = await recipientsRef.add(recipientData);

            res.status(201).json({
                success: true,
                message: 'Subscriber added successfully',
                recipientId: newRecipientRef.id,
                unsubscribeToken: recipientData.unsubscribeToken,
                isNew: true
            });
        } catch (error: any) {
            console.error('Newsletter subscribe error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to add subscriber'
            });
        }
    });
});

/**
 * Newsletter Unsubscribe Endpoint
 * POST or GET /api/newsletter/unsubscribe
 * 
 * Parameters (Body or Query):
 *   {
 *     email: string (required)
 *     projectId: string (required)
 *     token?: string (optional if using Auth header)
 *   }
 */
export const newsletterUnsubscribe = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        const isGet = req.method === 'GET';
        const isPost = req.method === 'POST';

        // Only allow GET and POST
        if (!isGet && !isPost) {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        // Extract parameters from body or query
        const params = isGet ? req.query : req.body;
        const email = params.email as string;
        const projectId = params.projectId as string;

        // Extract token
        let token = (params.token as string) || '';
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // Error helper to handle both JSON and HTML responses
        const handleError = (status: number, message: string) => {
            if (isGet) {
                res.status(status).send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Unsubscribe Error</title>
                        <style>
                            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
                            .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
                            h1 { color: #ef4444; margin-top: 0; font-size: 1.5rem; }
                            p { color: #4b5563; line-height: 1.5; margin-bottom: 0; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <h1>Error</h1>
                            <p>${message}</p>
                        </div>
                    </body>
                    </html>
                `);
            } else {
                res.status(status).json({ success: false, error: message });
            }
        };

        if (!token) return handleError(401, 'Missing API token');
        if (!email || !projectId) return handleError(400, 'Email and Project ID are required');

        // Validate token
        // We first check if it's a master API token
        const validation = await validateAPIToken(token, 'newsletter:write');
        const isMasterToken = validation.valid;
        const tenantIdFromMaster = validation.tenantId;

        // If not a master token, we'll try to validate as a recipient-specific unsubscribe token later
        // once we have the recipient document.

        try {
            // If we have a master token, we can use the tenantId from it
            // Otherwise, we need to find which tenant this project belongs to
            let tenantId = tenantIdFromMaster;

            if (!tenantId) {
                // If no master token, we need to find the tenant by searching projects
                // This is a bit expensive, but necessary for secure unsubscribes without master tokens
                const tenantsSnapshot = await db.collection('tenants').get();
                for (const tenantDoc of tenantsSnapshot.docs) {
                    const projectDoc = await tenantDoc.ref.collection('projects').doc(projectId).get();
                    if (projectDoc.exists) {
                        tenantId = tenantDoc.id;
                        break;
                    }
                }
            }

            if (!tenantId) return handleError(404, 'Project not found');

            const recipientsRef = db
                .collection('tenants')
                .doc(tenantId)
                .collection('projects')
                .doc(projectId)
                .collection('marketing_recipients');

            const existingQuery = await recipientsRef
                .where('email', '==', email.toLowerCase())
                .limit(1)
                .get();

            if (existingQuery.empty) return handleError(404, 'Subscriber not found');

            const recipientDoc = existingQuery.docs[0];
            const recipientData = recipientDoc.data();

            // Check if token matches: either master token or recipient's unsubscribeToken
            const isUserTokenMatch = recipientData.unsubscribeToken && recipientData.unsubscribeToken === token;

            if (!isMasterToken && !isUserTokenMatch) {
                return handleError(401, 'Invalid unsubscribe token');
            }

            await recipientDoc.ref.update({
                status: 'Unsubscribed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (isGet) {
                res.status(200).send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Unsubscribed Successfully</title>
                        <style>
                            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
                            .card { background: white; padding: 2rem; border-radius: 0.75rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; width: 100%; text-align: center; }
                            h1 { color: #10b981; margin-top: 0; font-size: 1.5rem; }
                            p { color: #4b5563; line-height: 1.5; margin-bottom: 0; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <h1>Unsubscribed</h1>
                            <p>You have been successfully removed from our mailing list. We're sorry to see you go!</p>
                        </div>
                    </body>
                    </html>
                `);
            } else {
                res.status(200).json({
                    success: true,
                    message: 'Successfully unsubscribed'
                });
            }
        } catch (error: any) {
            console.error('Newsletter unsubscribe error:', error);
            return handleError(500, 'Failed to unsubscribe');
        }
    });
});

/**
 * Main API handler - routes requests to appropriate handlers
 * This function handles all /api/** requests
 */
export const api = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        // Use path relative to the function URL
        const path = req.path.replace(/^\/api/, '');

        // Route: newsletter/subscribe (POST)
        if (path === '/newsletter/subscribe' || path === '/api/newsletter/subscribe') {
            return newsletterSubscribe(req, res);
        }

        // Route: newsletter/unsubscribe (POST, GET)
        if (path === '/newsletter/unsubscribe' || path === '/api/newsletter/unsubscribe') {
            return newsletterUnsubscribe(req, res);
        }

        // Route: blog/create (POST)
        if (path === '/blog/create' || path === '/api/blog/create') {
            return createBlogPost(req, res);
        }

        // Route: blog/posts (GET)
        if (path === '/blog/posts' || path === '/api/blog/posts') {
            return getBlogPosts(req, res);
        }

        // Route: blog/categories (GET)
        if (path === '/blog/categories' || path === '/api/blog/categories') {
            return getCategories(req, res);
        }

        // Route: blog/categories/manage (POST, PUT, DELETE)
        if (path.startsWith('/blog/categories/manage') || path.startsWith('/api/blog/categories/manage')) {
            return manageCategories(req, res);
        }

        // 404 for unknown routes
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            path: req.path,
            availableEndpoints: [
                'POST /api/newsletter/subscribe',
                'GET/POST /api/newsletter/unsubscribe'
            ]
        });
    });
});
