import React, { useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ProjectHealth, HealthStatus, HealthFactor } from '../../services/healthService';
import { Task, Milestone, Issue } from '../../types';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { getHealthFactorText, getHealthRecommendations } from '../../utils/healthLocalization';

interface HealthDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    health: ProjectHealth;
    tasks?: Task[];
    milestones?: Milestone[];
    issues?: Issue[];
    projectTitle?: string;
}

type AttentionTone = 'critical' | 'warning' | 'normal';

const DAY = 24 * 60 * 60 * 1000;
const factorTypeOrder: Record<HealthFactor['type'], number> = {
    negative: 0,
    neutral: 1,
    positive: 2
};

const getToneClass = (status: HealthStatus) => {
    if (status === 'excellent' || status === 'healthy') return 'is-healthy';
    if (status === 'warning') return 'is-warning';
    if (status === 'critical') return 'is-critical';
    if (status === 'stalemate') return 'is-stalemate';
    return 'is-normal';
};

const getTrendIcon = (trend: ProjectHealth['trend']) => {
    if (trend === 'improving') return 'trending_up';
    if (trend === 'declining') return 'trending_down';
    return 'trending_flat';
};

const getFactorIcon = (factor: HealthFactor) => {
    const id = factor.id.toLowerCase();
    if (id.includes('deadline') || id.includes('schedule') || id.includes('due')) return 'event';
    if (id.includes('milestone')) return 'flag';
    if (id.includes('sprint') || id.includes('velocity')) return 'speed';
    if (id.includes('blocked') || id.includes('dependency')) return 'account_tree';
    if (id.includes('issue') || id.includes('bug')) return 'bug_report';
    if (id.includes('task') || id.includes('owner')) return 'checklist';
    if (id.includes('initiative')) return 'conversion_path';
    if (id.includes('idea') || id.includes('flow')) return 'hub';
    if (id.includes('activity') || id.includes('comment')) return 'forum';
    if (factor.type === 'positive') return 'check_circle';
    if (factor.type === 'negative') return 'error';
    return 'radio_button_unchecked';
};

