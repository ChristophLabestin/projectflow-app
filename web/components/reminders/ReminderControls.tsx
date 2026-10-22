import React from 'react';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';

interface ReminderNotifyToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    hint?: string;
    disabled?: boolean;
}

/** "Also remind assignees" switch for task reminders (`notifyAssignees`, contract C2). */
export const ReminderNotifyToggle: React.FC<ReminderNotifyToggleProps> = ({ checked, onChange, label, hint, disabled }) => (
    <label className={`reminder-toggle ${disabled ? 'is-disabled' : ''}`.trim()} title={hint}>
        <input
            type="checkbox"
            className="reminder-toggle__input"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
        />
        <span className="reminder-toggle__label">{label}</span>
    </label>
);

interface ReminderSentBadgeProps {
    sentAt?: string;
    label: string;
    dateFormat: string;
    dateLocale: Locale;
}

/** Shows that the server already delivered a reminder (`sentAt` is set). */
export const ReminderSentBadge: React.FC<ReminderSentBadgeProps> = ({ sentAt, label, dateFormat, dateLocale }) => {
    if (!sentAt) return null;
    const date = new Date(sentAt);
    const when = Number.isNaN(date.getTime())
        ? ''
        : `${format(date, dateFormat, { locale: dateLocale })} ${format(date, 'HH:mm')}`;
    return (
        <span className="reminder-sent" title={when ? `${label} ${when}` : label}>
            <span className="material-symbols-outlined" aria-hidden="true">mark_email_read</span>
            {label}
        </span>
    );
};
