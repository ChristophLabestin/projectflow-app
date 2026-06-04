import React from 'react';
import { addDays, differenceInCalendarDays, eachWeekOfInterval, format, max as maxDate, min as minDate, startOfToday } from 'date-fns';
import type { WorkViewContext } from './shared/viewTypes';
import type { WorkItem } from './shared/useWorkItems';

const parse = (value?: string) => (value ? new Date(value) : null);

const itemRange = (item: WorkItem): { start: Date; end: Date } | null => {
    const start = parse(item.startDate) || parse(item.dueDate);
    const end = parse(item.dueDate) || parse(item.startDate);
    if (!start || !end) return null;
    return start <= end ? { start, end } : { start: end, end: start };
};

export const WorkViewTimeline: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { groups, milestones, dateFormat, dateLocale, t } = ctx;

    const scheduled = ctx.items.map((item) => ({ item, range: itemRange(item) }));
    const dated = scheduled.filter((entry) => entry.range) as { item: WorkItem; range: { start: Date; end: Date } }[];

    const bounds = React.useMemo(() => {
        const today = startOfToday();
        if (!dated.length) {
            return { start: today, end: addDays(today, 30) };
        }
        const start = minDate(dated.map((d) => d.range.start));
        const end = maxDate(dated.map((d) => d.range.end));
        return { start: addDays(start, -2), end: addDays(end, 2) };
    }, [dated]);

    const totalDays = Math.max(1, differenceInCalendarDays(bounds.end, bounds.start) + 1);
    const weeks = eachWeekOfInterval({ start: bounds.start, end: bounds.end }, { weekStartsOn: 1 });

    const pct = (date: Date) => (differenceInCalendarDays(date, bounds.start) / totalDays) * 100;

    const todayPct = pct(startOfToday());
    const showToday = todayPct >= 0 && todayPct <= 100;

    if (ctx.items.length === 0) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">timeline</span>
                <p>{t('projectOverview.execution.noActiveTasks', 'No active work')}</p>
            </div>
        );
    }

    return (
        <div className="po-timeline">
            <div className="po-timeline__scroll">
                <div className="po-timeline__chart" style={{ minWidth: `${Math.max(720, totalDays * 28)}px` }}>
                    <div className="po-timeline__axis">
                        {weeks.map((week) => (
                            <div key={week.toISOString()} className="po-timeline__tick" style={{ left: `${pct(week)}%` }}>
                                <span>{format(week, 'd MMM', { locale: dateLocale })}</span>
                            </div>
                        ))}
                        {showToday && <div className="po-timeline__today" style={{ left: `${todayPct}%` }} title={t('projectOverview.v2.timeline.today', 'Today')} />}
                    </div>

                    {milestones.length > 0 && (
                        <div className="po-timeline__milestones">
                            {milestones.map((milestone) => {
                                const due = parse(milestone.dueDate);
                                if (!due) return null;
                                const left = pct(due);
                                if (left < 0 || left > 100) return null;
                                return (
                                    <div key={milestone.id} className="po-timeline__milestone" style={{ left: `${left}%` }} title={milestone.title}>
                                        <span className="material-symbols-outlined">flag</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="po-timeline__rows">
                        {groups.map((group) => (
                            <div key={group.key} className="po-timeline__group">
                                <div className="po-timeline__group-head">{group.label}</div>
                                {group.items.map((item) => {
                                    const range = itemRange(item);
                                    return (
                                        <div key={`${item.kind}-${item.id}`} className="po-timeline__row">
                                            <button type="button" className="po-timeline__row-label" onClick={() => ctx.onItemClick(item)}>
                                                {item.title}
                                            </button>
                                            <div className="po-timeline__track">
                                                {showToday && <div className="po-timeline__track-today" style={{ left: `${todayPct}%` }} />}
                                                {range ? (
                                                    <button
                                                        type="button"
                                                        data-status={item.status}
                                                        className={`po-timeline__bar po-timeline__bar--${item.kind} ${item.isCompleted ? 'is-done' : ''} ${item.priority === 'Urgent' || item.priority === 'High' ? 'is-hot' : ''}`.trim()}
                                                        style={{ left: `${pct(range.start)}%`, width: `${Math.max(2, ((differenceInCalendarDays(range.end, range.start) + 1) / totalDays) * 100)}%` }}
                                                        onClick={() => ctx.onItemClick(item)}
                                                        title={`${format(range.start, dateFormat, { locale: dateLocale })} – ${format(range.end, dateFormat, { locale: dateLocale })}`}
                                                    >
                                                        <span className="po-timeline__bar-label">{item.title}</span>
                                                    </button>
                                                ) : (
                                                    <span className="po-timeline__no-date">{t('projectOverview.v2.timeline.noDate', 'No date')}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
