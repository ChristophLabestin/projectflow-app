import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions/v1';

import { corsMiddleware } from './corsConfig';
import { db } from './init';

const REGION = 'europe-west3';
const PROJECTS = 'projects';
const TASKS = 'tasks';
const SUBMISSIONS = 'submissions';
const ACTIVITIES = 'activities';
const PUBLIC_PROJECT_INTAKE = 'public_project_intake';
const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_FIELDS_PER_CATEGORY = 12;
const MAX_CATEGORIES = 8;
const MAX_FIELD_OPTIONS = 8;

type IntakeFieldType = 'shortText' | 'longText' | 'email' | 'url' | 'select';
type IntakeFieldRole = 'title' | 'description' | 'sourceUrl' | 'general';

type IntakeFieldOption = { id: string; label: string; value: string };

type IntakeField = {
    id: string;
    type: IntakeFieldType;
    role?: IntakeFieldRole;
    label: string;
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    enabled?: boolean;
    width?: 'full' | 'half';
    options?: IntakeFieldOption[];
    isDefault?: boolean;
};

type IntakeCategory = {
    id: string;
    label: string;
    icon?: string;
    description?: string;
    enabled?: boolean;
    fields: IntakeField[];
};

type SubmittedField = {
    fieldId: string;
    label: string;
    value: string;
    type: IntakeFieldType;
    role?: IntakeFieldRole;
};

const FIELD_TYPES = new Set<IntakeFieldType>(['shortText', 'longText', 'email', 'url', 'select']);
const FIELD_ROLES = new Set<IntakeFieldRole>(['title', 'description', 'sourceUrl', 'general']);

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const toBoolean = (value: unknown) => value === true;
const toNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const safePathSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const normalizeFieldId = (value: unknown, fallback: string) => {
    const normalized = normalizeString(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || fallback;
};
const normalizeFieldType = (value: unknown, fallback: IntakeFieldType = 'shortText'): IntakeFieldType => {
    const normalized = normalizeString(value) as IntakeFieldType;
    return FIELD_TYPES.has(normalized) ? normalized : fallback;
};
const normalizeFieldRole = (value: unknown, fallback: IntakeFieldRole = 'general'): IntakeFieldRole => {
    const normalized = normalizeString(value) as IntakeFieldRole;
    return FIELD_ROLES.has(normalized) ? normalized : fallback;
};

const defaultSubmitLabel = 'Submit';
const defaultSuccessMessage = 'Thank you. Your contribution was submitted successfully.';
const defaultTitle = 'Contribute to this project';

const defaultCategories = (): IntakeCategory[] => ([
    {
        id: 'requirement',
        label: 'Requirement',
        icon: 'assignment',
        description: 'Request a feature, change, or deliverable.',
        enabled: true,
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', label: 'What do you need?', required: true, width: 'full', enabled: true, isDefault: true },
            { id: 'details', role: 'description', type: 'longText', label: 'Describe the requirement', required: true, width: 'full', enabled: true, isDefault: true },
            {
                id: 'priority', role: 'general', type: 'select', label: 'How urgent is it?', width: 'half', enabled: true, isDefault: true,
                options: [
                    { id: 'low', label: 'Nice to have', value: 'Nice to have' },
                    { id: 'normal', label: 'Normal', value: 'Normal' },
                    { id: 'high', label: 'Important', value: 'Important' },
                    { id: 'urgent', label: 'Urgent', value: 'Urgent' },
                ],
            },
        ],
    },
    {
        id: 'feedback',
        label: 'Feedback',
        icon: 'reviews',
        description: 'Share an impression, praise, or a problem.',
        enabled: true,
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', label: 'Short summary', required: true, width: 'full', enabled: true, isDefault: true },
            { id: 'details', role: 'description', type: 'longText', label: 'What would you like to share?', required: true, width: 'full', enabled: true, isDefault: true },
            {
                id: 'sentiment', role: 'general', type: 'select', label: 'How do you feel about it?', width: 'half', enabled: true, isDefault: true,
                options: [
                    { id: 'positive', label: 'Positive', value: 'Positive' },
                    { id: 'neutral', label: 'Neutral', value: 'Neutral' },
                    { id: 'negative', label: 'Negative', value: 'Negative' },
                ],
            },
        ],
    },
    {
        id: 'material',
        label: 'Material / Document',
        icon: 'attach_file',
        description: 'Provide assets, files, or reference links.',
        enabled: true,
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', label: 'What are you sharing?', required: true, width: 'full', enabled: true, isDefault: true },
            { id: 'details', role: 'description', type: 'longText', label: 'Notes about this material', width: 'full', enabled: true, isDefault: true },
            { id: 'link', role: 'sourceUrl', type: 'url', label: 'Link (optional)', placeholder: 'https://…', width: 'full', enabled: true, isDefault: true },
        ],
    },
    {
        id: 'question',
        label: 'Question',
        icon: 'help',
        description: 'Ask something about the project.',
        enabled: true,
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', label: 'Your question', required: true, width: 'full', enabled: true, isDefault: true },
            { id: 'details', role: 'description', type: 'longText', label: 'Add context (optional)', width: 'full', enabled: true, isDefault: true },
        ],
    },
]);

