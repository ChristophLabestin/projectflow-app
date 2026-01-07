import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useOutletContext, useParams } from 'react-router-dom';
import { Sprint, Task, Member } from '../types';
import {
    subscribeProjectSprints,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    addSprintMember,
    removeSprintMember,
    requestToJoinSprint,
    approveJoinRequest,
    rejectJoinRequest
} from '../services/sprintService';
import { subscribeProjectTasks, updateTaskFields, getActiveTenantId, getProjectById, getUsersByIds } from '../services/dataService';
import { auth } from '../services/firebase';
import { SprintBacklog } from '../components/sprints/SprintBacklog';
import { ActiveSprintBoard } from '../components/sprints/ActiveSprintBoard';
import { UpcomingSprintsList } from '../components/sprints/UpcomingSprintsList';
import { SprintDetailsModal } from '../components/sprints/SprintDetailsModal';
import { CreateSprintModal } from '../components/sprints/CreateSprintModal';
import { Button } from '../components/common/Button/Button';
import { Badge } from '../components/common/Badge/Badge';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/UIContext';

export const ProjectSprints: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (t: string | null) => void }>();
    const { t, dateFormat, dateLocale } = useLanguage();
    const { showError } = useToast();
    const currentUser = auth.currentUser;
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projectMembers, setProjectMembers] = useState<Member[]>([]);
    const [view, setView] = useState<'board' | 'backlog'>('board');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
    const [selectedSprintDetails, setSelectedSprintDetails] = useState<Sprint | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<'Owner' | 'Editor' | 'Viewer' | null>(null);
    const [pendingDeleteSprintId, setPendingDeleteSprintId] = useState<string | null>(null);
    const [pendingCompleteSprintId, setPendingCompleteSprintId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const tenantId = getActiveTenantId();

    const priorityLabels = useMemo(() => ({
        Low: t('tasks.priority.low'),
        Medium: t('tasks.priority.medium'),
        High: t('tasks.priority.high'),
        Urgent: t('tasks.priority.urgent')
    }), [t]);

    useEffect(() => {
        setTaskTitle(t('nav.sprints'));
        return () => setTaskTitle(null);
    }, [setTaskTitle, t]);

    useEffect(() => {
        if (!projectId) return;

        const fetchMembers = async () => {
            if (!tenantId) return;
            try {
                const project = await getProjectById(projectId, tenantId);

                if (project && currentUser) {
                    if (project.ownerId === currentUser.uid) {
                        setCurrentUserRole('Owner');
                    } else if (project.members && typeof project.members[0] !== 'string') {
                        const me = (project.members as any[]).find(m => m.userId === currentUser.uid || m.uid === currentUser.uid);
                        if (me) setCurrentUserRole(me.role);
                    }
                }

                let ids: string[] = [];
                if (project?.memberIds && project.memberIds.length > 0) {
                    ids = project.memberIds;
                } else if (project?.members) {
                    if (typeof project.members[0] === 'string') {
                        ids = project.members as unknown as string[];
                    } else {
                        ids = (project.members as any[]).map(m => m.uid || m.userId);
                    }
                }

                if (ids.length > 0) {
                    ids = [...new Set(ids)];
                    const users = await getUsersByIds(ids, tenantId);
                    setProjectMembers(users);
                }
            } catch (err) {
                console.error('Failed to fetch project members', err);
            }
        };
        fetchMembers();

        const unsubSprints = subscribeProjectSprints(projectId, (data) => {
            setSprints(data);
            if (selectedSprintDetails) {
                const updated = data.find(s => s.id === selectedSprintDetails.id);
                if (updated) setSelectedSprintDetails(updated);
            }
        }, tenantId);

        const unsubTasks = subscribeProjectTasks(projectId, (data) => {
            setTasks(data);
        }, tenantId);

        return () => {
            unsubSprints();
            unsubTasks();
        };
    }, [projectId, tenantId]);

    const activeSprint = sprints.find(s => s.status === 'Active');

    const handleCreateSprint = async (data: Partial<Sprint>) => {
        if (!projectId) return;
        try {
            if (editingSprint) {
                await updateSprint(projectId, editingSprint.id, data, tenantId);
            } else {
                await createSprint(projectId, { ...data, createdBy: currentUser?.uid }, tenantId);
            }
            setEditingSprint(null);
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error('handleCreateSprint: Error caught', error);
            showError(t('projectSprints.errors.save'), (error as any)?.message);
        }
    };

    const handleDeleteSprint = async (sprintId: string) => {
        if (!projectId) return;
        setIsDeleting(true);
        try {
            const sprintTasks = tasks.filter(t => t.sprintId === sprintId);
            for (const task of sprintTasks) {
                await updateTaskFields(task.id, { sprintId: null as any }, projectId, tenantId);
            }
            await deleteSprint(projectId, sprintId, tenantId);
            setSelectedSprintDetails(null);
        } catch (error) {
            console.error('Failed to delete sprint', error);
            showError(t('projectSprints.errors.delete'), (error as any)?.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCompleteSprint = async (sprintId: string) => {
        if (!projectId) return;
        setIsCompleting(true);
        try {
            await completeSprint(projectId, sprintId, tenantId);
            setView('backlog');
        } catch (error) {
            console.error('Failed to complete sprint', error);
            showError(t('projectSprints.errors.complete'), (error as any)?.message);
        } finally {
            setIsCompleting(false);
        }
    };

    const handleAddMember = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await addSprintMember(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error('Failed to add sprint member', e);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await removeSprintMember(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error('Failed to remove sprint member', e);
        }
    };

    const handleJoinRequest = async () => {
        if (!projectId || !selectedSprintDetails || !tenantId || !currentUser) return;
        try {
            await requestToJoinSprint(projectId, selectedSprintDetails.id, currentUser.uid, tenantId);
        } catch (e) {
            console.error('Failed to request to join', e);
        }
    };

    const handleApproveRequest = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await addSprintMember(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error('Failed to approve request', e);
        }
    };

    const handleRejectRequest = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await rejectJoinRequest(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error('Failed to reject request', e);
        }
    };

    const handleStartSprint = async (sprintId: string) => {
        if (!projectId) return;
        const sprint = sprints.find(s => s.id === sprintId);
        if (!sprint) return;
        try {
            await startSprint(projectId, sprintId, sprint.startDate, sprint.endDate, tenantId);
            setView('board');
        } catch (e: any) {
            showError(t('projectSprints.errors.start'), e?.message);
        }
    };

    const handleTaskDrop = async (taskId: string, sprintId: string | null) => {
        if (!projectId) return;
        await updateTaskFields(taskId, { sprintId: sprintId || undefined }, projectId, tenantId);
    };

    const requestDeleteSprint = (sprintId: string) => {
        setPendingDeleteSprintId(sprintId);
        setSelectedSprintDetails(null);
    };

    const requestCompleteSprint = (sprintId: string) => {
        setPendingCompleteSprintId(sprintId);
        setSelectedSprintDetails(null);
    };

    const renderTask = (task: Task) => {
        const priority = task.priority || 'Medium';
        const priorityLabel = priorityLabels[priority] || priority;
        const priorityVariant = priority === 'Urgent' ? 'error' : priority === 'High' ? 'warning' : 'neutral';
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;

        return (
            <div className={`sprint-task-card ${task.isCompleted ? 'is-complete' : ''}`}>
                <div className="sprint-task-card__title">{task.title}</div>
                <div className="sprint-task-card__meta">
                    <Badge variant={priorityVariant} className="sprint-task-card__badge">
                        {priorityLabel}
                    </Badge>
                    {dueDate && (
                        <span className="sprint-task-card__date">
                            {t('projectSprints.labels.due').replace('{date}', format(dueDate, dateFormat, { locale: dateLocale }))}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    const backlogTasks = tasks.filter(t => !t.sprintId && !t.isCompleted);
    const activeSprintTasks = activeSprint ? tasks.filter(t => t.sprintId === activeSprint.id) : [];

    const pendingDeleteSprint = pendingDeleteSprintId
        ? sprints.find(s => s.id === pendingDeleteSprintId)
        : null;

    const pendingCompleteSprint = pendingCompleteSprintId
        ? sprints.find(s => s.id === pendingCompleteSprintId)
        : null;

    return (
        <div className="project-sprints">
            <header className="project-sprints__header">
                <div className="project-sprints__toggle">
                    <button
                        type="button"
                        onClick={() => setView('board')}
                        className={`project-sprints__toggle-button ${view === 'board' ? 'is-active' : ''}`}
                    >
                        {t('projectSprints.view.board')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setView('backlog')}
                        className={`project-sprints__toggle-button ${view === 'backlog' ? 'is-active' : ''}`}
                    >
                        {t('projectSprints.view.backlog')}
                    </button>
                </div>

                <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                    <span className="material-symbols-outlined">add</span>
                    {t('projectSprints.actions.create')}
                </Button>
            </header>

            <div className="project-sprints__content">
                {view === 'board' ? (
                    activeSprint ? (
                        <ActiveSprintBoard
                            sprint={activeSprint}
                            tasks={activeSprintTasks}
                            upcomingSprints={sprints.filter(s => s.status === 'Planning')}
                            allTasks={tasks}
                            onCompleteSprint={() => requestCompleteSprint(activeSprint.id)}
                            onStartSprint={handleStartSprint}
                            onSprintClick={setSelectedSprintDetails}
                            renderTask={renderTask}
                        />
                    ) : (
                        <div className="project-sprints__empty">
                            <div className="project-sprints__empty-icon">
                                <span className="material-symbols-outlined">directions_run</span>
                            </div>
                            <h2 className="project-sprints__empty-title">{t('projectSprints.empty.active.title')}</h2>
                            <p className="project-sprints__empty-text">{t('projectSprints.empty.active.description')}</p>
                            <Button variant="primary" onClick={() => setView('backlog')}>
                                {t('projectSprints.empty.active.action')}
                            </Button>
                        </div>
                    )
                ) : (
                    <SprintBacklog
                        backlogTasks={backlogTasks}
                        sprints={sprints}
                        allTasks={tasks}
                        renderTask={renderTask}
                        onCreateSprint={() => { setEditingSprint(null); setIsCreateModalOpen(true); }}
                        onEditSprint={(s) => { setEditingSprint(s); setIsCreateModalOpen(true); }}
                        onDeleteSprint={requestDeleteSprint}
                        onStartSprint={handleStartSprint}
                        onTaskDrop={handleTaskDrop}
                    />
                )}
            </div>

            {view === 'board' && !activeSprint && (
                <UpcomingSprintsList
                    sprints={sprints.filter(s => s.status === 'Planning')}
                    allTasks={tasks}
                    onStartSprint={handleStartSprint}
                    onSprintClick={setSelectedSprintDetails}
                />
            )}

            <CreateSprintModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateSprint}
                initialData={editingSprint}
            />

            <SprintDetailsModal
                isOpen={!!selectedSprintDetails}
                onClose={() => setSelectedSprintDetails(null)}
                sprint={selectedSprintDetails}
                tasks={selectedSprintDetails ? tasks.filter(t => t.sprintId === selectedSprintDetails.id) : []}
                currentUserId={currentUser?.uid || ''}
                projectMembers={projectMembers}
                canManageTeam={['Owner', 'Editor'].includes(currentUserRole || '')}
                onEdit={(s) => {
                    setSelectedSprintDetails(null);
                    setEditingSprint(s);
                    setIsCreateModalOpen(true);
                }}
                onDelete={requestDeleteSprint}
                onStart={handleStartSprint}
                onComplete={(id) => requestCompleteSprint(id)}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
                onJoinRequest={handleJoinRequest}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
            />

            <ConfirmModal
                isOpen={!!pendingDeleteSprintId}
                onClose={() => setPendingDeleteSprintId(null)}
                onConfirm={async () => {
                    if (!pendingDeleteSprintId) return;
                    await handleDeleteSprint(pendingDeleteSprintId);
                    setPendingDeleteSprintId(null);
                }}
                title={t('projectSprints.confirm.delete.title')}
                message={t('projectSprints.confirm.delete.message').replace('{name}', pendingDeleteSprint?.name || t('projectSprints.labels.sprint'))}
                confirmLabel={t('projectSprints.confirm.delete.confirm')}
                cancelLabel={t('common.cancel')}
                variant="danger"
                isLoading={isDeleting}
            />

            <ConfirmModal
                isOpen={!!pendingCompleteSprintId}
                onClose={() => setPendingCompleteSprintId(null)}
                onConfirm={async () => {
                    if (!pendingCompleteSprintId) return;
                    await handleCompleteSprint(pendingCompleteSprintId);
                    setPendingCompleteSprintId(null);
                }}
                title={t('projectSprints.confirm.complete.title')}
                message={t('projectSprints.confirm.complete.message').replace('{name}', pendingCompleteSprint?.name || t('projectSprints.labels.sprint'))}
                confirmLabel={t('projectSprints.confirm.complete.confirm')}
                cancelLabel={t('common.cancel')}
                isLoading={isCompleting}
            />
        </div>
    );
};
