import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button } from '../components/common/Button/Button';
import { TextArea } from '../components/common/Input/TextArea';
import { TextInput } from '../components/common/Input/TextInput';
import { useLanguage } from '../context/LanguageContext';
import type { InitiativeFeedbackField } from '../types';
import {
    fetchPublicInitiativeFeedbackForm,
    fileToDataUrl,
    submitPublicInitiativeFeedback,
    type PublicInitiativeFeedbackAttachmentInput,
    type PublicInitiativeFeedbackForm,
} from '../services/initiativeFeedbackService';
import { ensureInitiativeFeedbackFields, feedbackFieldNeedsOptions } from '../utils/initiativeFeedbackBuilder';
import './public-initiative-feedback.scss';

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
    const { t } = useLanguage();
    const [form, setForm] = useState<PublicInitiativeFeedbackForm | null>(null);
    const [state, setState] = useState<SubmissionState>(createInitialState([]));
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

            setSuccessMessage(result.message || form.successMessage);
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
                    <span className="material-symbols-outlined">progress_activity</span>
                </div>
            </div>
        );
    }

    if (!form) {
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
                    <h1>{form.title || form.initiativeTitle}</h1>
                    <p>{form.description || t('initiatives.feedback.public.descriptionFallback').replace('{initiative}', form.initiativeTitle)}</p>
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
                            {form.fields
                                .filter((field) => field.enabled !== false)
                                .map((field) => (
                                    <div
                                        key={field.id}
                                        className={`public-initiative-feedback__field ${field.width === 'full' ? 'public-initiative-feedback__field--full' : ''}`}
                                    >
                                        <label className="public-initiative-feedback__field-label">
                                            {field.label}
                                            {field.required && <span>*</span>}
                                        </label>

                                        {field.type === 'longText' ? (
                                            <TextArea
                                                value={state.fieldValues[field.id] || ''}
                                                onChange={(event) => setState((current) => ({
                                                    ...current,
                                                    fieldValues: {
                                                        ...current.fieldValues,
                                                        [field.id]: event.target.value,
                                                    },
                                                }))}
                                                placeholder={field.placeholder || field.label}
                                                rows={6}
                                            />
                                        ) : feedbackFieldNeedsOptions(field.type) ? (
                                            <select
                                                className="public-initiative-feedback__native-select"
                                                value={state.fieldValues[field.id] || ''}
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
                                            <TextInput
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
                                <label className="public-initiative-feedback__attachments-label">
                                    {t('initiatives.feedback.public.fields.attachments')}
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(event) => {
                                        const selected = Array.from(event.target.files || []).slice(0, form.maxAttachments);
                                        setState((current) => ({ ...current, files: selected }));
                                    }}
                                />
                                <span className="public-initiative-feedback__attachments-note">
                                    {t('initiatives.feedback.public.attachmentsHint').replace('{count}', String(form.maxAttachments))}
                                </span>
                                {state.files.length > 0 && (
                                    <div className="public-initiative-feedback__attachment-list">
                                        {state.files.map((file) => (
                                            <span key={`${file.name}-${file.size}`} className="public-initiative-feedback__attachment-chip">
                                                {file.name}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {error && <div className="public-initiative-feedback__error">{error}</div>}

                        <div className="public-initiative-feedback__footer">
                            <span className="public-initiative-feedback__footer-note">
                                {form.allowAttachments
                                    ? t('initiatives.feedback.public.remainingAttachments').replace('{count}', String(remainingAttachments))
                                    : t('initiatives.feedback.public.noAttachments')}
                            </span>
                            <Button variant="primary" type="submit" isLoading={submitting}>
                                {form.submitLabel}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
