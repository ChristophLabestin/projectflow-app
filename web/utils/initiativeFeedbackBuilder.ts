import type {
    InitiativeFeedbackField,
    InitiativeFeedbackFieldRole,
    InitiativeFeedbackFieldType,
} from '../types';

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

export const createCustomInitiativeFeedbackField = (): InitiativeFeedbackField => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
    return {
        id: `custom-${stamp}`,
        role: 'general',
        type: 'shortText',
        label: 'New field',
        placeholder: '',
        helpText: '',
        required: false,
        enabled: true,
        width: 'half',
        options: [],
        isDefault: false,
    };
};

export const feedbackFieldNeedsOptions = (type: InitiativeFeedbackFieldType) => type === 'select';

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
