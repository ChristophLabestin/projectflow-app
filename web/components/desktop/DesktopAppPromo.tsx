import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { DESKTOP_DOWNLOAD_PATH, useDesktopDownload } from '../../services/desktopDownloads';

const DISMISS_KEY = 'pf_desktop_promo_until';
const CLOSE_DAYS = 30;

const dismissedUntil = () => Number(localStorage.getItem(DISMISS_KEY) || 0);

/**
 * Web app only: a slim banner above the page content in macOS / Windows browsers, shown once a release with the
 * installer for that OS exists. It links to the download page (/download); closing hides it for 30 days.
 */
export const DesktopAppPromo = () => {
    const { t } = useLanguage();
    const offer = useDesktopDownload();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (offer && dismissedUntil() <= Date.now()) setVisible(true);
    }, [offer]);

    if (!offer || !visible) return null;

    const platform = offer.os === 'mac' ? 'macOS' : 'Windows';
    const close = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + CLOSE_DAYS * 24 * 60 * 60 * 1000));
        setVisible(false);
    };

    return (
        <div className="desktop-banner" role="region" aria-label={t('desktop.promo.label')}>
            <span className="material-symbols-outlined desktop-banner__icon" aria-hidden="true">
                {offer.os === 'mac' ? 'laptop_mac' : 'laptop_windows'}
            </span>
            <p className="desktop-banner__text">
                <strong>{t('desktop.banner.title').replace('{platform}', platform)}</strong>
                <span>{t('desktop.banner.body')}</span>
            </p>
            <Link to={DESKTOP_DOWNLOAD_PATH} className="desktop-banner__cta">
                {t('desktop.banner.cta')}
                <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
            <button type="button" className="desktop-banner__close" onClick={close} aria-label={t('desktop.promo.close')} title={t('desktop.promo.close')}>
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
    );
};
