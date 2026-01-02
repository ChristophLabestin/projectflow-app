import React from 'react';
import { Sprint, Task } from '../../types';
import { Button } from '../../components/ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { differenceInDays, format } from 'date-fns';

interface UpcomingSprintsListProps {
    sprints: Sprint[];
    allTasks: Task[];
    onStartSprint?: (sprintId: string) => void;
    onSprintClick?: (sprint: Sprint) => void;
}

export const UpcomingSprintsList: React.FC<UpcomingSprintsListProps> = ({ sprints, allTasks, onStartSprint, onSprintClick }) => {
    const { t, dateFormat } = useLanguage();

    if (sprints.length === 0) return null;

    return (
        <div className="shrink-0 mt-4">
            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-[var(--color-text-muted)]">upcoming</span>
                Upcoming Sprints
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sprints.map(upcoming => {
                    const upcomingTasks = allTasks.filter(t => t.sprintId === upcoming.id);
                    const startsIn = differenceInDays(new Date(upcoming.startDate), new Date());

                    return (
                        <div
                            key={upcoming.id}
                            onClick={() => onSprintClick?.(upcoming)}
                            className="group relative p-5 rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] hover:border-[var(--color-primary)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-lg text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                                            {upcoming.name}
                                        </h4>
                                        {upcoming.autoStart && (
                                            <span
                                                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full"
                                                title="Auto-start enabled"
                                            >
                                                Auto
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)]">
                                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                        {format(new Date(upcoming.startDate), dateFormat)} - {format(new Date(upcoming.endDate), dateFormat)}
                                    </div>
                                </div>
                                {onStartSprint && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-[var(--color-primary)] bg-[var(--color-primary)]/5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onStartSprint(upcoming.id);
                                        }}
                                    >
                                        Start
                                    </Button>
                                )}
                            </div>

                            {upcoming.goal && (
                                <p className="text-sm text-[var(--color-text-subtle)] line-clamp-2 mb-4 leading-relaxed">
                                    {upcoming.goal}
                                </p>
                            )}

                            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-surface-border)]">
                                <div className="flex items-center gap-3 text-xs font-bold text-[var(--color-text-muted)]">
                                    <span className="flex items-center gap-1.5" title={`${upcomingTasks.length} tasks assigned`}>
                                        <span className="material-symbols-outlined text-sm">list_alt</span>
                                        {upcomingTasks.length}
                                    </span>
                                </div>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${startsIn <= 0
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                        : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                                    }`}>
                                    {startsIn <= 0 ? 'Starts today' : `Starts in ${startsIn} days`}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
