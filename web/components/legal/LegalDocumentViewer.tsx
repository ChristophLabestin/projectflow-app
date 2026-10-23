import React, { useEffect, useState } from 'react';

import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useLanguage } from '../../context/LanguageContext';
import { fetchLegalVersion, type LegalVersion } from '../../services/legalService';
import type { LegalType } from '../../utils/legalConsent';
import { MarkdownContent, MarkdownDiff } from './MarkdownContent';

type Props = {
    type: LegalType;
    version: number;
    /** Version to diff against (user's accepted version or the previous one). */
    compareTo: number | null;
    initialMode?: 'document' | 'diff';
    onClose: () => void;
};

/** In-app viewer for one legal document version, with optional diff (works inside the consent gate). */
export const LegalDocumentViewer: React.FC<Props> = ({ type, version, compareTo, initialMode = 'document', onClose }) => {
    const { t, language } = useLanguage();
    const lang = language === 'de' ? 'de' : 'en';
    const [current, setCurrent] = useState<LegalVersion | null>(null);
    const [previous, setPrevious] = useState<LegalVersion | null>(null);
    const [mode, setMode] = useState<'document' | 'diff'>(initialMode);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        Promise.all([fetchLegalVersion(type, version), compareTo ? fetchLegalVersion(type, compareTo) : Promise.resolve(null)])
            .then(([next, before]) => {
                if (cancelled) return;
                setCurrent(next);
                setPrevious(before);
                if (!next) setFailed(true);
            })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, [type, version, compareTo]);

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="3xl"
            className="legal-viewer-modal"
            title={current ? `${current.title[lang]} · ${t('legalConsent.versionLabel').replace('{version}', String(version))}` : t(`legal.nav.${type}`)}
            footer={(
                <div className="legal-viewer__footer">
                    {previous && (
                        <Button variant="ghost" onClick={() => setMode(mode === 'diff' ? 'document' : 'diff')}>
                            {mode === 'diff' ? t('legalConsent.viewer.showDocument') : t('legalConsent.viewer.showDiff').replace('{version}', String(previous.version))}
                        </Button>
                    )}
                    <Button onClick={onClose}>{t('common.close')}</Button>
                </div>
            )}
        >
            {failed && <p className="legal-viewer__error">{t('legalConsent.viewer.error')}</p>}
            {!failed && !current && <p className="legal-viewer__loading">{t('common.loading')}</p>}
            {current && mode === 'document' && <MarkdownContent markdown={current.content[lang]} />}
            {current && previous && mode === 'diff' && (
                <MarkdownDiff
                    before={previous.content[lang]}
                    after={current.content[lang]}
                    labels={{ added: t('legalConsent.diff.added'), removed: t('legalConsent.diff.removed'), unchanged: t('legalConsent.diff.unchanged') }}
                />
            )}
        </Modal>
    );
};
