import { powerMonitor } from 'electron';
import { labels } from '../labels';
import { getSettings, todayKey, updateSettings } from '../store';
import { openDayWindow } from '../windows/auxWindows';
import { showNativeNotification } from './notifications';

/**
 * Day rhythm:
 * - Day start: the first unlock / wake / launch of the morning (5:00–12:00) opens the day plan window once a day.
 * - Day close: at the configured time — only while the user is actually at the computer — a notification
 *   offers to close the day (opens the day window in close mode).
 */

const MORNING_START_HOUR = 5;
const MORNING_END_HOUR = 12;
const ACTIVE_IDLE_LIMIT_S = 10 * 60;

let timer: NodeJS.Timeout | null = null;

const minutesOfDay = (date = new Date()) => date.getHours() * 60 + date.getMinutes();
const parseTime = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 17 * 60 + 30;
};

const maybeStartDay = () => {
    const settings = getSettings();
    const hour = new Date().getHours();
    if (!settings.dayStartEnabled || settings.lastDayStart === todayKey()) return;
    if (hour < MORNING_START_HOUR || hour >= MORNING_END_HOUR) return;
    updateSettings({ lastDayStart: todayKey() });
    openDayWindow('start');
};

const maybeCloseDay = () => {
    const settings = getSettings();
    if (!settings.dayCloseEnabled || settings.lastDayClose === todayKey()) return;
    if (minutesOfDay() < parseTime(settings.dayCloseTime)) return;
    if (powerMonitor.getSystemIdleTime() > ACTIVE_IDLE_LIMIT_S) return;
    updateSettings({ lastDayClose: todayKey() });
    const l = labels();
    showNativeNotification({
        key: 'day-close',
        title: l.dayCloseTitle,
        body: l.dayCloseBody,
        actions: [l.dayCloseAction],
        onClick: () => openDayWindow('close'),
        onAction: () => openDayWindow('close')
    });
};

export const startDayFlow = () => {
    // Give the app a moment to sign in before the plan window loads.
    setTimeout(maybeStartDay, 4000);
    powerMonitor.on('unlock-screen', maybeStartDay);
    powerMonitor.on('resume', maybeStartDay);
    powerMonitor.on('user-did-become-active', maybeStartDay);
    timer = setInterval(maybeCloseDay, 60 * 1000);
};

export const stopDayFlow = () => {
    if (timer) clearInterval(timer);
    timer = null;
};
