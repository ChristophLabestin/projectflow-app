import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { usePinnedProject } from '../../../context/PinnedProjectContext';
import { useConfirm } from '../../../context/UIContext';
import { useProjectPermissions } from '../../../hooks/useProjectPermissions';
import { addTask, toggleTaskStatus, updateTaskFields } from '../../../services/domain/tasksService';
import { updateInitiative } from '../../../services/domain/initiativesService';
import { updateProjectFields } from '../../../services/domain/projectAdminService';
import { saveGeminiReport } from '../../../services/domain/projectInsightsService';
import { generateProjectReport } from '../../../services/geminiService';
import type { Project, ProjectReminder, Task } from '../../../types';

import { useProjectOverviewData } from './hooks/useProjectOverviewData';
import { useProjectOverviewDerived } from './hooks/useProjectOverviewDerived';
import { useProjectOverviewViewState } from './hooks/useProjectOverviewViewState';
import { useProjectOverviewLabels } from './hooks/useProjectOverviewLabels';
import { useProjectMembers } from './hooks/useProjectMembers';
import { useCompanyContext } from './hooks/useCompanyContext';
import { useProjectLifecycle } from './hooks/useProjectLifecycle';
import { useWorkItems, type WorkItem } from './views/shared/useWorkItems';
import type { WorkViewContext } from './views/shared/viewTypes';
import { resolveViewsForTab, type OverviewWorkView } from './config/overviewConfig';
import { ProjectHero } from './hero/ProjectHero';
import { ProjectCommandBar, type CommandOption } from './command/ProjectCommandBar';
import { WorkViews } from './views/WorkViews';
import { ProjectContextDrawer } from './sections/ProjectContextDrawer';
import { InitiativesStrip } from './sections/InitiativesStrip';
import { CompanyOverviewSection } from './sections/CompanyOverviewSection';
import { ReferenceSection } from './sections/ReferenceSection';
import { ProjectRemindersPanel } from './sections/ProjectRemindersPanel';
import { isCompanyProject } from '../../../config/projectTemplates';
import type { Tab as ProjectEditTab } from '../ProjectEditModal';

import { HealthDetailModal } from '../HealthDetailModal';
import { ProjectReportModal } from '../ProjectReportModal';
import { ProjectEditModal } from '../ProjectEditModal';
import { InviteToWorkspaceModal } from '../../workspace/InviteToWorkspaceModal';
import { InitiativeCreateModal } from '../../InitiativeCreateModal';

import '../../../src/styles/components/_project-overview-v2.scss';
import { useWorkMembers } from '../../work/useWorkMembers';
import { RoadmapView } from '../../planning/RoadmapView';

const TaskCreateModal = lazy(() => import('../../TaskCreateModal').then((m) => ({ default: m.TaskCreateModal })));

type ModalKind = 'task' | 'initiative' | 'invite' | 'report' | 'edit' | 'health' | 'context' | null;