const sanitizeFieldOptions = (value: unknown, fieldId: string): IntakeFieldOption[] => {
    if (!Array.isArray(value)) return [];
    return value
        .slice(0, MAX_FIELD_OPTIONS)
        .map((option, index) => {
            const optionRecord = option && typeof option === 'object' ? option as Record<string, unknown> : {};
            const fallback = `${fieldId}-option-${index + 1}`;
            const label = normalizeString(optionRecord.label) || normalizeString(optionRecord.value) || `Option ${index + 1}`;
            const rawValue = normalizeString(optionRecord.value) || label;
            return { id: normalizeFieldId(optionRecord.id, fallback), label, value: rawValue };
        })
        .filter((option) => option.label && option.value);
};

const sanitizeFields = (value: unknown): IntakeField[] => {
    const source = Array.isArray(value) ? value : [];
    const seenIds = new Set<string>();
    return source
        .slice(0, MAX_FIELDS_PER_CATEGORY)
        .map((entry, index) => {
            const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
            const role = normalizeFieldRole(record.role, 'general');
            const fallbackId = role !== 'general' ? safePathSegment(role) : `field-${index + 1}`;
            let id = normalizeFieldId(record.id, fallbackId);
            if (seenIds.has(id)) {
                id = `${id}-${index + 1}`;
            }
            seenIds.add(id);

            const type = normalizeFieldType(
                record.type,
                role === 'description' ? 'longText' : role === 'sourceUrl' ? 'url' : 'shortText',
            );
            const options = type === 'select' ? sanitizeFieldOptions(record.options, id) : [];
            const label = normalizeString(record.label) || `Field ${index + 1}`;

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
                isDefault: record.isDefault === true,
            } as IntakeField;
        })
        .filter((field) => field.label);
};

const sanitizeCategories = (value: unknown, currentValue?: unknown): IntakeCategory[] => {
    const source = Array.isArray(value) && value.length > 0
        ? value
        : (Array.isArray(currentValue) && currentValue.length > 0 ? currentValue : defaultCategories());
    const seenIds = new Set<string>();

    const sanitized = source
        .slice(0, MAX_CATEGORIES)
        .map((entry, index) => {
            const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
            let id = normalizeFieldId(record.id, `category-${index + 1}`);
            if (seenIds.has(id)) {
                id = `${id}-${index + 1}`;
            }
            seenIds.add(id);
            const fields = sanitizeFields(record.fields);
            return {
                id,
                label: normalizeString(record.label) || `Category ${index + 1}`,
                icon: normalizeString(record.icon) || 'category',
                description: normalizeString(record.description),
                enabled: record.enabled !== false,
                fields: fields.length > 0 ? fields : sanitizeFields(defaultCategories()[0].fields),
            } as IntakeCategory;
        })
        .filter((category) => category.label);

    return sanitized.length > 0 ? sanitized : defaultCategories();
};

const getProjectId = () => process.env.GCLOUD_PROJECT || admin.app().options.projectId || 'project-manager-9d0ad';
const functionUrl = (name: string) => `https://${REGION}-${getProjectId()}.cloudfunctions.net/${name}`;

const requireAuth = (context: functions.https.CallableContext) => {
    const uid = context.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};

const getProjectRef = (tenantId: string, projectId: string) =>
    db.collection('tenants').doc(tenantId).collection(PROJECTS).doc(projectId);

const getTaskCollectionRef = (tenantId: string, projectId: string) =>
    getProjectRef(tenantId, projectId).collection(TASKS);

const getSubmissionCollectionRef = (tenantId: string, projectId: string) =>
    getProjectRef(tenantId, projectId).collection(SUBMISSIONS);

