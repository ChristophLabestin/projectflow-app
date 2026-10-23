import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { MarkdownContent, MarkdownDiff } from '../components/legal/MarkdownContent';
import { useLanguage } from '../context/LanguageContext';
import { fetchLegalIndexEntry, fetchLegalVersion, type LegalIndexEntry, type LegalVersion } from '../services/legalService';
import { LEGAL_TYPES, currentEffective, legalTypeFromSlug, markdownHeadings, type LegalType } from '../utils/legalConsent';
import './legal-page.scss';

export type LegalPageType = LegalType;

/**
 * Public legal pages (/legal/:type, ?v=<version>, &diff=1). Content comes from the versioned
 * legal documents system (legal_documents/*), not from bundled texts.
 */
const LegalPage: React.FC = () => {
    const { type: slug } = useParams<{ type: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t, language } = useLanguage();
    const lang = language === 'de' ? 'de' : 'en';
    const type: LegalType = legalTypeFromSlug(slug) ?? 'imprint';

    const [entry, setEntry] = useState<LegalIndexEntry | null>(null);
    const [doc, setDoc] = useState<LegalVersion | null>(null);
    const [previous, setPrevious] = useState<LegalVersion | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

    const requested = Number(searchParams.get('v'));
    const showDiff = searchParams.get('diff') === '1';

    useEffect(() => {
        const canonical = legalTypeFromSlug(slug);
        if (canonical && canonical !== slug) navigate(`/legal/${canonical}${window.location.search}`, { replace: true });
    }, [slug, navigate]);

    useEffect(() => {
        let cancelled = false;
        setState('loading');
        setPrevious(null);
        (async () => {
            const nextEntry = await fetchLegalIndexEntry(type);
            const now = Date.now();
            const current = currentEffective(nextEntry.versions, now);
            const known = nextEntry.versions.find((meta) => meta.version === requested);
            const version = known ? known.version : current?.version ?? null;
            if (cancelled) return;
            setEntry(nextEntry);
            if (version == null) { setDoc(null); setState('missing'); return; }
            const [nextDoc, prevDoc] = await Promise.all([
                fetchLegalVersion(type, version),
                version > 1 ? fetchLegalVersion(type, version - 1) : Promise.resolve(null),
            ]);
            if (cancelled) return;
            setDoc(nextDoc);
            setPrevious(prevDoc);
            setState(nextDoc ? 'ready' : 'missing');
        })().catch((error) => {
            console.error('Loading legal document failed', error);
            if (!cancelled) setState('error');
        });
        return () => { cancelled = true; };
    }, [type, requested]);

    const headings = useMemo(() => (doc ? markdownHeadings(doc.content[lang]).filter((heading) => heading.level === 2) : []), [doc, lang]);
    const now = Date.now();
    const current = entry ? currentEffective(entry.versions, now) : null;
    const archive = entry ? [...entry.versions].sort((a, b) => b.version - a.version) : [];
    const formatDate = (ms: number) => new Date(ms).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const selectVersion = (version: number | null, diff = false) => {
        const next = new URLSearchParams();
        if (version != null && version !== current?.version) next.set('v', String(version));
        else if (version != null && diff) next.set('v', String(version));
        if (diff) next.set('diff', '1');
        setSearchParams(next);
    };

    const onClose = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
    };

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="legal-page">
            <div className="legal-page__header">
                <button onClick={onClose} className="legal-page__back">
                    <ArrowLeft size={20} />
                    {t('legal.back')}
                </button>
                <div className="legal-page__header-actions">
                    {LEGAL_TYPES.map((key) => (
                        <Link key={key} to={`/legal/${key}`} className={`legal-page__header-link ${key === type ? 'is-active' : ''}`}>
                            {t(`legal.nav.${key}`)}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="legal-page__layout">
                <div className="legal-page__sidebar">
                    <div>
                        <button onClick={onClose} className="legal-page__back">
                            <ArrowLeft size={18} /> {t('legal.back')}
                        </button>
                        <nav className="legal-page__nav">
                            {LEGAL_TYPES.map((key) => (
                                <React.Fragment key={key}>
                                    <Link to={`/legal/${key}`} className={`legal-page__nav-button ${key === type ? 'is-active' : ''}`}>
                                        {t(`legal.nav.${key}`)}
                                    </Link>
                                    {key === type && headings.length > 0 && !showDiff && (
                                        <div className="legal-page__subnav">
                                            {headings.map((heading) => (
                                                <button key={heading.id} onClick={() => scrollToSection(heading.id)} className="legal-page__subnav-button">
                                                    {heading.text}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </nav>
                    </div>
                    <div className="legal-page__footer">{t('footer.rights')}</div>
                </div>

                <div className="legal-page__content">
                    <div className="legal-page__body">
                        {state === 'loading' && (
                            <div className="legal-page__status">
                                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                            </div>
                        )}
                        {state === 'error' && <p className="legal-page__status">{t('legalPage.error')}</p>}
                        {state === 'missing' && <p className="legal-page__status">{t('legalPage.missing')}</p>}
                        {state === 'ready' && doc && (
                            <>
                                <h1 className="legal-page__title">{doc.title[lang]}</h1>
                                <div className="legal-page__version-bar">
                                    <span className="legal-page__meta">
                                        {t('legalConsent.versionLabel').replace('{version}', String(doc.version))}
                                        {' · '}
                                        {t('legalConsent.effectiveFrom').replace('{date}', formatDate(doc.effectiveAtMs))}
                                    </span>
                                    {archive.length > 1 && (
                                        <label className="legal-page__version-select">
                                            <span>{t('legalPage.archive')}</span>
                                            <select
                                                value={doc.version}
                                                onChange={(event) => selectVersion(Number(event.target.value))}
                                            >
                                                {archive.map((meta) => (
                                                    <option key={meta.version} value={meta.version}>
                                                        {t('legalConsent.versionLabel').replace('{version}', String(meta.version))}
                                                        {' – '}
                                                        {formatDate(meta.effectiveAtMs)}
                                                        {meta.version === current?.version ? ` (${t('legalPage.current')})` : meta.effectiveAtMs > now ? ` (${t('legalPage.upcoming')})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    {previous && (
                                        <button type="button" className="legal-page__diff-toggle" onClick={() => selectVersion(doc.version, !showDiff)}>
                                            {showDiff ? t('legalConsent.viewer.showDocument') : t('legalConsent.viewer.showDiff').replace('{version}', String(previous.version))}
                                        </button>
                                    )}
                                </div>
                                {current && doc.version !== current.version && (
                                    <p className="legal-page__notice">
                                        {doc.effectiveAtMs > now ? t('legalPage.upcomingNotice') : t('legalPage.outdatedNotice')}{' '}
                                        <button type="button" className="legal-page__diff-toggle" onClick={() => selectVersion(null)}>{t('legalPage.showCurrent')}</button>
                                    </p>
                                )}
                                {doc.summary[lang] && doc.version > 1 && (
                                    <p className="legal-page__summary"><strong>{t('legalPage.summary')}</strong> {doc.summary[lang]}</p>
                                )}
                                {showDiff && previous ? (
                                    <MarkdownDiff
                                        before={previous.content[lang]}
                                        after={doc.content[lang]}
                                        labels={{ added: t('legalConsent.diff.added'), removed: t('legalConsent.diff.removed'), unchanged: t('legalConsent.diff.unchanged') }}
                                    />
                                ) : (
                                    <MarkdownContent markdown={doc.content[lang]} />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegalPage;
