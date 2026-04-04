import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions';
import { OAuth2Client } from 'google-auth-library';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';

import { db } from './init';

type StorageProvider = 'firebase' | 's3' | 'googleDrive';
type UploadModule = 'media' | 'profile' | 'project' | 'finance' | (string & {});

type FileStorageSecret = {
    activeProvider?: StorageProvider;
    s3?: {
        endpoint?: string;
        region?: string;
        bucket?: string;
        pathPrefix?: string;
        forcePathStyle?: boolean;
        accessKeyId?: string;
        secretAccessKey?: string;
        connectedAt?: unknown;
        lastTestedAt?: unknown;
    };
    googleDrive?: {
        connected?: boolean;
        folderId?: string;
        folderName?: string;
        email?: string;
        scope?: string;
        accessToken?: string;
        refreshToken?: string;
        tokenExpiryDate?: number;
        connectedAt?: unknown;
        lastTestedAt?: unknown;
        lastError?: string;
    };
    updatedAt?: unknown;
    updatedBy?: string;
};

type TenantFileRecord = {
    tenantId: string;
    module: UploadModule;
    entityType: string;
    entityId: string;
    projectId: string | null;
    provider: StorageProvider;
    requestedProvider: StorageProvider;
    fallbackToFirebase: boolean;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    status: 'ready' | 'deleted';
    providerRef: {
        firebasePath?: string;
        s3?: {
            key: string;
            bucket: string;
            region: string;
            endpoint: string;
            forcePathStyle: boolean;
        };
        googleDrive?: {
            fileId: string;
            folderId?: string;
        };
    };
    createdBy: string;
    createdAt?: unknown;
    updatedAt?: unknown;
};

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

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toSafePathSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const toBoolean = (value: unknown) => Boolean(value);
const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const requireAuth = (context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};

const getMembership = async (tenantId: string, uid: string) => {
    if (!tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId is required.');
    }

    if (uid === tenantId) {
        return { exists: true, role: 'Owner', roleIds: ['Owner'] };
    }

    const membershipSnap = await db.collection('tenants').doc(tenantId).collection('members').doc(uid).get();
    if (!membershipSnap.exists) {
        return { exists: false, role: '', roleIds: [] as string[] };
    }

    const membership = membershipSnap.data() || {};
    const role = normalizeString((membership as any).role) || 'Member';
    const roleIds = Array.isArray((membership as any).roleIds)
        ? (membership as any).roleIds.filter((entry: unknown): entry is string => typeof entry === 'string')
        : [];

    if (role && !roleIds.includes(role)) {
        roleIds.unshift(role);
    }

    return { exists: true, role, roleIds };
};

const hasPermissionBySystemRole = (role: string, permission: string) => {
    if (role === 'Owner') return true;

    if (role === 'Admin') {
        if (permission.startsWith('tenant.integrations.')) return true;
        if (permission.startsWith('tenant.media.')) return true;
        if (permission.startsWith('tenant.finance.')) return true;
        return false;
    }

    if (role === 'Member') {
        if (permission === 'tenant.media.view' || permission === 'tenant.media.upload') return true;
        return false;
    }

    return false;
};

const hasTenantPermission = async (tenantId: string, uid: string, permission: string) => {
    const membership = await getMembership(tenantId, uid);
    if (!membership.exists) return false;

    const primaryRole = membership.role || 'Member';
    if (hasPermissionBySystemRole(primaryRole, permission)) {
        return true;
    }

    // Support custom role permissions from tenant.customRoles.
    const tenantSnap = await db.collection('tenants').doc(tenantId).get();
    const customRoles = Array.isArray(tenantSnap.data()?.customRoles)
        ? (tenantSnap.data()?.customRoles as Array<Record<string, unknown>>)
        : [];

    const assignedRoleIds = new Set<string>(membership.roleIds);
    for (const role of customRoles) {
        const roleId = normalizeString(role.id);
        if (!roleId || !assignedRoleIds.has(roleId)) continue;

        const permissions = Array.isArray(role.permissions)
            ? role.permissions.filter((entry): entry is string => typeof entry === 'string')
            : [];

        if (permissions.includes(permission)) {
            return true;
        }
    }

    return false;
};

