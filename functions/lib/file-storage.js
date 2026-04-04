"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleDriveStorageCallback = exports.deleteTenantFile = exports.getTenantFileDownloadUrl = exports.listTenantFiles = exports.finalizeTenantFileUpload = exports.createTenantFileUploadSession = exports.disconnectGoogleDriveStorage = exports.getGoogleDriveStorageAuthUrl = exports.testWorkspaceFileStorageConnection = exports.saveWorkspaceFileStorageConfig = exports.getWorkspaceFileStorageConfig = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");
const google_auth_library_1 = require("google-auth-library");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const init_1 = require("./init");
const REGION = 'europe-west3';
const FILE_STORAGE_SECRET_ID = 'fileStorage';
const FILE_STORAGE_AUTH_STATE_COLLECTION = 'file_storage_auth_states';
const STORAGE_SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const UPLOAD_DRAFT_TTL_MS = 60 * 60 * 1000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_S3_REGION = 'us-east-1';
const DEFAULT_S3_ENDPOINT = 'https://s3.amazonaws.com';
const GOOGLE_DRIVE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || '';
const GOOGLE_DRIVE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || '';
const GOOGLE_DRIVE_SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
];
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const toSafePathSegment = (value) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const toBoolean = (value) => Boolean(value);
const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const requireAuth = (context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};
const getMembership = async (tenantId, uid) => {
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    if (uid === tenantId) {
        return { exists: true, role: 'Owner', roleIds: ['Owner'] };
    }
    const membershipSnap = await init_1.db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!membershipSnap.exists) {
        return { exists: false, role: '', roleIds: [] };
    }
    const membership = membershipSnap.data() || {};
    const role = normalizeString(membership.role) || 'Member';
    const roleIds = Array.isArray(membership.roleIds)
        ? membership.roleIds.filter((entry) => typeof entry === 'string')
        : [];
    if (role && !roleIds.includes(role)) {
        roleIds.unshift(role);
    }
    return { exists: true, role, roleIds };
};
const hasPermissionBySystemRole = (role, permission) => {
    if (role === 'Owner')
        return true;
    if (role === 'Admin') {
        if (permission.startsWith('tenant.integrations.'))
            return true;
        if (permission.startsWith('tenant.media.'))
            return true;
        if (permission.startsWith('tenant.finance.'))
            return true;
        return false;
    }
    if (role === 'Member') {
        if (permission === 'tenant.media.view' || permission === 'tenant.media.upload')
            return true;
        return false;
    }
    return false;
};
const hasTenantPermission = async (tenantId, uid, permission) => {
    var _a, _b;
    const membership = await getMembership(tenantId, uid);
    if (!membership.exists)
        return false;
    const primaryRole = membership.role || 'Member';
    if (hasPermissionBySystemRole(primaryRole, permission)) {
        return true;
    }
    // Support custom role permissions from tenant.customRoles.
    const tenantSnap = await init_1.db.collection('tenants').doc(tenantId).get();
    const customRoles = Array.isArray((_a = tenantSnap.data()) === null || _a === void 0 ? void 0 : _a.customRoles)
        ? (_b = tenantSnap.data()) === null || _b === void 0 ? void 0 : _b.customRoles
        : [];
    const assignedRoleIds = new Set(membership.roleIds);
    for (const role of customRoles) {
        const roleId = normalizeString(role.id);
        if (!roleId || !assignedRoleIds.has(roleId))
            continue;
        const permissions = Array.isArray(role.permissions)
            ? role.permissions.filter((entry) => typeof entry === 'string')
            : [];
        if (permissions.includes(permission)) {
            return true;
        }
    }
    return false;
};
const requireTenantAccess = async (tenantId, context) => {
    const uid = requireAuth(context);
    const membership = await getMembership(tenantId, uid);
    if (!membership.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
    }
    return uid;
};
const requireTenantPermission = async (tenantId, context, permission) => {
    const uid = requireAuth(context);
    const allowed = await hasTenantPermission(tenantId, uid, permission);
    if (!allowed) {
        throw new functions.https.HttpsError('permission-denied', `Missing permission ${permission}.`);
    }
    return uid;
};
const requireStorageConfigManagePermission = async (tenantId, context) => {
    return requireTenantPermission(tenantId, context, 'tenant.integrations.manage');
};
const requireStorageConfigViewPermission = async (tenantId, context) => {
    const uid = requireAuth(context);
    const canView = await hasTenantPermission(tenantId, uid, 'tenant.integrations.view')
        || await hasTenantPermission(tenantId, uid, 'tenant.integrations.manage');
    if (!canView) {
        throw new functions.https.HttpsError('permission-denied', 'Integration view access required.');
    }
    return uid;
};
const requireUploadPermission = async (tenantId, context, moduleName) => {
    if (moduleName === 'finance') {
        return requireTenantPermission(tenantId, context, 'tenant.finance.ap.manage');
    }
    return requireTenantPermission(tenantId, context, 'tenant.media.upload');
};
const requireReadPermission = async (tenantId, context, moduleName) => {
    if (moduleName === 'finance') {
        return requireTenantPermission(tenantId, context, 'tenant.finance.ap.manage');
    }
    return requireTenantPermission(tenantId, context, 'tenant.media.view');
};
const requireDeletePermission = async (tenantId, context, moduleName) => {
    if (moduleName === 'finance') {
        return requireTenantPermission(tenantId, context, 'tenant.finance.ap.manage');
    }
    // Delete is stricter than upload/view.
    const uid = requireAuth(context);
    const canDelete = await hasTenantPermission(tenantId, uid, 'tenant.media.delete')
        || await hasTenantPermission(tenantId, uid, 'tenant.media.upload');
    if (!canDelete) {
        throw new functions.https.HttpsError('permission-denied', 'Media delete access required.');
    }
    return uid;
};
const secretDocRef = (tenantId) => init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(FILE_STORAGE_SECRET_ID);
const authStateDocRef = (tenantId, stateId) => init_1.db.collection('tenants').doc(tenantId).collection('secrets').doc(FILE_STORAGE_SECRET_ID).collection(FILE_STORAGE_AUTH_STATE_COLLECTION).doc(stateId);
const uploadDraftDocRef = (tenantId, draftId) => init_1.db.collection('tenants').doc(tenantId).collection('file_upload_drafts').doc(draftId);
const filesCollectionRef = (tenantId) => init_1.db.collection('tenants').doc(tenantId).collection('files');
const getSecretConfig = async (tenantId) => {
    const secretSnap = await secretDocRef(tenantId).get();
    return (secretSnap.data() || {});
};
const normalizeS3Config = (value, existing) => {
    const raw = (value && typeof value === 'object') ? value : {};
    const endpoint = normalizeString(raw.endpoint) || normalizeString(existing === null || existing === void 0 ? void 0 : existing.endpoint) || DEFAULT_S3_ENDPOINT;
    const region = normalizeString(raw.region) || normalizeString(existing === null || existing === void 0 ? void 0 : existing.region) || DEFAULT_S3_REGION;
    const bucket = normalizeString(raw.bucket) || normalizeString(existing === null || existing === void 0 ? void 0 : existing.bucket);
    const pathPrefix = normalizeString(raw.pathPrefix) || normalizeString(existing === null || existing === void 0 ? void 0 : existing.pathPrefix);
    const forcePathStyle = raw.forcePathStyle !== undefined ? toBoolean(raw.forcePathStyle) : Boolean(existing === null || existing === void 0 ? void 0 : existing.forcePathStyle);
    const accessKeyIdInput = normalizeString(raw.accessKeyId);
    const secretAccessKeyInput = normalizeString(raw.secretAccessKey);
    return {
        endpoint,
        region,
        bucket,
        pathPrefix,
        forcePathStyle,
        accessKeyId: accessKeyIdInput || normalizeString(existing === null || existing === void 0 ? void 0 : existing.accessKeyId),
        secretAccessKey: secretAccessKeyInput || normalizeString(existing === null || existing === void 0 ? void 0 : existing.secretAccessKey),
    };
};
const normalizeGoogleDriveConfig = (value, existing) => {
    const raw = (value && typeof value === 'object') ? value : {};
    const folderId = normalizeString(raw.folderId) || normalizeString(existing === null || existing === void 0 ? void 0 : existing.folderId);
    const folderName = normalizeString(raw.folderName) || normalizeString(existing === null || existing === void 0 ? void 0 : existing.folderName);
    return {
        connected: Boolean(existing === null || existing === void 0 ? void 0 : existing.connected),
        folderId,
        folderName,
        email: normalizeString(existing === null || existing === void 0 ? void 0 : existing.email),
        scope: normalizeString(existing === null || existing === void 0 ? void 0 : existing.scope),
        accessToken: normalizeString(existing === null || existing === void 0 ? void 0 : existing.accessToken),
        refreshToken: normalizeString(existing === null || existing === void 0 ? void 0 : existing.refreshToken),
        tokenExpiryDate: toNumber(existing === null || existing === void 0 ? void 0 : existing.tokenExpiryDate) || 0,
        connectedAt: (existing === null || existing === void 0 ? void 0 : existing.connectedAt) || null,
        lastTestedAt: (existing === null || existing === void 0 ? void 0 : existing.lastTestedAt) || null,
        lastError: normalizeString(existing === null || existing === void 0 ? void 0 : existing.lastError),
    };
};
const isS3Ready = (s3) => Boolean(s3
    && normalizeString(s3.bucket)
    && normalizeString(s3.accessKeyId)
    && normalizeString(s3.secretAccessKey)
    && normalizeString(s3.region)
    && normalizeString(s3.endpoint));
