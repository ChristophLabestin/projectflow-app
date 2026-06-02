import type {
    InitiativeFeedbackField,
    InitiativeFeedbackFieldRole,
    InitiativeFeedbackFieldType,
} from '../types';

export const MAX_INITIATIVE_FEEDBACK_FIELDS = 12;
export const MAX_INITIATIVE_FEEDBACK_FIELD_OPTIONS = 8;

export type InitiativeFeedbackBuilderIssueCode =
    | 'noEnabledFields'
    | 'missingLabel'
    | 'selectNeedsOptions'
    | 'hiddenRequired'
    | 'missingTitleMapping'
    | 'missingDescriptionMapping'
    | 'duplicateLabel'
    | 'duplicateRoleMapping';

export interface InitiativeFeedbackBuilderIssue {
    code: InitiativeFeedbackBuilderIssueCode;
    severity: 'blocking' | 'warning';
    fieldId?: string;
    fieldLabel?: string;
}

export const defaultInitiativeFeedbackFields = (): InitiativeFeedbackField[] => ([
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

export const ensureInitiativeFeedbackFields = (fields?: InitiativeFeedbackField[]) =>
    Array.isArray(fields) && fields.length > 0 ? fields : defaultInitiativeFeedbackFields();

export const createCustomInitiativeFeedbackField = (input?: Partial<Pick<InitiativeFeedbackField, 'label' | 'placeholder' | 'helpText'>>): InitiativeFeedbackField => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
    return {
        id: `custom-${stamp}`,
        role: 'general',
        type: 'shortText',
        label: input?.label || 'New field',
        placeholder: input?.placeholder || '',
        helpText: input?.helpText || '',
        required: false,
        enabled: true,
        width: 'half',
        options: [],
        isDefault: false,
    };
};

export const feedbackFieldNeedsOptions = (type: InitiativeFeedbackFieldType) => type === 'select';

const normalizeFieldId = (value: string | undefined, fallback: string) => {
    const normalized = (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalized || fallback;
};

const normalizeOptionValue = (label: string) => label.trim();

export const prepareInitiativeFeedbackFieldsForSave = (fields: InitiativeFeedbackField[]) => {
    const seenIds = new Set<string>();

    return fields.slice(0, MAX_INITIATIVE_FEEDBACK_FIELDS).map((field, index) => {
        const fallbackId = field.role && field.role !== 'general'
            ? field.role
            : `custom-field-${index + 1}`;
        let id = normalizeFieldId(field.id, fallbackId);

        if (seenIds.has(id)) {
            id = `${id}-${index + 1}`;
        }
        seenIds.add(id);

        const options = feedbackFieldNeedsOptions(field.type)
            ? (field.options || [])
                .map((option, optionIndex) => {
                    const label = normalizeOptionValue(option.label || option.value || '');
                    return {
                        id: normalizeFieldId(option.id, `${id}-option-${optionIndex + 1}`),
                        label,
                        value: normalizeOptionValue(option.value || label),
                    };
                })
                .filter((option) => option.label && option.value)
                .slice(0, MAX_INITIATIVE_FEEDBACK_FIELD_OPTIONS)
            : [];

        return {
            ...field,
            id,
            role: field.role || 'general',
            label: (field.label || '').trim(),
            placeholder: field.placeholder?.trim() || '',
            helpText: field.helpText?.trim() || '',
            width: field.type === 'longText' || field.width === 'full' ? 'full' : 'half',
            options,
        };
    });
};

export const getInitiativeFeedbackBuilderIssues = (fields: InitiativeFeedbackField[]): InitiativeFeedbackBuilderIssue[] => {
    const issues: InitiativeFeedbackBuilderIssue[] = [];
    const preparedFields = prepareInitiativeFeedbackFieldsForSave(fields);
    const enabledFields = preparedFields.filter((field) => field.enabled !== false);

    if (enabledFields.length === 0) {
        issues.push({ code: 'noEnabledFields', severity: 'blocking' });
    }

    const labelCounts = new Map<string, number>();
    for (const field of preparedFields) {
        const labelKey = field.label.toLowerCase();
        if (labelKey) {
            labelCounts.set(labelKey, (labelCounts.get(labelKey) || 0) + 1);
        }
    }

    for (const field of preparedFields) {
        if (!field.label) {
            issues.push({
                code: 'missingLabel',
                severity: 'blocking',
                fieldId: field.id,
                fieldLabel: field.label,
            });
        }

        if (field.type === 'select' && field.enabled !== false && (field.options || []).length === 0) {
            issues.push({
                code: 'selectNeedsOptions',
                severity: 'blocking',
                fieldId: field.id,
                fieldLabel: field.label,
            });
        }

        if (field.required === true && field.enabled === false) {
            issues.push({
                code: 'hiddenRequired',
                severity: 'warning',
                fieldId: field.id,
                fieldLabel: field.label,
            });
        }

        if (field.label && labelCounts.get(field.label.toLowerCase())! > 1) {
            issues.push({
                code: 'duplicateLabel',
                severity: 'warning',
                fieldId: field.id,
                fieldLabel: field.label,
            });
        }
    }

    const mappedRoleCounts = new Map<InitiativeFeedbackFieldRole, number>();
    for (const field of enabledFields) {
        const role = field.role || 'general';
        if (role === 'general') continue;
        mappedRoleCounts.set(role, (mappedRoleCounts.get(role) || 0) + 1);
    }

    for (const field of enabledFields) {
        const role = field.role || 'general';
        if (role === 'general') continue;
        if ((mappedRoleCounts.get(role) || 0) > 1) {
            issues.push({
                code: 'duplicateRoleMapping',
                severity: 'warning',
                fieldId: field.id,
                fieldLabel: role,
            });
        }
    }

    if (enabledFields.length > 0 && !enabledFields.some((field) => field.role === 'title')) {
        issues.push({ code: 'missingTitleMapping', severity: 'warning' });
    }

    if (enabledFields.length > 0 && !enabledFields.some((field) => field.role === 'description')) {
        issues.push({ code: 'missingDescriptionMapping', severity: 'warning' });
    }

    return issues;
};

export type InitiativeFeedbackTranslate = (key: string) => string;

const englishDefaultFieldLabels = Object.fromEntries(
    defaultInitiativeFeedbackFields().map((field) => [field.role || 'general', field.label]),
) as Record<InitiativeFeedbackFieldRole | 'general', string>;

const ENGLISH_FORM_COPY_DEFAULTS = {
    title: 'Share feedback',
    submitLabel: 'Submit feedback',
    successMessage: 'Thanks. Your feedback was submitted successfully.',
};

export const localizeDefaultInitiativeFeedbackField = (
    field: InitiativeFeedbackField,
    t: InitiativeFeedbackTranslate,
): InitiativeFeedbackField => {
    const role = field.role || 'general';
    const englishLabel = (englishDefaultFieldLabels[role] || '').trim();
    const shouldLocalize = role !== 'general' && field.label.trim() === englishLabel;

    if (!shouldLocalize) {
        return field;
    }

    switch (role) {
        case 'customerName':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.customerName'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.customerName'),
            };
        case 'customerEmail':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.customerEmail'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.customerEmail'),
            };
        case 'company':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.company'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.company'),
            };
        case 'sourceUrl':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.sourceUrl'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.sourceUrl'),
            };
        case 'title':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.title'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.title'),
            };
        case 'description':
            return {
                ...field,
                label: t('initiatives.feedback.public.fields.description'),
                placeholder: t('initiatives.feedback.builder.defaultPlaceholders.description'),
            };
        default:
            return field;
    }
};

