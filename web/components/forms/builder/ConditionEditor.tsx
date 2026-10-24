import React from 'react';

import { Button } from '../../common/Button/Button';
import { Select } from '../../common/Select/Select';
import { useLanguage } from '../../../context/LanguageContext';
import { isChoiceField, type FormCondition, type FormConditionOp, type FormField } from '../../../utils/formsLogic';

/** Operators that make sense per field type (forms-logic evaluates exactly these). */
const opsFor = (field: FormField | undefined): FormConditionOp[] => {
    if (!field) return ['answered', 'notAnswered'];
    if (isChoiceField(field)) return field.type === 'multipleChoice' ? ['contains', 'notEquals', 'answered', 'notAnswered'] : ['equals', 'notEquals', 'answered', 'notAnswered'];
    if (field.type === 'consent') return ['equals', 'notEquals'];
    if (['number', 'rating', 'scale', 'date'].includes(field.type)) return ['equals', 'notEquals', 'gt', 'lt', 'answered', 'notAnswered'];
    return ['equals', 'notEquals', 'contains', 'answered', 'notAnswered'];
};

const needsValue = (op: FormConditionOp) => op !== 'answered' && op !== 'notAnswered';

interface ConditionEditorProps {
    condition: FormCondition | null | undefined;
    /** Fields this condition may read: earlier fields that take an answer (no statements or uploads). */
    candidates: FormField[];
    onChange: (condition: FormCondition | null) => void;
}

/** "Show only if …" rules (one level, all/any) on a field or section. */
export const ConditionEditor: React.FC<ConditionEditorProps> = ({ condition, candidates, onChange }) => {
    const { t } = useLanguage();
    const rules = condition?.rules || [];
    const mode = condition?.mode || 'all';

    if (!candidates.length) return <p className="form-builder__muted">{t('forms.condition.noCandidates')}</p>;

    const update = (nextRules: FormCondition['rules'], nextMode = mode) => onChange(nextRules.length ? { mode: nextMode, rules: nextRules } : null);
    const addRule = () => {
        const field = candidates[candidates.length - 1];
        const op = opsFor(field)[0];
        update([...rules, { fieldId: field.id, op, value: isChoiceField(field) ? field.options?.[0]?.id : field.type === 'consent' ? true : '' }]);
    };

    return (
        <div className="form-condition">
            {rules.length > 1 && (
                <div className="form-condition__mode">
                    <Select
                        value={mode}
                        onChange={(value) => update(rules, value as 'all' | 'any')}
                        options={[{ value: 'all', label: t('forms.condition.all') }, { value: 'any', label: t('forms.condition.any') }]}
                    />
                </div>
            )}
            {rules.map((rule, index) => {
                const field = candidates.find((entry) => entry.id === rule.fieldId);
                const ops = opsFor(field);
                const setRule = (patch: Partial<FormCondition['rules'][number]>) =>
                    update(rules.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
                return (
                    <div key={index} className="form-condition__rule">
                        <Select
                            value={rule.fieldId}
                            onChange={(value) => {
                                const next = candidates.find((entry) => entry.id === value);
                                setRule({ fieldId: String(value), op: opsFor(next)[0], value: next && isChoiceField(next) ? next.options?.[0]?.id : next?.type === 'consent' ? true : '' });
                            }}
                            options={candidates.map((entry) => ({ value: entry.id, label: entry.label || t('forms.untitledQuestion') }))}
                            className={field ? '' : 'has-error'}
                        />
                        <Select
                            value={rule.op}
                            onChange={(value) => setRule({ op: value as FormConditionOp })}
                            options={ops.map((op) => ({ value: op, label: t(`forms.condition.op.${op}`) }))}
                        />
                        {needsValue(rule.op) && field && (
                            isChoiceField(field) ? (
                                <Select
                                    value={String(rule.value ?? '')}
                                    onChange={(value) => setRule({ value: String(value) })}
                                    options={(field.options || []).map((option) => ({ value: option.id, label: option.label }))}
                                />
                            ) : field.type === 'consent' ? (
                                <Select
                                    value={rule.value === true || rule.value === 'true' ? 'true' : 'false'}
                                    onChange={(value) => setRule({ value: value === 'true' })}
                                    options={[{ value: 'true', label: t('forms.condition.checked') }, { value: 'false', label: t('forms.condition.unchecked') }]}
                                />
                            ) : (
                                <input
                                    className="form-builder__input"
                                    type={['number', 'rating', 'scale'].includes(field.type) ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                    value={rule.value === null || rule.value === undefined ? '' : String(rule.value)}
                                    onChange={(event) => setRule({
                                        value: ['number', 'rating', 'scale'].includes(field.type) && event.target.value !== '' ? Number(event.target.value) : event.target.value
                                    })}
                                    aria-label={t('forms.condition.value')}
                                />
                            )
                        )}
                        <Button variant="ghost" size="icon" aria-label={t('forms.condition.removeRule')} title={t('forms.condition.removeRule')}
                            onClick={() => update(rules.filter((_, i) => i !== index))}>
                            <span className="material-symbols-outlined">close</span>
                        </Button>
                    </div>
                );
            })}
            <Button variant="ghost" size="sm" icon={<span className="material-symbols-outlined">add</span>} onClick={addRule} disabled={rules.length >= 10}>
                {rules.length ? t('forms.condition.addRule') : t('forms.condition.add')}
            </Button>
        </div>
    );
};
