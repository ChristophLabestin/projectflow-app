import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { usePinnedProject } from '../../../context/PinnedProjectContext';
import { useConfirm } from '../../../context/UIContext';
import { useProjectPermissions } from '../../../hooks/useProjectPermissions';
import { addTask, toggleTaskStatus, updateTaskFields } from '../../../services/domain/tasksService';
import { updateInitiative } from '../../../services/domain/initiativesService';
import { updateProjectFields, generateInviteLink, sendTeamInvitation } from '../../../services/domain/projectAdminService';
import { saveGeminiReport } from '../../../services/domain/projectInsightsService';
import { generateProjectReport } from '../../../services/geminiService';
import type { Project, ProjectRole, Task } from '../../../types';

import { useProjectOverviewData } from './hooks/useProjectOverviewData';
import { useProjectOverviewDerived } from './hooks/useProjectOverviewDerived';
import { useProjectOverviewViewState } from './hooks/useProjectOverviewViewState';
import { useProjectOverviewLabels } from './hooks/useProjectOverviewLabels';
import { useProjectMembers } from './hooks/useProjectMembers';
import { useCompanyContext } from './hooks/useCompanyContext';
import { useProjectLifecycle } from './hooks/useProjectLifecycle';
import { useWorkItems, type WorkItem } from './views/shared/useWorkItems';
import type { WorkViewContext } from './views/shared/viewTypes';
import { resolveEnabledTabs, resolveViewsForTab, type OverviewTab } from './config/overviewConfig';
import { ProjectHero } from './hero/ProjectHero';
import { ProjectCommandBar, type CommandOption } from './command/ProjectCommandBar';
import { WorkViews } from './views/WorkViews';
import { ActivityPanel } from './sections/SecondaryPanels';
import { SprintsView } from './sections/SprintsView';
import { MilestonesView } from './sections/MilestonesView';
import { InitiativesStrip } from './sections/InitiativesStrip';
import { CompanyOverviewSection } from './sections/CompanyOverviewSection';
import { ReferenceSection } from './sections/ReferenceSection';
import { isCompanyProject } from '../../../config/projectTemplates';
import type { Tab as ProjectEditTab } from '../ProjectEditModal';

import { HealthDetailModal } from '../HealthDetailModal';
import { ProjectReportModal } from '../ProjectReportModal';
import { ProjectEditModal } from '../ProjectEditModal';
import { InviteMemberModal } from '../../InviteMemberModal';
import { InitiativeCreateModal } from '../../InitiativeCreateModal';

import '../../../src/styles/components/_project-overview-v2.scss';

const TaskCreateModal = lazy(() => import('../../TaskCreateModal').then((m) => ({ default: m.TaskCreateModal })));

type ModalKind = 'task' | 'initiative' | 'invite' | 'report' | 'edit' | 'health' | null;

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

    // Focus mode: stretch the quick-add + board region to ~viewport height.
    const [workFocus, setWorkFocus] = useState(false);
    const workRef = useRef<HTMLDivElement>(null);
    const toggleWorkFocus = () => setWorkFocus((prev) => {
        const next = !prev;
        if (next) {
            requestAnimationFrame(() => workRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }
        return next;
    });

    const tenantQuery = project?.tenantId ? `?tenant=${project.tenantId}` : '';

    const enabledTabs = useMemo(() => resolveEnabledTabs(project), [project]);
    const activeTab: OverviewTab = useMemo(
        () => (enabledTabs.some((tab) => tab.id === viewState.tab) ? viewState.tab : 'work'),
        [enabledTabs, viewState.tab]
    );
    const availableViews = useMemo(() => resolveViewsForTab(activeTab), [activeTab]);

    const effectiveGroupBy = viewState.view === 'board' ? 'status' : viewState.groupBy;

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
        unassignedLabel: t('projectOverview.v2.command.unassigned', 'Unassigned')
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
                if (item.kind === 'task') void taskUpdate({ assigneeIds: groupKey === '__unassigned__' ? [] : [groupKey] });
                break;
            default:
                break;
        }
    };

    const handleSetInitiativeColor = (initiativeId: string, color: string | null) => {
        if (!project) return;
        void updateInitiative(initiativeId, { color: color || '' }, project.id, project.tenantId);
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
        onMoveItemToGroup: handleMoveToGroup
    };

    return (
        <div className={`po ${wide ? 'po--wide' : ''}`.trim()}>
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
                coverExpanded={coverExpanded}
                onToggleCoverExpand={toggleCoverExpand}
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

            {enabledTabs.length > 1 && (
                <div className="po-tabs" role="tablist" aria-label={t('projectOverview.workspace.tabsLabel', 'Workspace')}>
                    {enabledTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            className={`po-tabs__tab ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
                            onClick={() => viewState.setTab(tab.id)}
                        >
                            <span className="material-symbols-outlined">{tab.icon}</span>
                            <span>{t(tab.labelKey, tab.id)}</span>
                        </button>
                    ))}
                </div>
            )}

            {activeTab === 'work' && (
                <>
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
                            <WorkViews view={viewState.view} ctx={viewCtx} />
                        </div>
                    </div>
                    <ReferenceSection
                        project={project}
                        members={members}
                        tenantQuery={tenantQuery}
                        isOwner={isOwner}
                        onEditBrief={() => { setEditTab('briefing'); setModal('edit'); }}
                        onEditResources={() => { setEditTab('resources'); setModal('edit'); }}
                        onInvite={() => setModal('invite')}
                        t={t}
                    />
                </>
            )}

            {activeTab === 'milestones' && (
                <div className="po-workspace">
                    <MilestonesView milestones={milestones} tasks={tasks} dateFormat={dateFormat} dateLocale={dateLocale} t={t} />
                </div>
            )}

            {activeTab === 'sprints' && (
                <div className="po-workspace">
                    <SprintsView
                        sprints={sprints}
                        tasks={tasks}
                        members={members}
                        labels={labels}
                        projectId={project.id}
                        tenantQuery={tenantQuery}
                        dateFormat={dateFormat}
                        dateLocale={dateLocale}
                        t={t}
                    />
                </div>
            )}

            {activeTab === 'activity' && (
                <div className="po-workspace">
                    <ActivityPanel activity={activity} dateFormat={dateFormat} dateLocale={dateLocale} t={t} />
                </div>
            )}

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

            <InviteMemberModal
                isOpen={modal === 'invite'}
                onClose={() => setModal(null)}
                projectTitle={project.title}
                customRoles={workspaceRoles}
                onGenerateLink={(role, maxUses, expiresInHours) =>
                    generateInviteLink(project.id, role as ProjectRole | string, maxUses, expiresInHours, project.tenantId)}
                onSendEmail={(email, role) =>
                    sendTeamInvitation(email, 'project', project.id, role, project.tenantId || '')}
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
