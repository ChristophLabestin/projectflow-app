import React, { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    getDesktopBridge,
    type DesktopPreferences,
    type DesktopPreferencesInfo
} from '../../services/desktop';
import { SettingsSwitch } from './SettingsSwitch';

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift']);

/** Turns a keydown into an Electron accelerator (e.g. "Control+Command+N"); null while only modifiers are held. */
const acceleratorFromEvent = (event: React.KeyboardEvent, isMac: boolean) => {
    if (MODIFIER_KEYS.has(event.key)) return null;
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('Control');
    if (event.metaKey) parts.push(isMac ? 'Command' : 'Super');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    // Global shortcuts need Ctrl or Cmd: Shift/Alt-only combos would hijack normal typing everywhere.
    if (!event.ctrlKey && !event.metaKey) return null;
    if (!isMac && event.ctrlKey && event.altKey && !event.shiftKey && !event.metaKey) return null; // AltGr
    const code = event.code;
    const key = code.startsWith('Key') ? code.slice(3)
        : code.startsWith('Digit') ? code.slice(5)
            : code === 'Space' ? 'Space'
                : /^F\d{1,2}$/.test(code) ? code
                    : null;
    return key ? [...parts, key].join('+') : null;
};

const formatAccelerator = (value: string | null, isMac: boolean) => {
    if (!value) return '';
    if (!isMac) return value.replace(/\+/g, ' + ');
    const symbols: Record<string, string> = { Command: '⌘', Control: '⌃', Alt: '⌥', Shift: '⇧' };
    return value.split('+').map((part) => symbols[part] ?? part).join('');
};

const ShortcutField: React.FC<{
    value: string | null;
    isMac: boolean;
    label: string;
    onChange: (value: string | null) => void;
}> = ({ value, isMac, label, onChange }) => {
    const { t } = useLanguage();
    const [recording, setRecording] = useState(false);
    return (
        <div className="desktop-settings__shortcut">
            <button
                type="button"
                className={`desktop-settings__shortcut-field ${recording ? 'is-recording' : ''}`.trim()}
                aria-label={label}
                onClick={() => setRecording(true)}
                onBlur={() => setRecording(false)}
                onKeyDown={(event) => {
                    if (!recording) return;
                    event.preventDefault();
                    if (event.key === 'Escape') {
                        setRecording(false);
                        return;
                    }
                    const accelerator = acceleratorFromEvent(event, isMac);
                    if (accelerator) {
                        onChange(accelerator);
                        setRecording(false);
                    }
                }}
            >
                {recording ? t('settings.desktop.shortcut.recording') : formatAccelerator(value, isMac) || t('settings.desktop.shortcut.off')}
            </button>
            {value && (
                <button type="button" className="notification-settings__link" onClick={() => onChange(null)}>
                    {t('settings.desktop.shortcut.disable')}
                </button>
            )}
        </div>
    );
};

