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
        } catch (e) {
            // Not a valid ID token, continue to check API tokens
        }

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

// --- RBAC Helpers (Duplicate of types/permissions Logic for backend) ---

export type ProjectRole = 'Owner' | 'Editor' | 'Viewer';

export const ROLE_PERMISSIONS: Record<ProjectRole, string[]> = {
    Owner: [
        'project.read', 'project.update', 'project.delete', 'project.invite', 'project.view_settings',
        'task.create', 'task.update', 'task.delete', 'task.view', 'task.assign', 'task.comment',
        'issue.create', 'issue.update', 'issue.delete', 'issue.view',
        'idea.create', 'idea.update', 'idea.delete', 'idea.view',
        'group.create', 'group.update', 'group.delete'
    ],
    Editor: [
        'project.read', 'project.invite', 'project.view_settings',
        'task.create', 'task.update', 'task.delete', 'task.view', 'task.assign', 'task.comment',
        'issue.create', 'issue.update', 'issue.delete', 'issue.view',
        'idea.create', 'idea.update', 'idea.delete', 'idea.view',
        'group.create', 'group.update', 'group.delete'
    ],
    Viewer: [
        'project.read',
        'task.view', 'task.comment',
        'issue.view',
        'idea.view'
    ]
};

/**
 * Verify if a user has a specific permission on a project.
 * Fetches the project from Firestore to check roles.
 * NOW SUPPORTS CUSTOM ROLES.
 */
export const checkProjectPermission = async (userId: string, projectId: string, permission: string): Promise<boolean> => {
    try {
        const projectsRef = db.collectionGroup('projects');
        const querySnapshot = await projectsRef.where(admin.firestore.FieldPath.documentId(), '==', projectId).limit(1).get();

        if (querySnapshot.empty) return false;

        const projectDoc = querySnapshot.docs[0];
        const projectData = projectDoc.data();

        // 1. Check Owner field (full access)
        if (projectData.ownerId === userId) return true;

        // 2. Determine raw user role value
        let userRole: string | null = null;
        if (projectData.roles && projectData.roles[userId]) {
            userRole = projectData.roles[userId];
        } else if (Array.isArray(projectData.members)) {
            const member = projectData.members.find((m: any) =>
                (typeof m === 'string' && m === userId) || (m.userId === userId)
            );
            if (member) {
                userRole = typeof member === 'object' ? member.role : 'Editor';
            }
        }

        if (!userRole) return false;

        // 3. Handle Legacy Roles
        if (ROLE_PERMISSIONS[userRole as ProjectRole]) {
            return (ROLE_PERMISSIONS[userRole as ProjectRole] || []).includes(permission);
        }

        // 4. Handle Custom Roles (Workspace-level)
        // Need to find the tenant doc to get customRoles
        const tenantRef = projectDoc.ref.parent.parent;
        if (!tenantRef) return false;

        const tenantDoc = await tenantRef.get();
        if (!tenantDoc.exists) return false;

        const tenantData = tenantDoc.data() || {};
        const customRoles: any[] = tenantData.customRoles || [];

        const role = customRoles.find(r => r.id === userRole);
        if (!role) return false;

        return (role.permissions || []).includes(permission);

    } catch (e) {
        console.error('Permission check failed', e);
        return false;
    }
};