export const HealthDetailModal: React.FC<HealthDetailModalProps> = ({
    isOpen,
    onClose,
    health,
    tasks = [],
    milestones = [],
    issues = [],
    projectTitle
}) => {
    const { t } = useLanguage();
    const titleId = useId();
    const subtitleId = useId();
    const now = useMemo(() => Date.now(), [isOpen]);
    const score = Math.max(0, Math.min(100, health.score));
    const radius = 46;
    const circumference = 2 * Math.PI * radius;
    const strokeOffset = circumference - (score / 100) * circumference;

    useEffect(() => {
        if (!isOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const riskItems = useMemo(() => {
        const overdueTasks = tasks.filter(task => {
            if (task.isCompleted || task.status === 'Done' || !task.dueDate) return false;
            return new Date(task.dueDate).getTime() < now;
        });
        const dueSoonTasks = tasks.filter(task => {
            if (task.isCompleted || task.status === 'Done' || !task.dueDate) return false;
            const due = new Date(task.dueDate).getTime();
            return due >= now && due <= now + 3 * DAY;
        });
        const blockedTasks = tasks.filter(task => task.status === 'Blocked');
        const overdueMilestones = milestones.filter(milestone => {
            if (milestone.status === 'Achieved' || !milestone.dueDate) return false;
            return new Date(milestone.dueDate).getTime() < now;
        });
        const urgentIssues = issues.filter(issue =>
            (issue.priority === 'Urgent' || issue.priority === 'High') &&
            issue.status !== 'Resolved' &&
            issue.status !== 'Closed'
        );

        return [
            { id: 'overdue-tasks', icon: 'event_busy', label: t('healthDetail.attention.overdueTasks'), count: overdueTasks.length, tone: 'critical' as AttentionTone },
            { id: 'due-soon', icon: 'schedule', label: t('healthDetail.attention.dueSoon'), count: dueSoonTasks.length, tone: 'warning' as AttentionTone },
            { id: 'blocked-tasks', icon: 'block', label: t('healthDetail.attention.blocked'), count: blockedTasks.length, tone: 'critical' as AttentionTone },
            { id: 'overdue-milestones', icon: 'flag', label: t('healthDetail.attention.milestones'), count: overdueMilestones.length, tone: 'warning' as AttentionTone },
            { id: 'urgent-issues', icon: 'bug_report', label: t('healthDetail.attention.criticalIssues'), count: urgentIssues.length, tone: 'critical' as AttentionTone }
        ].filter(item => item.count > 0);
    }, [issues, milestones, now, t, tasks]);

    const sortedFactors = useMemo(() => {
        return [...health.factors].sort((a, b) => {
            const typeDelta = factorTypeOrder[a.type] - factorTypeOrder[b.type];
            if (typeDelta !== 0) return typeDelta;
            return Math.abs(b.impact) - Math.abs(a.impact);
        });
    }, [health.factors]);

    const negativeFactors = health.factors.filter(factor => factor.type === 'negative');
    const positiveFactors = health.factors.filter(factor => factor.type === 'positive');
    const recommendations = getHealthRecommendations(health, t);
    const attentionCount = riskItems.reduce((sum, item) => sum + item.count, 0);
    const hasSideColumn = riskItems.length > 0 || recommendations.length > 0;
    const hasAnyDetail = sortedFactors.length > 0 || hasSideColumn;

    if (!isOpen) return null;

    const modal = (
        <div
            className={`project-health-modal ${getToneClass(health.status)}`}
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className="project-health-modal__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={projectTitle ? subtitleId : undefined}
            >
                <button
                    type="button"
                    className="project-health-modal__close"
                    onClick={onClose}
                    aria-label={t('healthDetail.actions.close', 'Close')}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>

                <header className="project-health-modal__hero">
                    <div className="project-health-modal__score" aria-label={`${t('healthDetail.score')}: ${score}`}>
                        <svg className="project-health-modal__score-svg" viewBox="0 0 112 112" aria-hidden="true">
                            <circle
                                className="project-health-modal__score-track"
                                cx="56"
                                cy="56"
                                r={radius}
                                fill="none"
                                strokeWidth="9"
                            />
                            <circle
                                className="project-health-modal__score-value"
                                cx="56"
                                cy="56"
                                r={radius}
                                fill="none"
                                strokeWidth="9"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeOffset}
                            />
                        </svg>
                        <div className="project-health-modal__score-copy">
                            <strong>{score}</strong>
                            <span>{t('healthDetail.score')}</span>
                        </div>
                    </div>

                    <div className="project-health-modal__headline">
                        <p className="project-health-modal__eyebrow">
                            <span className="material-symbols-outlined" aria-hidden="true">monitoring</span>
                            {t('healthDetail.title')}
                        </p>
                        <h2 id={titleId} className="project-health-modal__title">
                            {projectTitle || t('healthDetail.title')}
                        </h2>
                        {projectTitle && (
                            <p id={subtitleId} className="project-health-modal__subtitle">
                                {t('healthDetail.title')}
                            </p>
                        )}

                        <div className="project-health-modal__chips">
                            <span className="project-health-modal__status-chip">
                                <span className="project-health-modal__status-dot" aria-hidden="true" />
                                {t(`status.${health.status}`, health.status)}
                            </span>
                            <span className={`project-health-modal__trend-chip is-${health.trend}`}>
                                <span className="material-symbols-outlined" aria-hidden="true">{getTrendIcon(health.trend)}</span>
                                {t(`trend.${health.trend}`, health.trend)}
                            </span>
                        </div>

                        <div className="project-health-modal__stats" aria-label={t('healthDetail.title')}>
                            <SummaryMetric icon="report" label={t('healthDetail.stats.risks')} value={negativeFactors.length} tone="critical" />
                            <SummaryMetric icon="verified" label={t('healthDetail.stats.strengths')} value={positiveFactors.length} tone="healthy" />
                            <SummaryMetric icon="priority_high" label={t('healthDetail.stats.attention')} value={attentionCount} tone="warning" />
                        </div>
                    </div>
                </header>

                <div className={`project-health-modal__body ${hasSideColumn ? 'has-side-column' : 'is-single-column'}`}>
                    {hasAnyDetail ? (
                        <>
                            {sortedFactors.length > 0 && (
                                <section className="project-health-modal__section project-health-modal__section--factors">
                                    <SectionHeader icon="analytics" title={t('healthDetail.factors.title')} />
                                    <div className="project-health-modal__factor-list">
                                        {sortedFactors.map((factor) => {
                                            const { label, description } = getHealthFactorText(factor, t);
                                            return (
                                                <FactorRow
                                                    key={factor.id}
                                                    factor={factor}
                                                    icon={getFactorIcon(factor)}
                                                    label={label}
                                                    description={description}
                                                />
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {hasSideColumn && (
                                <aside className="project-health-modal__side">
                                    {riskItems.length > 0 && (
                                        <section className="project-health-modal__section">
                                            <SectionHeader icon="warning" title={t('healthDetail.attention.title')} />
                                            <div className="project-health-modal__attention-list">
                                                {riskItems.map(item => (
                                                    <AttentionItem
                                                        key={item.id}
                                                        icon={item.icon}
                                                        label={item.label}
                                                        count={item.count}
                                                        tone={item.tone}
                                                    />
                                                ))}
                                            </div>
                                        </section>
                                    )}

                                    {recommendations.length > 0 && (
                                        <section className="project-health-modal__section">
                                            <SectionHeader icon="lightbulb" title={t('healthDetail.recommendations.title')} />
                                            <div className="project-health-modal__recommendation-list">
                                                {recommendations.map((recommendation, index) => (
                                                    <div key={`${recommendation}-${index}`} className="project-health-modal__recommendation">
                                                        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                                                        <p>{recommendation}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </aside>
                            )}
                        </>
                    ) : (
                        <div className="project-health-modal__empty">
                            <span className="material-symbols-outlined" aria-hidden="true">verified</span>
                            <strong>{t('healthDetail.empty.title')}</strong>
                            <p>{t('healthDetail.empty.subtitle')}</p>
                        </div>
                    )}
                </div>

                <footer className="project-health-modal__footer">
                    <Button onClick={onClose} size="md">
                        {t('healthDetail.actions.done')}
                    </Button>
                </footer>
            </section>
        </div>
    );

    return createPortal(modal, document.body);
};

const SectionHeader: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
    <div className="project-health-modal__section-header">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
    </div>
);

const SummaryMetric: React.FC<{ icon: string; label: string; value: number; tone: 'critical' | 'healthy' | 'warning' }> = ({
    icon,
    label,
    value,
    tone
}) => (
    <div className={`project-health-modal__metric is-${tone}`}>
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <div>
            <strong>{value}</strong>
            <span>{label}</span>
        </div>
    </div>
);

const AttentionItem: React.FC<{ icon: string; label: string; count: number; tone: AttentionTone }> = ({
    icon,
    label,
    count,
    tone
}) => (
    <div className={`project-health-modal__attention-item is-${tone}`}>
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <span>{label}</span>
        <strong>{count}</strong>
    </div>
);

const FactorRow: React.FC<{ factor: HealthFactor; icon: string; label: string; description: string }> = ({
    factor,
    icon,
    label,
    description
}) => (
    <article className={`project-health-modal__factor is-${factor.type}`}>
        <span className="project-health-modal__factor-icon material-symbols-outlined" aria-hidden="true">{icon}</span>
        <div className="project-health-modal__factor-copy">
            <h4>{label}</h4>
            <p>{description}</p>
        </div>
        <span className="project-health-modal__factor-impact">
            {factor.impact > 0 ? '+' : ''}{factor.impact}
        </span>
    </article>
);
