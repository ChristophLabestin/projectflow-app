import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { usePinnedProject } from '../context/PinnedProjectContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { getProjectById, toggleTaskStatus, updateProjectFields, addActivityEntry, deleteProjectById, subscribeProjectTasks, subscribeProjectActivity, subscribeProjectIdeas, subscribeProjectIssues, getActiveTenantId, getLatestGeminiReport, saveGeminiReport, getProjectMembers, getSubTasks, sendTeamInvitation, generateInviteLink } from '../services/dataService';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { generateProjectReport, getGeminiInsight } from '../services/geminiService';
import { subscribeProjectSprints } from '../services/sprintService';
import { Activity, Idea, Project, Task, Issue, ProjectRole, GeminiReport, Milestone, ProjectGroup, Sprint, CustomRole } from '../types';
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';
import { toMillis, timeAgo } from '../utils/time';
import { auth, storage } from '../services/firebase';
import { getDownloadURL, ref, uploadBytes, listAll } from 'firebase/storage';
import { format, addDays, startOfToday, endOfToday, isWithinInterval, parseISO } from 'date-fns';
import { getRoleDisplayInfo, getWorkspaceRoles } from '../services/rolesService';
import { useLanguage } from '../context/LanguageContext';
import confetti from 'canvas-confetti';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/common/Card/Card';
import { Badge } from '../components/common/Badge/Badge';
import { Modal } from '../components/common/Modal/Modal';
import { Select, type SelectOption } from '../components/common/Select/Select';
import { DatePicker } from '../components/common/DateTime/DatePicker';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
// import { Checkbox } from '../components/ui/Checkbox'; // Removed
import { fetchLastCommits, GithubCommit } from '../services/githubService';
import { getUserProfile, subscribeProjectMilestones, updateMilestone, saveHealthSnapshot, getHealthDelta } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { calculateProjectHealth } from '../services/healthService';
import { HealthIndicator } from '../components/project/HealthIndicator';
import { HealthDetailModal } from '../components/project/HealthDetailModal';
import { getHealthFactorText } from '../utils/healthLocalization';
import { ProjectEditModal, Tab } from '../components/project/ProjectEditModal';
import { ProjectReportModal } from '../components/project/ProjectReportModal';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { ProjectMindmap } from '../components/mindmap/ProjectMindmap';

const buildTone = (colorVar: string, rgbVar: string, alpha = 0.12) => ({
    color: `var(${colorVar})`,
    bg: `rgba(var(${rgbVar}), ${alpha})`
});

const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    const successTone = buildTone('--color-success', '--color-success-rgb');
    const warningTone = buildTone('--color-warning', '--color-warning-rgb');
    const errorTone = buildTone('--color-error', '--color-error-rgb');
    const primaryTone = buildTone('--color-primary', '--color-primary-rgb');
    const neutralTone = buildTone('--color-text-muted', '--color-surface-hover-rgb', 0.6);

    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', ...errorTone };
        if (action.includes('reopened')) return { icon: 'undo', ...warningTone };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', ...successTone };
        return { icon: 'add_task', ...primaryTone };
    }
    if (type === 'issue') {
        if (action.includes('resolved') || action.includes('closed')) return { icon: 'check_circle', ...successTone };
        if (action.includes('reopened')) return { icon: 'undo', ...warningTone };
        return { icon: 'bug_report', ...errorTone };
    }
    if (type === 'status') return { icon: 'swap_horiz', ...primaryTone };
    if (type === 'report') return { icon: 'auto_awesome', ...primaryTone };
    if (type === 'comment') return { icon: 'chat_bubble', ...warningTone };
    if (type === 'file') return { icon: 'attach_file', ...neutralTone };
    if (type === 'member') return { icon: 'person_add', ...successTone };
    if (type === 'commit') return { icon: 'code', ...primaryTone };
    if (type === 'priority') return { icon: 'priority_high', ...errorTone };
    return { icon: 'more_horiz', ...neutralTone };
};

const getTypeBadgeClass = (type?: string) => {
    const key = (type || '').toLowerCase();
    if (key === 'feature') return 'type-badge--feature';
    if (key === 'product') return 'type-badge--product';
    if (key === 'marketing') return 'type-badge--marketing';
    if (key === 'social') return 'type-badge--social';
    if (key === 'moonshot') return 'type-badge--moonshot';
    if (key === 'optimization') return 'type-badge--optimization';
    if (key === 'paidads') return 'type-badge--paid-ads';
    return 'type-badge--default';
};

import { usePresence, useProjectPresence } from '../hooks/usePresence';

