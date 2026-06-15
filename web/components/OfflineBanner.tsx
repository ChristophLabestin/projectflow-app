import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage } from '../context/LanguageContext';

/**
 * Global connectivity banner. Renders only while the browser reports offline,
 * so users get explicit feedback instead of silently failing writes/reads.
 */
export const OfflineBanner = () => {
    const online = useOnlineStatus();
    const { t } = useLanguage();

    if (online) return null;

    return (
        <div className="offline-banner" role="status" aria-live="assertive">
            <span className="material-symbols-outlined offline-banner__icon">cloud_off</span>
            <span className="offline-banner__text">
                {t('common.offline.banner', "You're offline. Changes may not be saved until you reconnect.")}
            </span>
        </div>
    );
};
