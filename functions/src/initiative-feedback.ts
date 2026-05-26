import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions/v1';

import { corsMiddleware } from './corsConfig';
import { db } from './init';

const REGION = 'europe-west3';
const PROJECTS = 'projects';
const INITIATIVES = 'initiatives';
const TASKS = 'tasks';
const ACTIVITIES = 'activities';
const PUBLIC_INITIATIVE_FEEDBACK = 'public_initiative_feedback';
const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_FEEDBACK_FIELDS = 12;
const MAX_FIELD_OPTIONS = 8;

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toBoolean = (value: unknown) => value === true;
const toNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeFieldId = (value: unknown, fallback: string) => {
    const normalized = normalizeString(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || fallback;
};
const normalizeFieldType = (value: unknown, fallback: FeedbackFieldType = 'shortText'): FeedbackFieldType => {
    const normalized = normalizeString(value) as FeedbackFieldType;
    return FIELD_TYPES.has(normalized) ? normalized : fallback;
};
const normalizeFieldRole = (value: unknown, fallback: FeedbackFieldRole = 'general'): FeedbackFieldRole => {
    const normalized = normalizeString(value) as FeedbackFieldRole;
    return FIELD_ROLES.has(normalized) ? normalized : fallback;
};

const defaultFeedbackFields = (): FeedbackField[] => ([
    {
        id: 'customer-name',
        role: 'customerName',
        type: 'shortText',
        label: 'Your name',
        placeholder: 'Jane Doe',
        width: 'half',
        enabled: true,
        isDefault: true,
    },
    {
        id: 'customer-email',
        role: 'customerEmail',
        type: 'email',
        label: 'Email address',
        placeholder: 'jane@company.com',
        width: 'half',
        enabled: true,
        isDefault: true,
    },
    {
        id: 'company',
        role: 'company',
        type: 'shortText',
        label: 'Company or team',
        placeholder: 'Acme Inc.',
        width: 'half',
        enabled: true,
        isDefault: true,
    },
    {
        id: 'source-url',
        role: 'sourceUrl',
        type: 'url',
        label: 'Page or screen URL',
        placeholder: 'https://app.example.com/settings',
        width: 'half',
        enabled: true,
        isDefault: true,
    },
    {
        id: 'summary',
        role: 'title',
        type: 'shortText',
        label: 'Short summary',
        placeholder: 'What needs attention?',
        required: true,
        width: 'full',
        enabled: true,
        isDefault: true,
    },
    {
        id: 'details',
        role: 'description',
        type: 'longText',
        label: 'What happened, what is missing, or what should change?',
        placeholder: 'Describe the feedback in more detail.',
        required: true,
        width: 'full',
        enabled: true,
        isDefault: true,
    },
]);

const sanitizeFieldOptions = (value: unknown, fieldId: string): FeedbackFieldOption[] => {
    if (!Array.isArray(value)) return [];
    return value
        .slice(0, MAX_FIELD_OPTIONS)
        .map((option, index) => {
            const optionRecord = option && typeof option === 'object' ? option as Record<string, unknown> : {};
            const fallback = `${fieldId}-option-${index + 1}`;
            const label = normalizeString(optionRecord.label) || normalizeString(optionRecord.value) || `Option ${index + 1}`;
            const rawValue = normalizeString(optionRecord.value) || label;
            return {
                id: normalizeFieldId(optionRecord.id, fallback),
                label,
                value: rawValue,
            };
        })
        .filter((option) => option.label && option.value);
};

const sanitizeFeedbackFields = (value: unknown, currentValue?: unknown): FeedbackField[] => {
    const source = Array.isArray(value)
        ? value
        : (Array.isArray(currentValue) && currentValue.length > 0 ? currentValue : defaultFeedbackFields());
    const seenIds = new Set<string>();

    return source
        .slice(0, MAX_FEEDBACK_FIELDS)
        .map((entry, index) => {
            const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
            const role = normalizeFieldRole(record.role, 'general');
            const fallbackId = role !== 'general' ? safePathSegment(role) : `custom-field-${index + 1}`;
            let id = normalizeFieldId(record.id, fallbackId);
            if (seenIds.has(id)) {
                id = `${id}-${index + 1}`;
            }
            seenIds.add(id);

            const type = normalizeFieldType(
                record.type,
                role === 'description' ? 'longText' : role === 'customerEmail' ? 'email' : role === 'sourceUrl' ? 'url' : 'shortText',
            );
            const options = type === 'select' ? sanitizeFieldOptions(record.options, id) : [];
            const label = normalizeString(record.label)
                || (role === 'title'
                    ? 'Short summary'
                    : role === 'description'
                        ? 'Details'
                        : role === 'customerName'
                            ? 'Your name'
                            : role === 'customerEmail'
                                ? 'Email address'
                                : role === 'company'
                                    ? 'Company or team'
                                    : role === 'sourceUrl'
                                        ? 'Page or screen URL'
                                        : `Field ${index + 1}`);

            return {
                id,
                type,
                role,
                label,
                placeholder: normalizeString(record.placeholder),
                helpText: normalizeString(record.helpText),
                required: record.required === true,
                enabled: record.enabled !== false,
                width: normalizeString(record.width) === 'full' || type === 'longText' ? 'full' : 'half',
                options,
                isDefault: record.isDefault !== false && role !== 'general',
            } as FeedbackField;
        })
        .filter((field) => field.label);
};

const getProjectId = () => process.env.GCLOUD_PROJECT || admin.app().options.projectId || 'project-manager-9d0ad';
const functionUrl = (name: string) => `https://${REGION}-${getProjectId()}.cloudfunctions.net/${name}`;
const defaultSubmitLabel = 'Submit feedback';
const defaultSuccessMessage = 'Thanks. Your feedback was submitted successfully.';
const safePathSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

type FeedbackFieldType = 'shortText' | 'longText' | 'email' | 'url' | 'select';
type FeedbackFieldRole = 'title' | 'description' | 'customerName' | 'customerEmail' | 'company' | 'sourceUrl' | 'general';

type FeedbackFieldOption = {
    id: string;
    label: string;
    value: string;
};

type FeedbackField = {
    id: string;
    type: FeedbackFieldType;
    role?: FeedbackFieldRole;
    label: string;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    enabled?: boolean;
    width?: 'full' | 'half';
    options?: FeedbackFieldOption[];
    isDefault?: boolean;
};

type SubmittedField = {
    fieldId: string;
    label: string;
    value: string;
    type: FeedbackFieldType;
    role?: FeedbackFieldRole;
};

const FIELD_TYPES = new Set<FeedbackFieldType>(['shortText', 'longText', 'email', 'url', 'select']);
const FIELD_ROLES = new Set<FeedbackFieldRole>(['title', 'description', 'customerName', 'customerEmail', 'company', 'sourceUrl', 'general']);

const requireAuth = (context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};

const getProjectRef = (tenantId: string, projectId: string) =>
    db.collection('tenants').doc(tenantId).collection(PROJECTS).doc(projectId);

const getInitiativeRef = (tenantId: string, projectId: string, initiativeId: string) =>
    getProjectRef(tenantId, projectId).collection(INITIATIVES).doc(initiativeId);

const getTaskCollectionRef = (tenantId: string, projectId: string) =>
    getProjectRef(tenantId, projectId).collection(TASKS);

const getActivityCollectionRef = (tenantId: string, projectId: string) =>
    getProjectRef(tenantId, projectId).collection(ACTIVITIES);

const getPublicFeedbackRef = (token: string) =>
    db.collection(PUBLIC_INITIATIVE_FEEDBACK).doc(token);

const isProjectMember = (projectData: Record<string, any>, uid: string) => {
    if (projectData.ownerId === uid) return true;

    const members = Array.isArray(projectData.members) ? projectData.members : [];
    return members.some((entry) => {
        if (typeof entry === 'string') return entry === uid;
        if (entry && typeof entry === 'object') {
            return entry.userId === uid || entry.uid === uid;
        }
        return false;
    });
};

const requireProjectAccess = async (
    tenantId: string,
    projectId: string,
    context: functions.https.CallableContext,
) => {
    const uid = requireAuth(context);
    const projectSnap = await getProjectRef(tenantId, projectId).get();

    if (!projectSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Project not found.');
    }

    const projectData = projectSnap.data() || {};
    if (!isProjectMember(projectData as Record<string, any>, uid)) {
        throw new functions.https.HttpsError('permission-denied', 'Project access required.');
    }

    return {
        uid,
        projectSnap,
        projectData: projectData as Record<string, any>,
    };
};

const buildFeedbackSettings = (
    current: Record<string, any> | undefined,
    input: Record<string, unknown>,
    userId: string,
) => {
    const enabled = toBoolean(input.enabled);
    const token = toBoolean(input.regenerateToken) || !normalizeString(current?.token)
        ? crypto.randomBytes(20).toString('hex')
        : normalizeString(current?.token);

    return {
        enabled,
        token,
        title: normalizeString(input.title) || normalizeString(current?.title) || 'Share feedback',
        description: normalizeString(input.description) || normalizeString(current?.description) || '',
        submitLabel: normalizeString(input.submitLabel) || normalizeString(current?.submitLabel) || defaultSubmitLabel,
        successMessage: normalizeString(input.successMessage) || normalizeString(current?.successMessage) || defaultSuccessMessage,
        allowAttachments: input.allowAttachments == null ? (current?.allowAttachments !== false) : toBoolean(input.allowAttachments),
        maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(input.maxAttachments, toNumber(current?.maxAttachments, 3)))),
        fields: sanitizeFeedbackFields(input.fields, current?.fields),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId,
    };
};