export const localizePublicInitiativeFeedbackFields = (
    fields: InitiativeFeedbackField[],
    t: InitiativeFeedbackTranslate,
) => fields.map((field) => localizeDefaultInitiativeFeedbackField(field, t));

export const localizePublicInitiativeFeedbackCopy = <T extends {
    title: string;
    description: string;
    submitLabel: string;
    successMessage: string;
}>(
    form: T,
    t: InitiativeFeedbackTranslate,
): T => ({
    ...form,
    title: !form.title.trim() || form.title.trim() === ENGLISH_FORM_COPY_DEFAULTS.title
        ? t('initiatives.feedback.fields.titlePlaceholder')
        : form.title,
    description: !form.description.trim()
        ? t('initiatives.feedback.fields.descriptionPlaceholder')
        : form.description,
    submitLabel: !form.submitLabel.trim() || form.submitLabel.trim() === ENGLISH_FORM_COPY_DEFAULTS.submitLabel
        ? t('initiatives.feedback.fields.submitLabelPlaceholder')
        : form.submitLabel,
    successMessage: !form.successMessage.trim() || form.successMessage.trim() === ENGLISH_FORM_COPY_DEFAULTS.successMessage
        ? t('initiatives.feedback.fields.successMessagePlaceholder')
        : form.successMessage,
});

