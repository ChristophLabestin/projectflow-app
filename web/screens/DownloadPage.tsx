import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { isDesktop } from '../services/desktop';
import {
    DESKTOP_ASSETS,
    desktopDownloadUrl,
    formatDownloadSize,
    useDesktopRelease,
    type DesktopOS
} from '../services/desktopDownloads';
import appIconUrl from '../assets/desktop-app-icon.png';
import '../components/common/Button/button.scss';
import './download-page.scss';

const PLATFORMS: { os: DesktopOS; label: string; icon: string }[] = [
    { os: 'mac', label: 'macOS', icon: 'laptop_mac' },
    { os: 'windows', label: 'Windows', icon: 'laptop_windows' }
];

const labelFor = (os: DesktopOS) => PLATFORMS.find((platform) => platform.os === os)!.label;

/**
 * Public download page for the desktop app (/download), kept plain like other SaaS download pages: the installer
 * for the detected OS first, then every platform. Files come straight from the latest release (no GitHub page).
 */
export const DownloadPage = () => {
    const { t, language } = useLanguage();
    const { user } = useAuth();
    const { loading, release, os } = useDesktopRelease();
    const [startedOs, setStartedOs] = useState<DesktopOS | null>(null);
    const inDesktopApp = isDesktop();

    const dateLabel = useMemo(() => (release?.publishedAt
        ? new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(release.publishedAt))
        : ''), [language, release?.publishedAt]);

    const available = (target: DesktopOS) => Boolean(release?.assets.includes(DESKTOP_ASSETS[target]));
    const size = (target: DesktopOS) => formatDownloadSize(release?.sizes[DESKTOP_ASSETS[target]], language);

    return (
        <div className="download-page">
            <header className="download-page__nav">
                <Link to="/" className="download-page__brand">
                    <img src={appIconUrl} alt="" aria-hidden="true" />
                    <span>ProjectFlow</span>
                </Link>
                <Link to={user ? '/' : '/login'} className="download-page__nav-link">
                    {user ? t('download.nav.backToApp') : t('download.nav.signIn')}
                </Link>
            </header>

            <main className="download-page__main">
                <section className="download-page__hero">
                    <img className="download-page__icon" src={appIconUrl} alt={t('download.iconAlt')} />
                    <h1>{os ? t('download.title').replace('{platform}', labelFor(os)) : t('download.titleGeneric')}</h1>
                    <p className="download-page__lead">{t('download.lead')}</p>

                    {inDesktopApp && (
                        <p className="download-page__notice">
                            <span className="material-symbols-outlined">check_circle</span>
                            {t('download.alreadyInstalled')}
                        </p>
                    )}

                    {loading && <div className="download-page__skeleton" aria-busy="true" />}
                    {!loading && !release && (
                        <p className="download-page__notice">
                            <span className="material-symbols-outlined">schedule</span>
                            {t('download.unavailable')}
                        </p>
                    )}
                    {!loading && release && os && available(os) && (
                        <>
                            <a className="btn btn--primary btn--lg download-page__primary" href={desktopDownloadUrl(os)} onClick={() => setStartedOs(os)}>
                                <span className="material-symbols-outlined">download</span>
                                {t('download.cta').replace('{platform}', labelFor(os))}
                            </a>
                            <p className="download-page__meta">
                                {[t('download.meta.version').replace('{version}', release.version), size(os), t(`download.requirements.${os}`)]
                                    .filter(Boolean).join(' · ')}
                            </p>
                        </>
                    )}
                    {!loading && release && !os && <p className="download-page__meta">{t('download.noDesktopDetected')}</p>}
                </section>

                {startedOs && (
                    <section className="download-page__install" aria-live="polite">
                        <h2>{t('download.install.title')}</h2>
                        <ol>
                            {[1, 2, 3].map((step) => (
                                <li key={step}>
                                    <span className="download-page__step">{step}</span>
                                    {t(`download.install.${startedOs}.${step}`)}
                                </li>
                            ))}
                        </ol>
                        <p className="download-page__install-note">
                            {t('download.install.retry')}{' '}
                            <a href={desktopDownloadUrl(startedOs)}>{t('download.install.retryLink')}</a>
                        </p>
                    </section>
                )}

                {release && (
                    <section className="download-page__platforms" aria-labelledby="download-platforms">
                        <h2 id="download-platforms">{t('download.platforms.title')}</h2>
                        <div className="download-page__list">
                            {PLATFORMS.map((platform) => (
                                <div key={platform.os} className="download-page__row">
                                    <span className="material-symbols-outlined download-page__row-icon">{platform.icon}</span>
                                    <div className="download-page__row-copy">
                                        <strong>
                                            {platform.label}
                                            {platform.os === os && <span className="download-page__tag">{t('download.platforms.yourSystem')}</span>}
                                        </strong>
                                        <span>{[t(`download.requirements.${platform.os}`), size(platform.os)].filter(Boolean).join(' · ')}</span>
                                    </div>
                                    {available(platform.os) ? (
                                        <a className="btn btn--secondary btn--sm" href={desktopDownloadUrl(platform.os)} onClick={() => setStartedOs(platform.os)}>
                                            {t('download.platforms.download')}
                                        </a>
                                    ) : (
                                        <span className="download-page__row-muted">{t('download.platforms.soon')}</span>
                                    )}
                                </div>
                            ))}
                            <div className="download-page__row">
                                <span className="material-symbols-outlined download-page__row-icon">language</span>
                                <div className="download-page__row-copy">
                                    <strong>{t('download.platforms.web')}</strong>
                                    <span>{t('download.platforms.webHint')}</span>
                                </div>
                                <Link className="btn btn--ghost btn--sm" to={user ? '/' : '/login'}>{t('download.platforms.open')}</Link>
                            </div>
                        </div>
                        <p className="download-page__footnote">
                            {[dateLabel && t('download.released').replace('{date}', dateLabel), t('download.autoUpdate')].filter(Boolean).join(' · ')}
                        </p>
                    </section>
                )}
            </main>

            <footer className="download-page__footer">
                <span>© {new Date().getFullYear()} ProjectFlow</span>
                <Link to="/legal/privacy">{t('legal.nav.privacy')}</Link>
                <Link to="/legal/terms">{t('legal.nav.terms')}</Link>
            </footer>
        </div>
    );
};
