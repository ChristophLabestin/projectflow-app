import { app, globalShortcut } from 'electron';
import type { DesktopPreferences, DesktopPreferencesInfo } from '../contract';
import { IS_DEV } from '../config';
import { getSettings, updateSettings } from '../store';
import { toggleCapture } from '../windows/auxWindows';
import { toggleQuickAccess } from '../windows/quickAccess';
import { togglePalette } from '../windows/paletteWindow';
import { captureScreenshotToTask } from './screenshot';
import { runCommand } from '../menu';
import { applyCalendarSettings, calendarStatus, calendarSupported } from './calendar';
import { applyMediaKeySetting } from './focus';
import { reindexSpotlight, spotlightSupported } from './spotlight';

const isMac = process.platform === 'darwin';

/** Defaults avoid bare Ctrl+Alt on Windows (AltGr on German layouts) and common macOS system shortcuts. */
export const DEFAULT_SHORTCUTS = {
    quickAccess: isMac ? 'Alt+Command+P' : 'Control+Shift+Alt+P',
    quickCapture: isMac ? 'Control+Command+N' : 'Control+Shift+Alt+N',
    palette: isMac ? 'Control+Command+K' : 'Control+Shift+Alt+K',
    screenshot: isMac ? 'Control+Command+S' : 'Control+Shift+Alt+S',
    ai: isMac ? 'Control+Command+J' : 'Control+Shift+Alt+J'
};

const registered: string[] = [];

/** Returns false when the combination is taken by another app or invalid. */
const register = (accelerator: string | null | undefined, handler: () => void) => {
    if (!accelerator) return true;
    try {
        if (globalShortcut.register(accelerator, handler)) {
            registered.push(accelerator);
            return true;
        }
        console.warn(`[desktop] global shortcut ${accelerator} is taken by another app`);
    } catch (error) {
        console.warn(`[desktop] invalid global shortcut ${accelerator}`, error);
    }
    return false;
};

const resolveShortcut = (value: string | null | undefined, fallback: string) => (value === undefined ? fallback : value);

export const applyGlobalShortcuts = () => {
    registered.splice(0).forEach((accelerator) => globalShortcut.unregister(accelerator));
    // Dev runs next to the installed app, which owns the global shortcuts (opt in: PF_DESKTOP_DEV_SHORTCUTS=1).
    if (IS_DEV && process.env.PF_DESKTOP_DEV_SHORTCUTS !== '1') return true;
    const settings = getSettings();
    const access = register(resolveShortcut(settings.quickAccessShortcut, DEFAULT_SHORTCUTS.quickAccess), toggleQuickAccess);
    const capture = register(resolveShortcut(settings.quickCaptureShortcut, DEFAULT_SHORTCUTS.quickCapture), toggleCapture);
    const palette = register(resolveShortcut(settings.paletteShortcut, DEFAULT_SHORTCUTS.palette), togglePalette);
    const screenshot = register(resolveShortcut(settings.screenshotShortcut, DEFAULT_SHORTCUTS.screenshot), () => void captureScreenshotToTask());
    const ai = register(resolveShortcut(settings.aiShortcut, DEFAULT_SHORTCUTS.ai), () => runCommand('open-ai'));
    return access && capture && palette && screenshot && ai;
};

/** Launch at login only for the packaged app (dev would register the bare Electron binary). */
const applyLoginItem = () => {
    if (IS_DEV) return;
    const openAtLogin = getSettings().launchAtLogin;
    // Only touch the login item when it changes (unsigned macOS builds may not change it at all).
    if (app.getLoginItemSettings().openAtLogin === openAtLogin) return;
    app.setLoginItemSettings({ openAtLogin, args: ['--hidden'] });
};

/** Started by the login item: open quietly into the menu bar / tray. */
export const launchedHidden = () => process.argv.includes('--hidden') || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin === true);