const toPublicIndexPayload = (
    tenantId: string,
    projectId: string,
    initiativeId: string,
    projectData: Record<string, any>,
    initiativeData: Record<string, any>,
    feedbackForm: Record<string, any>,
) => ({
    tenantId,
    projectId,
    initiativeId,
    enabled: true,
    projectTitle: normalizeString(projectData.title),
    initiativeTitle: normalizeString(initiativeData.title),
    title: normalizeString(feedbackForm.title),
    description: normalizeString(feedbackForm.description),
    submitLabel: normalizeString(feedbackForm.submitLabel) || defaultSubmitLabel,
    successMessage: normalizeString(feedbackForm.successMessage) || defaultSuccessMessage,
    allowAttachments: feedbackForm.allowAttachments !== false,
    maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(feedbackForm.maxAttachments, 3))),
    fields: sanitizeFeedbackFields(feedbackForm.fields),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const writeActivity = async (
    tenantId: string,
    projectId: string,
    initiativeId: string,
    initiativeTitle: string,
    target: string,
    action: string,
) => {
    await getActivityCollectionRef(tenantId, projectId).add({
        tenantId,
        projectId,
        relatedId: initiativeId,
        target,
        action,
        type: 'initiative',
        user: 'ProjectFlow',
        ownerId: 'public-feedback',
        actorType: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

const syncProjectProgress = async (tenantId: string, projectId: string) => {
    const tasksSnapshot = await getTaskCollectionRef(tenantId, projectId).get();
    const totalTasks = tasksSnapshot.size;
    const completedTasks = tasksSnapshot.docs.filter((docSnap) => {
        const task = docSnap.data() as Record<string, unknown>;
        return task.isCompleted === true || task.status === 'Done';
    }).length;
    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    await getProjectRef(tenantId, projectId).set(
        { progress, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
    );
};

const decodeAttachment = (attachment: Record<string, unknown>) => {
    const fileName = normalizeString(attachment.fileName) || 'attachment.png';
    const dataUrl = normalizeString(attachment.dataUrl);
    const base64 = normalizeString(attachment.base64);
    let mimeType = normalizeString(attachment.mimeType) || 'application/octet-stream';
    let base64Payload = base64;

    if (dataUrl) {
        const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            throw new Error(`Invalid attachment payload for ${fileName}.`);
        }
        mimeType = match[1];
        base64Payload = match[2];
    }

    if (!mimeType.startsWith('image/')) {
        throw new Error(`Only images are allowed for ${fileName}.`);
    }

    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
        throw new Error(`Attachment ${fileName} is empty.`);
    }

    if (buffer.length > MAX_ATTACHMENT_BYTES) {
        throw new Error(`Attachment ${fileName} exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB limit.`);
    }

    return {
        fileName,
        mimeType,
        buffer,
        sizeBytes: buffer.length,
    };
};

const uploadAttachment = async (
    tenantId: string,
    initiativeId: string,
    submissionId: string,
    attachment: { fileName: string; mimeType: string; buffer: Buffer; sizeBytes: number },
) => {
    const bucket = admin.storage().bucket();
    const objectPath = `initiative-feedback/${tenantId}/${initiativeId}/${submissionId}/${safePathSegment(attachment.fileName)}`;
    const file = bucket.file(objectPath);

    await file.save(attachment.buffer, {
        resumable: false,
        metadata: {
            contentType: attachment.mimeType,
            cacheControl: 'private, max-age=31536000',
        },
    });

    const [downloadUrl] = await file.getSignedUrl({
        action: 'read',
        expires: '2500-01-01',
    });

    return {
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        downloadUrl,
    };
};

const extractFieldValues = (
    fields: FeedbackField[],
    fieldValuesInput: unknown,
    legacyValues: Record<string, string>,
) => {
    const fieldValuesRecord = fieldValuesInput && typeof fieldValuesInput === 'object'
        ? fieldValuesInput as Record<string, unknown>
        : {};

    const submittedFields: SubmittedField[] = [];

    for (const field of fields.filter((entry) => entry.enabled !== false)) {
        let value = normalizeString(fieldValuesRecord[field.id]);
        if (!value) {
            switch (field.role) {
                case 'title':
                    value = legacyValues.title;
                    break;
                case 'description':
                    value = legacyValues.description;
                    break;
                case 'customerName':
                    value = legacyValues.customerName;
                    break;
                case 'customerEmail':
                    value = legacyValues.customerEmail;
                    break;
                case 'company':
                    value = legacyValues.company;
                    break;
                case 'sourceUrl':
                    value = legacyValues.sourceUrl;
                    break;
                default:
                    break;
            }
        }

        if (field.required && !value) {
            throw new Error(`"${field.label}" is required.`);
        }

        if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            throw new Error(`"${field.label}" must be a valid email address.`);
        }

        if (field.type === 'url' && value) {
            try {
                new URL(value);
            } catch {
                throw new Error(`"${field.label}" must be a valid URL.`);
            }
        }

        if (field.type === 'select' && value) {
            const options = Array.isArray(field.options) ? field.options : [];
            const isValid = options.some((option) => option.value === value);
            if (!isValid) {
                throw new Error(`"${field.label}" must use one of the configured options.`);
            }
        }

        if (!value) continue;

        submittedFields.push({
            fieldId: field.id,
            label: field.label,
            value,
            type: field.type,
            role: field.role,
        });
    }

    return submittedFields;
};

const buildTaskDescription = (input: {
    title: string;
    description: string;
    customerName: string;
    customerEmail: string;
    company: string;
    sourceUrl: string;
    fields: SubmittedField[];
    attachments: Array<{ fileName: string; downloadUrl: string }>;
}) => {
    const lines: string[] = [];

    if (input.description) {
        lines.push(input.description);
    }

    const meta: string[] = [];
    if (input.customerName) meta.push(`Name: ${input.customerName}`);
    if (input.customerEmail) meta.push(`Email: ${input.customerEmail}`);
    if (input.company) meta.push(`Company: ${input.company}`);
    if (input.sourceUrl) meta.push(`Source: ${input.sourceUrl}`);

    if (meta.length > 0) {
        lines.push('', 'Submission Details', ...meta.map((entry) => `- ${entry}`));
    }

    const customFields = input.fields.filter((field) => field.role === 'general');
    if (customFields.length > 0) {
        lines.push('', 'Custom Responses', ...customFields.map((field) => `- ${field.label}: ${field.value}`));
    }

    if (input.attachments.length > 0) {
        lines.push('', 'Attachments', ...input.attachments.map((attachment) => `- ${attachment.fileName}: ${attachment.downloadUrl}`));
    }

    return lines.join('\n').trim();
};

export const saveInitiativeFeedbackConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const projectId = normalizeString(data?.projectId);
    const initiativeId = normalizeString(data?.initiativeId);

    if (!tenantId || !projectId || !initiativeId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId, projectId, and initiativeId are required.');
    }

    const { uid, projectData } = await requireProjectAccess(tenantId, projectId, context);
    const initiativeRef = getInitiativeRef(tenantId, projectId, initiativeId);
    const initiativeSnap = await initiativeRef.get();

    if (!initiativeSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Initiative not found.');
    }

    const initiativeData = (initiativeSnap.data() || {}) as Record<string, any>;
    const currentFeedbackForm = (initiativeData.feedbackForm || {}) as Record<string, any>;
    const oldToken = normalizeString(currentFeedbackForm.token);
    const nextFeedbackForm = buildFeedbackSettings(currentFeedbackForm, data || {}, uid);

    await initiativeRef.set(
        {
            feedbackForm: nextFeedbackForm,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
    );

    if (oldToken && oldToken !== nextFeedbackForm.token) {
        await getPublicFeedbackRef(oldToken).delete().catch(() => undefined);
    }

    if (nextFeedbackForm.enabled) {
        await getPublicFeedbackRef(nextFeedbackForm.token).set(
            toPublicIndexPayload(tenantId, projectId, initiativeId, projectData, initiativeData, nextFeedbackForm),
            { merge: true },
        );
    } else if (oldToken || nextFeedbackForm.token) {
        await getPublicFeedbackRef(nextFeedbackForm.token).delete().catch(() => undefined);
    }

    await writeActivity(
        tenantId,
        projectId,
        initiativeId,
        normalizeString(initiativeData.title),
        'Initiatives',
        `${nextFeedbackForm.enabled ? 'Enabled' : 'Disabled'} public feedback intake for "${normalizeString(initiativeData.title) || initiativeId}"`,
    );

    return {
        success: true,
        feedbackForm: {
            ...nextFeedbackForm,
            updatedAt: new Date().toISOString(),
        },
        submitEndpoint: functionUrl('submitInitiativeFeedback'),
        publicConfigEndpoint: functionUrl('getInitiativeFeedbackForm'),
    };
});

