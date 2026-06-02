import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button } from '../components/common/Button/Button';
import { useLanguage } from '../context/LanguageContext';
import type { InitiativeFeedbackField } from '../types';
import {
    fetchPublicInitiativeFeedbackForm,
    fileToDataUrl,
    submitPublicInitiativeFeedback,
    type PublicInitiativeFeedbackAttachmentInput,
    type PublicInitiativeFeedbackForm,
} from '../services/initiativeFeedbackService';
import {
    ensureInitiativeFeedbackFields,
    feedbackFieldNeedsOptions,
    localizePublicInitiativeFeedbackCopy,
    localizePublicInitiativeFeedbackFields,
} from '../utils/initiativeFeedbackBuilder';

type SubmissionState = {
    fieldValues: Record<string, string>;
    files: File[];
};

const createInitialState = (fields: InitiativeFeedbackField[]): SubmissionState => ({
    fieldValues: Object.fromEntries(fields.map((field) => [field.id, ''])),
    files: [],
});

export const PublicInitiativeFeedbackPage = () => {
    const { token } = useParams<{ token: string }>();
    const { t, language, setLanguage } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<PublicInitiativeFeedbackForm | null>(null);
    const [state, setState] = useState<SubmissionState>(createInitialState([]));
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        const storedLanguage = localStorage.getItem('pf-language');
        if (!storedLanguage) {
            const browserLanguage = navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
            setLanguage(browserLanguage);
        }
    }, [setLanguage]);

    useEffect(() => {
        if (!token) return;

        setLoading(true);
        setError(null);
        void fetchPublicInitiativeFeedbackForm(token)
            .then((nextForm) => {
                const hydrated = {
                    ...nextForm,
                    fields: ensureInitiativeFeedbackFields(nextForm.fields),
                };
                setForm(hydrated);
                setState(createInitialState(hydrated.fields));
            })
            .catch((loadError) => {
                console.error('Failed to load public initiative feedback form', loadError);
                setError(t('initiatives.feedback.public.loadError'));
            })
            .finally(() => setLoading(false));
    }, [t, token]);

    const localizedForm = useMemo(() => {
        if (!form) return null;

        const localizedCopy = localizePublicInitiativeFeedbackCopy(form, t);
        return {
            ...localizedCopy,
            fields: localizePublicInitiativeFeedbackFields(form.fields, t),
        };
    }, [form, language, t]);

    const remainingAttachments = useMemo(() => {
        if (!form) return 0;
        return Math.max(0, form.maxAttachments - state.files.length);
    }, [form, state.files.length]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form || !token) return;

        setSubmitting(true);
        setError(null);

        try {
            const attachments: PublicInitiativeFeedbackAttachmentInput[] = [];
            for (const file of state.files.slice(0, form.maxAttachments)) {
                attachments.push({
                    fileName: file.name,
                    mimeType: file.type || 'image/png',
                    dataUrl: await fileToDataUrl(file),
                });
            }

            const result = await submitPublicInitiativeFeedback({
                token,
                fieldValues: state.fieldValues,
                source: 'public-form',
                attachments,
            });

            setSuccessMessage(result.message || localizedForm?.successMessage || form.successMessage);
            setState(createInitialState(form.fields));
        } catch (submitError) {
            console.error('Failed to submit initiative feedback', submitError);
            setError((submitError as Error).message || t('initiatives.feedback.public.submitError'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="public-initiative-feedback">
                <div className="public-initiative-feedback__shell public-initiative-feedback__shell--loading">
                    <span className="material-symbols-outlined public-initiative-feedback__spinner">progress_activity</span>
                    <p>{t('initiatives.feedback.public.loading')}</p>
                </div>
            </div>
        );
    }

    if (!form || !localizedForm) {
        return (
            <div className="public-initiative-feedback">
                <div className="public-initiative-feedback__shell public-initiative-feedback__shell--empty">
                    <span className="material-symbols-outlined">warning</span>
                    <h1>{t('initiatives.feedback.public.unavailableTitle')}</h1>
                    <p>{error || t('initiatives.feedback.public.unavailableDescription')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="public-initiative-feedback">
            <div className="public-initiative-feedback__shell">
                <div className="public-initiative-feedback__header">
                    <span className="public-initiative-feedback__eyebrow">{form.projectTitle}</span>
                    <h1>{localizedForm.title || form.initiativeTitle}</h1>
                    <p>
                        {localizedForm.description
                            || t('initiatives.feedback.public.descriptionFallback').replace('{initiative}', form.initiativeTitle)}
                    </p>
                </div>

                {successMessage ? (
                    <div className="public-initiative-feedback__success">
                        <span className="material-symbols-outlined">task_alt</span>
                        <div>
                            <h2>{t('initiatives.feedback.public.successTitle')}</h2>
                            <p>{successMessage}</p>
                        </div>
                    </div>
                ) : (
                    <form className="public-initiative-feedback__form" onSubmit={handleSubmit}>
                        <div className="public-initiative-feedback__grid">
                            {localizedForm.fields
                                .filter((field) => field.enabled !== false)
                                .map((field) => (
                                    <div
                                        key={field.id}
                                        className={`public-initiative-feedback__field ${field.width === 'full' ? 'public-initiative-feedback__field--full' : ''}`}
                                    >
                                        <label className="public-initiative-feedback__field-label" htmlFor={`feedback-field-${field.id}`}>
                                            {field.label}
                                            {field.required && <span aria-hidden="true">*</span>}
                                        </label>

                                        {field.type === 'longText' ? (
                                            <textarea
                                                id={`feedback-field-${field.id}`}
                                                className="public-initiative-feedback__preview-input public-initiative-feedback__preview-input--textarea"
                                                value={state.fieldValues[field.id] || ''}
                                                onChange={(event) => setState((current) => ({
                                                    ...current,
                                                    fieldValues: {
                                                        ...current.fieldValues,
                                                        [field.id]: event.target.value,
                                                    },
                                                }))}
                                                placeholder={field.placeholder || field.label}
                                                required={field.required === true}
                                                rows={5}
                                            />
                                        ) : feedbackFieldNeedsOptions(field.type) ? (
                                            <select
                                                id={`feedback-field-${field.id}`}
                                                className="public-initiative-feedback__native-select"
                                                value={state.fieldValues[field.id] || ''}
                                                required={field.required === true}
                                                onChange={(event) => setState((current) => ({
                                                    ...current,
                                                    fieldValues: {
                                                        ...current.fieldValues,
                                                        [field.id]: event.target.value,
                                                    },
                                                }))}
                                            >
                                                <option value="">{field.placeholder || field.label}</option>
                                                {(field.options || []).map((option) => (
                                                    <option key={option.id} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                id={`feedback-field-${field.id}`}
                                                className="public-initiative-feedback__preview-input"
                                                value={state.fieldValues[field.id] || ''}
                                                onChange={(event) => setState((current) => ({
                                                    ...current,
                                                    fieldValues: {
                                                        ...current.fieldValues,
                                                        [field.id]: event.target.value,
                                                    },
                                                }))}
                                                placeholder={field.placeholder || field.label}
                                                type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                                required={field.required === true}
                                            />
                                        )}

                                        {field.helpText && (
                                            <p className="public-initiative-feedback__field-help">{field.helpText}</p>
                                        )}
                                    </div>
                                ))}
                        </div>

                        {form.allowAttachments && (
                            <div className="public-initiative-feedback__attachments">
                                <div className="public-initiative-feedback__attachments-head">
                                    <label className="public-initiative-feedback__attachments-label" htmlFor="feedback-attachments">
                                        {t('initiatives.feedback.public.fields.attachments')}
                                    </label>
                                    <span className="public-initiative-feedback__attachments-note">
                                        {t('initiatives.feedback.public.attachmentsHint').replace('{count}', String(form.maxAttachments))}
                                    </span>
                                </div>

                                <input
                                    id="feedback-attachments"
                                    ref={fileInputRef}
                                    className="public-initiative-feedback__file-input"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(event) => {
                                        const selected = Array.from(event.target.files || []).slice(0, form.maxAttachments);
                                        setState((current) => ({ ...current, files: selected }));
                                    }}
                                />

                                <button
                                    type="button"
                                    className="public-initiative-feedback__upload-trigger"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <span className="material-symbols-outlined">upload</span>
                                    <div>
                                        <strong>{t('initiatives.feedback.public.uploadTitle')}</strong>
                                        <p>{t('initiatives.feedback.public.uploadHint')}</p>
                                    </div>
                                </button>

                                {state.files.length > 0 && (
                                    <div className="public-initiative-feedback__attachment-list">
                                        {state.files.map((file) => (
                                            <span key={`${file.name}-${file.size}`} className="public-initiative-feedback__attachment-chip">
                                                <span className="material-symbols-outlined">image</span>
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="public-initiative-feedback__error" role="alert">
                                <span className="material-symbols-outlined">error</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="public-initiative-feedback__footer">
                            <p className="public-initiative-feedback__footer-note">
                                {form.allowAttachments
                                    ? t('initiatives.feedback.public.remainingAttachments').replace('{count}', String(remainingAttachments))
                                    : t('initiatives.feedback.public.privacyNote')}
                            </p>
                            <Button variant="primary" type="submit" size="lg" isLoading={submitting}>
                                {localizedForm.submitLabel}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
