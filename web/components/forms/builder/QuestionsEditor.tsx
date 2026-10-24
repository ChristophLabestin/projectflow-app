import React, { useMemo, useState } from 'react';

import { Button } from '../../common/Button/Button';
import { useLanguage } from '../../../context/LanguageContext';
import {
    acceptsAnswer,
    orderedFields,
    type FormField,
    type FormFieldType,
    type FormSchema,
    type FormSchemaIssue,
    type FormSection
} from '../../../utils/formsLogic';
import { ConditionEditor } from './ConditionEditor';
import { FieldEditor } from './FieldEditor';
import { FIELD_TYPE_ICONS, FIELD_TYPE_ORDER, duplicateField, newField, newSection } from './formFactory';

interface QuestionsEditorProps {
    draft: FormSchema;
    onChange: (draft: FormSchema) => void;
    issues: FormSchemaIssue[];
    logicAllowed: boolean;
    uploadsAllowed: boolean;
    maxFileBytesCap: number;
}

/** Sections with dense question rows; the selected question expands inline (STYLING §6.2). */
export const QuestionsEditor: React.FC<QuestionsEditorProps> = ({ draft, onChange, issues, logicAllowed, uploadsAllowed, maxFileBytesCap }) => {
    const { t } = useLanguage();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [pickerFor, setPickerFor] = useState<string | null>(null);
    const [sectionConditionFor, setSectionConditionFor] = useState<string | null>(null);
    const ordered = useMemo(() => orderedFields(draft), [draft]);
    const issuesById = useMemo(() => {
        const map: Record<string, FormSchemaIssue[]> = {};
        issues.forEach((issue) => {
            if (!issue.targetId) return;
            (map[issue.targetId] = map[issue.targetId] || []).push(issue);
        });
        return map;
    }, [issues]);

    const setFields = (fields: FormField[]) => onChange({ ...draft, fields });
    const patchField = (id: string, patch: Partial<FormField>) =>
        setFields(draft.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)));
    const patchSection = (id: string, patch: Partial<FormSection>) =>
        onChange({ ...draft, sections: draft.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)) });

    /** Keep `fields` in render order so moves are simple index swaps. */
    const reorder = (list: FormField[]) => {
        const rank: Record<string, number> = {};
        draft.sections.forEach((section, index) => { rank[section.id] = index; });
        return list.map((field, index) => ({ field, index }))
            .sort((a, b) => (rank[a.field.sectionId] ?? 99) - (rank[b.field.sectionId] ?? 99) || a.index - b.index)
            .map((entry) => entry.field);
    };

    const addField = (type: FormFieldType, sectionId: string) => {
        const field = newField(type, sectionId, t);
        const fields = ordered.slice();
        const lastInSection = fields.map((entry) => entry.sectionId).lastIndexOf(sectionId);
        fields.splice(lastInSection >= 0 ? lastInSection + 1 : fields.length, 0, field);
        setFields(fields);
        setSelectedId(field.id);
        setPickerFor(null);
    };

    const moveField = (field: FormField, delta: number) => {
        const fields = ordered.slice();
        const index = fields.findIndex((entry) => entry.id === field.id);
        const target = index + delta;
        if (target < 0 || target >= fields.length) return;
        const neighbour = fields[target];
        if (neighbour.sectionId !== field.sectionId) {
            // Crossing a section boundary moves the question into the neighbouring section.
            fields[index] = { ...field, sectionId: neighbour.sectionId };
            setFields(reorder(fields));
            return;
        }
        [fields[index], fields[target]] = [fields[target], fields[index]];
        setFields(fields);
    };

    const removeField = (id: string) => {
        setFields(draft.fields.filter((field) => field.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const copyField = (field: FormField) => {
        const copy = duplicateField(field);
        const fields = ordered.slice();
        fields.splice(fields.findIndex((entry) => entry.id === field.id) + 1, 0, copy);
        setFields(fields);
        setSelectedId(copy.id);
    };

    const addSection = () => {
        const section = newSection(`${t('forms.builder.section')} ${draft.sections.length + 1}`);
        onChange({ ...draft, sections: [...draft.sections, section] });
    };

    const moveSection = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= draft.sections.length) return;
        const sections = draft.sections.slice();
        [sections[index], sections[target]] = [sections[target], sections[index]];
        onChange({ sections, fields: draft.fields });
    };

    const removeSection = (index: number) => {
        if (draft.sections.length <= 1) return;
        const removed = draft.sections[index];
        const fallback = draft.sections[index === 0 ? 1 : index - 1].id;
        onChange({
            sections: draft.sections.filter((section) => section.id !== removed.id),
            fields: draft.fields.map((field) => (field.sectionId === removed.id ? { ...field, sectionId: fallback } : field))
        });
    };

    const candidatesBefore = (fieldIndex: number) => ordered.slice(0, fieldIndex).filter((field) => acceptsAnswer(field) && field.type !== 'fileUpload');

    return (
        <div className="form-questions">
            {draft.sections.map((section, sectionIndex) => {
                const sectionFields = ordered.filter((field) => field.sectionId === section.id);
                const firstIndex = ordered.findIndex((field) => field.sectionId === section.id);
                const fieldsBeforeSection = candidatesBefore(firstIndex >= 0 ? firstIndex : ordered.length);
                const sectionIssues = issuesById[section.id] || [];
                return (
                    <section key={section.id} className="form-questions__section">
                        {draft.sections.length > 1 && (
                            <header className="form-questions__section-head">
                                <span className="form-questions__section-index">{t('forms.builder.sectionN').replace('{n}', String(sectionIndex + 1))}</span>
                                <input className="form-builder__input form-builder__input--title" value={section.title || ''} maxLength={200}
                                    placeholder={t('forms.builder.sectionTitle')} onChange={(event) => patchSection(section.id, { title: event.target.value })} />
                                <input className="form-builder__input" value={section.description || ''} maxLength={1000}
                                    placeholder={t('forms.builder.sectionDescription')} onChange={(event) => patchSection(section.id, { description: event.target.value || undefined })} />
                                <div className="form-questions__section-actions">
                                    <Button variant="ghost" size="sm" icon={<span className="material-symbols-outlined">call_split</span>}
                                        onClick={() => setSectionConditionFor(sectionConditionFor === section.id ? null : section.id)}>
                                        {section.showIf?.rules?.length ? t('forms.condition.active') : t('forms.condition.title')}
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={t('forms.builder.moveUp')} disabled={sectionIndex === 0} onClick={() => moveSection(sectionIndex, -1)}>
                                        <span className="material-symbols-outlined">arrow_upward</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={t('forms.builder.moveDown')} disabled={sectionIndex === draft.sections.length - 1} onClick={() => moveSection(sectionIndex, 1)}>
                                        <span className="material-symbols-outlined">arrow_downward</span>
                                    </Button>
                                    <Button variant="ghost" size="icon" aria-label={t('forms.builder.removeSection')} title={t('forms.builder.removeSection')} onClick={() => removeSection(sectionIndex)}>
                                        <span className="material-symbols-outlined">delete</span>
                                    </Button>
                                </div>
                                {sectionConditionFor === section.id && (
                                    <div className="form-questions__section-condition">
                                        {logicAllowed
                                            ? <ConditionEditor condition={section.showIf} candidates={fieldsBeforeSection} onChange={(showIf) => patchSection(section.id, { showIf })} />
                                            : <p className="form-builder__upsell">{t('forms.plan.logic')}</p>}
                                    </div>
                                )}
                                {sectionIssues.length > 0 && <IssueChips issues={sectionIssues} />}
                            </header>
                        )}

                        <ul className="form-questions__list">
                            {sectionFields.map((field) => {
                                const index = ordered.findIndex((entry) => entry.id === field.id);
                                const selected = selectedId === field.id;
                                const fieldIssues = issuesById[field.id] || [];
                                return (
                                    <li key={field.id} className={`form-question${selected ? ' is-selected' : ''}${fieldIssues.length ? ' has-issue' : ''}`}>
                                        <div className="form-question__row">
                                            <button type="button" className="form-question__summary" aria-expanded={selected}
                                                onClick={() => setSelectedId(selected ? null : field.id)}>
                                                <span className="material-symbols-outlined form-question__icon" aria-hidden="true">{FIELD_TYPE_ICONS[field.type]}</span>
                                                <span className="form-question__label">
                                                    {field.label || t('forms.untitledQuestion')}
                                                    {field.required && <span className="form-question__required" aria-label={t('forms.builder.required')}> *</span>}
                                                </span>
                                                {field.showIf?.rules?.length ? (
                                                    <span className="material-symbols-outlined form-question__flag" title={t('forms.condition.active')}>call_split</span>
                                                ) : null}
                                                <span className="form-question__type">{t(`forms.fieldType.${field.type}.label`)}</span>
                                            </button>
                                            <div className="form-question__actions">
                                                <Button variant="ghost" size="icon" aria-label={t('forms.builder.moveUp')} disabled={index === 0} onClick={() => moveField(field, -1)}>
                                                    <span className="material-symbols-outlined">arrow_upward</span>
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={t('forms.builder.moveDown')} disabled={index === ordered.length - 1} onClick={() => moveField(field, 1)}>
                                                    <span className="material-symbols-outlined">arrow_downward</span>
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={t('forms.builder.duplicate')} title={t('forms.builder.duplicate')} onClick={() => copyField(field)}>
                                                    <span className="material-symbols-outlined">content_copy</span>
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={t('forms.builder.remove')} title={t('forms.builder.remove')} onClick={() => removeField(field.id)}>
                                                    <span className="material-symbols-outlined">delete</span>
                                                </Button>
                                            </div>
                                        </div>
                                        {fieldIssues.length > 0 && <IssueChips issues={fieldIssues} />}
                                        {selected && (
                                            <FieldEditor
                                                field={field}
                                                onChange={(patch) => patchField(field.id, patch)}
                                                conditionCandidates={candidatesBefore(index)}
                                                logicAllowed={logicAllowed}
                                                uploadsAllowed={uploadsAllowed}
                                                maxFileBytesCap={maxFileBytesCap}
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>

                        {pickerFor === section.id ? (
                            <div className="form-type-picker" role="menu" aria-label={t('forms.builder.addQuestion')}>
                                {FIELD_TYPE_ORDER.map((type) => (
                                    <button key={type} type="button" role="menuitem" className="form-type-picker__item" onClick={() => addField(type, section.id)}>
                                        <span className="material-symbols-outlined" aria-hidden="true">{FIELD_TYPE_ICONS[type]}</span>
                                        <span>{t(`forms.fieldType.${type}.label`)}</span>
                                        {type === 'fileUpload' && !uploadsAllowed && <small>{t('forms.plan.badge')}</small>}
                                    </button>
                                ))}
                                <Button variant="ghost" size="sm" onClick={() => setPickerFor(null)}>{t('common.cancel')}</Button>
                            </div>
                        ) : (
                            <button type="button" className="form-questions__add" onClick={() => setPickerFor(section.id)}>
                                <span className="material-symbols-outlined" aria-hidden="true">add</span>
                                {t('forms.builder.addQuestion')}
                            </button>
                        )}
                    </section>
                );
            })}
            <Button variant="secondary" icon={<span className="material-symbols-outlined">splitscreen_add</span>} onClick={addSection} disabled={draft.sections.length >= 20}>
                {t('forms.builder.addSection')}
            </Button>
        </div>
    );
};

const IssueChips: React.FC<{ issues: FormSchemaIssue[] }> = ({ issues }) => {
    const { t } = useLanguage();
    const codes = Array.from(new Set(issues.map((issue) => issue.code)));
    return (
        <div className="form-issues">
            {codes.map((code) => (
                <span key={code} className="form-issues__chip">
                    <span className="material-symbols-outlined" aria-hidden="true">error</span>
                    {t(`forms.issue.${code}`)}
                </span>
            ))}
        </div>
    );
};
