import React, { useEffect, useMemo, useRef, useState } from 'react';

import { formChromeDe } from '../../../locales/forms/de';
import { formChromeEn, type FormChrome } from '../../../locales/forms/en';
import type { FormLanguage, FormTheme, TenantLegal } from '../../../types/forms';
import {
    acceptsAnswer,
    orderedFields,
    validateSubmission,
    visibleFormItems,
    type FormAnswer,
    type FormAnswerError,
    type FormAnswers,
    type FormSchema
} from '../../../utils/formsLogic';
import { formThemeStyle, loadFormFont } from '../theme/formThemes';
import { FormFieldInput, type FormUploadHandler } from './FormFieldInput';
import './form-renderer.scss';

export const formChromeFor = (language: FormLanguage | string | undefined): FormChrome =>
    language === 'de' ? formChromeDe : formChromeEn;

export interface FormSubmitOutcome {
    ok: boolean;
    confirmation?: { text?: string; redirectUrl?: string };
    fieldErrors?: FormAnswerError[];
    message?: string;
}

export interface FormRendererProps {
    title: string;
    description?: string;
    schema: FormSchema;
    theme: FormTheme;
    language: FormLanguage;
    legal?: TenantLegal | null;
    consent?: { text: string; url?: string } | null;
    hideBranding?: boolean;
    uploadsEnabled?: boolean;
    assetUrl?: (path: string) => string;
    onUpload?: FormUploadHandler;
    onSubmit: (answers: FormAnswers, durationMs: number, extras: { website: string }) => Promise<FormSubmitOutcome>;
    /** Builder preview: no redirect, submit only validates. */
    preview?: boolean;
    /** Inside an iframe: no page background padding, reports its height to the parent. */
    embedded?: boolean;
    /** Inside the app (workspace forms): no legal footer. */
    inApp?: boolean;
}

const errorText = (chrome: FormChrome, code: string) => (chrome.errors as Record<string, string>)[code] || chrome.errors.invalidType;

/**
 * Renders a published form schema in the classic layout (one page per visible section) with the full
 * form theme. Shared by the public page (/f/:token), the builder preview and in-app filling.
 */