export const ProjectOverviewPage: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { t, dateFormat, dateLocale, loadProjectOverviewTranslations } = useLanguage();
    const { pinnedProjectId, pinProject, unpinProject } = usePinnedProject();

    useEffect(() => {
        void loadProjectOverviewTranslations();
    }, [loadProjectOverviewTranslations]);

    const data = useProjectOverviewData(projectId, t);
    const { project, tasks, initiatives, milestones, sprints, activity, issues, ideas, workspaceRoles, health } = data;

    const members = useProjectMembers(project);
    const { companyContextProject, linkedCompanyProjects } = useCompanyContext(project);
    const labels = useProjectOverviewLabels(t, members);
    const derived = useProjectOverviewDerived(tasks, initiatives, milestones);
    const viewState = useProjectOverviewViewState();
    const { can, isOwner } = useProjectPermissions(project);
    const canManageTasks = can('canManageTasks');
    const lifecycle = useProjectLifecycle(project, data.setProject, confirm, t);

    const [modal, setModal] = useState<ModalKind>(null);
    const [editTab, setEditTab] = useState<ProjectEditTab>('general');
    const [report, setReport] = useState<string | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    // Full-width "stretch" is owned by AppLayout (so it can also collapse the
    // sidebar) and shared through the router outlet context.
    const outlet = useOutletContext<{ contentWide?: boolean; setContentWide?: (next: boolean) => void }>() || {};
    const wide = Boolean(outlet.contentWide);
    const toggleWide = () => outlet.setContentWide?.(!wide);

    // Cover-enlarge toggle is persisted per project (each project remembers its own cover size).
    const coverKey = project ? `projectflow.projectOverview.coverExpanded.${project.id}` : '';
    const [coverExpanded, setCoverExpanded] = useState(false);
    useEffect(() => {
        if (!coverKey) { setCoverExpanded(false); return; }
        try { setCoverExpanded(window.localStorage.getItem(coverKey) === '1'); } catch { setCoverExpanded(false); }
    }, [coverKey]);
    const toggleCoverExpand = () => setCoverExpanded((prev) => {
        const next = !prev;
        try { if (coverKey) window.localStorage.setItem(coverKey, next ? '1' : '0'); } catch { /* ignore */ }
        return next;
    });

    // Board focus: the task board takes over the page. The sidebar collapses,
    // project chrome (hero, tabs, initiatives, references) hides, and the
    // previous sidebar width and view are restored on exit (button, Esc, or
    // leaving the page).
    const [workFocus, setWorkFocus] = useState(false);
    const workRef = useRef<HTMLDivElement>(null);
    const focusRestoreRef = useRef<{ wide: boolean; view: OverviewWorkView } | null>(null);
    const enterWorkFocus = () => {
        focusRestoreRef.current = { wide, view: viewState.view };
        outlet.setContentWide?.(true);
        viewState.setTab('work');
        // Focus keeps spatial views (board, team, timeline, calendar); the
        // plain list switches to the board.
        if (viewState.view === 'list' || viewState.view === 'relationships') viewState.setView('board');
        setWorkFocus(true);
        requestAnimationFrame(() => workRef.current?.scrollIntoView({ block: 'start' }));
    };
    const exitWorkFocus = useCallback(() => {
        const restore = focusRestoreRef.current;
        focusRestoreRef.current = null;
        setWorkFocus(false);
        if (restore) {
            outlet.setContentWide?.(restore.wide);
            viewState.setView(restore.view);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outlet.setContentWide, viewState.setView]);
    const toggleWorkFocus = () => (workFocus ? exitWorkFocus() : enterWorkFocus());

    useEffect(() => {
        if (!workFocus) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (document.querySelector('[role="dialog"], .inline-menu')) return;
            exitWorkFocus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [workFocus, exitWorkFocus]);

    // Leaving the page while focused restores the sidebar.
    const exitRef = useRef(exitWorkFocus);
    exitRef.current = exitWorkFocus;
    useEffect(() => () => {
        if (focusRestoreRef.current) exitRef.current();
    }, []);

    const tenantQuery = project?.tenantId ? `?tenant=${project.tenantId}` : '';

    const availableViews = useMemo(() => resolveViewsForTab('work'), []);

    const effectiveGroupBy = viewState.view === 'board' ? 'status' : viewState.groupBy;
    const workMembers = useWorkMembers(project?.tenantId);
    const dueLabels = useMemo(() => ({
        overdue: t('work.group.due.overdue'),
        today: t('work.group.due.today'),
        week: t('work.group.due.week'),
        later: t('work.group.due.later'),
        none: t('work.group.due.none'),
        done: t('work.group.done')
    }), [t]);

    // Initiatives are containers of tasks, not flat work items — keep the work
    // stream task-only and surface initiatives via the strip + group-by-initiative.
    const workItems = useWorkItems({
        tasks,
        initiatives,
        includeInitiatives: false,
        filters: viewState.filters,
        sortBy: viewState.sortBy,
        groupBy: effectiveGroupBy,
        statusLabels: labels.statusLabels,
        priorityLabels: labels.priorityLabels,
        assigneeLabels: labels.assigneeLabels,
        noneLabel: t('projectOverview.v2.group.none', 'Ungrouped'),
        unassignedLabel: t('projectOverview.v2.command.unassigned', 'Unassigned'),
        dueLabels
    });

    const statusOptions: CommandOption[] = useMemo(
        () => ['Backlog', 'Open', 'In Progress', 'Review', 'On Hold', 'Blocked', 'Done']
            .map((value) => ({ value, label: labels.statusLabels[value] || value })),
        [labels]
    );
    const priorityOptions: CommandOption[] = useMemo(
        () => ['Urgent', 'High', 'Medium', 'Low'].map((value) => ({ value, label: labels.priorityLabels[value] || value })),
        [labels]
    );
    const assigneeOptions: CommandOption[] = useMemo(
        () => members.map((member) => ({ value: member.id, label: member.displayName })),
        [members]
    );
    const initiativeOptions: CommandOption[] = useMemo(
        () => initiatives.map((initiative) => ({ value: initiative.id, label: initiative.title })),
        [initiatives]
    );
    const initiativeColors = useMemo(() => {
        const map: Record<string, string> = {};
        for (const initiative of initiatives) {
            if (initiative.color) map[initiative.id] = initiative.color;
        }
        return map;
    }, [initiatives]);

    const navigateToItem = (item: WorkItem) => {
        if (!project) return;
        const base = `/project/${project.id}`;
        if (item.kind === 'task') {
            navigate(`${base}/tasks/${item.id}${tenantQuery}`);
        } else {
            navigate(`${base}/initiatives/${item.id}${tenantQuery}`);
        }
    };

    const handleQuickAdd = async (title: string) => {
        if (!project) return;
        await addTask(project.id, title, undefined, undefined, 'Medium', {
            status: 'Open',
            initiativeId: viewState.filters.initiativeId || undefined
        }, project.tenantId);
    };

    const handleToggleComplete = (task: Task) => {
        if (!project) return;
        void toggleTaskStatus(task.id, task.isCompleted, project.id, project.tenantId);
    };

    const handleUpdateStatus = (item: WorkItem, status: string) => {
        if (!project) return;
        if (item.kind === 'task') {
            void updateTaskFields(item.id, {
                status: status as Task['status'],
                isCompleted: status === 'Done'
            }, project.id, project.tenantId);
        } else {
            void updateInitiative(item.id, { status: status as any }, project.id, project.tenantId);
        }
    };

    const handleUpdateDates = (item: WorkItem, dates: { startDate?: string; dueDate?: string }) => {
        if (!project) return;
        if (item.kind === 'task') {
            void updateTaskFields(item.id, dates, project.id, project.tenantId);
        } else {
            void updateInitiative(item.id, dates, project.id, project.tenantId);
        }
    };

    const handleMoveToGroup = (item: WorkItem, groupBy: string, groupKey: string) => {
        if (!project) return;
        const taskUpdate = (updates: Partial<Task>) => updateTaskFields(item.id, updates, project.id, project.tenantId);
        switch (groupBy) {
            case 'status':
                handleUpdateStatus(item, groupKey);
                break;
            case 'priority':
                if (groupKey !== '__none__') {
                    if (item.kind === 'task') void taskUpdate({ priority: groupKey as Task['priority'] });
                    else void updateInitiative(item.id, { priority: groupKey as any }, project.id, project.tenantId);
                }
                break;
            case 'initiative':
                if (item.kind === 'task') void taskUpdate({ initiativeId: groupKey === '__standalone__' ? '' : groupKey });
                break;
            case 'assignee':
                if (item.kind === 'task') void taskUpdate(groupKey === '__unassigned__' ? { assigneeId: '', assigneeIds: [] } : { assigneeId: groupKey, assigneeIds: [groupKey] });
                break;
            default:
                break;
        }
    };

    const handleSetInitiativeColor = (initiativeId: string, color: string | null) => {
        if (!project) return;
        void updateInitiative(initiativeId, { color: color || '' }, project.id, project.tenantId);
    };

    const handleSaveProjectReminders = async (reminders: ProjectReminder[]) => {
        if (!project) return;
        await updateProjectFields(
            project.id,
            { reminders },
            { action: 'Updated project reminders', target: 'Project', type: 'status' },
            project.tenantId
        );
        data.setProject((prev) => (prev ? { ...prev, reminders } : prev));
    };

    const handleSaveTaskReminders = async (task: Task, reminders: ProjectReminder[], reminderAt?: string | null) => {
        if (!project) return;
        const updates: Partial<Task> = { reminders };
        if (reminderAt !== undefined) {
            updates.reminderAt = reminderAt || '';
        }
        await updateTaskFields(task.id, updates, project.id, project.tenantId);
    };

    const toggleInitiativeFilter = (initiativeId: string) => {
        viewState.setFilters((prev) => ({
            ...prev,
            initiativeId: prev.initiativeId === initiativeId ? null : initiativeId
        }));
    };

    const handleGenerateReport = async () => {
        if (!project) return;
        setReportLoading(true);
        try {
            const result = await generateProjectReport(project, tasks, milestones, issues, ideas, activity, members);
            setReport(result);
            void saveGeminiReport(project.id, result, project.tenantId).catch(() => undefined);
        } catch {
            setReport(t('projectOverview.error.load', 'Could not generate the report.'));
        } finally {
            setReportLoading(false);
        }
    };

    const handleSaveEdit = async (fields: Partial<Project>) => {
        if (!project) return;
        await updateProjectFields(project.id, fields, undefined, project.tenantId);
        data.setProject((prev) => (prev ? { ...prev, ...fields } : prev));
    };

    const togglePin = () => {
        if (!project) return;
        if (pinnedProjectId === project.id) {
            void unpinProject();
        } else {
            void pinProject(project.id);
        }
    };

    if (data.loading) {
        return (
            <div className="po-state">
                <span className="po-state__spinner" aria-hidden="true" />
                <p>{t('projectOverview.loading', 'Loading project…')}</p>
            </div>
        );
    }

    if (data.unauthorized) {
        return (
            <div className="po-state">
                <span className="material-symbols-outlined po-state__icon">lock</span>
                <p>{t('projectOverview.error.unauthorized', 'You do not have access to this project.')}</p>
            </div>
        );
    }

    if (data.error || !project) {
        return (
            <div className="po-state">
                <span className="material-symbols-outlined po-state__icon">error</span>
                <p>{data.error || t('projectOverview.error.notFound', 'Project not found.')}</p>
            </div>
        );
    }

    const isPaused = project.status === 'On Hold';
    const isCanceled = project.status === 'Canceled';

    const viewCtx: WorkViewContext = {
        items: workItems.items,
        groups: workItems.groups,
        groupBy: effectiveGroupBy,
        labels,
        milestones,
        initiatives,
        initiativeColors,
        dateFormat,
        dateLocale,
        canManageTasks,
        t,
        onItemClick: navigateToItem,
        onToggleComplete: handleToggleComplete,
        onUpdateItemStatus: handleUpdateStatus,
        onUpdateItemDates: handleUpdateDates,
        onMoveItemToGroup: handleMoveToGroup,
        members: workMembers,
        onUpdateTask: (task, updates) => {
            if (!project) return;
            void updateTaskFields(task.id, updates, project.id, project.tenantId);
        }
    };

    return (
        <div className={`po ${wide ? 'po--wide' : ''} ${workFocus ? 'po--board-focus' : ''}`.trim()}>
            {!workFocus && (
                <>
                <ProjectHero
                    project={project}
                    health={health}
                    derived={derived}
                    tenantQuery={tenantQuery}
                    companyContextProject={companyContextProject}
                    linkedCompanyCount={linkedCompanyProjects.length}
                    canManageTasks={canManageTasks}
                    isOwner={isOwner}
                    isPinned={pinnedProjectId === project.id}
                    onNewTask={() => setModal('task')}
                    onTogglePin={togglePin}
                    onEdit={() => { setEditTab('general'); setModal('edit'); }}
                    onInvite={() => setModal('invite')}
                    onReport={() => { setModal('report'); if (!report) void handleGenerateReport(); }}
                    onOpenHealth={() => setModal('health')}
                    onPause={() => void lifecycle.pause()}
                    onResume={() => void lifecycle.resume()}
                    onCancel={() => void lifecycle.cancel()}
                    onComplete={() => void lifecycle.complete()}
                    isWide={wide}
                    onToggleWide={toggleWide}
                    members={members}
                    onOpenContext={() => setModal('context')}
                    coverExpanded={coverExpanded}
                    onToggleCoverExpand={toggleCoverExpand}
                    reminders={(
                        <ProjectRemindersPanel
                            project={project}
                            tasks={tasks}
                            initiatives={initiatives}
                            canManage={canManageTasks}
                            dateFormat={dateFormat}
                            dateLocale={dateLocale}
                            onSaveProjectReminders={handleSaveProjectReminders}
                            onSaveTaskReminders={handleSaveTaskReminders}
                            onOpenTask={(nextTaskId) => navigate(`/project/${project.id}/tasks/${nextTaskId}${tenantQuery}`)}
                            onOpenInitiative={(initiativeId) => navigate(`/project/${project.id}/initiatives/${initiativeId}${tenantQuery}`)}
                            t={t}
                        />
                    )}
                    onOpenNext={() => {
                        const next = derived.nextItem;
                        if (!next) return;
                        if (next.entity === 'task') navigate(`/project/${project.id}/tasks/${next.id}${tenantQuery}`);
                        else if (next.entity === 'initiative') navigate(`/project/${project.id}/initiatives/${next.id}${tenantQuery}`);
                        else navigate(`/project/${project.id}/milestones${tenantQuery}`);
                    }}
                    t={t}
                />

                {(isPaused || isCanceled) && (
                    <div className={`po-banner po-banner--${isCanceled ? 'canceled' : 'paused'}`}>
                        <span className="material-symbols-outlined">{isCanceled ? 'cancel' : 'pause_circle'}</span>
                        <span>{isCanceled
                            ? t('projectOverview.v2.banner.canceled', 'This project is canceled.')
                            : t('projectOverview.v2.banner.paused', 'This project is paused.')}</span>
                        {isPaused && isOwner && (
                            <button type="button" className="po-banner__action" onClick={() => void lifecycle.resume()} disabled={lifecycle.busy}>
                                {t('projectOverview.v2.lifecycle.resume', 'Resume project')}
                            </button>
                        )}
                    </div>
                )}

                {isCompanyProject(project) && (
                    <CompanyOverviewSection
                        project={project}
                        tasks={tasks}
                        milestones={milestones}
                        initiatives={initiatives}
                        linkedCompanyProjects={linkedCompanyProjects}
                        dateFormat={dateFormat}
                        dateLocale={dateLocale}
                        statusLabels={labels.statusLabels}
                        priorityLabels={labels.priorityLabels}
                        onEditBrief={() => { setEditTab('briefing'); setModal('edit'); }}
                        t={t}
                    />
                )}

                </>
            )}

            {!workFocus && (
                <InitiativesStrip
                    initiatives={initiatives}
                    tasks={tasks}
                    activeInitiativeId={viewState.filters.initiativeId}
                    canManage={canManageTasks}
                    statusLabels={labels.statusLabels}
                    onSelect={toggleInitiativeFilter}
                    onOpenInitiative={(id) => navigate(`/project/${project.id}/initiatives/${id}${tenantQuery}`)}
                    onSetColor={handleSetInitiativeColor}
                    onCreate={() => setModal('initiative')}
                    t={t}
                />
            )}
            <div className={`po-work ${workFocus ? 'is-focus' : ''}`.trim()} ref={workRef}>
                <ProjectCommandBar
                    viewState={viewState}
                    availableViews={availableViews}
                    statusOptions={statusOptions}
                    priorityOptions={priorityOptions}
                    assigneeOptions={assigneeOptions}
                    initiativeOptions={initiativeOptions}
                    showQuickAdd={canManageTasks}
                    showViewControls
                    workFocus={workFocus}
                    onToggleWorkFocus={toggleWorkFocus}
                    onQuickAdd={handleQuickAdd}
                    t={t}
                />
                <div className="po-workspace">
                    {viewState.view === 'roadmap' ? (
                        <RoadmapView
                            project={project}
                            initiatives={initiatives}
                            tasks={tasks}
                            milestones={milestones}
                            canManage={canManageTasks}
                            onOpenInitiative={(initiativeId) => navigate(`/project/${project.id}/initiatives/${initiativeId}${tenantQuery}`)}
                        />
                    ) : (
                        <WorkViews view={viewState.view} ctx={viewCtx} />
                    )}
                </div>
            </div>

            <ProjectContextDrawer
                isOpen={modal === 'context'}
                onClose={() => setModal(null)}
                title={project.title}
                t={t}
            >
                <ReferenceSection
                    project={project}
                    members={members}
                    isOwner={isOwner}
                    onEditBrief={() => { setEditTab('briefing'); setModal('edit'); }}
                    onEditResources={() => { setEditTab('resources'); setModal('edit'); }}
                    onInvite={() => setModal('invite')}
                    t={t}
                />
            </ProjectContextDrawer>

            {modal === 'task' && (
                <Suspense fallback={null}>
                    <TaskCreateModal
                        projectId={project.id}
                        tenantId={project.tenantId}
                        onClose={() => setModal(null)}
                        initialTaskFields={{ initiativeId: viewState.filters.initiativeId || undefined }}
                    />
                </Suspense>
            )}

            <InitiativeCreateModal
                isOpen={modal === 'initiative'}
                projectId={project.id}
                tenantId={project.tenantId}
                onClose={() => setModal(null)}
            />

            <InviteToWorkspaceModal
                isOpen={modal === 'invite'}
                onClose={() => setModal(null)}
                projects={[project]}
                initialProjectIds={[project.id]}
                initialRole="Guest"
            />

            <ProjectReportModal
                isOpen={modal === 'report'}
                onClose={() => setModal(null)}
                report={report}
                isLoading={reportLoading}
                onGenerate={() => void handleGenerateReport()}
            />

            {modal === 'edit' && (
                <ProjectEditModal
                    isOpen
                    onClose={() => setModal(null)}
                    project={project}
                    onSave={handleSaveEdit}
                    initialTab={editTab}
                />
            )}

            {modal === 'health' && health && (
                <HealthDetailModal
                    isOpen
                    onClose={() => setModal(null)}
                    health={health}
                    tasks={tasks}
                    milestones={milestones}
                    issues={issues}
                    projectTitle={project.title}
                />
            )}
        </div>
    );
};
