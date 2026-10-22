import { describe, expect, it } from 'vitest';

import {
    addDays,
    clockLabel,
    dayOfInstant,
    daysBetween,
    startOfDay,
    toDay,
    toInstant,
    wallTimeToInstant,
    weekdayIndex
} from '../zonedDate';

const BERLIN = 'Europe/Berlin';
const LA = 'America/Los_Angeles';

describe('zonedDate', () => {
    it('maps an instant to the calendar day of the time zone', () => {
        const instant = Date.parse('2026-10-22T22:30:00.000Z');
        expect(dayOfInstant(instant, BERLIN)).toBe('2026-10-23');
        expect(dayOfInstant(instant, LA)).toBe('2026-10-22');
        expect(dayOfInstant(instant, 'UTC')).toBe('2026-10-22');
    });

    it('keeps date-only strings stable in every time zone', () => {
        expect(toDay('2026-10-22', BERLIN)).toBe('2026-10-22');
        expect(toDay('2026-10-22', LA)).toBe('2026-10-22');
        expect(toDay('2026-10-22', 'Pacific/Auckland')).toBe('2026-10-22');
    });

    it('reads offset-less ISO date-times as wall-clock time in the zone', () => {
        expect(toInstant('2026-10-22T07:30:00', BERLIN)).toBe(Date.parse('2026-10-22T05:30:00.000Z'));
        expect(toInstant('2026-10-22T07:30:00', LA)).toBe(Date.parse('2026-10-22T14:30:00.000Z'));
        expect(toInstant('2026-10-21T23:30:00+05:30', BERLIN)).toBe(Date.parse('2026-10-21T18:00:00.000Z'));
    });

    it('reads Timestamp-like objects and ignores nanoseconds', () => {
        expect(toInstant({ seconds: 1_700_000_000, nanoseconds: 999_000_000 }, BERLIN)).toBe(1_700_000_000_000);
        expect(toInstant({ _seconds: 1_700_000_000 }, BERLIN)).toBe(1_700_000_000_000);
        expect(toInstant({ toDate: () => new Date(5000) }, BERLIN)).toBe(5000);
        expect(toInstant('', BERLIN)).toBeNull();
        expect(toInstant(null, BERLIN)).toBeNull();
    });

    it('finds the start of a day across DST changes', () => {
        // Berlin falls back on 2026-10-25: that day has 25 hours.
        expect(startOfDay('2026-10-25', BERLIN)).toBe(Date.parse('2026-10-24T22:00:00.000Z'));
        expect(startOfDay('2026-10-26', BERLIN)).toBe(Date.parse('2026-10-25T23:00:00.000Z'));
        expect(wallTimeToInstant(2026, 10, 22, 0, 0, 0, LA)).toBe(Date.parse('2026-10-22T07:00:00.000Z'));
    });

    it('does calendar arithmetic without a time zone', () => {
        expect(daysBetween('2026-10-22', '2026-10-29')).toBe(7);
        expect(daysBetween('2026-10-25', '2026-10-24')).toBe(-1);
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
        expect(weekdayIndex('2026-10-22')).toBe(3); // Thursday
        expect(weekdayIndex('2026-10-26')).toBe(0); // Monday
    });

    it('formats the wall-clock time', () => {
        expect(clockLabel(Date.parse('2026-10-25T00:30:00.000Z'), BERLIN)).toBe('02:30');
        expect(clockLabel(Date.parse('2026-10-25T01:30:00.000Z'), BERLIN)).toBe('02:30');
        expect(clockLabel(Date.parse('2026-10-22T07:05:00.000Z'), LA)).toBe('00:05');
    });
});
