import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { DESKTOP_RELEASES_PAGE, useDesktopDownload } from '../../services/desktopDownloads';
import { Button } from '../ui/Button';

const DISMISS_KEY = 'pf_desktop_promo_until';
const SHOW_DELAY_MS = 15_000;
const LATER_DAYS = 14;
const CLOSE_DAYS = 60;

const dismissedUntil = () => Number(localStorage.getItem(DISMISS_KEY) || 0);
const dismissFor = (days: number) => localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));

/**
 * Web app only: offers the desktop app on macOS / Windows browsers once a release exists. Appears after a short
 * moment in the session (never on first paint), "Later" hides it for two weeks, closing for two months.
 */
export const DesktopAppPromo = () => {
    const { t } = useLanguage();
    const offer = useDesktopDownload();
    const [visible, setVisible] = useState(false);
    const [downloaded, setDownloaded] = useState(false);

    useEffect(() => {
        if (!offer || dismissedUntil() > Date.now()) return;
        const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
        return () => clearTimeout(timer);
    }, [offer]);

    if (!offer || !visible) return null;

    const platform = offer.os === 'mac' ? 'macOS' : 'Windows';
    const close = (days: number) => {
        dismissFor(days);
        setVisible(false);
    };

    return (
        <aside className="desktop-promo" aria-label={t('desktop.promo.label')}>
            <button type="button" className="desktop-promo__close" onClick={() => close(CLOSE_DAYS)} aria-label={t('desktop.promo.close')} title={t('desktop.promo.close')}>
                <span className="material-symbols-outlined">close</span>
            </button>
            <div className="desktop-promo__icon" aria-hidden="true">
                <span className="material-symbols-outlined">{offer.os === 'mac' ? 'laptop_mac' : 'laptop_windows'}</span>
            </div>
            <h3 className="desktop-promo__title">{t('desktop.promo.title').replace('{platform}', platform)}</h3>
            {downloaded ? (
                <p className="desktop-promo__text">
                    {offer.os === 'mac' ? t('desktop.promo.installMac') : t('desktop.promo.installWindows')}
                </p>
            ) : (
                <ul className="desktop-promo__list">
                    <li><span className="material-symbols-outlined">bolt</span>{t('desktop.promo.feature.capture')}</li>
                    <li><span className="material-symbols-outlined">center_focus_strong</span>{t('desktop.promo.feature.focus')}</li>
                    <li><span className="material-symbols-outlined">notifications_active</span>{t('desktop.promo.feature.notifications')}</li>
                </ul>
            )}
            <div className="desktop-promo__actions">
                {downloaded ? (
                    <Button variant="secondary" onClick={() => close(CLOSE_DAYS)}>{t('desktop.promo.done')}</Button>
                ) : (
                    <>
                        <a
                            className="desktop-promo__download"
                            href={offer.url}
                            onClick={() => setDownloaded(true)}
                            rel="noopener"
                        >
                            <span className="material-symbols-outlined">download</span>
                            {t('desktop.promo.download')}
                        </a>
                        <Button variant="ghost" onClick={() => close(LATER_DAYS)}>{t('desktop.promo.later')}</Button>
                    </>
                )}
            </div>
            <p className="desktop-promo__meta">
                {t('desktop.promo.version').replace('{version}', offer.version).replace('{platform}', platform)}
                {' · '}
                <a href={DESKTOP_RELEASES_PAGE} target="_blank" rel="noopener noreferrer">{t('desktop.promo.allDownloads')}</a>
            </p>
        </aside>
    );
};