const requireTenantAccess = async (tenantId: string, context: functions.https.CallableContext) => {
    const uid = requireAuth(context);
    const membership = await getMembership(tenantId, uid);
    if (!membership.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Workspace access required.');
    }
    return uid;
};

const requireTenantPermission = async (
    tenantId: string,
    context: functions.https.CallableContext,
    permission: string,
) => {
    const uid = requireAuth(context);
    const allowed = await hasTenantPermission(tenantId, uid, permission);
    if (!allowed) {
        throw new functions.https.HttpsError('permission-denied', `Missing permission ${permission}.`);
    }
    return uid;
};

const requireStorageConfigManagePermission = async (tenantId: string, context: functions.https.CallableContext) => {
    return requireTenantPermission(tenantId, context, 'tenant.integrations.manage');
};

const requireStorageConfigViewPermission = async (tenantId: string, context: functions.https.CallableContext) => {
    const uid = requireAuth(context);
    const canView = await hasTenantPermission(tenantId, uid, 'tenant.integrations.view')
        || await hasTenantPermission(tenantId, uid, 'tenant.integrations.manage');

    if (!canView) {
        throw new functions.https.HttpsError('permission-denied', 'Integration view access required.');
    }

    return uid;
};

const requireUploadPermission = async (
    tenantId: string,
    context: functions.https.CallableContext,
    moduleName: UploadModule,
) => {
    if (moduleName === 'finance') {
        return requireTenantPermission(tenantId, context, 'tenant.finance.ap.manage');
    }

    return requireTenantPermission(tenantId, context, 'tenant.media.upload');
};

const requireReadPermission = async (
    tenantId: string,
    context: functions.https.CallableContext,
    moduleName: UploadModule,
) => {
    if (moduleName === 'finance') {
        return requireTenantPermission(tenantId, context, 'tenant.finance.ap.manage');
    }

    return requireTenantPermission(tenantId, context, 'tenant.media.view');
};

