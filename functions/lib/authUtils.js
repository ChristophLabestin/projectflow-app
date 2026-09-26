"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceMemberRole = exports.checkProjectPermission = exports.ROLE_PERMISSIONS = exports.getAuthToken = exports.validateAPIToken = exports.findApiToken = exports.hashToken = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const init_1 = require("./init");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Hash a token using SHA-256 (must match client-side implementation)
 */
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};
exports.hashToken = hashToken;
/**
 * Find a workspace API token by its hash. Uses one collection-group query
 * (index: api_tokens.tokenHash, collection-group scope); falls back to scanning
 * tenants if that index is not deployed yet.
 */
const findApiToken = async (token) => {
    var _a;
    const tokenHash = (0, exports.hashToken)(token);
    try {
        const snapshot = await init_1.db.collectionGroup('api_tokens').where('tokenHash', '==', tokenHash).limit(1).get();
        const doc = snapshot.docs[0];
        const tenantId = (_a = doc === null || doc === void 0 ? void 0 : doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id;
        return doc && tenantId ? { tokenRef: doc.ref, tokenData: doc.data(), tenantId } : null;
    }
    catch (error) {
        console.warn('api_tokens collection-group lookup failed, scanning tenants', error);
    }
    const tenantsSnapshot = await init_1.db.collection('tenants').get();
    for (const tenantDoc of tenantsSnapshot.docs) {
        const tokensQuery = await tenantDoc.ref.collection('api_tokens').where('tokenHash', '==', tokenHash).limit(1).get();
        if (!tokensQuery.empty) {
            const doc = tokensQuery.docs[0];
            return { tokenRef: doc.ref, tokenData: doc.data(), tenantId: tenantDoc.id };
        }
    }
    return null;
};
exports.findApiToken = findApiToken;
/**
 * Validate an API token and return the token data if valid
 */
const validateAPIToken = async (token, requiredPermission) => {
    try {
        // 1. Firebase ID tokens (signed-in app users) are only accepted for
        //    workspace-scoped PM endpoints. The caller must still verify the
        //    user's membership in the requested tenant (see requireWorkspaceMember).
        let decodedToken = null;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        }
        catch (e) {
            decodedToken = null;
        }
        if (decodedToken) {
            if (!/^(projects|initiatives|tasks):/.test(requiredPermission)) {
                return { valid: false, error: 'Insufficient permissions' };
            }
            return {
                valid: true,
                tokenData: {
                    uid: decodedToken.uid,
                    authType: 'firebase',
                    permissions: [requiredPermission]
                }
            };
        }
        const found = await (0, exports.findApiToken)(token);
        if (found) {
            const { tokenRef, tokenData, tenantId } = found;
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
            await tokenRef.update({
                lastUsedAt: firestore_1.FieldValue.serverTimestamp()
            });
            return {
                valid: true,
                tokenData,
                tenantId
            };
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
exports.ROLE_PERMISSIONS = {
    Owner: [
        'project.read', 'project.update', 'project.delete', 'project.invite', 'project.view_settings',
        'task.create', 'task.update', 'task.delete', 'task.view', 'task.assign', 'task.comment',
        'group.create', 'group.update', 'group.delete'
    ],
    Editor: [
        'project.read', 'project.invite', 'project.view_settings',
        'task.create', 'task.update', 'task.delete', 'task.view', 'task.assign', 'task.comment',
        'group.create', 'group.update', 'group.delete'
    ],
    Viewer: [
        'project.read',
        'task.view', 'task.comment'
    ]
};
/**
 * Verify if a user has a specific permission on a project.
 * Fetches the project from Firestore to check roles.
 * NOW SUPPORTS CUSTOM ROLES.
 */
const checkProjectPermission = async (userId, projectId, permission) => {
    try {
        const projectsRef = init_1.db.collectionGroup('projects');
        const querySnapshot = await projectsRef.where(firestore_1.FieldPath.documentId(), '==', projectId).limit(1).get();
        if (querySnapshot.empty)
            return false;
        const projectDoc = querySnapshot.docs[0];
        const projectData = projectDoc.data();
        // 1. Check Owner field (full access)
        if (projectData.ownerId === userId)
            return true;
        // 2. Determine raw user role value
        let userRole = null;
        if (projectData.roles && projectData.roles[userId]) {
            userRole = projectData.roles[userId];
        }
        else if (Array.isArray(projectData.members)) {
            const member = projectData.members.find((m) => (typeof m === 'string' && m === userId) || (m.userId === userId));
            if (member) {
                userRole = typeof member === 'object' ? member.role : 'Editor';
            }
        }
        if (!userRole)
            return false;
        // 3. Handle Legacy Roles
        if (exports.ROLE_PERMISSIONS[userRole]) {
            return (exports.ROLE_PERMISSIONS[userRole] || []).includes(permission);
        }
        // 4. Handle Custom Roles (Workspace-level)
        // Need to find the tenant doc to get customRoles
        const tenantRef = projectDoc.ref.parent.parent;
        if (!tenantRef)
            return false;
        const tenantDoc = await tenantRef.get();
        if (!tenantDoc.exists)
            return false;
        const tenantData = tenantDoc.data() || {};
        const customRoles = tenantData.customRoles || [];
        const role = customRoles.find(r => r.id === userRole);
        if (!role)
            return false;
        return (role.permissions || []).includes(permission);
    }
    catch (e) {
        console.error('Permission check failed', e);
        return false;
    }
};
exports.checkProjectPermission = checkProjectPermission;
/**
 * Returns the member role of `uid` in `tenantId`, or null when not a member.
 */
const getWorkspaceMemberRole = async (tenantId, uid) => {
    var _a;
    const snap = await init_1.db.doc(`tenants/${tenantId}/members/${uid}`).get();
    return snap.exists ? String(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.role) || 'Member') : null;
};
exports.getWorkspaceMemberRole = getWorkspaceMemberRole;
//# sourceMappingURL=authUtils.js.map