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
import panelDarkUrl from '../assets/download/menu-bar-panel-dark.jpg';
import panelLightUrl from '../assets/download/menu-bar-panel-light.jpg';
import captureUrl from '../assets/download/quick-capture.png';
import { useTheme } from '../context/ThemeContext';
import './download-page.scss';

const PLATFORM_LABEL: Record<DesktopOS, string> = { mac: 'macOS', windows: 'Windows' };
const OTHER_OS: Record<DesktopOS, DesktopOS> = { mac: 'windows', windows: 'mac' };

const FEATURES = [
    { icon: 'bolt', key: 'capture', tone: 'warning' },
    { icon: 'timer', key: 'menuBar', tone: 'success' },
    { icon: 'picture_in_picture_alt', key: 'quickAccess', tone: 'primary' },
    { icon: 'notifications_active', key: 'notifications', tone: 'error' },
    { icon: 'wb_twilight', key: 'day', tone: 'warning' },
    { icon: 'update', key: 'updates', tone: 'success' }
] as const;

const TRUST = [
    { icon: 'verified_user', key: 'signed' },
    { icon: 'autorenew', key: 'updates' },
    { icon: 'person', key: 'account' }
] as const;

/**
 * Public download page for the desktop app (/download). Detects macOS / Windows and offers the matching
 * installer straight from the latest release (no detour via GitHub), with install steps after the click.
 */
