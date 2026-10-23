import { app, globalShortcut } from 'electron';
import type { DesktopPreferences, DesktopPreferencesInfo } from '../contract';
import { IS_DEV } from '../config';
import { getSettings, updateSettings } from '../store';
import { toggleCapture } from '../windows/auxWindows';
import { toggleQuickAccess } from '../windows/quickAccess';
import { applyCalendarSettings, calendarStatus, calendarSupported } from './calendar';
import { applyMediaKeySetting } from './focus';

const isMac = process.platform === 'darwin';

/** Defaults avoid bare Ctrl+Alt on Windows (AltGr on German layouts) and common macOS system shortcuts. */
export const DEFAULT_SHORTCUTS = {
    quickAccess: isMac ? 'Alt+Command+P' : 'Control+Shift+Alt+P',
    quickCapture: isMac ? 'Control+Command+N' : 'Control+Shift+Alt+N'
};

const registered: string[] = [];

const register = (accelerator: string | null | undefined, handler: () => void) => {
    if (!accelerator) return;
    try {
        if (globalShortcut.register(accelerator, handler)) registered.push(accelerator);
        else console.warn(`[desktop] global shortcut ${accelerator} is taken by another app`);
    } catch (error) {
        console.warn(`[desktop] invalid global shortcut ${accelerator}`, error);
    }
};

const resolveShortcut = (value: string | null | undefined, fallback: string) => (value === undefined ? fallback : value);

export const applyGlobalShortcuts = () => {
    registered.splice(0).forEach((accelerator) => globalShortcut.unregister(accelerator));
    const settings = getSettings();
    register(resolveShortcut(settings.quickAccessShortcut, DEFAULT_SHORTCUTS.quickAccess), toggleQuickAccess);
    register(resolveShortcut(settings.quickCaptureShortcut, DEFAULT_SHORTCUTS.quickCapture), toggleCapture);
};

/** Launch at login only for the packaged app (dev would register the bare Electron binary). */
const applyLoginItem = () => {
    if (IS_DEV) return;
    app.setLoginItemSettings({ openAtLogin: getSettings().launchAtLogin });
};

export const getPreferences = (): DesktopPreferencesInfo => {
    const settings = getSettings();
    return {
        launchAtLogin: settings.launchAtLogin,
        quickCaptureShortcut: resolveShortcut(settings.quickCaptureShortcut, DEFAULT_SHORTCUTS.quickCapture),
        quickAccessShortcut: resolveShortcut(settings.quickAccessShortcut, DEFAULT_SHORTCUTS.quickAccess),
        dayStartEnabled: settings.dayStartEnabled,
        dayCloseEnabled: settings.dayCloseEnabled,
        dayCloseTime: settings.dayCloseTime,
        calendarEnabled: settings.calendarEnabled,
        meetingLeadMinutes: settings.meetingLeadMinutes,
        focusShortcutOn: settings.focusShortcutOn,
        focusShortcutOff: settings.focusShortcutOff,
        mediaKeysEnabled: settings.mediaKeysEnabled,
        supports: {
            calendar: calendarSupported(),
            focusShortcuts: isMac,
            touchBar: isMac,
            notificationActions: isMac
        },
        calendarStatus: calendarStatus()
    };
};

const isShortcut = (value: unknown) => value === null || (typeof value === 'string' && value.length < 60 && /^[\w+]+$/.test(value));

/** Validates every field; unknown keys and wrong types are ignored. */
export const setPreferences = async (patch: unknown): Promise<DesktopPreferencesInfo> => {
    if (!patch || typeof patch !== 'object') return getPreferences();
    const input = patch as Partial<DesktopPreferences>;
    const next: Partial<ReturnType<typeof getSettings>> = {};
    const bool = (key: 'launchAtLogin' | 'dayStartEnabled' | 'dayCloseEnabled' | 'calendarEnabled' | 'mediaKeysEnabled') => {
        if (typeof input[key] === 'boolean') next[key] = input[key];
    };
    bool('launchAtLogin');
    bool('dayStartEnabled');
    bool('dayCloseEnabled');
    bool('calendarEnabled');
    bool('mediaKeysEnabled');
    if (typeof input.dayCloseTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.dayCloseTime)) {
        next.dayCloseTime = input.dayCloseTime;
        next.lastDayClose = undefined;
    }
    if (typeof input.meetingLeadMinutes === 'number' && input.meetingLeadMinutes >= 1 && input.meetingLeadMinutes <= 30) {
        next.meetingLeadMinutes = Math.round(input.meetingLeadMinutes);
    }
    if (typeof input.focusShortcutOn === 'string') next.focusShortcutOn = input.focusShortcutOn.slice(0, 120);
    if (typeof input.focusShortcutOff === 'string') next.focusShortcutOff = input.focusShortcutOff.slice(0, 120);
    if ('quickCaptureShortcut' in input && isShortcut(input.quickCaptureShortcut)) next.quickCaptureShortcut = input.quickCaptureShortcut;
    if ('quickAccessShortcut' in input && isShortcut(input.quickAccessShortcut)) next.quickAccessShortcut = input.quickAccessShortcut;

    const before = getSettings();
    updateSettings(next);
    if ('launchAtLogin' in next) applyLoginItem();
    if ('quickCaptureShortcut' in next || 'quickAccessShortcut' in next) applyGlobalShortcuts();
    if ('mediaKeysEnabled' in next) applyMediaKeySetting();
    if ('calendarEnabled' in next && next.calendarEnabled !== before.calendarEnabled) await applyCalendarSettings();
    return getPreferences();
};

export const initPreferences = () => {
    applyLoginItem();
    applyGlobalShortcuts();
    void applyCalendarSettings();
};
