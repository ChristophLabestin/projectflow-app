import type {
    ProjectIntakeCategory,
    ProjectIntakeField,
    ProjectIntakeFieldType,
} from '../types';

export const MAX_INTAKE_FIELDS_PER_CATEGORY = 12;
export const MAX_INTAKE_CATEGORIES = 8;
export const MAX_INTAKE_FIELD_OPTIONS = 8;

export type IntakeTranslate = (key: string, fallback?: string) => string;

export const intakeFieldNeedsOptions = (type: ProjectIntakeFieldType) => type === 'select';

export const getIntakeFieldTypeIcon = (type: ProjectIntakeFieldType) => {
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

export const getIntakeCategoryIcon = (categoryId: string, fallback?: string) => {
    switch (categoryId) {
        case 'requirement':
            return 'assignment';
        case 'feedback':
            return 'reviews';
        case 'material':
            return 'attach_file';
        case 'question':
            return 'help';
        default:
            return fallback || 'category';
    }
};

/** i18n + English-default definitions for the four built-in categories. */
interface DefaultOptionDef { id: string; en: string; key: string }
interface DefaultFieldDef {
    id: string;
    role: ProjectIntakeField['role'];
    type: ProjectIntakeField['type'];
    en: string;
    key: string;
    required?: boolean;
    width?: 'full' | 'half';
    placeholder?: string;
    options?: DefaultOptionDef[];
}
interface DefaultCategoryDef {
    id: string;
    icon: string;
    enLabel: string;
    enDescription: string;
    fields: DefaultFieldDef[];
}

const catKey = (id: string, suffix: string) => `intake.categories.${id}.${suffix}`;

const DEFAULT_CATEGORY_DEFS: DefaultCategoryDef[] = [
    {
        id: 'requirement', icon: 'assignment',
        enLabel: 'Requirement', enDescription: 'Request a feature, change, or deliverable.',
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', en: 'What do you need?', key: catKey('requirement', 'field.summary'), required: true, width: 'full' },
            { id: 'details', role: 'description', type: 'longText', en: 'Describe the requirement', key: catKey('requirement', 'field.details'), required: true, width: 'full' },
            {
                id: 'priority', role: 'general', type: 'select', en: 'How urgent is it?', key: catKey('requirement', 'field.priority'), width: 'half',
                options: [
                    { id: 'low', en: 'Nice to have', key: catKey('requirement', 'opt.low') },
                    { id: 'normal', en: 'Normal', key: catKey('requirement', 'opt.normal') },
                    { id: 'high', en: 'Important', key: catKey('requirement', 'opt.high') },
                    { id: 'urgent', en: 'Urgent', key: catKey('requirement', 'opt.urgent') },
                ],
            },
        ],
    },
    {
        id: 'feedback', icon: 'reviews',
        enLabel: 'Feedback', enDescription: 'Share an impression, praise, or a problem.',
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', en: 'Short summary', key: catKey('feedback', 'field.summary'), required: true, width: 'full' },
            { id: 'details', role: 'description', type: 'longText', en: 'What would you like to share?', key: catKey('feedback', 'field.details'), required: true, width: 'full' },
            {
                id: 'sentiment', role: 'general', type: 'select', en: 'How do you feel about it?', key: catKey('feedback', 'field.sentiment'), width: 'half',
                options: [
                    { id: 'positive', en: 'Positive', key: catKey('feedback', 'opt.positive') },
                    { id: 'neutral', en: 'Neutral', key: catKey('feedback', 'opt.neutral') },
                    { id: 'negative', en: 'Negative', key: catKey('feedback', 'opt.negative') },
                ],
            },
        ],
    },
    {
        id: 'material', icon: 'attach_file',
        enLabel: 'Material / Document', enDescription: 'Provide assets, files, or reference links.',
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', en: 'What are you sharing?', key: catKey('material', 'field.summary'), required: true, width: 'full' },
            { id: 'details', role: 'description', type: 'longText', en: 'Notes about this material', key: catKey('material', 'field.details'), width: 'full' },
            { id: 'link', role: 'sourceUrl', type: 'url', en: 'Link (optional)', key: catKey('material', 'field.link'), width: 'full', placeholder: 'https://…' },
        ],
    },
    {
        id: 'question', icon: 'help',
        enLabel: 'Question', enDescription: 'Ask something about the project.',
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', en: 'Your question', key: catKey('question', 'field.summary'), required: true, width: 'full' },
            { id: 'details', role: 'description', type: 'longText', en: 'Add context (optional)', key: catKey('question', 'field.details'), width: 'full' },
        ],
    },
];

