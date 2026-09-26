import React, { useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';

import type { WorkViewContext } from './shared/viewTypes';
import type { WorkItem } from './shared/useWorkItems';
import { InlineMenu } from '../../../work/InlineMenu';
import { buildTimeScale, toDate, useBarDrag } from '../../../planning/timeScale';
import { TimeScaleBackdrop, TimeScaleHeader } from '../../../planning/TimeScaleHeader';
import { estimateLabelWidth, staggerLabels } from '../../../planning/stagger';
import { addDaysFromToday, isDateOverdue, nextMonday, toIsoDate } from '../../../../utils/taskDates';

const DAY_WIDTH = 34;
const LABEL_WIDTH = 280;

type Row = { item: WorkItem; start: Date; end: Date };
type Lane = { key: string; label: string; rows: Row[]; unscheduled: WorkItem[] };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';

/**
 * Task timeline: one lane per person so it is obvious who works on what and
 * when. Bars can be dragged to move or resized at either edge; tasks without
 * dates wait in a tray per lane and can be scheduled with one click.
 */
export const WorkViewTimeline: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { t, dateLocale, milestones, members = [], canManageTasks } = ctx;
    const scrollerRef = useRef<HTMLDivElement>(null);
    const tasks = useMemo(() => ctx.items.filter((item) => item.kind === 'task'), [ctx.items]);

    const lanes = useMemo<Lane[]>(() => {
        const byOwner = new Map<string, Lane>();
        const nameOf = (uid: string) => members.find((member) => member.uid === uid)?.displayName || t('work.assignee.unknown');
        const laneFor = (uid: string | null) => {
            const key = uid || '__unassigned__';
            if (!byOwner.has(key)) {
                byOwner.set(key, { key, label: uid ? nameOf(uid) : t('work.assignee.unassigned'), rows: [], unscheduled: [] });
            }
            return byOwner.get(key)!;
        };
        tasks.forEach((item) => {
            const owners = item.assigneeIds.length ? item.assigneeIds : [null];
            const start = toDate(item.startDate) || toDate(item.dueDate);
            const end = toDate(item.dueDate) || toDate(item.startDate);
            owners.forEach((uid) => {
                const lane = laneFor(uid);
                if (start && end) lane.rows.push({ item, start: start <= end ? start : end, end: start <= end ? end : start });
                else if (!item.isCompleted) lane.unscheduled.push(item);
            });
        });
        const list = [...byOwner.values()];
        list.forEach((lane) => lane.rows.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()));
        return list.sort((a, b) => {
            if (a.key === '__unassigned__') return 1;
            if (b.key === '__unassigned__') return -1;
            return a.label.localeCompare(b.label);
        });
    }, [tasks, members, t]);

    const scale = useMemo(() => buildTimeScale([
        ...lanes.flatMap((lane) => lane.rows.flatMap((row) => [row.start, row.end])),
        ...milestones.map((milestone) => toDate(milestone.dueDate))
    ], { dayWidth: DAY_WIDTH }), [lanes, milestones]);

    const datedMilestones = useMemo(() => milestones.filter((milestone) => milestone.dueDate).sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')), [milestones]);
    const milestoneLayout = useMemo(() => staggerLabels(datedMilestones.map((milestone) => ({
        x: scale.x(toDate(milestone.dueDate)!),
        width: 20 + estimateLabelWidth(milestone.title)
    }))), [datedMilestones, scale]);

    const itemsById = useMemo(() => new Map(tasks.map((item) => [item.id, item])), [tasks]);
    const { preview, onPointerDown, handlers, wasDragRef } = useBarDrag(DAY_WIDTH, (id, dates) => {
        const item = itemsById.get(id);
        if (item) ctx.onUpdateItemDates(item, dates);
    });

    // Start scrolled so today sits near the left edge.
    useEffect(() => {
        const scroller = scrollerRef.current;
        if (scroller) scroller.scrollLeft = Math.max(0, scale.x(new Date()) - DAY_WIDTH * 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!tasks.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">view_timeline</span>
                <p>{t('projectOverview.execution.noActiveTasks', 'No active work')}</p>
            </div>
        );
    }

    const scheduleOptions = [
        { value: toIsoDate(new Date()), label: t('work.due.today') },
        { value: toIsoDate(addDaysFromToday(1)), label: t('work.due.tomorrow') },
        { value: toIsoDate(nextMonday()), label: t('work.due.nextWeek') }
    ];
    const shortDate = dateLocale?.code?.startsWith('de') ? 'd. MMM' : 'MMM d';

    return (
        <div className="tl" {...handlers}>
            <div className="tl__scroller" ref={scrollerRef}>
                <div className="tl__grid" style={{ width: LABEL_WIDTH + scale.width }}>
                    <div className="tl__head">
                        <div className="tl__corner">{t('planning.timeline.lanes')}</div>
                        <TimeScaleHeader scale={scale} granularity="day" />
                    </div>

                    <div className="tl__body">
                        <div className="tl__backdrop" style={{ left: LABEL_WIDTH }}>
                            <TimeScaleBackdrop scale={scale} granularity="day" />
                            {milestones.filter((milestone) => milestone.dueDate).map((milestone) => {
                                const date = toDate(milestone.dueDate)!;
                                return <span key={milestone.id} className="tl__milestone-line" style={{ left: scale.x(date) + DAY_WIDTH / 2 }} />;
                            })}
                        </div>

                        {milestones.some((milestone) => milestone.dueDate) && (
                            <div className="tl__row tl__row--milestones" style={{ minHeight: 16 + milestoneLayout.rowCount * 28 }}>
                                <div className="tl__label tl__label--muted">
                                    <span className="material-symbols-outlined" aria-hidden="true">flag</span>
                                    {t('planning.milestones')}
                                </div>
                                <div className="tl__track">
                                    {datedMilestones.map((milestone, index) => {
                                        const date = toDate(milestone.dueDate)!;
                                        return (
                                            <span
                                                key={milestone.id}
                                                className={`tl__milestone ${milestone.status === 'Achieved' ? 'is-done' : ''}`}
                                                style={{ left: scale.x(date) + DAY_WIDTH / 2, top: 8 + milestoneLayout.rows[index] * 28 }}
                                                title={`${milestone.title} · ${format(date, shortDate, { locale: dateLocale })}`}
                                            >
                                                <span className="tl__diamond" aria-hidden="true" />
                                                <span className="tl__milestone-label">{milestone.title}</span>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {lanes.map((lane) => (
                            <section key={lane.key} className="tl__lane" aria-label={lane.label}>
                                <div className="tl__row tl__row--lane">
                                    <div className="tl__label tl__label--lane">
                                        <span className="work-avatar work-avatar--sm" aria-hidden="true">
                                            {lane.key === '__unassigned__' ? <span className="material-symbols-outlined">person_off</span> : initials(lane.label)}
                                        </span>
                                        <span className="tl__lane-name">{lane.label}</span>
                                        <span className="work-group__count">{lane.rows.filter((row) => !row.item.isCompleted).length + lane.unscheduled.length}</span>
                                    </div>
                                    <div className="tl__track" />
                                </div>
                                {lane.rows.map(({ item, start, end }) => {
                                    const active = preview && preview.id === item.id ? preview : null;
                                    const barStart = active ? active.start : start;
                                    const barEnd = active ? active.end : end;
                                    const { left, width } = scale.span(barStart, barEnd);
                                    const overdue = !item.isCompleted && isDateOverdue(item.dueDate);
                                    const status = (item.status || 'Open').replace(/\s+/g, '-').toLowerCase();
                                    const labelInside = width >= 140;
                                    return (
                                        <div key={`${lane.key}-${item.id}`} className={`tl__row ${item.isCompleted ? 'is-done' : ''}`}>
                                            <button type="button" className="tl__label" onClick={() => ctx.onItemClick(item)} title={item.title}>
                                                <span className={`work-status-dot work-status-dot--${status}`} aria-hidden="true" />
                                                <span className="tl__title">{item.title}</span>
                                            </button>
                                            <div className="tl__track">
                                                <div
                                                    className={`tl__bar tl__bar--${status} ${overdue ? 'is-overdue' : ''} ${active ? 'is-dragging' : ''}`}
                                                    style={{ left, width }}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-label={`${item.title}: ${format(barStart, shortDate, { locale: dateLocale })} – ${format(barEnd, shortDate, { locale: dateLocale })}`}
                                                    onPointerDown={canManageTasks ? (event) => onPointerDown(event, item.id, 'move', start, end) : undefined}
                                                    onClick={() => { if (!wasDragRef.current) ctx.onItemClick(item); wasDragRef.current = false; }}
                                                    onKeyDown={(event) => { if (event.key === 'Enter') ctx.onItemClick(item); }}
                                                >
                                                    {canManageTasks && (
                                                        <span
                                                            className="tl__handle tl__handle--start"
                                                            onPointerDown={(event) => onPointerDown(event, item.id, 'start', start, end)}
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    {labelInside && <span className="tl__bar-label">{item.title}</span>}
                                                    {canManageTasks && (
                                                        <span
                                                            className="tl__handle tl__handle--end"
                                                            onPointerDown={(event) => onPointerDown(event, item.id, 'end', start, end)}
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                </div>
                                                {!labelInside && (
                                                    <span className="tl__bar-outside" style={{ left: left + width + 8 }}>{item.title}</span>
                                                )}
                                                {active && (
                                                    <span className="tl__drag-tip" style={{ left }}>
                                                        {format(barStart, shortDate, { locale: dateLocale })} – {format(barEnd, shortDate, { locale: dateLocale })}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {lane.unscheduled.length > 0 && (
                                    <div className="tl__row tl__row--tray">
                                        <div className="tl__label tl__label--muted">
                                            <span className="material-symbols-outlined" aria-hidden="true">event_busy</span>
                                            {t('planning.timeline.unscheduled').replace('{count}', String(lane.unscheduled.length))}
                                        </div>
                                        <div className="tl__tray">
                                            {lane.unscheduled.map((item) => (
                                                <span key={item.id} className="tl__tray-item">
                                                    <button type="button" className="tl__tray-title" onClick={() => ctx.onItemClick(item)}>{item.title}</button>
                                                    {canManageTasks && (
                                                        <InlineMenu
                                                            label={`${t('planning.timeline.schedule')}: ${item.title}`}
                                                            triggerClassName="tl__tray-schedule"
                                                            trigger={<span className="material-symbols-outlined">event</span>}
                                                            options={scheduleOptions}
                                                            onSelect={(dueDate) => ctx.onUpdateItemDates(item, { dueDate })}
                                                            width={180}
                                                        />
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
