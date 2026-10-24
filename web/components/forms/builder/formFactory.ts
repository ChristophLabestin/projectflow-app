// Builder helpers: new ids, default fields and starter templates (brain/plans/forms-concept.md §2–3).
import type { FormField, FormFieldType, FormSchema, FormSection } from '../../../utils/formsLogic';

type T = (key: string) => string;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** Stable, never reused id for fields, sections and options. */
export const newFormId = (prefix: string) => {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return `${prefix}_${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')}`;
};

export const FIELD_TYPE_ICONS: Record<FormFieldType, string> = {
    shortText: 'short_text',
    longText: 'notes',
    singleChoice: 'radio_button_checked',
    multipleChoice: 'check_box',
    dropdown: 'arrow_drop_down_circle',
    rating: 'star',
    scale: 'linear_scale',
    date: 'calendar_today',
    number: 'pin',
    email: 'alternate_email',
    phone: 'call',
    fileUpload: 'upload_file',
    consent: 'verified_user',
    statement: 'info'
};

/** Picker order: common types first. */
export const FIELD_TYPE_ORDER: FormFieldType[] = [
    'shortText', 'longText', 'singleChoice', 'multipleChoice', 'dropdown', 'email', 'phone', 'number',
    'date', 'rating', 'scale', 'fileUpload', 'consent', 'statement'
];

export const newSection = (title = ''): FormSection => ({ id: newFormId('s'), title });

export const newField = (type: FormFieldType, sectionId: string, t: T): FormField => {
    const base: FormField = { id: newFormId('f'), sectionId, type, label: t(`forms.fieldType.${type}.defaultLabel`) };
    switch (type) {
        case 'singleChoice':
        case 'multipleChoice':
        case 'dropdown':
            return { ...base, options: [1, 2, 3].map((n) => ({ id: newFormId('o'), label: `${t('forms.builder.option')} ${n}` })) };
        case 'rating':
            return { ...base, ratingMax: 5 };
        case 'scale':
            return { ...base, scaleMin: 1, scaleMax: 5 };
        case 'fileUpload':
            return { ...base, maxFiles: 1, maxFileBytes: 10 * 1024 * 1024, fileKinds: ['image', 'pdf'] };
        case 'consent':
            return { ...base, required: true };
        default:
            return base;
    }
};

/** Copy with fresh ids (options too); conditions are dropped because they point at the original. */
export const duplicateField = (field: FormField): FormField => ({
    ...field,
    id: newFormId('f'),
    showIf: null,
    options: field.options?.map((option) => ({ ...option, id: newFormId('o') }))
});

export interface FormTemplate {
    id: string;
    icon: string;
    build: (t: T) => { title: string; description: string; draft: FormSchema };
}

const opt = (t: T, ...keys: string[]) => keys.map((key) => ({ id: newFormId('o'), label: t(key) }));
const field = (sectionId: string, type: FormFieldType, label: string, extra: Partial<FormField> = {}): FormField =>
    ({ id: newFormId('f'), sectionId, type, label, ...extra });