const requireDeletePermission = async (
    tenantId: string,
    context: functions.https.CallableContext,
    moduleName: UploadModule,
) => {
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

const secretDocRef = (tenantId: string) => db.collection('tenants').doc(tenantId).collection('secrets').doc(FILE_STORAGE_SECRET_ID);
const authStateDocRef = (tenantId: string, stateId: string) => db.collection('tenants').doc(tenantId).collection('secrets').doc(FILE_STORAGE_SECRET_ID).collection(FILE_STORAGE_AUTH_STATE_COLLECTION).doc(stateId);
const uploadDraftDocRef = (tenantId: string, draftId: string) => db.collection('tenants').doc(tenantId).collection('file_upload_drafts').doc(draftId);
const filesCollectionRef = (tenantId: string) => db.collection('tenants').doc(tenantId).collection('files');

const getSecretConfig = async (tenantId: string): Promise<FileStorageSecret> => {
    const secretSnap = await secretDocRef(tenantId).get();
    return (secretSnap.data() || {}) as FileStorageSecret;
};

const normalizeS3Config = (value: unknown, existing?: FileStorageSecret['s3']) => {
    const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : {};

    const endpoint = normalizeString(raw.endpoint) || normalizeString(existing?.endpoint) || DEFAULT_S3_ENDPOINT;
    const region = normalizeString(raw.region) || normalizeString(existing?.region) || DEFAULT_S3_REGION;
    const bucket = normalizeString(raw.bucket) || normalizeString(existing?.bucket);
    const pathPrefix = normalizeString(raw.pathPrefix) || normalizeString(existing?.pathPrefix);
    const forcePathStyle = raw.forcePathStyle !== undefined ? toBoolean(raw.forcePathStyle) : Boolean(existing?.forcePathStyle);

    const accessKeyIdInput = normalizeString(raw.accessKeyId);
    const secretAccessKeyInput = normalizeString(raw.secretAccessKey);

    return {
        endpoint,
        region,
        bucket,
        pathPrefix,
        forcePathStyle,
        accessKeyId: accessKeyIdInput || normalizeString(existing?.accessKeyId),
        secretAccessKey: secretAccessKeyInput || normalizeString(existing?.secretAccessKey),
    };
};

const normalizeGoogleDriveConfig = (value: unknown, existing?: FileStorageSecret['googleDrive']) => {
    const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : {};

    const folderId = normalizeString(raw.folderId) || normalizeString(existing?.folderId);
    const folderName = normalizeString(raw.folderName) || normalizeString(existing?.folderName);

    return {
        connected: Boolean(existing?.connected),
        folderId,
        folderName,
        email: normalizeString(existing?.email),
        scope: normalizeString(existing?.scope),
        accessToken: normalizeString(existing?.accessToken),
        refreshToken: normalizeString(existing?.refreshToken),
        tokenExpiryDate: toNumber(existing?.tokenExpiryDate) || 0,
        connectedAt: existing?.connectedAt || null,
        lastTestedAt: existing?.lastTestedAt || null,
        lastError: normalizeString(existing?.lastError),
    };
};

const isS3Ready = (s3?: FileStorageSecret['s3']) => Boolean(
    s3
    && normalizeString(s3.bucket)
    && normalizeString(s3.accessKeyId)
    && normalizeString(s3.secretAccessKey)
    && normalizeString(s3.region)
    && normalizeString(s3.endpoint)
);

const isGoogleDriveReady = (drive?: FileStorageSecret['googleDrive']) => Boolean(
    drive
    && drive.connected
    && normalizeString(drive.folderId)
    && (normalizeString(drive.refreshToken) || (normalizeString(drive.accessToken) && toNumber(drive.tokenExpiryDate) > Date.now()))
);

const resolveProvider = (secret: FileStorageSecret) => {
    const activeProvider = (normalizeString(secret.activeProvider) as StorageProvider) || 'firebase';

    if (activeProvider === 's3') {
        if (isS3Ready(secret.s3)) {
            return { requestedProvider: activeProvider, resolvedProvider: 's3' as StorageProvider, fallbackReason: '' };
        }
        return { requestedProvider: activeProvider, resolvedProvider: 'firebase' as StorageProvider, fallbackReason: 's3_not_configured' };
    }

    if (activeProvider === 'googleDrive') {
        if (isGoogleDriveReady(secret.googleDrive)) {
            return { requestedProvider: activeProvider, resolvedProvider: 'googleDrive' as StorageProvider, fallbackReason: '' };
        }
        return { requestedProvider: activeProvider, resolvedProvider: 'firebase' as StorageProvider, fallbackReason: 'google_drive_not_connected' };
    }

    return { requestedProvider: 'firebase' as StorageProvider, resolvedProvider: 'firebase' as StorageProvider, fallbackReason: '' };
};

const getGoogleDriveRedirectUri = () => {
    const explicit = normalizeString(process.env.GOOGLE_DRIVE_STORAGE_REDIRECT_URI);
    if (explicit) return explicit;

    const projectId = process.env.GCLOUD_PROJECT || 'project-manager-9d0ad';
    return `https://${REGION}-${projectId}.cloudfunctions.net/googleDriveStorageCallback`;
};

const createGoogleOAuthClient = () => {
    if (!GOOGLE_DRIVE_CLIENT_ID || !GOOGLE_DRIVE_CLIENT_SECRET) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive OAuth credentials are not configured.');
    }

    return new OAuth2Client(
        GOOGLE_DRIVE_CLIENT_ID,
        GOOGLE_DRIVE_CLIENT_SECRET,
        getGoogleDriveRedirectUri(),
    );
};

