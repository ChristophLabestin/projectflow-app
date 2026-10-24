import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { auth } from '../../services/firebase';
import { getUserProfile, updateUserData } from '../../services/domain/usersService';
import { useLanguage } from '../../context/LanguageContext';
import {
    NOTIFICATION_CATEGORIES,
    isValidTime,
    isValidTimeZone,
    resolveNotificationPrefs,
    toStoredNotificationPrefs,
    type NotificationCategory,
    type ResolvedNotificationPrefs
} from '../../utils/notificationPrefs';
import { browserTimeZone } from '../../utils/zonedDate';
import { SettingsSwitch } from './SettingsSwitch';
import { PlatformNewsletterCard } from './PlatformNewsletterCard';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type Channel = 'push' | 'email';
type Nudge = 'morningBriefing' | 'dayClose';

const FALLBACK_TIME_ZONES = [
    'UTC', 'Europe/Berlin', 'Europe/London', 'Europe/Paris', 'Europe/Zurich', 'Europe/Vienna', 'America/New_York',
    'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore',
    'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland'
];

const listTimeZones = (current: string): string[] => {
    let zones: string[] = FALLBACK_TIME_ZONES;
    try {
        const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone');
        if (supported && supported.length > 0) zones = supported;
    } catch {
        zones = FALLBACK_TIME_ZONES;
    }
    return zones.includes(current) ? zones : [current, ...zones];
};

/**
 * "Notifications" tab of the personal settings: push/email per category,
 * morning briefing, day close and the time zone (users/{uid}.notificationPrefs,
 * contract C3). Every change is saved immediately; the browser time zone is
 * detected and saved the first time the panel opens.
 */