export const getPreferences = (): DesktopPreferencesInfo => {
    const settings = getSettings();
    return {
        launchAtLogin: settings.launchAtLogin,
        quickCaptureShortcut: resolveShortcut(settings.quickCaptureShortcut, DEFAULT_SHORTCUTS.quickCapture),
        quickAccessShortcut: resolveShortcut(settings.quickAccessShortcut, DEFAULT_SHORTCUTS.quickAccess),
        paletteShortcut: resolveShortcut(settings.paletteShortcut, DEFAULT_SHORTCUTS.palette),
        screenshotShortcut: resolveShortcut(settings.screenshotShortcut, DEFAULT_SHORTCUTS.screenshot),
        aiShortcut: resolveShortcut(settings.aiShortcut, DEFAULT_SHORTCUTS.ai),
        dayStartEnabled: settings.dayStartEnabled,
        dayCloseEnabled: settings.dayCloseEnabled,
        dayCloseTime: settings.dayCloseTime,
        calendarEnabled: settings.calendarEnabled,
        meetingLeadMinutes: settings.meetingLeadMinutes,
        focusShortcutOn: settings.focusShortcutOn,
        focusShortcutOff: settings.focusShortcutOff,
        mediaKeysEnabled: settings.mediaKeysEnabled,
        spotlightEnabled: settings.spotlightEnabled,
        supports: {
            calendar: calendarSupported(),
            focusShortcuts: isMac,
            touchBar: isMac,
            notificationActions: isMac,
            spotlight: spotlightSupported()
        },
        calendarStatus: calendarStatus()
    };
};

/** Global shortcuts need Ctrl or Cmd (Shift/Alt-only combos would hijack typing; Ctrl+Alt alone is AltGr). */
const isShortcut = (value: unknown) => value === null || (
    typeof value === 'string' && value.length < 60 && /^[\w+]+$/.test(value)
    && /(^|\+)(Command|Control|CommandOrControl|CmdOrCtrl|Super)(\+|$)/.test(value)
    && !/^Control\+Alt\+[^+]+$/.test(value)
);

/** Validates every field; unknown keys and wrong types are ignored. */
export const setPreferences = async (patch: unknown): Promise<DesktopPreferencesInfo> => {
    if (!patch || typeof patch !== 'object') return getPreferences();
    const input = patch as Partial<DesktopPreferences>;
    const next: Partial<ReturnType<typeof getSettings>> = {};
    const bool = (key: 'launchAtLogin' | 'dayStartEnabled' | 'dayCloseEnabled' | 'calendarEnabled' | 'mediaKeysEnabled' | 'spotlightEnabled') => {
        if (typeof input[key] === 'boolean') next[key] = input[key];
    };
    bool('launchAtLogin');
    bool('dayStartEnabled');
    bool('dayCloseEnabled');
    bool('calendarEnabled');
    bool('mediaKeysEnabled');
    bool('spotlightEnabled');
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
    if ('paletteShortcut' in input && isShortcut(input.paletteShortcut)) next.paletteShortcut = input.paletteShortcut;
    if ('screenshotShortcut' in input && isShortcut(input.screenshotShortcut)) next.screenshotShortcut = input.screenshotShortcut;
    if ('aiShortcut' in input && isShortcut(input.aiShortcut)) next.aiShortcut = input.aiShortcut;

    const before = getSettings();
    updateSettings(next);
    if ('launchAtLogin' in next) applyLoginItem();
    if (['quickCaptureShortcut', 'quickAccessShortcut', 'paletteShortcut', 'screenshotShortcut', 'aiShortcut'].some((key) => key in next)) {
        if (!applyGlobalShortcuts()) {
            // Taken by another app: keep the previous combination working and report the conflict.
            updateSettings({
                quickCaptureShortcut: before.quickCaptureShortcut,
                quickAccessShortcut: before.quickAccessShortcut,
                paletteShortcut: before.paletteShortcut,
                screenshotShortcut: before.screenshotShortcut,
                aiShortcut: before.aiShortcut
            });
            applyGlobalShortcuts();
            return { ...getPreferences(), shortcutConflict: true };
        }
    }
    if ('mediaKeysEnabled' in next) applyMediaKeySetting();
    if ('spotlightEnabled' in next) reindexSpotlight();
    if ('calendarEnabled' in next && next.calendarEnabled !== before.calendarEnabled) await applyCalendarSettings();
    return getPreferences();
};

export const initPreferences = () => {
    applyLoginItem();
    applyGlobalShortcuts();
    void applyCalendarSettings();
};
