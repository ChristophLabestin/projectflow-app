import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Button } from '../components/common/Button/Button';
import { useLanguage } from '../context/LanguageContext';
import type { ProjectIntakeCategory } from '../types';
import {
    fetchPublicProjectIntakeForm,
    fileToDataUrl,
    submitPublicProjectIntake,
    type PublicProjectIntakeAttachmentInput,
    type PublicProjectIntakeForm,
} from '../services/projectIntakeService';
import {
    getIntakeCategoryIcon,
    intakeFieldNeedsOptions,
    localizeIntakeCategories,
    localizeIntakeFormCopy,
} from '../utils/projectIntakeBuilder';

type SubmitterState = { name: string; email: string; company: string };

const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const PublicProjectIntakePage = () => {
    const { token } = useParams<{ token: string }>();
    const { t, setLanguage } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState<PublicProjectIntakeForm | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
    const [submitter, setSubmitter] = useState<SubmitterState>({ name: '', email: '', company: '' });
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [files, setFiles] = useState<File[]>([]);
    const [dragActive, setDragActive] = useState(false);

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
        void fetchPublicProjectIntakeForm(token)
            .then((nextForm) => {
                setForm(nextForm);
                if (nextForm.categories.length === 1) {
                    setActiveCategoryId(nextForm.categories[0].id);
                }
            })
            .catch((loadError) => {
                console.error('Failed to load public project intake form', loadError);
                setError(t('intake.public.loadError'));
            })
            .finally(() => setLoading(false));
    }, [t, token]);

    const localizedCategories = useMemo<ProjectIntakeCategory[]>(() => {
        if (!form) return [];
        return localizeIntakeCategories(form.categories, t);
    }, [form, t]);

    const localizedCopy = useMemo(() => {
        if (!form) return { title: '', submitLabel: '', successMessage: '' };
        return localizeIntakeFormCopy(form, t);
    }, [form, t]);

    const activeCategory = useMemo(
        () => localizedCategories.find((category) => category.id === activeCategoryId) || null,
        [localizedCategories, activeCategoryId],
    );

    const singleCategory = (form?.categories.length || 0) <= 1;
    const step = successMessage ? 3 : activeCategory ? 2 : 1;

    const remainingAttachments = useMemo(() => {
        if (!form) return 0;
        return Math.max(0, form.maxAttachments - files.length);
    }, [form, files.length]);

    const resetForm = () => {
        setActiveCategoryId(singleCategory && form ? form.categories[0].id : null);
        setSubmitter({ name: '', email: '', company: '' });
        setFieldValues({});
        setFiles([]);
    };

    const handleSelectCategory = (categoryId: string) => {
        setActiveCategoryId(categoryId);
        setFieldValues({});
        setFiles([]);
        setError(null);
    };

    const addFiles = (incoming: FileList | File[]) => {
        if (!form) return;
        setFiles((current) => [...current, ...Array.from(incoming)].slice(0, form.maxAttachments));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form || !token || !activeCategory) return;

        setSubmitting(true);
        setError(null);

        try {
            const attachments: PublicProjectIntakeAttachmentInput[] = [];
            for (const file of files.slice(0, form.maxAttachments)) {
                attachments.push({
                    fileName: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    dataUrl: await fileToDataUrl(file),
                });
            }

            const result = await submitPublicProjectIntake({
                token,
                categoryId: activeCategory.id,
                customerName: submitter.name,
                customerEmail: submitter.email,
                company: submitter.company,
                fieldValues,
                attachments,
            });

            setSuccessMessage(localizedCopy.successMessage || result.message || form.successMessage);
            resetForm();
        } catch (submitError) {
            console.error('Failed to submit project intake', submitError);
            setError((submitError as Error).message || t('intake.public.submitError'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="pintake">
                <div className="pintake__card pintake__card--status">
                    <span className="material-symbols-outlined pintake__spinner">progress_activity</span>
                    <p>{t('intake.public.loading')}</p>
                </div>
            </div>
        );
    }

    if (!form) {
        return (
            <div className="pintake">
                <div className="pintake__card pintake__card--status">
                    <span className="pintake__status-icon"><span className="material-symbols-outlined">link_off</span></span>
                    <h1>{t('intake.public.unavailableTitle')}</h1>
                    <p>{error || t('intake.public.unavailableDescription')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pintake">
            <div className="pintake__card">
                <header className="pintake__head">
                    <span className="pintake__eyebrow">
                        <span className="material-symbols-outlined">workspaces</span>
                        {form.projectTitle}
                    </span>
                    <h1>{localizedCopy.title || form.title}</h1>
                    {form.description && <p>{form.description}</p>}
                </header>

                {!successMessage && !singleCategory && (
                    <ol className="pintake__steps" aria-hidden="true">
                        <li className={`pintake__step ${step >= 1 ? 'is-active' : ''} ${step > 1 ? 'is-done' : ''}`}>
                            <span className="pintake__step-dot">{step > 1 ? <span className="material-symbols-outlined">check</span> : '1'}</span>
                            {t('intake.public.stepType')}
                        </li>
                        <li className="pintake__step-line" />
                        <li className={`pintake__step ${step >= 2 ? 'is-active' : ''}`}>
                            <span className="pintake__step-dot">2</span>
                            {t('intake.public.stepDetails')}
                        </li>
                    </ol>
                )}

                {successMessage ? (
                    <div className="pintake__success">
                        <span className="pintake__success-icon"><span className="material-symbols-outlined">check</span></span>
                        <h2>{t('intake.public.successTitle')}</h2>
                        <p>{successMessage}</p>
                        <Button variant="secondary" onClick={() => setSuccessMessage(null)}>
                            {t('intake.public.submitAnother')}
                        </Button>
                    </div>
                ) : !activeCategory ? (
                    <div className="pintake__chooser">
                        <p className="pintake__section-hint">{t('intake.public.chooseHint')}</p>
                        <div className="pintake__cards">
                            {localizedCategories.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    className="pintake__choice"
                                    onClick={() => handleSelectCategory(category.id)}
                                >
                                    <span className="pintake__choice-icon">
                                        <span className="material-symbols-outlined">{getIntakeCategoryIcon(category.id, category.icon)}</span>
                                    </span>
                                    <span className="pintake__choice-body">
                                        <strong>{category.label}</strong>
                                        {category.description && <span>{category.description}</span>}
                                    </span>
                                    <span className="material-symbols-outlined pintake__choice-arrow">arrow_forward</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <form className="pintake__form" onSubmit={handleSubmit}>
                        <div className="pintake__active">
                            {!singleCategory && (
                                <button type="button" className="pintake__back" onClick={() => setActiveCategoryId(null)}>
                                    <span className="material-symbols-outlined">arrow_back</span>
                                    {t('intake.public.back')}
                                </button>
                            )}
                            <span className="pintake__active-chip">
                                <span className="material-symbols-outlined">{getIntakeCategoryIcon(activeCategory.id, activeCategory.icon)}</span>
                                {activeCategory.label}
                            </span>
                        </div>

                        {/* Honeypot */}
                        <input
                            type="text"
                            name="website"
                            tabIndex={-1}
                            autoComplete="off"
                            className="pintake__honeypot"
                            value=""
                            onChange={() => undefined}
                            aria-hidden="true"
                        />

                        <fieldset className="pintake__fieldset">
                            <legend>{t('intake.public.aboutYou')}</legend>
                            <div className="pintake__grid">
                                <div className="pintake__field">
                                    <label htmlFor="intake-name">{t('intake.public.fields.name')}</label>
                                    <input
                                        id="intake-name"
                                        className="pintake__input"
                                        value={submitter.name}
                                        onChange={(event) => setSubmitter((current) => ({ ...current, name: event.target.value }))}
                                        placeholder={t('intake.public.fields.namePlaceholder')}
                                    />
                                </div>
                                <div className="pintake__field">
                                    <label htmlFor="intake-email">{t('intake.public.fields.email')}</label>
                                    <input
                                        id="intake-email"
                                        type="email"
                                        className="pintake__input"
                                        value={submitter.email}
                                        onChange={(event) => setSubmitter((current) => ({ ...current, email: event.target.value }))}
                                        placeholder={t('intake.public.fields.emailPlaceholder')}
                                    />
                                </div>
                                <div className="pintake__field pintake__field--full">
                                    <label htmlFor="intake-company">{t('intake.public.fields.company')}</label>
                                    <input
                                        id="intake-company"
                                        className="pintake__input"
                                        value={submitter.company}
                                        onChange={(event) => setSubmitter((current) => ({ ...current, company: event.target.value }))}
                                        placeholder={t('intake.public.fields.companyPlaceholder')}
                                    />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="pintake__fieldset">
                            <legend>{activeCategory.label}</legend>
                            <div className="pintake__grid">
                                {activeCategory.fields
                                    .filter((field) => field.enabled !== false)
                                    .map((field) => (
                                        <div
                                            key={field.id}
                                            className={`pintake__field ${field.width === 'full' ? 'pintake__field--full' : ''}`}
                                        >
                                            <label htmlFor={`intake-field-${field.id}`}>
                                                {field.label}
                                                {field.required && <span className="pintake__req" aria-hidden="true">*</span>}
                                            </label>

                                            {field.type === 'longText' ? (
                                                <textarea
                                                    id={`intake-field-${field.id}`}
                                                    className="pintake__input pintake__input--textarea"
                                                    value={fieldValues[field.id] || ''}
                                                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                                                    placeholder={field.placeholder || field.label}
                                                    required={field.required === true}
                                                    rows={5}
                                                />
                                            ) : intakeFieldNeedsOptions(field.type) ? (
                                                <div className="pintake__select-wrap">
                                                    <select
                                                        id={`intake-field-${field.id}`}
                                                        className="pintake__input pintake__select"
                                                        value={fieldValues[field.id] || ''}
                                                        required={field.required === true}
                                                        onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                                                    >
                                                        <option value="">{field.placeholder || field.label}</option>
                                                        {(field.options || []).map((option) => (
                                                            <option key={option.id} value={option.value}>{option.label}</option>
                                                        ))}
                                                    </select>
                                                    <span className="material-symbols-outlined pintake__select-caret">expand_more</span>
                                                </div>
                                            ) : (
                                                <input
                                                    id={`intake-field-${field.id}`}
                                                    className="pintake__input"
                                                    value={fieldValues[field.id] || ''}
                                                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))}
                                                    placeholder={field.placeholder || field.label}
                                                    type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                                                    required={field.required === true}
                                                />
                                            )}

                                            {field.helpText && <p className="pintake__help">{field.helpText}</p>}
                                        </div>
                                    ))}
                            </div>
                        </fieldset>

                        {form.allowAttachments && (
                            <fieldset className="pintake__fieldset">
                                <legend>{t('intake.public.fields.attachments')}</legend>
                                <div
                                    className={`pintake__dropzone ${dragActive ? 'is-drag' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                                    onDragLeave={() => setDragActive(false)}
                                    onDrop={(event) => { event.preventDefault(); setDragActive(false); addFiles(event.dataTransfer.files); }}
                                    role="button"
                                    tabIndex={0}
                                >
                                    <span className="material-symbols-outlined">cloud_upload</span>
                                    <strong>{t('intake.public.uploadTitle')}</strong>
                                    <span className="pintake__dropzone-hint">
                                        {t('intake.public.attachmentsHint').replace('{count}', String(form.maxAttachments))}
                                    </span>
                                    <input
                                        ref={fileInputRef}
                                        className="pintake__file-input"
                                        type="file"
                                        multiple
                                        onChange={(event) => { addFiles(event.target.files || []); event.target.value = ''; }}
                                    />
                                </div>

                                {files.length > 0 && (
                                    <ul className="pintake__files">
                                        {files.map((file, index) => (
                                            <li key={`${file.name}-${index}`} className="pintake__file">
                                                <span className="material-symbols-outlined">
                                                    {file.type.startsWith('image/') ? 'image' : 'description'}
                                                </span>
                                                <span className="pintake__file-name">{file.name}</span>
                                                <span className="pintake__file-size">{formatBytes(file.size)}</span>
                                                <button
                                                    type="button"
                                                    className="pintake__file-remove"
                                                    onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                                                    aria-label={t('intake.public.removeFile')}
                                                >
                                                    <span className="material-symbols-outlined">close</span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </fieldset>
                        )}

                        {error && (
                            <div className="pintake__error" role="alert">
                                <span className="material-symbols-outlined">error</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="pintake__footer">
                            <p className="pintake__footer-note">
                                <span className="material-symbols-outlined">lock</span>
                                {form.allowAttachments
                                    ? t('intake.public.remainingAttachments').replace('{count}', String(remainingAttachments))
                                    : t('intake.public.privacyNote')}
                            </p>
                            <Button variant="primary" type="submit" size="lg" isLoading={submitting}>
                                {localizedCopy.submitLabel || form.submitLabel}
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            <p className="pintake__brandline">
                <span className="material-symbols-outlined">bolt</span>
                {t('intake.public.poweredBy')}
            </p>
        </div>
    );
};