export const NotificationSettingsPanel: React.FC = () => {
    const { t } = useLanguage();
    const detectedZone = useMemo(() => browserTimeZone(), []);
    const [prefs, setPrefs] = useState<ResolvedNotificationPrefs | null>(null);
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const latestRef = useRef<ResolvedNotificationPrefs | null>(null);
    const savedTimerRef = useRef<number | null>(null);

    const persist = useCallback(async (next: ResolvedNotificationPrefs) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setSaveState('saving');
        try {
            await updateUserData(uid, { notificationPrefs: toStoredNotificationPrefs(next) });
            setSaveState('saved');
            if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
            savedTimerRef.current = window.setTimeout(() => setSaveState('idle'), 2000);
        } catch (error) {
            console.error('Failed to save notification preferences', error);
            setSaveState('error');
        }
    }, []);

    useEffect(() => {
        let alive = true;
        const uid = auth.currentUser?.uid;
        if (!uid) return undefined;
        (async () => {
            try {
                const profile = await getUserProfile(uid);
                if (!alive) return;
                const stored = profile?.notificationPrefs;
                const resolved = resolveNotificationPrefs(stored, detectedZone);
                latestRef.current = resolved;
                setPrefs(resolved);
                // First visit: save the detected time zone so the server nudges in local time.
                if (!isValidTimeZone(stored?.timezone)) void persist(resolved);
            } catch (error) {
                console.error('Failed to load notification preferences', error);
                if (!alive) return;
                const fallback = resolveNotificationPrefs(undefined, detectedZone);
                latestRef.current = fallback;
                setPrefs(fallback);
            }
        })();
        return () => {
            alive = false;
            if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
        };
    }, [detectedZone, persist]);

    const update = (change: (current: ResolvedNotificationPrefs) => ResolvedNotificationPrefs) => {
        const current = latestRef.current;
        if (!current) return;
        const next = change(current);
        latestRef.current = next;
        setPrefs(next);
        void persist(next);
    };

    const toggleChannel = (channel: Channel, category: NotificationCategory, value: boolean) => {
        update((current) => ({ ...current, [channel]: { ...current[channel], [category]: value } }));
    };

    const updateNudge = (nudge: Nudge, change: Partial<{ enabled: boolean; time: string }>) => {
        update((current) => ({ ...current, [nudge]: { ...current[nudge], ...change } }));
    };

    const timeZones = useMemo(() => listTimeZones(prefs?.timezone || detectedZone), [detectedZone, prefs?.timezone]);

    if (!prefs) {
        return <p className="notification-settings__status">{t('settings.notifications.loading')}</p>;
    }

    const statusLabel = saveState === 'saving'
        ? t('settings.notifications.status.saving')
        : saveState === 'saved'
            ? t('settings.notifications.status.saved')
            : saveState === 'error'
                ? t('settings.notifications.status.error')
                : '';

    const renderNudge = (nudge: Nudge, titleKey: string, hintKey: string) => (
        <div className="notification-settings__row">
            <div className="notification-settings__copy">
                <strong>{t(titleKey)}</strong>
                <span>{t(hintKey)}</span>
            </div>
            <div className="notification-settings__controls">
                <input
                    type="time"
                    className="notification-settings__time"
                    value={prefs[nudge].time}
                    disabled={!prefs[nudge].enabled}
                    aria-label={`${t(titleKey)}: ${t('settings.notifications.time')}`}
                    onChange={(event) => {
                        if (isValidTime(event.target.value)) updateNudge(nudge, { time: event.target.value });
                    }}
                />
                <SettingsSwitch
                    checked={prefs[nudge].enabled}
                    label={t(titleKey)}
                    onChange={(enabled) => updateNudge(nudge, { enabled })}
                />
            </div>
        </div>
    );

    return (
        <div className="notification-settings animate-fade-in">
            <div className="notification-settings__header">
                <div>
                    <h2>{t('settings.notifications.title')}</h2>
                    <p>{t('settings.notifications.subtitle')}</p>
                </div>
                <span className={`notification-settings__status ${saveState === 'error' ? 'is-error' : ''}`.trim()} role="status" aria-live="polite">
                    {statusLabel}
                </span>
            </div>

            <section className="notification-settings__card" aria-labelledby="notification-settings-channels">
                <h3 id="notification-settings-channels">{t('settings.notifications.channels.title')}</h3>
                <div className="notification-settings__matrix">
                    <span className="notification-settings__matrix-head notification-settings__matrix-head--label" />
                    <span className="notification-settings__matrix-head">{t('settings.notifications.channel.push')}</span>
                    <span className="notification-settings__matrix-head">{t('settings.notifications.channel.email')}</span>
                    {NOTIFICATION_CATEGORIES.map((category) => (
                        <React.Fragment key={category}>
                            <div className="notification-settings__copy">
                                <strong>{t(`settings.notifications.category.${category}`)}</strong>
                                <span>{t(`settings.notifications.category.${category}.hint`)}</span>
                            </div>
                            <div className="notification-settings__cell">
                                <SettingsSwitch
                                    checked={prefs.push[category]}
                                    label={`${t(`settings.notifications.category.${category}`)} · ${t('settings.notifications.channel.push')}`}
                                    onChange={(value) => toggleChannel('push', category, value)}
                                />
                            </div>
                            <div className="notification-settings__cell">
                                <SettingsSwitch
                                    checked={prefs.email[category]}
                                    label={`${t(`settings.notifications.category.${category}`)} · ${t('settings.notifications.channel.email')}`}
                                    onChange={(value) => toggleChannel('email', category, value)}
                                />
                            </div>
                        </React.Fragment>
                    ))}
                </div>
                <p className="notification-settings__note">{t('settings.notifications.channels.note')}</p>
            </section>

            <section className="notification-settings__card" aria-labelledby="notification-settings-rhythm">
                <h3 id="notification-settings-rhythm">{t('settings.notifications.rhythm.title')}</h3>
                {renderNudge('morningBriefing', 'settings.notifications.morning.title', 'settings.notifications.morning.hint')}
                {renderNudge('dayClose', 'settings.notifications.dayClose.title', 'settings.notifications.dayClose.hint')}

                <div className="notification-settings__row">
                    <div className="notification-settings__copy">
                        <strong>{t('settings.notifications.timezone.title')}</strong>
                        <span>{t('settings.notifications.timezone.hint')}</span>
                    </div>
                    <div className="notification-settings__controls notification-settings__controls--stack">
                        <select
                            className="notification-settings__select"
                            value={prefs.timezone}
                            aria-label={t('settings.notifications.timezone.title')}
                            onChange={(event) => update((current) => ({ ...current, timezone: event.target.value }))}
                        >
                            {timeZones.map((zone) => (
                                <option key={zone} value={zone}>{zone}</option>
                            ))}
                        </select>
                        {prefs.timezone !== detectedZone && (
                            <button
                                type="button"
                                className="notification-settings__link"
                                onClick={() => update((current) => ({ ...current, timezone: detectedZone }))}
                            >
                                {t('settings.notifications.timezone.useDevice').replace('{zone}', detectedZone)}
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <PlatformNewsletterCard />
        </div>
    );
};