const getActivityCollectionRef = (tenantId: string, projectId: string) =>
    getProjectRef(tenantId, projectId).collection(ACTIVITIES);

const getPublicIntakeRef = (token: string) =>
    db.collection(PUBLIC_PROJECT_INTAKE).doc(token);

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
    return { uid, projectSnap, projectData: projectData as Record<string, any> };
};

const buildIntakeSettings = (
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
        title: normalizeString(input.title) || normalizeString(current?.title) || defaultTitle,
        description: normalizeString(input.description) || normalizeString(current?.description) || '',
        submitLabel: normalizeString(input.submitLabel) || normalizeString(current?.submitLabel) || defaultSubmitLabel,
        successMessage: normalizeString(input.successMessage) || normalizeString(current?.successMessage) || defaultSuccessMessage,
        allowAttachments: input.allowAttachments == null ? (current?.allowAttachments !== false) : toBoolean(input.allowAttachments),
        maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(input.maxAttachments, toNumber(current?.maxAttachments, 4)))),
        autoCreateTask: input.autoCreateTask == null ? toBoolean(current?.autoCreateTask) : toBoolean(input.autoCreateTask),
        categories: sanitizeCategories(input.categories, current?.categories),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId,
    };
};

const toPublicIndexPayload = (
    tenantId: string,
    projectId: string,
    projectData: Record<string, any>,
    intakeForm: Record<string, any>,
) => ({
    tenantId,
    projectId,
    enabled: true,
    projectTitle: normalizeString(projectData.title),
    title: normalizeString(intakeForm.title) || defaultTitle,
    description: normalizeString(intakeForm.description),
    submitLabel: normalizeString(intakeForm.submitLabel) || defaultSubmitLabel,
    successMessage: normalizeString(intakeForm.successMessage) || defaultSuccessMessage,
    allowAttachments: intakeForm.allowAttachments !== false,
    maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(intakeForm.maxAttachments, 4))),
    categories: sanitizeCategories(intakeForm.categories),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

const writeActivity = async (
    tenantId: string,
    projectId: string,
    target: string,
    action: string,
) => {
    await getActivityCollectionRef(tenantId, projectId).add({
        tenantId,
        projectId,
        relatedId: projectId,
        target,
        action,
        type: 'project',
        user: 'ProjectFlow',
        ownerId: 'public-intake',
        actorType: 'system',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

const decodeAttachment = (attachment: Record<string, unknown>) => {
    const fileName = normalizeString(attachment.fileName) || 'attachment';
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

    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
        throw new Error(`Attachment ${fileName} is empty.`);
    }
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
        throw new Error(`Attachment ${fileName} exceeds the ${Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB limit.`);
    }

    return { fileName, mimeType, buffer, sizeBytes: buffer.length };
};

const uploadAttachment = async (
    tenantId: string,
    projectId: string,
    submissionId: string,
    attachment: { fileName: string; mimeType: string; buffer: Buffer; sizeBytes: number },
) => {
    const bucket = admin.storage().bucket();
    const objectPath = `project-intake/${tenantId}/${projectId}/${submissionId}/${safePathSegment(attachment.fileName)}`;
    const file = bucket.file(objectPath);

    await file.save(attachment.buffer, {
        resumable: false,
        metadata: {
            contentType: attachment.mimeType,
            cacheControl: 'private, max-age=31536000',
        },
    });

    const [downloadUrl] = await file.getSignedUrl({ action: 'read', expires: '2500-01-01' });

    return {
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        downloadUrl,
    };
};

const extractFieldValues = (fields: IntakeField[], fieldValuesInput: unknown): SubmittedField[] => {
    const fieldValuesRecord = fieldValuesInput && typeof fieldValuesInput === 'object'
        ? fieldValuesInput as Record<string, unknown>
        : {};
    const submittedFields: SubmittedField[] = [];

    for (const field of fields.filter((entry) => entry.enabled !== false)) {
        const value = normalizeString(fieldValuesRecord[field.id]);

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
            if (!options.some((option) => option.value === value)) {
                throw new Error(`"${field.label}" must use one of the configured options.`);
            }
        }
        if (!value) continue;

        submittedFields.push({ fieldId: field.id, label: field.label, value, type: field.type, role: field.role });
    }

    return submittedFields;
};

