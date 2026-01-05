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
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
// import { Checkbox } from '../components/ui/Checkbox'; // Removed
import { fetchLastCommits, GithubCommit } from '../services/githubService';
import { getUserProfile, subscribeProjectMilestones, updateMilestone } from '../services/dataService';
import { subscribeProjectGroups } from '../services/projectGroupService';
import { calculateProjectHealth } from '../services/healthService';
import { HealthIndicator } from '../components/project/HealthIndicator';
import { HealthDetailModal } from '../components/project/HealthDetailModal';
import { getHealthFactorText } from '../utils/healthLocalization';
import { ProjectEditModal, Tab } from '../components/project/ProjectEditModal';
import { ProjectReportModal } from '../components/project/ProjectReportModal';
import { TYPE_COLORS } from '../components/flows/constants';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { ProjectMindmap } from '../components/mindmap/ProjectMindmap';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');



const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        return { icon: 'add_task', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
    }
    if (type === 'issue') {
        if (action.includes('resolved') || action.includes('closed')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        return { icon: 'bug_report', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    }
    if (type === 'status') return { icon: 'swap_horiz', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' };
    if (type === 'report') return { icon: 'auto_awesome', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-500/10' };
    if (type === 'comment') return { icon: 'chat_bubble', color: 'text-amber-600', bg: 'bg-amber-100' };
    if (type === 'file') return { icon: 'attach_file', color: 'text-slate-600', bg: 'bg-slate-100' };
    if (type === 'member') return { icon: 'person_add', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
    if (type === 'commit') return { icon: 'code', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (type === 'priority') return { icon: 'priority_high', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
    return { icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-700/50' };
};

const getModuleIcon = (name: string) => {
    if (name === 'tasks') return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' };
    if (name === 'ideas') return { icon: 'lightbulb', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' };
    if (name === 'mindmap') return { icon: 'hub', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' };
    if (name === 'issues') return { icon: 'bug_report', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' };
    if (name === 'social') return { icon: 'campaign', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10' };
    if (name === 'marketing') return { icon: 'ads_click', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' };
    if (name === 'sprints') return { icon: 'directions_run', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10' };
    if (name === 'activity') return { icon: 'history', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' };
    return { icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-[var(--color-surface-hover)]' };
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
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">progress_activity</span>
        </div>
    );

    if (unauthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="size-24 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-5xl text-rose-500">lock</span>
                </div>
                <h1 className="text-3xl font-bold text-[var(--color-text-main)] mb-2">{t('projectOverview.unauthorized.title')}</h1>
                <p className="text-[var(--color-text-muted)] max-w-md mb-8">
                    {t('projectOverview.unauthorized.description')}
                </p>
                <Link to="/projects">
                    <Button variant="primary" icon={<span className="material-symbols-outlined">arrow_back</span>}>
                        {t('projectOverview.unauthorized.back')}
                    </Button>
                </Link>
            </div>
        );
    }

    if (!project) return <div className="p-8">{t('projectOverview.error.notFound')}</div>;

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


    return (
        <>
            <div className="project-overview-container">


                {/* PROFILE BANNER LAYOUT */}
                <div data-onboarding-id="project-overview-header" className="project-header-card group/header">

                    {/* 1. Cover Image Banner */}
                    <div
                        className={`cover-section group/cover ${!project.coverImage ? 'no-image' : 'has-image'}`}
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
                                    className="bg-white/80 backdrop-blur text-black hover:bg-white shadow-sm border-none"
                                    icon={<span className="material-symbols-outlined text-[18px]">photo_camera</span>}
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
                            <div className="icon-container group/icon">
                                <div className="icon-frame">
                                    <div className={`icon-inner ${project.squareIcon ? 'with-image' : 'no-image'}`} onClick={() => { if (isOwner) { setMediaPickerTarget('icon'); setShowMediaLibrary(true); } }}>
                                        {project.squareIcon ? (
                                            <img src={project.squareIcon} alt="" />
                                        ) : (
                                            <span className="bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">{project.title.charAt(0)}</span>
                                        )}
                                    </div>
                                </div>
                                {isOwner && (
                                    <div className="edit-overlay">
                                        <span className="material-symbols-outlined text-white">edit</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Left: Text Info */}
                        <div className="info-section">
                            <div>
                                <div className="title-row">
                                    <h1>{project.title}</h1>
                                    <Badge variant={project.status === 'Active' ? 'success' : 'primary'}>
                                        {projectStatusLabels[project.status as keyof typeof projectStatusLabels] || project.status}
                                    </Badge>
                                </div>
                                <div className="description-area group/desc">
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
                                    <span className="material-symbols-outlined text-[16px]">grid_view</span>
                                    <span>{t('nav.overview')}</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('mindmap')}
                                    className={viewMode === 'mindmap' ? 'active' : ''}
                                >
                                    <span className="material-symbols-outlined text-[16px]">hub</span>
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
                                    className={pinnedProjectId === project.id ? 'text-amber-500 hover:text-amber-600' : ''}
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
                            <span className="material-symbols-outlined text-[var(--color-primary)] icon">speed</span>
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
                        <div className="metric-item group relative cursor-help">
                            <span className="material-symbols-outlined text-green-500 icon">task_alt</span>
                            <div className="content">
                                <div className="main-value">
                                    {completedTasksWithSubtasks} / {totalTasksWithSubtasks}
                                </div>
                                <span className="sub-label">{t('projectOverview.metrics.tasksDone')}</span>
                            </div>

                            {/* Floating Hover Card (Keeping inline styles for complex layout specific to this popup not fully covered by general SCSS yet) */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] z-50 w-72 pointer-events-none group-hover:pointer-events-auto">
                                <div className="relative opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 ease-out origin-top shadow-2xl rounded-2xl">
                                    {/* Container */}
                                    <div className="bg-white dark:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5">
                                        {/* Header */}
                                        <div className="px-5 py-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]/30 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">donut_small</span>
                                                <span className="text-xs font-bold text-[var(--color-text-main)]">{t('projectOverview.metrics.composition')}</span>
                                            </div>
                                            <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
                                                {t('projectOverview.metrics.totalCompleted')}
                                            </span>
                                        </div>
                                        {/* Body */}
                                        <div className="p-5 space-y-5">
                                            {/* Visual Bar */}
                                            <div className="space-y-2">
                                                <div className="flex w-full h-3 bg-[var(--color-surface-hover)] rounded-full overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-300 relative group/segment"
                                                        style={{ width: `${taskCompletionShare}%` }}
                                                    >
                                                        {taskCompletionShare > 10 && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/90">{taskCompletionShare}%</span>}
                                                    </div>
                                                    <div
                                                        className="h-full bg-sky-500 transition-all duration-300 relative group/segment"
                                                        style={{ width: `${subtaskCompletionShare}%` }}
                                                    >
                                                        {subtaskCompletionShare > 10 && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/90">{subtaskCompletionShare}%</span>}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] px-0.5">
                                                    <span>{t('projectOverview.metrics.tasks')}</span>
                                                    <span>{t('projectOverview.metrics.subtasks')}</span>
                                                </div>
                                            </div>
                                            {/* Detailed grid */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-surface-hover)]/50 border border-[var(--color-surface-border)] transition-colors hover:bg-[var(--color-surface-hover)]">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="size-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{t('projectOverview.metrics.mainTasks')}</span>
                                                    </div>
                                                    <div className="text-xl font-bold text-[var(--color-text-main)] mt-1 tabular-nums tracking-tight">
                                                        {completedTasks} <span className="text-sm font-medium text-[var(--color-text-muted)]">/ {tasks.length}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-surface-hover)]/50 border border-[var(--color-surface-border)] transition-colors hover:bg-[var(--color-surface-hover)]">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="size-2 rounded-full bg-sky-500 shadow-sm shadow-sky-500/20"></div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{t('projectOverview.metrics.subtasksLabel')}</span>
                                                    </div>
                                                    <div className="text-xl font-bold text-[var(--color-text-main)] mt-1 tabular-nums tracking-tight">
                                                        {subtaskTotals.done} <span className="text-sm font-medium text-[var(--color-text-muted)]">/ {subtaskTotals.total}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Priority */}
                        <div className="metric-item">
                            <span className={`material-symbols-outlined icon ${project.priority === 'High' ? 'text-rose-500' :
                                project.priority === 'Medium' ? 'text-amber-500' : 'text-blue-500'
                                }`}>flag</span>
                            <div className="content">
                                <div className={`main-value ${project.priority === 'High' ? 'text-rose-600 dark:text-rose-400' :
                                    project.priority === 'Medium' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                                    }`}>
                                    {project.priority ? (priorityLabels[project.priority] || project.priority) : t('tasks.priority.medium')}
                                </div>
                                <span className="sub-label">{t('projectOverview.metrics.priority')}</span>
                            </div>
                        </div>

                        {/* 4. Next Sprint */}
                        <div className="metric-item">
                            <span className="material-symbols-outlined text-orange-500 icon">directions_run</span>
                            <div className="content">
                                <div className="main-value">
                                    {nextSprint ? nextSprint.name : t('None', 'None')}
                                </div>
                                <span className="sub-label">{t('Next Sprint', 'Next Sprint')}</span>
                            </div>
                        </div>

                        {/* 5. Next Deadline */}
                        <div className="metric-item">
                            <span className="material-symbols-outlined text-indigo-500 icon">event_upcoming</span>
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
                    <div className="md:hidden px-6 pb-6 pt-0">
                        <div className="flex bg-[var(--color-surface-hover)] p-0.5 rounded-lg border border-[var(--color-surface-border)] w-full">
                            <button
                                onClick={() => setViewMode('overview')}
                                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'overview' ? 'bg-white dark:bg-slate-700 shadow-sm text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">grid_view</span>
                                <span>{t('nav.overview')}</span>
                            </button>
                            <button
                                onClick={() => setViewMode('mindmap')}
                                className={`flex-1 px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${viewMode === 'mindmap' ? 'bg-white dark:bg-slate-700 shadow-sm text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">hub</span>
                                <span>{t('nav.mindmap')}</span>
                            </button>
                        </div>
                    </div>

                </div>

                {
                    viewMode === 'mindmap' ? (
                        <div className="w-full h-[calc(100vh-340px)] min-h-[600px] animate-fade-in">
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
                                            <Card className="widget-card hover-effect">
                                                <div className="card-header">
                                                    <h3 className="title">
                                                        <span className="material-symbols-outlined icon">query_stats</span>
                                                        {t('projectOverview.snapshot.health.title')}
                                                    </h3>
                                                    <button onClick={() => setShowHealthModal(true)} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </button>
                                                </div>
                                                <div className="health-content">
                                                    <HealthIndicator health={health} size="md" showLabel={false} onOpenDetail={() => setShowHealthModal(true)} />
                                                    <div>
                                                        <div className={`status-text ${health.status}`}>
                                                            {healthStatusLabels[health.status] || health.status}
                                                        </div>
                                                        <div className="score-label">{t('projectOverview.snapshot.health.score')}</div>
                                                    </div>
                                                </div>
                                                <div className="risks-section">
                                                    <p className="label">{t('projectOverview.snapshot.health.topRisks')}</p>
                                                    {health.factors.filter(f => f.type === 'negative').length > 0 ? (
                                                        <ul className="risks-list">
                                                            {health.factors.filter(f => f.type === 'negative').slice(0, 2).map((factor) => {
                                                                const { label } = getHealthFactorText(factor, t);
                                                                return (
                                                                    <li key={factor.id}>
                                                                        <span className="dot">●</span>
                                                                        <span className="text">{label}</span>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p className="no-risks">
                                                            <span className="material-symbols-outlined">check_circle</span>
                                                            {t('projectOverview.snapshot.health.noRisks')}
                                                        </p>
                                                    )}
                                                </div>
                                            </Card>

                                            <Card className="widget-card hover-effect">
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

                                            <Card className="widget-card hover-effect">
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
                                                                <span className="user-name">{activity[0].user}</span> {activity[0].action}
                                                                <span className="time">{timeAgo(activity[0].createdAt)}</span>
                                                            </>
                                                        )
                                                        : t('projectOverview.snapshot.activity.empty')}
                                                </div>
                                            </Card>

                                            <Card className="widget-card hover-effect">
                                                <div className="card-header">
                                                    <h3 className="title">
                                                        <span className="material-symbols-outlined icon">event_upcoming</span>
                                                        {t('projectOverview.snapshot.upcoming.title')}
                                                    </h3>
                                                    <Link to={`/project/${id}/tasks`} className="header-action-btn">
                                                        <span className="material-symbols-outlined">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="upcoming-content">
                                                    {upcomingDeadlines.length === 0 ? (
                                                        <p className="empty-text">{t('projectOverview.snapshot.upcoming.empty')}</p>
                                                    ) : (
                                                        upcomingDeadlines.slice(0, 2).map(task => (
                                                            <div key={task.id} className="upcoming-task-row">
                                                                <div className="task-info">
                                                                    <p className="task-title">{task.title}</p>
                                                                    <p className="task-meta">
                                                                        {task.priority ? (priorityLabels[task.priority] || task.priority) : t('projectOverview.snapshot.upcoming.priorityNotSet')}
                                                                    </p>
                                                                </div>
                                                                <span className="task-date">
                                                                    {format(new Date(task.dueDate!), dateFormat, { locale: dateLocale })}
                                                                </span>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                {upcomingDeadlines.length > 2 && (
                                                    <p className="more-count">
                                                        {t('projectOverview.snapshot.upcoming.moreTasks').replace('{count}', String(upcomingDeadlines.length - 2))}
                                                    </p>
                                                )}
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
                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            <Card className={`widget-card hover-effect ${executionSideCards === 0 ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
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
                                                                className="list-row group"
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
                                                <div className={`lg:col-span-1 grid grid-cols-1 gap-6 ${executionSideCards > 1 ? 'lg:grid-rows-2 lg:auto-rows-fr' : ''}`}>
                                                    {showIdeaCard && (
                                                        <Card className={`widget-card hover-effect ${executionSideCards > 1 ? 'lg:h-full' : ''}`}>
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
                                                                const typeColor = TYPE_COLORS[topIdea.type] || TYPE_COLORS['default'] || 'bg-slate-100 text-slate-600';
                                                                return (
                                                                    <Link
                                                                        to={`/project/${id}/flows/${topIdea.id}`}
                                                                        className="flow-spotlight-card group"
                                                                    >
                                                                        {/* Type Badge Row */}
                                                                        <div className="flow-meta">
                                                                            <span className={`type-badge ${typeColor}`}>
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
                                                        <Card className={`widget-card hover-effect ${executionSideCards > 1 ? 'lg:h-full' : ''}`}>
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
                                                                            className="list-row group"
                                                                        >
                                                                            <div className="row-content">
                                                                                <p className="row-title max-w">{issue.title}</p>
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
                                            <div className="mt-6">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[16px] text-indigo-500">rocket_launch</span>
                                                        {t('projectOverview.initiatives.title')}
                                                        <span className="text-xs font-medium text-[var(--color-text-muted)]">({initiatives.length})</span>
                                                    </h3>
                                                    <Link to={`/project/${id}/tasks`} className="size-7 flex items-center justify-center rounded-md transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95">
                                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                                    </Link>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                                        const status = initiative.status?.toLowerCase() || '';
                                                        const isInProgress = status === 'in progress' || status === 'inprogress';
                                                        const isReview = status === 'review' || status === 'in review';
                                                        const isBlocked = status === 'blocked';

                                                        let statusClass = '';
                                                        if (isBlocked) statusClass = 'status-blocked';
                                                        else if (isInProgress) statusClass = 'status-active';
                                                        else if (isReview) statusClass = 'status-review';

                                                        const priorityLower = initiative.priority?.toLowerCase();
                                                        const priorityClass = priorityLower === 'urgent' ? 'priority-urgent' :
                                                            priorityLower === 'high' ? 'priority-high' :
                                                                priorityLower === 'medium' ? 'priority-medium' : 'priority-low';

                                                        return (
                                                            <div
                                                                key={initiative.id}
                                                                onClick={() => navigate(`/project/${id}/tasks/${initiative.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                                                className={`initiative-card group ${statusClass}`}
                                                            >
                                                                {/* Priority indicator */}
                                                                <div className={`initiative-priority-indicator ${priorityClass}`} />

                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <h4 className="text-sm font-semibold text-[var(--color-text-main)] line-clamp-2 leading-tight">
                                                                        {initiative.title}
                                                                    </h4>
                                                                    <span className="material-symbols-outlined text-[14px] text-indigo-500 shrink-0">rocket_launch</span>
                                                                </div>

                                                                {/* Description */}
                                                                {initiative.description && (
                                                                    <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-2 mb-3">
                                                                        {initiative.description}
                                                                    </p>
                                                                )}

                                                                {/* Status & Priority Row */}
                                                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                                    {initiative.status && (
                                                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10">
                                                                            {taskStatusLabels[initiative.status] || initiative.status}
                                                                        </div>
                                                                    )}
                                                                    {initiative.priority && (
                                                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
                                                                            ${initiative.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                                                initiative.priority === 'High' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                                    initiative.priority === 'Medium' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'}
                                                                        `}>
                                                                            <span className="material-symbols-outlined text-[10px]">
                                                                                {initiative.priority === 'Urgent' ? 'error' :
                                                                                    initiative.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                                                        initiative.priority === 'Medium' ? 'drag_handle' : 'keyboard_arrow_down'}
                                                                            </span>
                                                                            {priorityLabels[initiative.priority] || initiative.priority}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Assignees */}
                                                                {initiative.assignedGroupIds && initiative.assignedGroupIds.length > 0 && (
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                                            {initiative.assignedGroupIds.slice(0, 3).map(gid => {
                                                                                const group = projectGroups.find(g => g.id === gid);
                                                                                if (!group) return null;
                                                                                return (
                                                                                    <div
                                                                                        key={gid}
                                                                                        className="size-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-[#1E1E1E]"
                                                                                        style={{ backgroundColor: group.color }}
                                                                                        title={group.name}
                                                                                    >
                                                                                        {group.name.substring(0, 1).toUpperCase()}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        {initiative.assignedGroupIds.length > 3 && (
                                                                            <span className="text-[10px] text-[var(--color-text-muted)]">+{initiative.assignedGroupIds.length - 3}</span>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Subtask progress if available */}
                                                                {subtaskStats[initiative.id]?.total > 0 && (
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <span className="material-symbols-outlined text-[12px] text-[var(--color-text-muted)]">checklist</span>
                                                                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-indigo-500 rounded-full transition-all"
                                                                                style={{ width: `${(subtaskStats[initiative.id].done / subtaskStats[initiative.id].total) * 100}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                                                                            {subtaskStats[initiative.id].done}/{subtaskStats[initiative.id].total}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Timeline */}
                                                                {hasStart && hasDue && (
                                                                    <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-text-muted)]">
                                                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                                        <span className="font-semibold">{format(new Date(initiative.startDate!), dateFormat, { locale: dateLocale })}</span>
                                                                        <div className="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={`h-full rounded-full ${isOverdue ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                                                style={{ width: `${pct}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className={`font-semibold ${isOverdue ? 'text-rose-500' : ''}`}>
                                                                            {format(dueDate!, dateFormat, { locale: dateLocale })}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                {/* Due Date Only */}
                                                                {!hasStart && hasDue && (
                                                                    <div className={`flex items-center gap-1.5 text-[9px] ${isOverdue ? 'text-rose-500 font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                                                                        <span className="material-symbols-outlined text-[12px] fill-current">event</span>
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
                                    <section className="space-y-3">
                                        <div className="section-header-simple">
                                            <h2>{t('projectOverview.updates.title')}</h2>
                                            <span className="subtitle">{t('projectOverview.updates.subtitle')}</span>
                                        </div>
                                        <div className="updates-grid">
                                            <Card className={`updates-card ${showGithubCard ? 'span-half' : 'span-full'}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-slate-500">history</span>
                                                        {t('projectOverview.updates.latestActivity')}
                                                    </h3>
                                                    <Link to={`/project/${id}/activity`} className="size-7 flex items-center justify-center rounded-md transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95">
                                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                                    </Link>
                                                </div>

                                                <div className="activity-list space-y-5">
                                                    {activity.slice(0, 6).map((item) => {
                                                        const { icon, color, bg } = activityIcon(item.type, item.action);
                                                        return (
                                                            <div key={item.id} className="activity-item">
                                                                <div className={`absolute left-0 top-0 size-8 rounded-full border-2 border-white dark:border-[var(--color-surface-card)] ${bg} z-10 flex items-center justify-center`}>
                                                                    <span className={`material-symbols-outlined text-[16px] ${color}`}>{icon}</span>
                                                                </div>
                                                                <div className="space-y-0.5 pt-0.5">
                                                                    <p className="text-xs text-[var(--color-text-main)] leading-snug">
                                                                        <span className="font-semibold">{item.user}</span> {item.action}
                                                                    </p>
                                                                    <p className="text-[10px] text-[var(--color-text-muted)]">{timeAgo(item.createdAt)}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {activity.length === 0 && <p className="text-xs text-[var(--color-text-muted)] pl-2">{t('projectOverview.updates.noActivity')}</p>}
                                                </div>
                                            </Card>

                                            {showGithubCard && (
                                                <Card className="updates-card span-half">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                                                <span className="material-symbols-outlined text-xl">terminal</span>
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h3 className="font-bold text-[var(--color-text-main)] truncate">{t('projectOverview.github.title')}</h3>
                                                                <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-tight line-clamp-1">
                                                                    {project.githubRepo || t('projectOverview.github.noRepo')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {project.githubRepo && (
                                                            <a
                                                                href={`https://github.com/${project.githubRepo}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 shrink-0"
                                                            >
                                                                {t('projectOverview.github.repoLink')} <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                            </a>
                                                        )}
                                                    </div>

                                                    {!project.githubRepo ? (
                                                        <div className="text-xs text-[var(--color-text-muted)] space-y-3">
                                                            <p>{t('projectOverview.github.noRepoHint')}</p>
                                                            {isOwner && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditModalTab('integrations');
                                                                        setShowEditModal(true);
                                                                    }}
                                                                    className="inline-flex items-center gap-1 text-[var(--color-primary)] font-semibold hover:underline"
                                                                >
                                                                    {t('projectOverview.github.openSettings')} <span className="material-symbols-outlined text-sm">settings</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : commitsLoading ? (
                                                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                                                            <span className="material-symbols-outlined animate-spin text-[14px] text-[var(--color-primary)]">progress_activity</span>
                                                            {t('projectOverview.github.loading')}
                                                        </div>
                                                    ) : commitsError ? (
                                                        <div className="text-xs text-rose-600 dark:text-rose-400">{commitsError}</div>
                                                    ) : githubCommits.length === 0 ? (
                                                        <div className="text-xs text-[var(--color-text-muted)]">{t('projectOverview.github.none')}</div>
                                                    ) : (
                                                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                                                            {githubCommits.map(commit => (
                                                                <a
                                                                    key={commit.sha}
                                                                    href={commit.html_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="github-commit-item"
                                                                >
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="flex items-start gap-2 min-w-0">
                                                                            {commit.author?.avatar_url ? (
                                                                                <img
                                                                                    src={commit.author.avatar_url}
                                                                                    alt={commit.author.login}
                                                                                    className="size-7 rounded-full border border-[var(--color-surface-border)]"
                                                                                />
                                                                            ) : (
                                                                                <div className="size-7 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] flex items-center justify-center text-[10px] font-bold">
                                                                                    {(commit.commit.author.name || '?').charAt(0).toUpperCase()}
                                                                                </div>
                                                                            )}
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-semibold text-[var(--color-text-main)] line-clamp-1">
                                                                                    {commit.commit.message.split(/\r?\n/)[0]}
                                                                                </p>
                                                                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                                                                                    <span>@{commit.author?.login || commit.commit.author.name || t('projectOverview.github.unknownAuthor')}</span>
                                                                                    <span>•</span>
                                                                                    <span>{format(new Date(commit.commit.author.date), dateFormat, { locale: dateLocale })}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <span className="text-[10px] font-mono text-[var(--color-text-subtle)] shrink-0">
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
                                    <section className="space-y-3">
                                        <div className="section-header-simple">
                                            <h2>{t('projectOverview.resources.title')}</h2>
                                            <span className="subtitle">{t('projectOverview.resources.subtitle')}</span>
                                        </div>
                                        <div className="resources-grid">
                                            <Card className="updates-card">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('projectOverview.resources.quickLinks')}</h3>
                                                    {isOwner && (
                                                        <Button size="sm" variant="ghost" onClick={() => {
                                                            setEditModalTab('resources');
                                                            setShowEditModal(true);
                                                        }}>
                                                            {t('projectOverview.resources.manage')}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="mt-4 space-y-2 flex-1">
                                                    {project.links?.slice(0, 4).map((link, i) => (
                                                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="resource-link-item group">
                                                            <div className="icon-box">
                                                                <span className="material-symbols-outlined text-[18px]">link</span>
                                                            </div>
                                                            <div className="link-info">
                                                                <p className="link-title">{link.title}</p>
                                                                <p className="link-url">{link.url.replace(/^https?:\/\//, '')}</p>
                                                            </div>
                                                            <span className="material-symbols-outlined open-icon">open_in_new</span>
                                                        </a>
                                                    ))}
                                                    {(!project.links || project.links.length === 0) && <p className="text-sm text-[var(--color-text-muted)]">{t('projectOverview.resources.noLinks')}</p>}
                                                </div>
                                                {project.links && project.links.length > 4 && (
                                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                                                        {t('projectOverview.resources.moreLinks').replace('{count}', String(project.links.length - 4))}
                                                    </p>
                                                )}
                                            </Card>

                                            <Card className="updates-card">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('projectOverview.resources.gallery')}</h3>
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

                                <div className="xl:col-span-1 space-y-6">
                                    <Card data-onboarding-id="project-overview-planning" className="updates-card">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                                                </div>
                                                <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('projectOverview.planning.title')}</h3>
                                            </div>
                                            {isOwner && (
                                                <button
                                                    onClick={() => {
                                                        setEditModalTab('general');
                                                        setShowEditModal(true);
                                                    }}
                                                    className="size-7 flex items-center justify-center rounded-md transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95"
                                                    title={t('projectOverview.planning.editDates')}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit_calendar</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                            <span>{t('projectOverview.planning.subtitle')}</span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="size-1.5 rounded-full bg-[var(--color-primary)]" />
                                                <span className="text-[var(--color-text-main)]">{progress}%</span>
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
                                                <div className="text-right">
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
                                        <div className="flex items-center justify-between mb-2 z-10 relative">
                                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[var(--color-text-subtle)]">flag</span>
                                                {t('projectOverview.milestones.title')}
                                            </h3>
                                            <Link to={`/project/${id}/milestones`} className="size-7 flex items-center justify-center rounded-md transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95">
                                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                            </Link>
                                        </div>

                                        {/* Progress Header */}
                                        <div className="milestone-progress-header">
                                            <div className="flex-1">
                                                <div className="h-1 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${milestones.length > 0 ? (milestones.filter(m => m.status === 'Achieved').length / milestones.length) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{t('projectOverview.milestones.progress')}</span>
                                                    <span className="text-[10px] font-bold text-[var(--color-text-main)]">{milestones.filter(m => m.status === 'Achieved').length}/{milestones.length}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 flex-1 relative z-10">
                                            {/* Vertical Line */}
                                            {pendingMilestones.length > 0 && (
                                                <div className="absolute left-[11px] top-2 bottom-4 w-0.5 bg-[var(--color-surface-border)]" />
                                            )}

                                            {pendingMilestones.length > 0 ? (
                                                pendingMilestones
                                                    .slice()
                                                    .sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())
                                                    .slice(0, 3)
                                                    .map((milestone, index) => {
                                                        const isFirst = index === 0;
                                                        return (
                                                            <div key={milestone.id} className="milestone-item group">
                                                                <div className={`timeline-dot ${isFirst ? 'is-next' : 'is-future'}`}>
                                                                    {isFirst && <div className="inner-pulse" />}
                                                                </div>

                                                                <div className={`flex-1 min-w-0 transition-all ${isFirst ? '' : 'opacity-80 group-hover:opacity-100'}`}>
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="min-w-0">
                                                                            <p className={`text-xs font-bold truncate leading-snug ${isFirst ? 'text-[var(--color-text-main)] text-[13px] mb-0.5' : 'text-[var(--color-text-main)]'}`}>
                                                                                {milestone.title}
                                                                            </p>
                                                                            <div className="flex items-center gap-2">
                                                                                <p className={`text-[10px] font-medium ${new Date(milestone.dueDate || '') < new Date()
                                                                                    ? 'text-rose-500 font-bold'
                                                                                    : isFirst ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--color-text-muted)]'
                                                                                    }`}>
                                                                                    {milestone.dueDate ? format(new Date(milestone.dueDate), dateFormat, { locale: dateLocale }) : t('projectOverview.milestones.noDate')}
                                                                                </p>
                                                                                {isFirst && (
                                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-1.5 py-px rounded">
                                                                                        {t('projectOverview.milestones.nextUp')}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {isFirst && (
                                                                            <button
                                                                                onClick={() => handleToggleMilestone(milestone)}
                                                                                className="size-7 rounded-lg bg-[var(--color-surface-hover)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[var(--color-text-muted)] hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition-all shrink-0"
                                                                                title={t('projectOverview.milestones.markAchieved')}
                                                                            >
                                                                                <span className="material-symbols-outlined text-[16px]">check</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                            ) : (
                                                <div className="text-center py-8 text-[var(--color-text-muted)] flex flex-col items-center">
                                                    <div className="size-12 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-3">
                                                        <span className="material-symbols-outlined text-xl opacity-50">emoji_events</span>
                                                    </div>
                                                    <p className="text-xs font-medium">{t('projectOverview.milestones.allAchieved')}</p>
                                                    <p className="text-[10px] opacity-70 mt-1">{t('projectOverview.milestones.celebrate')}</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Background Decoration */}
                                        <div className="bg-decoration">
                                            <span className="material-symbols-outlined text-[120px]">flag</span>
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
                                            <div className="size-10 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-xl">psychology</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold">{t('projectOverview.aiReport.title')}</h3>
                                                <p className="text-[10px] text-indigo-100 truncate">
                                                    {pinnedReport ? t('projectOverview.aiReport.updated').replace('{time}', timeAgo(pinnedReport.createdAt)) : t('projectOverview.aiReport.generateAnalysis')}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined text-white/70">arrow_forward</span>
                                        </div>
                                    </div>

                                    <Card className="updates-card">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                                <span className="material-symbols-outlined text-slate-500">group</span>
                                                {t('projectOverview.team.title')}
                                                <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-full">
                                                    {teamMemberProfiles.length}
                                                </span>
                                            </h3>
                                            <div className="flex items-center gap-1">
                                                {can('canInvite') && (
                                                    <button
                                                        onClick={handleInvite}
                                                        className="size-7 flex items-center justify-center rounded-md transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95"
                                                        title={t('projectOverview.team.invite')}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                                                    </button>
                                                )}
                                                <Link
                                                    to="#"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setEditModalTab('team');
                                                        setShowEditModal(true);
                                                    }}
                                                    className="size-7 flex items-center justify-center rounded-md transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:scale-95"
                                                    title={t('projectOverview.team.manage')}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">settings</span>
                                                </Link>
                                            </div>
                                        </div>

                                        {teamMemberProfiles.length === 0 ? (
                                            <div className="py-6 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-hover)]/30 rounded-xl border border-dashed border-[var(--color-surface-border)]">
                                                <span className="material-symbols-outlined text-2xl opacity-30 mb-2 block">person_add</span>
                                                <p className="text-xs">{t('projectOverview.team.empty')}</p>
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
                                                                        className={`size-8 rounded-full object-cover shadow-sm ${isOnline ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-[#1E1E1E]' : ''}`}
                                                                    />
                                                                ) : (
                                                                    <div className={`avatar-placeholder size-8 bg-gradient-to-br from-indigo-50 to-slate-100 dark:from-indigo-900/20 dark:to-slate-800 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-sm ${isOnline ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-[#1E1E1E]' : ''}`}>
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
                                                        <div className="flex -space-x-1.5 mr-1">
                                                            {teamMemberProfiles.slice(4, 7).map(m => (
                                                                <div key={m.id} className="size-4 rounded-full border border-white dark:border-[#1E1E1E] overflow-hidden bg-[var(--color-surface-hover)]">
                                                                    {m.photoURL ? (
                                                                        <img src={m.photoURL} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[6px] font-bold text-indigo-500">{m.displayName?.charAt(0)}</div>
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
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="material-symbols-outlined text-[var(--color-text-subtle)]">tune</span>
                                                <h3 className="font-bold text-[var(--color-text-main)]">{t('projectOverview.controls.title')}</h3>
                                            </div>
                                            <div className="controls-form">
                                                <div className="form-group-row">
                                                    <Select
                                                        label={t('projectOverview.controls.status')}
                                                        value={project.status}
                                                        onChange={(e) => handleUpdateField('status', e.target.value)}
                                                        className="!py-2 !text-sm"
                                                    >
                                                        <option value="Active">{projectStatusLabels.Active}</option>
                                                        <option value="Planning">{projectStatusLabels.Planning}</option>
                                                        <option value="On Hold">{projectStatusLabels['On Hold']}</option>
                                                        <option value="Completed">{projectStatusLabels.Completed}</option>
                                                        <option value="Brainstorming">{projectStatusLabels.Brainstorming}</option>
                                                        <option value="Review">{projectStatusLabels.Review}</option>
                                                    </Select>

                                                    <Select
                                                        label={t('projectOverview.controls.priority')}
                                                        value={project.priority || 'Medium'}
                                                        onChange={(e) => handleUpdateField('priority', e.target.value)}
                                                        className="!py-2 !text-sm"
                                                    >
                                                        <option value="Low">{t('tasks.priority.low')}</option>
                                                        <option value="Medium">{t('tasks.priority.medium')}</option>
                                                        <option value="High">{t('tasks.priority.high')}</option>
                                                        <option value="Urgent">{t('tasks.priority.urgent')}</option>
                                                    </Select>
                                                </div>

                                                <div>
                                                    <Select
                                                        label={t('projectOverview.controls.projectState')}
                                                        value={project.projectState || 'not specified'}
                                                        onChange={(e) => handleUpdateField('projectState', e.target.value)}
                                                        className="!py-2 !text-sm"
                                                    >
                                                        <option value="not specified">{t('projectOverview.controls.state.notSpecified')}</option>
                                                        <option value="pre-release">{t('projectOverview.controls.state.preRelease')}</option>
                                                        <option value="released">{t('projectOverview.controls.state.released')}</option>
                                                    </Select>
                                                </div>

                                                <div className="date-inputs">
                                                    <div>
                                                        <label>{t('projectOverview.planning.start')}</label>
                                                        <DatePicker
                                                            value={project.startDate}
                                                            onChange={(date) => handleUpdateField('startDate', date)}
                                                            placeholder={t('projectOverview.controls.startPlaceholder')}
                                                            className="!py-2 !text-sm w-full"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label>{t('projectOverview.planning.due')}</label>
                                                        <DatePicker
                                                            value={project.dueDate}
                                                            onChange={(date) => handleUpdateField('dueDate', date)}
                                                            placeholder={t('projectOverview.controls.duePlaceholder')}
                                                            className="!py-2 !text-sm w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )}
                                </div>
                            </div>




                            {/* Gallery Modal */}
                            <Modal isOpen={showGalleryModal} onClose={() => setShowGalleryModal(false)} title={t('projectOverview.gallery.title')} size="xl">
                                <div className="gallery-viewer">
                                    <div className="main-view group">
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
                                <p className="text-sm text-[var(--color-text-muted)]">
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
                    )}
            </div>
        </>
    );
};