const createS3Client = (s3: NonNullable<FileStorageSecret['s3']>) => {
    return new S3Client({
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
    if (!bucket?.name) {
        throw new functions.https.HttpsError('failed-precondition', 'Firebase storage bucket is not configured.');
    }
    return bucket;
};

const sanitizeSecretForClient = (secret: FileStorageSecret) => {
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
                endpoint: normalizeString(secret.s3?.endpoint),
                region: normalizeString(secret.s3?.region),
                bucket: normalizeString(secret.s3?.bucket),
                pathPrefix: normalizeString(secret.s3?.pathPrefix),
                forcePathStyle: Boolean(secret.s3?.forcePathStyle),
                hasAccessKeyId: Boolean(normalizeString(secret.s3?.accessKeyId)),
                hasSecretAccessKey: Boolean(normalizeString(secret.s3?.secretAccessKey)),
                lastTestedAt: secret.s3?.lastTestedAt || null,
            },
            googleDrive: {
                ready: isGoogleDriveReady(secret.googleDrive),
                connected: Boolean(secret.googleDrive?.connected),
                folderId: normalizeString(secret.googleDrive?.folderId),
                folderName: normalizeString(secret.googleDrive?.folderName),
                email: normalizeString(secret.googleDrive?.email),
                scope: normalizeString(secret.googleDrive?.scope),
                hasRefreshToken: Boolean(normalizeString(secret.googleDrive?.refreshToken)),
                tokenExpiryDate: toNumber(secret.googleDrive?.tokenExpiryDate) || null,
                lastTestedAt: secret.googleDrive?.lastTestedAt || null,
                lastError: normalizeString(secret.googleDrive?.lastError) || null,
            },
        },
        updatedAt: secret.updatedAt || null,
        updatedBy: normalizeString(secret.updatedBy) || null,
    };
};

const buildObjectKey = (args: {
    tenantId: string;
    moduleName: UploadModule;
    entityType: string;
    entityId: string;
    projectId?: string | null;
    fileName: string;
}) => {
    const safeFileName = toSafePathSegment(args.fileName);
    const safeModule = toSafePathSegment(args.moduleName);
    const safeEntityType = toSafePathSegment(args.entityType);
    const safeEntityId = toSafePathSegment(args.entityId || 'shared');
    const safeProjectId = toSafePathSegment(args.projectId || 'global');
    const stamp = Date.now();
    const nonce = crypto.randomUUID();

    return `tenants/${args.tenantId}/files/${safeModule}/${safeProjectId}/${safeEntityType}/${safeEntityId}/${stamp}_${nonce}_${safeFileName}`;
};

const getGoogleDriveAccessToken = async (tenantId: string, secret: FileStorageSecret) => {
    const drive = secret.googleDrive;
    if (!drive) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive is not configured.');
    }

    const currentAccessToken = normalizeString(drive.accessToken);
    const tokenExpiryDate = toNumber(drive.tokenExpiryDate);

    if (currentAccessToken && tokenExpiryDate > Date.now() + 60_000) {
        return currentAccessToken;
    }

    const refreshToken = normalizeString(drive.refreshToken);
    if (!refreshToken) {
        await secretDocRef(tenantId).set({
            googleDrive: {
                ...(drive || {}),
                connected: false,
                lastError: 'missing_refresh_token',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
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
            googleDrive: {
                ...(drive || {}),
                connected: true,
                accessToken: nextAccessToken,
                tokenExpiryDate: nextExpiry,
                scope: normalizeString(credentials.scope) || normalizeString(drive.scope),
                lastError: admin.firestore.FieldValue.delete(),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        return nextAccessToken;
    } catch (error: any) {
        console.error('Failed to refresh Google Drive token', error);

        await secretDocRef(tenantId).set({
            googleDrive: {
                ...(drive || {}),
                connected: false,
                lastError: normalizeString(error?.message || 'token_refresh_failed') || 'token_refresh_failed',
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        throw new functions.https.HttpsError('failed-precondition', 'Google Drive token refresh failed. Reconnect Google Drive.');
    }
};

const driveApiRequest = async (args: {
    tenantId: string;
    secret: FileStorageSecret;
    url: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
}) => {
    const token = await getGoogleDriveAccessToken(args.tenantId, args.secret);
    const response = await fetch(args.url, {
        method: args.method || 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            ...(args.body ? { 'Content-Type': 'application/json' } : {}),
            ...(args.headers || {}),
        },
        body: args.body,
    });

    const rawBody = await response.text();
    let parsed: any = {};
    try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
    } catch {
        parsed = {};
    }

    if (!response.ok) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            `Google Drive API failed with HTTP ${response.status}. ${rawBody.slice(0, 300)}`,
        );
    }

    return parsed;
};

const createDriveResumableUpload = async (args: {
    tenantId: string;
    secret: FileStorageSecret;
    fileName: string;
    mimeType: string;
    folderId: string;
    metadata?: Record<string, string>;
}) => {
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
        throw new functions.https.HttpsError(
            'failed-precondition',
            `Failed to create Google Drive resumable upload session. HTTP ${response.status}. ${body.slice(0, 300)}`,
        );
    }

    const location = response.headers.get('location') || '';
    if (!location) {
        throw new functions.https.HttpsError('internal', 'Google Drive did not return resumable upload URL.');
    }

    return location;
};

const generateUploadTarget = async (args: {
    tenantId: string;
    secret: FileStorageSecret;
    resolvedProvider: StorageProvider;
    objectKey: string;
    fileName: string;
    mimeType: string;
    moduleName: UploadModule;
    entityType: string;
    entityId: string;
}) => {
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

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: args.mimeType,
        });

        const uploadUrl = await getS3SignedUrl(client, command, { expiresIn: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000) });

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

