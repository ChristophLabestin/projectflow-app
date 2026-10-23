import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { AppleLogo } from '../ui/AppleLogo';
import { DESKTOP_DOWNLOAD_PATH, useDesktopDownload } from '../../services/desktopDownloads';

const DISMISS_KEY = 'pf_desktop_promo_until';
const NEVER_KEY = 'pf_desktop_promo_never';
const CLOSE_DAYS = 30;

const isDismissed = () =>
    localStorage.getItem(NEVER_KEY) === '1' || Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();

/**
 * Web app only: a compact card in the sidebar above the project dock, in macOS / Windows browsers, shown once a
 * release with the installer for that OS exists. It links to the download page (/download); closing hides it for
 * 30 days, "Don't show again" for good.
 */
export const DesktopAppPromo = ({ onNavigate }: { onNavigate?: () => void }) => {
    const { t } = useLanguage();
    const offer = useDesktopDownload();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (offer && !isDismissed()) setVisible(true);
    }, [offer]);

    if (!offer || !visible) return null;

    const platform = offer.os === 'mac' ? 'macOS' : 'Windows';
    const snooze = () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now() + CLOSE_DAYS * 24 * 60 * 60 * 1000));
        setVisible(false);
    };
    const never = () => {
        localStorage.setItem(NEVER_KEY, '1');
        setVisible(false);
    };

    const mark = (className: string) => offer.os === 'mac'
        ? <AppleLogo className={className} />
        : <span className={`material-symbols-outlined ${className}`} aria-hidden="true">desktop_windows</span>;

    return (
        <aside className="desktop-promo" aria-label={t('desktop.promo.label')}>
            {mark('desktop-promo__watermark')}
            <button type="button" className="desktop-promo__close" onClick={snooze} aria-label={t('desktop.promo.later')} title={t('desktop.promo.later')}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
            <div className="desktop-promo__head">
                <span className="desktop-promo__icon">{mark('desktop-promo__mark')}</span>
                <p className="desktop-promo__title">{t('desktop.banner.title').replace('{platform}', platform)}</p>
            </div>
            <p className="desktop-promo__body">{t('desktop.banner.body')}</p>
            <div className="desktop-promo__actions">
                <Link to={DESKTOP_DOWNLOAD_PATH} className="desktop-promo__cta" onClick={() => { setVisible(false); onNavigate?.(); }}>
                    {t('desktop.banner.cta')}
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </Link>
                <button type="button" className="desktop-promo__never" onClick={never}>
                    {t('desktop.promo.close')}
                </button>
            </div>
        </aside>
    );
};
