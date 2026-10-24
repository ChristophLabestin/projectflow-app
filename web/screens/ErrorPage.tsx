import React, { useEffect } from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button/Button';
import { useLanguage } from '../context/LanguageContext';
import './error-page.scss';

// A lazy route whose chunk is gone after a deploy (old tab/desktop window): reload once into the new build
// instead of showing this page. Same guard key as the `vite:preloadError` handler in index.tsx.
const CHUNK_RELOAD_KEY = 'pf_chunk_reload_at';
const isChunkLoadError = (error: unknown) => error instanceof Error
    && /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(error.message);

export const ErrorPage = () => {
    const error = useRouteError();
    const navigate = useNavigate();
    const { t } = useLanguage();

    useEffect(() => {
        if (!isChunkLoadError(error)) return;
        const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
        if (Date.now() - lastReload < 30_000) return;
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
    }, [error]);

    let errorMessage = t('errorPage.message.unexpected');
    let errorStatus = t('errorPage.status.fallback');

    if (isRouteErrorResponse(error)) {
        // error is type `ErrorResponse`
        errorMessage = error.statusText || error.data?.message || t('errorPage.message.notFound');
        errorStatus = error.status.toString();
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    return (
        <div className="error-page">
            <div className="error-page__card">
                <div className="error-page__icon">
                    <span className="material-symbols-outlined">error_outline</span>
                </div>

                <h1 className="error-page__status">{errorStatus}</h1>

                <p className="error-page__message">{errorMessage}</p>

                <div className="error-page__actions">
                    <Button
                        variant="secondary"
                        onClick={() => navigate(-1)}
                        className="error-page__button"
                        icon={<span className="material-symbols-outlined">arrow_back</span>}
                    >
                        {t('errorPage.actions.back')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => navigate('/')}
                        className="error-page__button"
                        icon={<span className="material-symbols-outlined">home</span>}
                    >
                        {t('errorPage.actions.home')}
                    </Button>
                </div>

                <p className="error-page__note">{t('errorPage.footer.support')}</p>
            </div>
        </div>
    );
};
