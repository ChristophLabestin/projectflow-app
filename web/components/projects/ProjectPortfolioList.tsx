import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';

import { useLanguage } from '../../context/LanguageContext';
import type { Milestone, Project, Task } from '../../types';
import { portfolioGroup, type PortfolioGroup } from '../../utils/attention';
import { daysFromToday, isDateOverdue, parseDateValue } from '../../utils/taskDates';
import type { ProjectHealth } from '../../services/healthService';
import { initialOf } from '../../utils/initials';

export interface ProjectPortfolioInputs {
    tasks: Task[];
    milestones: Milestone[];
}

interface ProjectPortfolioListProps {
    projects: Project[];
    inputsByProject: Record<string, ProjectPortfolioInputs | undefined>;
    healthByProject: Record<string, ProjectHealth | undefined>;
    onOpen: (project: Project) => void;
    storageKey?: string;
}

type PortfolioGroupKey = PortfolioGroup;

const CLOSED_STATUSES = ['Completed', 'Canceled'];

interface ProjectSignals {
    open: number;
    done: number;
    total: number;
    overdue: number;
    blocked: number;
    dueToday: number;
    nextMilestone?: Milestone;
}

const computeSignals = (inputs?: ProjectPortfolioInputs): ProjectSignals | null => {
    if (!inputs) return null;
    const signals: ProjectSignals = { open: 0, done: 0, total: inputs.tasks.length, overdue: 0, blocked: 0, dueToday: 0 };
    inputs.tasks.forEach((task) => {
        if (task.isCompleted) {
            signals.done += 1;
            return;
        }
        signals.open += 1;
        if (task.status === 'Blocked') signals.blocked += 1;
        if (isDateOverdue(task.dueDate)) signals.overdue += 1;
        else if (daysFromToday(task.dueDate) === 0) signals.dueToday += 1;
    });
    signals.nextMilestone = inputs.milestones
        .filter((milestone) => milestone.status === 'Pending' && milestone.dueDate)
        .sort((a, b) => parseDateValue(a.dueDate).getTime() - parseDateValue(b.dueDate).getTime())[0];
    return signals;
};

const groupFor = (project: Project, signals: ProjectSignals | null, health?: ProjectHealth): PortfolioGroupKey => (
    portfolioGroup(project, signals, health?.status, { now: Date.now() })
);

const GROUP_ORDER: { key: PortfolioGroupKey; tone: string }[] = [
    { key: 'attention', tone: 'danger' },
    { key: 'active', tone: 'accent' },
    { key: 'planning', tone: 'neutral' },
    { key: 'paused', tone: 'warning' },
    { key: 'closed', tone: 'muted' }
];

const readCollapsed = (key: string) => {
    try {
        const raw = localStorage.getItem(key);
        return new Set<string>(raw ? JSON.parse(raw) : ['closed']);
    } catch {
        return new Set<string>(['closed']);
    }
};

/**
 * Scannable project portfolio: one row per project, grouped so the projects
 * that need a decision come first. Replaces the spotlight/card grid.
 */
