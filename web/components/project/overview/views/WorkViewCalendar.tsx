import React from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek
} from 'date-fns';
import type { WorkViewContext } from './shared/viewTypes';
import type { WorkItem } from './shared/useWorkItems';

const parse = (value?: string) => (value ? new Date(value) : null);

export const WorkViewCalendar: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { items, milestones, dateLocale, t } = ctx;
    const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));

    const days = React.useMemo(() => {
        const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
        const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [cursor]);

    const itemsByDay = React.useMemo(() => {
        const map = new Map<string, WorkItem[]>();
        for (const item of items) {
            const due = parse(item.dueDate);
            if (!due) continue;
            const key = format(due, 'yyyy-MM-dd');
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        }
        return map;
    }, [items]);

    const milestonesByDay = React.useMemo(() => {
        const map = new Map<string, string[]>();
        for (const milestone of milestones) {
            const due = parse(milestone.dueDate);
            if (!due) continue;
            const key = format(due, 'yyyy-MM-dd');
            const list = map.get(key) || [];
            list.push(milestone.title);
            map.set(key, list);
        }
        return map;
    }, [milestones]);

    const weekdays = React.useMemo(() => {
        const base = startOfWeek(new Date(), { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => format(eachDayOfInterval({ start: base, end: endOfWeek(base, { weekStartsOn: 1 }) })[i], 'EEE', { locale: dateLocale }));
    }, [dateLocale]);

    return (
        <div className="po-calendar">
            <div className="po-calendar__head">
                <button type="button" className="po-calendar__nav" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label={t('projectOverview.v2.calendar.prev', 'Previous month')}>
                    <span className="material-symbols-outlined">chevron_left</span>
                </button>
                <span className="po-calendar__title">{format(cursor, 'MMMM yyyy', { locale: dateLocale })}</span>
                <button type="button" className="po-calendar__nav" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label={t('projectOverview.v2.calendar.next', 'Next month')}>
                    <span className="material-symbols-outlined">chevron_right</span>
                </button>
                <button type="button" className="po-calendar__today-btn" onClick={() => setCursor(startOfMonth(new Date()))}>
                    {t('projectOverview.v2.calendar.today', 'Today')}
                </button>
            </div>
            <div className="po-calendar__weekdays">
                {weekdays.map((label) => <span key={label}>{label}</span>)}
            </div>
            <div className="po-calendar__grid">
                {days.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const dayItems = itemsByDay.get(key) || [];
                    const dayMilestones = milestonesByDay.get(key) || [];
                    return (
                        <div
                            key={key}
                            className={`po-calendar__day ${isSameMonth(day, cursor) ? '' : 'is-muted'} ${isToday(day) ? 'is-today' : ''}`.trim()}
                        >
                            <span className="po-calendar__day-num">{format(day, 'd')}</span>
                            {dayMilestones.map((title, idx) => (
                                <span key={`m-${idx}`} className="po-calendar__milestone" title={title}>
                                    <span className="material-symbols-outlined">flag</span>{title}
                                </span>
                            ))}
                            {dayItems.slice(0, 4).map((item) => (
                                <button
                                    key={`${item.kind}-${item.id}`}
                                    type="button"
                                    data-status={item.status}
                                    className={`po-calendar__chip po-calendar__chip--${item.kind} ${item.priority === 'Urgent' || item.priority === 'High' ? 'is-hot' : ''} ${item.isCompleted ? 'is-done' : ''}`.trim()}
                                    onClick={() => ctx.onItemClick(item)}
                                    title={item.title}
                                >
                                    {item.title}
                                </button>
                            ))}
                            {dayItems.length > 4 && (
                                <span className="po-calendar__more">+{dayItems.length - 4}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
