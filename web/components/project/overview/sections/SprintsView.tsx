import React from 'react';
import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Sprint, Task } from '../../../../types';
import type { OverviewMember } from '../hooks/useProjectMembers';
import type { OverviewLabels } from '../hooks/useProjectOverviewLabels';

type SprintsViewProps = {
    sprints: Sprint[];
    tasks: Task[];
    members: OverviewMember[];
    labels: OverviewLabels;
    projectId: string;
    tenantQuery: string;
    dateFormat: string;
    dateLocale: Locale;
    t: (key: string, fallback?: string) => string;
};

const isDone = (task: Task) => task.isCompleted || task.status === 'Done';
const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

// Status buckets shown in the breakdown bar, in flow order.
const BREAKDOWN: { key: string; matches: (s?: string) => boolean }[] = [
    { key: 'Blocked', matches: (s) => s === 'Blocked' },
    { key: 'In Progress', matches: (s) => s === 'In Progress' },
    { key: 'Review', matches: (s) => s === 'Review' },
    { key: 'Open', matches: (s) => !s || s === 'Open' || s === 'Todo' || s === 'Backlog' || s === 'On Hold' || s === 'Planning' },
    { key: 'Done', matches: (s) => s === 'Done' }
];

const sprintMetrics = (sprint: Sprint, tasks: Task[]) => {
    const sprintTasks = tasks.filter((task) => task.sprintId === sprint.id);
    const total = sprintTasks.length;
    const done = sprintTasks.filter(isDone).length;
    const completion = total ? clampPct((done / total) * 100) : 0;

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const today = new Date();
    const totalDays = Math.max(1, differenceInCalendarDays(end, start));
    const elapsed = differenceInCalendarDays(today, start);
    const timeProgress = clampPct((elapsed / totalDays) * 100);
    const daysLeft = differenceInCalendarDays(end, today);

    const breakdown = BREAKDOWN.map((bucket) => ({
        key: bucket.key,
        count: sprintTasks.filter((task) => bucket.matches(isDone(task) ? 'Done' : task.status)).length
    })).filter((b) => b.count > 0);

    const blocked = sprintTasks.filter((task) => task.status === 'Blocked' && !isDone(task)).length;
    return { sprintTasks, total, done, completion, timeProgress, daysLeft, breakdown, blocked };
};

const Avatars: React.FC<{ ids: string[]; members: OverviewMember[] }> = ({ ids, members }) => {
    if (!ids.length) return null;
    const shown = ids.slice(0, 5);
    return (
        <div className="po-sprint__avatars">
            {shown.map((id) => {
                const member = members.find((m) => m.id === id);
                const name = member?.displayName || id;
                return (
                    <span
                        key={id}
                        className="po-sprint__avatar"
                        title={name}
                        style={member?.photoURL ? { backgroundImage: `url(${member.photoURL})` } : undefined}
                    >
                        {!member?.photoURL && name.trim().charAt(0).toUpperCase()}
                    </span>
                );
            })}
            {ids.length > shown.length && <span className="po-sprint__avatar po-sprint__avatar--more">+{ids.length - shown.length}</span>}
        </div>
    );
};