const buildTaskDescription = (input: {
    description: string;
    categoryLabel: string;
    customerName: string;
    customerEmail: string;
    company: string;
    fields: SubmittedField[];
    attachments: Array<{ fileName: string; downloadUrl: string }>;
}) => {
    const lines: string[] = [];
    if (input.description) lines.push(input.description);

    const meta: string[] = [];
    if (input.categoryLabel) meta.push(`Type: ${input.categoryLabel}`);
    if (input.customerName) meta.push(`Name: ${input.customerName}`);
    if (input.customerEmail) meta.push(`Email: ${input.customerEmail}`);
    if (input.company) meta.push(`Company: ${input.company}`);
    if (meta.length > 0) {
        lines.push('', 'Submission Details', ...meta.map((entry) => `- ${entry}`));
    }

    const extraFields = input.fields.filter((field) => field.role === 'general' || field.role === 'sourceUrl');
    if (extraFields.length > 0) {
        lines.push('', 'Responses', ...extraFields.map((field) => `- ${field.label}: ${field.value}`));
    }

    if (input.attachments.length > 0) {
        lines.push('', 'Attachments', ...input.attachments.map((attachment) => `- ${attachment.fileName}: ${attachment.downloadUrl}`));
    }

    return lines.join('\n').trim();
};

export const saveProjectIntakeConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data?.tenantId);
    const projectId = normalizeString(data?.projectId);

    if (!tenantId || !projectId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and projectId are required.');
    }

    const { uid, projectData } = await requireProjectAccess(tenantId, projectId, context);
    const projectRef = getProjectRef(tenantId, projectId);
    const currentIntakeForm = (projectData.intakeForm || {}) as Record<string, any>;
    const oldToken = normalizeString(currentIntakeForm.token);
    const nextIntakeForm = buildIntakeSettings(currentIntakeForm, data || {}, uid);

    await projectRef.set(
        { intakeForm: nextIntakeForm, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
    );

    if (oldToken && oldToken !== nextIntakeForm.token) {
        await getPublicIntakeRef(oldToken).delete().catch(() => undefined);
    }

    if (nextIntakeForm.enabled) {
        await getPublicIntakeRef(nextIntakeForm.token).set(
            toPublicIndexPayload(tenantId, projectId, projectData, nextIntakeForm),
            { merge: true },
        );
    } else if (oldToken || nextIntakeForm.token) {
        await getPublicIntakeRef(nextIntakeForm.token).delete().catch(() => undefined);
    }

    await writeActivity(
        tenantId,
        projectId,
        'Intake',
        `${nextIntakeForm.enabled ? 'Enabled' : 'Disabled'} the public intake form for "${normalizeString(projectData.title) || projectId}"`,
    );

    return {
        success: true,
        intakeForm: { ...nextIntakeForm, updatedAt: new Date().toISOString() },
        submitEndpoint: functionUrl('submitProjectIntake'),
        publicConfigEndpoint: functionUrl('getProjectIntakeForm'),
    };
});

export const getProjectIntakeForm = functions.region(REGION).https.onRequest((req, res) => {
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

        const intakeSnap = await getPublicIntakeRef(token).get();
        if (!intakeSnap.exists) {
            res.status(404).json({ success: false, error: 'Intake form not found.' });
            return;
        }

        const intakeData = intakeSnap.data() || {};
        if (intakeData.enabled === false) {
            res.status(404).json({ success: false, error: 'Intake form is disabled.' });
            return;
        }

        res.status(200).json({
            success: true,
            form: {
                token,
                projectTitle: normalizeString(intakeData.projectTitle),
                title: normalizeString(intakeData.title) || defaultTitle,
                description: normalizeString(intakeData.description),
                submitLabel: normalizeString(intakeData.submitLabel) || defaultSubmitLabel,
                successMessage: normalizeString(intakeData.successMessage) || defaultSuccessMessage,
                allowAttachments: intakeData.allowAttachments !== false,
                maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(intakeData.maxAttachments, 4))),
                categories: sanitizeCategories(intakeData.categories).filter((category) => category.enabled !== false),
                submitEndpoint: functionUrl('submitProjectIntake'),
            },
        });
    });
});

