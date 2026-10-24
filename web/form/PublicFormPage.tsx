import React, { useEffect, useMemo, useState } from 'react';

import { FormRenderer, formChromeFor } from '../components/forms/renderer/FormRenderer';
import { formThemeStyle, loadFormFont, resolveFormTheme } from '../components/forms/theme/formThemes';
import '../components/forms/renderer/form-renderer.scss';
import {
    formAssetUrl,
    loadPublicForm,
    submitPublicForm,
    uploadPublicFormFile,
    type PublicFormLoad
} from '../services/forms/publicFormsApi';

const tokenFromPath = () => {
    const match = window.location.pathname.match(/^\/f\/([A-Za-z0-9_-]{8,128})\/?$/);
    return match ? match[1] : '';
};

const browserLanguage = () => (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';

/** /f/:token — loads the published form, renders it with its theme and sends answers to submitPublicForm. */
export const PublicFormPage: React.FC = () => {
    const token = useMemo(tokenFromPath, []);
    const embedded = useMemo(() => new URLSearchParams(window.location.search).get('embed') === '1', []);
    const [load, setLoad] = useState<PublicFormLoad | null>(null);

    useEffect(() => {
        if (!token) {
            setLoad({ status: 'not-found' });
            return;
        }
        void loadPublicForm(token).then(setLoad);
    }, [token]);

    useEffect(() => {
        if (load?.status === 'open') {
            document.title = load.form.title;
            document.documentElement.lang = load.form.language;
        }
    }, [load]);

    if (!load) return null;

    if (load.status === 'open') {
        const { form, session } = load;
        return (
            <FormRenderer
                title={form.title}
                description={form.description}
                schema={form.schema}
                theme={resolveFormTheme(form.theme)}
                language={form.language}
                legal={form.legal}
                consent={form.settings.consent}
                hideBranding={form.settings.hideBranding}
                uploadsEnabled={form.uploadsEnabled}
                assetUrl={formAssetUrl}
                embedded={embedded}
                onUpload={(field, file) => uploadPublicFormFile(token, session, field.id, file)}
                onSubmit={async (answers, durationMs, { website }) => {
                    const chrome = formChromeFor(form.language);
                    const result = await submitPublicForm({ token, session, answers, website, durationMs, source: embedded ? 'embed' : 'link' });
                    if (result.ok) return { ok: true, confirmation: result.confirmation || form.settings.confirmation };
                    const message = result.error === 'rate-limited' ? chrome.rateLimited
                        : result.error === 'form-session-invalid' ? chrome.sessionExpired
                            : result.error === 'form-closed' ? chrome.closedText
                                : result.error === 'form-limit' || result.error === 'plan-form-responses' ? chrome.limitText
                                    : undefined;
                    return { ok: false, fieldErrors: result.fieldErrors, message };
                }}
            />
        );
    }

    return <PublicFormState load={load} embedded={embedded} />;
};

const PublicFormState: React.FC<{ load: Exclude<PublicFormLoad, { status: 'open' }>; embedded: boolean }> = ({ load, embedded }) => {
    const language = 'language' in load && load.language ? load.language : browserLanguage();
    const chrome = formChromeFor(language);
    const theme = resolveFormTheme('theme' in load ? load.theme : null);
    useEffect(() => { void loadFormFont(theme.font); }, [theme.font]);

    let title = chrome.loadFailed;
    let text = '';
    let action: React.ReactNode = null;
    if (load.status === 'paused') { title = chrome.pausedTitle; text = chrome.pausedText; }
    if (load.status === 'closed') { title = chrome.closedTitle; text = chrome.closedText; }
    if (load.status === 'limit') { title = chrome.limitTitle; text = chrome.limitText; }
    if (load.status === 'not-found') { title = chrome.notFoundTitle; text = chrome.notFoundText; }
    if (load.status === 'workspace') {
        title = chrome.workspaceTitle;
        text = chrome.workspaceText;
        action = (
            <a className="pf-form__button" href={`/forms/fill/${tokenFromPath()}`} target={embedded ? '_top' : undefined} style={{ display: 'inline-block', marginTop: 20, textDecoration: 'none' }}>
                {chrome.workspaceAction}
            </a>
        );
    }
    const formTitle = 'title' in load ? load.title : undefined;
    return (
        <div className={`pf-form${embedded ? ' pf-form--embedded' : ''}`} style={formThemeStyle(theme, formAssetUrl)} lang={language}>
            <div className="pf-form__card">
                <div className="pf-form__state" role="status">
                    {formTitle && <p className="pf-form__step">{formTitle}</p>}
                    <h1>{title}</h1>
                    {text && <p>{text}</p>}
                    {action}
                </div>
            </div>
        </div>
    );
};
