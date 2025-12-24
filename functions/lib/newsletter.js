"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = exports.newsletterUnsubscribe = exports.newsletterSubscribe = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const crypto = require("crypto");
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const CORS_ORIGIN = true; // Allow all origins - can be restricted in production
const REGION = 'europe-west3'; // Frankfurt
/**
 * Hash a token using SHA-256 (must match client-side implementation)
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};
/**
 * Validate an API token and return the token data if valid
 */
const validateAPIToken = async (token, requiredPermission) => {
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
    }
    catch (error) {
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
exports.newsletterSubscribe = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
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
        }
        else if (req.body.token) {
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
        const tenantId = validation.tenantId;
        const tokenData = validation.tokenData;
        // Extract body parameters
        const { email, firstName, lastName, projectId, customFields } = req.body;
        // Parse groupIds - handle both array (JSON) and comma-separated string (HTML form)
        let groupIds = [];
        if (req.body.groupIds) {
            if (Array.isArray(req.body.groupIds)) {
                groupIds = req.body.groupIds;
            }
            else if (typeof req.body.groupIds === 'string') {
                groupIds = req.body.groupIds.split(',').map((id) => id.trim()).filter((id) => id);
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
                const updates = {
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
            const recipientData = {
                email: email.toLowerCase(),
                status: 'Subscribed',
                source: 'Signup Form',
                projectId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (firstName)
                recipientData.firstName = firstName;
            if (lastName)
                recipientData.lastName = lastName;
            if (groupIds.length > 0)
                recipientData.groupIds = groupIds;
            if (customFields && typeof customFields === 'object') {
                recipientData.customFields = customFields;
            }
            const newRecipientRef = await recipientsRef.add(recipientData);
            res.status(201).json({
                success: true,
                message: 'Subscriber added successfully',
                recipientId: newRecipientRef.id,
                isNew: true
            });
        }
        catch (error) {
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
 * POST /api/newsletter/unsubscribe
 *
 * Body:
 *   {
 *     email: string (required)
 *     projectId: string (required)
 *     token?: string (optional if using Auth header)
 *   }
 */
exports.newsletterUnsubscribe = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        // Extract token
        let token = '';
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (req.body.token) {
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
        const tenantId = validation.tenantId;
        const { email, projectId } = req.body;
        if (!email || !projectId) {
            res.status(400).json({ success: false, error: 'Email and Project ID are required' });
            return;
        }
        try {
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
            if (existingQuery.empty) {
                res.status(404).json({ success: false, error: 'Subscriber not found' });
                return;
            }
            const recipientDoc = existingQuery.docs[0];
            await recipientDoc.ref.update({
                status: 'Unsubscribed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            res.status(200).json({
                success: true,
                message: 'Successfully unsubscribed'
            });
        }
        catch (error) {
            console.error('Newsletter unsubscribe error:', error);
            res.status(500).json({ success: false, error: 'Failed to unsubscribe' });
        }
    });
});
/**
 * Main API handler - routes requests to appropriate handlers
 * This function handles all /api/** requests
 */
exports.api = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        const path = req.path;
        // Route: POST /api/newsletter/subscribe
        if (path === '/newsletter/subscribe' || path === '/api/newsletter/subscribe') {
            return (0, exports.newsletterSubscribe)(req, res);
        }
        // Route: POST /api/newsletter/unsubscribe
        if (path === '/newsletter/unsubscribe' || path === '/api/newsletter/unsubscribe') {
            return (0, exports.newsletterUnsubscribe)(req, res);
        }
        // 404 for unknown routes
        res.status(404).json({
            success: false,
            error: 'Endpoint not found',
            availableEndpoints: [
                'POST /api/newsletter/subscribe',
                'POST /api/newsletter/unsubscribe'
            ]
        });
    });
});
//# sourceMappingURL=newsletter.js.map