"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitProjectIntake = exports.getProjectIntakeForm = exports.saveProjectIntakeConfig = void 0;
const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions/v1");
const corsConfig_1 = require("./corsConfig");
const init_1 = require("./init");
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
const FIELD_TYPES = new Set(['shortText', 'longText', 'email', 'url', 'select']);
const FIELD_ROLES = new Set(['title', 'description', 'sourceUrl', 'general']);
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const toBoolean = (value) => value === true;
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const safePathSegment = (value) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
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
const defaultSubmitLabel = 'Submit';
const defaultSuccessMessage = 'Thank you. Your contribution was submitted successfully.';
const defaultTitle = 'Contribute to this project';
const defaultCategories = () => ([
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
        return { id: normalizeFieldId(optionRecord.id, fallback), label, value: rawValue };
    })
        .filter((option) => option.label && option.value);
};
const sanitizeFields = (value) => {
    const source = Array.isArray(value) ? value : [];
    const seenIds = new Set();
    return source
        .slice(0, MAX_FIELDS_PER_CATEGORY)
        .map((entry, index) => {
        const record = entry && typeof entry === 'object' ? entry : {};
        const role = normalizeFieldRole(record.role, 'general');
        const fallbackId = role !== 'general' ? safePathSegment(role) : `field-${index + 1}`;
        let id = normalizeFieldId(record.id, fallbackId);
        if (seenIds.has(id)) {
            id = `${id}-${index + 1}`;
        }
        seenIds.add(id);
        const type = normalizeFieldType(record.type, role === 'description' ? 'longText' : role === 'sourceUrl' ? 'url' : 'shortText');
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
        };
    })
        .filter((field) => field.label);
};
const sanitizeCategories = (value, currentValue) => {
    const source = Array.isArray(value) && value.length > 0
        ? value
        : (Array.isArray(currentValue) && currentValue.length > 0 ? currentValue : defaultCategories());
    const seenIds = new Set();
    const sanitized = source
        .slice(0, MAX_CATEGORIES)
        .map((entry, index) => {
        const record = entry && typeof entry === 'object' ? entry : {};
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
        };
    })
        .filter((category) => category.label);
    return sanitized.length > 0 ? sanitized : defaultCategories();
};
const getProjectId = () => process.env.GCLOUD_PROJECT || admin.app().options.projectId || 'projectflow-labestin';
const functionUrl = (name) => `https://${REGION}-${getProjectId()}.cloudfunctions.net/${name}`;
const requireAuth = (context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    return uid;
};
const getProjectRef = (tenantId, projectId) => init_1.db.collection('tenants').doc(tenantId).collection(PROJECTS).doc(projectId);
const getTaskCollectionRef = (tenantId, projectId) => getProjectRef(tenantId, projectId).collection(TASKS);
const getSubmissionCollectionRef = (tenantId, projectId) => getProjectRef(tenantId, projectId).collection(SUBMISSIONS);
const getActivityCollectionRef = (tenantId, projectId) => getProjectRef(tenantId, projectId).collection(ACTIVITIES);
const getPublicIntakeRef = (token) => init_1.db.collection(PUBLIC_PROJECT_INTAKE).doc(token);
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
    return { uid, projectSnap, projectData: projectData };
};
const buildIntakeSettings = (current, input, userId) => {
    const enabled = toBoolean(input.enabled);
    const token = toBoolean(input.regenerateToken) || !normalizeString(current === null || current === void 0 ? void 0 : current.token)
        ? crypto.randomBytes(20).toString('hex')
        : normalizeString(current === null || current === void 0 ? void 0 : current.token);
    return {
        enabled,
        token,
        title: normalizeString(input.title) || normalizeString(current === null || current === void 0 ? void 0 : current.title) || defaultTitle,
        description: normalizeString(input.description) || normalizeString(current === null || current === void 0 ? void 0 : current.description) || '',
        submitLabel: normalizeString(input.submitLabel) || normalizeString(current === null || current === void 0 ? void 0 : current.submitLabel) || defaultSubmitLabel,
        successMessage: normalizeString(input.successMessage) || normalizeString(current === null || current === void 0 ? void 0 : current.successMessage) || defaultSuccessMessage,
        allowAttachments: input.allowAttachments == null ? ((current === null || current === void 0 ? void 0 : current.allowAttachments) !== false) : toBoolean(input.allowAttachments),
        maxAttachments: Math.min(MAX_ATTACHMENTS, Math.max(1, toNumber(input.maxAttachments, toNumber(current === null || current === void 0 ? void 0 : current.maxAttachments, 4)))),
        autoCreateTask: input.autoCreateTask == null ? toBoolean(current === null || current === void 0 ? void 0 : current.autoCreateTask) : toBoolean(input.autoCreateTask),
        categories: sanitizeCategories(input.categories, current === null || current === void 0 ? void 0 : current.categories),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: userId,
    };
};
const toPublicIndexPayload = (tenantId, projectId, projectData, intakeForm) => ({
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
const writeActivity = async (tenantId, projectId, target, action) => {
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
const decodeAttachment = (attachment) => {
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
const uploadAttachment = async (tenantId, projectId, submissionId, attachment) => {
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
const extractFieldValues = (fields, fieldValuesInput) => {
    const fieldValuesRecord = fieldValuesInput && typeof fieldValuesInput === 'object'
        ? fieldValuesInput
        : {};
    const submittedFields = [];
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
            }
            catch (_a) {
                throw new Error(`"${field.label}" must be a valid URL.`);
            }
        }
        if (field.type === 'select' && value) {
            const options = Array.isArray(field.options) ? field.options : [];
            if (!options.some((option) => option.value === value)) {
                throw new Error(`"${field.label}" must use one of the configured options.`);
            }
        }
        if (!value)
            continue;
        submittedFields.push({ fieldId: field.id, label: field.label, value, type: field.type, role: field.role });
    }
    return submittedFields;
};
const buildTaskDescription = (input) => {
    const lines = [];
    if (input.description)
        lines.push(input.description);
    const meta = [];
    if (input.categoryLabel)
        meta.push(`Type: ${input.categoryLabel}`);
    if (input.customerName)
        meta.push(`Name: ${input.customerName}`);
    if (input.customerEmail)
        meta.push(`Email: ${input.customerEmail}`);
    if (input.company)
        meta.push(`Company: ${input.company}`);
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
exports.saveProjectIntakeConfig = functions.region(REGION).https.onCall(async (data, context) => {
    const tenantId = normalizeString(data === null || data === void 0 ? void 0 : data.tenantId);
    const projectId = normalizeString(data === null || data === void 0 ? void 0 : data.projectId);
    if (!tenantId || !projectId) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and projectId are required.');
    }
    const { uid, projectData } = await requireProjectAccess(tenantId, projectId, context);
    const projectRef = getProjectRef(tenantId, projectId);
    const currentIntakeForm = (projectData.intakeForm || {});
    const oldToken = normalizeString(currentIntakeForm.token);
    const nextIntakeForm = buildIntakeSettings(currentIntakeForm, data || {}, uid);
    await projectRef.set({ intakeForm: nextIntakeForm, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    if (oldToken && oldToken !== nextIntakeForm.token) {
        await getPublicIntakeRef(oldToken).delete().catch(() => undefined);
    }
    if (nextIntakeForm.enabled) {
        await getPublicIntakeRef(nextIntakeForm.token).set(toPublicIndexPayload(tenantId, projectId, projectData, nextIntakeForm), { merge: true });
    }
    else if (oldToken || nextIntakeForm.token) {
        await getPublicIntakeRef(nextIntakeForm.token).delete().catch(() => undefined);
    }
    await writeActivity(tenantId, projectId, 'Intake', `${nextIntakeForm.enabled ? 'Enabled' : 'Disabled'} the public intake form for "${normalizeString(projectData.title) || projectId}"`);
    return {
        success: true,
        intakeForm: Object.assign(Object.assign({}, nextIntakeForm), { updatedAt: new Date().toISOString() }),
        submitEndpoint: functionUrl('submitProjectIntake'),
        publicConfigEndpoint: functionUrl('getProjectIntakeForm'),
    };
});
exports.getProjectIntakeForm = functions.region(REGION).https.onRequest((req, res) => {
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
exports.submitProjectIntake = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
            const categoryId = normalizeString((_b = req.body) === null || _b === void 0 ? void 0 : _b.categoryId);
            const customerName = normalizeString((_c = req.body) === null || _c === void 0 ? void 0 : _c.customerName);
            const customerEmail = normalizeString((_d = req.body) === null || _d === void 0 ? void 0 : _d.customerEmail);
            const company = normalizeString((_e = req.body) === null || _e === void 0 ? void 0 : _e.company);
            const fieldValues = (_f = req.body) === null || _f === void 0 ? void 0 : _f.fieldValues;
            const honeypot = normalizeString((_g = req.body) === null || _g === void 0 ? void 0 : _g.website);
            const attachmentEntries = Array.isArray((_h = req.body) === null || _h === void 0 ? void 0 : _h.attachments) ? req.body.attachments : [];
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
            const intakeData = (intakeSnap.data() || {});
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
            const projectData = (projectSnap.data() || {});
            const intakeForm = (projectData.intakeForm || {});
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
            const decodedAttachments = attachmentEntries.map((entry) => decodeAttachment(entry));
            const totalAttachmentBytes = decodedAttachments.reduce((sum, entry) => sum + entry.sizeBytes, 0);
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
            const roleValue = (role) => { var _a; return ((_a = submittedFields.find((field) => field.role === role)) === null || _a === void 0 ? void 0 : _a.value) || ''; };
            const resolvedTitle = roleValue('title')
                || ((_j = submittedFields.find((field) => field.role === 'general')) === null || _j === void 0 ? void 0 : _j.value)
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
            await writeActivity(tenantId, projectId, 'Intake', `Received a "${category.label}" submission for "${normalizeString(projectData.title) || projectId}"`);
            res.status(200).json({
                success: true,
                submissionId,
                taskId: linkedTaskId || undefined,
                message: normalizeString(intakeForm.successMessage) || defaultSuccessMessage,
            });
        }
        catch (error) {
            console.error('submitProjectIntake failed', error);
            res.status(500).json({ success: false, error: (error === null || error === void 0 ? void 0 : error.message) || 'Failed to submit.' });
        }
    });
});
//# sourceMappingURL=project-intake.js.map