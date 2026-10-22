import { describe, expect, it } from 'vitest';
import { localizeActivityAction } from '../activityText';

const dictionary: Record<string, string> = {
    'activity.text.completedTask': 'Aufgabe „{title}“ abgeschlossen',
    'activity.text.changedStatus': 'Status von „{title}“ auf {value} geändert',
    'activity.text.changedPriority': 'Priorität von „{title}“ auf {value} geändert',
    'activity.text.assignedTask': 'Aufgabe „{title}“ zugewiesen',
    'activity.text.commentedTask': 'Aufgabe „{title}“ kommentiert'
};
const t = (key: string) => dictionary[key] ?? key;

describe('localizeActivityAction', () => {
    it('translates the entries the Cloud Functions write', () => {
        expect(localizeActivityAction('Completed task "Ship it"', t)).toBe('Aufgabe „Ship it“ abgeschlossen');
        expect(localizeActivityAction('Changed status of "Ship it" to In Progress', t)).toBe('Status von „Ship it“ auf In Progress geändert');
        expect(localizeActivityAction('Changed priority of "Ship it" to High', t)).toBe('Priorität von „Ship it“ auf High geändert');
        expect(localizeActivityAction('Assigned task "Ship it"', t)).toBe('Aufgabe „Ship it“ zugewiesen');
        expect(localizeActivityAction('Commented on task "Ship it"', t)).toBe('Aufgabe „Ship it“ kommentiert');
    });

    it('keeps the original text when a key is missing or the text is unknown', () => {
        expect(localizeActivityAction('Changed due date of "Ship it"', t)).toBe('Changed due date of "Ship it"');
        expect(localizeActivityAction('Something else entirely', t)).toBe('Something else entirely');
        expect(localizeActivityAction(undefined, t)).toBe('');
    });
});