export const SprintsView: React.FC<SprintsViewProps> = ({
    sprints, tasks, members, labels, projectId, tenantQuery, dateFormat, dateLocale, t
}) => {
    if (!sprints.length) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">sprint</span>
                <p>{t('projectOverview.v2.sprints.empty', 'No sprints yet')}</p>
            </div>
        );
    }

    const active = sprints.filter((s) => s.status === 'Active')
        .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    const planning = sprints.filter((s) => s.status === 'Planning')
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const closed = sprints.filter((s) => s.status === 'Completed' || s.status === 'Archived')
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    // Aggregate header stats.
    const sprintTaskIds = new Set(sprints.map((s) => s.id));
    const tasksInSprints = tasks.filter((task) => task.sprintId && sprintTaskIds.has(task.sprintId));
    const doneInSprints = tasksInSprints.filter(isDone).length;
    const overallCompletion = tasksInSprints.length ? clampPct((doneInSprints / tasksInSprints.length) * 100) : 0;

    const sprintHref = `/project/${projectId}/sprints${tenantQuery}`;

    return (
        <div className="po-sprints">
            {/* Aggregate strip */}
            <div className="po-sprints__stats">
                <div className="po-sprints__stat">
                    <span className="po-sprints__stat-value">{active.length}</span>
                    <span className="po-sprints__stat-label">{t('projectOverview.v2.sprints.active', 'Active')}</span>
                </div>
                <div className="po-sprints__stat">
                    <span className="po-sprints__stat-value">{planning.length}</span>
                    <span className="po-sprints__stat-label">{t('projectOverview.v2.sprints.planned', 'Planned')}</span>
                </div>
                <div className="po-sprints__stat">
                    <span className="po-sprints__stat-value">{tasksInSprints.length}</span>
                    <span className="po-sprints__stat-label">{t('projectOverview.v2.sprints.scopedTasks', 'Scoped tasks')}</span>
                </div>
                <div className="po-sprints__stat">
                    <span className="po-sprints__stat-value">{overallCompletion}%</span>
                    <span className="po-sprints__stat-label">{t('projectOverview.v2.sprints.completion', 'Completion')}</span>
                </div>
                <Link to={sprintHref} className="po-sprints__manage">
                    {t('projectOverview.v2.sprints.manage', 'Manage sprints')}
                    <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
            </div>

            {/* Active sprint hero cards */}
            {active.length > 0 && (
                <div className="po-sprints__active">
                    {active.map((sprint) => {
                        const m = sprintMetrics(sprint, tasks);
                        const behind = m.completion < m.timeProgress - 5;
                        const overdue = m.daysLeft < 0;
                        return (
                            <article key={sprint.id} className="po-sprint">
                                <header className="po-sprint__head">
                                    <div className="po-sprint__title-wrap">
                                        <span className="po-sprint__flag po-sprint__flag--active">{t('sprints.status.active', 'Active')}</span>
                                        <h3 className="po-sprint__title">{sprint.name}</h3>
                                        {sprint.goal && <p className="po-sprint__goal">{sprint.goal}</p>}
                                    </div>
                                    <div className={`po-sprint__countdown ${overdue ? 'is-overdue' : m.daysLeft <= 2 ? 'is-soon' : ''}`.trim()}>
                                        <span className="po-sprint__countdown-value">{overdue ? Math.abs(m.daysLeft) : m.daysLeft}</span>
                                        <span className="po-sprint__countdown-label">
                                            {overdue ? t('projectOverview.v2.sprints.daysOverdue', 'days over') : t('projectOverview.v2.sprints.daysLeft', 'days left')}
                                        </span>
                                    </div>
                                </header>

                                {/* Scope completion */}
                                <div className="po-sprint__metric">
                                    <div className="po-sprint__metric-head">
                                        <span>{t('projectOverview.v2.sprints.scope', 'Scope completed')}</span>
                                        <strong>{m.done}/{m.total} · {m.completion}%</strong>
                                    </div>
                                    {/* Status breakdown bar */}
                                    <div className="po-sprint__breakdown" role="img" aria-label={`${m.completion}%`}>
                                        {m.total === 0
                                            ? <span className="po-sprint__breakdown-empty" />
                                            : m.breakdown.map((b) => (
                                                <span
                                                    key={b.key}
                                                    data-status={b.key}
                                                    className="po-sprint__breakdown-seg"
                                                    style={{ width: `${(b.count / m.total) * 100}%` }}
                                                    title={`${labels.statusLabels[b.key] || b.key}: ${b.count}`}
                                                />
                                            ))}
                                    </div>
                                </div>

                                {/* Time vs progress (burndown signal) */}
                                <div className="po-sprint__metric">
                                    <div className="po-sprint__metric-head">
                                        <span>{t('projectOverview.v2.sprints.pace', 'Pace')}</span>
                                        <strong className={behind ? 'is-behind' : 'is-ontrack'}>
                                            {behind ? t('projectOverview.v2.sprints.behind', 'Behind schedule') : t('projectOverview.v2.sprints.onTrack', 'On track')}
                                        </strong>
                                    </div>
                                    <div className="po-sprint__pace">
                                        <div className="po-sprint__pace-track">
                                            <div className="po-sprint__pace-fill" style={{ width: `${m.completion}%` }} />
                                            <div className="po-sprint__pace-marker" style={{ left: `${m.timeProgress}%` }} title={t('projectOverview.v2.sprints.timeElapsed', 'Time elapsed')} />
                                        </div>
                                        <div className="po-sprint__pace-legend">
                                            <span><i className="po-sprint__dot po-sprint__dot--fill" />{t('projectOverview.v2.sprints.work', 'Work')} {m.completion}%</span>
                                            <span><i className="po-sprint__dot po-sprint__dot--time" />{t('projectOverview.v2.sprints.time', 'Time')} {m.timeProgress}%</span>
                                        </div>
                                    </div>
                                </div>

                                <footer className="po-sprint__foot">
                                    <span className="po-sprint__dates">
                                        <span className="material-symbols-outlined">calendar_today</span>
                                        {format(new Date(sprint.startDate), dateFormat, { locale: dateLocale })} – {format(new Date(sprint.endDate), dateFormat, { locale: dateLocale })}
                                    </span>
                                    {m.blocked > 0 && (
                                        <span className="po-sprint__blocked" data-status="Blocked">
                                            <span className="material-symbols-outlined">block</span>
                                            {t('projectOverview.v2.sprints.blockedCount', '{count} blocked').replace('{count}', String(m.blocked))}
                                        </span>
                                    )}
                                    <Avatars ids={sprint.memberIds || []} members={members} />
                                    <Link to={sprintHref} className="po-sprint__open">{t('projectOverview.v2.sprints.openBoard', 'Open board')}</Link>
                                </footer>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* Planning + completed columns */}
            <div className="po-sprints__cols">
                {planning.length > 0 && (
                    <section className="po-sprints__col">
                        <h4 className="po-sprints__col-title">{t('projectOverview.v2.sprints.upcoming', 'Upcoming')}</h4>
                        {planning.map((sprint) => {
                            const m = sprintMetrics(sprint, tasks);
                            const startsIn = differenceInCalendarDays(new Date(sprint.startDate), new Date());
                            return (
                                <div key={sprint.id} className="po-sprints__mini">
                                    <div className="po-sprints__mini-main">
                                        <strong>{sprint.name}</strong>
                                        <span>{t('projectOverview.v2.sprints.scopedTasksShort', '{count} tasks').replace('{count}', String(m.total))}</span>
                                    </div>
                                    <span className="po-sprints__mini-meta">
                                        {startsIn >= 0
                                            ? t('projectOverview.v2.sprints.startsIn', 'in {count}d').replace('{count}', String(startsIn))
                                            : format(new Date(sprint.startDate), dateFormat, { locale: dateLocale })}
                                    </span>
                                </div>
                            );
                        })}
                    </section>
                )}
                {closed.length > 0 && (
                    <section className="po-sprints__col">
                        <h4 className="po-sprints__col-title">{t('projectOverview.v2.sprints.completed', 'Completed')}</h4>
                        {closed.slice(0, 5).map((sprint) => {
                            const m = sprintMetrics(sprint, tasks);
                            return (
                                <div key={sprint.id} className="po-sprints__mini">
                                    <div className="po-sprints__mini-main">
                                        <strong>{sprint.name}</strong>
                                        <span>{format(new Date(sprint.endDate), dateFormat, { locale: dateLocale })}</span>
                                    </div>
                                    <span className="po-sprints__mini-pct" data-status={m.completion >= 100 ? 'Done' : 'Review'}>{m.completion}%</span>
                                </div>
                            );
                        })}
                    </section>
                )}
            </div>
        </div>
    );
};
