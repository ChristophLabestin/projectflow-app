import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../common/Button/Button';
import { registerPasskey } from '../../services/passkeyService';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';

interface PasskeySetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSetupComplete: () => void;
    /** "Later" snoozes the automatic reminder for a week (default). */
    snoozeOnLater?: boolean;
}

const SNOOZE_KEY = 'projectflow_passkey_reminder_snooze';
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

/** A readable default name for the passkey, e.g. "Mac" or "iPhone". */
const guessDeviceName = () => {
    if (typeof navigator === 'undefined') return '';
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return '';
};

const BENEFITS = [
    { icon: 'fingerprint', key: 'passkey.setup.benefit.biometric' },
    { icon: 'shield_lock', key: 'passkey.setup.benefit.phishing' },
    { icon: 'devices', key: 'passkey.setup.benefit.devices' }
];

export const PasskeySetupModal: React.FC<PasskeySetupModalProps> = ({ isOpen, onClose, onSetupComplete, snoozeOnLater = true }) => {
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [deviceName, setDeviceName] = useState(guessDeviceName);

    const handleLater = () => {
        if (loading) return;
        if (snoozeOnLater) {
            try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + ONE_WEEK)); } catch { /* storage unavailable */ }
        }
        onClose();
    };

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') handleLater(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, loading]);

    if (!isOpen) return null;

    const handleSetup = async () => {
        setLoading(true);
        try {
            await registerPasskey(deviceName.trim() || undefined);
            showSuccess(t('passkey.setup.success'));
            onSetupComplete();
            onClose();
        } catch (error: any) {
            console.error('Passkey setup failed:', error);
            // Cancelling the system prompt is not an error.
            if (error?.name !== 'NotAllowedError' && !String(error?.message || '').includes('canceled')) {
                showError(t('passkey.setup.error'));
            }
        } finally {
            setLoading(false);
        }
    };

    return createPortal(
        <div
            className="passkey-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="passkey-dialog-title"
            onClick={(event) => { if (event.target === event.currentTarget) handleLater(); }}
        >
            <div className="passkey-dialog__panel">
                <button type="button" className="passkey-dialog__close" onClick={handleLater} aria-label={t('passkey.setup.action.later')} disabled={loading}>
                    <span className="material-symbols-outlined">close</span>
                </button>

                <span className="passkey-dialog__badge material-symbols-outlined" aria-hidden="true">passkey</span>
                <h2 id="passkey-dialog-title" className="passkey-dialog__title">{t('passkey.setup.title')}</h2>
                <p className="passkey-dialog__subtitle">{t('passkey.setup.description')}</p>

                <ul className="passkey-dialog__benefits">
                    {BENEFITS.map((benefit) => (
                        <li key={benefit.key}>
                            <span className="material-symbols-outlined" aria-hidden="true">{benefit.icon}</span>
                            {t(benefit.key)}
                        </li>
                    ))}
                </ul>

                <label className="passkey-dialog__field">
                    <span className="passkey-dialog__label">{t('passkey.setup.device_name_label')}</span>
                    <input
                        className="passkey-dialog__input"
                        value={deviceName}
                        onChange={(event) => setDeviceName(event.target.value)}
                        placeholder={t('passkey.setup.device_name_placeholder')}
                        maxLength={60}
                        disabled={loading}
                    />
                </label>

                <footer className="passkey-dialog__foot">
                    <button type="button" className="passkey-dialog__later" onClick={handleLater} disabled={loading}>
                        {t('passkey.setup.action.later')}
                    </button>
                    <Button variant="primary" isLoading={loading} onClick={() => void handleSetup()}>
                        {t('passkey.setup.action.setup')}
                    </Button>
                </footer>
            </div>
        </div>,
        document.body
    );
};
