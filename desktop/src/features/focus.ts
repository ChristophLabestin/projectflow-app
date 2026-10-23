import { TouchBar, globalShortcut } from 'electron';
import { execFile } from 'node:child_process';
import type { TraySnapshot } from '../contract';
import { labels } from '../labels';
import { getSettings } from '../store';
import { getMainWindow, sendCommand } from '../windows/mainWindow';
import { showCapture } from '../windows/auxWindows';
import { toggleQuickAccess } from '../windows/quickAccess';

/**
 * Focus-task side effects that only a desktop shell can do:
 * - macOS Focus-mode coupling via user-chosen Shortcuts (`shortcuts run …`) when a focus starts / stops,
 * - Touch Bar controls on the main window,
 * - optional media key (Play/Pause) toggling the focus.
 */

type Focus = NonNullable<TraySnapshot['focus']>;

let focus: Focus | null = null;
let mediaKeyRegistered = false;

export const getFocusSnapshot = () => focus;

const runShortcut = (name: string) => {
    if (process.platform !== 'darwin' || !name.trim()) return;
    execFile('/usr/bin/shortcuts', ['run', name.trim()], { timeout: 30_000 }, (error) => {
        if (error) console.warn(`[desktop] Shortcut "${name}" failed`, error.message);
    });
};

const toggleFocus = () => {
    if (!focus) return;
    sendCommand({ command: focus.status === 'active' ? 'focus-pause' : 'focus-resume' });
};

const buildTouchBar = () => {
    const l = labels();
    const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;
    const title = focus ? `◉ ${focus.title.length > 40 ? `${focus.title.slice(0, 39)}…` : focus.title}` : l.focusNone;
    return new TouchBar({
        items: [
            new TouchBarButton({ label: l.quickCapture, click: () => showCapture() }),
            new TouchBarButton({ label: l.quickAccess, click: () => toggleQuickAccess() }),
            new TouchBarSpacer({ size: 'flexible' }),
            new TouchBarLabel({ label: title }),
            ...(focus ? [
                new TouchBarButton({
                    label: focus.status === 'active' ? l.focusPause : l.focusResume,
                    click: toggleFocus
                }),
                new TouchBarButton({ label: l.focusComplete, backgroundColor: '#16a34a', click: () => sendCommand({ command: 'focus-complete' }) })
            ] : [])
        ]
    });
};

export const refreshTouchBar = () => {
    if (process.platform !== 'darwin') return;
    getMainWindow()?.setTouchBar(buildTouchBar());
};

/** Play/Pause toggles the focus; opt-in because it takes the key away from music players. */
export const applyMediaKeySetting = () => {
    const wanted = getSettings().mediaKeysEnabled && Boolean(focus);
    if (wanted && !mediaKeyRegistered) {
        mediaKeyRegistered = globalShortcut.register('MediaPlayPause', toggleFocus);
    } else if (!wanted && mediaKeyRegistered) {
        globalShortcut.unregister('MediaPlayPause');
        mediaKeyRegistered = false;
    }
};

export const updateFocus = (next: TraySnapshot['focus']) => {
    const wasActive = focus?.status === 'active';
    const isActive = next?.status === 'active';
    const changed = focus?.id !== next?.id || focus?.status !== next?.status || focus?.title !== next?.title;
    focus = next;
    if (!changed) return;

    if (isActive && !wasActive) runShortcut(getSettings().focusShortcutOn);
    if (!isActive && wasActive) runShortcut(getSettings().focusShortcutOff);
    refreshTouchBar();
    applyMediaKeySetting();
};
