import { describe, expect, it } from 'vitest';

import {
    DEFAULT_DAY_CLOSE_TIME,
    DEFAULT_MORNING_TIME,
    isValidTime,
    isValidTimeZone,
    resolveNotificationPrefs,
    toStoredNotificationPrefs
} from '../notificationPrefs';

describe('notificationPrefs', () => {
    it('applies the contract defaults', () => {
        const prefs = resolveNotificationPrefs(undefined, 'Europe/Berlin');
        expect(prefs.timezone).toBe('Europe/Berlin');
        expect(Object.values(prefs.push).every(Boolean)).toBe(true);
        expect(prefs.email).toEqual({ assignments: true, mentions: true, comments: false, due: false, reminders: false });
        expect(prefs.morningBriefing).toEqual({ enabled: false, time: DEFAULT_MORNING_TIME });
        expect(prefs.dayClose).toEqual({ enabled: false, time: DEFAULT_DAY_CLOSE_TIME });
    });

    it('keeps saved values and falls back per field', () => {
        const prefs = resolveNotificationPrefs({
            timezone: 'America/Los_Angeles',
            push: { comments: false },
            email: { due: true },
            morningBriefing: { enabled: true, time: '07:15' },
            dayClose: { enabled: true, time: '25:99' }
        }, 'Europe/Berlin');
        expect(prefs.timezone).toBe('America/Los_Angeles');
        expect(prefs.push).toMatchObject({ comments: false, assignments: true });
        expect(prefs.email).toMatchObject({ due: true, mentions: true });
        expect(prefs.morningBriefing).toEqual({ enabled: true, time: '07:15' });
        expect(prefs.dayClose).toEqual({ enabled: true, time: DEFAULT_DAY_CLOSE_TIME });
    });

    it('rejects unknown time zones and malformed times', () => {
        expect(resolveNotificationPrefs({ timezone: 'Not/AZone' }, 'UTC').timezone).toBe('UTC');
        expect(isValidTimeZone('Europe/Berlin')).toBe(true);
        expect(isValidTimeZone('')).toBe(false);
        expect(isValidTime('08:00')).toBe(true);
        expect(isValidTime('8:00')).toBe(false);
        expect(isValidTime('24:00')).toBe(false);
    });

    it('serializes a complete object without undefined values', () => {
        const stored = toStoredNotificationPrefs(resolveNotificationPrefs(undefined, 'UTC'));
        expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
        expect(Object.keys(stored).sort()).toEqual(['dayClose', 'email', 'morningBriefing', 'push', 'timezone']);
    });
});