export const getInitiativeFeedbackForm = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'GET') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        const token = normalizeString(req.query?.token);
        if (!token) {
            res.status(400).json({ success: false, error: 'Missing token.' });
            return;
        }

        const feedbackSnap = await getPublicFeedbackRef(token).get();
        if (!feedbackSnap.exists) {
            res.status(404).json({ success: false, error: 'Feedback form not found.' });
            return;
        }

        const feedbackData = feedbackSnap.data() || {};
        if (feedbackData.enabled === false) {
            res.status(404).json({ success: false, error: 'Feedback form is disabled.' });
            return;
        }

        res.status(200).json({
            success: true,
            form: {
                token,
                projectTitle: normalizeString(feedbackData.projectTitle),
                initiativeTitle: normalizeString(feedbackData.initiativeTitle),
                title: normalizeString(feedbackData.title) || 'Share feedback',
                description: normalizeString(feedbackData.description),
                submitLabel: normalizeString(feedbackData.submitLabel) || defaultSubmitLabel,
                successMessage: normalizeString(feedbackData.successMessage) || defaultSuccessMessage,
                allowAttachments: feedbackData.allowAttachments !== false,
                maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(feedbackData.maxAttachments, 3))),
                fields: sanitizeFeedbackFields(feedbackData.fields),
                submitEndpoint: functionUrl('submitInitiativeFeedback'),
            },
        });
    });
});