const verifyUploadAndBuildProviderRef = async (args: {
    tenantId: string;
    secret: FileStorageSecret;
    draftData: Record<string, any>;
    providerResult?: Record<string, any>;
}) => {
    const resolvedProvider = normalizeString(args.draftData.resolvedProvider) as StorageProvider;

    if (resolvedProvider === 'firebase') {
        const objectPath = normalizeString(args.draftData.providerRef?.firebasePath);
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
            sizeBytes: toNumber(metadata?.size) || toNumber(args.draftData.sizeBytes),
            mimeType: normalizeString(metadata?.contentType) || normalizeString(args.draftData.mimeType),
        };
    }

    if (resolvedProvider === 's3') {
        const s3Ref = args.draftData.providerRef?.s3 || {};
        const bucket = normalizeString(s3Ref.bucket);
        const key = normalizeString(s3Ref.key);
        const region = normalizeString(s3Ref.region);
        const endpoint = normalizeString(s3Ref.endpoint);
        const forcePathStyle = Boolean(s3Ref.forcePathStyle);

        if (!bucket || !key) {
            throw new functions.https.HttpsError('failed-precondition', 'S3 upload reference is missing.');
        }

        const client = new S3Client({
            region: region || DEFAULT_S3_REGION,
            endpoint: endpoint || DEFAULT_S3_ENDPOINT,
            forcePathStyle,
            credentials: {
                accessKeyId: normalizeString(args.secret.s3?.accessKeyId),
                secretAccessKey: normalizeString(args.secret.s3?.secretAccessKey),
            },
        });

        const metadata = await client.send(new HeadObjectCommand({
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

    const maybeFileId = normalizeString(args.providerResult?.fileId)
        || normalizeString(args.providerResult?.id);

    let fileId = maybeFileId;
    let mimeType = normalizeString(args.draftData.mimeType);
    let sizeBytes = toNumber(args.draftData.sizeBytes);

    if (!fileId) {
        const body = typeof args.providerResult?.responseBody === 'string'
            ? args.providerResult?.responseBody
            : '';

        if (body) {
            try {
                const parsed = JSON.parse(body);
                fileId = normalizeString(parsed.id);
                mimeType = normalizeString(parsed.mimeType) || mimeType;
                sizeBytes = toNumber(parsed.size) || sizeBytes;
            } catch {
                // no-op
            }
        }
    }

    if (!fileId) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'Google Drive upload finalize requires providerResult.fileId or providerResult.responseBody with id.',
        );
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
                folderId: normalizeString(driveFile.parents?.[0] || args.draftData.providerRef?.googleDrive?.folderId),
            },
        },
        sizeBytes: toNumber(driveFile.size) || sizeBytes,
        mimeType: normalizeString(driveFile.mimeType) || mimeType,
    };
};