export const FormRenderer: React.FC<FormRendererProps> = ({
    title, description, schema, theme, language, legal, consent, hideBranding, uploadsEnabled = false,
    assetUrl, onUpload, onSubmit, preview, embedded, inApp
}) => {
    const chrome = formChromeFor(language);
    const [answers, setAnswers] = useState<FormAnswers>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [page, setPage] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [banner, setBanner] = useState<string | null>(null);
    const [done, setDone] = useState<{ text?: string } | null>(null);
    const startedAt = useRef(Date.now());
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => { void loadFormFont(theme.font); }, [theme.font]);

    // Embedded: tell the parent page our height (pf-form-height), so the iframe can grow.
    useEffect(() => {
        if (!embedded || !rootRef.current || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => {
            window.parent?.postMessage({ type: 'pf-form-height', height: Math.ceil(rootRef.current?.scrollHeight || 0) }, '*');
        });
        observer.observe(rootRef.current);
        return () => observer.disconnect();
    }, [embedded]);

    const visibility = useMemo(() => visibleFormItems(schema, answers), [schema, answers]);
    const sections = useMemo(
        () => schema.sections.filter((section) => visibility.sectionIds.includes(section.id)),
        [schema.sections, visibility.sectionIds]
    );
    const ordered = useMemo(() => orderedFields(schema), [schema]);
    const pageIndex = Math.min(page, Math.max(0, sections.length - 1));
    const section = sections[pageIndex];
    const pageFields = ordered.filter((field) => field.sectionId === section?.id && visibility.fieldIds.includes(field.id));
    const isLast = pageIndex >= sections.length - 1;

    const setAnswer = (fieldId: string, value: FormAnswer | undefined) => {
        setAnswers((current) => {
            const next = { ...current };
            if (value === undefined) delete next[fieldId];
            else next[fieldId] = value;
            return next;
        });
        setErrors((current) => {
            if (!current[fieldId]) return current;
            const next = { ...current };
            delete next[fieldId];
            return next;
        });
    };

    const applyErrors = (list: FormAnswerError[], onlyFieldIds?: string[]) => {
        const relevant = onlyFieldIds ? list.filter((error) => onlyFieldIds.includes(error.fieldId)) : list;
        const map: Record<string, string> = {};
        relevant.forEach((error) => { if (!map[error.fieldId]) map[error.fieldId] = errorText(chrome, error.code); });
        setErrors(map);
        if (relevant.length) {
            const firstPage = sections.findIndex((entry) => ordered.some((field) => field.id === relevant[0].fieldId && field.sectionId === entry.id));
            if (firstPage >= 0 && firstPage !== pageIndex) setPage(firstPage);
            window.requestAnimationFrame(() => document.getElementById(`pf-field-${relevant[0].fieldId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        }
        return relevant.length;
    };

    const goNext = () => {
        const result = validateSubmission(schema, answers);
        if (applyErrors(result.errors, pageFields.map((field) => field.id))) return;
        setBanner(null);
        setPage(pageIndex + 1);
        rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        const website = ((event.currentTarget as HTMLFormElement).elements.namedItem('website') as HTMLInputElement | null)?.value || '';
        if (!isLast) {
            goNext();
            return;
        }
        const result = validateSubmission(schema, answers);
        if (applyErrors(result.errors)) {
            setBanner(chrome.fixErrors);
            return;
        }
        setSubmitting(true);
        setBanner(null);
        try {
            const outcome = await onSubmit(result.answers, Date.now() - startedAt.current, { website });
            if (outcome.ok) {
                const redirect = outcome.confirmation?.redirectUrl;
                if (redirect && !preview && /^https:\/\//.test(redirect)) {
                    (embedded ? window.top || window : window).location.assign(redirect);
                    return;
                }
                setDone({ text: outcome.confirmation?.text });
            } else {
                if (outcome.fieldErrors?.length) applyErrors(outcome.fieldErrors);
                setBanner(outcome.message || (outcome.fieldErrors?.length ? chrome.fixErrors : chrome.submitFailed));
            }
        } catch {
            setBanner(chrome.submitFailed);
        } finally {
            setSubmitting(false);
        }
    };

    const style = formThemeStyle(theme, assetUrl);
    const cover = theme.coverPath && assetUrl ? assetUrl(theme.coverPath) : null;
    const logo = theme.logoPath && assetUrl ? assetUrl(theme.logoPath) : null;
    const controller = legal?.controllerName?.trim();

    return (
        <div
            ref={rootRef}
            className={`pf-form pf-form--${theme.fieldStyle}${embedded ? ' pf-form--embedded' : ''}${inApp ? ' pf-form--in-app' : ''}`}
            style={style}
            lang={language}
        >
            <div className="pf-form__card">
                {cover && <div className="pf-form__cover" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />}
                <header className="pf-form__head">
                    {logo && <img className="pf-form__logo" src={logo} alt="" />}
                    <h1 className="pf-form__title">{title}</h1>
                    {description && pageIndex === 0 && !done && <p className="pf-form__description">{description}</p>}
                </header>

                {done ? (
                    <div className="pf-form__done" role="status">
                        <h2>{chrome.thanksTitle}</h2>
                        <p>{done.text || chrome.thanksText}</p>
                    </div>
                ) : (
                    <form className="pf-form__body" onSubmit={(event) => void submit(event)} noValidate>
                        {/* Honeypot: invisible to people, bots fill it in (server drops those submissions). */}
                        <div className="pf-form__hp" aria-hidden="true">
                            <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
                        </div>
                        {sections.length > 1 && (
                            <p className="pf-form__step">{chrome.stepOf.replace('{n}', String(pageIndex + 1)).replace('{total}', String(sections.length))}</p>
                        )}
                        {section && (section.title || section.description) && (
                            <div className="pf-form__section-head">
                                {section.title && <h2>{section.title}</h2>}
                                {section.description && <p>{section.description}</p>}
                            </div>
                        )}
                        {pageFields.map((field) => {
                            const inputId = `pf-input-${field.id}`;
                            const error = errors[field.id];
                            if (field.type === 'statement') {
                                return (
                                    <div key={field.id} id={`pf-field-${field.id}`} className="pf-form__statement">
                                        <p className="pf-form__statement-title">{field.label}</p>
                                        {field.help && <p className="pf-form__hint">{field.help}</p>}
                                    </div>
                                );
                            }
                            const helpId = field.help ? `${inputId}-help` : undefined;
                            const errorId = error ? `${inputId}-error` : undefined;
                            return (
                                <div key={field.id} id={`pf-field-${field.id}`} className={`pf-form__field${error ? ' has-error' : ''}`}>
                                    {field.type !== 'consent' && (
                                        <label className="pf-form__label" id={`${inputId}-label`} htmlFor={inputId}>
                                            {field.label}
                                            {field.required && <span className="pf-form__required" title={chrome.required}> *</span>}
                                        </label>
                                    )}
                                    {field.help && <p className="pf-form__hint" id={helpId}>{field.help}</p>}
                                    {acceptsAnswer(field) && (
                                        <FormFieldInput
                                            field={field}
                                            value={answers[field.id] as FormAnswer | undefined}
                                            onChange={(value) => setAnswer(field.id, value)}
                                            chrome={chrome}
                                            inputId={inputId}
                                            describedBy={[helpId, errorId].filter(Boolean).join(' ') || undefined}
                                            invalid={!!error}
                                            disabled={submitting}
                                            onUpload={onUpload}
                                            uploadsEnabled={uploadsEnabled}
                                        />
                                    )}
                                    {error && <p className="pf-form__error" id={errorId} role="alert">{error}</p>}
                                </div>
                            );
                        })}

                        {isLast && !inApp && (consent?.text || controller || legal?.privacyPolicyUrl) && (
                            <p className="pf-form__privacy">
                                {consent?.text || (controller ? chrome.privacyNotice.replace('{controller}', controller) : chrome.privacyNoticeAnonymous)}
                                {legal?.privacyPolicyUrl && (
                                    <> <a href={legal.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">{chrome.privacyLink}</a></>
                                )}
                            </p>
                        )}

                        {banner && <p className="pf-form__banner" role="alert">{banner}</p>}

                        <div className="pf-form__actions">
                            {pageIndex > 0 && (
                                <button type="button" className="pf-form__button pf-form__button--ghost" disabled={submitting} onClick={() => setPage(pageIndex - 1)}>
                                    {chrome.back}
                                </button>
                            )}
                            <button type="submit" className="pf-form__button" disabled={submitting}>
                                {isLast ? (submitting ? chrome.submitting : chrome.submit) : chrome.next}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {!inApp && (
                <footer className="pf-form__footer">
                    {controller && <span>{controller}</span>}
                    {legal?.privacyPolicyUrl && <a href={legal.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">{chrome.privacyLink}</a>}
                    {legal?.imprintUrl && <a href={legal.imprintUrl} target="_blank" rel="noopener noreferrer">{chrome.imprintLink}</a>}
                    {!hideBranding && (
                        <a className="pf-form__brand" href="https://getprojectflow.com" target="_blank" rel="noopener noreferrer">{chrome.madeWith}</a>
                    )}
                </footer>
            )}
        </div>
    );
};