const buildFieldFromDef = (def: DefaultFieldDef, t?: IntakeTranslate): ProjectIntakeField => ({
    id: def.id,
    role: def.role,
    type: def.type,
    label: t ? t(def.key, def.en) : def.en,
    placeholder: def.placeholder,
    required: def.required === true,
    width: def.width || 'half',
    enabled: true,
    isDefault: true,
    options: def.options?.map((o) => {
        const label = t ? t(o.key, o.en) : o.en;
        return { id: o.id, label, value: label };
    }),
});

const buildCategoryFromDef = (def: DefaultCategoryDef, t?: IntakeTranslate): ProjectIntakeCategory => ({
    id: def.id,
    icon: def.icon,
    label: t ? t(catKey(def.id, 'label'), def.enLabel) : def.enLabel,
    description: t ? t(catKey(def.id, 'description'), def.enDescription) : def.enDescription,
    enabled: true,
    fields: def.fields.map((f) => buildFieldFromDef(f, t)),
});

/** Default categories in English (data authority + fallback). */
export const defaultIntakeCategories = (): ProjectIntakeCategory[] =>
    DEFAULT_CATEGORY_DEFS.map((def) => buildCategoryFromDef(def));

/** Default categories localized for the current app language (used when creating a form). */
export const localizedDefaultIntakeCategories = (t: IntakeTranslate): ProjectIntakeCategory[] =>
    DEFAULT_CATEGORY_DEFS.map((def) => buildCategoryFromDef(def, t));

export const ensureIntakeCategories = (categories?: ProjectIntakeCategory[]) =>
    Array.isArray(categories) && categories.length > 0 ? categories : defaultIntakeCategories();

export const createCustomIntakeField = (
    input?: Partial<Pick<ProjectIntakeField, 'label' | 'placeholder' | 'helpText'>>,
    t?: IntakeTranslate,
): ProjectIntakeField => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
    return {
        id: `custom-${stamp}`,
        role: 'general',
        type: 'shortText',
        label: input?.label || (t ? t('intake.builder.newField', 'New field') : 'New field'),
        placeholder: input?.placeholder || '',
        helpText: input?.helpText || '',
        required: false,
        enabled: true,
        width: 'half',
        options: [],
        isDefault: false,
    };
};