export const FORM_TEMPLATES: FormTemplate[] = [
    {
        id: 'blank',
        icon: 'add',
        build: (t) => {
            const s = newSection();
            return { title: t('forms.template.blank.title'), description: '', draft: { sections: [s], fields: [newField('shortText', s.id, t)] } };
        }
    },
    {
        id: 'contact',
        icon: 'contact_mail',
        build: (t) => {
            const s = newSection();
            return {
                title: t('forms.template.contact.title'),
                description: t('forms.template.contact.description'),
                draft: { sections: [s], fields: [
                    field(s.id, 'shortText', t('forms.template.q.name'), { required: true }),
                    field(s.id, 'email', t('forms.template.q.email'), { required: true, isRespondentEmail: true }),
                    field(s.id, 'shortText', t('forms.template.q.company')),
                    field(s.id, 'singleChoice', t('forms.template.q.topic'), { required: true, allowOther: true, options: opt(t, 'forms.template.o.project', 'forms.template.o.support', 'forms.template.o.quote') }),
                    field(s.id, 'longText', t('forms.template.q.message'), { required: true })
                ] }
            };
        }
    },
    {
        id: 'bug',
        icon: 'bug_report',
        build: (t) => {
            const s1 = newSection(t('forms.template.bug.s1'));
            const s2 = newSection(t('forms.template.bug.s2'));
            const severity = field(s1.id, 'singleChoice', t('forms.template.q.severity'), { required: true, options: opt(t, 'forms.template.o.low', 'forms.template.o.medium', 'forms.template.o.critical') });
            return {
                title: t('forms.template.bug.title'),
                description: t('forms.template.bug.description'),
                draft: { sections: [s1, s2], fields: [
                    field(s1.id, 'email', t('forms.template.q.email'), { required: true, isRespondentEmail: true }),
                    severity,
                    field(s1.id, 'longText', t('forms.template.q.whatHappened'), { required: true }),
                    field(s2.id, 'longText', t('forms.template.q.steps')),
                    field(s2.id, 'date', t('forms.template.q.when')),
                    field(s2.id, 'fileUpload', t('forms.template.q.screenshots'), { maxFiles: 3, maxFileBytes: 10 * 1024 * 1024, fileKinds: ['image', 'pdf'] }),
                    field(s2.id, 'phone', t('forms.template.q.callback'), {
                        showIf: { mode: 'all', rules: [{ fieldId: severity.id, op: 'equals', value: severity.options![2].id }] }
                    })
                ] }
            };
        }
    },
    {
        id: 'briefing',
        icon: 'design_services',
        build: (t) => {
            const s = newSection();
            return {
                title: t('forms.template.briefing.title'),
                description: t('forms.template.briefing.description'),
                draft: { sections: [s], fields: [
                    field(s.id, 'shortText', t('forms.template.q.name'), { required: true }),
                    field(s.id, 'email', t('forms.template.q.email'), { required: true, isRespondentEmail: true }),
                    field(s.id, 'longText', t('forms.template.q.goal'), { required: true }),
                    field(s.id, 'multipleChoice', t('forms.template.q.deliverables'), { allowOther: true, options: opt(t, 'forms.template.o.website', 'forms.template.o.app', 'forms.template.o.branding') }),
                    field(s.id, 'number', t('forms.template.q.budget'), { min: 0, unit: 'EUR' }),
                    field(s.id, 'date', t('forms.template.q.deadline')),
                    field(s.id, 'fileUpload', t('forms.template.q.attachments'), { maxFiles: 5, maxFileBytes: 20 * 1024 * 1024, fileKinds: ['image', 'pdf', 'office'] })
                ] }
            };
        }
    },
    {
        id: 'event',
        icon: 'event',
        build: (t) => {
            const s = newSection();
            return {
                title: t('forms.template.event.title'),
                description: t('forms.template.event.description'),
                draft: { sections: [s], fields: [
                    field(s.id, 'shortText', t('forms.template.q.name'), { required: true }),
                    field(s.id, 'email', t('forms.template.q.email'), { required: true, isRespondentEmail: true }),
                    field(s.id, 'singleChoice', t('forms.template.q.attend'), { required: true, options: opt(t, 'forms.template.o.onsite', 'forms.template.o.online') }),
                    field(s.id, 'dropdown', t('forms.template.q.diet'), { options: opt(t, 'forms.template.o.none', 'forms.template.o.vegetarian', 'forms.template.o.vegan') }),
                    field(s.id, 'longText', t('forms.template.q.notes'))
                ] }
            };
        }
    },
    {
        id: 'pulse',
        icon: 'favorite',
        build: (t) => {
            const s = newSection();
            return {
                title: t('forms.template.pulse.title'),
                description: t('forms.template.pulse.description'),
                draft: { sections: [s], fields: [
                    field(s.id, 'rating', t('forms.template.q.mood'), { required: true, ratingMax: 5 }),
                    field(s.id, 'scale', t('forms.template.q.workload'), { required: true, scaleMin: 1, scaleMax: 5, minLabel: t('forms.template.o.tooLittle'), maxLabel: t('forms.template.o.tooMuch') }),
                    field(s.id, 'longText', t('forms.template.q.wentWell')),
                    field(s.id, 'longText', t('forms.template.q.improve'))
                ] }
            };
        }
    },
    {
        id: 'nps',
        icon: 'recommend',
        build: (t) => {
            const s = newSection();
            const score = field(s.id, 'scale', t('forms.template.q.recommend'), { required: true, scaleMin: 0, scaleMax: 10, minLabel: t('forms.template.o.unlikely'), maxLabel: t('forms.template.o.likely') });
            return {
                title: t('forms.template.nps.title'),
                description: '',
                draft: { sections: [s], fields: [
                    score,
                    field(s.id, 'longText', t('forms.template.q.why')),
                    field(s.id, 'email', t('forms.template.q.emailOptional'), { showIf: { mode: 'all', rules: [{ fieldId: score.id, op: 'lt', value: 7 }] } })
                ] }
            };
        }
    }
];
