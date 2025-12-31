"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthToken = exports.validateAPIToken = exports.hashToken = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const init_1 = require("./init");
/**
 * Hash a token using SHA-256 (must match client-side implementation)
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};
exports.hashToken = hashToken;
/**
 * Validate an API token and return the token data if valid
 */
const validateAPIToken = async (token, requiredPermission) => {
    try {
        // 1. Try to verify as Firebase ID Token
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            // Implicitly grant permissions to authenticated users of the project
            // In a stricter system, we'd check roles/tenants here.
            return {
                valid: true,
                tokenData: {
                    uid: decodedToken.uid,
                    permissions: [requiredPermission] // Grant the requested permission
                },
                tenantId: decodedToken.tenant || undefined // If custom claims used
            };
        }
        catch (e) {
            // Not a valid ID token, continue to check API tokens
        }
        const tokenHash = (0, exports.hashToken)(token);
        // Search all tenants for the token (we could optimize this with a global tokens collection)
        const tenantsSnapshot = await init_1.db.collection('tenants').get();
        for (const tenantDoc of tenantsSnapshot.docs) {
            const tokensQuery = await init_1.db
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
exports.validateAPIToken = validateAPIToken;
/**
 * Extract API token from request headers or body
 */
const getAuthToken = (req) => {
    var _a, _b;
    // 1. Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    // 2. Query param or body (fallback)
    return ((_a = req.query) === null || _a === void 0 ? void 0 : _a.token) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.token) || '';
};
exports.getAuthToken = getAuthToken;
//# sourceMappingURL=authUtils.js.map