const isGoogleDriveReady = (drive) => Boolean(drive
    && drive.connected
    && normalizeString(drive.folderId)
    && (normalizeString(drive.refreshToken) || (normalizeString(drive.accessToken) && toNumber(drive.tokenExpiryDate) > Date.now())));
const resolveProvider = (secret) => {
    const activeProvider = normalizeString(secret.activeProvider) || 'firebase';
    if (activeProvider === 's3') {
        if (isS3Ready(secret.s3)) {
            return { requestedProvider: activeProvider, resolvedProvider: 's3', fallbackReason: '' };
        }
        return { requestedProvider: activeProvider, resolvedProvider: 'firebase', fallbackReason: 's3_not_configured' };
    }
    if (activeProvider === 'googleDrive') {
        if (isGoogleDriveReady(secret.googleDrive)) {
            return { requestedProvider: activeProvider, resolvedProvider: 'googleDrive', fallbackReason: '' };
        }
        return { requestedProvider: activeProvider, resolvedProvider: 'firebase', fallbackReason: 'google_drive_not_connected' };
    }
    return { requestedProvider: 'firebase', resolvedProvider: 'firebase', fallbackReason: '' };
};
const getGoogleDriveRedirectUri = () => {
    const explicit = normalizeString(process.env.GOOGLE_DRIVE_STORAGE_REDIRECT_URI);
    if (explicit)
        return explicit;
    const projectId = process.env.GCLOUD_PROJECT || 'project-manager-9d0ad';
    return `https://${REGION}-${projectId}.cloudfunctions.net/googleDriveStorageCallback`;
};
const createGoogleOAuthClient = () => {
    if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive OAuth credentials are not configured.');
    }
    return new google_auth_library_1.OAuth2Client(GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, getGoogleDriveRedirectUri());
};
const createS3Client = (s3) => {
    return new client_s3_1.S3Client({
        region: normalizeString(s3.region) || DEFAULT_S3_REGION,
        endpoint: normalizeString(s3.endpoint) || DEFAULT_S3_ENDPOINT,
        forcePathStyle: Boolean(s3.forcePathStyle),
        credentials: {
            accessKeyId: normalizeString(s3.accessKeyId),
            secretAccessKey: normalizeString(s3.secretAccessKey),
        },
    });
};
const fileBucket = () => {
    const bucket = admin.storage().bucket();
    if (!(bucket === null || bucket === void 0 ? void 0 : bucket.name)) {
        throw new functions.https.HttpsError('failed-precondition', 'Firebase storage bucket is not configured.');
    }
    return bucket;
};
const sanitizeSecretForClient = (secret) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const providerResolution = resolveProvider(secret);
    return {
        activeProvider: providerResolution.requestedProvider,
        resolvedProvider: providerResolution.resolvedProvider,
        fallbackToFirebase: providerResolution.resolvedProvider !== providerResolution.requestedProvider,
        fallbackReason: providerResolution.fallbackReason || null,
        providers: {
            firebase: {
                ready: true,
            },
            s3: {
                ready: isS3Ready(secret.s3),
                endpoint: normalizeString((_a = secret.s3) === null || _a === void 0 ? void 0 : _a.endpoint),
                region: normalizeString((_b = secret.s3) === null || _b === void 0 ? void 0 : _b.region),
                bucket: normalizeString((_c = secret.s3) === null || _c === void 0 ? void 0 : _c.bucket),
                pathPrefix: normalizeString((_d = secret.s3) === null || _d === void 0 ? void 0 : _d.pathPrefix),
                forcePathStyle: Boolean((_e = secret.s3) === null || _e === void 0 ? void 0 : _e.forcePathStyle),
                hasAccessKeyId: Boolean(normalizeString((_f = secret.s3) === null || _f === void 0 ? void 0 : _f.accessKeyId)),
                hasSecretAccessKey: Boolean(normalizeString((_g = secret.s3) === null || _g === void 0 ? void 0 : _g.secretAccessKey)),
                lastTestedAt: ((_h = secret.s3) === null || _h === void 0 ? void 0 : _h.lastTestedAt) || null,
            },
            googleDrive: {
                ready: isGoogleDriveReady(secret.googleDrive),
                connected: Boolean((_j = secret.googleDrive) === null || _j === void 0 ? void 0 : _j.connected),
                folderId: normalizeString((_k = secret.googleDrive) === null || _k === void 0 ? void 0 : _k.folderId),
                folderName: normalizeString((_l = secret.googleDrive) === null || _l === void 0 ? void 0 : _l.folderName),
                email: normalizeString((_m = secret.googleDrive) === null || _m === void 0 ? void 0 : _m.email),
                scope: normalizeString((_o = secret.googleDrive) === null || _o === void 0 ? void 0 : _o.scope),
                hasRefreshToken: Boolean(normalizeString((_p = secret.googleDrive) === null || _p === void 0 ? void 0 : _p.refreshToken)),
                tokenExpiryDate: toNumber((_q = secret.googleDrive) === null || _q === void 0 ? void 0 : _q.tokenExpiryDate) || null,
                lastTestedAt: ((_r = secret.googleDrive) === null || _r === void 0 ? void 0 : _r.lastTestedAt) || null,
                lastError: normalizeString((_s = secret.googleDrive) === null || _s === void 0 ? void 0 : _s.lastError) || null,
            },
        },
        updatedAt: secret.updatedAt || null,
        updatedBy: normalizeString(secret.updatedBy) || null,
    };
};
const buildObjectKey = (args) => {
    const safeFileName = toSafePathSegment(args.fileName);
    const safeModule = toSafePathSegment(args.moduleName);
    const safeEntityType = toSafePathSegment(args.entityType);
    const safeEntityId = toSafePathSegment(args.entityId || 'shared');
    const safeProjectId = toSafePathSegment(args.projectId || 'global');
    const stamp = Date.now();
    const nonce = crypto.randomUUID();
    return `tenants/${args.tenantId}/files/${safeModule}/${safeProjectId}/${safeEntityType}/${safeEntityId}/${stamp}_${nonce}_${safeFileName}`;
};
const getGoogleDriveAccessToken = async (tenantId, secret) => {
    const drive = secret.googleDrive;
    if (!drive) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive is not configured.');
    }
    const currentAccessToken = normalizeString(drive.accessToken);
    const tokenExpiryDate = toNumber(drive.tokenExpiryDate);
    if (currentAccessToken && tokenExpiryDate > Date.now() + 60000) {
        return currentAccessToken;
    }
    const refreshToken = normalizeString(drive.refreshToken);
    if (!refreshToken) {
        await secretDocRef(tenantId).set({
            googleDrive: Object.assign(Object.assign({}, (drive || {})), { connected: false, lastError: 'missing_refresh_token', updatedAt: admin.firestore.FieldValue.serverTimestamp() }),
        }, { merge: true });
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive refresh token missing. Reconnect Google Drive.');
    }
    try {
        const oauth = createGoogleOAuthClient();
        oauth.setCredentials({ refresh_token: refreshToken });
        const refreshed = await oauth.refreshAccessToken();
        const credentials = refreshed.credentials || {};
        const nextAccessToken = normalizeString(credentials.access_token);
        const nextExpiry = toNumber(credentials.expiry_date);
        if (!nextAccessToken) {
            throw new Error('Missing refreshed access token.');
        }
        await secretDocRef(tenantId).set({
            googleDrive: Object.assign(Object.assign({}, (drive || {})), { connected: true, accessToken: nextAccessToken, tokenExpiryDate: nextExpiry, scope: normalizeString(credentials.scope) || normalizeString(drive.scope), lastError: admin.firestore.FieldValue.delete() }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return nextAccessToken;
    }
    catch (error) {
        console.error('Failed to refresh Google Drive token', error);
        await secretDocRef(tenantId).set({
            googleDrive: Object.assign(Object.assign({}, (drive || {})), { connected: false, lastError: normalizeString((error === null || error === void 0 ? void 0 : error.message) || 'token_refresh_failed') || 'token_refresh_failed' }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive token refresh failed. Reconnect Google Drive.');
    }
};
const driveApiRequest = async (args) => {
    const token = await getGoogleDriveAccessToken(args.tenantId, args.secret);
    const response = await fetch(args.url, {
        method: args.method || 'GET',
        headers: Object.assign(Object.assign({ Authorization: `Bearer ${token}`, Accept: 'application/json' }, (args.body ? { 'Content-Type': 'application/json' } : {})), (args.headers || {})),
        body: args.body,
    });
    const rawBody = await response.text();
    let parsed = {};
    try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
    }
    catch (_a) {
        parsed = {};
    }
    if (!response.ok) {
        throw new functions.https.HttpsError('failed-precondition', `Google Drive API failed with HTTP ${response.status}. ${rawBody.slice(0, 300)}`);
    }
    return parsed;
};
const createDriveResumableUpload = async (args) => {
    const token = await getGoogleDriveAccessToken(args.tenantId, args.secret);
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,parents,webViewLink', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Upload-Content-Type': args.mimeType,
        },
        body: JSON.stringify({
            name: args.fileName,
            parents: [args.folderId],
            appProperties: args.metadata || {},
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new functions.https.HttpsError('failed-precondition', `Failed to create Google Drive resumable upload session. HTTP ${response.status}. ${body.slice(0, 300)}`);
    }
    const location = response.headers.get('location') || '';
    if (!location) {
        throw new functions.https.HttpsError('internal', 'Google Drive did not return resumable upload URL.');
    }
    return location;
};
const generateUploadTarget = async (args) => {
    if (args.resolvedProvider === 'firebase') {
        const bucket = fileBucket();
        const [uploadUrl] = await bucket.file(args.objectKey).getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + STORAGE_SIGNED_URL_TTL_MS,
            contentType: args.mimeType,
        });
        return {
            providerRef: {
                firebasePath: args.objectKey,
            },
            uploadTarget: {
                method: 'PUT',
                url: uploadUrl,
                headers: {
                    'Content-Type': args.mimeType,
                },
            },
        };
    }
    if (args.resolvedProvider === 's3') {
        const s3 = args.secret.s3;
        if (!s3 || !isS3Ready(s3)) {
            throw new functions.https.HttpsError('failed-precondition', 'S3 is not configured.');
        }
        const bucket = normalizeString(s3.bucket);
        const pathPrefix = normalizeString(s3.pathPrefix);
        const key = pathPrefix ? `${pathPrefix.replace(/\/+$/, '')}/${args.objectKey}` : args.objectKey;
        const client = createS3Client(s3);
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: args.mimeType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(client, command, { expiresIn: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000) });
        return {
            providerRef: {
                s3: {
                    key,
                    bucket,
                    region: normalizeString(s3.region),
                    endpoint: normalizeString(s3.endpoint),
                    forcePathStyle: Boolean(s3.forcePathStyle),
                },
            },
            uploadTarget: {
                method: 'PUT',
                url: uploadUrl,
                headers: {
                    'Content-Type': args.mimeType,
                },
            },
        };
    }
    const drive = args.secret.googleDrive;
    if (!drive || !isGoogleDriveReady(drive)) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive is not connected.');
    }
    const folderId = normalizeString(drive.folderId);
    const uploadUrl = await createDriveResumableUpload({
        tenantId: args.tenantId,
        secret: args.secret,
        fileName: args.fileName,
        mimeType: args.mimeType,
        folderId,
        metadata: {
            tenantId: args.tenantId,
            module: args.moduleName,
            entityType: args.entityType,
            entityId: args.entityId,
        },
    });
    return {
        providerRef: {
            googleDrive: {
                fileId: '',
                folderId,
            },
            driveUploadUrl: uploadUrl,
        },
        uploadTarget: {
            method: 'PUT',
            url: uploadUrl,
            headers: {
                'Content-Type': args.mimeType,
            },
        },
    };
};
const verifyUploadAndBuildProviderRef = async (args) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const resolvedProvider = normalizeString(args.draftData.resolvedProvider);
    if (resolvedProvider === 'firebase') {
        const objectPath = normalizeString((_a = args.draftData.providerRef) === null || _a === void 0 ? void 0 : _a.firebasePath);
        const bucket = fileBucket();
        const file = bucket.file(objectPath);
        const [exists] = await file.exists();
        if (!exists) {
            throw new functions.https.HttpsError('failed-precondition', 'Firebase upload not found.');
        }
        const [metadata] = await file.getMetadata();
        return {
            providerRef: {
                firebasePath: objectPath,
            },
            sizeBytes: toNumber(metadata === null || metadata === void 0 ? void 0 : metadata.size) || toNumber(args.draftData.sizeBytes),
            mimeType: normalizeString(metadata === null || metadata === void 0 ? void 0 : metadata.contentType) || normalizeString(args.draftData.mimeType),
        };
    }
    if (resolvedProvider === 's3') {
        const s3Ref = ((_b = args.draftData.providerRef) === null || _b === void 0 ? void 0 : _b.s3) || {};
        const bucket = normalizeString(s3Ref.bucket);
        const key = normalizeString(s3Ref.key);
        const region = normalizeString(s3Ref.region);
        const endpoint = normalizeString(s3Ref.endpoint);
        const forcePathStyle = Boolean(s3Ref.forcePathStyle);
        if (!bucket || !key) {
            throw new functions.https.HttpsError('failed-precondition', 'S3 upload reference is missing.');
        }
        const client = new client_s3_1.S3Client({
            region: region || DEFAULT_S3_REGION,
            endpoint: endpoint || DEFAULT_S3_ENDPOINT,
            forcePathStyle,
            credentials: {
                accessKeyId: normalizeString((_c = args.secret.s3) === null || _c === void 0 ? void 0 : _c.accessKeyId),
                secretAccessKey: normalizeString((_d = args.secret.s3) === null || _d === void 0 ? void 0 : _d.secretAccessKey),
            },
        });
        const metadata = await client.send(new client_s3_1.HeadObjectCommand({
            Bucket: bucket,
            Key: key,
        }));
        return {
            providerRef: {
                s3: {
                    key,
                    bucket,
                    region,
                    endpoint,
                    forcePathStyle,
                },
            },
            sizeBytes: toNumber(metadata.ContentLength) || toNumber(args.draftData.sizeBytes),
            mimeType: normalizeString(metadata.ContentType) || normalizeString(args.draftData.mimeType),
        };
    }
    const maybeFileId = normalizeString((_e = args.providerResult) === null || _e === void 0 ? void 0 : _e.fileId)
        || normalizeString((_f = args.providerResult) === null || _f === void 0 ? void 0 : _f.id);
    let fileId = maybeFileId;
    let mimeType = normalizeString(args.draftData.mimeType);
    let sizeBytes = toNumber(args.draftData.sizeBytes);
    if (!fileId) {
        const body = typeof ((_g = args.providerResult) === null || _g === void 0 ? void 0 : _g.responseBody) === 'string'
            ? (_h = args.providerResult) === null || _h === void 0 ? void 0 : _h.responseBody
            : '';
        if (body) {
            try {
                const parsed = JSON.parse(body);
                fileId = normalizeString(parsed.id);
                mimeType = normalizeString(parsed.mimeType) || mimeType;
                sizeBytes = toNumber(parsed.size) || sizeBytes;
            }
            catch (_m) {
                // no-op
            }
        }
    }
    if (!fileId) {
        throw new functions.https.HttpsError('invalid-argument', 'Google Drive upload finalize requires providerResult.fileId or providerResult.responseBody with id.');
    }
    // Verify file exists.
    const driveFile = await driveApiRequest({
        tenantId: args.tenantId,
        secret: args.secret,
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents`,
    });
    return {
        providerRef: {
            googleDrive: {
                fileId,
                folderId: normalizeString(((_j = driveFile.parents) === null || _j === void 0 ? void 0 : _j[0]) || ((_l = (_k = args.draftData.providerRef) === null || _k === void 0 ? void 0 : _k.googleDrive) === null || _l === void 0 ? void 0 : _l.folderId)),
            },
        },
        sizeBytes: toNumber(driveFile.size) || sizeBytes,
        mimeType: normalizeString(driveFile.mimeType) || mimeType,
    };
};
const generateDownloadUrlFromRecord = async (tenantId, secret, record) => {
    var _a, _b;
    if (record.provider === 'firebase') {
        const objectPath = normalizeString(record.providerRef.firebasePath);
        const bucket = fileBucket();
        const [downloadUrl] = await bucket.file(objectPath).getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + STORAGE_SIGNED_URL_TTL_MS,
        });
        return downloadUrl;
    }
    if (record.provider === 's3') {
        const s3Ref = record.providerRef.s3;
        if (!s3Ref) {
            throw new functions.https.HttpsError('failed-precondition', 'S3 file reference missing.');
        }
        const client = new client_s3_1.S3Client({
            region: s3Ref.region || DEFAULT_S3_REGION,
            endpoint: s3Ref.endpoint || DEFAULT_S3_ENDPOINT,
            forcePathStyle: Boolean(s3Ref.forcePathStyle),
            credentials: {
                accessKeyId: normalizeString((_a = secret.s3) === null || _a === void 0 ? void 0 : _a.accessKeyId),
                secretAccessKey: normalizeString((_b = secret.s3) === null || _b === void 0 ? void 0 : _b.secretAccessKey),
            },
        });
        const getCommand = new client_s3_1.GetObjectCommand({
            Bucket: s3Ref.bucket,
            Key: s3Ref.key,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(client, getCommand, { expiresIn: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000) });
    }
    const driveRef = record.providerRef.googleDrive;
    if (!(driveRef === null || driveRef === void 0 ? void 0 : driveRef.fileId)) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive file reference missing.');
    }
    const token = await getGoogleDriveAccessToken(tenantId, secret);
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveRef.fileId)}?alt=media&access_token=${encodeURIComponent(token)}`;
};
const deleteProviderObject = async (args) => {
    var _a, _b;
    if (args.record.provider === 'firebase') {
        const objectPath = normalizeString(args.record.providerRef.firebasePath);
        if (objectPath) {
            await fileBucket().file(objectPath).delete({ ignoreNotFound: true });
        }
        return;
    }
    if (args.record.provider === 's3') {
        const s3Ref = args.record.providerRef.s3;
        if (!s3Ref)
            return;
        const client = new client_s3_1.S3Client({
            region: s3Ref.region || DEFAULT_S3_REGION,
            endpoint: s3Ref.endpoint || DEFAULT_S3_ENDPOINT,
            forcePathStyle: Boolean(s3Ref.forcePathStyle),
            credentials: {
                accessKeyId: normalizeString((_a = args.secret.s3) === null || _a === void 0 ? void 0 : _a.accessKeyId),
                secretAccessKey: normalizeString((_b = args.secret.s3) === null || _b === void 0 ? void 0 : _b.secretAccessKey),
            },
        });
        await client.send(new client_s3_1.DeleteObjectCommand({
            Bucket: s3Ref.bucket,
            Key: s3Ref.key,
        }));
        return;
    }
    const driveRef = args.record.providerRef.googleDrive;
    if (!(driveRef === null || driveRef === void 0 ? void 0 : driveRef.fileId))
        return;
    await driveApiRequest({
        tenantId: args.tenantId,
        secret: args.secret,
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveRef.fileId)}`,
        method: 'DELETE',
    });
};
exports.getWorkspaceFileStorageConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    await requireStorageConfigViewPermission(tenantId, context);
    const secret = await getSecretConfig(tenantId);
    return {
        config: sanitizeSecretForClient(secret),
    };
});
exports.saveWorkspaceFileStorageConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireStorageConfigManagePermission(tenantId, context);
    const activeProviderInput = normalizeString(data === null || data === void 0 ? void 0 : data.activeProvider);
    const activeProvider = (activeProviderInput === 's3' || activeProviderInput === 'googleDrive' || activeProviderInput === 'firebase'
        ? activeProviderInput
        : 'firebase');
    const existing = await getSecretConfig(tenantId);
    const nextS3 = normalizeS3Config(data === null || data === void 0 ? void 0 : data.s3Config, existing.s3);
    const nextGoogleDrive = normalizeGoogleDriveConfig(data === null || data === void 0 ? void 0 : data.googleDriveConfig, existing.googleDrive);
    await secretDocRef(tenantId).set({
        activeProvider,
        s3: Object.assign(Object.assign({}, (existing.s3 || {})), nextS3),
        googleDrive: Object.assign(Object.assign({}, (existing.googleDrive || {})), nextGoogleDrive),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId,
    }, { merge: true });
    const updated = await getSecretConfig(tenantId);
    return {
        config: sanitizeSecretForClient(updated),
    };
});
exports.testWorkspaceFileStorageConnection = functions.region(REGION).https.onCall(async (data, context) => {
    var _a, _b;
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireStorageConfigManagePermission(tenantId, context);
    const providerInput = normalizeString(data === null || data === void 0 ? void 0 : data.provider);
    if (providerInput !== 'firebase' && providerInput !== 's3' && providerInput !== 'googleDrive') {
        throw new functions.https.HttpsError('invalid-argument', 'provider must be one of firebase, s3, googleDrive.');
    }
    const secret = await getSecretConfig(tenantId);
    if (providerInput === 'firebase') {
        const bucket = fileBucket();
        const [metadata] = await bucket.getMetadata();
        await secretDocRef(tenantId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: actorId,
        }, { merge: true });
        return {
            ok: true,
            provider: 'firebase',
            message: `Connected to Firebase bucket ${(metadata === null || metadata === void 0 ? void 0 : metadata.name) || bucket.name}.`,
        };
    }
    if (providerInput === 's3') {
        const s3Config = normalizeS3Config(data === null || data === void 0 ? void 0 : data.s3Config, secret.s3);
        if (!isS3Ready(s3Config)) {
            throw new functions.https.HttpsError('failed-precondition', 'S3 configuration incomplete.');
        }
        const client = createS3Client(s3Config);
        await client.send(new client_s3_1.HeadBucketCommand({
            Bucket: normalizeString(s3Config.bucket),
        }));
        await secretDocRef(tenantId).set({
            s3: Object.assign(Object.assign(Object.assign({}, (secret.s3 || {})), s3Config), { lastTestedAt: admin.firestore.FieldValue.serverTimestamp(), connectedAt: admin.firestore.FieldValue.serverTimestamp() }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: actorId,
        }, { merge: true });
        return {
            ok: true,
            provider: 's3',
            message: `Connected to S3 bucket ${normalizeString(s3Config.bucket)}.`,
        };
    }
    if (!isGoogleDriveReady(secret.googleDrive)) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive is not connected.');
    }
    const driveFolder = await driveApiRequest({
        tenantId,
        secret,
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(normalizeString((_a = secret.googleDrive) === null || _a === void 0 ? void 0 : _a.folderId))}?fields=id,name,mimeType`,
    });
    await secretDocRef(tenantId).set({
        googleDrive: Object.assign(Object.assign({}, (secret.googleDrive || {})), { lastTestedAt: admin.firestore.FieldValue.serverTimestamp(), lastError: admin.firestore.FieldValue.delete() }),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId,
    }, { merge: true });
    return {
        ok: true,
        provider: 'googleDrive',
        message: `Connected to Google Drive folder ${normalizeString(driveFolder.name) || normalizeString((_b = secret.googleDrive) === null || _b === void 0 ? void 0 : _b.folderId)}.`,
    };
});
exports.getGoogleDriveStorageAuthUrl = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireStorageConfigManagePermission(tenantId, context);
    const oauth = createGoogleOAuthClient();
    const stateId = crypto.randomUUID();
    const csrf = crypto.randomBytes(12).toString('hex');
    await authStateDocRef(tenantId, stateId).set({
        tenantId,
        userId: actorId,
        csrf,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    });
    const statePayload = Buffer.from(JSON.stringify({
        tenantId,
        stateId,
        csrf,
        userId: actorId,
    })).toString('base64url');
    const url = oauth.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: GOOGLE_DRIVE_SCOPES,
        state: statePayload,
    });
    return { url };
});
exports.disconnectGoogleDriveStorage = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const actorId = await requireStorageConfigManagePermission(tenantId, context);
    await secretDocRef(tenantId).set({
        googleDrive: {
            connected: false,
            folderId: admin.firestore.FieldValue.delete(),
            folderName: admin.firestore.FieldValue.delete(),
            email: admin.firestore.FieldValue.delete(),
            scope: admin.firestore.FieldValue.delete(),
            accessToken: admin.firestore.FieldValue.delete(),
            refreshToken: admin.firestore.FieldValue.delete(),
            tokenExpiryDate: admin.firestore.FieldValue.delete(),
            connectedAt: admin.firestore.FieldValue.delete(),
            lastTestedAt: admin.firestore.FieldValue.delete(),
            lastError: admin.firestore.FieldValue.delete(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId,
    }, { merge: true });
    const updated = await getSecretConfig(tenantId);
    return {
        config: sanitizeSecretForClient(updated),
    };
});
exports.createTenantFileUploadSession = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {});
    const tenantId = normalizeString(payload.tenantId);
    const moduleName = normalizeString(payload.module);
    const entityType = normalizeString(payload.entityType);
    const entityId = normalizeString(payload.entityId);
    const projectId = normalizeString(payload.projectId) || null;
    const fileName = normalizeString(payload.fileName);
    const mimeType = normalizeString(payload.mimeType) || 'application/octet-stream';
    const sizeBytes = toNumber(payload.sizeBytes);
    if (!moduleName || !entityType || !fileName) {
        throw new functions.https.HttpsError('invalid-argument', 'module, entityType, and fileName are required.');
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
        throw new functions.https.HttpsError('invalid-argument', `sizeBytes must be between 1 and ${MAX_UPLOAD_BYTES}.`);
    }
    const actorId = await requireUploadPermission(tenantId, context, moduleName);
    const secret = await getSecretConfig(tenantId);
    const provider = resolveProvider(secret);
    const objectKey = buildObjectKey({
        tenantId,
        moduleName,
        entityType,
        entityId,
        projectId,
        fileName,
    });
    const target = await generateUploadTarget({
        tenantId,
        secret,
        resolvedProvider: provider.resolvedProvider,
        objectKey,
        fileName,
        mimeType,
        moduleName,
        entityType,
        entityId,
    });
    const draftRef = uploadDraftDocRef(tenantId, crypto.randomUUID());
    await draftRef.set({
        tenantId,
        module: moduleName,
        entityType,
        entityId,
        projectId,
        fileName,
        mimeType,
        sizeBytes,
        requestedProvider: provider.requestedProvider,
        resolvedProvider: provider.resolvedProvider,
        fallbackReason: provider.fallbackReason || null,
        providerRef: target.providerRef,
        createdBy: actorId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + UPLOAD_DRAFT_TTL_MS),
    });
    return {
        uploadDraftId: draftRef.id,
        requestedProvider: provider.requestedProvider,
        resolvedProvider: provider.resolvedProvider,
        fallbackToFirebase: provider.resolvedProvider !== provider.requestedProvider,
        uploadTarget: target.uploadTarget,
    };
});
exports.finalizeTenantFileUpload = functions.region(REGION).https.onCall(async (data, context) => {
    var _a, _b;
    const payload = (data || {});
    const tenantId = normalizeString(payload.tenantId);
    const draftId = normalizeString(payload.uploadDraftId);
    if (!tenantId || !draftId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and uploadDraftId are required.');
    }
    const actorId = requireAuth(context);
    const draftRef = uploadDraftDocRef(tenantId, draftId);
    const draftSnap = await draftRef.get();
    if (!draftSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Upload draft not found.');
    }
    const draftData = draftSnap.data() || {};
    const moduleName = normalizeString(draftData.module);
    await requireUploadPermission(tenantId, context, moduleName);
    if (normalizeString(draftData.createdBy) && normalizeString(draftData.createdBy) !== actorId) {
        throw new functions.https.HttpsError('permission-denied', 'Only the uploader can finalize this draft.');
    }
    const expiresAtMillis = ((_b = (_a = draftData.expiresAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
    if (expiresAtMillis && expiresAtMillis < Date.now()) {
        throw new functions.https.HttpsError('deadline-exceeded', 'Upload draft expired. Create a new upload session.');
    }
    const secret = await getSecretConfig(tenantId);
    const verification = await verifyUploadAndBuildProviderRef({
        tenantId,
        secret,
        draftData,
        providerResult: payload.providerResult || undefined,
    });
    const fileRef = filesCollectionRef(tenantId).doc();
    const fileRecord = {
        tenantId,
        module: moduleName,
        entityType: normalizeString(draftData.entityType),
        entityId: normalizeString(draftData.entityId),
        projectId: normalizeString(draftData.projectId) || null,
        provider: normalizeString(draftData.resolvedProvider),
        requestedProvider: normalizeString(draftData.requestedProvider),
        fallbackToFirebase: normalizeString(draftData.resolvedProvider) !== normalizeString(draftData.requestedProvider),
        fileName: normalizeString(draftData.fileName),
        mimeType: verification.mimeType,
        sizeBytes: verification.sizeBytes,
        status: 'ready',
        providerRef: verification.providerRef,
        createdBy: actorId,
    };
    await fileRef.set(Object.assign(Object.assign({}, fileRecord), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
    await draftRef.delete();
    const persisted = (await fileRef.get()).data();
    const downloadUrl = await generateDownloadUrlFromRecord(tenantId, secret, persisted);
    return {
        file: Object.assign(Object.assign({ id: fileRef.id }, persisted), { downloadUrl }),
    };
});
exports.listTenantFiles = functions.region(REGION).https.onCall(async (data, context) => {
    var _a;
    const payload = (data || {});
    const tenantId = normalizeString(payload.tenantId);
    const moduleName = normalizeString(payload.module);
    const projectId = normalizeString(payload.projectId);
    const entityType = normalizeString(payload.entityType);
    const entityId = normalizeString(payload.entityId);
    const cursor = normalizeString(payload.cursor);
    const limitValue = Math.max(1, Math.min(100, Math.floor(toNumber(payload.limit) || 30)));
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }
    if (moduleName) {
        await requireReadPermission(tenantId, context, moduleName);
    }
    else {
        await requireTenantAccess(tenantId, context);
    }
    const snapshot = await filesCollectionRef(tenantId).limit(500).get();
    const secret = await getSecretConfig(tenantId);
    const filtered = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, row: docSnap.data() }))
        .filter(({ row }) => row.status === 'ready')
        .filter(({ row }) => (!moduleName || row.module === moduleName))
        .filter(({ row }) => (!projectId || normalizeString(row.projectId) === projectId))
        .filter(({ row }) => (!entityType || row.entityType === entityType))
        .filter(({ row }) => (!entityId || row.entityId === entityId))
        .sort((a, b) => {
        var _a, _b, _c, _d;
        const aMillis = ((_b = (_a = a.row.createdAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
        const bMillis = ((_d = (_c = b.row.createdAt) === null || _c === void 0 ? void 0 : _c.toMillis) === null || _d === void 0 ? void 0 : _d.call(_c)) || 0;
        return bMillis - aMillis;
    });
    const startIndex = cursor ? Math.max(0, filtered.findIndex((item) => item.id === cursor) + 1) : 0;
    const page = filtered.slice(startIndex, startIndex + limitValue);
    const files = await Promise.all(page.map(async ({ id, row }) => {
        const downloadUrl = await generateDownloadUrlFromRecord(tenantId, secret, row);
        return Object.assign(Object.assign({ id }, row), { downloadUrl });
    }));
    const nextCursor = (startIndex + limitValue) < filtered.length
        ? ((_a = page[page.length - 1]) === null || _a === void 0 ? void 0 : _a.id) || null
        : null;
    return { files, nextCursor };
});
exports.getTenantFileDownloadUrl = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const fileId = normalizeString(data === null || data === void 0 ? void 0 : data.fileId);
    if (!tenantId || !fileId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and fileId are required.');
    }
    const fileSnap = await filesCollectionRef(tenantId).doc(fileId).get();
    if (!fileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'File not found.');
    }
    const record = fileSnap.data();
    await requireReadPermission(tenantId, context, record.module);
    const secret = await getSecretConfig(tenantId);
    const downloadUrl = await generateDownloadUrlFromRecord(tenantId, secret, record);
    return {
        fileId,
        downloadUrl,
        expiresInSeconds: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000),
    };
});
exports.deleteTenantFile = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const fileId = normalizeString(data === null || data === void 0 ? void 0 : data.fileId);
    if (!tenantId || !fileId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and fileId are required.');
    }
    const fileRef = filesCollectionRef(tenantId).doc(fileId);
    const fileSnap = await fileRef.get();
    if (!fileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'File not found.');
    }
    const row = fileSnap.data();
    await requireDeletePermission(tenantId, context, row.module);
    const secret = await getSecretConfig(tenantId);
    await deleteProviderObject({
        tenantId,
        secret,
        record: row,
    });
    await fileRef.delete();
    return {
        success: true,
    };
});
exports.googleDriveStorageCallback = functions.region(REGION).https.onRequest(async (req, res) => {
    var _a, _b;
    const code = normalizeString(req.query.code);
    const state = normalizeString(req.query.state);
    const error = normalizeString(req.query.error);
    if (error) {
        res.status(400).send(`Google Drive OAuth error: ${error}`);
        return;
    }
    if (!code || !state) {
        res.status(400).send('Missing code or state.');
        return;
    }
    try {
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        const tenantId = normalizeString(decoded.tenantId);
        const stateId = normalizeString(decoded.stateId);
        const csrf = normalizeString(decoded.csrf);
        const userId = normalizeString(decoded.userId);
        if (!tenantId || !stateId || !csrf || !userId) {
            throw new Error('Invalid OAuth state payload.');
        }
        const authStateRef = authStateDocRef(tenantId, stateId);
        const authStateSnap = await authStateRef.get();
        if (!authStateSnap.exists) {
            throw new Error('OAuth state not found or already used.');
        }
        const authState = authStateSnap.data() || {};
        const expectedCsrf = normalizeString(authState.csrf);
        if (!expectedCsrf || expectedCsrf !== csrf) {
            throw new Error('OAuth state CSRF validation failed.');
        }
        const expiresAtMillis = ((_b = (_a = authState.expiresAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0;
        if (expiresAtMillis && expiresAtMillis < Date.now()) {
            throw new Error('OAuth state expired.');
        }
        const oauth = createGoogleOAuthClient();
        const tokenResponse = await oauth.getToken(code);
        const tokens = tokenResponse.tokens || {};
        const existing = await getSecretConfig(tenantId);
        const previousDrive = existing.googleDrive || {};
        const accessToken = normalizeString(tokens.access_token) || normalizeString(previousDrive.accessToken);
        const refreshToken = normalizeString(tokens.refresh_token) || normalizeString(previousDrive.refreshToken);
        const expiryDate = toNumber(tokens.expiry_date) || toNumber(previousDrive.tokenExpiryDate) || 0;
        const scope = normalizeString(tokens.scope) || normalizeString(previousDrive.scope);
        if (!accessToken && !refreshToken) {
            throw new Error('Google OAuth did not return tokens.');
        }
        const tempSecret = Object.assign(Object.assign({}, existing), { googleDrive: Object.assign(Object.assign({}, (previousDrive || {})), { connected: true, accessToken,
                refreshToken, tokenExpiryDate: expiryDate, scope }) });
        // Resolve user email.
        let email = normalizeString(previousDrive.email);
        try {
            const userInfo = await driveApiRequest({
                tenantId,
                secret: tempSecret,
                url: 'https://www.googleapis.com/oauth2/v2/userinfo?fields=email',
            });
            email = normalizeString(userInfo.email) || email;
        }
        catch (userinfoError) {
            console.warn('Failed to fetch Google user email', userinfoError);
        }
        // Ensure workspace folder.
        let folderId = normalizeString(previousDrive.folderId);
        let folderName = normalizeString(previousDrive.folderName) || `ProjectFlow ${tenantId}`;
        if (!folderId) {
            const createdFolder = await driveApiRequest({
                tenantId,
                secret: tempSecret,
                url: 'https://www.googleapis.com/drive/v3/files?fields=id,name',
                method: 'POST',
                body: JSON.stringify({
                    name: folderName,
                    mimeType: 'application/vnd.google-apps.folder',
                }),
            });
            folderId = normalizeString(createdFolder.id);
            folderName = normalizeString(createdFolder.name) || folderName;
        }
        if (!folderId) {
            throw new Error('Failed to create or resolve Google Drive folder.');
        }
        await secretDocRef(tenantId).set({
            googleDrive: {
                connected: true,
                folderId,
                folderName,
                email,
                scope,
                accessToken,
                refreshToken,
                tokenExpiryDate: expiryDate,
                connectedAt: previousDrive.connectedAt || admin.firestore.FieldValue.serverTimestamp(),
                lastError: admin.firestore.FieldValue.delete(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId,
        }, { merge: true });
        await authStateRef.delete();
        res.send(`
            <html>
                <body>
                    <h1>Google Drive connected</h1>
                    <p>You can close this window now.</p>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'GOOGLE_DRIVE_STORAGE_CONNECTED' }, '*');
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
    }
    catch (callbackError) {
        console.error('googleDriveStorageCallback failed', callbackError);
        res.status(500).send(`Google Drive connection failed: ${(callbackError === null || callbackError === void 0 ? void 0 : callbackError.message) || 'unknown error'}`);
    }
});
//# sourceMappingURL=file-storage.js.map