const generateDownloadUrlFromRecord = async (tenantId: string, secret: FileStorageSecret, record: TenantFileRecord) => {
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

        const client = new S3Client({
            region: s3Ref.region || DEFAULT_S3_REGION,
            endpoint: s3Ref.endpoint || DEFAULT_S3_ENDPOINT,
            forcePathStyle: Boolean(s3Ref.forcePathStyle),
            credentials: {
                accessKeyId: normalizeString(secret.s3?.accessKeyId),
                secretAccessKey: normalizeString(secret.s3?.secretAccessKey),
            },
        });

        const getCommand = new GetObjectCommand({
            Bucket: s3Ref.bucket,
            Key: s3Ref.key,
        });

        return getS3SignedUrl(client, getCommand, { expiresIn: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000) });
    }

    const driveRef = record.providerRef.googleDrive;
    if (!driveRef?.fileId) {
        throw new functions.https.HttpsError('failed-precondition', 'Google Drive file reference missing.');
    }

    const token = await getGoogleDriveAccessToken(tenantId, secret);
    return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveRef.fileId)}?alt=media&access_token=${encodeURIComponent(token)}`;
};

const deleteProviderObject = async (args: {
    tenantId: string;
    secret: FileStorageSecret;
    record: TenantFileRecord;
}) => {
    if (args.record.provider === 'firebase') {
        const objectPath = normalizeString(args.record.providerRef.firebasePath);
        if (objectPath) {
            await fileBucket().file(objectPath).delete({ ignoreNotFound: true });
        }
        return;
    }

    if (args.record.provider === 's3') {
        const s3Ref = args.record.providerRef.s3;
        if (!s3Ref) return;

        const client = new S3Client({
            region: s3Ref.region || DEFAULT_S3_REGION,
            endpoint: s3Ref.endpoint || DEFAULT_S3_ENDPOINT,
            forcePathStyle: Boolean(s3Ref.forcePathStyle),
            credentials: {
                accessKeyId: normalizeString(args.secret.s3?.accessKeyId),
                secretAccessKey: normalizeString(args.secret.s3?.secretAccessKey),
            },
        });

        await client.send(new DeleteObjectCommand({
            Bucket: s3Ref.bucket,
            Key: s3Ref.key,
        }));
        return;
    }

    const driveRef = args.record.providerRef.googleDrive;
    if (!driveRef?.fileId) return;

    await driveApiRequest({
        tenantId: args.tenantId,
        secret: args.secret,
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveRef.fileId)}`,
        method: 'DELETE',
    });
};

export const getWorkspaceFileStorageConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    await requireStorageConfigViewPermission(tenantId, context);

    const secret = await getSecretConfig(tenantId);
    return {
        config: sanitizeSecretForClient(secret),
    };
});

export const saveWorkspaceFileStorageConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const actorId = await requireStorageConfigManagePermission(tenantId, context);

    const activeProviderInput = normalizeString(data?.activeProvider);
    const activeProvider: StorageProvider = (
        activeProviderInput === 's3' || activeProviderInput === 'googleDrive' || activeProviderInput === 'firebase'
            ? activeProviderInput
            : 'firebase'
    );

    const existing = await getSecretConfig(tenantId);
    const nextS3 = normalizeS3Config(data?.s3Config, existing.s3);
    const nextGoogleDrive = normalizeGoogleDriveConfig(data?.googleDriveConfig, existing.googleDrive);

    await secretDocRef(tenantId).set({
        activeProvider,
        s3: {
            ...(existing.s3 || {}),
            ...nextS3,
        },
        googleDrive: {
            ...(existing.googleDrive || {}),
            ...nextGoogleDrive,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId,
    }, { merge: true });

    const updated = await getSecretConfig(tenantId);
    return {
        config: sanitizeSecretForClient(updated),
    };
});

