import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { collection, collectionGroup, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import { Milestone } from '../types';
import { MilestoneModal } from '../components/Milestones/MilestoneModal';
import { MilestoneDetailModal } from '../components/Milestones/MilestoneDetailModal';
import { useConfirm } from '../context/UIContext';
import { subscribeProjectMilestones, deleteMilestone, updateMilestone } from '../services/dataService';
import { db } from '../services/firebase';
import { Badge } from '../components/common/Badge/Badge';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/common/Card/Card';
import { useLanguage } from '../context/LanguageContext';

export const ProjectMilestones = () => {
    type RiskLevel = 'Low' | 'Medium' | 'High';
    const { id: projectId } = useParams<{ id: string }>();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (t: string | null) => void }>();
    const { dateLocale, t } = useLanguage();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>(undefined);
    const [viewingMilestone, setViewingMilestone] = useState<Milestone | undefined>(undefined);
    const [ideaLookup, setIdeaLookup] = useState<Record<string, string>>({});
    const [taskStatusLookup, setTaskStatusLookup] = useState<Record<string, { isCompleted: boolean; hasSubtasks: boolean; dueDate?: string; priority?: string; title: string }>>({});
    const [subtaskLookup, setSubtaskLookup] = useState<Record<string, { total: number; completed: number }>>({});
    const confirm = useConfirm();

    const statusLabels = useMemo(() => ({
        Pending: t('projectMilestones.status.pending'),
        Achieved: t('projectMilestones.status.achieved'),
        Missed: t('projectMilestones.status.missed'),
    }), [t]);

    const riskLabels = useMemo(() => ({
        Low: t('projectMilestones.risk.low'),
        Medium: t('projectMilestones.risk.medium'),
        High: t('projectMilestones.risk.high'),
    }), [t]);

    useEffect(() => {
        setTaskTitle(t('nav.milestones'));
        return () => setTaskTitle(null);
    }, [setTaskTitle, t]);

    useEffect(() => {
        if (!projectId) return;

        const unsub = subscribeProjectMilestones(projectId, (data) => {
            setMilestones(data);
            setLoading(false);
        });

        const fetchIdeas = async () => {
            try {
                const snapshot = await getDocs(query(collectionGroup(db, 'ideas'), where('projectId', '==', projectId)));
                const lookup: Record<string, string> = {};
                snapshot.forEach(doc => {
                    lookup[doc.id] = doc.data().title;
                });
                setIdeaLookup(lookup);
            } catch (e) {
                console.error('Failed to fetch flow lookup', e);
            }
        };
        fetchIdeas();

        const tasksQ = query(collectionGroup(db, 'tasks'), where('projectId', '==', projectId));
        const unsubTasks = onSnapshot(tasksQ, (snap) => {
            const lookup: Record<string, { isCompleted: boolean; hasSubtasks: boolean; dueDate?: string; priority?: string; title: string }> = {};
            snap.forEach(doc => {
                const data = doc.data();
                lookup[doc.id] = {
                    isCompleted: data.isCompleted === true || data.status === 'Done',
                    hasSubtasks: false,
                    dueDate: data.dueDate,
                    priority: data.priority,
                    title: data.title
                };
            });
            setTaskStatusLookup(prev => ({ ...prev, ...lookup }));
        });

        return () => {
            unsub();
            unsubTasks();
        };
    }, [projectId]);

    useEffect(() => {
        if (milestones.length === 0) return;
        const tenantId = milestones[0].tenantId;
        if (!tenantId) return;

        const allTaskIds = new Set<string>();
        milestones.forEach(m => m.linkedTaskIds?.forEach(id => allTaskIds.add(id)));

        if (allTaskIds.size === 0) {
            setSubtaskLookup({});
            return;
        }

        const unsubs: (() => void)[] = [];

        allTaskIds.forEach(taskId => {
            const subtasksRef = collection(db, 'tenants', tenantId, 'projects', projectId!, 'tasks', taskId, 'subtasks');

            const unsub = onSnapshot(subtasksRef, (snap) => {
                let total = 0;
                let completed = 0;
                snap.forEach(doc => {
                    total++;
                    if (doc.data().isCompleted) completed++;
                });

                setSubtaskLookup(prev => ({
                    ...prev,
                    [taskId]: { total, completed }
                }));
            });
            unsubs.push(unsub);
        });

        return () => {
            unsubs.forEach(u => u());
        };
    }, [milestones, projectId]);

    const handleEdit = (milestone: Milestone) => {
        setEditingMilestone(milestone);
        setIsModalOpen(true);
    };

    const handleDelete = async (milestone: Milestone) => {
        if (!projectId) return;
        const confirmed = await confirm(
            t('projectMilestones.confirm.delete.title'),
            t('projectMilestones.confirm.delete.message').replace('{title}', milestone.title)
        );
        if (confirmed) {
            await deleteMilestone(projectId, milestone.id);
        }
    };

    const handleStatusToggle = async (milestone: Milestone) => {
        if (!projectId) return;
        const newStatus = milestone.status === 'Achieved' ? 'Pending' : 'Achieved';

        const optimisticMilestones = milestones.map(m =>
            m.id === milestone.id ? { ...m, status: newStatus as Milestone['status'] } : m
        );
        setMilestones(optimisticMilestones);

        await updateMilestone(projectId, milestone.id, { status: newStatus });
    };

    const stats = useMemo(() => {
        const total = milestones.length;
        const achieved = milestones.filter(m => m.status === 'Achieved').length;
        const progress = total > 0 ? Math.round((achieved / total) * 100) : 0;
        return { total, achieved, progress };
    }, [milestones]);

    const sortedMilestones = useMemo(() => {
        return [...milestones].sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
            return dateA - dateB;
        });
    }, [milestones]);

    const nextPendingIndex = sortedMilestones.findIndex(m => m.status === 'Pending');

    const getMilestoneProgress = (milestone: Milestone) => {
        if (!milestone.linkedTaskIds || milestone.linkedTaskIds.length === 0) return 0;
        let totalProgress = 0;
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
        return Math.round((totalProgress / milestone.linkedTaskIds.length) * 100);
    };

    const getMilestoneRisk = (milestone: Milestone, progress: number): RiskLevel => {
        if (milestone.status === 'Achieved') return 'Low';

        const now = new Date();
        const dueDate = milestone.dueDate ? new Date(milestone.dueDate) : null;

        if (dueDate && dueDate < now) return 'High';

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

    const getStatusVariant = (status: Milestone['status']) => {
        if (status === 'Achieved') return 'success';
        if (status === 'Missed') return 'error';
        return 'neutral';
    };

    if (loading) {
        return (
            <div className="project-milestones__loading">
                <span className="material-symbols-outlined project-milestones__loading-icon">progress_activity</span>
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="project-milestones__empty">
                <h3 className="project-milestones__empty-title">{t('projectMilestones.error.projectMissing')}</h3>
            </div>
        );
    }

    return (
        <div className="project-milestones">
            <header className="project-milestones__header">
                <div className="project-milestones__heading">
                    <Badge variant="neutral" className="project-milestones__tag">
                        {t('projectMilestones.header.tag')}
                    </Badge>
                    <h1 className="project-milestones__title">{t('projectMilestones.header.title')}</h1>
                    <p className="project-milestones__subtitle">{t('projectMilestones.header.subtitle')}</p>
                </div>

                <div className="project-milestones__header-actions">
                    <div className="project-milestones__stat">
                        <span className="project-milestones__stat-value">{stats.achieved} / {stats.total}</span>
                        <span className="project-milestones__stat-label">{t('projectMilestones.stats.achieved')}</span>
                    </div>
                    <Button
                        onClick={() => { setEditingMilestone(undefined); setIsModalOpen(true); }}
                        variant="primary"
                        className="project-milestones__new-button"
                        icon={<span className="material-symbols-outlined">add</span>}
                    >
                        {t('projectMilestones.actions.new')}
                    </Button>
                </div>
            </header>

            <div className="project-milestones__progress">
                <div className="project-milestones__progress-track">
                    <div
                        className="project-milestones__progress-fill"
                        style={{ width: `${stats.progress}%` }}
                    />
                </div>
                <div className="project-milestones__progress-meta">
                    <span className="project-milestones__progress-label">{t('projectMilestones.progress.label')}</span>
                    <span className="project-milestones__progress-value">{stats.progress}%</span>
                </div>
            </div>

            <section className="project-milestones__timeline">
                {sortedMilestones.length === 0 ? (
                    <div className="project-milestones__empty-state">
                        <div className="project-milestones__empty-icon">
                            <span className="material-symbols-outlined">map</span>
                        </div>
                        <h3 className="project-milestones__empty-title">{t('projectMilestones.empty.title')}</h3>
                        <p className="project-milestones__empty-text">{t('projectMilestones.empty.description')}</p>
                        <Button
                            onClick={() => { setEditingMilestone(undefined); setIsModalOpen(true); }}
                            variant="secondary"
                        >
                            {t('projectMilestones.empty.action')}
                        </Button>
                    </div>
                ) : (
                    <div className="project-milestones__list">
                        <div className="project-milestones__line" />
                        {sortedMilestones.map((milestone, index) => {
                            const isAchieved = milestone.status === 'Achieved';
                            const isNextUp = index === nextPendingIndex;
                            const isLeft = index % 2 === 0;
                            const progress = getMilestoneProgress(milestone);
                            const calculatedRisk = getMilestoneRisk(milestone, progress);
                            const riskLevel = (milestone.riskRating || calculatedRisk) as RiskLevel;
                            const showRisk = riskLevel !== 'Low' && milestone.status !== 'Achieved';

                            return (
                                <div
                                    key={milestone.id}
                                    className={`project-milestones__item ${isLeft ? 'is-left' : 'is-right'} ${isAchieved ? 'is-achieved' : ''}`}
                                >
                                    <div
                                        className="project-milestones__marker"
                                        data-status={milestone.status.toLowerCase()}
                                        data-next={isNextUp ? 'true' : 'false'}
                                    >
                                        <span className="material-symbols-outlined">
                                            {isAchieved ? 'check' : isNextUp ? 'near_me' : 'radio_button_unchecked'}
                                        </span>
                                    </div>

                                    <div className="project-milestones__card-wrapper">
                                        <Card
                                            className="project-milestones__card"
                                            data-status={milestone.status.toLowerCase()}
                                            data-risk={riskLevel.toLowerCase()}
                                            data-next={isNextUp ? 'true' : 'false'}
                                            onClick={() => {
                                                setViewingMilestone(milestone);
                                                setIsDetailModalOpen(true);
                                            }}
                                        >
                                            <div className="project-milestones__card-header">
                                                <div className="project-milestones__date-badge" data-tone={isNextUp ? 'next' : isAchieved ? 'success' : showRisk ? riskLevel.toLowerCase() : 'neutral'}>
                                                    {milestone.dueDate ? (
                                                        <>
                                                            <span className="project-milestones__date-month">
                                                                {format(new Date(milestone.dueDate), 'MMM', { locale: dateLocale })}
                                                            </span>
                                                            <span className="project-milestones__date-day">
                                                                {new Date(milestone.dueDate).getDate()}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="material-symbols-outlined">event</span>
                                                    )}
                                                </div>

                                                <div className="project-milestones__card-body">
                                                    <div className="project-milestones__card-meta">
                                                        <Badge variant={getStatusVariant(milestone.status)} className="project-milestones__status-badge">
                                                            {statusLabels[milestone.status]}
                                                        </Badge>
                                                        {isNextUp && (
                                                            <Badge variant="warning" className="project-milestones__next-badge">
                                                                {t('projectMilestones.timeline.next')}
                                                            </Badge>
                                                        )}
                                                        {showRisk && (
                                                            <Badge variant={riskLevel === 'High' ? 'error' : 'warning'} className="project-milestones__risk-badge">
                                                                {riskLabels[riskLevel]}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <h3 className="project-milestones__card-title">{milestone.title}</h3>

                                                    {milestone.description && (
                                                        <p className="project-milestones__card-description">{milestone.description}</p>
                                                    )}

                                                    <div className="project-milestones__card-tags">
                                                        {milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0 && (
                                                            <span className="project-milestones__tag-pill">
                                                                <span className="material-symbols-outlined">task</span>
                                                                {t('projectMilestones.timeline.tasks').replace('{count}', String(milestone.linkedTaskIds.length))}
                                                            </span>
                                                        )}
                                                        {milestone.linkedInitiativeId && (
                                                            <span className="project-milestones__tag-pill project-milestones__tag-pill--initiative">
                                                                <span className="material-symbols-outlined">rocket_launch</span>
                                                                <span className="project-milestones__tag-text">
                                                                    {ideaLookup[milestone.linkedInitiativeId] || t('projectMilestones.timeline.initiativeFallback')}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    {milestone.linkedTaskIds && milestone.linkedTaskIds.length > 0 && (
                                                        <div className="project-milestones__card-progress">
                                                            <div className="project-milestones__card-progress-label">
                                                                <span>{t('projectMilestones.timeline.progress')}</span>
                                                                <span className={progress === 100 ? 'is-complete' : ''}>{progress}%</span>
                                                            </div>
                                                            <div className="project-milestones__card-progress-track">
                                                                <div
                                                                    className="project-milestones__card-progress-fill"
                                                                    style={{ width: `${progress}%` }}
                                                                    data-complete={progress === 100 ? 'true' : 'false'}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="project-milestones__card-actions">
                                                        <Button
                                                            size="sm"
                                                            variant={isAchieved ? 'secondary' : 'primary'}
                                                            className="project-milestones__status-button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleStatusToggle(milestone);
                                                            }}
                                                        >
                                                            {isAchieved ? t('projectMilestones.actions.markIncomplete') : t('projectMilestones.actions.achieve')}
                                                        </Button>
                                                        <div className="project-milestones__icon-actions">
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="project-milestones__icon-button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEdit(milestone);
                                                                }}
                                                                aria-label={t('projectMilestones.actions.edit')}
                                                            >
                                                                <span className="material-symbols-outlined">edit</span>
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="project-milestones__icon-button project-milestones__icon-button--danger"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(milestone);
                                                                }}
                                                                aria-label={t('projectMilestones.actions.delete')}
                                                            >
                                                                <span className="material-symbols-outlined">delete</span>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="project-milestones__card-accent" data-status={milestone.status.toLowerCase()} data-risk={riskLevel.toLowerCase()} />
                                        </Card>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <MilestoneModal
                projectId={projectId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                milestone={editingMilestone}
            />

            <MilestoneDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setViewingMilestone(undefined);
                }}
                milestone={viewingMilestone}
                onEdit={(milestoneToEdit) => {
                    setEditingMilestone(milestoneToEdit);
                    setIsDetailModalOpen(false);
                    setTimeout(() => setIsModalOpen(true), 100);
                }}
                taskStatusLookup={taskStatusLookup}
                subtaskLookup={subtaskLookup}
                ideaLookup={ideaLookup}
            />
        </div>
    );
};
