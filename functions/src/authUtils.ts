import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { db } from './init';

/**
 * Hash a token using SHA-256 (must match client-side implementation)
 */
export const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

export type ApiPermission =
    | 'newsletter:write'
    | 'recipients:read'
    | 'blog:read'
    | 'blog:write'
    | 'blog:categories:read'
    | 'blog:categories:write';

/**
 * Validate an API token and return the token data if valid
 */
export const validateAPIToken = async (
    token: string,
    requiredPermission: ApiPermission
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
 * Extract API token from request headers or body
 */
export const getAuthToken = (req: any): string => {
    // 1. Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // 2. Query param or body (fallback)
    return req.query?.token || req.body?.token || '';
};