export const testWorkspaceFileStorageConnection = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const actorId = await requireStorageConfigManagePermission(tenantId, context);

    const providerInput = normalizeString(data?.provider);
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
            message: `Connected to Firebase bucket ${metadata?.name || bucket.name}.`,
        };
    }

    if (providerInput === 's3') {
        const s3Config = normalizeS3Config(data?.s3Config, secret.s3);
        if (!isS3Ready(s3Config)) {
            throw new functions.https.HttpsError('failed-precondition', 'S3 configuration incomplete.');
        }

        const client = createS3Client(s3Config);
        await client.send(new HeadBucketCommand({
            Bucket: normalizeString(s3Config.bucket),
        }));

        await secretDocRef(tenantId).set({
            s3: {
                ...(secret.s3 || {}),
                ...s3Config,
                lastTestedAt: admin.firestore.FieldValue.serverTimestamp(),
                connectedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
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
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(normalizeString(secret.googleDrive?.folderId))}?fields=id,name,mimeType`,
    });

    await secretDocRef(tenantId).set({
        googleDrive: {
            ...(secret.googleDrive || {}),
            lastTestedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastError: admin.firestore.FieldValue.delete(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorId,
    }, { merge: true });

    return {
        ok: true,
        provider: 'googleDrive',
        message: `Connected to Google Drive folder ${normalizeString(driveFolder.name) || normalizeString(secret.googleDrive?.folderId)}.`,
    };
});

export const getGoogleDriveStorageAuthUrl = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
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

export const disconnectGoogleDriveStorage = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
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

export const createTenantFileUploadSession = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as Record<string, unknown>;
    const tenantId = normalizeString(payload.tenantId);
    const moduleName = normalizeString(payload.module) as UploadModule;
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

export const finalizeTenantFileUpload = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as Record<string, unknown>;
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
    const moduleName = normalizeString(draftData.module) as UploadModule;
    await requireUploadPermission(tenantId, context, moduleName);

    if (normalizeString(draftData.createdBy) && normalizeString(draftData.createdBy) !== actorId) {
        throw new functions.https.HttpsError('permission-denied', 'Only the uploader can finalize this draft.');
    }

    const expiresAtMillis = (draftData.expiresAt as admin.firestore.Timestamp | undefined)?.toMillis?.() || 0;
    if (expiresAtMillis && expiresAtMillis < Date.now()) {
        throw new functions.https.HttpsError('deadline-exceeded', 'Upload draft expired. Create a new upload session.');
    }

    const secret = await getSecretConfig(tenantId);
    const verification = await verifyUploadAndBuildProviderRef({
        tenantId,
        secret,
        draftData,
        providerResult: (payload.providerResult as Record<string, any>) || undefined,
    });

    const fileRef = filesCollectionRef(tenantId).doc();

    const fileRecord: TenantFileRecord = {
        tenantId,
        module: moduleName,
        entityType: normalizeString(draftData.entityType),
        entityId: normalizeString(draftData.entityId),
        projectId: normalizeString(draftData.projectId) || null,
        provider: normalizeString(draftData.resolvedProvider) as StorageProvider,
        requestedProvider: normalizeString(draftData.requestedProvider) as StorageProvider,
        fallbackToFirebase: normalizeString(draftData.resolvedProvider) !== normalizeString(draftData.requestedProvider),
        fileName: normalizeString(draftData.fileName),
        mimeType: verification.mimeType,
        sizeBytes: verification.sizeBytes,
        status: 'ready',
        providerRef: verification.providerRef,
        createdBy: actorId,
    };

    await fileRef.set({
        ...fileRecord,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await draftRef.delete();

    const persisted = (await fileRef.get()).data() as TenantFileRecord;
    const downloadUrl = await generateDownloadUrlFromRecord(tenantId, secret, persisted);

    return {
        file: {
            id: fileRef.id,
            ...persisted,
            downloadUrl,
        },
    };
});

export const listTenantFiles = functions.region(REGION).https.onCall(async (data, context) => {
    const payload = (data || {}) as Record<string, unknown>;
    const tenantId = normalizeString(payload.tenantId);
    const moduleName = normalizeString(payload.module) as UploadModule;
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
    } else {
        await requireTenantAccess(tenantId, context);
    }

    const snapshot = await filesCollectionRef(tenantId).limit(500).get();
    const secret = await getSecretConfig(tenantId);
    const filtered = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, row: docSnap.data() as TenantFileRecord }))
        .filter(({ row }) => row.status === 'ready')
        .filter(({ row }) => (!moduleName || row.module === moduleName))
        .filter(({ row }) => (!projectId || normalizeString(row.projectId) === projectId))
        .filter(({ row }) => (!entityType || row.entityType === entityType))
        .filter(({ row }) => (!entityId || row.entityId === entityId))
        .sort((a, b) => {
            const aMillis = (a.row.createdAt as admin.firestore.Timestamp | undefined)?.toMillis?.() || 0;
            const bMillis = (b.row.createdAt as admin.firestore.Timestamp | undefined)?.toMillis?.() || 0;
            return bMillis - aMillis;
        });

    const startIndex = cursor ? Math.max(0, filtered.findIndex((item) => item.id === cursor) + 1) : 0;
    const page = filtered.slice(startIndex, startIndex + limitValue);

    const files = await Promise.all(page.map(async ({ id, row }) => {
        const downloadUrl = await generateDownloadUrlFromRecord(tenantId, secret, row);
        return {
            id,
            ...row,
            downloadUrl,
        };
    }));

    const nextCursor = (startIndex + limitValue) < filtered.length
        ? page[page.length - 1]?.id || null
        : null;

    return { files, nextCursor };
});

export const getTenantFileDownloadUrl = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const fileId = normalizeString(data?.fileId);

    if (!tenantId || !fileId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and fileId are required.');
    }

    const fileSnap = await filesCollectionRef(tenantId).doc(fileId).get();
    if (!fileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'File not found.');
    }

    const record = fileSnap.data() as TenantFileRecord;
    await requireReadPermission(tenantId, context, record.module);

    const secret = await getSecretConfig(tenantId);
    const downloadUrl = await generateDownloadUrlFromRecord(tenantId, secret, record);

    return {
        fileId,
        downloadUrl,
        expiresInSeconds: Math.floor(STORAGE_SIGNED_URL_TTL_MS / 1000),
    };
});

export const deleteTenantFile = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const fileId = normalizeString(data?.fileId);

    if (!tenantId || !fileId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and fileId are required.');
    }

    const fileRef = filesCollectionRef(tenantId).doc(fileId);
    const fileSnap = await fileRef.get();
    if (!fileSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'File not found.');
    }

    const row = fileSnap.data() as TenantFileRecord;
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

export const googleDriveStorageCallback = functions.region(REGION).https.onRequest(async (req, res) => {
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
        const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
            tenantId?: string;
            stateId?: string;
            csrf?: string;
            userId?: string;
        };

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

        const expiresAtMillis = (authState.expiresAt as admin.firestore.Timestamp | undefined)?.toMillis?.() || 0;
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

        const tempSecret: FileStorageSecret = {
            ...existing,
            googleDrive: {
                ...(previousDrive || {}),
                connected: true,
                accessToken,
                refreshToken,
                tokenExpiryDate: expiryDate,
                scope,
            },
        };

        // Resolve user email.
        let email = normalizeString(previousDrive.email);
        try {
            const userInfo = await driveApiRequest({
                tenantId,
                secret: tempSecret,
                url: 'https://www.googleapis.com/oauth2/v2/userinfo?fields=email',
            });
            email = normalizeString(userInfo.email) || email;
        } catch (userinfoError) {
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
    } catch (callbackError: any) {
        console.error('googleDriveStorageCallback failed', callbackError);
        res.status(500).send(`Google Drive connection failed: ${callbackError?.message || 'unknown error'}`);
    }
});
