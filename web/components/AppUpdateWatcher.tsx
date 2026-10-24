import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import './app-update-watcher.scss';

/**
 * Picks up a new web deploy in long-open tabs and desktop windows (the desktop app runs for days).
 * Compares /version.json (written by the build, never cached) with the build this page runs. A window in the
 * background with nothing in progress reloads silently; otherwise a small hint offers the reload.
 * Missing old chunks after a deploy are handled separately (`vite:preloadError` in index.tsx).
 */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RELOADED_KEY = 'pf_update_reloaded_to';

const fetchDeployedBuild = async (): Promise<string | null> => {
    try {
        const response = await fetch('/version.json', { cache: 'no-store' });
        if (!response.ok) return null;
        const data = await response.json() as { build?: unknown };
        return typeof data.build === 'string' ? data.build : null;
    } catch {
        return null;
    }
};

/** Nothing the user would lose: no open dialog and no text in the focused field. */
const isIdle = () => {
    if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return false;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return true;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return !active.value.trim();
    return !active.isContentEditable;
};

const inBackground = () => document.visibilityState === 'hidden' || !document.hasFocus();

export const AppUpdateWatcher = () => {
    const { t } = useLanguage();
    const [available, setAvailable] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const availableRef = useRef<string | null>(null);

    const reload = useCallback((build: string) => {
        sessionStorage.setItem(RELOADED_KEY, build);
        window.location.reload();
    }, []);

    const tryQuietReload = useCallback(() => {
        const build = availableRef.current;
        // Already reloaded towards this build once (e.g. a stale CDN edge): only offer it, never loop.
        if (!build || sessionStorage.getItem(RELOADED_KEY) === build) return;
        if (inBackground() && isIdle()) reload(build);
    }, [reload]);

    const check = useCallback(async () => {
        const deployed = await fetchDeployedBuild();
        if (!deployed || deployed === __PF_BUILD__) return;
        availableRef.current = deployed;
        setAvailable(deployed);
        tryQuietReload();
    }, [tryQuietReload]);

    useEffect(() => {
        if (import.meta.env.DEV) return undefined;
        const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void check();
            else tryQuietReload();
        };
        const onFocus = () => void check();
        const onBlur = () => tryQuietReload();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('focus', onFocus);
        window.addEventListener('blur', onBlur);
        void check();
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
        };
    }, [check, tryQuietReload]);

    if (!available || dismissed) return null;
    return (
        <div className="app-update-hint" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            <span className="app-update-hint__text">{t('app.update.available')}</span>
            <button type="button" className="app-update-hint__action" onClick={() => reload(available)}>
                {t('app.update.reload')}
            </button>
            <button type="button" className="app-update-hint__close" onClick={() => setDismissed(true)} aria-label={t('common.close')}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
        </div>
    );
};
