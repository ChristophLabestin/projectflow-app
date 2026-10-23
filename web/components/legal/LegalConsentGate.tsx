import React, { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';

import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { AccountDataSection } from '../settings/AccountDataSection';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/UIContext';
import { auth } from '../../services/firebase';
import { isDesktop } from '../../services/desktop';
import {
    acceptLegalDocuments,
    declineLegalDocuments,
    subscribeLegalIndex,
    subscribeMyLegalAcceptance,
    type LegalIndexEntry,
} from '../../services/legalService';
import { clientInfo, evaluateGate, nextEffectiveAt, type AcceptedDocs, type GateItem } from '../../utils/legalConsent';
import { LegalDocumentViewer } from './LegalDocumentViewer';
import './legal-consent.scss';

type ViewerState = { type: GateItem['type']; version: number; compareTo: number | null; mode: 'document' | 'diff' } | null;

/**
 * Consent gate for versioned legal documents. Wraps every signed-in surface (main app and the
 * desktop utility windows): if the user has not accepted the current effective privacy policy /
 * terms (initial consent or a `requiresAcceptance` change) a blocking modal covers the app;
 * declining leads to a locked page with export / delete / sign out. `notifyOnly` changes show a
 * dismissible notice once per version. Fails open if the documents cannot be loaded.
 */
export const LegalConsentGate: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { t, language } = useLanguage();
    const { showError } = useToast();
    const lang = language === 'de' ? 'de' : 'en';
    const uid = user?.uid ?? null;

    const [index, setIndex] = useState<LegalIndexEntry[] | null>(null);
    const [accepted, setAccepted] = useState<AcceptedDocs | null>(null);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const [declined, setDeclined] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [viewer, setViewer] = useState<ViewerState>(null);
    const [dismissedNotices, setDismissedNotices] = useState<string[]>([]);

    useEffect(() => {
        setIndex(null);
        setAccepted(null);
        setFailed(false);
        setDeclined(false);
        if (!uid) return undefined;
        const fail = (error: Error) => {
            console.warn('Legal consent gate disabled (load failed)', error);
            setFailed(true);
        };
        const stopIndex = subscribeLegalIndex(setIndex, fail);
        const stopAcceptance = subscribeMyLegalAcceptance(uid, setAccepted, fail);
        return () => { stopIndex(); stopAcceptance(); };
    }, [uid]);

    // Re-evaluate when a future-dated version becomes effective while the app stays open.
    useEffect(() => {
        if (!index) return undefined;
        const next = nextEffectiveAt(index, Date.now());
        if (next == null) return undefined;
        const timer = window.setTimeout(() => setNow(Date.now()), Math.min(Math.max(next - Date.now(), 0) + 1000, 6 * 60 * 60 * 1000));
        return () => window.clearTimeout(timer);
    }, [index, now]);

    const gate = useMemo(
        () => (index && accepted && !failed ? evaluateGate(index, accepted, now) : { blocking: [], notices: [] }),
        [index, accepted, failed, now],
    );

    if (!uid) return <>{children}</>;

    const client = clientInfo(isDesktop());
    const docName = (type: GateItem['type']) => t(`legal.nav.${type}`);
    const formatDate = (ms: number) => new Date(ms).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const accept = async (items: GateItem[]) => {
        setSubmitting(true);
        try {
            await acceptLegalDocuments({ items: items.map((item) => ({ type: item.type, version: item.version })), ...client });
            setDeclined(false);
        } catch (error) {
            console.error('Accepting legal documents failed', error);
            showError(t('legalConsent.error.accept'));
        } finally {
            setSubmitting(false);
        }
    };

    const decline = () => {
        setDeclined(true);
        void declineLegalDocuments({ items: gate.blocking.map((item) => ({ type: item.type, version: item.version })), ...client })
            .catch((error) => console.warn('Recording legal decline failed', error));
    };

    const handleSignOut = async () => {
        await signOut(auth);
        if (typeof localStorage !== 'undefined') localStorage.removeItem('activeTenantId');
        window.location.assign('/login');
    };

    const viewerModal = viewer && (
        <LegalDocumentViewer
            type={viewer.type}
            version={viewer.version}
            compareTo={viewer.compareTo}
            initialMode={viewer.mode}
            onClose={() => setViewer(null)}
        />
    );

    const blocking = gate.blocking;

    if (blocking.length > 0 && declined) {
        return (
            <div className="legal-declined" role="main">
                <div className="legal-declined__card">
                    <span className="material-symbols-outlined legal-declined__icon" aria-hidden>lock</span>
                    <h1 className="legal-declined__title">{t('legalConsent.declined.title')}</h1>
                    <p className="legal-declined__text">{t('legalConsent.declined.text')}</p>
                    <div className="legal-declined__actions">
                        <Button onClick={() => setDeclined(false)}>{t('legalConsent.declined.review')}</Button>
                        <Button variant="ghost" onClick={() => void handleSignOut()}>{t('legalConsent.declined.signOut')}</Button>
                    </div>
                    <div className="legal-declined__data">
                        <h2 className="legal-declined__subtitle">{t('legalConsent.declined.dataTitle')}</h2>
                        <AccountDataSection />
                    </div>
                </div>
            </div>
        );
    }

    const notices = gate.notices.filter((item) => !dismissedNotices.includes(`${item.type}:${item.version}`));
    const isInitial = blocking.length > 0 && blocking.every((item) => item.acceptedVersion == null);

    return (
        <>
            {children}
            {blocking.length > 0 && (
                <Modal isOpen onClose={() => undefined} hideHeader size="lg" className="legal-gate">
                    <div className="legal-gate__body" data-testid="legal-consent-gate">
                        <span className="material-symbols-outlined legal-gate__icon" aria-hidden>gavel</span>
                        <h2 className="legal-gate__title">{t(isInitial ? 'legalConsent.gate.titleInitial' : 'legalConsent.gate.titleUpdate')}</h2>
                        <p className="legal-gate__intro">{t(isInitial ? 'legalConsent.gate.introInitial' : 'legalConsent.gate.introUpdate')}</p>
                        <ul className="legal-gate__items">
                            {blocking.map((item) => {
                                const current = item.changes[0];
                                const compareTo = item.acceptedVersion ?? (item.version > 1 ? item.version - 1 : null);
                                return (
                                    <li key={item.type} className="legal-gate__item">
                                        <div className="legal-gate__item-head">
                                            <strong>{docName(item.type)}</strong>
                                            <span className="legal-gate__meta">
                                                {t('legalConsent.versionLabel').replace('{version}', String(item.version))}
                                                {current ? ` · ${t('legalConsent.effectiveFrom').replace('{date}', formatDate(current.effectiveAtMs))}` : ''}
                                            </span>
                                        </div>
                                        {item.changes.filter((change) => change.summary[lang]).map((change) => (
                                            <p key={change.version} className="legal-gate__summary">{change.summary[lang]}</p>
                                        ))}
                                        <div className="legal-gate__links">
                                            <button type="button" className="legal-gate__link" onClick={() => setViewer({ type: item.type, version: item.version, compareTo, mode: 'document' })}>
                                                {t('legalConsent.gate.readFull')}
                                            </button>
                                            {compareTo && (
                                                <button type="button" className="legal-gate__link" onClick={() => setViewer({ type: item.type, version: item.version, compareTo, mode: 'diff' })}>
                                                    {t('legalConsent.gate.showChanges')}
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <p className="legal-gate__consent">{t('legalConsent.gate.consentText')}</p>
                        <div className="legal-gate__actions">
                            <Button variant="ghost" onClick={decline} disabled={submitting}>{t('legalConsent.gate.decline')}</Button>
                            <Button onClick={() => void accept([...blocking, ...gate.notices])} loading={submitting} data-testid="legal-consent-accept">
                                {t('legalConsent.gate.accept')}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
            {blocking.length === 0 && notices.length > 0 && (
                <div className="legal-notice" role="status" data-testid="legal-notice">
                    <span className="material-symbols-outlined legal-notice__icon" aria-hidden>info</span>
                    <div className="legal-notice__text">
                        <strong>{t('legalConsent.notice.title')}</strong>
                        <span>
                            {notices.map((item) => `${docName(item.type)} (${t('legalConsent.versionLabel').replace('{version}', String(item.version))})`).join(', ')}
                            {notices[0].changes[0]?.summary[lang] ? ` — ${notices[0].changes[0].summary[lang]}` : ''}
                        </span>
                    </div>
                    <div className="legal-notice__actions">
                        <Button size="sm" variant="ghost" onClick={() => setViewer({ type: notices[0].type, version: notices[0].version, compareTo: notices[0].acceptedVersion, mode: 'document' })}>
                            {t('legalConsent.notice.view')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setDismissedNotices((prev) => [...prev, ...notices.map((item) => `${item.type}:${item.version}`)]);
                                void accept(notices);
                            }}
                        >
                            {t('legalConsent.notice.dismiss')}
                        </Button>
                    </div>
                </div>
            )}
            {viewerModal}
        </>
    );
};