export const getFeedbackFieldTypeIcon = (type: InitiativeFeedbackFieldType) => {
    switch (type) {
        case 'longText':
            return 'subject';
        case 'email':
            return 'mail';
        case 'url':
            return 'link';
        case 'select':
            return 'list_alt';
        default:
            return 'short_text';
    }
};

export interface InitiativeFeedbackEmbedModelInput {
    token?: string;
    hostedUrl?: string;
    configEndpoint: string;
    submitEndpoint: string;
    projectTitle?: string;
    initiativeTitle?: string;
    title: string;
    description: string;
    submitLabel: string;
    successMessage: string;
    allowAttachments: boolean;
    maxAttachments: number;
    fields: InitiativeFeedbackField[];
}

const sampleValueForEmbedField = (field: InitiativeFeedbackField) => {
    if (field.type === 'select') {
        return field.options?.[0]?.value || field.placeholder || field.label;
    }

    if (field.placeholder?.trim()) {
        return field.placeholder.trim();
    }

    switch (field.role) {
        case 'customerEmail':
            return 'jane@company.com';
        case 'sourceUrl':
            return 'https://app.example.com/page';
        case 'description':
            return 'Describe the feedback in more detail.';
        default:
            return field.label;
    }
};

const toPublicEmbedField = (field: InitiativeFeedbackField) => ({
    id: field.id,
    type: field.type,
    role: field.role || 'general',
    label: field.label,
    placeholder: field.placeholder || '',
    helpText: field.helpText || '',
    required: field.required === true,
    width: field.width === 'full' ? 'full' : 'half',
    ...(feedbackFieldNeedsOptions(field.type)
        ? { options: (field.options || []).map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
        })) }
        : {}),
});

export const buildInitiativeFeedbackEmbedModel = (input: InitiativeFeedbackEmbedModelInput) => {
    const preparedFields = prepareInitiativeFeedbackFieldsForSave(input.fields)
        .filter((field) => field.enabled !== false);
    const token = input.token?.trim() || '<save-to-generate>';
    const fieldValues = Object.fromEntries(
        preparedFields.map((field) => [field.id, sampleValueForEmbedField(field)]),
    );

    return {
        configEndpoint: input.configEndpoint,
        submitEndpoint: input.submitEndpoint,
        token,
        hostedUrl: input.hostedUrl || null,
        form: {
            token,
            projectTitle: input.projectTitle || '',
            initiativeTitle: input.initiativeTitle || '',
            title: input.title.trim() || 'Share feedback',
            description: input.description.trim(),
            submitLabel: input.submitLabel.trim() || 'Submit feedback',
            successMessage: input.successMessage.trim() || 'Thanks. Your feedback was submitted successfully.',
            allowAttachments: input.allowAttachments,
            maxAttachments: input.maxAttachments,
            fields: preparedFields.map(toPublicEmbedField),
            submitEndpoint: input.submitEndpoint,
        },
        submitExample: {
            token,
            source: 'embedded-endpoint',
            fieldValues,
            ...(input.allowAttachments
                ? {
                    attachments: [
                        {
                            fileName: 'screenshot.png',
                            mimeType: 'image/png',
                            dataUrl: 'data:image/png;base64,...',
                        },
                    ],
                }
                : {}),
        },
    };
};

export const getFeedbackFieldRoleIcon = (role?: InitiativeFeedbackFieldRole) => {
    switch (role) {
        case 'title':
            return 'title';
        case 'description':
            return 'notes';
        case 'customerName':
            return 'person';
        case 'customerEmail':
            return 'alternate_email';
        case 'company':
            return 'apartment';
        case 'sourceUrl':
            return 'language';
        default:
            return 'tune';
    }
};
