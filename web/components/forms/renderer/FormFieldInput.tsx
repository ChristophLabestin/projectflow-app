import React, { useMemo, useRef, useState } from 'react';

import type { FormChrome } from '../../../locales/forms/en';
import type { FormAnswer, FormChoiceAnswer, FormField, FormFileRef } from '../../../utils/formsLogic';

export type FormUploadHandler = (field: FormField, file: File) => Promise<FormFileRef>;

interface FieldInputProps {
    field: FormField;
    value: FormAnswer | undefined;
    onChange: (value: FormAnswer | undefined) => void;
    chrome: FormChrome;
    inputId: string;
    describedBy?: string;
    invalid: boolean;
    disabled?: boolean;
    onUpload?: FormUploadHandler;
    uploadsEnabled: boolean;
}

const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const shuffled = <T,>(items: T[], seed: number) => {
    const out = items.slice();
    let state = seed || 1;
    for (let i = out.length - 1; i > 0; i -= 1) {
        state = (state * 9301 + 49297) % 233280;
        const j = Math.floor((state / 233280) * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
};

const Star: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"
            fill={filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
        />
    </svg>
);

const ChoiceInput: React.FC<FieldInputProps> = ({ field, value, onChange, chrome, inputId, disabled }) => {
    const multiple = field.type === 'multipleChoice';
    const current: FormChoiceAnswer = value && typeof value === 'object' && !Array.isArray(value) ? (value as FormChoiceAnswer) : { selected: [] };
    const [seed] = useState(() => Math.floor(Math.random() * 100000));
    const options = useMemo(() => (field.shuffle ? shuffled(field.options || [], seed) : field.options || []), [field.options, field.shuffle, seed]);
    const otherActive = typeof current.other === 'string';

    const emit = (next: FormChoiceAnswer) => {
        const empty = !next.selected.length && (next.other === undefined);
        onChange(empty ? undefined : next);
    };
    const toggle = (id: string) => {
        if (multiple) {
            const selected = current.selected.includes(id) ? current.selected.filter((entry) => entry !== id) : [...current.selected, id];
            emit({ ...current, selected });
        } else {
            emit({ selected: [id] });
        }
    };
    const toggleOther = () => {
        if (multiple) emit(otherActive ? { selected: current.selected } : { ...current, other: '' });
        else emit(otherActive ? { selected: [] } : { selected: [], other: '' });
    };

    return (
        <div className="pf-form__choices" role={multiple ? 'group' : 'radiogroup'} aria-labelledby={`${inputId}-label`}>
            {options.map((option) => {
                const checked = current.selected.includes(option.id);
                return (
                    <label key={option.id} className={`pf-form__choice${checked ? ' is-checked' : ''}`}>
                        <input
                            type={multiple ? 'checkbox' : 'radio'}
                            name={inputId}
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(option.id)}
                        />
                        <span className={`pf-form__mark pf-form__mark--${multiple ? 'box' : 'dot'}`} aria-hidden="true" />
                        <span>{option.label}</span>
                    </label>
                );
            })}
            {field.allowOther && (
                <div className={`pf-form__choice pf-form__choice--other${otherActive ? ' is-checked' : ''}`}>
                    <label className="pf-form__choice-other-toggle">
                        <input type={multiple ? 'checkbox' : 'radio'} name={inputId} checked={otherActive} disabled={disabled} onChange={toggleOther} />
                        <span className={`pf-form__mark pf-form__mark--${multiple ? 'box' : 'dot'}`} aria-hidden="true" />
                        <span>{chrome.other}</span>
                    </label>
                    {otherActive && (
                        <input
                            className="pf-form__input pf-form__input--inline"
                            value={current.other || ''}
                            maxLength={500}
                            placeholder={chrome.otherPlaceholder}
                            disabled={disabled}
                            onChange={(event) => emit({ ...current, other: event.target.value })}
                            autoFocus
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const FileInput: React.FC<FieldInputProps> = ({ field, value, onChange, chrome, inputId, disabled, onUpload, uploadsEnabled }) => {
    const files = Array.isArray(value) ? (value as FormFileRef[]) : [];
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const pickerRef = useRef<HTMLInputElement>(null);
    const maxFiles = field.maxFiles || 1;

    if (!uploadsEnabled || !onUpload) return <p className="pf-form__hint">{chrome.uploadDisabled}</p>;

    const pick = async (list: FileList | null) => {
        if (!list || !list.length) return;
        setFailed(false);
        setBusy(true);
        const next = files.slice();
        try {
            for (const file of Array.from(list).slice(0, Math.max(0, maxFiles - files.length))) {
                next.push(await onUpload(field, file));
            }
        } catch {
            setFailed(true);
        } finally {
            setBusy(false);
            onChange(next.length ? next : undefined);
            if (pickerRef.current) pickerRef.current.value = '';
        }
    };

    return (
        <div className="pf-form__files">
            {files.map((file) => (
                <div key={file.fileId} className="pf-form__file">
                    <span className="pf-form__file-name">{file.name}</span>
                    <span className="pf-form__file-size">{formatBytes(file.size)}</span>
                    <button
                        type="button"
                        className="pf-form__link-button"
                        disabled={disabled}
                        onClick={() => {
                            const rest = files.filter((entry) => entry.fileId !== file.fileId);
                            onChange(rest.length ? rest : undefined);
                        }}
                    >
                        {chrome.uploadRemove}
                    </button>
                </div>
            ))}
            {files.length < maxFiles && (
                <label className={`pf-form__dropzone${busy ? ' is-busy' : ''}`}>
                    <input
                        ref={pickerRef}
                        id={inputId}
                        type="file"
                        multiple={maxFiles - files.length > 1}
                        disabled={disabled || busy}
                        onChange={(event) => void pick(event.target.files)}
                    />
                    <span>{busy ? chrome.uploading : chrome.uploadAdd}</span>
                </label>
            )}
            {field.maxFileBytes ? (
                <p className="pf-form__hint">
                    {chrome.uploadHint.replace('{count}', String(maxFiles)).replace('{size}', formatBytes(field.maxFileBytes))}
                </p>
            ) : null}
            {failed && <p className="pf-form__error">{chrome.uploadFailed}</p>}
        </div>
    );
};

/** One answer control per field type. Styling comes only from the form theme (`--form-*`). */
export const FormFieldInput: React.FC<FieldInputProps> = (props) => {
    const { field, value, onChange, chrome, inputId, describedBy, invalid, disabled } = props;
    const common = {
        id: inputId,
        'aria-describedby': describedBy,
        'aria-invalid': invalid || undefined,
        'aria-required': field.required || undefined,
        disabled
    };
    const text = typeof value === 'string' ? value : '';

    switch (field.type) {
        case 'shortText':
        case 'email':
        case 'phone':
            return (
                <input
                    {...common}
                    className="pf-form__input"
                    type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                    autoComplete={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : undefined}
                    value={text}
                    maxLength={field.type === 'shortText' ? field.maxLength || 500 : 254}
                    placeholder={field.placeholder || chrome.textPlaceholder}
                    onChange={(event) => onChange(event.target.value || undefined)}
                />
            );
        case 'longText':
            return (
                <textarea
                    {...common}
                    className="pf-form__input pf-form__input--area"
                    value={text}
                    rows={4}
                    maxLength={field.maxLength || 5000}
                    placeholder={field.placeholder || chrome.textPlaceholder}
                    onChange={(event) => onChange(event.target.value || undefined)}
                />
            );
        case 'number':
            return (
                <div className="pf-form__number">
                    <input
                        {...common}
                        className="pf-form__input"
                        type="number"
                        inputMode="decimal"
                        min={typeof field.min === 'number' ? field.min : undefined}
                        max={typeof field.max === 'number' ? field.max : undefined}
                        step={field.decimals ? Math.pow(10, -field.decimals) : 1}
                        value={typeof value === 'number' ? value : ''}
                        placeholder={field.placeholder}
                        onChange={(event) => {
                            const parsed = event.target.value === '' ? undefined : Number(event.target.value);
                            onChange(parsed === undefined || Number.isNaN(parsed) ? undefined : parsed);
                        }}
                    />
                    {field.unit && <span className="pf-form__unit">{field.unit}</span>}
                </div>
            );
        case 'date':
            return (
                <input
                    {...common}
                    className="pf-form__input pf-form__input--date"
                    type={field.withTime ? 'datetime-local' : 'date'}
                    min={typeof field.min === 'string' ? (field.withTime ? `${field.min}T00:00` : field.min) : undefined}
                    max={typeof field.max === 'string' ? (field.withTime ? `${field.max}T23:59` : field.max) : undefined}
                    value={text}
                    onChange={(event) => onChange(event.target.value ? event.target.value.slice(0, field.withTime ? 16 : 10) : undefined)}
                />
            );
        case 'singleChoice':
        case 'multipleChoice':
            return <ChoiceInput {...props} />;
        case 'dropdown': {
            const selected = value && typeof value === 'object' && !Array.isArray(value) ? (value as FormChoiceAnswer).selected[0] || '' : '';
            return (
                <select
                    {...common}
                    className="pf-form__input pf-form__select"
                    value={selected}
                    onChange={(event) => onChange(event.target.value ? { selected: [event.target.value] } : undefined)}
                >
                    <option value="">{chrome.selectPlaceholder}</option>
                    {(field.options || []).map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                </select>
            );
        }
        case 'rating': {
            const max = field.ratingMax || 5;
            const current = typeof value === 'number' ? value : 0;
            return (
                <div className="pf-form__rating" role="radiogroup" aria-labelledby={`${inputId}-label`}>
                    {Array.from({ length: max }, (_, index) => index + 1).map((n) => (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={current === n}
                            aria-label={chrome.ratingLabel.replace('{n}', String(n)).replace('{max}', String(max))}
                            className={`pf-form__star${n <= current ? ' is-on' : ''}`}
                            disabled={disabled}
                            onClick={() => onChange(current === n ? undefined : n)}
                        >
                            <Star filled={n <= current} />
                        </button>
                    ))}
                </div>
            );
        }
        case 'scale': {
            const min = typeof field.scaleMin === 'number' ? field.scaleMin : 1;
            const max = typeof field.scaleMax === 'number' ? field.scaleMax : 5;
            const current = typeof value === 'number' ? value : null;
            return (
                <div className="pf-form__scale">
                    <div className="pf-form__scale-row" role="radiogroup" aria-labelledby={`${inputId}-label`}>
                        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((n) => (
                            <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={current === n}
                                className={`pf-form__scale-step${current === n ? ' is-on' : ''}`}
                                disabled={disabled}
                                onClick={() => onChange(current === n ? undefined : n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                    {(field.minLabel || field.maxLabel) && (
                        <div className="pf-form__scale-labels">
                            <span>{field.minLabel}</span>
                            <span>{field.maxLabel}</span>
                        </div>
                    )}
                </div>
            );
        }
        case 'consent':
            return (
                <label className={`pf-form__choice pf-form__choice--consent${value === true ? ' is-checked' : ''}`}>
                    <input {...common} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked ? true : undefined)} />
                    <span className="pf-form__mark pf-form__mark--box" aria-hidden="true" />
                    <span>
                        {field.label}
                        {field.required && <span className="pf-form__required" aria-hidden="true"> *</span>}
                        {field.consentUrl && /^https:\/\//.test(field.consentUrl) && (
                            <>
                                {' '}
                                <a href={field.consentUrl} target="_blank" rel="noopener noreferrer">{chrome.consentMore}</a>
                            </>
                        )}
                    </span>
                </label>
            );
        case 'fileUpload':
            return <FileInput {...props} />;
        default:
            return null;
    }
};
