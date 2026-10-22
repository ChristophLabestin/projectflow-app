import React from 'react';

import { useLanguage } from '../../context/LanguageContext';
import { InlineMenu, type InlineMenuOption } from './InlineMenu';
import type { WorkMember } from './workList';
import {
    assigneeMenuOptions,
    DueDatePicker,
    dueMenuOptions,
    priorityMenuOptions,
    statusMenuOptions
} from './workMenuOptions';

interface WorkBulkBarProps {
    count: number;
    busy?: boolean;
    members: WorkMember[];
    allVisibleSelected: boolean;
    onToggleAllVisible: () => void;
    onStatus: (status: string) => void;
    onPriority: (priority: string) => void;
    /** ISO date, or '' to remove the due date. */
    onDue: (date: string) => void;
    /** Member uid, or UNASSIGNED_VALUE to unassign. Replaces existing assignees. */
    onAssignee: (uid: string) => void;
    /** Omit when the project has no initiatives. */
    initiativeOptions?: InlineMenuOption[];
    onInitiative?: (initiativeId: string) => void;
    onDelete: () => void;
    onClose: () => void;
}

const Action = ({ icon, label }: { icon: string; label: string }) => (
    <>
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <span className="work-bulk-bar__label">{label}</span>
    </>
);

/**
 * Floating action bar for selected tasks. Sticks to the bottom of the work list
 * so selecting never shifts the rows, and uses the same inline menus as a row.
 */
export const WorkBulkBar = ({
    count,
    busy,
    members,
    allVisibleSelected,
    onToggleAllVisible,
    onStatus,
    onPriority,
    onDue,
    onAssignee,
    initiativeOptions,
    onInitiative,
    onDelete,
    onClose
}: WorkBulkBarProps) => {
    const { t, dateLocale } = useLanguage();
    const countLabel = t('work.bulk.selected').replace('{count}', String(count));
    const disabled = busy || count === 0;

    return (
        <div className="work-bulk-bar" role="region" aria-label={countLabel}>
            <div className="work-bulk-bar__summary">
                <span className="work-bulk-bar__count" aria-live="polite">
                    {count === 0 ? t('work.bulk.hint') : countLabel}
                </span>
                <button
                    type="button"
                    className="work-bulk-bar__link"
                    onClick={onToggleAllVisible}
                    disabled={busy}
                    aria-pressed={allVisibleSelected}
                >
                    {t(allVisibleSelected ? 'work.bulk.selectNone' : 'work.bulk.selectAll')}
                </button>
            </div>
            <div className="work-bulk-bar__actions">
                <InlineMenu
                    label={t('work.bulk.status')}
                    triggerClassName="work-bulk-bar__action"
                    trigger={<Action icon="radio_button_checked" label={t('work.bulk.statusShort')} />}
                    options={statusMenuOptions(t)}
                    onSelect={onStatus}
                    disabled={disabled}
                    width={200}
                />
                <InlineMenu
                    label={t('work.bulk.priority')}
                    triggerClassName="work-bulk-bar__action"
                    trigger={<Action icon="signal_cellular_alt" label={t('work.bulk.priorityShort')} />}
                    options={priorityMenuOptions(t)}
                    onSelect={onPriority}
                    disabled={disabled}
                    width={180}
                />
                <InlineMenu
                    label={t('work.bulk.due')}
                    triggerClassName="work-bulk-bar__action"
                    trigger={<Action icon="event" label={t('work.bulk.dueShort')} />}
                    options={dueMenuOptions(t, dateLocale, true)}
                    onSelect={onDue}
                    disabled={disabled}
                    width={230}
                    footer={(close) => <DueDatePicker label={t('work.due.pick')} onPick={onDue} close={close} />}
                />
                <InlineMenu
                    label={t('work.bulk.assignee')}
                    triggerClassName="work-bulk-bar__action"
                    trigger={<Action icon="person_add" label={t('work.bulk.assigneeShort')} />}
                    options={assigneeMenuOptions(t, members)}
                    onSelect={onAssignee}
                    disabled={disabled}
                    width={240}
                />
                {initiativeOptions && onInitiative && (
                    <InlineMenu
                        label={t('work.bulk.initiative')}
                        triggerClassName="work-bulk-bar__action"
                        trigger={<Action icon="rocket_launch" label={t('work.bulk.initiativeShort')} />}
                        options={initiativeOptions}
                        onSelect={onInitiative}
                        disabled={disabled}
                        width={240}
                    />
                )}
                <span className="work-bulk-bar__divider" aria-hidden="true" />
                <button
                    type="button"
                    className="work-bulk-bar__action work-bulk-bar__action--danger"
                    onClick={onDelete}
                    disabled={disabled}
                    aria-label={t('work.bulk.delete')}
                    title={t('work.bulk.delete')}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
                <button
                    type="button"
                    className="work-bulk-bar__action work-bulk-bar__action--close"
                    onClick={onClose}
                    disabled={busy}
                    aria-label={t('work.bulk.clear')}
                    title={`${t('work.bulk.clear')} (Esc)`}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
            </div>
        </div>
    );
};
