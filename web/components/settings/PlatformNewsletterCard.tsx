import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';

import { functions } from '../../services/firebase';
import { useLanguage } from '../../context/LanguageContext';
import { SettingsSwitch } from './SettingsSwitch';

type NewsletterStatus = 'none' | 'pending' | 'confirmed' | 'unsubscribed' | 'bounced';
type Busy = 'loading' | 'saving' | null;

const callPreference = httpsCallable<{ action: 'get' | 'subscribe' | 'unsubscribe'; lang?: string }, { status: NewsletterStatus; mailSent?: boolean }>(
    functions,
    'platformNewsletterPreference'
);

/**
 * "ProjectFlow newsletter" toggle in Settings → Notifications. Platform newsletter of ProjectFlow itself
 * (not the workspace marketing module); turning it on sends a double-opt-in mail, it is only active after the click.
 * Backend: functions/src/platform-newsletter/app.ts
 */
export const PlatformNewsletterCard: React.FC = () => {
    const { t, language } = useLanguage();
    const [status, setStatus] = useState<NewsletterStatus>('none');
    const [busy, setBusy] = useState<Busy>('loading');
    const [error, setError] = useState(false);

    useEffect(() => {
        let alive = true;
        callPreference({ action: 'get' })
            .then((res) => { if (alive) setStatus(res.data.status); })
            .catch(() => { if (alive) setError(true); })
            .finally(() => { if (alive) setBusy(null); });
        return () => { alive = false; };
    }, []);

    const change = async (enabled: boolean) => {
        setBusy('saving');
        setError(false);
        try {
            const res = await callPreference(enabled ? { action: 'subscribe', lang: language } : { action: 'unsubscribe' });
            setStatus(res.data.status);
        } catch {
            setError(true);
        } finally {
            setBusy(null);
        }
    };

    const checked = status === 'confirmed' || status === 'pending';
    const hint = error
        ? t('settings.notifications.newsletter.error')
        : status === 'pending'
            ? t('settings.notifications.newsletter.pending')
            : status === 'bounced'
                ? t('settings.notifications.newsletter.bounced')
                : t('settings.notifications.newsletter.hint');

    return (
        <section className="notification-settings__card" aria-labelledby="notification-settings-newsletter">
            <h3 id="notification-settings-newsletter">{t('settings.notifications.newsletter.section')}</h3>
            <div className="notification-settings__row">
                <div className="notification-settings__copy">
                    <strong>{t('settings.notifications.newsletter.title')}</strong>
                    <span role="status" aria-live="polite">{hint}</span>
                </div>
                <div className="notification-settings__controls">
                    <SettingsSwitch
                        checked={checked}
                        disabled={busy !== null}
                        label={t('settings.notifications.newsletter.title')}
                        onChange={change}
                    />
                </div>
            </div>
            <p className="notification-settings__note">{t('settings.notifications.newsletter.consent')}</p>
        </section>
    );
};
