import React from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Milestone, Task } from '../../../../types';

type MilestonesViewProps = {
    milestones: Milestone[];
    tasks: Task[];
    dateFormat: string;
    dateLocale: Locale;
    t: (key: string, fallback?: string) => string;
};

const isDone = (task: Task) => task.isCompleted || task.status === 'Done';
const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Visual status key reused by the status accent palette ([data-status]). */
const statusTone = (milestone: Milestone, overdue: boolean): string => {
    if (milestone.status === 'Achieved') return 'Done';
    if (milestone.status === 'Missed') return 'Blocked';
    return overdue ? 'Review' : 'Open';
};

export const MilestonesView: React.FC<MilestonesViewProps> = ({ milestones, tasks, dateFormat, dateLocale, t }) => {
    if (!milestones.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">flag</span>
                <p>{t('projectOverview.v2.milestones.empty', 'No milestones yet')}</p>
            </div>
        );
    }

    const today = new Date();
    const sorted = [...milestones].sort((a, b) =>
        new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime());

    const achieved = milestones.filter((m) => m.status === 'Achieved').length;
    const missed = milestones.filter((m) => m.status === 'Missed').length;
    const pending = milestones.filter((m) => m.status === 'Pending').length;
    const achievedPct = clampPct((achieved / milestones.length) * 100);
    const nextMilestone = sorted.find((m) => m.status === 'Pending' && m.dueDate);

    const metricsFor = (milestone: Milestone) => {
        const linked = milestone.linkedTaskIds || [];
        const linkedTasks = tasks.filter((task) => linked.includes(task.id));
        const total = linkedTasks.length;
        const done = linkedTasks.filter(isDone).length;
        const due = milestone.dueDate ? new Date(milestone.dueDate) : null;
        const daysLeft = due ? differenceInCalendarDays(due, today) : null;
        const overdue = Boolean(due && daysLeft !== null && daysLeft < 0 && milestone.status === 'Pending');
        return { total, done, pct: total ? clampPct((done / total) * 100) : 0, due, daysLeft, overdue };
    };

    return (
        <div className="po-mstones">
            <div className="po-mstones__stats">
                <div className="po-mstones__stat">
                    <span className="po-mstones__stat-value">{milestones.length}</span>
                    <span className="po-mstones__stat-label">{t('projectOverview.v2.milestones.total', 'Total')}</span>
                </div>
                <div className="po-mstones__stat">
                    <span className="po-mstones__stat-value" data-status="Done">{achieved}</span>
                    <span className="po-mstones__stat-label">{t('projectOverview.v2.milestones.achieved', 'Achieved')}</span>
                </div>
                <div className="po-mstones__stat">
                    <span className="po-mstones__stat-value" data-status="Open">{pending}</span>
                    <span className="po-mstones__stat-label">{t('projectOverview.v2.milestones.pending', 'Pending')}</span>
                </div>
                {missed > 0 && (
                    <div className="po-mstones__stat">
                        <span className="po-mstones__stat-value" data-status="Blocked">{missed}</span>
                        <span className="po-mstones__stat-label">{t('projectOverview.v2.milestones.missed', 'Missed')}</span>
                    </div>
                )}
                <div className="po-mstones__stat">
                    <span className="po-mstones__stat-value">{achievedPct}%</span>
                    <span className="po-mstones__stat-label">{t('projectOverview.v2.milestones.achievedPct', 'Reached')}</span>
                </div>
                {nextMilestone && (
                    <div className="po-mstones__next">
                        <span className="material-symbols-outlined">flag</span>
                        <div>
                            <small>{t('projectOverview.v2.milestones.nextDue', 'Next milestone')}</small>
                            <strong>{nextMilestone.title}</strong>
                        </div>
                        <span className="po-mstones__next-date">{format(new Date(nextMilestone.dueDate!), dateFormat, { locale: dateLocale })}</span>
                    </div>
                )}
            </div>

            <div className="po-mstones__timeline">
                {sorted.map((milestone) => {
                    const m = metricsFor(milestone);
                    const tone = statusTone(milestone, m.overdue);
                    const achievedNode = milestone.status === 'Achieved';
                    return (
                        <div key={milestone.id} className="po-mstones__row" data-status={tone}>
                            <div className="po-mstones__rail">
                                <span className="po-mstones__node">
                                    <span className="material-symbols-outlined">
                                        {achievedNode ? 'check' : milestone.status === 'Missed' ? 'close' : 'flag'}
                                    </span>
                                </span>
                            </div>
                            <article className="po-mstones__card">
                                <header className="po-mstones__card-head">
                                    <div className="po-mstones__card-titles">
                                        <h3>{milestone.title}</h3>
                                        {milestone.description && <p>{milestone.description}</p>}
                                    </div>
                                    <span className="po-mstones__badge" data-status={tone}>
                                        {t(`milestones.status.${milestone.status.toLowerCase()}`, milestone.status)}
                                    </span>
                                </header>

                                {m.total > 0 && (
                                    <div className="po-mstones__progress">
                                        <div className="po-mstones__progress-head">
                                            <span>{t('projectOverview.v2.milestones.linkedProgress', 'Linked work')}</span>
                                            <strong>{m.done}/{m.total} · {m.pct}%</strong>
                                        </div>
                                        <div className="po-mstones__progress-track">
                                            <div className="po-mstones__progress-fill" data-status={tone} style={{ width: `${m.pct}%` }} />
                                        </div>
                                    </div>
                                )}

                                <footer className="po-mstones__card-foot">
                                    {m.due && (
                                        <span className="po-mstones__date">
                                            <span className="material-symbols-outlined">event</span>
                                            {format(m.due, dateFormat, { locale: dateLocale })}
                                        </span>
                                    )}
                                    {milestone.status === 'Pending' && m.daysLeft !== null && (
                                        <span className={`po-mstones__countdown ${m.overdue ? 'is-overdue' : m.daysLeft <= 7 ? 'is-soon' : ''}`.trim()}>
                                            {m.overdue
                                                ? t('projectOverview.v2.milestones.overdueBy', '{count}d overdue').replace('{count}', String(Math.abs(m.daysLeft)))
                                                : t('projectOverview.v2.milestones.dueIn', 'in {count}d').replace('{count}', String(m.daysLeft))}
                                        </span>
                                    )}
                                    {milestone.riskRating && (
                                        <span className={`po-mstones__risk po-mstones__risk--${milestone.riskRating.toLowerCase()}`}>
                                            <span className="material-symbols-outlined">warning</span>
                                            {t('projectOverview.v2.milestones.risk', 'Risk: {level}').replace('{level}', milestone.riskRating)}
                                        </span>
                                    )}
                                </footer>
                            </article>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
