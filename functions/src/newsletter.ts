import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';



import { db } from './init';
import { createBlogPost, getBlogPosts } from './blog';
import { getCategories, manageCategories } from './categories';
import { corsMiddleware } from './corsConfig';
import { validateAPIToken } from './authUtils';

const REGION = 'europe-west3'; // Frankfurt


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
                        <title>Unsubscribe Error | ProjectFlow</title>
                        <link rel="preconnect" href="https://fonts.googleapis.com">
                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                        <style>
                            * { box-sizing: border-box; margin: 0; padding: 0; }
                            body {
                                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background-color: #fafafa;
                                background-image: radial-gradient(circle, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
                                background-size: 20px 20px;
                                color: #171717;
                                -webkit-font-smoothing: antialiased;
                                padding: 20px;
                            }
                            .container {
                                width: 100%;
                                max-width: 440px;
                                animation: fadeIn 0.5s ease-out;
                            }
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(20px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                            .card {
                                background: rgba(255, 255, 255, 0.85);
                                backdrop-filter: blur(12px);
                                -webkit-backdrop-filter: blur(12px);
                                border: 1px solid rgba(0, 0, 0, 0.08);
                                border-radius: 20px;
                                padding: 48px 40px;
                                text-align: center;
                                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.04);
                            }
                            .icon-wrapper {
                                width: 72px;
                                height: 72px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 24px;
                                animation: pulse 2s ease-in-out infinite;
                            }
                            @keyframes pulse {
                                0%, 100% { transform: scale(1); }
                                50% { transform: scale(1.05); }
                            }
                            .icon {
                                width: 32px;
                                height: 32px;
                                position: relative;
                            }
                            .icon::before, .icon::after {
                                content: '';
                                position: absolute;
                                width: 28px;
                                height: 4px;
                                background: #ef4444;
                                border-radius: 2px;
                                top: 50%;
                                left: 50%;
                            }
                            .icon::before { transform: translate(-50%, -50%) rotate(45deg); }
                            .icon::after { transform: translate(-50%, -50%) rotate(-45deg); }
                            .logo {
                                font-size: 14px;
                                font-weight: 600;
                                color: #a3a3a3;
                                letter-spacing: 0.5px;
                                margin-bottom: 24px;
                                text-transform: uppercase;
                            }
                            h1 {
                                font-size: 28px;
                                font-weight: 600;
                                color: #171717;
                                margin-bottom: 12px;
                                letter-spacing: -0.02em;
                            }
                            p {
                                font-size: 16px;
                                line-height: 1.6;
                                color: #737373;
                                margin-bottom: 32px;
                            }
                            .btn {
                                display: inline-block;
                                padding: 14px 28px;
                                background: #171717;
                                color: #fff;
                                text-decoration: none;
                                border-radius: 12px;
                                font-weight: 500;
                                font-size: 15px;
                                transition: all 0.2s ease;
                            }
                            .btn:hover {
                                background: #404040;
                                transform: translateY(-2px);
                                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
                            }
                            .footer {
                                margin-top: 32px;
                                font-size: 13px;
                                color: #a3a3a3;
                            }
                            .footer a {
                                color: #737373;
                                text-decoration: none;
                                transition: color 0.2s;
                            }
                            .footer a:hover { color: #171717; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="card">
                                <div class="logo">ProjectFlow</div>
                                <div class="icon-wrapper">
                                    <div class="icon"></div>
                                </div>
                                <h1>Something went wrong</h1>
                                <p>${message}</p>
                                <a href="https://getprojectflow.com" class="btn">Back to Homepage</a>
                            </div>
                            <div class="footer">
                                Need help? <a href="https://getprojectflow.com/contact">Contact Support</a>
                            </div>
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
                        <title>Unsubscribed | ProjectFlow</title>
                        <link rel="preconnect" href="https://fonts.googleapis.com">
                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                        <style>
                            * { box-sizing: border-box; margin: 0; padding: 0; }
                            body {
                                font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                min-height: 100vh;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                background-color: #fafafa;
                                background-image: radial-gradient(circle, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
                                background-size: 20px 20px;
                                color: #171717;
                                -webkit-font-smoothing: antialiased;
                                padding: 20px;
                            }
                            .container {
                                width: 100%;
                                max-width: 440px;
                                animation: fadeIn 0.5s ease-out;
                            }
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translateY(20px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                            .card {
                                background: rgba(255, 255, 255, 0.85);
                                backdrop-filter: blur(12px);
                                -webkit-backdrop-filter: blur(12px);
                                border: 1px solid rgba(0, 0, 0, 0.08);
                                border-radius: 20px;
                                padding: 48px 40px;
                                text-align: center;
                                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.04);
                            }
                            .icon-wrapper {
                                width: 72px;
                                height: 72px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                margin: 0 auto 24px;
                            }
                            .checkmark {
                                width: 32px;
                                height: 32px;
                                position: relative;
                            }
                            .checkmark::before {
                                content: '';
                                position: absolute;
                                width: 12px;
                                height: 4px;
                                background: #10b981;
                                border-radius: 2px;
                                top: 18px;
                                left: 4px;
                                transform: rotate(45deg);
                            }
                            .checkmark::after {
                                content: '';
                                position: absolute;
                                width: 20px;
                                height: 4px;
                                background: #10b981;
                                border-radius: 2px;
                                top: 14px;
                                left: 10px;
                                transform: rotate(-45deg);
                            }
                            @keyframes checkIn {
                                0% { transform: scale(0); }
                                50% { transform: scale(1.2); }
                                100% { transform: scale(1); }
                            }
                            .icon-wrapper { animation: checkIn 0.5s ease-out 0.2s both; }
                            .logo {
                                font-size: 14px;
                                font-weight: 600;
                                color: #a3a3a3;
                                letter-spacing: 0.5px;
                                margin-bottom: 24px;
                                text-transform: uppercase;
                            }
                            h1 {
                                font-size: 28px;
                                font-weight: 600;
                                color: #171717;
                                margin-bottom: 12px;
                                letter-spacing: -0.02em;
                            }
                            p {
                                font-size: 16px;
                                line-height: 1.6;
                                color: #737373;
                                margin-bottom: 32px;
                            }
                            .btn {
                                display: inline-block;
                                padding: 14px 28px;
                                background: #171717;
                                color: #fff;
                                text-decoration: none;
                                border-radius: 12px;
                                font-weight: 500;
                                font-size: 15px;
                                transition: all 0.2s ease;
                            }
                            .btn:hover {
                                background: #404040;
                                transform: translateY(-2px);
                                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
                            }
                            .footer {
                                margin-top: 32px;
                                font-size: 13px;
                                color: #a3a3a3;
                            }
                            .footer a {
                                color: #737373;
                                text-decoration: none;
                                transition: color 0.2s;
                            }
                            .footer a:hover { color: #171717; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="card">
                                <div class="logo">ProjectFlow</div>
                                <div class="icon-wrapper">
                                    <div class="checkmark"></div>
                                </div>
                                <h1>You're Unsubscribed</h1>
                                <p>You've been removed from our mailing list. We're sorry to see you go, but you can always come back!</p>
                                <a href="https://getprojectflow.com" class="btn">Visit ProjectFlow</a>
                            </div>
                            <div class="footer">
                                Changed your mind? <a href="https://getprojectflow.com/newsletter">Re-subscribe</a>
                            </div>
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
