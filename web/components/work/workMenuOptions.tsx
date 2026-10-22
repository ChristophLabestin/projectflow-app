import React from 'react';
import { format, type Locale } from 'date-fns';

import { addDaysFromToday, nextMonday, toIsoDate } from '../../utils/taskDates';
import { initialsOf } from '../../utils/initials';
import type { InlineMenuOption } from './InlineMenu';
import { WORK_PRIORITIES, WORK_STATUSES, type WorkMember } from './workList';

type Translate = (key: string) => string;

/** Value of the "nobody" entry in assignee menus. */
export const UNASSIGNED_VALUE = '__none__';

export const WorkAvatar = ({ member, size = 'sm' }: { member?: WorkMember; size?: 'sm' | 'xs' }) => (
    <span className={`work-avatar work-avatar--${size}`} aria-hidden="true">
        {member?.photoURL ? <img src={member.photoURL} alt="" /> : initialsOf(member?.displayName || '?', '?')}
    </span>
);

export const shortDateFormat = (dateLocale?: Locale) => (dateLocale?.code?.startsWith('de') ? 'd. MMM' : 'MMM d');

export const statusMenuOptions = (t: Translate): InlineMenuOption[] => WORK_STATUSES.map((value) => ({
    value,
    label: t(`work.status.${value}`),
    leading: <span className={`work-status-dot work-status-dot--${value.replace(/\s+/g, '-').toLowerCase()}`} />
}));

export const priorityMenuOptions = (t: Translate): InlineMenuOption[] => WORK_PRIORITIES.map((value) => ({
    value,
    label: t(`work.priority.${value}`),
    leading: <span className={`work-priority work-priority--${value.toLowerCase()}`} />
}));

export const dueMenuOptions = (t: Translate, dateLocale: Locale | undefined, withClear: boolean): InlineMenuOption[] => [
    { value: toIsoDate(new Date()), label: t('work.due.today'), hint: format(new Date(), 'EEE', { locale: dateLocale }) },
    { value: toIsoDate(addDaysFromToday(1)), label: t('work.due.tomorrow'), hint: format(addDaysFromToday(1), 'EEE', { locale: dateLocale }) },
    { value: toIsoDate(nextMonday()), label: t('work.due.nextWeek'), hint: format(nextMonday(), `EEE ${shortDateFormat(dateLocale)}`, { locale: dateLocale }) },
    ...(withClear ? [{ value: '', label: t('work.due.clear') }] : [])
];

export const assigneeMenuOptions = (t: Translate, members: WorkMember[]): InlineMenuOption[] => [
    ...members.map((member) => ({ value: member.uid, label: member.displayName, leading: <WorkAvatar member={member} size="xs" /> })),
    { value: UNASSIGNED_VALUE, label: t('work.assignee.unassigned'), leading: <span className="material-symbols-outlined">person_off</span> }
];

/** Date-picker footer for due-date menus. */
export const DueDatePicker = ({ label, value, onPick, close }: {
    label: string;
    value?: string;
    onPick: (date: string) => void;
    close: () => void;
}) => (
    <label className="inline-menu__date">
        <span>{label}</span>
        <input
            type="date"
            defaultValue={value?.slice(0, 10) || ''}
            onChange={(event) => {
                if (!event.target.value) return;
                onPick(event.target.value);
                close();
            }}
        />
    </label>
);