export const ProjectPortfolioList = ({
    projects,
    inputsByProject,
    healthByProject,
    onOpen,
    storageKey = 'projectflow.projects.collapsed'
}: ProjectPortfolioListProps) => {
    const { t, dateLocale } = useLanguage();
    const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));
    const shortDate = dateLocale?.code?.startsWith('de') ? 'd. MMM yyyy' : 'MMM d, yyyy';

    const rows = useMemo(() => projects.map((project) => {
        const signals = computeSignals(inputsByProject[project.id]);
        const health = healthByProject[project.id];
        return { project, signals, health, group: groupFor(project, signals, health) };
    }), [projects, inputsByProject, healthByProject]);

    const toggle = (key: string) => {
        setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            try {
                localStorage.setItem(storageKey, JSON.stringify([...next]));
            } catch {
                // best-effort
            }
            return next;
        });
    };

    const formatDate = (value?: string) => (value ? format(parseDateValue(value), shortDate, { locale: dateLocale }) : '');

    const renderAttention = (signals: ProjectSignals | null, project: Project) => {
        if (!signals) return <span className="portfolio-row__hint">{t(`projects.portfolio.status.${project.status}`)}</span>;
        const parts: { tone: string; text: string }[] = [];
        if (signals.overdue) parts.push({ tone: 'danger', text: t('projects.portfolio.overdue').replace('{count}', String(signals.overdue)) });
        if (signals.blocked) parts.push({ tone: 'danger', text: t('projects.portfolio.blocked').replace('{count}', String(signals.blocked)) });
        if (signals.dueToday) parts.push({ tone: 'warning', text: t('projects.portfolio.dueToday').replace('{count}', String(signals.dueToday)) });
        if (!parts.length) {
            return <span className="portfolio-row__hint portfolio-row__hint--ok">{t(signals.open ? 'projects.portfolio.onTrack' : 'projects.portfolio.noOpenTasks')}</span>;
        }
        return (
            <span className="portfolio-row__signals">
                {parts.map((part) => (
                    <span key={part.text} className={`portfolio-row__signal portfolio-row__signal--${part.tone}`}>{part.text}</span>
                ))}
            </span>
        );
    };

    if (!rows.length) return null;

    return (
        <div className="work-groups portfolio">
            {GROUP_ORDER.map(({ key, tone }) => {
                const groupRows = rows.filter((row) => row.group === key);
                if (!groupRows.length) return null;
                const isCollapsed = collapsed.has(key);
                const label = t(`projects.portfolio.group.${key}`);
                return (
                    <section key={key} className={`work-group work-group--${tone}`}>
                        <button
                            type="button"
                            className="work-group__header"
                            aria-expanded={!isCollapsed}
                            aria-label={t(isCollapsed ? 'work.group.expand' : 'work.group.collapse').replace('{group}', label)}
                            onClick={() => toggle(key)}
                        >
                            <span className={`material-symbols-outlined work-group__chevron ${isCollapsed ? 'is-collapsed' : ''}`}>expand_more</span>
                            <span className="work-group__label">{label}</span>
                            <span className="work-group__count">{groupRows.length}</span>
                        </button>
                        {!isCollapsed && (
                            <div className="work-group__rows" role="list">
                                {groupRows.map(({ project, signals }) => {
                                    const progress = signals && signals.total ? Math.round((signals.done / signals.total) * 100) : null;
                                    const milestone = signals?.nextMilestone;
                                    const projectOverdue = !!project.dueDate && isDateOverdue(project.dueDate) && !CLOSED_STATUSES.includes(project.status);
                                    return (
                                        <button
                                            key={project.id}
                                            type="button"
                                            role="listitem"
                                            className="portfolio-row"
                                            onClick={() => onOpen(project)}
                                        >
                                            <span className="portfolio-row__avatar" aria-hidden="true">
                                                {project.squareIcon ? <img src={project.squareIcon} alt="" /> : initialOf(project.title)}
                                            </span>
                                            <span className="portfolio-row__main">
                                                <span className="portfolio-row__title">{project.title}</span>
                                                <span className="portfolio-row__meta">{renderAttention(signals, project)}</span>
                                            </span>
                                            <span className="portfolio-row__progress" aria-label={progress === null ? undefined : t('projects.portfolio.progressAria').replace('{done}', String(signals?.done)).replace('{total}', String(signals?.total))}>
                                                {progress !== null && (
                                                    <>
                                                        <span className="portfolio-row__bar"><span style={{ width: `${progress}%` }} /></span>
                                                        <span className="portfolio-row__count">{signals?.done}/{signals?.total}</span>
                                                    </>
                                                )}
                                            </span>
                                            <span className="portfolio-row__date">
                                                {milestone ? (
                                                    <>
                                                        <span className="portfolio-row__date-label">{t('projects.portfolio.nextMilestone')}</span>
                                                        <span>{milestone.title} · {formatDate(milestone.dueDate)}</span>
                                                    </>
                                                ) : project.dueDate ? (
                                                    <>
                                                        <span className="portfolio-row__date-label">{t('projects.portfolio.due')}</span>
                                                        <span className={projectOverdue ? 'is-overdue' : ''}>{formatDate(project.dueDate)}</span>
                                                    </>
                                                ) : null}
                                            </span>
                                            <span className="portfolio-row__team" aria-label={t('projects.portfolio.members').replace('{count}', String(project.memberIds?.length || 1))}>
                                                <span className="material-symbols-outlined" aria-hidden="true">group</span>
                                                {project.memberIds?.length || 1}
                                            </span>
                                            <span className="material-symbols-outlined portfolio-row__open" aria-hidden="true">chevron_right</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );
};