export const DownloadPage = () => {
    const { t, language } = useLanguage();
    const { user } = useAuth();
    const { loading, release, os: detectedOs } = useDesktopRelease();
    const [chosenOs, setChosenOs] = useState<DesktopOS | null>(null);
    const [startedOs, setStartedOs] = useState<DesktopOS | null>(null);
    const inDesktopApp = isDesktop();
    const { theme } = useTheme();
    const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const os = chosenOs ?? detectedOs;
    const dateLabel = useMemo(() => (release?.publishedAt
        ? new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(release.publishedAt))
        : ''), [language, release?.publishedAt]);

    const available = (target: DesktopOS) => Boolean(release?.assets.includes(DESKTOP_ASSETS[target]));
    const meta = (target: DesktopOS) => [
        release ? t('download.meta.version').replace('{version}', release.version) : null,
        formatDownloadSize(release?.sizes[DESKTOP_ASSETS[target]], language),
        t(`download.meta.arch.${target}`)
    ].filter(Boolean).join(' · ');

    const downloadButton = (target: DesktopOS, primary: boolean) => (
        <a
            key={target}
            className={`download-page__button ${primary ? 'download-page__button--primary' : ''}`.trim()}
            href={desktopDownloadUrl(target)}
            onClick={() => setStartedOs(target)}
            aria-disabled={!available(target)}
        >
            <span className="material-symbols-outlined">{target === 'mac' ? 'laptop_mac' : 'laptop_windows'}</span>
            <span className="download-page__button-copy">
                <strong>{t('download.cta').replace('{platform}', PLATFORM_LABEL[target])}</strong>
                <span>{meta(target)}</span>
            </span>
            <span className="material-symbols-outlined download-page__button-arrow">download</span>
        </a>
    );

    const installSteps = (target: DesktopOS) => [1, 2, 3].map((step) => t(`download.install.${target}.${step}`));

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
                    <div className="download-page__hero-copy">
                        <p className="download-page__badge">
                            <img src={appIconUrl} alt="" aria-hidden="true" />
                            {t('download.eyebrow')}
                            {release && <span>{t('download.meta.version').replace('{version}', release.version)}</span>}
                        </p>
                        <h1>
                            {os ? (
                                <>
                                    {t('download.titleLead')}{' '}
                                    <span className="download-page__accent">{PLATFORM_LABEL[os]}</span>
                                </>
                            ) : t('download.titleGeneric')}
                        </h1>
                        <p className="download-page__lead">{t('download.lead')}</p>

                        {inDesktopApp && (
                            <div className="download-page__notice">
                                <span className="material-symbols-outlined">check_circle</span>
                                {t('download.alreadyInstalled')}
                            </div>
                        )}

                        {loading ? (
                            <div className="download-page__skeleton" aria-busy="true" />
                        ) : !release ? (
                            <div className="download-page__notice">
                                <span className="material-symbols-outlined">schedule</span>
                                {t('download.unavailable')}
                            </div>
                        ) : os ? (
                            <div className="download-page__actions">
                                {downloadButton(os, true)}
                                {available(OTHER_OS[os]) && (
                                    <button type="button" className="download-page__switch" onClick={() => { setChosenOs(OTHER_OS[os]); setStartedOs(null); }}>
                                        {t('download.otherPlatform').replace('{platform}', PLATFORM_LABEL[OTHER_OS[os]])}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                <p className="download-page__hint">{t('download.noDesktopDetected')}</p>
                                <div className="download-page__actions download-page__actions--both">
                                    {available('mac') && downloadButton('mac', false)}
                                    {available('windows') && downloadButton('windows', false)}
                                </div>
                            </>
                        )}

                        {release && dateLabel && (
                            <p className="download-page__released">{t('download.released').replace('{date}', dateLabel)}</p>
                        )}
                    </div>

                    <div className="download-page__stage" aria-hidden="true">
                        <div className="download-page__menubar">
                            <span className="download-page__menubar-apple" />
                            <strong>ProjectFlow</strong>
                            <span>{t('download.stage.menu.file')}</span>
                            <span>{t('download.stage.menu.view')}</span>
                            <span>{t('download.stage.menu.window')}</span>
                            <span className="download-page__menubar-focus">
                                <span className="download-page__pulse" />
                                {t('download.stage.focus')}
                            </span>
                        </div>
                        <img className="download-page__shot download-page__shot--panel" src={isDark ? panelDarkUrl : panelLightUrl} alt="" />
                        <img className="download-page__shot download-page__shot--capture" src={captureUrl} alt="" />
                    </div>
                </section>

                <ul className="download-page__trust">
                    {TRUST.map((item) => {
                        // Only the macOS build is signed and notarized so far.
                        const key = item.key === 'signed' && os === 'windows' ? 'direct' : item.key;
                        return (
                        <li key={item.key}>
                            <span className="material-symbols-outlined">{key === 'direct' ? 'download_done' : item.icon}</span>
                            <span>
                                <strong>{t(`download.trust.${key}.title`)}</strong>
                                {t(`download.trust.${key}.body`)}
                            </span>
                        </li>
                        );
                    })}
                </ul>

                {startedOs && (
                    <section className="download-page__install" aria-live="polite">
                        <h2>{t('download.install.title')}</h2>
                        <ol>
                            {installSteps(startedOs).map((step, index) => (
                                <li key={step}>
                                    <span className="download-page__step">{index + 1}</span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                        <p className="download-page__install-note">
                            {t('download.install.retry')}{' '}
                            <a href={desktopDownloadUrl(startedOs)}>{t('download.install.retryLink')}</a>
                        </p>
                    </section>
                )}

                <section className="download-page__features" aria-label={t('download.features.title')}>
                    <h2>{t('download.features.title')}</h2>
                    <div className="download-page__grid">
                        {FEATURES.map((feature) => (
                            <article key={feature.key} className={`download-page__feature download-page__feature--${feature.tone}`}>
                                <span className="material-symbols-outlined">{feature.icon}</span>
                                <h3>{t(`download.features.${feature.key}.title`)}</h3>
                                <p>{t(`download.features.${feature.key}.body`)}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="download-page__showcase">
                    <div className="download-page__showcase-copy">
                        <p className="download-page__eyebrow">{t('download.showcase.eyebrow')}</p>
                        <h2>{t('download.showcase.title')}</h2>
                        <p>{t('download.showcase.body')}</p>
                        <ul>
                            <li><code>#</code>{t('download.showcase.project')}</li>
                            <li><code>!</code>{t('download.showcase.priority')}</li>
                            <li><code>{t('download.showcase.dateToken')}</code>{t('download.showcase.date')}</li>
                        </ul>
                    </div>
                    <div className="download-page__showcase-visual" aria-hidden="true">
                        <img src={captureUrl} alt="" />
                    </div>
                </section>

                <section className="download-page__details">
                    <div>
                        <h2>{t('download.requirements.title')}</h2>
                        <ul>
                            <li><strong>macOS</strong> {t('download.requirements.mac')}</li>
                            <li><strong>Windows</strong> {t('download.requirements.windows')}</li>
                        </ul>
                    </div>
                    <div>
                        <h2>{t('download.faq.title')}</h2>
                        <dl>
                            {(['account', 'updates', 'browser'] as const).map((key) => (
                                <div key={key}>
                                    <dt>{t(`download.faq.${key}.q`)}</dt>
                                    <dd>{t(`download.faq.${key}.a`)}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>
                {release && os && (
                    <section className="download-page__final">
                        <img src={appIconUrl} alt="" aria-hidden="true" />
                        <h2>{t('download.final.title').replace('{platform}', PLATFORM_LABEL[os])}</h2>
                        <p>{t('download.final.body')}</p>
                        {downloadButton(os, true)}
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
