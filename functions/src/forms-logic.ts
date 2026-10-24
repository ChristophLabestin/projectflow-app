// Forms — shared pure logic (brain/plans/forms-concept.md §3, §9, §10).
//
// Canonical source: web/utils/formsLogic.ts. functions/src/forms-logic.ts is a byte-identical
// copy (checked by functions/scripts/unit/forms-logic.test.js); the iOS PFDomain port is pinned by
// the golden fixtures in shared/fixtures/forms*/. Keep this file free of imports and runtime
// dependencies, and target ES2017 (no Array.flat, no Object.fromEntries).

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const FORM_FIELD_TYPES = [
    'shortText',
    'longText',
    'singleChoice',
    'multipleChoice',
    'dropdown',
    'rating',
    'scale',
    'date',
    'number',
    'email',
    'phone',
    'fileUpload',
    'consent',
    'statement'
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_CONDITION_OPS = ['equals', 'notEquals', 'contains', 'gt', 'lt', 'answered', 'notAnswered'] as const;
export type FormConditionOp = (typeof FORM_CONDITION_OPS)[number];

export const FORM_FILE_KINDS = ['image', 'pdf', 'office', 'text'] as const;
export type FormFileKind = (typeof FORM_FILE_KINDS)[number];

export const FORM_STATUSES = ['draft', 'published', 'paused', 'closed'] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FORM_RESPONSE_STATUSES = ['new', 'reviewed', 'archived', 'spam'] as const;
export type FormResponseStatus = (typeof FORM_RESPONSE_STATUSES)[number];

export const FORM_RETENTION_MONTHS = [1, 3, 6, 12, 24] as const;

export const FORM_LIMITS = {
    maxSections: 20,
    maxFields: 100,
    maxOptions: 50,
    maxRules: 10,
    titleMax: 200,
    labelMax: 300,
    helpMax: 1000,
    optionMax: 200,
    shortTextMax: 500,
    longTextMax: 5000,
    otherTextMax: 500,
    maxFiles: 10,
    ratingMin: 3,
    ratingMax: 10,
    scaleMaxSpan: 10
} as const;

export interface FormCondition {
    mode: 'all' | 'any';
    rules: { fieldId: string; op: FormConditionOp; value?: string | number | boolean | null }[];
}

export interface FormOption {
    id: string;
    label: string;
}

export interface FormField {
    id: string;
    sectionId: string;
    type: FormFieldType;
    label: string;
    help?: string;
    required?: boolean;
    placeholder?: string;
    showIf?: FormCondition | null;
    // Choice
    options?: FormOption[];
    allowOther?: boolean;
    shuffle?: boolean;
    minSelect?: number;
    maxSelect?: number;
    // Text
    maxLength?: number;
    // Number and date bounds (dates as YYYY-MM-DD)
    min?: number | string;
    max?: number | string;
    decimals?: number;
    unit?: string;
    // Rating and scale
    ratingMax?: number;
    scaleMin?: number;
    scaleMax?: number;
    minLabel?: string;
    maxLabel?: string;
    // Date
    withTime?: boolean;
    // File upload
    maxFiles?: number;
    maxFileBytes?: number;
    fileKinds?: FormFileKind[];
    // Consent
    consentUrl?: string;
    // Email: receives the respondent copy
    isRespondentEmail?: boolean;
}

export interface FormSection {
    id: string;
    title?: string;
    description?: string;
    showIf?: FormCondition | null;
}

export interface FormSchema {
    sections: FormSection[];
    fields: FormField[];
}

export interface FormChoiceAnswer {
    selected: string[];
    other?: string;
}

export interface FormFileRef {
    fileId: string;
    name: string;
    size: number;
    contentType: string;
}

export type FormAnswer = string | number | boolean | FormChoiceAnswer | FormFileRef[];
export type FormAnswers = Record<string, FormAnswer | null | undefined>;

const CHOICE_TYPES: FormFieldType[] = ['singleChoice', 'multipleChoice', 'dropdown'];
const NO_ANSWER_TYPES: FormFieldType[] = ['statement'];

export const isChoiceField = (field: Pick<FormField, 'type'>) => CHOICE_TYPES.indexOf(field.type) >= 0;
export const acceptsAnswer = (field: Pick<FormField, 'type'>) => NO_ANSWER_TYPES.indexOf(field.type) < 0;

/** Fields in render order: by section order, then by their order in `fields`. Unknown sections last. */
export const orderedFields = (schema: FormSchema): FormField[] => {
    const rank: Record<string, number> = {};
    schema.sections.forEach((section, index) => {
        rank[section.id] = index;
    });
    return schema.fields
        .map((field, index) => ({ field, index }))
        .sort((a, b) => {
            const ra = rank[a.field.sectionId] === undefined ? schema.sections.length : rank[a.field.sectionId];
            const rb = rank[b.field.sectionId] === undefined ? schema.sections.length : rank[b.field.sectionId];
            return ra - rb || a.index - b.index;
        })
        .map((entry) => entry.field);
};

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

export type FormSchemaIssueCode =
    | 'noSections'
    | 'tooManySections'
    | 'tooManyFields'
    | 'duplicateId'
    | 'unknownSection'
    | 'invalidType'
    | 'missingLabel'
    | 'labelTooLong'
    | 'missingOptions'
    | 'tooManyOptions'
    | 'duplicateOption'
    | 'emptyOption'
    | 'invalidRange'
    | 'unknownReference'
    | 'forwardReference'
    | 'invalidOperator'
    | 'tooManyRules'
    | 'invalidFileKinds';

export interface FormSchemaIssue {
    code: FormSchemaIssueCode;
    /** Field or section id the issue belongs to; null for schema-wide issues. */
    targetId: string | null;
    /** Field id a condition rule points at, for reference issues. */
    refId?: string;
}

const isNum = (value: unknown): value is number => typeof value === 'number' && isFinite(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const checkCondition = (
    condition: FormCondition | null | undefined,
    targetId: string,
    earlierIds: Record<string, true>,
    allIds: Record<string, true>,
    issues: FormSchemaIssue[]
) => {
    if (!condition) return;
    const rules = Array.isArray(condition.rules) ? condition.rules : [];
    if (rules.length > FORM_LIMITS.maxRules) issues.push({ code: 'tooManyRules', targetId });
    rules.forEach((rule) => {
        if (FORM_CONDITION_OPS.indexOf(rule.op) < 0) {
            issues.push({ code: 'invalidOperator', targetId, refId: rule.fieldId });
        } else if (!allIds[rule.fieldId]) {
            issues.push({ code: 'unknownReference', targetId, refId: rule.fieldId });
        } else if (!earlierIds[rule.fieldId]) {
            issues.push({ code: 'forwardReference', targetId, refId: rule.fieldId });
        }
    });
};

/**
 * Structural problems of a schema, in field order. An empty list means the form can be published.
 * Conditions may only point at fields that come earlier (no cycles); a section's condition may
 * only point at fields of earlier sections.
 */
export const validateFormSchema = (schema: FormSchema): FormSchemaIssue[] => {
    const issues: FormSchemaIssue[] = [];
    if (!schema.sections.length) issues.push({ code: 'noSections', targetId: null });
    if (schema.sections.length > FORM_LIMITS.maxSections) issues.push({ code: 'tooManySections', targetId: null });
    if (schema.fields.length > FORM_LIMITS.maxFields) issues.push({ code: 'tooManyFields', targetId: null });

    const seen: Record<string, true> = {};
    const sectionIds: Record<string, true> = {};
    schema.sections.forEach((section) => {
        if (seen[section.id]) issues.push({ code: 'duplicateId', targetId: section.id });
        seen[section.id] = true;
        sectionIds[section.id] = true;
    });
    const fieldIds: Record<string, true> = {};
    schema.fields.forEach((field) => {
        if (seen[field.id]) issues.push({ code: 'duplicateId', targetId: field.id });
        seen[field.id] = true;
        fieldIds[field.id] = true;
    });

    const ordered = orderedFields(schema);
    const earlier: Record<string, true> = {};
    const checkField = (field: FormField) => {
        const id = field.id;
        if (!sectionIds[field.sectionId]) issues.push({ code: 'unknownSection', targetId: id });
        if (FORM_FIELD_TYPES.indexOf(field.type) < 0) {
            issues.push({ code: 'invalidType', targetId: id });
            earlier[id] = true;
            return;
        }
        const label = isText(field.label) ? field.label.trim() : '';
        if (!label) issues.push({ code: 'missingLabel', targetId: id });
        if (label.length > FORM_LIMITS.labelMax) issues.push({ code: 'labelTooLong', targetId: id });

        if (isChoiceField(field)) {
            const options = Array.isArray(field.options) ? field.options : [];
            if (!options.length) issues.push({ code: 'missingOptions', targetId: id });
            if (options.length > FORM_LIMITS.maxOptions) issues.push({ code: 'tooManyOptions', targetId: id });
            const optionIds: Record<string, true> = {};
            options.forEach((option) => {
                if (optionIds[option.id]) issues.push({ code: 'duplicateOption', targetId: id, refId: option.id });
                optionIds[option.id] = true;
                if (!isText(option.label) || !option.label.trim()) issues.push({ code: 'emptyOption', targetId: id, refId: option.id });
            });
            if (field.type === 'multipleChoice') {
                const min = isNum(field.minSelect) ? field.minSelect : 0;
                const max = isNum(field.maxSelect) ? field.maxSelect : options.length;
                if (min < 0 || max < 1 || min > max || min > options.length) issues.push({ code: 'invalidRange', targetId: id });
            }
        }
        if (field.type === 'rating') {
            const max = isNum(field.ratingMax) ? field.ratingMax : 5;
            if (max < FORM_LIMITS.ratingMin || max > FORM_LIMITS.ratingMax || Math.floor(max) !== max) {
                issues.push({ code: 'invalidRange', targetId: id });
            }
        }
        if (field.type === 'scale') {
            const min = isNum(field.scaleMin) ? field.scaleMin : 1;
            const max = isNum(field.scaleMax) ? field.scaleMax : 5;
            if ((min !== 0 && min !== 1) || max <= min || max - min > FORM_LIMITS.scaleMaxSpan || Math.floor(max) !== max) {
                issues.push({ code: 'invalidRange', targetId: id });
            }
        }
        if (field.type === 'number' && isNum(field.min) && isNum(field.max) && field.min > field.max) {
            issues.push({ code: 'invalidRange', targetId: id });
        }
        if (field.type === 'date' && isText(field.min) && isText(field.max) && field.min > field.max) {
            issues.push({ code: 'invalidRange', targetId: id });
        }
        if (field.type === 'fileUpload') {
            const maxFiles = isNum(field.maxFiles) ? field.maxFiles : 1;
            if (maxFiles < 1 || maxFiles > FORM_LIMITS.maxFiles) issues.push({ code: 'invalidRange', targetId: id });
            const kinds = Array.isArray(field.fileKinds) ? field.fileKinds : [];
            if (kinds.some((kind) => FORM_FILE_KINDS.indexOf(kind) < 0)) issues.push({ code: 'invalidFileKinds', targetId: id });
        }
        checkCondition(field.showIf, id, earlier, fieldIds, issues);
        earlier[id] = true;
    };
    // Section by section, so a section's condition sees only fields of earlier sections.
    schema.sections.forEach((section) => {
        checkCondition(section.showIf, section.id, { ...earlier }, fieldIds, issues);
        ordered.filter((field) => field.sectionId === section.id).forEach(checkField);
    });
    ordered.filter((field) => !sectionIds[field.sectionId]).forEach(checkField);
    return issues;
};

// ---------------------------------------------------------------------------
// Answers and conditions
// ---------------------------------------------------------------------------

const isChoiceAnswer = (value: unknown): value is FormChoiceAnswer =>
    !!value && typeof value === 'object' && !Array.isArray(value) && Array.isArray((value as FormChoiceAnswer).selected);

/** Whether a value counts as an answer for the field (empty text, empty choice, false consent do not). */
export const isAnswered = (field: FormField, value: FormAnswer | null | undefined): boolean => {
    if (value === null || value === undefined) return false;
    if (isChoiceField(field)) {
        if (!isChoiceAnswer(value)) return false;
        return value.selected.length > 0 || (isText(value.other) && value.other.trim().length > 0);
    }
    if (field.type === 'fileUpload') return Array.isArray(value) && value.length > 0;
    if (field.type === 'consent') return value === true;
    if (isText(value)) return value.trim().length > 0;
    return isNum(value);
};

const norm = (value: unknown) => String(value === null || value === undefined ? '' : value).trim().toLowerCase();

const ruleMatches = (
    rule: FormCondition['rules'][number],
    field: FormField | undefined,
    value: FormAnswer | null | undefined
): boolean => {
    const answered = !!field && isAnswered(field, value);
    if (rule.op === 'answered') return answered;
    if (rule.op === 'notAnswered') return !answered;
    if (!field || !answered) return rule.op === 'notEquals';
    if (isChoiceField(field)) {
        const choice = value as FormChoiceAnswer;
        const hit = choice.selected.indexOf(String(rule.value)) >= 0;
        if (rule.op === 'equals' || rule.op === 'contains') return hit;
        if (rule.op === 'notEquals') return !hit;
        return false;
    }
    if (field.type === 'consent') {
        const expected = rule.value === true || rule.value === 'true';
        if (rule.op === 'equals') return value === expected;
        if (rule.op === 'notEquals') return value !== expected;
        return false;
    }
    if (field.type === 'fileUpload') return false;
    if (isNum(value)) {
        const target = Number(rule.value);
        if (!isFinite(target)) return rule.op === 'notEquals';
        if (rule.op === 'equals') return value === target;
        if (rule.op === 'notEquals') return value !== target;
        if (rule.op === 'gt') return value > target;
        if (rule.op === 'lt') return value < target;
        return false;
    }
    const text = norm(value);
    const target = norm(rule.value);
    if (rule.op === 'equals') return text === target;
    if (rule.op === 'notEquals') return text !== target;
    if (rule.op === 'contains') return target.length > 0 && text.indexOf(target) >= 0;
    // Dates (YYYY-MM-DD[THH:mm]) compare lexically; other text never compares.
    if (field.type === 'date') {
        if (rule.op === 'gt') return text > target;
        if (rule.op === 'lt') return text < target;
    }
    return false;
};

const conditionHolds = (
    condition: FormCondition | null | undefined,
    byId: Record<string, FormField>,
    answers: FormAnswers,
    visible: Record<string, true>
): boolean => {
    if (!condition || !Array.isArray(condition.rules) || !condition.rules.length) return true;
    // A hidden (or unknown) field counts as unanswered.
    const results = condition.rules.map((rule) =>
        ruleMatches(rule, visible[rule.fieldId] ? byId[rule.fieldId] : undefined, visible[rule.fieldId] ? answers[rule.fieldId] : undefined)
    );
    return condition.mode === 'any' ? results.some(Boolean) : results.every(Boolean);
};

export interface FormVisibility {
    sectionIds: string[];
    fieldIds: string[];
}

/**
 * Visible sections and fields for the given answers, in render order. A field is visible when its
 * section and its own condition are; conditions read only earlier, visible fields.
 */
export const visibleFormItems = (schema: FormSchema, answers: FormAnswers): FormVisibility => {
    const byId: Record<string, FormField> = {};
    schema.fields.forEach((field) => {
        byId[field.id] = field;
    });
    const visibleFields: Record<string, true> = {};
    const sectionVisible: Record<string, boolean> = {};
    const sectionIds: string[] = [];
    const fieldIds: string[] = [];
    const ordered = orderedFields(schema);
    schema.sections.forEach((section) => {
        sectionVisible[section.id] = conditionHolds(section.showIf, byId, answers, visibleFields);
        if (sectionVisible[section.id]) sectionIds.push(section.id);
        ordered
            .filter((field) => field.sectionId === section.id)
            .forEach((field) => {
                if (sectionVisible[section.id] && conditionHolds(field.showIf, byId, answers, visibleFields)) {
                    visibleFields[field.id] = true;
                    fieldIds.push(field.id);
                }
            });
    });
    return { sectionIds, fieldIds };
};

// ---------------------------------------------------------------------------
// Submission validation
// ---------------------------------------------------------------------------

export type FormAnswerErrorCode =
    | 'required'
    | 'invalidType'
    | 'tooLong'
    | 'invalidOption'
    | 'tooFewSelected'
    | 'tooManySelected'
    | 'outOfRange'
    | 'invalidEmail'
    | 'invalidPhone'
    | 'invalidDate'
    | 'tooManyFiles'
    | 'fileTooLarge'
    | 'fileTypeNotAllowed';

export interface FormAnswerError {
    fieldId: string;
    code: FormAnswerErrorCode;
}

export interface FormSubmissionResult {
    ok: boolean;
    /** Cleaned answers: only visible, answerable fields with a valid, normalized value. */
    answers: Record<string, FormAnswer>;
    errors: FormAnswerError[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+()\d\s/.-]{5,30}$/;

const OFFICE_TYPES = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation'
];
const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];
const TEXT_EXT = ['txt', 'csv', 'md'];

/** Whether a file matches the allowed kinds. No kinds = images, PDF, office and text. SVG is never an image here. */
export const fileKindAllows = (kinds: FormFileKind[] | undefined, contentType: string, name: string): boolean => {
    const allowed = kinds && kinds.length ? kinds : FORM_FILE_KINDS.slice();
    const type = norm(contentType);
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
    return allowed.some((kind) => {
        if (kind === 'image') return type.indexOf('image/') === 0 && type !== 'image/svg+xml' && ext !== 'svg';
        if (kind === 'pdf') return type === 'application/pdf' && ext === 'pdf';
        if (kind === 'office') return OFFICE_TYPES.indexOf(type) >= 0 && OFFICE_EXT.indexOf(ext) >= 0;
        return (type === 'text/plain' || type === 'text/csv' || type === 'text/markdown') && TEXT_EXT.indexOf(ext) >= 0;
    });
};

const validDate = (text: string, withTime: boolean) => {
    if (!(withTime ? DATE_TIME : DATE_ONLY).test(text)) return false;
    const [y, m, d] = text.slice(0, 10).split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return false;
    if (!withTime) return true;
    const [hh, mm] = text.slice(11).split(':').map(Number);
    return hh < 24 && mm < 60;
};

interface AnswerFailure {
    failure: FormAnswerErrorCode;
}
const fail = (code: FormAnswerErrorCode): AnswerFailure => ({ failure: code });
const isFailure = (value: unknown): value is AnswerFailure =>
    !!value && typeof value === 'object' && typeof (value as AnswerFailure).failure === 'string';

const clean = (field: FormField, value: FormAnswer): FormAnswer | AnswerFailure => {
    switch (field.type) {
        case 'shortText':
        case 'longText': {
            if (!isText(value)) return fail('invalidType');
            const text = value.trim();
            const cap = field.type === 'shortText' ? FORM_LIMITS.shortTextMax : FORM_LIMITS.longTextMax;
            const max = isNum(field.maxLength) ? Math.min(field.maxLength, cap) : cap;
            return text.length > max ? fail('tooLong') : text;
        }
        case 'email': {
            if (!isText(value)) return fail('invalidType');
            const text = value.trim().toLowerCase();
            if (text.length > 254) return fail('tooLong');
            return EMAIL.test(text) ? text : fail('invalidEmail');
        }
        case 'phone': {
            if (!isText(value)) return fail('invalidType');
            const text = value.trim();
            return PHONE.test(text) ? text : fail('invalidPhone');
        }
        case 'singleChoice':
        case 'dropdown':
        case 'multipleChoice': {
            if (!isChoiceAnswer(value)) return fail('invalidType');
            const optionIds = (field.options || []).map((option) => option.id);
            const selected: string[] = [];
            for (const id of value.selected) {
                if (!isText(id) || optionIds.indexOf(id) < 0) return fail('invalidOption');
                if (selected.indexOf(id) < 0) selected.push(id);
            }
            const otherAllowed = field.allowOther === true && field.type !== 'dropdown';
            const other = otherAllowed && isText(value.other) ? value.other.trim() : '';
            if (!otherAllowed && isText(value.other) && value.other.trim()) return fail('invalidOption');
            if (other.length > FORM_LIMITS.otherTextMax) return fail('tooLong');
            const count = selected.length + (other ? 1 : 0);
            if (field.type !== 'multipleChoice') {
                if (count > 1) return fail('tooManySelected');
            } else {
                if (isNum(field.maxSelect) && count > field.maxSelect) return fail('tooManySelected');
                if (isNum(field.minSelect) && count < field.minSelect) return fail('tooFewSelected');
            }
            return other ? { selected, other } : { selected };
        }
        case 'rating': {
            if (!isNum(value)) return fail('invalidType');
            const max = isNum(field.ratingMax) ? field.ratingMax : 5;
            return Math.floor(value) === value && value >= 1 && value <= max ? value : fail('outOfRange');
        }
        case 'scale': {
            if (!isNum(value)) return fail('invalidType');
            const min = isNum(field.scaleMin) ? field.scaleMin : 1;
            const max = isNum(field.scaleMax) ? field.scaleMax : 5;
            return Math.floor(value) === value && value >= min && value <= max ? value : fail('outOfRange');
        }
        case 'number': {
            if (!isNum(value)) return fail('invalidType');
            const decimals = isNum(field.decimals) ? Math.max(0, Math.min(6, Math.floor(field.decimals))) : 0;
            const factor = Math.pow(10, decimals);
            const rounded = Math.round(value * factor) / factor;
            if (isNum(field.min) && rounded < field.min) return fail('outOfRange');
            if (isNum(field.max) && rounded > field.max) return fail('outOfRange');
            return rounded;
        }
        case 'date': {
            if (!isText(value)) return fail('invalidType');
            const text = value.trim();
            if (!validDate(text, field.withTime === true)) return fail('invalidDate');
            const day = text.slice(0, 10);
            if (isText(field.min) && day < field.min) return fail('outOfRange');
            if (isText(field.max) && day > field.max) return fail('outOfRange');
            return text;
        }
        case 'consent':
            return value === true ? true : fail('invalidType');
        case 'fileUpload': {
            if (!Array.isArray(value)) return fail('invalidType');
            const maxFiles = isNum(field.maxFiles) ? field.maxFiles : 1;
            if (value.length > maxFiles) return fail('tooManyFiles');
            const files: FormFileRef[] = [];
            for (const file of value) {
                if (!file || !isText(file.fileId) || !file.fileId || !isText(file.name) || !isNum(file.size) || !isText(file.contentType)) {
                    return fail('invalidType');
                }
                if (isNum(field.maxFileBytes) && file.size > field.maxFileBytes) return fail('fileTooLarge');
                if (!fileKindAllows(field.fileKinds, file.contentType, file.name)) return fail('fileTypeNotAllowed');
                files.push({ fileId: file.fileId, name: file.name, size: file.size, contentType: file.contentType });
            }
            return files;
        }
        default:
            return fail('invalidType');
    }
};

/**
 * Validates and normalizes a submission against the published schema. Answers of hidden, unknown and
 * statement fields are dropped (never stored); required applies only to visible fields.
 */
export const validateSubmission = (schema: FormSchema, answers: FormAnswers): FormSubmissionResult => {
    const visibility = visibleFormItems(schema, answers);
    const byId: Record<string, FormField> = {};
    schema.fields.forEach((field) => {
        byId[field.id] = field;
    });
    const cleaned: Record<string, FormAnswer> = {};
    const errors: FormAnswerError[] = [];
    visibility.fieldIds.forEach((id) => {
        const field = byId[id];
        if (!acceptsAnswer(field)) return;
        const value = answers[id];
        if (!isAnswered(field, value)) {
            if (field.required) errors.push({ fieldId: id, code: 'required' });
            return;
        }
        const result = clean(field, value as FormAnswer);
        if (isFailure(result)) {
            errors.push({ fieldId: id, code: result.failure });
            return;
        }
        if (field.required && !isAnswered(field, result)) {
            errors.push({ fieldId: id, code: 'required' });
            return;
        }
        cleaned[id] = result;
    });
    return { ok: errors.length === 0, answers: cleaned, errors };
};


// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** One CSV cell as plain text: choices by label (multiple joined with "; "), files by name. */
export const answerToText = (field: FormField, value: FormAnswer | null | undefined): string => {
    if (value === null || value === undefined) return '';
    if (isChoiceField(field) && isChoiceAnswer(value)) {
        const labels = value.selected.map((id) => {
            const option = (field.options || []).filter((entry) => entry.id === id)[0];
            return option ? option.label : id;
        });
        if (isText(value.other) && value.other) labels.push(value.other);
        return labels.join('; ');
    }
    if (Array.isArray(value)) return value.map((file) => file.name).join('; ');
    if (value === true) return 'true';
    if (value === false) return 'false';
    return String(value);
};

/** RFC 4180 cell; also neutralizes spreadsheet formulas (=, +, -, @, tab, CR) with a leading quote. */
export const csvCell = (text: string, delimiter: ',' | ';' = ','): string => {
    let out = text;
    if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
    if (out.indexOf('"') >= 0 || out.indexOf(delimiter) >= 0 || out.indexOf('\n') >= 0 || out.indexOf('\r') >= 0) {
        out = `"${out.replace(/"/g, '""')}"`;
    }
    return out;
};

// ---------------------------------------------------------------------------
// Plan quota (brain/plans/forms-concept.md §9)
// ---------------------------------------------------------------------------

export interface FormQuota {
    /** Published + paused forms; null = unlimited. */
    activeForms: number | null;
    responsesPerMonth: number;
    uploads: boolean;
    logic: boolean;
    fullTheme: boolean;
    removeBranding: boolean;
    workspaceAudience: boolean;
    plan: 'free' | 'personal' | 'team' | 'organization' | 'legacy';
}

const PLAN_FORM_QUOTA: Record<FormQuota['plan'], Omit<FormQuota, 'plan'>> = {
    free: { activeForms: 3, responsesPerMonth: 100, uploads: false, logic: false, fullTheme: false, removeBranding: false, workspaceAudience: false },
    personal: { activeForms: 20, responsesPerMonth: 1000, uploads: true, logic: false, fullTheme: true, removeBranding: false, workspaceAudience: false },
    team: { activeForms: null, responsesPerMonth: 10000, uploads: true, logic: true, fullTheme: true, removeBranding: true, workspaceAudience: true },
    organization: { activeForms: null, responsesPerMonth: 50000, uploads: true, logic: true, fullTheme: true, removeBranding: true, workspaceAudience: true },
    // No entitlement doc = legacy workspace in beta grace: treated like Team.
    legacy: { activeForms: null, responsesPerMonth: 10000, uploads: true, logic: true, fullTheme: true, removeBranding: true, workspaceAudience: true }
};

type Json = Record<string, any>;

/**
 * Forms quota of a workspace from `tenants/{t}/entitlements/plan` and the tenant doc. A platform-admin
 * override `tenants/{t}.limits.forms` wins field by field (`activeForms` may be null = unlimited).
 */
export const formQuotaFor = (entitlement: Json | null | undefined, tenant: Json | null | undefined): FormQuota => {
    const planId = entitlement ? String(entitlement.plan || 'free') : 'legacy';
    const plan = (PLAN_FORM_QUOTA[planId as FormQuota['plan']] ? planId : 'free') as FormQuota['plan'];
    const base = PLAN_FORM_QUOTA[plan];
    const raw: Json = (tenant && tenant.limits && tenant.limits.forms) || {};
    const count = (key: 'responsesPerMonth') => (isNum(raw[key]) && raw[key] >= 0 ? Math.floor(raw[key]) : base[key]);
    const flag = (key: 'uploads' | 'logic' | 'fullTheme' | 'removeBranding' | 'workspaceAudience') =>
        typeof raw[key] === 'boolean' ? raw[key] : base[key];
    const active = raw.activeForms === null ? null : isNum(raw.activeForms) && raw.activeForms >= 0 ? Math.floor(raw.activeForms) : base.activeForms;
    return {
        activeForms: active,
        responsesPerMonth: count('responsesPerMonth'),
        uploads: flag('uploads'),
        logic: flag('logic'),
        fullTheme: flag('fullTheme'),
        removeBranding: flag('removeBranding'),
        workspaceAudience: flag('workspaceAudience'),
        plan
    };
};

/** Plan features a schema uses; the server rejects publishing with `plan-form-feature` if one is not in the quota. */
export const formFeaturesUsed = (schema: FormSchema): { uploads: boolean; logic: boolean } => ({
    uploads: schema.fields.some((field) => field.type === 'fileUpload'),
    logic: schema.fields.some((field) => !!field.showIf && field.showIf.rules.length > 0) ||
        schema.sections.some((section) => !!section.showIf && section.showIf.rules.length > 0)
});

// ---------------------------------------------------------------------------
// Access (brain/plans/forms-concept.md §10)
// ---------------------------------------------------------------------------

export interface FormAccessContext {
    uid: string;
    /** System role of the membership: 'Owner' | 'Admin' | 'Member' | 'Guest'. */
    role: string;
    /** Permission nodes granted by custom roles (allow list, deny already applied). */
    permissions?: string[];
}

const hasNode = (ctx: FormAccessContext, node: string) => !!ctx.permissions && ctx.permissions.indexOf(node) >= 0;

/** Owner/Admin or a custom role with `tenant.forms.manageAll`. */
export const canManageAllForms = (ctx: FormAccessContext) =>
    ctx.role === 'Owner' || ctx.role === 'Admin' || hasNode(ctx, 'tenant.forms.manageAll');

/** Members create forms by default; guests only through a custom role with `tenant.forms.create`. */
export const canCreateForms = (ctx: FormAccessContext) =>
    canManageAllForms(ctx) || ctx.role === 'Member' || hasNode(ctx, 'tenant.forms.create');

/** Edit the form and see, export and delete its responses. */
export const canEditForm = (form: { ownerId?: string; editorIds?: string[] }, ctx: FormAccessContext) =>
    canManageAllForms(ctx) ||
    (ctx.role !== 'Guest' && (form.ownerId === ctx.uid || (Array.isArray(form.editorIds) && form.editorIds.indexOf(ctx.uid) >= 0)));

/** Fill in a workspace-only form: full members always, guests only when the form allows it. */
export const canFillWorkspaceForm = (form: { allowGuests?: boolean }, ctx: FormAccessContext) =>
    ctx.role !== 'Guest' || form.allowGuests === true;

/** expireAt for a response from the form's retention (null = keep). */
export const responseExpiry = (submittedAtMs: number, retentionMonths: number | null | undefined): number | null => {
    if (retentionMonths === null || retentionMonths === undefined) return null;
    if (FORM_RETENTION_MONTHS.indexOf(retentionMonths as (typeof FORM_RETENTION_MONTHS)[number]) < 0) return null;
    const date = new Date(submittedAtMs);
    date.setUTCMonth(date.getUTCMonth() + retentionMonths);
    return date.getTime();
};
