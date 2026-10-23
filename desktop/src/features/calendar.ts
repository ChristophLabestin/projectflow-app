import { app } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { labels } from '../labels';
import { getSettings } from '../store';
import { sendCommand } from '../windows/mainWindow';
import { showCapture } from '../windows/auxWindows';
import { getFocusSnapshot } from './focus';
import { showNativeNotification } from './notifications';

/**
 * Meeting awareness (macOS): reads the system calendars through the bundled EventKit helper (pf-calendar)
 * and nudges around meetings — "starts in 5 min, pause focus?" and afterwards "capture notes as tasks?".
 * Windows has no comparable local calendar API; the feature is reported as unsupported there.
 */

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
}

const POLL_MS = 2 * 60 * 1000;
const TICK_MS = 30 * 1000;

let events: CalendarEvent[] = [];
let pollTimer: NodeJS.Timeout | null = null;
let tickTimer: NodeJS.Timeout | null = null;
let status: 'unknown' | 'granted' | 'denied' | 'unavailable' = 'unknown';
let generation = 0;
const notifiedStart = new Set<string>();
const notifiedEnd = new Set<string>();

const helperPath = () => (app.isPackaged
    ? path.join(process.resourcesPath, 'native', 'pf-calendar')
    : path.join(__dirname, 'native', 'pf-calendar'));

export const calendarSupported = () => process.platform === 'darwin' && fs.existsSync(helperPath());
export const calendarStatus = () => (calendarSupported() ? status : 'unavailable');

const fetchEvents = () => new Promise<void>((resolve) => {
    execFile(helperPath(), ['12'], { timeout: 130_000 }, (error, stdout) => {
        if (error) {
            resolve();
            return;
        }
        try {
            const parsed = JSON.parse(stdout) as { status: 'granted' | 'denied'; events: CalendarEvent[] };
            status = parsed.status;
            events = Array.isArray(parsed.events) ? parsed.events : [];
        } catch {
            // ignore malformed output
        }
        resolve();
    });
});

const tick = () => {
    const now = Date.now();
    const leadMs = Math.max(1, getSettings().meetingLeadMinutes) * 60 * 1000;
    const l = labels();
    for (const event of events) {
        const start = Date.parse(event.start);
        const end = Date.parse(event.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

        if (!notifiedStart.has(event.id) && start - now <= leadMs && start - now > -60_000) {
            notifiedStart.add(event.id);
            const minutes = Math.max(0, Math.round((start - now) / 60000));
            const focus = getFocusSnapshot();
            const hasActiveFocus = focus?.status === 'active';
            showNativeNotification({
                key: `meeting-start:${event.id}`,
                title: l.meetingSoonTitle.replace('{minutes}', String(minutes)),
                body: hasActiveFocus ? `${event.title} · ${l.meetingPauseFocusHint.replace('{task}', focus!.title)}` : event.title,
                actions: hasActiveFocus ? [l.meetingPauseFocus] : [],
                onAction: () => sendCommand({ command: 'focus-pause', data: { minutes: Math.max(15, Math.round((end - now) / 60000)) } })
            });
        }

        if (!notifiedEnd.has(event.id) && now >= end && now - end < 10 * 60 * 1000) {
            notifiedEnd.add(event.id);
            const prefill = `${l.meetingNotesPrefix} ${event.title}: `;
            showNativeNotification({
                key: `meeting-end:${event.id}`,
                title: l.meetingEndedTitle,
                body: l.meetingEndedBody.replace('{title}', event.title),
                actions: [l.meetingCapture],
                onClick: () => showCapture(prefill),
                onAction: () => showCapture(prefill)
            });
        }
    }
};

/** Meetings that have not ended yet (menu bar panel), at most `limit`. */
export const upcomingEvents = (limit = 3) => {
    if (!getSettings().calendarEnabled || status !== 'granted') return [];
    const now = Date.now();
    return events.filter((event) => Date.parse(event.end) > now).slice(0, limit);
};

export const stopCalendar = () => {
    if (pollTimer) clearInterval(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    pollTimer = null;
    tickTimer = null;
    events = [];
};

/** (Re)starts polling according to the settings; the first fetch triggers the macOS permission prompt. */
export const applyCalendarSettings = async () => {
    stopCalendar();
    const run = ++generation;
    if (!getSettings().calendarEnabled || !calendarSupported()) return;
    await fetchEvents();
    // The first fetch can wait on the permission prompt; the setting may have changed meanwhile.
    if (run !== generation || !getSettings().calendarEnabled || status !== 'granted') return;
    pollTimer = setInterval(() => { void fetchEvents(); }, POLL_MS);
    tickTimer = setInterval(tick, TICK_MS);
    tick();
};
