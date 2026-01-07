import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Milestone } from '../../types';
import { Modal } from '../common/Modal/Modal';
import { Button } from '../common/Button/Button';
import { Badge } from '../common/Badge/Badge';
import { Card } from '../common/Card/Card';
import { useLanguage } from '../../context/LanguageContext';

interface MilestoneDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    milestone?: Milestone;
    onEdit: (milestone: Milestone) => void;
    taskStatusLookup: Record<string, { isCompleted: boolean; hasSubtasks: boolean; dueDate?: string; priority?: string; title: string }>;
    subtaskLookup: Record<string, { total: number; completed: number }>;
    ideaLookup: Record<string, string>;
}

export const MilestoneDetailModal = ({
    isOpen,
    onClose,
    milestone,
    onEdit,
    taskStatusLookup,
    subtaskLookup,
    ideaLookup
}: MilestoneDetailModalProps) => {
    type RiskLevel = 'Low' | 'Medium' | 'High';
    const { dateLocale, dateFormat, t } = useLanguage();

    const statusLabels = useMemo(() => ({
        Pending: t('projectMilestones.status.pending'),
        Achieved: t('projectMilestones.status.achieved'),
        Missed: t('projectMilestones.status.missed')
    }), [t]);

    const riskLabels = useMemo(() => ({
        Low: t('projectMilestones.risk.low'),
        Medium: t('projectMilestones.risk.medium'),
        High: t('projectMilestones.risk.high')
    }), [t]);

    if (!isOpen || !milestone) return null;

    const getMilestoneRisk = (): RiskLevel => {
        if (milestone.status === 'Achieved') return 'Low';

        const now = new Date();
        const dueDate = milestone.dueDate ? new Date(milestone.dueDate) : null;

        if (dueDate && dueDate < now) return 'High';

        let totalProgress = 0;
        if (milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0) {
            milestone.linkedTaskIds.forEach(tid => {
                const sub = subtaskLookup[tid];
                if (sub && sub.total > 0) {
                    totalProgress += (sub.completed / sub.total);
                } else {
                    const taskData = taskStatusLookup[tid];
                    if (taskData && taskData.isCompleted) {
                        totalProgress += 1;
                    }
                }
            });
        }
        const progress = milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0
            ? Math.round((totalProgress / milestone.linkedTaskIds.length) * 100)
            : 0;

        if (dueDate) {
            const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 3 && progress < 50) return 'High';
            if (diffDays <= 7 && progress < 70) return 'Medium';
        }

        let hasUrgent = false;
        let hasHigh = false;
        milestone.linkedTaskIds?.forEach(tid => {
            const task = taskStatusLookup[tid];
            if (task && !task.isCompleted) {
                if (task.priority === 'Urgent') hasUrgent = true;
                if (task.priority === 'High') hasHigh = true;
            }
        });

        if (hasUrgent) return 'High';
        if (hasHigh) return 'Medium';

        return 'Low';
    };

    const risk = (milestone.riskRating || getMilestoneRisk()) as RiskLevel;
    const isAchieved = milestone.status === 'Achieved';

    const getStatusVariant = (status: Milestone['status']) => {
        if (status === 'Achieved') return 'success';
        if (status === 'Missed') return 'error';
        return 'neutral';
    };

    const getRiskVariant = (riskLevel: RiskLevel) => {
        if (riskLevel === 'High') return 'error';
        if (riskLevel === 'Medium') return 'warning';
        return 'neutral';
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('projectMilestones.detail.title')}
            size="lg"
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t('projectMilestones.detail.actions.close')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            onClose();
                            onEdit(milestone);
                        }}
                        icon={<span className="material-symbols-outlined">edit</span>}
                    >
                        {t('projectMilestones.detail.actions.edit')}
                    </Button>
                </>
            )}
        >
            <div className="milestone-detail">
                <div className="milestone-detail__header">
                    <div className="milestone-detail__badges">
                        <Badge variant={getStatusVariant(milestone.status)}>
                            {statusLabels[milestone.status]}
                        </Badge>
                        {risk !== 'Low' && !isAchieved && (
                            <Badge variant={getRiskVariant(risk)}>
                                {riskLabels[risk]}
                            </Badge>
                        )}
                    </div>
                    <h2 className="milestone-detail__title">{milestone.title}</h2>
                    {milestone.description && (
                        <p className="milestone-detail__description">{milestone.description}</p>
                    )}
                </div>

                <div className="milestone-detail__summary">
                    <Card className="milestone-detail__summary-card">
                        <div className="milestone-detail__summary-label">{t('projectMilestones.detail.dueDate')}</div>
                        <div className="milestone-detail__summary-value">
                            <span className="material-symbols-outlined">calendar_today</span>
                            <span>
                                {milestone.dueDate
                                    ? format(new Date(milestone.dueDate), dateFormat, { locale: dateLocale })
                                    : t('projectMilestones.detail.noDueDate')}
                            </span>
                        </div>
                    </Card>

                    <Card className="milestone-detail__summary-card">
                        <div className="milestone-detail__summary-label">{t('projectMilestones.detail.initiative')}</div>
                        {milestone.linkedInitiativeId ? (
                            <div className="milestone-detail__summary-value">
                                <span className="material-symbols-outlined">rocket_launch</span>
                                <span>
                                    {ideaLookup[milestone.linkedInitiativeId] || t('projectMilestones.detail.initiativeUnknown')}
                                </span>
                            </div>
                        ) : (
                            <div className="milestone-detail__summary-empty">{t('projectMilestones.detail.initiativeNone')}</div>
                        )}
                    </Card>
                </div>

                <div className="milestone-detail__tasks">
                    <h3 className="milestone-detail__section-title">
                        <span className="material-symbols-outlined">task</span>
                        {t('projectMilestones.detail.tasks.title').replace('{count}', String(milestone.linkedTaskIds?.length || 0))}
                    </h3>

                    {milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0 ? (
                        <div className="milestone-detail__task-list">
                            {milestone.linkedTaskIds.map(tid => {
                                const task = taskStatusLookup[tid];
                                const sub = subtaskLookup[tid];
                                const title = task?.title || t('projectMilestones.detail.tasks.unavailable');
                                const isDone = task?.isCompleted;

                                return (
                                    <div key={tid} className="milestone-detail__task">
                                        <div className="milestone-detail__task-info">
                                            <span
                                                className="milestone-detail__task-status"
                                                data-complete={isDone ? 'true' : 'false'}
                                            >
                                                {isDone && <span className="material-symbols-outlined">check</span>}
                                            </span>
                                            <span className={`milestone-detail__task-title ${isDone ? 'is-complete' : ''}`}>
                                                {title}
                                            </span>
                                        </div>
                                        {sub && sub.total > 0 && (
                                            <span className="milestone-detail__task-subtasks">
                                                {t('projectMilestones.detail.tasks.subtasks')
                                                    .replace('{completed}', String(sub.completed))
                                                    .replace('{total}', String(sub.total))}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="milestone-detail__tasks-empty">{t('projectMilestones.detail.tasks.empty')}</p>
                    )}
                </div>
            </div>
        </Modal>
    );
};