export const createCustomIntakeCategory = (t?: IntakeTranslate): ProjectIntakeCategory => {
    const stamp = `${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const tr = (key: string, en: string) => (t ? t(key, en) : en);
    return {
        id: `category-${stamp}`,
        label: tr('intake.builder.newCategory', 'New category'),
        icon: 'category',
        description: '',
        enabled: true,
        fields: [
            { id: 'summary', role: 'title', type: 'shortText', label: tr('intake.builder.seedSummary', 'Short summary'), required: true, width: 'full', enabled: true, isDefault: true },
            { id: 'details', role: 'description', type: 'longText', label: tr('intake.builder.seedDetails', 'Details'), width: 'full', enabled: true, isDefault: true },
        ],
    };
};

const normalizeId = (value: string | undefined, fallback: string) => {
    const normalized = (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
};

export const prepareIntakeCategoriesForSave = (categories: ProjectIntakeCategory[]): ProjectIntakeCategory[] => {
    const seenCategoryIds = new Set<string>();
    return categories.slice(0, MAX_INTAKE_CATEGORIES).map((category, categoryIndex) => {
        let categoryId = normalizeId(category.id, `category-${categoryIndex + 1}`);
        if (seenCategoryIds.has(categoryId)) {
            categoryId = `${categoryId}-${categoryIndex + 1}`;
        }
        seenCategoryIds.add(categoryId);

        const seenFieldIds = new Set<string>();
        const fields = (category.fields || []).slice(0, MAX_INTAKE_FIELDS_PER_CATEGORY).map((field, index) => {
            const fallbackId = field.role && field.role !== 'general' ? field.role : `field-${index + 1}`;
            let id = normalizeId(field.id, fallbackId);
            if (seenFieldIds.has(id)) {
                id = `${id}-${index + 1}`;
            }
            seenFieldIds.add(id);

            const options = intakeFieldNeedsOptions(field.type)
                ? (field.options || [])
                    .map((option, optionIndex) => {
                        const label = (option.label || option.value || '').trim();
                        return {
                            id: normalizeId(option.id, `${id}-option-${optionIndex + 1}`),
                            label,
                            value: (option.value || label).trim(),
                        };
                    })
                    .filter((option) => option.label && option.value)
                    .slice(0, MAX_INTAKE_FIELD_OPTIONS)
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
            } as ProjectIntakeField;
        });

        return {
            ...category,
            id: categoryId,
            label: (category.label || '').trim(),
            icon: category.icon || getIntakeCategoryIcon(categoryId),
            description: category.description?.trim() || '',
            enabled: category.enabled !== false,
            fields,
        };
    });
};

/**
 * Localize built-in default content (category title/description, default field labels,
 * and select-option labels) for display. Only text that still matches the English default
 * is translated, so any custom wording the creator entered is preserved. Option `value`
 * is never changed (it is the stored/submitted key).
 */
export const localizeIntakeCategory = (category: ProjectIntakeCategory, t: IntakeTranslate): ProjectIntakeCategory => {
    const def = DEFAULT_CATEGORY_DEFS.find((d) => d.id === category.id);
    if (!def) return category;

    const fieldDefs = new Map(def.fields.map((f) => [f.id, f]));

    return {
        ...category,
        label: category.label === def.enLabel ? t(catKey(def.id, 'label'), def.enLabel) : category.label,
        description: category.description === def.enDescription
            ? t(catKey(def.id, 'description'), def.enDescription)
            : category.description,
        fields: category.fields.map((field) => {
            const fdef = fieldDefs.get(field.id);
            if (!fdef) return field;
            const label = field.label === fdef.en ? t(fdef.key, fdef.en) : field.label;
            const options = field.options?.map((opt) => {
                const odef = fdef.options?.find((o) => o.id === opt.id);
                if (!odef || opt.label !== odef.en) return opt;
                return { ...opt, label: t(odef.key, odef.en) };
            });
            return options ? { ...field, label, options } : { ...field, label };
        }),
    };
};

export const localizeIntakeCategories = (categories: ProjectIntakeCategory[], t: IntakeTranslate) =>
    categories.map((category) => localizeIntakeCategory(category, t));

/** English form-level defaults written by the server when fields are left blank. */
export const EN_INTAKE_FORM_DEFAULTS = {
    title: 'Contribute to this project',
    submitLabel: 'Submit',
    successMessage: 'Thank you. Your contribution was submitted successfully.',
};

/**
 * Localize the form-level copy for display. Only values still equal to the English
 * server default are translated, so any custom wording is preserved. Empty values stay empty.
 */
export const localizeIntakeFormCopy = (
    copy: { title?: string; submitLabel?: string; successMessage?: string },
    t: IntakeTranslate,
) => ({
    title: copy.title === EN_INTAKE_FORM_DEFAULTS.title
        ? t('intake.builder.formTitlePlaceholder', EN_INTAKE_FORM_DEFAULTS.title)
        : copy.title,
    submitLabel: copy.submitLabel === EN_INTAKE_FORM_DEFAULTS.submitLabel
        ? t('intake.builder.submitLabelPlaceholder', EN_INTAKE_FORM_DEFAULTS.submitLabel)
        : copy.submitLabel,
    successMessage: copy.successMessage === EN_INTAKE_FORM_DEFAULTS.successMessage
        ? t('intake.builder.successMessagePlaceholder', EN_INTAKE_FORM_DEFAULTS.successMessage)
        : copy.successMessage,
});