/** Settings → Desktop (desktop app only): shell preferences stored by the Electron shell, per device. */
export const DesktopSettingsPanel = () => {
    const { t } = useLanguage();
    const bridge = getDesktopBridge();
    const [prefs, setPrefs] = useState<DesktopPreferencesInfo | null>(null);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
    const isMac = bridge?.platform === 'darwin';

    useEffect(() => {
        let mounted = true;
        void bridge?.getPreferences?.().then((next) => { if (mounted) setPrefs(next); });
        return () => { mounted = false; };
    }, [bridge]);

    const update = useCallback(async (patch: Partial<DesktopPreferences>) => {
        if (!bridge?.setPreferences) return;
        setPrefs((current) => (current ? { ...current, ...patch } : current));
        setSaveState('saving');
        try {
            const next = await bridge.setPreferences(patch);
            setPrefs(next);
            setSaveState(next.shortcutConflict ? 'conflict' : 'saved');
        } catch {
            setSaveState('error');
        }
    }, [bridge]);

    if (!bridge || !prefs) return null;

    const row = (title: string, hint: string, control: React.ReactNode) => (
        <div className="notification-settings__row">
            <div className="notification-settings__copy">
                <strong>{title}</strong>
                <span>{hint}</span>
            </div>
            <div className="notification-settings__controls">{control}</div>
        </div>
    );

    const statusLabel = saveState === 'saving'
        ? t('settings.notifications.status.saving')
        : saveState === 'saved'
            ? t('settings.notifications.status.saved')
            : saveState === 'error'
                ? t('settings.notifications.status.error')
                : saveState === 'conflict'
                    ? t('settings.desktop.shortcut.conflict')
                    : '';

    const calendarHint = prefs.calendarStatus === 'denied'
        ? t('settings.desktop.calendar.denied')
        : t('settings.desktop.calendar.hint');

    return (
        <div className="notification-settings animate-fade-in">
            <div className="notification-settings__header">
                <div>
                    <h2>{t('settings.desktop.title')}</h2>
                    <p>{t('settings.desktop.subtitle')}</p>
                </div>
                <span className={`notification-settings__status ${saveState === 'error' || saveState === 'conflict' ? 'is-error' : ''}`.trim()} role="status" aria-live="polite">
                    {statusLabel}
                </span>
            </div>

            <section className="notification-settings__card" aria-labelledby="desktop-settings-general">
                <h3 id="desktop-settings-general">{t('settings.desktop.general.title')}</h3>
                {row(t('settings.desktop.launchAtLogin.title'), t('settings.desktop.launchAtLogin.hint'), (
                    <SettingsSwitch checked={prefs.launchAtLogin} label={t('settings.desktop.launchAtLogin.title')} onChange={(value) => void update({ launchAtLogin: value })} />
                ))}
                {row(t('settings.desktop.quickCapture.title'), t('settings.desktop.quickCapture.hint'), (
                    <ShortcutField value={prefs.quickCaptureShortcut} isMac={isMac} label={t('settings.desktop.quickCapture.title')} onChange={(value) => void update({ quickCaptureShortcut: value })} />
                ))}
                {row(t('settings.desktop.quickAccess.title'), t('settings.desktop.quickAccess.hint'), (
                    <ShortcutField value={prefs.quickAccessShortcut} isMac={isMac} label={t('settings.desktop.quickAccess.title')} onChange={(value) => void update({ quickAccessShortcut: value })} />
                ))}
            </section>

            <section className="notification-settings__card" aria-labelledby="desktop-settings-day">
                <h3 id="desktop-settings-day">{t('settings.desktop.day.title')}</h3>
                {row(t('settings.desktop.dayStart.title'), t('settings.desktop.dayStart.hint'), (
                    <SettingsSwitch checked={prefs.dayStartEnabled} label={t('settings.desktop.dayStart.title')} onChange={(value) => void update({ dayStartEnabled: value })} />
                ))}
                {row(t('settings.desktop.dayClose.title'), t('settings.desktop.dayClose.hint'), (
                    <>
                        <input
                            type="time"
                            className="notification-settings__time"
                            value={prefs.dayCloseTime}
                            disabled={!prefs.dayCloseEnabled}
                            aria-label={`${t('settings.desktop.dayClose.title')}: ${t('settings.notifications.time')}`}
                            onChange={(event) => {
                                if (/^\d{2}:\d{2}$/.test(event.target.value)) void update({ dayCloseTime: event.target.value });
                            }}
                        />
                        <SettingsSwitch checked={prefs.dayCloseEnabled} label={t('settings.desktop.dayClose.title')} onChange={(value) => void update({ dayCloseEnabled: value })} />
                    </>
                ))}
                <div className="desktop-settings__actions">
                    <button type="button" className="notification-settings__link" onClick={() => bridge.openWindow?.({ kind: 'day', mode: 'start' })}>
                        {t('settings.desktop.day.openStart')}
                    </button>
                    <button type="button" className="notification-settings__link" onClick={() => bridge.openWindow?.({ kind: 'day', mode: 'close' })}>
                        {t('settings.desktop.day.openClose')}
                    </button>
                </div>
            </section>

            {prefs.supports.calendar && (
                <section className="notification-settings__card" aria-labelledby="desktop-settings-calendar">
                    <h3 id="desktop-settings-calendar">{t('settings.desktop.calendar.title')}</h3>
                    {row(t('settings.desktop.calendar.enable'), calendarHint, (
                        <SettingsSwitch checked={prefs.calendarEnabled} label={t('settings.desktop.calendar.enable')} onChange={(value) => void update({ calendarEnabled: value })} />
                    ))}
                    {row(t('settings.desktop.calendar.lead.title'), t('settings.desktop.calendar.lead.hint'), (
                        <select
                            className="notification-settings__select"
                            value={prefs.meetingLeadMinutes}
                            disabled={!prefs.calendarEnabled}
                            aria-label={t('settings.desktop.calendar.lead.title')}
                            onChange={(event) => void update({ meetingLeadMinutes: Number(event.target.value) })}
                        >
                            {[1, 2, 5, 10, 15].map((minutes) => (
                                <option key={minutes} value={minutes}>{t('settings.desktop.calendar.lead.minutes').replace('{minutes}', String(minutes))}</option>
                            ))}
                        </select>
                    ))}
                </section>
            )}

            <section className="notification-settings__card" aria-labelledby="desktop-settings-focus">
                <h3 id="desktop-settings-focus">{t('settings.desktop.focus.title')}</h3>
                {prefs.supports.focusShortcuts && (
                    <>
                        {row(t('settings.desktop.focusOn.title'), t('settings.desktop.focusOn.hint'), (
                            <input
                                type="text"
                                className="desktop-settings__text"
                                value={prefs.focusShortcutOn}
                                placeholder={t('settings.desktop.focusOn.placeholder')}
                                aria-label={t('settings.desktop.focusOn.title')}
                                onChange={(event) => setPrefs({ ...prefs, focusShortcutOn: event.target.value })}
                                onBlur={(event) => void update({ focusShortcutOn: event.target.value.trim() })}
                            />
                        ))}
                        {row(t('settings.desktop.focusOff.title'), t('settings.desktop.focusOff.hint'), (
                            <input
                                type="text"
                                className="desktop-settings__text"
                                value={prefs.focusShortcutOff}
                                placeholder={t('settings.desktop.focusOff.placeholder')}
                                aria-label={t('settings.desktop.focusOff.title')}
                                onChange={(event) => setPrefs({ ...prefs, focusShortcutOff: event.target.value })}
                                onBlur={(event) => void update({ focusShortcutOff: event.target.value.trim() })}
                            />
                        ))}
                    </>
                )}
                {row(t('settings.desktop.mediaKeys.title'), t('settings.desktop.mediaKeys.hint'), (
                    <SettingsSwitch checked={prefs.mediaKeysEnabled} label={t('settings.desktop.mediaKeys.title')} onChange={(value) => void update({ mediaKeysEnabled: value })} />
                ))}
                {prefs.supports.spotlight && row(t('settings.desktop.spotlight.title'), t('settings.desktop.spotlight.hint'), (
                    <SettingsSwitch checked={prefs.spotlightEnabled !== false} label={t('settings.desktop.spotlight.title')} onChange={(value) => void update({ spotlightEnabled: value })} />
                ))}
                {prefs.supports.touchBar && <p className="notification-settings__note">{t('settings.desktop.touchBar.note')}</p>}
            </section>
        </div>
    );
};