export const submitInitiativeFeedback = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        try {
            const token = normalizeString(req.body?.token);
            const title = normalizeString(req.body?.title);
            const description = normalizeString(req.body?.description);
            const customerName = normalizeString(req.body?.customerName);
            const customerEmail = normalizeString(req.body?.customerEmail);
            const company = normalizeString(req.body?.company);
            const sourceUrl = normalizeString(req.body?.sourceUrl);
            const fieldValues = req.body?.fieldValues;
            const source = normalizeString(req.body?.source) === 'embedded-endpoint' ? 'embedded-endpoint' : 'public-form';
            const honeypot = normalizeString(req.body?.website);
            const attachmentEntries = Array.isArray(req.body?.attachments) ? req.body.attachments : [];

            if (honeypot) {
                res.status(200).json({ success: true });
                return;
            }

            if (!token) {
                res.status(400).json({ success: false, error: 'Missing token.' });
                return;
            }

            const feedbackSnap = await getPublicFeedbackRef(token).get();
            if (!feedbackSnap.exists) {
                res.status(404).json({ success: false, error: 'Feedback form not found.' });
                return;
            }

            const feedbackData = (feedbackSnap.data() || {}) as Record<string, any>;
            if (feedbackData.enabled === false) {
                res.status(404).json({ success: false, error: 'Feedback form is disabled.' });
                return;
            }

            const tenantId = normalizeString(feedbackData.tenantId);
            const projectId = normalizeString(feedbackData.projectId);
            const initiativeId = normalizeString(feedbackData.initiativeId);
            const initiativeSnap = await getInitiativeRef(tenantId, projectId, initiativeId).get();
            const projectSnap = await getProjectRef(tenantId, projectId).get();

            if (!initiativeSnap.exists || !projectSnap.exists) {
                res.status(404).json({ success: false, error: 'Initiative is no longer available.' });
                return;
            }

            const initiativeData = (initiativeSnap.data() || {}) as Record<string, any>;
            const projectData = (projectSnap.data() || {}) as Record<string, any>;
            const feedbackForm = (initiativeData.feedbackForm || {}) as Record<string, any>;
            const allowAttachments = feedbackForm.allowAttachments !== false;
            const maxAttachments = Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(feedbackForm.maxAttachments, 3)));
            const configuredFields = sanitizeFeedbackFields(feedbackForm.fields);
            const submittedFields = extractFieldValues(configuredFields, fieldValues, {
                title,
                description,
                customerName,
                customerEmail,
                company,
                sourceUrl,
            });

            if (submittedFields.length === 0) {
                res.status(400).json({ success: false, error: 'At least one response is required.' });
                return;
            }

            if (attachmentEntries.length > maxAttachments) {
                res.status(400).json({ success: false, error: `Only ${maxAttachments} attachment(s) are allowed.` });
                return;
            }

            if (attachmentEntries.length > 0 && !allowAttachments) {
                res.status(400).json({ success: false, error: 'Attachments are disabled for this form.' });
                return;
            }

            const decodedAttachments: Array<ReturnType<typeof decodeAttachment>> = attachmentEntries.map((entry: unknown) =>
                decodeAttachment(entry as Record<string, unknown>)
            );
            const totalAttachmentBytes = decodedAttachments.reduce((sum: number, entry: ReturnType<typeof decodeAttachment>) => sum + entry.sizeBytes, 0);
            if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
                res.status(400).json({ success: false, error: 'Attachments are too large.' });
                return;
            }

            const submissionId = db.collection(PUBLIC_INITIATIVE_FEEDBACK).doc().id;
            const uploadedAttachments = [];
            for (const attachment of decodedAttachments) {
                uploadedAttachments.push(await uploadAttachment(tenantId, initiativeId, submissionId, attachment));
            }

            const roleValue = (role: FeedbackFieldRole) =>
                submittedFields.find((field) => field.role === role)?.value || '';
            const resolvedTitle = roleValue('title') || title;
            const resolvedDescription = roleValue('description') || description;
            const resolvedCustomerName = roleValue('customerName') || customerName;
            const resolvedCustomerEmail = roleValue('customerEmail') || customerEmail;
            const resolvedCompany = roleValue('company') || company;
            const resolvedSourceUrl = roleValue('sourceUrl') || sourceUrl;
            const fallbackTitleSource = submittedFields.find((field) => field.role === 'general')?.value || resolvedDescription;
            const taskTitle = resolvedTitle
                || (resolvedCustomerName ? `Feedback from ${resolvedCustomerName}` : '')
                || (fallbackTitleSource ? fallbackTitleSource.slice(0, 80) : '')
                || 'Customer feedback';
            const taskDescription = buildTaskDescription({
                title: taskTitle,
                description: resolvedDescription,
                customerName: resolvedCustomerName,
                customerEmail: resolvedCustomerEmail,
                company: resolvedCompany,
                sourceUrl: resolvedSourceUrl,
                fields: submittedFields,
                attachments: uploadedAttachments.map((attachment) => ({
                    fileName: attachment.fileName,
                    downloadUrl: attachment.downloadUrl,
                })),
            });

            const ownerId = normalizeString(initiativeData.ownerId)
                || normalizeString(initiativeData.createdBy)
                || normalizeString(projectData.ownerId)
                || tenantId;

            const taskRef = getTaskCollectionRef(tenantId, projectId).doc();
            await taskRef.set({
                projectId,
                tenantId,
                ownerId,
                createdBy: ownerId,
                title: `Feedback: ${taskTitle}`.slice(0, 160),
                description: taskDescription,
                isCompleted: false,
                dueDate: '',
                startDate: '',
                priority: 'Medium',
                category: ['Customer Feedback'],
                status: 'Open',
                initiativeId,
                feedbackSubmission: {
                    source,
                    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                    customerName: resolvedCustomerName,
                    customerEmail: resolvedCustomerEmail,
                    company: resolvedCompany,
                    sourceUrl: resolvedSourceUrl,
                    attachments: uploadedAttachments,
                    fields: submittedFields,
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await writeActivity(
                tenantId,
                projectId,
                initiativeId,
                normalizeString(initiativeData.title),
                'Initiatives',
                `Received customer feedback for "${normalizeString(initiativeData.title) || initiativeId}"`,
            );

            await syncProjectProgress(tenantId, projectId);

            res.status(200).json({
                success: true,
                taskId: taskRef.id,
                message: normalizeString(feedbackForm.successMessage) || defaultSuccessMessage,
            });
        } catch (error: any) {
            console.error('submitInitiativeFeedback failed', error);
            res.status(500).json({
                success: false,
                error: error?.message || 'Failed to submit feedback.',
            });
        }
    });
});