export const submitProjectIntake = functions.region(REGION).https.onRequest((req, res) => {
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
            const categoryId = normalizeString(req.body?.categoryId);
            const customerName = normalizeString(req.body?.customerName);
            const customerEmail = normalizeString(req.body?.customerEmail);
            const company = normalizeString(req.body?.company);
            const fieldValues = req.body?.fieldValues;
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

            const intakeSnap = await getPublicIntakeRef(token).get();
            if (!intakeSnap.exists) {
                res.status(404).json({ success: false, error: 'Intake form not found.' });
                return;
            }
            const intakeData = (intakeSnap.data() || {}) as Record<string, any>;
            if (intakeData.enabled === false) {
                res.status(404).json({ success: false, error: 'Intake form is disabled.' });
                return;
            }

            const tenantId = normalizeString(intakeData.tenantId);
            const projectId = normalizeString(intakeData.projectId);
            const projectSnap = await getProjectRef(tenantId, projectId).get();
            if (!projectSnap.exists) {
                res.status(404).json({ success: false, error: 'Project is no longer available.' });
                return;
            }
            const projectData = (projectSnap.data() || {}) as Record<string, any>;
            const intakeForm = (projectData.intakeForm || {}) as Record<string, any>;
            const allowAttachments = intakeForm.allowAttachments !== false;
            const maxAttachments = Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(intakeForm.maxAttachments, 4)));
            const autoCreateTask = toBoolean(intakeForm.autoCreateTask);

            const categories = sanitizeCategories(intakeForm.categories);
            const category = categories.find((entry) => entry.id === categoryId && entry.enabled !== false)
                || (categories.length === 1 ? categories[0] : undefined);
            if (!category) {
                res.status(400).json({ success: false, error: 'Please choose a valid category.' });
                return;
            }

            const submittedFields = extractFieldValues(category.fields, fieldValues);
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

            const decodedAttachments = attachmentEntries.map((entry: unknown) => decodeAttachment(entry as Record<string, unknown>));
            const totalAttachmentBytes = decodedAttachments.reduce((sum: number, entry: ReturnType<typeof decodeAttachment>) => sum + entry.sizeBytes, 0);
            if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
                res.status(400).json({ success: false, error: 'Attachments are too large.' });
                return;
            }

            const submissionRef = getSubmissionCollectionRef(tenantId, projectId).doc();
            const submissionId = submissionRef.id;

            const uploadedAttachments = [];
            for (const attachment of decodedAttachments) {
                uploadedAttachments.push(await uploadAttachment(tenantId, projectId, submissionId, attachment));
            }

            const roleValue = (role: IntakeFieldRole) => submittedFields.find((field) => field.role === role)?.value || '';
            const resolvedTitle = roleValue('title')
                || submittedFields.find((field) => field.role === 'general')?.value
                || `${category.label} submission`;
            const resolvedDescription = roleValue('description');

            let linkedTaskId = '';
            if (autoCreateTask) {
                const ownerId = normalizeString(projectData.ownerId) || tenantId;
                const taskDescription = buildTaskDescription({
                    description: resolvedDescription,
                    categoryLabel: category.label,
                    customerName,
                    customerEmail,
                    company,
                    fields: submittedFields,
                    attachments: uploadedAttachments.map((attachment) => ({ fileName: attachment.fileName, downloadUrl: attachment.downloadUrl })),
                });
                const taskRef = getTaskCollectionRef(tenantId, projectId).doc();
                linkedTaskId = taskRef.id;
                await taskRef.set({
                    projectId,
                    tenantId,
                    ownerId,
                    createdBy: ownerId,
                    title: `${category.label}: ${resolvedTitle}`.slice(0, 160),
                    description: taskDescription,
                    isCompleted: false,
                    dueDate: '',
                    startDate: '',
                    priority: 'Medium',
                    category: ['External Intake'],
                    status: 'Open',
                    source: 'project-intake',
                    submissionId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            await submissionRef.set({
                projectId,
                tenantId,
                categoryId: category.id,
                categoryLabel: category.label,
                status: 'new',
                title: resolvedTitle.slice(0, 200),
                description: resolvedDescription,
                submitter: { name: customerName, email: customerEmail, company },
                fields: submittedFields,
                attachments: uploadedAttachments,
                linkedTaskId,
                source: 'public-form',
                submittedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            await writeActivity(
                tenantId,
                projectId,
                'Intake',
                `Received a "${category.label}" submission for "${normalizeString(projectData.title) || projectId}"`,
            );

            res.status(200).json({
                success: true,
                submissionId,
                taskId: linkedTaskId || undefined,
                message: normalizeString(intakeForm.successMessage) || defaultSuccessMessage,
            });
        } catch (error: any) {
            console.error('submitProjectIntake failed', error);
            res.status(500).json({ success: false, error: error?.message || 'Failed to submit.' });
        }
    });
});