export const ProjectOverview = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { statusPreference } = useOutletContext<{ statusPreference: 'online' | 'busy' | 'idle' | 'offline' }>();
    const { pinProject, unpinProject, pinnedProjectId } = usePinnedProject();
    const { pinItem, unpinItem, isPinned } = usePinnedTasks();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
    const [subtaskStats, setSubtaskStats] = useState<Record<string, { done: number; total: number }>>({});
    const [loading, setLoading] = useState(true);
    const { dateFormat, dateLocale, t } = useLanguage();
    const [insight, setInsight] = useState<string | null>(null);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [workspaceRoles, setWorkspaceRoles] = useState<CustomRole[]>([]);
    const [teamMemberProfiles, setTeamMemberProfiles] = useState<Array<{ id: string; displayName: string; photoURL?: string; role: string }>>([]);
    const [error, setError] = useState<string | null>(null);
    const [unauthorized, setUnauthorized] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [pinnedReport, setPinnedReport] = useState<GeminiReport | null>(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showInsight, setShowInsight] = useState<boolean>(true);
    const [reportExpanded, setReportExpanded] = useState(false);

    // Modals
    const [showEditModal, setShowEditModal] = useState(false);
    const [editModalTab, setEditModalTab] = useState<Tab>('general');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showHealthModal, setShowHealthModal] = useState(false);

    // Permission system
    const { can, isOwner } = useProjectPermissions(project);

    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);
    const [mediaPickerTarget, setMediaPickerTarget] = useState<'cover' | 'icon' | 'gallery'>('gallery');
    const [projectAssets, setProjectAssets] = useState<string[]>([]);
    const [loadingAssets, setLoadingAssets] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Legacy File states (kept for now just in case, but unused for main flow)
    // Removed duplicate state declarations

    const [coverRemoved, setCoverRemoved] = useState(false);
    const [iconRemoved, setIconRemoved] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [connectingGithub, setConnectingGithub] = useState(false);
    const [githubCommits, setGithubCommits] = useState<GithubCommit[]>([]);
    const [commitsLoading, setCommitsLoading] = useState(false);
    const [commitsError, setCommitsError] = useState<string | null>(null);
    const [healthDelta, setHealthDelta] = useState<number | null>(null);



    // GitHub Integration State (Legacy - kept for Activity logs if needed, but unused for Display)
    // Removed unused state variables



    // Enhanced Presence Hook - tracks online/idle/offline states with activity detection
    usePresence({
        projectId: id || '',
        tenantId: project?.tenantId,
        enabled: !!id && !!project,
        heartbeatInterval: 30000, // 30 seconds
        idleTimeout: 600000, // 10 minutes of inactivity
        manualStatus: statusPreference
    });

    // Subscribe to other users' presence
    const activeProjectUsers = useProjectPresence(id || '', project?.tenantId);

    // View Mode State
    const [viewMode, setViewMode] = useState<'overview' | 'mindmap'>('overview');

    const fetchProjectAssets = async () => {
        if (!id || !project?.tenantId) return;
        setLoadingAssets(true);
        try {
            // 1. Check Root Folder (Legacy/Uncategorized with project ID in name)
            const rootRef = ref(storage, `tenants/${project.tenantId}/projects`);
            let rootUrls: string[] = [];
            try {
                const rootResult = await listAll(rootRef);
                // Filter for files that belong to this project ID
                // Name format: {timestamp}_media_{projectId}_{filename}
                rootUrls = await Promise.all(
                    rootResult.items
                        .filter(i => i.name.includes(`_media_${id}`))
                        .map(i => getDownloadURL(i))
                );
            } catch (e) {
                console.log("No root assets found or error", e);
            }

            // 2. Check Project Subfolder
            const folderRef = ref(storage, `tenants/${project.tenantId}/projects/${id}`);
            let folderUrls: string[] = [];
            try {
                const result = await listAll(folderRef);
                folderUrls = await Promise.all(
                    result.items
                        .filter(i => i.name.includes('_media_'))
                        .map(i => getDownloadURL(i))
                );
            } catch (e) {
                // Folder might not exist
            }

            // Combine and unique
            const allUrls = Array.from(new Set([...rootUrls, ...folderUrls]));
            setProjectAssets(allUrls);
        } catch (e) {
            console.error("Failed to fetch assets", e);
        } finally {
            setLoadingAssets(false);
        }
    };

    useEffect(() => {
        if (project?.id) {
            fetchProjectAssets();
        }
    }, [project?.id]);

    useEffect(() => {
        const fetchData = async () => {
            setError(null);
            try {
                const projData = await getProjectById(id);
                if (!projData) {
                    setError(t('projectOverview.error.notFound'));
                    setProject(null);
                    setLoading(false);
                    return;
                }
                setProject(projData);
                // Initialize
                if (project) {
                    // These would be handled inside the ProjectEditModal now
                }


                // Fetch User's Repositories & Token if they have a linked account
                if (auth.currentUser) {
                    // Check Unauthorized Access
                    // 1. Check if user is in the tenant
                    const tenantProfile = await getUserProfile(auth.currentUser.uid, projData.tenantId);

                    // 2. Check if user is a member of the project (Support both new ProjectMember and legacy string format)
                    const projectMembers = projData.members || [];
                    const isProjectMember = projectMembers.some(m =>
                        (typeof m === 'string' ? m : m.userId) === auth.currentUser?.uid
                    ) || projData.ownerId === auth.currentUser?.uid;

                    // If not in tenant AND not invited to project -> Unauthorized
                    if (!tenantProfile && !isProjectMember) {
                        setUnauthorized(true);
                        setLoading(false);
                        return;
                    }

                    // Private Project Security Check: Strictly members only
                    if (projData.isPrivate && !isProjectMember) {
                        setUnauthorized(true);
                        setLoading(false);
                        return;
                    }

                    const userProfile = tenantProfile || await getUserProfile(auth.currentUser.uid); // Fallback to default if cross-tenant?

                    // GitHub fetching removed
                }

                const ai = await getGeminiInsight();
                setInsight(ai);

                // Fetch latest pinned report
                const latest = await getLatestGeminiReport(id);
                setPinnedReport(latest);

                // Subscribe to real-time data using the correct tenant
                const unsubTasks = subscribeProjectTasks(id, setTasks, projData.tenantId);
                const unsubGroups = subscribeProjectGroups(id, setProjectGroups, projData.tenantId);
                const unsubActivity = subscribeProjectActivity(id, setActivity, projData.tenantId);
                const unsubIdeas = subscribeProjectIdeas(id, setIdeas, projData.tenantId);
                const unsubIssues = subscribeProjectIssues(id, setIssues, projData.tenantId);
                const unsubMilestones = subscribeProjectMilestones(id, setMilestones, projData.tenantId);
                const unsubSprints = subscribeProjectSprints(id, setSprints, projData.tenantId);

                // Fetch workspace roles
                getWorkspaceRoles(projData.tenantId).then(setWorkspaceRoles);

                return () => {
                    unsubTasks();
                    unsubGroups();
                    unsubActivity();
                    unsubIdeas();
                    unsubIssues();
                    unsubMilestones();
                    unsubSprints();
                };
            } catch (error) {
                console.error(error);
                setError(t('projectOverview.error.load'));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    useEffect(() => {
        const loadSubtaskStats = async () => {
            if (!tasks.length) {
                setSubtaskStats({});
                return;
            }
            try {
                const entries = await Promise.all(tasks.map(async (task) => {
                    const subs = await getSubTasks(task.id, project?.id, project?.tenantId);
                    const done = subs.filter(s => s.isCompleted).length;
                    return [task.id, { done, total: subs.length }] as const;
                }));
                setSubtaskStats(Object.fromEntries(entries));
            } catch (err) {
                console.warn('Failed to load subtask stats', err);
            }
        };

        void loadSubtaskStats();
    }, [tasks, project?.id, project?.tenantId]);

    // Health tracking: Save snapshot daily and load delta
    useEffect(() => {
        if (!id || !project?.tenantId || !tasks.length) return;

        const health = calculateProjectHealth(project, tasks, milestones, issues, activity);

        // Save daily health snapshot (uses date as doc ID so won't duplicate)
        saveHealthSnapshot(id, health.score, health.status, health.trend, project.tenantId)
            .catch(err => console.warn('Failed to save health snapshot:', err));

        // Load delta vs last week
        getHealthDelta(id, health.score, project.tenantId)
            .then(delta => setHealthDelta(delta))
            .catch(err => console.warn('Failed to get health delta:', err));
    }, [id, project, tasks, milestones, issues, activity]);

    useEffect(() => {
        let mounted = true;

        const loadCommits = async () => {
            if (!project?.modules?.includes('issues')) {
                setGithubCommits([]);
                setCommitsError(null);
                setCommitsLoading(false);
                return;
            }
            if (!project.githubRepo) {
                setGithubCommits([]);
                setCommitsError(null);
                setCommitsLoading(false);
                return;
            }

            setCommitsLoading(true);
            setCommitsError(null);

            try {
                const user = auth.currentUser;
                let token = project.githubToken;
                if (!token && user?.uid) {
                    const profile = await getUserProfile(user.uid, project.tenantId);
                    token = profile?.githubToken;
                }

                const commits = await fetchLastCommits(project.githubRepo, token);
                if (mounted) {
                    setGithubCommits(commits);
                }
            } catch (err) {
                console.error("Failed to fetch GitHub commits", err);
                if (mounted) {
                    setGithubCommits([]);
                    setCommitsError(t('projectOverview.github.loadError'));
                }
            } finally {
                if (mounted) {
                    setCommitsLoading(false);
                }
            }
        };

        loadCommits();

        return () => {
            mounted = false;
        };
    }, [project?.githubRepo, project?.githubToken, project?.tenantId, project?.modules]);

    // Fetch team member profiles
    useEffect(() => {
        const fetchTeamMembers = async () => {
            if (!project?.id || !project?.tenantId) return;

            try {
                const memberIds = await getProjectMembers(project.id, project.tenantId);
                const profilePromises = memberIds.map(async (memberId) => {
                    const profile = await getUserProfile(memberId, project.tenantId);
                    // Find the role from project.members
                    const memberEntry = (project.members || []).find(m =>
                        (typeof m === 'string' ? m : m.userId) === memberId
                    );
                    const role = typeof memberEntry === 'object' && memberEntry?.role
                        ? memberEntry.role
                        : (memberId === project.ownerId ? 'Owner' : 'Member');

                    return {
                        id: memberId,
                        displayName: profile?.displayName || t('projectOverview.team.memberFallback'),
                        photoURL: profile?.photoURL,
                        role: role
                    };
                });

                const profiles = await Promise.all(profilePromises);
                setTeamMemberProfiles(profiles.filter(p => p !== null));
            } catch (err) {
                console.error("Failed to fetch team member profiles", err);
            }
        };

        fetchTeamMembers();
    }, [project?.id, project?.tenantId, project?.members, project?.ownerId]);

    useEffect(() => {
        if (pinnedReport?.createdAt) {
            const created = toMillis(pinnedReport.createdAt);
            const twoWeeks = 1000 * 60 * 60 * 24 * 14;
            setShowInsight(Date.now() - created > twoWeeks);
        } else {
            setShowInsight(true);
        }
    }, [pinnedReport]);

    const handleToggleTask = async (taskId: string, currentStatus: boolean, event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.stopPropagation();
        if (!project) return;
        setTasks(tasks.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus, project.id);
    };

    const handleToggleMilestone = async (milestone: Milestone) => {
        if (!project) return;
        const newStatus = milestone.status === 'Achieved' ? 'Pending' : 'Achieved';

        if (newStatus === 'Achieved') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        // Optimistic update
        setMilestones(prev => prev.map(m => m.id === milestone.id ? { ...m, status: newStatus } : m));
        await updateMilestone(project.id, milestone.id, { status: newStatus });
    };

    const handleGenerateReport = async () => {
        if (!project) return;
        setReportLoading(true);
        try {
            // Include comprehensive context
            const rep = await generateProjectReport(
                project,
                tasks,
                milestones,
                issues, // Assuming issues are available in scope
                ideas,
                activity,
                teamMemberProfiles
            );
            setReport(rep);
            await saveGeminiReport(project.id, rep);
            setShowReportModal(true);

            // Refresh pinned report
            const latest = await getLatestGeminiReport(project.id);
            setPinnedReport(latest);
        } catch (e) {
            console.error(e);
        } finally {
            setReportLoading(false);
        }
    };

    const uploadProjectAsset = async (file: File, kind: 'cover' | 'icon' | 'gallery') => {
        const tenant = project?.tenantId || getActiveTenantId() || project?.ownerId || auth?.currentUser?.uid || 'public';
        const projectId = project?.id || id || 'unknown';

        // Use the same pattern as createProject for consistency and library discovery
        // Path: tenants/{tid}/projects/{pid}/{timestamp}_media_{pid}_{kind}_{filename}
        const timestamp = Date.now();
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `tenants/${tenant}/projects/${projectId}/${timestamp}_media_${projectId}_${kind}_${cleanFileName}`;

        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    };

    const handleSaveEdit = async (updatedFields: Partial<Project>) => {
        if (!project || !id) return;

        try {
            await updateProjectFields(id, updatedFields);

            // Log activity
            await addActivityEntry(id, {
                type: 'status',
                user: (auth.currentUser?.displayName || t('projectOverview.activity.unknownUser')),
                action: 'updated project settings',
                targetId: id,
                targetName: project.title,
                target: 'Project Settings',
                metadata: {
                    changes: Object.keys(updatedFields)
                }
            });

            // Update local state
            setProject(prev => prev ? { ...prev, ...updatedFields } : null);
            setShowEditModal(false);
        } catch (error) {
            console.error("Error updating project:", error);
            setError(t('projectOverview.error.update'));
        }
    };

    const handleUpdateField = async (field: keyof Project, value: any) => {
        if (!project || !id) return;
        if (project[field] === value) return;

        try {
            await updateProjectFields(id, { [field]: value });

            await addActivityEntry(id, {
                type: 'status',
                user: (auth.currentUser?.displayName || t('projectOverview.activity.unknownUser')),
                action: 'updated project settings',
                targetId: id,
                targetName: project.title,
                target: 'Project Settings',
                metadata: {
                    changes: [field]
                }
            });

            setProject(prev => prev ? ({ ...prev, [field]: value } as Project) : prev);
        } catch (error) {
            console.error("Error updating project:", error);
            setError(t('projectOverview.error.update'));
        }
    };

    const toDateValue = (value?: string) => (value ? parseISO(value) : null);
    const toDateString = (value: Date | null) => (value ? format(value, 'yyyy-MM-dd') : '');




    const handleDeleteProject = async () => {
        if (!project) return;
        setDeletingProject(true);
        try {
            await deleteProjectById(project.id);
            navigate('/projects');
        } catch (err) {
            console.error(err);
            setError(t('projectOverview.error.delete'));
        } finally {
            setDeletingProject(false);
            setShowDeleteModal(false);
        }
    };

    const handleInvite = () => {
        setShowInviteModal(true);
    };

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'project-overview-header',
            title: t('projectOverview.onboarding.header.title'),
            description: t('projectOverview.onboarding.header.description')
        },
        {
            id: 'metrics',
            targetId: 'project-overview-metrics',
            title: t('projectOverview.onboarding.metrics.title'),
            description: t('projectOverview.onboarding.metrics.description'),
            placement: 'top'
        },
        {
            id: 'snapshot',
            targetId: 'project-overview-snapshot',
            title: t('projectOverview.onboarding.snapshot.title'),
            description: t('projectOverview.onboarding.snapshot.description'),
            placement: 'top'
        },
        {
            id: 'execution',
            targetId: 'project-overview-execution',
            title: t('projectOverview.onboarding.execution.title'),
            description: t('projectOverview.onboarding.execution.description'),
            placement: 'top'
        },
        {
            id: 'insight',
            targetId: 'project-overview-insight',
            title: t('projectOverview.onboarding.insight.title'),
            description: t('projectOverview.onboarding.insight.description'),
            placement: 'left'
        },
        {
            id: 'planning',
            targetId: 'project-overview-planning',
            title: t('projectOverview.onboarding.planning.title'),
            description: t('projectOverview.onboarding.planning.description'),
            placement: 'left'
        },
        {
            id: 'milestones',
            targetId: 'project-overview-milestones',
            title: t('projectOverview.onboarding.milestones.title'),
            description: t('projectOverview.onboarding.milestones.description'),
            placement: 'left'
        }
    ]), [t]);

    const {
        onboardingActive,
        stepIndex,
        setStepIndex,
        skip,
        finish
    } = useOnboardingTour('project_overview', {
        stepCount: onboardingSteps.length,
        autoStart: true,
        enabled: !loading && !unauthorized && !!project
    });

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
    const projectStatusLabels = useMemo(() => ({
        Active: t('dashboard.projectStatus.active'),
        Planning: t('dashboard.projectStatus.planning'),
        'On Hold': t('dashboard.projectStatus.onHold'),
        Completed: t('dashboard.projectStatus.completed'),
        Brainstorming: t('dashboard.projectStatus.brainstorming'),
        Review: t('projectOverview.status.review')
    }), [t]);
    const priorityLabels = useMemo(() => ({
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    }), [t]);
    const statusOptions = useMemo<SelectOption[]>(() => ([
        { value: 'Active', label: projectStatusLabels.Active },
        { value: 'Planning', label: projectStatusLabels.Planning },
        { value: 'On Hold', label: projectStatusLabels['On Hold'] },
        { value: 'Completed', label: projectStatusLabels.Completed },
        { value: 'Brainstorming', label: projectStatusLabels.Brainstorming },
        { value: 'Review', label: projectStatusLabels.Review }
    ]), [projectStatusLabels]);
    const priorityOptions = useMemo<SelectOption[]>(() => ([
        { value: 'Low', label: priorityLabels.Low },
        { value: 'Medium', label: priorityLabels.Medium },
        { value: 'High', label: priorityLabels.High },
        { value: 'Urgent', label: priorityLabels.Urgent }
    ]), [priorityLabels]);
    const projectStateOptions = useMemo<SelectOption[]>(() => ([
        { value: 'not specified', label: t('projectOverview.controls.state.notSpecified') },
        { value: 'pre-release', label: t('projectOverview.controls.state.preRelease') },
        { value: 'released', label: t('projectOverview.controls.state.released') }
    ]), [t]);
    const issueStatusLabels = useMemo(() => ({
        Open: t('projectIssues.status.open'),
        'In Progress': t('projectIssues.status.inProgress'),
        Resolved: t('projectIssues.status.resolved'),
        Closed: t('projectIssues.status.closed')
    }), [t]);
    const taskStatusLabels = useMemo(() => ({
        Done: t('tasks.status.done'),
        'In Progress': t('tasks.status.inProgress'),
        Review: t('tasks.status.review'),
        Open: t('tasks.status.open'),
        Todo: t('tasks.status.todo'),
        Backlog: t('tasks.status.backlog'),
        'On Hold': t('tasks.status.onHold'),
        Blocked: t('tasks.status.blocked')
    }), [t]);
    const healthStatusLabels = useMemo(() => ({
        excellent: t('status.excellent'),
        healthy: t('status.healthy'),
        warning: t('status.warning'),
        critical: t('status.critical'),
        normal: t('status.normal'),
        stalemate: t('status.stalemate')
    }), [t]);

    const nextSprint = useMemo(() => {
        const active = sprints.find(s => s.status === 'Active');
        if (active) return active;
        return sprints
            .filter(s => s.status === 'Planning')
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    }, [sprints]);

    if (loading) return (
        <div className="project-overview__loading">
            <span className="material-symbols-outlined project-overview__loading-icon">progress_activity</span>
        </div>
    );

    if (unauthorized) {
        return (
            <div className="project-overview__unauthorized">
                <div className="project-overview__unauthorized-badge">
                    <span className="material-symbols-outlined project-overview__unauthorized-icon">lock</span>
                </div>
                <h1 className="project-overview__unauthorized-title">{t('projectOverview.unauthorized.title')}</h1>
                <p className="project-overview__unauthorized-text">
                    {t('projectOverview.unauthorized.description')}
                </p>
                <Link to="/projects" className="project-overview__unauthorized-action">
                    <Button variant="primary" icon={<span className="material-symbols-outlined">arrow_back</span>}>
                        {t('projectOverview.unauthorized.back')}
                    </Button>
                </Link>
            </div>
        );
    }

    if (!project) return <div className="project-overview__not-found">{t('projectOverview.error.notFound')}</div>;

    const health = calculateProjectHealth(project, tasks, milestones, issues, activity);

    // Stats Calculations
    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const subtaskTotals = Object.values(subtaskStats).reduce((acc, stat) => {
        acc.total += stat.total;
        acc.done += stat.done;
        return acc;
    }, { total: 0, done: 0 });
    const completedTasksWithSubtasks = completedTasks + subtaskTotals.done;
    const totalTasksWithSubtasks = tasks.length + subtaskTotals.total;
    const completedBreakdownTotal = completedTasksWithSubtasks;
    const taskCompletionShare = completedBreakdownTotal > 0 ? Math.round((completedTasks / completedBreakdownTotal) * 100) : 0;
    const subtaskCompletionShare = completedBreakdownTotal > 0 ? 100 - taskCompletionShare : 0;
    const openSubtasks = subtaskTotals.total - subtaskTotals.done;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const openTasks = tasks.length - completedTasks + openSubtasks;
    const urgentCount = tasks.filter(t => t.priority === 'Urgent').length;
    const upcomingDeadlines = tasks.filter(t => t.dueDate && new Date(t.dueDate) > new Date() && !t.isCompleted).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()).slice(0, 3);


    const recentTasks = tasks
        .filter(t => !t.isCompleted && t.status !== 'Done' && !t.convertedIdeaId)
        .sort((a, b) => {
            const pA = priorityMap[a.priority || 'Medium'] || 0;
            const pB = priorityMap[b.priority || 'Medium'] || 0;
            if (pA !== pB) return pB - pA; // Descending Priority
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            return dateA - dateB; // Ascending Due Date
        })
        .slice(0, 10);

    // Initiatives (strategic tasks converted from ideas)
    const initiatives = tasks
        .filter(t => !t.isCompleted && t.status !== 'Done' && t.convertedIdeaId)
        .sort((a, b) => {
            const pA = priorityMap[a.priority || 'Medium'] || 0;
            const pB = priorityMap[b.priority || 'Medium'] || 0;
            if (pA !== pB) return pB - pA;
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            return dateA - dateB;
        });

    const recentIssues = issues
        .filter(i => !['Resolved', 'Closed'].includes(i.status))
        .sort((a, b) => {
            const pA = priorityMap[a.priority || 'Medium'] || 0;
            const pB = priorityMap[b.priority || 'Medium'] || 0;
            if (pA !== pB) return pB - pA;
            const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
            const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Number.MAX_SAFE_INTEGER;
            return dateA - dateB;
        })
        .slice(0, 5);

    const hasIssuesModule = project.modules?.includes('issues');
    const hasIdeasModule = project.modules?.includes('ideas');
    const openIssues = issues.filter(i => !['Resolved', 'Closed'].includes(i.status)).length;
    const pendingMilestones = milestones.filter(m => m.status !== 'Achieved');
    const ideaHighlights = ideas.slice().sort((a, b) => b.votes - a.votes).slice(0, 4);
    const topIdea = ideaHighlights[0];
    const showGithubCard = hasIssuesModule;
    const showIdeaCard = hasIdeasModule;
    const showIssueCard = hasIssuesModule;
    const executionSideCards = Number(showIdeaCard) + Number(showIssueCard);
    const galleryAssets = projectAssets
        .map((url, index) => {
            const match = url.match(/(?:^|%2F)(\d+)_media_/);
            return {
                url,
                index,
                timestamp: match ? Number(match[1]) : 0
            };
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 3);
    const inProgressCount = tasks.filter(t => t.status === 'In Progress').length;
    const workloadMetric = { label: t('tasks.status.inProgress'), value: inProgressCount, icon: 'pending_actions' };
    const projectPriorityKey = (project.priority || 'Medium').toLowerCase();


    return (
        <>
            <div className="project-overview-container">


                {/* PROFILE BANNER LAYOUT */}
                <div data-onboarding-id="project-overview-header" className="project-header-card">

                    {/* 1. Cover Image Banner */}
                    <div
                        className={`cover-section ${!project.coverImage ? 'no-image' : 'has-image'}`}
                        style={{
                            backgroundImage: !coverRemoved && project.coverImage ? `url(${project.coverImage})` : undefined,
                            backgroundColor: !project.coverImage ? 'var(--color-surface-hover)' : undefined
                        }}
                    >
                        {!project.coverImage && (
                            <div className="empty-cover-placeholder">
                                <span className="material-symbols-outlined">image</span>
                            </div>
                        )}

                        {/* Action Overlay (Cover) */}
                        {isOwner && (
                            <div className="edit-cover-btn-wrapper">
                                <Button
                                    size="sm"
                                    className="cover-edit-btn"
                                    icon={<span className="material-symbols-outlined cover-edit-icon">photo_camera</span>}
                                    onClick={() => { setMediaPickerTarget('cover'); setShowMediaLibrary(true); }}
                                >
                                    {t('projectOverview.actions.editCover')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* 2. Identity Bar */}
                    <div className="identity-bar">

                        {/* Overlapping Icon */}
                        <div className="project-icon-wrapper">
                            <div className="icon-container">
                                <div className="icon-frame">
                                    <div className={`icon-inner ${project.squareIcon ? 'with-image' : 'no-image'}`} onClick={() => { if (isOwner) { setMediaPickerTarget('icon'); setShowMediaLibrary(true); } }}>
                                        {project.squareIcon ? (
                                            <img src={project.squareIcon} alt="" />
                                        ) : (
                                            <span className="icon-placeholder-text">{project.title.charAt(0)}</span>
                                        )}
                                    </div>
                                </div>
                                {isOwner && (
                                    <div className="edit-overlay">
                                        <span className="material-symbols-outlined edit-overlay-icon">edit</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Left: Text Info */}
                        <div className="info-section">
                            <div>
                                <div className="title-row">
                                    <h1>{project.title}</h1>
                                    <Badge variant={project.status === 'Active' ? 'success' : 'neutral'}>
                                        {projectStatusLabels[project.status as keyof typeof projectStatusLabels] || project.status}
                                    </Badge>
                                </div>
                                <div className="description-area">
                                    <p className="desc-text">{project.description || t('projectOverview.header.noDescription')}</p>

                                    {/* Hover Expand Box */}
                                    {project.description && (
                                        <div className="hover-popover">
                                            <p className="popover-content">
                                                {project.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="actions-section">
                            {/* View Toggle (Desktop) */}
                            <div className="view-toggle">
                                <button
                                    onClick={() => setViewMode('overview')}
                                    className={viewMode === 'overview' ? 'active' : ''}
                                >
                                    <span className="material-symbols-outlined view-toggle-icon">grid_view</span>
                                    <span>{t('nav.overview')}</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('mindmap')}
                                    className={viewMode === 'mindmap' ? 'active' : ''}
                                >
                                    <span className="material-symbols-outlined view-toggle-icon">hub</span>
                                    <span>{t('nav.mindmap')}</span>
                                </button>
                            </div>

                            <div className="button-group">
                                {can('canManageTasks') && (
                                    <Button variant="primary" onClick={() => setShowTaskModal(true)} icon={<span className="material-symbols-outlined">add_task</span>}>
                                        {t('projectOverview.actions.newTask')}
                                    </Button>
                                )}
                                {can('canInvite') && (
                                    <Button variant="secondary" onClick={handleInvite} icon={<span className="material-symbols-outlined">person_add</span>}>
                                        {t('projectOverview.actions.invite')}
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => {
                                        if (!project?.id) return;
                                        if (pinnedProjectId === project.id) {
                                            void unpinProject();
                                        } else {
                                            void pinProject(project.id);
                                        }
                                    }}
                                    title={pinnedProjectId === project.id ? t('projectOverview.actions.unpinProject') : t('projectOverview.actions.pinProject')}
                                    className={`project-pin-btn ${pinnedProjectId === project.id ? 'is-pinned' : ''}`.trim()}
                                >
                                    <span className="material-symbols-outlined">
                                        {pinnedProjectId === project.id ? 'push_pin' : 'keep'}
                                    </span>
                                </Button>
                                {isOwner && (
                                    <Button size="icon" variant="ghost" onClick={() => setShowEditModal(true)}>
                                        <span className="material-symbols-outlined">settings</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>



                    {/* Banner Metrics Footer */}
                    <div data-onboarding-id="project-overview-metrics" className="metrics-footer">
                        {/* 1. Progress */}
                        <div className="metric-item">
                            <span className="material-symbols-outlined icon metric-icon metric-icon--primary">speed</span>
                            <div className="content">
                                <div className="value-row">
                                    <span className="label">{t('projectOverview.metrics.completion')}</span>
                                    <span className="val" style={{ color: 'var(--color-primary)' }}>{progress}%</span>
                                </div>
                                <div className="progress-track">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Tasks Stat */}
                        <div className="metric-item metric-item--tooltip">
                            <span className="material-symbols-outlined icon metric-icon metric-icon--success">task_alt</span>
                            <div className="content">
                                <div className="main-value">
                                    {completedTasksWithSubtasks} / {totalTasksWithSubtasks}
                                </div>
                                <span className="sub-label">{t('projectOverview.metrics.tasksDone')}</span>
                            </div>

                            {/* Floating Hover Card (Keeping inline styles for complex layout specific to this popup not fully covered by general SCSS yet) */}
                            <div className="metric-tooltip">
                                <div className="metric-tooltip__card">
                                    <div className="metric-tooltip__header">
                                        <div className="metric-tooltip__title">
                                            <span className="material-symbols-outlined">donut_small</span>
                                            <span>{t('projectOverview.metrics.composition')}</span>
                                        </div>
                                        <span className="metric-tooltip__meta">
                                            {t('projectOverview.metrics.totalCompleted')}
                                        </span>
                                    </div>
                                    <div className="metric-tooltip__body">
                                        <div className="metric-tooltip__bar">
                                            <div
                                                className="metric-tooltip__segment metric-tooltip__segment--tasks"
                                                style={{ width: `${taskCompletionShare}%` }}
                                            >
                                                {taskCompletionShare > 10 && (
                                                    <span className="metric-tooltip__segment-text">{taskCompletionShare}%</span>
                                                )}
                                            </div>
                                            <div
                                                className="metric-tooltip__segment metric-tooltip__segment--subtasks"
                                                style={{ width: `${subtaskCompletionShare}%` }}
                                            >
                                                {subtaskCompletionShare > 10 && (
                                                    <span className="metric-tooltip__segment-text">{subtaskCompletionShare}%</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="metric-tooltip__labels">
                                            <span>{t('projectOverview.metrics.tasks')}</span>
                                            <span>{t('projectOverview.metrics.subtasks')}</span>
                                        </div>
                                        <div className="metric-tooltip__grid">
                                            <div className="metric-tooltip__stat-card">
                                                <div className="metric-tooltip__stat-row">
                                                    <span className="metric-tooltip__stat-dot metric-tooltip__stat-dot--tasks" />
                                                    <span className="metric-tooltip__stat-label">{t('projectOverview.metrics.mainTasks')}</span>
                                                </div>
                                                <div className="metric-tooltip__stat-value">
                                                    {completedTasks}
                                                    <span className="metric-tooltip__stat-total">/ {tasks.length}</span>
                                                </div>
                                            </div>
                                            <div className="metric-tooltip__stat-card">
                                                <div className="metric-tooltip__stat-row">
                                                    <span className="metric-tooltip__stat-dot metric-tooltip__stat-dot--subtasks" />
                                                    <span className="metric-tooltip__stat-label">{t('projectOverview.metrics.subtasksLabel')}</span>
                                                </div>
                                                <div className="metric-tooltip__stat-value">
                                                    {subtaskTotals.done}
                                                    <span className="metric-tooltip__stat-total">/ {subtaskTotals.total}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Priority */}
                        <div className="metric-item">
                            <span className={`material-symbols-outlined icon metric-icon metric-icon--${projectPriorityKey}`}>flag</span>
                            <div className="content">
                                <div className={`main-value priority-text priority-text--${projectPriorityKey}`}>
                                    {project.priority ? (priorityLabels[project.priority] || project.priority) : t('tasks.priority.medium')}
                                </div>
                                <span className="sub-label">{t('projectOverview.metrics.priority')}</span>
                            </div>
                        </div>

                        {/* 4. Next Sprint */}
                        <div className="metric-item">
                            <span className="material-symbols-outlined icon metric-icon metric-icon--warning">directions_run</span>
                            <div className="content">
                                <div className="main-value">
                                    {nextSprint ? nextSprint.name : t('None', 'None')}
                                </div>
                                <span className="sub-label">{t('Next Sprint', 'Next Sprint')}</span>
                            </div>
                        </div>

                        {/* 5. Next Deadline */}
                        <div className="metric-item">
                            <span className="material-symbols-outlined icon metric-icon metric-icon--primary">event_upcoming</span>
                            <div className="content">
                                <div className="main-value">
                                    {upcomingDeadlines[0]
                                        ? format(new Date(upcomingDeadlines[0].dueDate!), dateFormat, { locale: dateLocale })
                                        : t('projectOverview.metrics.none')}
                                </div>
                                <span className="sub-label">{t('projectOverview.metrics.nextDeadline')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Mobile View Toggle */}
                    <div className="project-overview__mobile-toggle">
                        <div className="project-overview__toggle-group">
                            <button
                                onClick={() => setViewMode('overview')}
                                className={`project-overview__toggle-btn ${viewMode === 'overview' ? 'is-active' : ''}`}
                            >
                                <span className="material-symbols-outlined view-toggle-icon">grid_view</span>
                                <span>{t('nav.overview')}</span>
                            </button>
                            <button
                                onClick={() => setViewMode('mindmap')}
                                className={`project-overview__toggle-btn ${viewMode === 'mindmap' ? 'is-active' : ''}`}
                            >
                                <span className="material-symbols-outlined view-toggle-icon">hub</span>
                                <span>{t('nav.mindmap')}</span>
                            </button>
                        </div>
                    </div>

                </div>

                {
                    viewMode === 'mindmap' ? (
                        <div className="project-overview__mindmap">
                            <ProjectMindmap projectId={id!} />
                        </div>
                    ) : (
                        <>


                            {/* Project Overview Layout */}
                            <div className="overview-grid-layout">
                                <div className="main-column">
                                    {/* Snapshot */}
                                    <section data-onboarding-id="project-overview-snapshot" className="section-group">
                                        <div className="section-header">
                                            <h2>{t('projectOverview.snapshot.title')}</h2>
                                            <span className="subtitle">{t('projectOverview.snapshot.subtitle')}</span>
                                        </div>
                                        <div className="snapshot-grid">
                                            {/* Health Card */}
                                            <Card className="widget-card health-widget">
                                                <div className="card-header">
                                                    <h3 className="title">
                                                        <span className="material-symbols-outlined icon">monitor_heart</span>
                                                        {t('projectOverview.snapshot.health.title')}
                                                    </h3>
                                                    <button onClick={() => setShowHealthModal(true)} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </button>
                                                </div>

                                                {/* Semi-Circle Gauge Section */}
                                                <div className="health-widget__gauge-section">
                                                    <div className={`health-widget__gauge health-widget__gauge--${health.status}`}>
                                                        <svg viewBox="0 0 120 70" className="health-widget__svg">
                                                            {/* Background arc */}
                                                            <path
                                                                d="M 10 60 A 50 50 0 0 1 110 60"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="8"
                                                                strokeLinecap="round"
                                                                className="health-widget__track"
                                                            />
                                                            {/* Progress arc */}
                                                            <path
                                                                d="M 10 60 A 50 50 0 0 1 110 60"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="8"
                                                                strokeLinecap="round"
                                                                strokeDasharray="157"
                                                                strokeDashoffset={157 - (health.score / 100) * 157}
                                                                className="health-widget__progress"
                                                            />
                                                        </svg>
                                                        <div className="health-widget__score-group">
                                                            <span className="health-widget__score">{health.score}</span>
                                                            <span className="health-widget__score-suffix">/100</span>
                                                        </div>
                                                    </div>

                                                    {/* Status & Trend Row */}
                                                    <div className="health-widget__status-row">
                                                        <span className={`health-widget__status-badge health-widget__status-badge--${health.status}`}>
                                                            {healthStatusLabels[health.status] || health.status}
                                                        </span>
                                                        <span className={`health-widget__trend health-widget__trend--${healthDelta !== null ? (healthDelta > 0 ? 'improving' : healthDelta < 0 ? 'declining' : 'stable') : health.trend}`}>
                                                            <span className="material-symbols-outlined">
                                                                {healthDelta !== null ? (healthDelta > 0 ? 'trending_up' : healthDelta < 0 ? 'trending_down' : 'trending_flat') : (health.trend === 'improving' ? 'trending_up' : health.trend === 'declining' ? 'trending_down' : 'trending_flat')}
                                                            </span>
                                                            {healthDelta !== null ? `${healthDelta > 0 ? '+' : ''}${healthDelta}` : '—'} {t('health.vsLastWeek', 'vs last week')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Card>

                                            {/* Workload Card */}
                                            <Card className="widget-card">
                                                <div className="card-header">
                                                    <h3 className="title">
                                                        <span className="material-symbols-outlined icon">inbox</span>
                                                        {t('projectOverview.snapshot.workload.title')}
                                                    </h3>
                                                    <Link to={`/project/${id}/tasks`} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="workload-content">
                                                    <div className="stat-row">
                                                        <div className="stat-label">
                                                            <span className="material-symbols-outlined icon">list_alt</span>
                                                            {t('projectOverview.snapshot.workload.openTasks')}
                                                        </div>
                                                        <span className="stat-value">{openTasks}</span>
                                                    </div>
                                                    <div className="stat-row">
                                                        <div className="stat-label">
                                                            <span className="material-symbols-outlined icon urgent">priority_high</span>
                                                            {t('tasks.priority.urgent')}
                                                        </div>
                                                        <span className="stat-value">{urgentCount}</span>
                                                    </div>
                                                    <div className="stat-row">
                                                        <div className="stat-label">
                                                            <span className="material-symbols-outlined icon">{workloadMetric.icon}</span>
                                                            {workloadMetric.label}
                                                        </div>
                                                        <span className="stat-value">{workloadMetric.value}</span>
                                                    </div>
                                                </div>
                                            </Card>

                                            {/* Priority Card */}
                                            <Card className="widget-card priority-widget">
                                                <div className="card-header">
                                                    <h3 className="title">
                                                        <span className="material-symbols-outlined icon">flag</span>
                                                        {t('projectOverview.snapshot.priority.title', 'Priority')}
                                                    </h3>
                                                    <Link to={`/project/${id}/tasks`} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="priority-widget__content">
                                                    {[
                                                        { key: 'Urgent', label: t('tasks.priority.urgent', 'Urgent'), color: 'urgent' },
                                                        { key: 'High', label: t('tasks.priority.high', 'High'), color: 'high' },
                                                        { key: 'Medium', label: t('tasks.priority.medium', 'Medium'), color: 'medium' },
                                                        { key: 'Low', label: t('tasks.priority.low', 'Low'), color: 'low' },
                                                    ].map(p => {
                                                        const count = tasks.filter(t => !t.isCompleted && t.priority === p.key).length;
                                                        return (
                                                            <div key={p.key} className="priority-widget__row">
                                                                <span className={`priority-widget__dot priority-widget__dot--${p.color}`} />
                                                                <span className="priority-widget__label">{p.label}</span>
                                                                <span className="priority-widget__count">{count}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </Card>

                                            {/* Activity Card */}
                                            <Card className="widget-card">
                                                <div className="card-header">
                                                    <h3 className="title">
                                                        <span className="material-symbols-outlined icon">insights</span>
                                                        {t('projectOverview.snapshot.activity.title')}
                                                    </h3>
                                                    <Link to={`/project/${id}/activity`} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="activity-stats-grid">
                                                    <div>
                                                        <div className="big-num">{activity.length}</div>
                                                        <div className="label">{t('projectOverview.snapshot.activity.events')}</div>
                                                    </div>
                                                    <div>
                                                        <div className="big-num comments">{activity.filter(a => a.type === 'comment').length}</div>
                                                        <div className="label">{t('projectOverview.snapshot.activity.comments')}</div>
                                                    </div>
                                                </div>
                                                <div className="recent-activity-preview">
                                                    {activity[0]
                                                        ? (
                                                            <>
                                                                <span className="user-name">{activity[0].user}</span> {activity[0].action.length > 35 ? activity[0].action.substring(0, 35) + '...' : activity[0].action}
                                                                <span className="time">{timeAgo(activity[0].createdAt)}</span>
                                                            </>
                                                        )
                                                        : t('projectOverview.snapshot.activity.empty')}
                                                </div>
                                            </Card>

                                        </div>
                                    </section>

                                    {/* Execution */}
                                    <section data-onboarding-id="project-overview-execution" className="section-group">
                                        <div className="section-header">
                                            <h2>{t('projectOverview.execution.title')}</h2>
                                            <div className="header-stats">
                                                <span>{t('projectOverview.execution.openTasks').replace('{count}', String(openTasks))}</span>
                                                {showIssueCard && <span>{t('projectOverview.execution.openIssues').replace('{count}', String(openIssues))}</span>}
                                                {showIdeaCard && <span>{t('projectOverview.execution.flows').replace('{count}', String(ideas.length))}</span>}
                                            </div>
                                        </div>
                                        <div className="execution-grid">
                                            <Card className={`widget-card execution-main ${executionSideCards === 0 ? 'execution-main--full' : ''}`.trim()}>
                                                <div className="card-header">
                                                    <div className="title-group">
                                                        <span className="material-symbols-outlined icon">checklist</span>
                                                        <h3 className="title">{t('nav.tasks')}</h3>
                                                    </div>
                                                    <Link to={`/project/${id}/tasks`} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="list-content">
                                                    {recentTasks.length === 0 ? (
                                                        <div className="empty-state">
                                                            {t('projectOverview.execution.noActiveTasks')}
                                                        </div>
                                                    ) : (
                                                        recentTasks.slice(0, 6).map(task => (
                                                            <div
                                                                key={task.id}
                                                                onClick={() => navigate(`/project/${id}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                                                className="list-row"
                                                            >
                                                                <button
                                                                    onClick={(e) => handleToggleTask(task.id, task.isCompleted, e)}
                                                                    className={`checkbox ${task.isCompleted ? 'checked' : ''}`}
                                                                >
                                                                    <span className="material-symbols-outlined">check</span>
                                                                </button>
                                                                <div className="row-content">
                                                                    <p className={`row-title ${task.isCompleted ? 'completed' : ''}`}>
                                                                        {task.title}
                                                                    </p>
                                                                    <div className="meta-row">
                                                                        {task.priority && (
                                                                            <div className={`badge priority-${task.priority.toLowerCase()}`}>
                                                                                <span className="material-symbols-outlined">
                                                                                    {task.priority === 'Urgent' ? 'error' :
                                                                                        task.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                                                            task.priority === 'Medium' ? 'drag_handle' :
                                                                                                'keyboard_arrow_down'}
                                                                                </span>
                                                                                {task.priority ? (priorityLabels[task.priority] || task.priority) : ''}
                                                                            </div>
                                                                        )}
                                                                        {/* Subtask Count */}
                                                                        {subtaskStats[task.id]?.total > 0 && (
                                                                            <div className="badge subtask">
                                                                                <span className="material-symbols-outlined">checklist</span>
                                                                                {subtaskStats[task.id].done}/{subtaskStats[task.id].total}
                                                                            </div>
                                                                        )}
                                                                        {/* Timeline or Due Date Display */}
                                                                        {(() => {
                                                                            const hasStart = Boolean(task.startDate);
                                                                            const hasDue = Boolean(task.dueDate);
                                                                            const dueDate = task.dueDate ? new Date(task.dueDate) : null;
                                                                            const isOverdue = dueDate && dueDate < new Date() && !task.isCompleted;

                                                                            // Timeline when both dates exist
                                                                            if (hasStart && hasDue) {
                                                                                const start = new Date(task.startDate!).getTime();
                                                                                const end = dueDate!.getTime();
                                                                                const now = new Date().getTime();
                                                                                const total = end - start;
                                                                                const elapsed = now - start;
                                                                                const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                                                                return (
                                                                                    <div className="timeline-mini">
                                                                                        <span className="date-label">
                                                                                            {format(new Date(task.startDate!), dateFormat, { locale: dateLocale })}
                                                                                        </span>
                                                                                        <div className="progress-bar-bg">
                                                                                            <div
                                                                                                className={`progress-bar-fill ${isOverdue ? 'overdue' : ''}`}
                                                                                                style={{ width: `${pct}%` }}
                                                                                            />
                                                                                        </div>
                                                                                        <span className={`date-label ${isOverdue ? 'overdue-text' : ''}`}>
                                                                                            {format(dueDate!, dateFormat, { locale: dateLocale })}
                                                                                        </span>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            // Due date only
                                                                            if (hasDue && dueDate) {
                                                                                return (
                                                                                    <span className={`date-text ${isOverdue ? 'overdue' : ''}`}>
                                                                                        {format(dueDate, dateFormat, { locale: dateLocale })}
                                                                                    </span>
                                                                                );
                                                                            }

                                                                            return null;
                                                                        })()}
                                                                        {/* Smart Scheduled Date */}
                                                                        {task.scheduledDate && (
                                                                            <span className="scheduled-date">
                                                                                <span className="material-symbols-outlined">event_available</span>
                                                                                {format(new Date(task.scheduledDate), dateFormat, { locale: dateLocale })}
                                                                            </span>
                                                                        )}
                                                                        {task.assignedGroupIds && task.assignedGroupIds.length > 0 && (
                                                                            <div className="assigned-groups">
                                                                                {task.assignedGroupIds.map(gid => {
                                                                                    const group = projectGroups.find(g => g.id === gid);
                                                                                    if (!group) return null;
                                                                                    return (
                                                                                        <div
                                                                                            key={gid}
                                                                                            className="group-avatar"
                                                                                            style={{ backgroundColor: group.color }}
                                                                                            title={t('projectTasks.groupLabel').replace('{name}', group.name)}
                                                                                        >
                                                                                            {group.name.substring(0, 1).toUpperCase()}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (isPinned(task.id)) {
                                                                            unpinItem(task.id);
                                                                        } else {
                                                                            pinItem({
                                                                                id: task.id,
                                                                                type: 'task',
                                                                                title: task.title,
                                                                                projectId: id!,
                                                                                priority: task.priority,
                                                                                isCompleted: task.isCompleted
                                                                            });
                                                                        }
                                                                    }}
                                                                    className={`pin-btn ${isPinned(task.id) ? 'pinned' : ''}`}
                                                                    title={isPinned(task.id) ? t('projectOverview.execution.unpinTask') : t('projectOverview.execution.pinTask')}
                                                                >
                                                                    <span className="material-symbols-outlined">push_pin</span>
                                                                </button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </Card>

                                            {(showIdeaCard || showIssueCard) && (
                                                <div className={`execution-side ${executionSideCards > 1 ? 'execution-side--stacked' : ''}`.trim()}>
                                                    {showIdeaCard && (
                                                        <Card className={`widget-card execution-side-card ${executionSideCards > 1 ? 'execution-side-card--stacked' : ''}`.trim()}>
                                                            <div className="card-header">
                                                                <h3 className="title">
                                                                    <span className="material-symbols-outlined icon">lightbulb</span>
                                                                    {t('projectOverview.execution.flowSpotlight')}
                                                                </h3>
                                                                <Link to={`/project/${id}/flows`} className="header-action-btn">
                                                                    <span className="material-symbols-outlined">arrow_forward</span>
                                                                </Link>
                                                            </div>
                                                            {topIdea ? (() => {
                                                                const typeBadgeClass = getTypeBadgeClass(topIdea.type);
                                                                return (
                                                                    <Link
                                                                        to={`/project/${id}/flows/${topIdea.id}`}
                                                                        className="flow-spotlight-card"
                                                                    >
                                                                        {/* Type Badge Row */}
                                                                        <div className="flow-meta">
                                                                            <span className={`type-badge ${typeBadgeClass}`}>
                                                                                {topIdea.type}
                                                                            </span>
                                                                            {topIdea.generated && (
                                                                                <span className="ai-badge">
                                                                                    <span className="material-symbols-outlined">auto_awesome</span>
                                                                                    {t('projectOverview.execution.aiLabel')}
                                                                                </span>
                                                                            )}
                                                                            {topIdea.stage && (
                                                                                <span className="stage-badge">
                                                                                    <span className="material-symbols-outlined">layers</span>
                                                                                    {topIdea.stage}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Title */}
                                                                        <h4 className="flow-title">
                                                                            {topIdea.title}
                                                                        </h4>

                                                                        {/* Description */}
                                                                        {topIdea.description && (
                                                                            <p className="flow-desc">
                                                                                {topIdea.description}
                                                                            </p>
                                                                        )}

                                                                        {/* Meta Row */}
                                                                        <div className="interaction-stats">
                                                                            <span className="stat">
                                                                                <span className="material-symbols-outlined">thumb_up</span>
                                                                                {topIdea.votes || 0}
                                                                            </span>
                                                                            <span className="stat">
                                                                                <span className="material-symbols-outlined">chat_bubble</span>
                                                                                {topIdea.comments || 0}
                                                                            </span>
                                                                        </div>
                                                                    </Link>
                                                                );
                                                            })() : (
                                                                <div className="empty-state">
                                                                    {t('projectOverview.execution.noFlows')}
                                                                </div>
                                                            )}
                                                        </Card>
                                                    )}

                                                    {showIssueCard && (
                                                        <Card className={`widget-card execution-side-card ${executionSideCards > 1 ? 'execution-side-card--stacked' : ''}`.trim()}>
                                                            <div className="card-header">
                                                                <h3 className="title">
                                                                    <span className="material-symbols-outlined icon">bug_report</span>
                                                                    {t('projectOverview.execution.issueFocus')}
                                                                </h3>
                                                                <Link to={`/project/${id}/issues`} className="header-action-btn">
                                                                    <span className="material-symbols-outlined">arrow_forward</span>
                                                                </Link>
                                                            </div>

                                                            <div className="list-content scrollable">
                                                                {recentIssues.length === 0 ? (
                                                                    <div className="empty-state">{t('projectOverview.execution.noOpenIssues')}</div>
                                                                ) : (
                                                                    recentIssues.map(issue => (
                                                                        <div
                                                                            key={issue.id}
                                                                            onClick={() => navigate(`/project/${id}/issues/${issue.id}`)}
                                                                            className="list-row"
                                                                        >
                                                                            <div className="row-content">
                                                                                <p className="row-title row-title--truncate">{issue.title}</p>
                                                                                <div className="meta-row">
                                                                                    <div className={`badge priority-${issue.priority.toLowerCase()}`}>
                                                                                        <span className="material-symbols-outlined">
                                                                                            {issue.priority === 'Urgent' ? 'error' :
                                                                                                issue.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                                                                    issue.priority === 'Medium' ? 'drag_handle' :
                                                                                                        'keyboard_arrow_down'}
                                                                                        </span>
                                                                                        {issue.priority ? (priorityLabels[issue.priority] || issue.priority) : ''}
                                                                                    </div>
                                                                                    <div className="badge status">
                                                                                        {issueStatusLabels[issue.status] || issue.status}
                                                                                    </div>
                                                                                    {issue.assignedGroupIds && issue.assignedGroupIds.length > 0 && (
                                                                                        <div className="assigned-groups">
                                                                                            {issue.assignedGroupIds.map(gid => {
                                                                                                const group = projectGroups.find(g => g.id === gid);
                                                                                                if (!group) return null;
                                                                                                return (
                                                                                                    <div
                                                                                                        key={gid}
                                                                                                        className="group-avatar"
                                                                                                        style={{ backgroundColor: group.color }}
                                                                                                        title={t('projectTasks.groupLabel').replace('{name}', group.name)}
                                                                                                    >
                                                                                                        {group.name.substring(0, 1).toUpperCase()}
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            <div className="row-actions">
                                                                                {(() => {
                                                                                    const hasStart = Boolean(issue.startDate);
                                                                                    const hasDue = Boolean(issue.dueDate || issue.scheduledDate);
                                                                                    const dueDateStr = issue.dueDate || issue.scheduledDate;
                                                                                    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
                                                                                    const isResolved = ['Resolved', 'Closed'].includes(issue.status);
                                                                                    const isOverdue = dueDate && dueDate < new Date() && !isResolved;

                                                                                    // Timeline view when both start and due exist
                                                                                    if (hasStart && hasDue) {
                                                                                        const start = new Date(issue.startDate!).getTime();
                                                                                        const end = dueDate!.getTime();
                                                                                        const now = new Date().getTime();
                                                                                        const total = end - start;
                                                                                        const elapsed = now - start;
                                                                                        const pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                                                                        return (
                                                                                            <div className="timeline-mini stacked">
                                                                                                <div className="timeline-header">
                                                                                                    <span>{t('projectOverview.execution.timeline')}</span>
                                                                                                    <span>{Math.round(pct)}%</span>
                                                                                                </div>
                                                                                                <div className="progress-bar-bg">
                                                                                                    <div
                                                                                                        className={`progress-bar-fill ${isOverdue ? 'overdue' : ''}`}
                                                                                                        style={{ width: `${pct}%` }}
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="timeline-footer">
                                                                                                    <span>{format(new Date(issue.startDate!), dateFormat, { locale: dateLocale })}</span>
                                                                                                    <span className={isOverdue ? 'overdue-text' : ''}>
                                                                                                        {format(dueDate!, dateFormat, { locale: dateLocale })}
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    // Due date only
                                                                                    if (hasDue && dueDate) {
                                                                                        return (
                                                                                            <div className={`date-badge ${isOverdue ? 'overdue' : ''}`}>
                                                                                                <span className="material-symbols-outlined">event</span>
                                                                                                <div className="date-col">
                                                                                                    <span className="label">
                                                                                                        {isOverdue ? t('projectOverview.execution.overdue') : t('projectOverview.execution.due')}
                                                                                                    </span>
                                                                                                    <span className="value">{format(dueDate, dateFormat, { locale: dateLocale })}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }

                                                                                    return null;
                                                                                })()}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (isPinned(issue.id)) {
                                                                                            unpinItem(issue.id);
                                                                                        } else {
                                                                                            pinItem({
                                                                                                id: issue.id,
                                                                                                type: 'issue',
                                                                                                title: issue.title,
                                                                                                projectId: id!,
                                                                                                priority: issue.priority
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                    className={`pin-btn ${isPinned(issue.id) ? 'pinned' : ''}`}
                                                                                    title={isPinned(issue.id) ? t('projectOverview.execution.unpinIssue') : t('projectOverview.execution.pinIssue')}
                                                                                >
                                                                                    <span className="material-symbols-outlined">push_pin</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </Card>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Initiatives Row */}
                                        {initiatives.length > 0 && (
                                            <div className="initiatives-section">
                                                <div className="initiatives-header">
                                                    <h3 className="initiatives-title">
                                                        <span className="material-symbols-outlined initiatives-title-icon">rocket_launch</span>
                                                        {t('projectOverview.initiatives.title')}
                                                        <span className="initiatives-count">({initiatives.length})</span>
                                                    </h3>
                                                    <Link to={`/project/${id}/tasks`} className="icon-btn" aria-label={t('projectOverview.initiatives.title')}>
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="initiatives-grid">
                                                    {initiatives.map(initiative => {
                                                        const { done: doneSub, total: totalSub } = subtaskStats[initiative.id] || { done: 0, total: 0 };
                                                        const hasStart = !!initiative.startDate;
                                                        const hasDue = !!initiative.dueDate;

                                                        // Calculate timeline percentage
                                                        let pct = 0;
                                                        let isOverdue = false;
                                                        if (hasStart && hasDue) {
                                                            const start = new Date(initiative.startDate!).getTime();
                                                            const due = new Date(initiative.dueDate!).getTime();
                                                            const now = new Date().getTime();
                                                            if (due > start) {
                                                                pct = Math.min(100, Math.max(0, ((now - start) / (due - start)) * 100));
                                                            }
                                                            isOverdue = now > due && initiative.status !== 'Done';
                                                        } else if (hasDue) {
                                                            const due = (initiative.dueDate instanceof Date ? initiative.dueDate : new Date(initiative.dueDate!)).getTime();
                                                            isOverdue = Date.now() > due && initiative.status !== 'Done';
                                                        }
                                                        const dueDate = initiative.dueDate ? new Date(initiative.dueDate) : null;

                                                        // Status-based styling
                                                        const statusKey = initiative.status?.toLowerCase().replace(/\s+/g, '-') || '';
                                                        const isInProgress = statusKey === 'in-progress' || statusKey === 'inprogress';
                                                        const isReview = statusKey === 'review' || statusKey === 'in-review';
                                                        const isBlocked = statusKey === 'blocked';

                                                        let statusClass = '';
                                                        if (isBlocked) statusClass = 'status-blocked';
                                                        else if (isInProgress) statusClass = 'status-active';
                                                        else if (isReview) statusClass = 'status-review';

                                                        const priorityKey = initiative.priority?.toLowerCase() || '';
                                                        const priorityClass = priorityKey === 'urgent' ? 'priority-urgent' :
                                                            priorityKey === 'high' ? 'priority-high' :
                                                                priorityKey === 'medium' ? 'priority-medium' : 'priority-low';

                                                        return (
                                                            <div
                                                                key={initiative.id}
                                                                onClick={() => navigate(`/project/${id}/tasks/${initiative.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                                                className={`initiative-card ${statusClass}`}
                                                            >
                                                                {/* Priority indicator */}
                                                                <div className={`initiative-priority-indicator ${priorityClass}`} />

                                                                <div className="initiative-header">
                                                                    <h4 className="initiative-title">
                                                                        {initiative.title}
                                                                    </h4>
                                                                    <span className="material-symbols-outlined initiative-icon">rocket_launch</span>
                                                                </div>

                                                                {/* Description */}
                                                                {initiative.description && (
                                                                    <p className="initiative-description">
                                                                        {initiative.description}
                                                                    </p>
                                                                )}

                                                                {/* Status & Priority Row */}
                                                                <div className="initiative-tags">
                                                                    {initiative.status && (
                                                                        <span className={`initiative-tag initiative-tag--status status-${statusKey}`}>
                                                                            {taskStatusLabels[initiative.status] || initiative.status}
                                                                        </span>
                                                                    )}
                                                                    {initiative.priority && (
                                                                        <span className={`initiative-tag initiative-tag--priority priority-${priorityKey}`}>
                                                                            <span className="material-symbols-outlined">
                                                                                {initiative.priority === 'Urgent' ? 'error' :
                                                                                    initiative.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                                                        initiative.priority === 'Medium' ? 'drag_handle' : 'keyboard_arrow_down'}
                                                                            </span>
                                                                            {priorityLabels[initiative.priority] || initiative.priority}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Assignees */}
                                                                {initiative.assignedGroupIds && initiative.assignedGroupIds.length > 0 && (
                                                                    <div className="initiative-assignees">
                                                                        <div className="initiative-avatars">
                                                                            {initiative.assignedGroupIds.slice(0, 3).map(gid => {
                                                                                const group = projectGroups.find(g => g.id === gid);
                                                                                if (!group) return null;
                                                                                return (
                                                                                    <div
                                                                                        key={gid}
                                                                                        className="initiative-avatar"
                                                                                        style={{ backgroundColor: group.color }}
                                                                                        title={group.name}
                                                                                    >
                                                                                        {group.name.substring(0, 1).toUpperCase()}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        {initiative.assignedGroupIds.length > 3 && (
                                                                            <span className="initiative-assignees-more">+{initiative.assignedGroupIds.length - 3}</span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Subtask progress if available */}
                                                                {subtaskStats[initiative.id]?.total > 0 && (
                                                                    <div className="initiative-progress">
                                                                        <span className="material-symbols-outlined initiative-progress-icon">checklist</span>
                                                                        <div className="initiative-progress-bar">
                                                                            <div
                                                                                className="initiative-progress-fill"
                                                                                style={{ width: `${(subtaskStats[initiative.id].done / subtaskStats[initiative.id].total) * 100}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="initiative-progress-text">
                                                                            {subtaskStats[initiative.id].done}/{subtaskStats[initiative.id].total}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Timeline */}
                                                                {hasStart && hasDue && (
                                                                    <div className={`initiative-timeline ${isOverdue ? 'is-overdue' : ''}`}>
                                                                        <span className="material-symbols-outlined">schedule</span>
                                                                        <span className="initiative-timeline-date">{format(new Date(initiative.startDate!), dateFormat, { locale: dateLocale })}</span>
                                                                        <div className="initiative-timeline-bar">
                                                                            <div
                                                                                className="initiative-timeline-fill"
                                                                                style={{ width: `${pct}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="initiative-timeline-date">{format(dueDate!, dateFormat, { locale: dateLocale })}</span>
                                                                    </div>
                                                                )}
                                                                {/* Due Date Only */}
                                                                {!hasStart && hasDue && (
                                                                    <div className={`initiative-due ${isOverdue ? 'is-overdue' : ''}`}>
                                                                        <span className="material-symbols-outlined">event</span>
                                                                        {t('projectOverview.initiatives.due')} {format(dueDate!, dateFormat, { locale: dateLocale })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </section>

                                    {/* Updates */}
                                    <section className="updates-section">
                                        <div className="section-header-simple">
                                            <h2>{t('projectOverview.updates.title')}</h2>
                                            <span className="subtitle">{t('projectOverview.updates.subtitle')}</span>
                                        </div>
                                        <div className="updates-grid">
                                            <Card className={`updates-card ${showGithubCard ? 'span-half' : 'span-full'}`}>
                                                <div className="updates-card__header">
                                                    <h3 className="updates-card__title">
                                                        <span className="material-symbols-outlined updates-card__title-icon">history</span>
                                                        {t('projectOverview.updates.latestActivity')}
                                                    </h3>
                                                    <Link to={`/project/${id}/activity`} className="icon-btn" aria-label={t('projectOverview.updates.latestActivity')}>
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>

                                                <div className="activity-list">
                                                    {activity.slice(0, 6).map((item) => {
                                                        const { icon, color, bg } = activityIcon(item.type, item.action);
                                                        return (
                                                            <div key={item.id} className="activity-item">
                                                                <div className="activity-icon" style={{ backgroundColor: bg }}>
                                                                    <span className="material-symbols-outlined" style={{ color }}>{icon}</span>
                                                                </div>
                                                                <div className="activity-content">
                                                                    <p className="activity-text">
                                                                        <span className="activity-user">{item.user}</span> {item.action}
                                                                    </p>
                                                                    <p className="activity-time">{timeAgo(item.createdAt)}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {activity.length === 0 && <p className="activity-empty">{t('projectOverview.updates.noActivity')}</p>}
                                                </div>
                                            </Card>

                                            {showGithubCard && (
                                                <Card className="updates-card span-half">
                                                    <div className="github-card__header">
                                                        <div className="github-card__info">
                                                            <div className="github-card__icon">
                                                                <span className="material-symbols-outlined">terminal</span>
                                                            </div>
                                                            <div className="github-card__text">
                                                                <h3 className="github-card__title">{t('projectOverview.github.title')}</h3>
                                                                <p className="github-card__subtitle">
                                                                    {project.githubRepo || t('projectOverview.github.noRepo')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {project.githubRepo && (
                                                            <a
                                                                href={`https://github.com/${project.githubRepo}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="github-card__link"
                                                            >
                                                                {t('projectOverview.github.repoLink')} <span className="material-symbols-outlined">open_in_new</span>
                                                            </a>
                                                        )}
                                                    </div>

                                                    {!project.githubRepo ? (
                                                        <div className="github-card__empty-state">
                                                            <p>{t('projectOverview.github.noRepoHint')}</p>
                                                            {isOwner && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditModalTab('integrations');
                                                                        setShowEditModal(true);
                                                                    }}
                                                                    className="github-card__settings-btn"
                                                                >
                                                                    {t('projectOverview.github.openSettings')} <span className="material-symbols-outlined">settings</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : commitsLoading ? (
                                                        <div className="github-card__loading">
                                                            <span className="material-symbols-outlined github-card__loading-icon">progress_activity</span>
                                                            {t('projectOverview.github.loading')}
                                                        </div>
                                                    ) : commitsError ? (
                                                        <div className="github-card__error">{commitsError}</div>
                                                    ) : githubCommits.length === 0 ? (
                                                        <div className="github-card__empty">{t('projectOverview.github.none')}</div>
                                                    ) : (
                                                        <div className="github-card__list">
                                                            {githubCommits.map(commit => (
                                                                <a
                                                                    key={commit.sha}
                                                                    href={commit.html_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="github-commit-item"
                                                                >
                                                                    <div className="github-commit__row">
                                                                        <div className="github-commit__meta">
                                                                            {commit.author?.avatar_url ? (
                                                                                <img
                                                                                    src={commit.author.avatar_url}
                                                                                    alt={commit.author.login}
                                                                                    className="github-commit__avatar"
                                                                                />
                                                                            ) : (
                                                                                <div className="github-commit__avatar-fallback">
                                                                                    {(commit.commit.author.name || '?').charAt(0).toUpperCase()}
                                                                                </div>
                                                                            )}
                                                                            <div className="github-commit__details">
                                                                                <p className="github-commit__message">
                                                                                    {commit.commit.message.split(/\r?\n/)[0]}
                                                                                </p>
                                                                                <div className="github-commit__sub">
                                                                                    <span>@{commit.author?.login || commit.commit.author.name || t('projectOverview.github.unknownAuthor')}</span>
                                                                                    <span>•</span>
                                                                                    <span>{format(new Date(commit.commit.author.date), dateFormat, { locale: dateLocale })}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <span className="github-commit__sha">
                                                                            {commit.sha.slice(0, 7)}
                                                                        </span>
                                                                    </div>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </Card>
                                            )}
                                        </div>
                                    </section>

                                    {/* Resources */}
                                    <section className="resources-section">
                                        <div className="section-header-simple">
                                            <h2>{t('projectOverview.resources.title')}</h2>
                                            <span className="subtitle">{t('projectOverview.resources.subtitle')}</span>
                                        </div>
                                        <div className="resources-grid">
                                            <Card className="updates-card">
                                                <div className="resources-card__header">
                                                    <h3 className="resources-card__title">{t('projectOverview.resources.quickLinks')}</h3>
                                                    {isOwner && (
                                                        <Button size="sm" variant="ghost" onClick={() => {
                                                            setEditModalTab('resources');
                                                            setShowEditModal(true);
                                                        }}>
                                                            {t('projectOverview.resources.manage')}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="resources-card__list">
                                                    {project.links?.slice(0, 4).map((link, i) => (
                                                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="resource-link-item">
                                                            <div className="icon-box">
                                                                <span className="material-symbols-outlined">link</span>
                                                            </div>
                                                            <div className="link-info">
                                                                <p className="link-title">{link.title}</p>
                                                                <p className="link-url">{link.url.replace(/^https?:\/\//, '')}</p>
                                                            </div>
                                                            <span className="material-symbols-outlined open-icon">open_in_new</span>
                                                        </a>
                                                    ))}
                                                    {(!project.links || project.links.length === 0) && <p className="resources-card__empty">{t('projectOverview.resources.noLinks')}</p>}
                                                </div>
                                                {project.links && project.links.length > 4 && (
                                                    <p className="resources-card__footer">
                                                        {t('projectOverview.resources.moreLinks').replace('{count}', String(project.links.length - 4))}
                                                    </p>
                                                )}
                                            </Card>

                                            <Card className="updates-card">
                                                <div className="resources-card__header">
                                                    <h3 className="resources-card__title">{t('projectOverview.resources.gallery')}</h3>
                                                    <Button size="sm" variant="ghost" onClick={() => setShowMediaLibrary(true)}>{t('projectOverview.resources.manage')}</Button>
                                                </div>

                                                <div className="gallery-grid">
                                                    {galleryAssets.map((asset) => (
                                                        <div
                                                            key={`${asset.url}-${asset.index}`}
                                                            className="gallery-item"
                                                            onClick={() => { setSelectedImageIndex(asset.index); setShowGalleryModal(true); }}
                                                        >
                                                            <img src={asset.url} alt="" />
                                                        </div>
                                                    ))}
                                                    {projectAssets.length < 3 && (
                                                        <button onClick={() => setShowMediaLibrary(true)} className="add-btn">
                                                            <span className="material-symbols-outlined">add</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </Card>
                                        </div>
                                    </section>
                                </div>

                                <div className="project-overview__sidebar">
                                    <Card data-onboarding-id="project-overview-planning" className="updates-card">
                                        <div className="planning-card__header">
                                            <div className="planning-card__title-wrap">
                                                <div className="planning-card__icon">
                                                    <span className="material-symbols-outlined">schedule</span>
                                                </div>
                                                <h3 className="planning-card__title">{t('projectOverview.planning.title')}</h3>
                                            </div>
                                            {isOwner && (
                                                <button
                                                    onClick={() => {
                                                        setEditModalTab('general');
                                                        setShowEditModal(true);
                                                    }}
                                                    className="icon-btn"
                                                    title={t('projectOverview.planning.editDates')}
                                                >
                                                    <span className="material-symbols-outlined">edit_calendar</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="planning-card__meta">
                                            <span className="planning-card__meta-label">{t('projectOverview.planning.subtitle')}</span>
                                            <span className="planning-card__meta-progress">
                                                <span className="planning-card__dot" />
                                                <span className="planning-card__percent">{progress}%</span>
                                                {t('projectOverview.planning.complete')}
                                            </span>
                                        </div>

                                        <div className="planning-card-content">
                                            <div className="dates-grid">
                                                <div>
                                                    <p className="date-label">{t('projectOverview.planning.start')}</p>
                                                    <p className="date-value">
                                                        {project.startDate ? format(new Date(project.startDate), dateFormat, { locale: dateLocale }) : t('projectOverview.planning.notSet')}
                                                    </p>
                                                </div>
                                                <div className="dates-grid__item dates-grid__item--right">
                                                    <p className="date-label">{t('projectOverview.planning.due')}</p>
                                                    <p className="date-value">
                                                        {project.dueDate ? format(new Date(project.dueDate), dateFormat, { locale: dateLocale }) : t('projectOverview.planning.notSet')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="progress-track">
                                                <div className="progress-bar-planning" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                    </Card>

                                    <Card data-onboarding-id="project-overview-milestones" className="milestones-card">
                                        <div className="milestones-header">
                                            <h3 className="milestones-title">
                                                <span className="material-symbols-outlined milestones-title-icon">flag</span>
                                                {t('projectOverview.milestones.title')}
                                            </h3>
                                            <Link to={`/project/${id}/milestones`} className="icon-btn" aria-label={t('projectOverview.milestones.title')}>
                                                <span className="material-symbols-outlined">arrow_forward</span>
                                            </Link>
                                        </div>

                                        {/* Progress Header */}
                                        <div className="milestone-progress-header">
                                            <div className="milestone-progress">
                                                <div className="milestone-progress-bar">
                                                    <div
                                                        className="milestone-progress-fill"
                                                        style={{ width: `${milestones.length > 0 ? (milestones.filter(m => m.status === 'Achieved').length / milestones.length) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                <div className="milestone-progress-meta">
                                                    <span className="milestone-progress-label">{t('projectOverview.milestones.progress')}</span>
                                                    <span className="milestone-progress-count">{milestones.filter(m => m.status === 'Achieved').length}/{milestones.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="milestone-list">
                                            {/* Vertical Line */}
                                            {pendingMilestones.length > 0 && (
                                                <div className="milestone-line" />
                                            )}

                                            {pendingMilestones.length > 0 ? (
                                                pendingMilestones
                                                    .slice()
                                                    .sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())
                                                    .slice(0, 3)
                                                    .map((milestone, index) => {
                                                        const isFirst = index === 0;
                                                        const isOverdue = milestone.dueDate ? new Date(milestone.dueDate) < new Date() : false;
                                                        return (
                                                            <div key={milestone.id} className="milestone-item">
                                                                <div className={`timeline-dot ${isFirst ? 'is-next' : 'is-future'}`}>
                                                                    {isFirst && <div className="inner-pulse" />}
                                                                </div>

                                                                <div className={`milestone-content ${isFirst ? 'is-primary' : 'is-secondary'}`}>
                                                                    <div className="milestone-row">
                                                                        <div className="milestone-text">
                                                                            <p className={`milestone-title ${isFirst ? 'is-next' : ''}`}>
                                                                                {milestone.title.length > 35 ? milestone.title.substring(0, 35) + '...' : milestone.title}
                                                                            </p>
                                                                            <div className="milestone-meta">
                                                                                <p className={`milestone-date ${isOverdue ? 'is-overdue' : isFirst ? 'is-up-next' : ''}`}>
                                                                                    {milestone.dueDate ? format(new Date(milestone.dueDate), dateFormat, { locale: dateLocale }) : t('projectOverview.milestones.noDate')}
                                                                                </p>
                                                                                {isFirst && (
                                                                                    <span className="milestone-tag">
                                                                                        {t('projectOverview.milestones.nextUp')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {isFirst && (
                                                                            <button
                                                                                onClick={() => handleToggleMilestone(milestone)}
                                                                                className="milestone-action"
                                                                                title={t('projectOverview.milestones.markAchieved')}
                                                                            >
                                                                                <span className="material-symbols-outlined">check</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="milestone-empty">
                                                    <div className="milestone-empty-icon">
                                                        <span className="material-symbols-outlined">emoji_events</span>
                                                    </div>
                                                    <p className="milestone-empty-title">{t('projectOverview.milestones.allAchieved')}</p>
                                                    <p className="milestone-empty-text">{t('projectOverview.milestones.celebrate')}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Background Decoration */}
                                        <div className="bg-decoration">
                                            <span className="material-symbols-outlined bg-decoration-icon">flag</span>
                                        </div>
                                    </Card>

                                    {/* AI Intelligence Card - Compact */}
                                    <div
                                        className="ai-insights-card-compact"
                                        onClick={() => setShowReportModal(true)}
                                    >
                                        <div className="bg-icon">
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                        </div>
                                        <div className="content-wrapper">
                                            <div className="ai-insights__icon">
                                                <span className="material-symbols-outlined">psychology</span>
                                            </div>
                                            <div className="ai-insights__text">
                                                <h3 className="ai-insights__title">{t('projectOverview.aiReport.title')}</h3>
                                                <p className="ai-insights__subtitle">
                                                    {pinnedReport ? t('projectOverview.aiReport.updated').replace('{time}', timeAgo(pinnedReport.createdAt)) : t('projectOverview.aiReport.generateAnalysis')}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined ai-insights__arrow">arrow_forward</span>
                                        </div>
                                    </div>

                                    <Card className="updates-card">
                                        <div className="team-card__header">
                                            <h3 className="team-card__title">
                                                <span className="material-symbols-outlined team-card__title-icon">group</span>
                                                {t('projectOverview.team.title')}
                                                <span className="team-card__count">
                                                    {teamMemberProfiles.length}
                                                </span>
                                            </h3>
                                            <div className="team-card__actions">
                                                {can('canInvite') && (
                                                    <button
                                                        onClick={handleInvite}
                                                        className="icon-btn"
                                                        title={t('projectOverview.team.invite')}
                                                    >
                                                        <span className="material-symbols-outlined">person_add</span>
                                                    </button>
                                                )}
                                                <Link
                                                    to="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setEditModalTab('team');
                                                        setShowEditModal(true);
                                                    }}
                                                    className="icon-btn"
                                                    title={t('projectOverview.team.manage')}
                                                >
                                                    <span className="material-symbols-outlined">settings</span>
                                                </Link>
                                            </div>
                                        </div>

                                        {teamMemberProfiles.length === 0 ? (
                                            <div className="team-empty">
                                                <span className="material-symbols-outlined">person_add</span>
                                                <p>{t('projectOverview.team.empty')}</p>
                                            </div>
                                        ) : (
                                            <div className="team-grid">
                                                {teamMemberProfiles.slice(0, 4).map(member => {
                                                    const presenceData = activeProjectUsers.find(u => u.uid === member.id);
                                                    const isOnline = presenceData?.isOnline || false;

                                                    return (
                                                        <div key={member.id} className="team-member-row">
                                                            <div className="member-avatar">
                                                                {member.photoURL ? (
                                                                    <img
                                                                        src={member.photoURL}
                                                                        alt={member.displayName}
                                                                        className={`member-avatar__image ${isOnline ? 'is-online' : ''}`}
                                                                    />
                                                                ) : (
                                                                    <div className={`avatar-placeholder ${isOnline ? 'is-online' : ''}`}>
                                                                        {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                                                                    </div>
                                                                )}
                                                                {isOnline && (
                                                                    <div className="status-dot" />
                                                                )}
                                                            </div>

                                                            <div className="member-info">
                                                                <div className="row-top">
                                                                    <span className="member-name">
                                                                        {member.displayName}
                                                                    </span>
                                                                    <span
                                                                        style={{
                                                                            backgroundColor: getRoleDisplayInfo(workspaceRoles, member.role).color + '20',
                                                                            color: getRoleDisplayInfo(workspaceRoles, member.role).color,
                                                                            borderColor: getRoleDisplayInfo(workspaceRoles, member.role).color + '40'
                                                                        }}
                                                                        className="member-role-badge"
                                                                    >
                                                                        {getRoleDisplayInfo(workspaceRoles, member.role).name}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {teamMemberProfiles.length > 4 && (
                                                    <button
                                                        onClick={() => { setEditModalTab('team'); setShowEditModal(true); }}
                                                        className="view-all-btn"
                                                    >
                                                        <div className="view-all-avatars">
                                                            {teamMemberProfiles.slice(4, 7).map(m => (
                                                                <div key={m.id} className="view-all-avatar">
                                                                    {m.photoURL ? (
                                                                        <img src={m.photoURL} alt="" className="view-all-avatar__image" />
                                                                    ) : (
                                                                        <div className="view-all-avatar__fallback">{m.displayName?.charAt(0)}</div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {t('common.andXOthers', '+ {count} others').replace('{count}', (teamMemberProfiles.length - 4).toString())}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </Card>

                                    {isOwner && (
                                        <Card className="updates-card">
                                            <div className="controls-card__header">
                                                <span className="material-symbols-outlined controls-card__icon">tune</span>
                                                <h3 className="controls-card__title">{t('projectOverview.controls.title')}</h3>
                                            </div>
                                            <div className="controls-form">
                                                <div className="form-group-row">
                                                    <Select
                                                        label={t('projectOverview.controls.status')}
                                                        value={project.status}
                                                        options={statusOptions}
                                                        onChange={(value) => handleUpdateField('status', value)}
                                                        className="project-overview__select"
                                                    />

                                                    <Select
                                                        label={t('projectOverview.controls.priority')}
                                                        value={project.priority || 'Medium'}
                                                        options={priorityOptions}
                                                        onChange={(value) => handleUpdateField('priority', value)}
                                                        className="project-overview__select"
                                                    />
                                                </div>

                                                <div>
                                                    <Select
                                                        label={t('projectOverview.controls.projectState')}
                                                        value={project.projectState || 'not specified'}
                                                        options={projectStateOptions}
                                                        onChange={(value) => handleUpdateField('projectState', value)}
                                                        className="project-overview__select"
                                                    />
                                                </div>

                                                <div className="date-inputs">
                                                    <DatePicker
                                                        label={t('projectOverview.planning.start')}
                                                        value={toDateValue(project.startDate)}
                                                        onChange={(date) => handleUpdateField('startDate', toDateString(date))}
                                                        placeholder={t('projectOverview.controls.startPlaceholder')}
                                                    />
                                                    <DatePicker
                                                        label={t('projectOverview.planning.due')}
                                                        value={toDateValue(project.dueDate)}
                                                        onChange={(date) => handleUpdateField('dueDate', toDateString(date))}
                                                        placeholder={t('projectOverview.controls.duePlaceholder')}
                                                    />
                                                </div>
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            </div>




                            {/* Gallery Modal */}
                            <Modal isOpen={showGalleryModal} onClose={() => setShowGalleryModal(false)} title={t('projectOverview.gallery.title')} size="xl">
                                <div className="gallery-viewer">
                                    <div className="main-view">
                                        {projectAssets[selectedImageIndex] ? (
                                            <>
                                                <img src={projectAssets[selectedImageIndex]} alt={t('projectOverview.gallery.imageAlt')} />
                                                {selectedImageIndex > 0 && (
                                                    <button
                                                        className="nav-btn prev"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex - 1); }}
                                                    >
                                                        <span className="material-symbols-outlined">chevron_left</span>
                                                    </button>
                                                )}
                                                {selectedImageIndex < projectAssets.length - 1 && (
                                                    <button
                                                        className="nav-btn next"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex + 1); }}
                                                    >
                                                        <span className="material-symbols-outlined">chevron_right</span>
                                                    </button>
                                                )}
                                            </>
                                        ) : (
                                            <p className="empty-text">{t('projectOverview.gallery.empty')}</p>
                                        )}
                                    </div>
                                    <div className="thumbnails">
                                        {projectAssets.map((shot, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setSelectedImageIndex(idx)}
                                                className={`thumb-btn ${selectedImageIndex === idx ? 'active' : ''}`}
                                            >
                                                <img src={shot} alt="" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </Modal>

                            {/* Media Library Modal */}
                            {
                                project && (
                                    <MediaLibrary
                                        isOpen={showMediaLibrary}
                                        onClose={() => {
                                            setShowMediaLibrary(false);
                                            if (mediaPickerTarget === 'gallery') {
                                                fetchProjectAssets(); // Refresh assets if managing gallery
                                            }
                                            setMediaPickerTarget('gallery'); // Reset target
                                        }}
                                        projectId={project.id}
                                        tenantId={project.tenantId}
                                        onSelect={(asset) => {
                                            if (mediaPickerTarget === 'cover') {
                                                void handleUpdateField('coverImage', asset.url);
                                                setCoverRemoved(false);
                                                setShowMediaLibrary(false);
                                                setMediaPickerTarget('gallery');
                                            } else if (mediaPickerTarget === 'icon') {
                                                void handleUpdateField('squareIcon', asset.url);
                                                setIconRemoved(false);
                                                setShowMediaLibrary(false);
                                                setMediaPickerTarget('gallery');
                                            }
                                        }}
                                    />
                                )
                            }

                            {
                                project && (
                                    <ProjectEditModal
                                        isOpen={showEditModal}
                                        onClose={() => {
                                            setShowEditModal(false);
                                            setEditModalTab('general'); // Reset to default on close
                                        }}
                                        project={project}
                                        onSave={handleSaveEdit}
                                        initialTab={editModalTab}
                                    />
                                )
                            }

                            {/* Delete Modal */}
                            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title={t('projectOverview.delete.title')}
                                footer={
                                    <>
                                        <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>{t('projectOverview.delete.cancel')}</Button>
                                        <Button variant="danger" onClick={handleDeleteProject} isLoading={deletingProject}>{t('projectOverview.delete.confirm')}</Button>
                                    </>
                                }
                            >
                                <p className="delete-modal__text">
                                    {t('projectOverview.delete.description').replace('{project}', project.title)}
                                </p>
                            </Modal>

                            {
                                showTaskModal && can('canManageTasks') && (
                                    <TaskCreateModal
                                        projectId={id!}
                                        tenantId={project?.tenantId}
                                        onClose={() => setShowTaskModal(false)}
                                        onCreated={() => {
                                            // Task subscription will handle update
                                            setShowTaskModal(false);
                                        }}
                                    />
                                )
                            }

                            {
                                showInviteModal && project && can('canInvite') && (
                                    <InviteMemberModal
                                        isOpen={showInviteModal}
                                        onClose={() => setShowInviteModal(false)}
                                        projectTitle={project.title}
                                        customRoles={workspaceRoles}
                                        onGenerateLink={async (role: ProjectRole, maxUses?: number, expiresInHours?: number) => {
                                            return await generateInviteLink(id || '', role, maxUses, expiresInHours, project.tenantId);
                                        }}
                                        onSendEmail={async (email, role) => {
                                            await sendTeamInvitation(email, 'project', id || '', role, project.tenantId);
                                        }}
                                    />
                                )
                            }

                            {/* Health Detail Modal */}
                            <HealthDetailModal
                                isOpen={showHealthModal}
                                onClose={() => setShowHealthModal(false)}
                                health={health}
                                tasks={tasks}
                                milestones={milestones}
                                issues={issues}
                                projectTitle={project.title}
                            />


                            {/* Report Modal */}
                            <ProjectReportModal
                                isOpen={showReportModal}
                                onClose={() => setShowReportModal(false)}
                                report={report || (pinnedReport?.content || null)}
                                isLoading={reportLoading}
                                onGenerate={handleGenerateReport}
                                lastUpdated={pinnedReport?.createdAt?.toDate ? pinnedReport.createdAt.toDate() : undefined}
                            />

                            <OnboardingOverlay
                                isOpen={onboardingActive}
                                steps={onboardingSteps}
                                stepIndex={stepIndex}
                                onStepChange={setStepIndex}
                                onFinish={finish}
                                onSkip={skip}
                            />
                        </>
                    )
                }
            </div >
        </>
    );
};
