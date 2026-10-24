import React from 'react';

import { Button } from '../../common/Button/Button';
import { Checkbox } from '../../common/Checkbox/Checkbox';
import { Select } from '../../common/Select/Select';
import { SettingsSwitch } from '../../settings/SettingsSwitch';
import { useLanguage } from '../../../context/LanguageContext';
import { FORM_FILE_KINDS, isChoiceField, type FormField, type FormFileKind } from '../../../utils/formsLogic';
import { ConditionEditor } from './ConditionEditor';
import { newFormId } from './formFactory';

interface FieldEditorProps {
    field: FormField;
    onChange: (patch: Partial<FormField>) => void;
    /** Earlier answerable fields (for "show only if"). */
    conditionCandidates: FormField[];
    logicAllowed: boolean;
    uploadsAllowed: boolean;
    /** Plan cap for one file (entitlement maxFileBytes or 25 MB). */
    maxFileBytesCap: number;
}

const numberOrUndefined = (value: string) => (value === '' || Number.isNaN(Number(value)) ? undefined : Number(value));

/** Inline settings of the selected question (brain/reference/app/STYLING.md §6.2: one item expanded at a time). */
export const FieldEditor: React.FC<FieldEditorProps> = ({ field, onChange, conditionCandidates, logicAllowed, uploadsAllowed, maxFileBytesCap }) => {
    const { t } = useLanguage();
    const options = field.options || [];

    const setOption = (index: number, label: string) => onChange({ options: options.map((option, i) => (i === index ? { ...option, label } : option)) });
    const moveOption = (index: number, delta: number) => {
        const target = index + delta;
        if (target < 0 || target >= options.length) return;
        const next = options.slice();
        [next[index], next[target]] = [next[target], next[index]];
        onChange({ options: next });
    };

    return (
        <div className="form-field-editor">
            <label className="form-builder__field">
                <span>{field.type === 'statement' ? t('forms.builder.statementText') : field.type === 'consent' ? t('forms.builder.consentText') : t('forms.builder.question')}</span>
                <textarea
                    className="form-builder__input form-builder__input--area"
                    rows={2}
                    maxLength={300}
                    value={field.label}
                    onChange={(event) => onChange({ label: event.target.value })}
                    autoFocus={!field.label}
                />
            </label>
            <label className="form-builder__field">
                <span>{t('forms.builder.help')}</span>
                <input className="form-builder__input" maxLength={1000} value={field.help || ''} onChange={(event) => onChange({ help: event.target.value || undefined })} />
            </label>

            {(field.type === 'shortText' || field.type === 'longText') && (
                <div className="form-builder__grid">
                    <label className="form-builder__field">
                        <span>{t('forms.builder.placeholder')}</span>
                        <input className="form-builder__input" maxLength={200} value={field.placeholder || ''} onChange={(event) => onChange({ placeholder: event.target.value || undefined })} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.builder.maxLength')}</span>
                        <input className="form-builder__input" type="number" min={1} max={field.type === 'shortText' ? 500 : 5000}
                            value={field.maxLength ?? ''} onChange={(event) => onChange({ maxLength: numberOrUndefined(event.target.value) })} />
                    </label>
                </div>
            )}

            {isChoiceField(field) && (
                <div className="form-builder__options">
                    <span className="form-builder__label">{t('forms.builder.options')}</span>
                    {options.map((option, index) => (
                        <div key={option.id} className="form-builder__option">
                            <span className={`form-builder__option-mark form-builder__option-mark--${field.type === 'multipleChoice' ? 'box' : 'dot'}`} aria-hidden="true" />
                            <input className="form-builder__input" value={option.label} maxLength={200}
                                aria-label={`${t('forms.builder.option')} ${index + 1}`}
                                onChange={(event) => setOption(index, event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        const next = options.slice();
                                        next.splice(index + 1, 0, { id: newFormId('o'), label: '' });
                                        onChange({ options: next });
                                    }
                                }} />
                            <Button variant="ghost" size="icon" aria-label={t('forms.builder.moveUp')} disabled={index === 0} onClick={() => moveOption(index, -1)}>
                                <span className="material-symbols-outlined">arrow_upward</span>
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={t('forms.builder.removeOption')} disabled={options.length <= 1}
                                onClick={() => onChange({ options: options.filter((_, i) => i !== index) })}>
                                <span className="material-symbols-outlined">close</span>
                            </Button>
                        </div>
                    ))}
                    <Button variant="ghost" size="sm" icon={<span className="material-symbols-outlined">add</span>} disabled={options.length >= 50}
                        onClick={() => onChange({ options: [...options, { id: newFormId('o'), label: `${t('forms.builder.option')} ${options.length + 1}` }] })}>
                        {t('forms.builder.addOption')}
                    </Button>
                    <div className="form-builder__toggles">
                        {field.type !== 'dropdown' && (
                            <Checkbox label={t('forms.builder.allowOther')} checked={!!field.allowOther} onChange={(event) => onChange({ allowOther: event.target.checked })} />
                        )}
                        <Checkbox label={t('forms.builder.shuffle')} checked={!!field.shuffle} onChange={(event) => onChange({ shuffle: event.target.checked })} />
                    </div>
                    {field.type === 'multipleChoice' && (
                        <div className="form-builder__grid">
                            <label className="form-builder__field">
                                <span>{t('forms.builder.minSelect')}</span>
                                <input className="form-builder__input" type="number" min={0} max={options.length} value={field.minSelect ?? ''}
                                    onChange={(event) => onChange({ minSelect: numberOrUndefined(event.target.value) })} />
                            </label>
                            <label className="form-builder__field">
                                <span>{t('forms.builder.maxSelect')}</span>
                                <input className="form-builder__input" type="number" min={1} max={options.length} value={field.maxSelect ?? ''}
                                    onChange={(event) => onChange({ maxSelect: numberOrUndefined(event.target.value) })} />
                            </label>
                        </div>
                    )}
                </div>
            )}

            {field.type === 'number' && (
                <div className="form-builder__grid form-builder__grid--4">
                    {(['min', 'max', 'decimals'] as const).map((key) => (
                        <label key={key} className="form-builder__field">
                            <span>{t(`forms.builder.${key}`)}</span>
                            <input className="form-builder__input" type="number" value={(field[key] as number | undefined) ?? ''}
                                min={key === 'decimals' ? 0 : undefined} max={key === 'decimals' ? 6 : undefined}
                                onChange={(event) => onChange({ [key]: numberOrUndefined(event.target.value) })} />
                        </label>
                    ))}
                    <label className="form-builder__field">
                        <span>{t('forms.builder.unit')}</span>
                        <input className="form-builder__input" maxLength={20} value={field.unit || ''} onChange={(event) => onChange({ unit: event.target.value || undefined })} />
                    </label>
                </div>
            )}

            {field.type === 'rating' && (
                <label className="form-builder__field form-builder__field--narrow">
                    <span>{t('forms.builder.ratingMax')}</span>
                    <Select value={field.ratingMax || 5} onChange={(value) => onChange({ ratingMax: Number(value) })}
                        options={[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: String(n) }))} />
                </label>
            )}

            {field.type === 'scale' && (
                <div className="form-builder__grid form-builder__grid--4">
                    <label className="form-builder__field">
                        <span>{t('forms.builder.scaleFrom')}</span>
                        <Select value={field.scaleMin ?? 1} onChange={(value) => onChange({ scaleMin: Number(value) })}
                            options={[0, 1].map((n) => ({ value: n, label: String(n) }))} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.builder.scaleTo')}</span>
                        <Select value={field.scaleMax ?? 5} onChange={(value) => onChange({ scaleMax: Number(value) })}
                            options={[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, label: String(n) }))} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.builder.minLabel')}</span>
                        <input className="form-builder__input" maxLength={60} value={field.minLabel || ''} onChange={(event) => onChange({ minLabel: event.target.value || undefined })} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.builder.maxLabel')}</span>
                        <input className="form-builder__input" maxLength={60} value={field.maxLabel || ''} onChange={(event) => onChange({ maxLabel: event.target.value || undefined })} />
                    </label>
                </div>
            )}

            {field.type === 'date' && (
                <div className="form-builder__grid">
                    <label className="form-builder__field">
                        <span>{t('forms.builder.earliest')}</span>
                        <input className="form-builder__input" type="date" value={typeof field.min === 'string' ? field.min : ''} onChange={(event) => onChange({ min: event.target.value || undefined })} />
                    </label>
                    <label className="form-builder__field">
                        <span>{t('forms.builder.latest')}</span>
                        <input className="form-builder__input" type="date" value={typeof field.max === 'string' ? field.max : ''} onChange={(event) => onChange({ max: event.target.value || undefined })} />
                    </label>
                    <Checkbox label={t('forms.builder.withTime')} checked={!!field.withTime} onChange={(event) => onChange({ withTime: event.target.checked })} />
                </div>
            )}

            {field.type === 'fileUpload' && (
                <div className="form-builder__options">
                    {!uploadsAllowed && <p className="form-builder__upsell">{t('forms.plan.uploads')}</p>}
                    <div className="form-builder__grid">
                        <label className="form-builder__field">
                            <span>{t('forms.builder.maxFiles')}</span>
                            <Select value={field.maxFiles || 1} onChange={(value) => onChange({ maxFiles: Number(value) })}
                                options={Array.from({ length: 10 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))} />
                        </label>
                        <label className="form-builder__field">
                            <span>{t('forms.builder.maxFileMb')}</span>
                            <input className="form-builder__input" type="number" min={1} max={Math.floor(maxFileBytesCap / (1024 * 1024))}
                                value={field.maxFileBytes ? Math.round(field.maxFileBytes / (1024 * 1024)) : ''}
                                onChange={(event) => {
                                    const mb = numberOrUndefined(event.target.value);
                                    onChange({ maxFileBytes: mb ? Math.min(mb * 1024 * 1024, maxFileBytesCap) : undefined });
                                }} />
                        </label>
                    </div>
                    <span className="form-builder__label">{t('forms.builder.fileKinds')}</span>
                    <div className="form-builder__toggles">
                        {FORM_FILE_KINDS.map((kind) => {
                            const kinds = field.fileKinds || [];
                            return (
                                <Checkbox key={kind} label={t(`forms.fileKind.${kind}`)} checked={kinds.includes(kind)}
                                    onChange={(event) => onChange({
                                        fileKinds: (event.target.checked ? [...kinds, kind] : kinds.filter((entry) => entry !== kind)) as FormFileKind[]
                                    })} />
                            );
                        })}
                    </div>
                </div>
            )}

            {field.type === 'consent' && (
                <label className="form-builder__field">
                    <span>{t('forms.builder.consentUrl')}</span>
                    <input className="form-builder__input" type="url" placeholder="https://" maxLength={500} value={field.consentUrl || ''}
                        onChange={(event) => onChange({ consentUrl: event.target.value || undefined })} />
                </label>
            )}

            {field.type === 'email' && (
                <Checkbox label={t('forms.builder.respondentEmail')} checked={!!field.isRespondentEmail}
                    onChange={(event) => onChange({ isRespondentEmail: event.target.checked })} />
            )}

            {field.type !== 'statement' && (
                <div className="form-builder__switch-row">
                    <span>{t('forms.builder.required')}</span>
                    <SettingsSwitch checked={!!field.required} onChange={(required) => onChange({ required })} label={t('forms.builder.required')} />
                </div>
            )}

            <div className="form-builder__condition">
                <span className="form-builder__label">{t('forms.condition.title')}</span>
                {logicAllowed ? (
                    <ConditionEditor condition={field.showIf} candidates={conditionCandidates} onChange={(showIf) => onChange({ showIf })} />
                ) : (
                    <p className="form-builder__upsell">{t('forms.plan.logic')}</p>
                )}
            </div>
        </div>
    );
};
