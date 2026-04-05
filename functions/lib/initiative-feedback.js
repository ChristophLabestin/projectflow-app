"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitInitiativeFeedback = exports.getInitiativeFeedbackForm = exports.saveInitiativeFeedbackConfig = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");
const corsConfig_1 = require("./corsConfig");
const init_1 = require("./init");
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
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const toBoolean = (value) => value === true;
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const normalizeFieldId = (value, fallback) => {
    const normalized = normalizeString(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || fallback;
};
const normalizeFieldType = (value, fallback = 'shortText') => {
    const normalized = normalizeString(value);
    return FIELD_TYPES.has(normalized) ? normalized : fallback;
};
const normalizeFieldRole = (value, fallback = 'general') => {
    const normalized = normalizeString(value);
    return FIELD_ROLES.has(normalized) ? normalized : fallback;
};
const defaultFeedbackFields = () => ([
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
const sanitizeFieldOptions = (value, fieldId) => {
    if (!Array.isArray(value))
        return [];
    return value
        .slice(0, MAX_FIELD_OPTIONS)
        .map((option, index) => {
        const optionRecord = option && typeof option === 'object' ? option : {};
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
const sanitizeFeedbackFields = (value, currentValue) => {
    const source = Array.isArray(value)
        ? value
        : (Array.isArray(currentValue) && currentValue.length > 0 ? currentValue : defaultFeedbackFields());
    const seenIds = new Set();
    return source
        .slice(0, MAX_FEEDBACK_FIELDS)
        .map((entry, index) => {
        const record = entry && typeof entry === 'object' ? entry : {};
        const role = normalizeFieldRole(record.role, 'general');
        const fallbackId = role !== 'general' ? safePathSegment(role) : `custom-field-${index + 1}`;
        let id = normalizeFieldId(record.id, fallbackId);
        if (seenIds.has(id)) {
            id = `${id}-${index + 1}`;
        }
        seenIds.add(id);
        const type = normalizeFieldType(record.type, role === 'description' ? 'longText' : role === 'customerEmail' ? 'email' : role === 'sourceUrl' ? 'url' : 'shortText');
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
        };
    })
        .filter((field) => field.label);
};
const getProjectId = () => process.env.GCLOUD_PROJECT || admin.app().options.projectId || 'project-manager-9d0ad';
const functionUrl = (name) => `https://${REGION}-${getProjectId()}.cloudfunctions.net/${name}`;
const defaultSubmitLabel = 'Submit feedback';
const defaultSuccessMessage = 'Thanks. Your feedback was submitted successfully.';
const safePathSegment = (value) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
const FIELD_TYPES = new Set(['shortText', 'longText', 'email', 'url', 'select']);
const FIELD_ROLES = new Set(['title', 'description', 'customerName', 'customerEmail', 'company', 'sourceUrl', 'general']);
const requireAuth = (context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};
const getProjectRef = (tenantId, projectId) => init_1.db.collection('tenants').doc(tenantId).collection(PROJECTS).doc(projectId);
const getInitiativeRef = (tenantId, projectId, initiativeId) => getProjectRef(tenantId, projectId).collection(INITIATIVES).doc(initiativeId);
const getTaskCollectionRef = (tenantId, projectId) => getProjectRef(tenantId, projectId).collection(TASKS);
const getActivityCollectionRef = (tenantId, projectId) => getProjectRef(tenantId, projectId).collection(ACTIVITIES);
const getPublicFeedbackRef = (token) => init_1.db.collection(PUBLIC_INITIATIVE_FEEDBACK).doc(token);
const isProjectMember = (projectData, uid) => {
    if (projectData.ownerId === uid)
        return true;
    const members = Array.isArray(projectData.members) ? projectData.members : [];
    return members.some((entry) => {
        if (typeof entry === 'string')
            return entry === uid;
        if (entry && typeof entry === 'object') {
            return entry.userId === uid || entry.uid === uid;
        }
        return false;
    });
};
const requireProjectAccess = async (tenantId, projectId, context) => {
    const uid = requireAuth(context);
    const projectSnap = await getProjectRef(tenantId, projectId).get();
    if (!projectSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Project not found.');
    }
    const projectData = projectSnap.data() || {};
    if (!isProjectMember(projectData, uid)) {
        throw new functions.https.HttpsError('permission-denied', 'Project access required.');
    }
    return {
        uid,
        projectSnap,
        projectData: projectData,
    };
};
const buildFeedbackSettings = (current, input, userId) => {
    const enabled = toBoolean(input.enabled);
    const token = toBoolean(input.regenerateToken) || !normalizeString(current === null || current === void 0 ? void 0 : current.token)
        ? crypto.randomBytes(20).toString('hex')
        : normalizeString(current === null || current === void 0 ? void 0 : current.token);
    return {
        enabled,
        token,
        title: normalizeString(input.title) || normalizeString(current === null || current === void 0 ? void 0 : current.title) || 'Share feedback',
        description: normalizeString(input.description) || normalizeString(current === null || current === void 0 ? void 0 : current.description) || '',
        submitLabel: normalizeString(input.submitLabel) || normalizeString(current === null || current === void 0 ? void 0 : current.submitLabel) || defaultSubmitLabel,
        successMessage: normalizeString(input.successMessage) || normalizeString(current === null || current === void 0 ? void 0 : current.successMessage) || defaultSuccessMessage,
        allowAttachments: input.allowAttachments == null ? ((current === null || current === void 0 ? void 0 : current.allowAttachments) !== false) : toBoolean(input.allowAttachments),
        maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(input.maxAttachments, toNumber(current === null || current === void 0 ? void 0 : current.maxAttachments, 3)))),
        fields: sanitizeFeedbackFields(input.fields, current === null || current === void 0 ? void 0 : current.fields),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId,
    };
};
const toPublicIndexPayload = (tenantId, projectId, initiativeId, projectData, initiativeData, feedbackForm) => ({
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
const writeActivity = async (tenantId, projectId, initiativeId, initiativeTitle, target, action) => {
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
const syncProjectProgress = async (tenantId, projectId) => {
    const tasksSnapshot = await getTaskCollectionRef(tenantId, projectId).get();
    const totalTasks = tasksSnapshot.size;
    const completedTasks = tasksSnapshot.docs.filter((docSnap) => {
        const task = docSnap.data();
        return task.isCompleted === true || task.status === 'Done';
    }).length;
    const progress = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
    await getProjectRef(tenantId, projectId).set({ progress, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
};
const decodeAttachment = (attachment) => {
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
const uploadAttachment = async (tenantId, initiativeId, submissionId, attachment) => {
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
const extractFieldValues = (fields, fieldValuesInput, legacyValues) => {
    const fieldValuesRecord = fieldValuesInput && typeof fieldValuesInput === 'object'
        ? fieldValuesInput
        : {};
    const submittedFields = [];
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
            }
            catch (_a) {
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
        if (!value)
            continue;
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
const buildTaskDescription = (input) => {
    const lines = [];
    if (input.description) {
        lines.push(input.description);
    }
    const meta = [];
    if (input.customerName)
        meta.push(`Name: ${input.customerName}`);
    if (input.customerEmail)
        meta.push(`Email: ${input.customerEmail}`);
    if (input.company)
        meta.push(`Company: ${input.company}`);
    if (input.sourceUrl)
        meta.push(`Source: ${input.sourceUrl}`);
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
exports.saveInitiativeFeedbackConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const projectId = normalizeString(data === null || data === void 0 ? void 0 : data.projectId);
    const initiativeId = normalizeString(data === null || data === void 0 ? void 0 : data.initiativeId);
    if (!tenantId || !projectId || !initiativeId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId, projectId, and initiativeId are required.');
    }
    const { uid, projectData } = await requireProjectAccess(tenantId, projectId, context);
    const initiativeRef = getInitiativeRef(tenantId, projectId, initiativeId);
    const initiativeSnap = await initiativeRef.get();
    if (!initiativeSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Initiative not found.');
    }
    const initiativeData = (initiativeSnap.data() || {});
    const currentFeedbackForm = (initiativeData.feedbackForm || {});
    const oldToken = normalizeString(currentFeedbackForm.token);
    const nextFeedbackForm = buildFeedbackSettings(currentFeedbackForm, data || {}, uid);
    await initiativeRef.set({
        feedbackForm: nextFeedbackForm,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    if (oldToken && oldToken !== nextFeedbackForm.token) {
        await getPublicFeedbackRef(oldToken).delete().catch(() => undefined);
    }
    if (nextFeedbackForm.enabled) {
        await getPublicFeedbackRef(nextFeedbackForm.token).set(toPublicIndexPayload(tenantId, projectId, initiativeId, projectData, initiativeData, nextFeedbackForm), { merge: true });
    }
    else if (oldToken || nextFeedbackForm.token) {
        await getPublicFeedbackRef(nextFeedbackForm.token).delete().catch(() => undefined);
    }
    await writeActivity(tenantId, projectId, initiativeId, normalizeString(initiativeData.title), 'Initiatives', `${nextFeedbackForm.enabled ? 'Enabled' : 'Disabled'} public feedback intake for "${normalizeString(initiativeData.title) || initiativeId}"`);
    return {
        success: true,
        feedbackForm: Object.assign(Object.assign({}, nextFeedbackForm), { updatedAt: new Date().toISOString() }),
        submitEndpoint: functionUrl('submitInitiativeFeedback'),
        publicConfigEndpoint: functionUrl('getInitiativeFeedbackForm'),
    };
});
exports.getInitiativeFeedbackForm = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        var _a;
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        if (req.method !== 'GET') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        const token = normalizeString((_a = req.query) === null || _a === void 0 ? void 0 : _a.token);
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
exports.submitInitiativeFeedback = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        try {
            const token = normalizeString((_a = req.body) === null || _a === void 0 ? void 0 : _a.token);
            const title = normalizeString((_b = req.body) === null || _b === void 0 ? void 0 : _b.title);
            const description = normalizeString((_c = req.body) === null || _c === void 0 ? void 0 : _c.description);
            const customerName = normalizeString((_d = req.body) === null || _d === void 0 ? void 0 : _d.customerName);
            const customerEmail = normalizeString((_e = req.body) === null || _e === void 0 ? void 0 : _e.customerEmail);
            const company = normalizeString((_f = req.body) === null || _f === void 0 ? void 0 : _f.company);
            const sourceUrl = normalizeString((_g = req.body) === null || _g === void 0 ? void 0 : _g.sourceUrl);
            const fieldValues = (_h = req.body) === null || _h === void 0 ? void 0 : _h.fieldValues;
            const source = normalizeString((_j = req.body) === null || _j === void 0 ? void 0 : _j.source) === 'embedded-endpoint' ? 'embedded-endpoint' : 'public-form';
            const honeypot = normalizeString((_k = req.body) === null || _k === void 0 ? void 0 : _k.website);
            const attachmentEntries = Array.isArray((_l = req.body) === null || _l === void 0 ? void 0 : _l.attachments) ? req.body.attachments : [];
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
            const feedbackData = (feedbackSnap.data() || {});
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
            const initiativeData = (initiativeSnap.data() || {});
            const projectData = (projectSnap.data() || {});
            const feedbackForm = (initiativeData.feedbackForm || {});
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
            const decodedAttachments = attachmentEntries.map((entry) => decodeAttachment(entry));
            const totalAttachmentBytes = decodedAttachments.reduce((sum, entry) => sum + entry.sizeBytes, 0);
            if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
                res.status(400).json({ success: false, error: 'Attachments are too large.' });
                return;
            }
            const submissionId = init_1.db.collection(PUBLIC_INITIATIVE_FEEDBACK).doc().id;
            const uploadedAttachments = [];
            for (const attachment of decodedAttachments) {
                uploadedAttachments.push(await uploadAttachment(tenantId, initiativeId, submissionId, attachment));
            }
            const roleValue = (role) => { var _a; return ((_a = submittedFields.find((field) => field.role === role)) === null || _a === void 0 ? void 0 : _a.value) || ''; };
            const resolvedTitle = roleValue('title') || title;
            const resolvedDescription = roleValue('description') || description;
            const resolvedCustomerName = roleValue('customerName') || customerName;
            const resolvedCustomerEmail = roleValue('customerEmail') || customerEmail;
            const resolvedCompany = roleValue('company') || company;
            const resolvedSourceUrl = roleValue('sourceUrl') || sourceUrl;
            const fallbackTitleSource = ((_m = submittedFields.find((field) => field.role === 'general')) === null || _m === void 0 ? void 0 : _m.value) || resolvedDescription;
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
            await writeActivity(tenantId, projectId, initiativeId, normalizeString(initiativeData.title), 'Initiatives', `Received customer feedback for "${normalizeString(initiativeData.title) || initiativeId}"`);
            await syncProjectProgress(tenantId, projectId);
            res.status(200).json({
                success: true,
                taskId: taskRef.id,
                message: normalizeString(feedbackForm.successMessage) || defaultSuccessMessage,
            });
        }
        catch (error) {
            console.error('submitInitiativeFeedback failed', error);
            res.status(500).json({
                success: false,
                error: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to submit feedback.',
            });
        }
    });
});
//# sourceMappingURL=initiative-feedback.js.map