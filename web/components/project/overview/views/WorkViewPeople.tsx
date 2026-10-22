import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';

import type { WorkViewContext } from './shared/viewTypes';
import type { WorkItem } from './shared/useWorkItems';
import { daysFromToday, parseDateValue } from '../../../../utils/taskDates';
import { initialsOf } from '../../../../utils/initials';

const UNASSIGNED = '__unassigned__';
/** More than this many open tasks due within 7 days flags a person as overloaded. */
const WEEK_LOAD_LIMIT = 5;

const initials = (name: string) => initialsOf(name, '?');

type Column = {
    key: string;
    label: string;
    photoURL?: string;
    items: WorkItem[];
    overdue: number;
    today: number;
    week: number;
};

/**
 * Who does what: one column per person (plus unassigned) with their open
 * work, load signals and drag-and-drop reassignment.
 */
export const WorkViewPeople: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { t, members = [], dateLocale, canManageTasks } = ctx;
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropKey, setDropKey] = useState<string | null>(null);
    const shortDate = dateLocale?.code?.startsWith('de') ? 'd. MMM' : 'MMM d';

    const columns = useMemo<Column[]>(() => {
        const open = ctx.items.filter((item) => item.kind === 'task' && !item.isCompleted);
        const map = new Map<string, Column>();
        const ensure = (key: string) => {
            if (!map.has(key)) {
                const member = members.find((entry) => entry.uid === key);
                map.set(key, {
                    key,
                    label: key === UNASSIGNED ? t('work.assignee.unassigned') : member?.displayName || t('work.assignee.unknown'),
                    photoURL: member?.photoURL,
                    items: [],
                    overdue: 0,
                    today: 0,
                    week: 0
                });
            }
            return map.get(key)!;
        };
        // Everyone in the workspace gets a column so free capacity is visible too.
        members.forEach((member) => ensure(member.uid));
        open.forEach((item) => {
            const owners = item.assigneeIds.length ? item.assigneeIds : [UNASSIGNED];
            owners.forEach((uid) => {
                const column = ensure(uid);
                column.items.push(item);
                const diff = daysFromToday(item.dueDate);
                if (diff !== null && diff < 0) column.overdue += 1;
                else if (diff === 0) column.today += 1;
                if (diff !== null && diff >= 0 && diff <= 7) column.week += 1;
            });
        });
        const dueTime = (item: WorkItem) => (item.dueDate ? parseDateValue(item.dueDate).getTime() : Number.MAX_SAFE_INTEGER);
        map.forEach((column) => column.items.sort((a, b) => dueTime(a) - dueTime(b)));
        const list = [...map.values()].filter((column) => column.key !== UNASSIGNED || column.items.length > 0);
        return list.sort((a, b) => {
            if (a.key === UNASSIGNED) return -1;
            if (b.key === UNASSIGNED) return 1;
            return b.items.length - a.items.length || a.label.localeCompare(b.label);
        });
    }, [ctx.items, members, t]);

    const itemsById = useMemo(() => new Map(ctx.items.map((item) => [item.id, item])), [ctx.items]);

    const drop = (columnKey: string) => {
        const item = dragId ? itemsById.get(dragId) : null;
        setDragId(null);
        setDropKey(null);
        if (!item) return;
        const current = item.assigneeIds[0] || UNASSIGNED;
        if (current === columnKey) return;
        ctx.onMoveItemToGroup(item, 'assignee', columnKey);
    };

    if (!columns.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">groups</span>
                <p>{t('projectOverview.execution.noActiveTasks', 'No active work')}</p>
            </div>
        );
    }

    return (
        <div className="people-board">
            {columns.map((column) => {
                const overloaded = column.week > WEEK_LOAD_LIMIT;
                return (
                    <section
                        key={column.key}
                        className={`people-board__column ${dropKey === column.key ? 'is-drop-target' : ''} ${column.key === UNASSIGNED ? 'is-unassigned' : ''}`}
                        aria-label={column.label}
                        onDragOver={canManageTasks ? (event) => { event.preventDefault(); setDropKey(column.key); } : undefined}
                        onDragLeave={() => setDropKey((current) => (current === column.key ? null : current))}
                        onDrop={canManageTasks ? (event) => { event.preventDefault(); drop(column.key); } : undefined}
                    >
                        <header className="people-board__head">
                            <span className="work-avatar work-avatar--sm" aria-hidden="true">
                                {column.key === UNASSIGNED
                                    ? <span className="material-symbols-outlined">person_off</span>
                                    : column.photoURL ? <img src={column.photoURL} alt="" /> : initials(column.label)}
                            </span>
                            <span className="people-board__name">{column.label}</span>
                            <span className="work-group__count">{column.items.length}</span>
                        </header>
                        <div className="people-board__load">
                            {column.overdue > 0 && (
                                <span className="people-board__signal people-board__signal--danger">
                                    {t('work.summary.overdue').replace('{count}', String(column.overdue))}
                                </span>
                            )}
                            {column.today > 0 && (
                                <span className="people-board__signal people-board__signal--warning">
                                    {t('work.summary.today').replace('{count}', String(column.today))}
                                </span>
                            )}
                            <span className="people-board__signal">
                                {t('work.summary.week').replace('{count}', String(column.week))}
                            </span>
                            {overloaded && (
                                <span className="people-board__signal people-board__signal--danger">
                                    <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                                    {t('planning.people.overloaded')}
                                </span>
                            )}
                            {!column.items.length && column.key !== UNASSIGNED && (
                                <span className="people-board__signal people-board__signal--ok">{t('planning.people.free')}</span>
                            )}
                        </div>
                        <div className="people-board__cards" role="list">
                            {column.items.map((item) => {
                                const diff = daysFromToday(item.dueDate);
                                const tone = diff === null ? 'muted' : diff < 0 ? 'danger' : diff === 0 ? 'warning' : 'neutral';
                                const status = (item.status || 'Open').replace(/\s+/g, '-').toLowerCase();
                                return (
                                    <button
                                        key={`${column.key}-${item.id}`}
                                        type="button"
                                        role="listitem"
                                        className={`people-card ${dragId === item.id ? 'is-dragging' : ''}`}
                                        draggable={canManageTasks}
                                        onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDragId(item.id); }}
                                        onDragEnd={() => { setDragId(null); setDropKey(null); }}
                                        onClick={() => ctx.onItemClick(item)}
                                    >
                                        <span className="people-card__title">{item.title}</span>
                                        <span className="people-card__meta">
                                            <span className={`work-status-dot work-status-dot--${status}`} aria-hidden="true" />
                                            <span>{ctx.labels.statusLabels[item.status] || item.status}</span>
                                            {item.dueDate && (
                                                <span className={`people-card__due people-card__due--${tone}`}>
                                                    {diff === 0 ? t('work.due.today') : format(parseDateValue(item.dueDate), shortDate, { locale: dateLocale })}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                            {canManageTasks && column.items.length === 0 && (
                                <span className="people-board__empty">{t('planning.people.dropHint')}</span>
                            )}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};
