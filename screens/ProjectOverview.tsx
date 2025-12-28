import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useOutletContext } from 'react-router-dom';
import { usePinnedProject } from '../context/PinnedProjectContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { getProjectById, toggleTaskStatus, updateProjectFields, addActivityEntry, deleteProjectById, subscribeProjectTasks, subscribeProjectActivity, subscribeProjectIdeas, subscribeProjectIssues, getActiveTenantId, getLatestGeminiReport, saveGeminiReport, getProjectMembers, getSubTasks } from '../services/dataService';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { generateProjectReport, getGeminiInsight } from '../services/geminiService';
import { Activity, Idea, Project, Task, Issue, ProjectRole, GeminiReport, Milestone, ProjectGroup } from '../types';
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';
import { toMillis, timeAgo } from '../utils/time';
import { auth, storage } from '../services/firebase';
import { getDownloadURL, ref, uploadBytes, listAll } from 'firebase/storage';
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
import { ProjectEditModal } from '../components/project/ProjectEditModal';
import { TYPE_COLORS } from '../components/ideas/constants';

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
    const [insight, setInsight] = useState<string | null>(null);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [teamMemberProfiles, setTeamMemberProfiles] = useState<Array<{ id: string; displayName: string; photoURL?: string; role: string }>>([]);
    const [error, setError] = useState<string | null>(null);
    const [unauthorized, setUnauthorized] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [pinnedReport, setPinnedReport] = useState<GeminiReport | null>(null);
    const [showInsight, setShowInsight] = useState<boolean>(true);
    const [reportExpanded, setReportExpanded] = useState(false);

    // Modals
    const [showEditModal, setShowEditModal] = useState(false);
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
                    setError("Project not found.");
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

                return () => {
                    unsubTasks();
                    unsubGroups();
                    unsubActivity();
                    unsubIdeas();
                    unsubIssues();
                    unsubMilestones();
                };
            } catch (error) {
                console.error(error);
                setError("Failed to load project data.");
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
                    setCommitsError('Unable to load commits right now.');
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
                        displayName: profile?.displayName || 'Team Member',
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
            const rep = await generateProjectReport(project, tasks);
            setReport(rep);
            await saveGeminiReport(project.id, rep);

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
                user: (auth.currentUser?.displayName || 'Unknown'),
                action: 'updated project settings',
                targetId: id,
                targetName: project.title,
                metadata: {
                    changes: Object.keys(updatedFields)
                }
            });

            // Update local state
            setProject(prev => prev ? { ...prev, ...updatedFields } : null);
            setShowEditModal(false);
        } catch (error) {
            console.error("Error updating project:", error);
            setError("Failed to update project settings");
        }
    };

    const handleUpdateField = async (field: keyof Project, value: any) => {
        if (!project || !id) return;
        if (project[field] === value) return;

        try {
            await updateProjectFields(id, { [field]: value });

            await addActivityEntry(id, {
                type: 'status',
                user: (auth.currentUser?.displayName || 'Unknown'),
                action: 'updated project settings',
                targetId: id,
                targetName: project.title,
                metadata: {
                    changes: [field]
                }
            });

            setProject(prev => prev ? ({ ...prev, [field]: value } as Project) : prev);
        } catch (error) {
            console.error("Error updating project:", error);
            setError("Failed to update project settings");
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
            setError('Failed to delete project.');
        } finally {
            setDeletingProject(false);
            setShowDeleteModal(false);
        }
    };

    const handleInvite = () => {
        setShowInviteModal(true);
    };

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
                <h1 className="text-3xl font-bold text-[var(--color-text-main)] mb-2">Access Denied</h1>
                <p className="text-[var(--color-text-muted)] max-w-md mb-8">
                    You do not have permission to view this project. You are not a member of this workspace nor have you been invited to this project.
                </p>
                <Link to="/projects">
                    <Button variant="primary" icon={<span className="material-symbols-outlined">arrow_back</span>}>
                        Back to Projects
                    </Button>
                </Link>
            </div>
        );
    }

    if (!project) return <div className="p-8">Project not found</div>;

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

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

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
    const workloadMetric = hasIssuesModule
        ? { label: 'Open issues', value: openIssues, icon: 'bug_report' }
        : hasIdeasModule
            ? { label: 'Ideas', value: ideas.length, icon: 'lightbulb' }
            : { label: 'Completed', value: completedTasks, icon: 'check_circle' };

    return (
        <div className="flex flex-col gap-8 fade-in pb-20 max-w-[1600px] mx-auto w-full">


            {/* PROFILE BANNER LAYOUT */}
            <div className="flex flex-col w-full bg-white dark:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl shadow-sm relative group/header">

                {/* 1. Cover Image Banner */}
                <div
                    className="h-48 md:h-64 bg-cover bg-center bg-no-repeat w-full relative group/cover rounded-t-2xl overflow-hidden"
                    style={{
                        backgroundImage: !coverRemoved && project.coverImage ? `url(${project.coverImage})` : undefined,
                        backgroundColor: !project.coverImage ? 'var(--color-surface-hover)' : undefined
                    }}
                >
                    {!project.coverImage && (
                        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] opacity-20">
                            <span className="material-symbols-outlined text-6xl">image</span>
                        </div>
                    )}

                    {/* Action Overlay (Cover) */}
                    {isOwner && (
                        <div className="absolute top-4 right-4 opacity-0 group-hover/cover:opacity-100 transition-opacity">
                            <Button
                                size="sm"
                                className="bg-white/80 backdrop-blur text-black hover:bg-white shadow-sm border-none"
                                icon={<span className="material-symbols-outlined text-[18px]">photo_camera</span>}
                                onClick={() => { setMediaPickerTarget('cover'); setShowMediaLibrary(true); }}
                            >
                                Edit Cover
                            </Button>
                        </div>
                    )}
                </div>

                {/* 2. Identity Bar */}
                <div className="px-6 pb-6 pt-16 md:pt-4 relative min-h-[100px] flex flex-col md:flex-row md:items-end justify-between gap-4">

                    {/* Overlapping Icon */}
                    <div className="absolute -top-12 left-6 md:-top-16 md:left-8">
                        <div className="relative group/icon">
                            <div className="size-24 md:size-32 rounded-3xl bg-white dark:bg-[var(--color-surface-card)] p-1.5 shadow-md">
                                <div className="w-full h-full rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-[var(--color-surface-border)] flex items-center justify-center cursor-pointer" onClick={() => { if (isOwner) { setMediaPickerTarget('icon'); setShowMediaLibrary(true); } }}>
                                    {project.squareIcon ? (
                                        <img src={project.squareIcon} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-4xl md:text-5xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">{project.title.charAt(0)}</span>
                                    )}
                                </div>
                            </div>
                            {isOwner && (
                                <div className="absolute inset-1.5 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none z-10">
                                    <span className="material-symbols-outlined text-white">edit</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Left: Text Info */}
                    <div className="md:ml-36 flex-1 min-w-0 pt-2 md:pt-0 space-y-3">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-main)] truncate">{project.title}</h1>
                                <Badge variant={project.status === 'Active' ? 'success' : 'primary'}>{project.status}</Badge>
                            </div>
                            <div className="relative group/desc max-w-2xl">
                                <p className="text-[var(--color-text-muted)] line-clamp-2">{project.description || 'No description provided.'}</p>

                                {/* Hover Expand Box */}
                                {project.description && (
                                    <div className="absolute -top-[13px] -left-[13px] w-[calc(100%+26px)] z-50 hidden group-hover/desc:block">
                                        <p className="bg-white dark:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg p-3 shadow-xl text-[var(--color-text-muted)]">
                                            {project.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-start md:self-end">
                        {can('canManageTasks') && (
                            <Button variant="primary" onClick={() => setShowTaskModal(true)} icon={<span className="material-symbols-outlined">add_task</span>}>
                                New Task
                            </Button>
                        )}
                        {can('canInvite') && (
                            <Button variant="secondary" onClick={handleInvite} icon={<span className="material-symbols-outlined">person_add</span>}>
                                Invite
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
                            title={pinnedProjectId === project.id ? 'Unpin project' : 'Pin project'}
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

                {/* Banner Metrics Footer (Chronicle split up) */}
                <div className={`grid grid-cols-2 ${project.modules?.includes('issues') ? 'md:grid-cols-5' : 'md:grid-cols-4'} border-t border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]/30 divide-x divide-[var(--color-surface-border)]`}>
                    {/* 1. Progress */}
                    <div className="py-3 px-6 flex items-center gap-4">
                        <span className="material-symbols-outlined text-[var(--color-primary)] text-[20px] shrink-0">speed</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight">Completion</span>
                                <span className="text-[10px] font-bold text-[var(--color-primary)]">{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-[var(--color-surface-border)] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-1000"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Tasks Stat */}
                    <div className="py-3 px-6 group relative overflow-visible cursor-help">
                        {/* Trigger content */}
                        <div className="flex items-center gap-4">
                            <span className="material-symbols-outlined text-green-500 text-[20px] shrink-0">task_alt</span>
                            <div className="text-left min-w-0">
                                <div className="text-sm font-bold text-[var(--color-text-main)] leading-none mb-1">
                                    {completedTasksWithSubtasks} / {totalTasksWithSubtasks}
                                </div>
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight truncate block">Tasks Done</span>
                            </div>
                        </div>

                        {/* Redesigned Floating Hover Card */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+8px)] z-50 w-72 pointer-events-none group-hover:pointer-events-auto">
                            <div className="relative opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-200 ease-out origin-top shadow-2xl rounded-2xl">

                                {/* Container */}
                                <div className="bg-white dark:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/5">

                                    {/* Header */}
                                    <div className="px-5 py-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">donut_small</span>
                                            <span className="text-xs font-bold text-[var(--color-text-main)]">Composition</span>
                                        </div>
                                        <span className="text-[10px] font-medium text-[var(--color-text-muted)]">
                                            Total Completed
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
                                                <span>Tasks</span>
                                                <span>Subtasks</span>
                                            </div>
                                        </div>

                                        {/* Detailed grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col p-3 rounded-xl bg-[var(--color-surface-hover)]/50 border border-[var(--color-surface-border)] transition-colors hover:bg-[var(--color-surface-hover)]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="size-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Main Tasks</span>
                                                </div>
                                                <div className="text-xl font-bold text-[var(--color-text-main)] mt-1 tabular-nums tracking-tight">
                                                    {completedTasks} <span className="text-sm font-medium text-[var(--color-text-muted)]">/ {tasks.length}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col p-3 rounded-xl bg-[var(--color-surface-hover)]/50 border border-[var(--color-surface-border)] transition-colors hover:bg-[var(--color-surface-hover)]">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="size-2 rounded-full bg-sky-500 shadow-sm shadow-sky-500/20"></div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Subtasks</span>
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
                    <div className="py-3 px-6 flex items-center gap-4">
                        <span className={`material-symbols-outlined text-[20px] shrink-0 ${project.priority === 'High' ? 'text-rose-500' :
                            project.priority === 'Medium' ? 'text-amber-500' : 'text-blue-500'
                            }`}>flag</span>
                        <div className="text-left min-w-0">
                            <div className={`text-sm font-bold leading-none mb-1 ${project.priority === 'High' ? 'text-rose-600 dark:text-rose-400' :
                                project.priority === 'Medium' ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                {project.priority || 'Medium'}
                            </div>
                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight truncate block">Priority</span>
                        </div>
                    </div>

                    {/* 4. Open Issues (only if module enabled) */}
                    {project.modules?.includes('issues') && (
                        <div className="py-3 px-6 flex items-center gap-4">
                            <span className="material-symbols-outlined text-rose-500 text-[20px] shrink-0">bug_report</span>
                            <div className="text-left min-w-0">
                                {(() => {
                                    const openCount = issues.filter(i => !['Resolved', 'Closed'].includes(i.status)).length;
                                    return (
                                        <>
                                            <div className="text-sm font-bold text-[var(--color-text-main)] leading-none mb-1">
                                                {openCount}
                                            </div>
                                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight truncate block">
                                                Open {openCount === 1 ? 'Issue' : 'Issues'}
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* 5. Next Deadline (always shown) */}
                    <div className="py-3 px-6 flex items-center gap-4">
                        <span className="material-symbols-outlined text-indigo-500 text-[20px] shrink-0">event_upcoming</span>
                        <div className="text-left min-w-0">
                            <div className="text-sm font-bold text-[var(--color-text-main)] leading-none mb-1">
                                {upcomingDeadlines[0]
                                    ? new Date(upcomingDeadlines[0].dueDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                    : 'None'}
                            </div>
                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-tight truncate block">Next Deadline</span>
                        </div>
                    </div>
                </div>
            </div>


            {/* Project Overview Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3 space-y-8">
                    {/* Snapshot */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">Snapshot</h2>
                            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Overview</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="h-full min-h-[180px] flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">query_stats</span>
                                        Health
                                    </h3>
                                    <button onClick={() => setShowHealthModal(true)} className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline">
                                        Details
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <HealthIndicator health={health} size="md" showLabel={false} onOpenDetail={() => setShowHealthModal(true)} />
                                    <div>
                                        <div className={`text-sm font-bold uppercase tracking-wider ${health.status === 'excellent' || health.status === 'healthy'
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : health.status === 'warning'
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                            }`}>
                                            {health.status}
                                        </div>
                                        <div className="text-[10px] text-[var(--color-text-muted)]">Health score</div>
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Top Risks</p>
                                    {health.factors.filter(f => f.type === 'negative').length > 0 ? (
                                        <ul className="mt-2 space-y-1">
                                            {health.factors.filter(f => f.type === 'negative').slice(0, 2).map((factor, i) => (
                                                <li key={i} className="text-[11px] text-[var(--color-text-main)] flex items-center gap-1.5">
                                                    <span className="text-rose-500 text-[8px]">●</span>
                                                    <span className="line-clamp-1">{factor.label}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                            No risks detected
                                        </p>
                                    )}
                                </div>
                            </Card>

                            <Card className="h-full min-h-[180px] flex flex-col">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">inbox</span>
                                        Workload
                                    </h3>
                                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">{openTasks} open</span>
                                </div>
                                <div className="mt-3 space-y-2 flex-1">
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface-hover)]">
                                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-[14px]">list_alt</span>
                                            Open tasks
                                        </div>
                                        <span className="text-sm font-bold text-[var(--color-text-main)]">{openTasks}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface-hover)]">
                                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-[14px] text-rose-500">priority_high</span>
                                            Urgent
                                        </div>
                                        <span className="text-sm font-bold text-[var(--color-text-main)]">{urgentCount}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-surface-hover)]">
                                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined text-[14px]">{workloadMetric.icon}</span>
                                            {workloadMetric.label}
                                        </div>
                                        <span className="text-sm font-bold text-[var(--color-text-main)]">{workloadMetric.value}</span>
                                    </div>
                                </div>
                                <Link to={`/project/${id}/tasks`} className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline mt-3">
                                    View tasks
                                </Link>
                            </Card>

                            <Card className="h-full min-h-[180px] flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">insights</span>
                                        Activity
                                    </h3>
                                    <Link to={`/project/${id}/activity`} className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline">
                                        History
                                    </Link>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                        <div className="text-xl font-bold text-[var(--color-text-main)]">{activity.length}</div>
                                        <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Events</div>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-indigo-600">{activity.filter(a => a.type === 'comment').length}</div>
                                        <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Comments</div>
                                    </div>
                                </div>
                                <div className="mt-3 text-[11px] text-[var(--color-text-muted)]">
                                    {activity[0]
                                        ? (
                                            <>
                                                <span className="font-semibold text-[var(--color-text-main)]">{activity[0].user}</span> {activity[0].action}
                                                <span className="block text-[10px] text-[var(--color-text-subtle)] mt-1">{timeAgo(activity[0].createdAt)}</span>
                                            </>
                                        )
                                        : 'No recent activity yet.'}
                                </div>
                            </Card>

                            <Card className="h-full min-h-[180px] flex flex-col">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-[var(--color-text-subtle)]">event_upcoming</span>
                                        Upcoming
                                    </h3>
                                    <Link to={`/project/${id}/tasks`} className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline">
                                        View
                                    </Link>
                                </div>
                                <div className="mt-3 space-y-2 flex-1">
                                    {upcomingDeadlines.length === 0 ? (
                                        <p className="text-sm text-[var(--color-text-muted)]">No upcoming deadlines.</p>
                                    ) : (
                                        upcomingDeadlines.slice(0, 2).map(task => (
                                            <div key={task.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-[var(--color-surface-border)]">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-[var(--color-text-main)] truncate">{task.title}</p>
                                                    <p className="text-[10px] text-[var(--color-text-muted)]">{task.priority || 'Priority not set'}</p>
                                                </div>
                                                <span className="text-[10px] font-bold text-[var(--color-text-muted)] shrink-0">
                                                    {new Date(task.dueDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {upcomingDeadlines.length > 2 && (
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2">+{upcomingDeadlines.length - 2} more tasks</p>
                                )}
                            </Card>
                        </div>
                    </section>

                    {/* Execution */}
                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">Execution</h2>
                            <div className="flex items-center gap-3 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                                <span>{openTasks} open tasks</span>
                                {showIssueCard && <span>{openIssues} open issues</span>}
                                {showIdeaCard && <span>{ideas.length} ideas</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className={`${executionSideCards === 0 ? 'lg:col-span-3' : 'lg:col-span-2'} h-full flex flex-col`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--color-text-subtle)]">checklist</span>
                                        <h3 className="text-lg font-bold text-[var(--color-text-main)]">Tasks</h3>
                                    </div>
                                    <Link to={`/project/${id}/tasks`} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                                        View all tasks
                                    </Link>
                                </div>
                                <div className="mt-4 space-y-2 flex-1">
                                    {recentTasks.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                                            No active tasks right now.
                                        </div>
                                    ) : (
                                        recentTasks.slice(0, 6).map(task => (
                                            <div
                                                key={task.id}
                                                onClick={() => navigate(`/project/${id}/tasks/${task.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                                className="group flex items-center gap-3 rounded-lg border border-[var(--color-surface-border)] px-3 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                                            >
                                                <button
                                                    onClick={(e) => handleToggleTask(task.id, task.isCompleted, e)}
                                                    className={`
                                                        size-5 rounded-md border flex items-center justify-center transition-all duration-200 shrink-0
                                                        ${task.isCompleted
                                                            ? 'bg-green-500 border-green-500 text-white'
                                                            : 'border-[var(--color-surface-border)] hover:border-green-500 text-transparent bg-transparent'}
                                                    `}
                                                >
                                                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-semibold truncate ${task.isCompleted ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}>
                                                        {task.title}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {task.priority && (
                                                            <div className={`
                                                                flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
                                                                ${task.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                                    task.priority === 'High' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                        task.priority === 'Medium' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                            'bg-slate-500/10 text-slate-500 border-slate-500/20'}
                                                            `}>
                                                                <span className="material-symbols-outlined text-[12px]">
                                                                    {task.priority === 'Urgent' ? 'error' :
                                                                        task.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                                            task.priority === 'Medium' ? 'drag_handle' :
                                                                                'keyboard_arrow_down'}
                                                                </span>
                                                                {task.priority}
                                                            </div>
                                                        )}
                                                        {/* Subtask Count */}
                                                        {subtaskStats[task.id]?.total > 0 && (
                                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-slate-100 dark:bg-white/5 text-[var(--color-text-muted)]">
                                                                <span className="material-symbols-outlined text-[11px]">checklist</span>
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
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="text-[9px] font-semibold text-[var(--color-text-muted)] whitespace-nowrap">
                                                                            {new Date(task.startDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                        </span>
                                                                        <div className="w-12 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative">
                                                                            <div
                                                                                className={`h-full absolute top-0 left-0 rounded-full transition-all duration-1000 ${isOverdue ? 'bg-rose-500' : 'bg-[var(--color-primary)]'}`}
                                                                                style={{ width: `${pct}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className={`text-[9px] font-semibold whitespace-nowrap ${isOverdue ? 'text-rose-500' : 'text-[var(--color-text-muted)]'}`}>
                                                                            {dueDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }

                                                            // Due date only
                                                            if (hasDue && dueDate) {
                                                                return (
                                                                    <span className={`text-[10px] ${isOverdue ? 'text-rose-500 font-bold' : 'text-[var(--color-text-muted)]'}`}>
                                                                        {dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                    </span>
                                                                );
                                                            }

                                                            return null;
                                                        })()}
                                                        {task.assignedGroupIds && task.assignedGroupIds.length > 0 && (
                                                            <div className="flex -space-x-1.5 overflow-hidden ml-1">
                                                                {task.assignedGroupIds.map(gid => {
                                                                    const group = projectGroups.find(g => g.id === gid);
                                                                    if (!group) return null;
                                                                    return (
                                                                        <div
                                                                            key={gid}
                                                                            className="size-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-[#1E1E1E]"
                                                                            style={{ backgroundColor: group.color }}
                                                                            title={`Group: ${group.name}`}
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
                                                    className={`
                                                        size-8 rounded-full flex items-center justify-center transition-all shrink-0
                                                        ${isPinned(task.id)
                                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] opacity-0 group-hover:opacity-100'}
                                                    `}
                                                    title={isPinned(task.id) ? 'Unpin task' : 'Pin task'}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">push_pin</span>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>

                            {(showIdeaCard || showIssueCard) && (
                                <div className={`lg:col-span-1 grid grid-cols-1 gap-6 ${executionSideCards > 1 ? 'lg:grid-rows-2 lg:auto-rows-fr' : ''}`}>
                                    {showIdeaCard && (
                                        <Card className={`flex flex-col ${executionSideCards > 1 ? 'lg:h-full' : ''}`}>
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[var(--color-text-subtle)]">lightbulb</span>
                                                    Idea Spotlight
                                                </h3>
                                                <Link to={`/project/${id}/ideas`} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                                                    View all ideas
                                                </Link>
                                            </div>
                                            {topIdea ? (() => {
                                                const typeColor = TYPE_COLORS[topIdea.type] || TYPE_COLORS['default'] || 'bg-slate-100 text-slate-600';
                                                return (
                                                    <Link
                                                        to={`/project/${id}/ideas/${topIdea.id}`}
                                                        className="group mt-4 flex-1 block rounded-xl border border-[var(--color-surface-border)] p-4 hover:shadow-md hover:border-[var(--color-primary)]/30 transition-all bg-[var(--color-surface-paper)]"
                                                    >
                                                        {/* Type Badge Row */}
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${typeColor}`}>
                                                                {topIdea.type}
                                                            </span>
                                                            {topIdea.generated && (
                                                                <span className="text-[10px] font-medium text-indigo-500 flex items-center gap-0.5">
                                                                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                                                    AI
                                                                </span>
                                                            )}
                                                            {topIdea.stage && (
                                                                <span className="text-[10px] font-medium text-[var(--color-text-muted)] flex items-center gap-1 ml-auto">
                                                                    <span className="material-symbols-outlined text-[12px]">layers</span>
                                                                    {topIdea.stage}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Title */}
                                                        <h4 className="font-semibold text-[var(--color-text-main)] text-sm mb-1.5 line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                                                            {topIdea.title}
                                                        </h4>

                                                        {/* Description */}
                                                        {topIdea.description && (
                                                            <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-3">
                                                                {topIdea.description}
                                                            </p>
                                                        )}

                                                        {/* Meta Row */}
                                                        <div className="flex items-center gap-4 text-[var(--color-text-subtle)]">
                                                            <span className="flex items-center gap-1 text-xs">
                                                                <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                                                                {topIdea.votes || 0}
                                                            </span>
                                                            <span className="flex items-center gap-1 text-xs">
                                                                <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                                                {topIdea.comments || 0}
                                                            </span>
                                                        </div>
                                                    </Link>
                                                );
                                            })() : (
                                                <div className="mt-4 flex-1 flex items-center justify-center text-sm text-[var(--color-text-muted)]">
                                                    No ideas yet.
                                                </div>
                                            )}
                                        </Card>
                                    )}

                                    {showIssueCard && (
                                        <Card className={`flex flex-col ${executionSideCards > 1 ? 'lg:h-full' : ''}`}>
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[var(--color-text-subtle)]">bug_report</span>
                                                    Issue Focus
                                                </h3>
                                                <Link to={`/project/${id}/issues`} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                                                    View all issues
                                                </Link>
                                            </div>

                                            <div className="mt-4 space-y-2 flex-1 max-h-[500px] overflow-y-auto -mr-2">
                                                {recentIssues.length === 0 ? (
                                                    <div className="text-sm text-[var(--color-text-muted)]">No open issues right now.</div>
                                                ) : (
                                                    recentIssues.map(issue => (
                                                        <div
                                                            key={issue.id}
                                                            onClick={() => navigate(`/project/${id}/issues/${issue.id}`)}
                                                            className="group flex items-start justify-between gap-3 rounded-lg border border-[var(--color-surface-border)] px-3 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-[var(--color-text-main)] truncate">{issue.title}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <div className={`
                                                                        flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
                                                                        ${issue.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                                            issue.priority === 'High' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                                                                issue.priority === 'Medium' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                                                                    'bg-slate-500/10 text-slate-500 border-slate-500/20'}
                                                                    `}>
                                                                        <span className="material-symbols-outlined text-[12px]">
                                                                            {issue.priority === 'Urgent' ? 'error' :
                                                                                issue.priority === 'High' ? 'keyboard_double_arrow_up' :
                                                                                    issue.priority === 'Medium' ? 'drag_handle' :
                                                                                        'keyboard_arrow_down'}
                                                                        </span>
                                                                        {issue.priority}
                                                                    </div>
                                                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10">
                                                                        {issue.status}
                                                                    </div>
                                                                    {issue.assignedGroupIds && issue.assignedGroupIds.length > 0 && (
                                                                        <div className="flex -space-x-1.5 overflow-hidden ml-1">
                                                                            {issue.assignedGroupIds.map(gid => {
                                                                                const group = projectGroups.find(g => g.id === gid);
                                                                                if (!group) return null;
                                                                                return (
                                                                                    <div
                                                                                        key={gid}
                                                                                        className="size-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shadow-sm ring-1 ring-white dark:ring-[#1E1E1E]"
                                                                                        style={{ backgroundColor: group.color }}
                                                                                        title={`Group: ${group.name}`}
                                                                                    >
                                                                                        {group.name.substring(0, 1).toUpperCase()}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 self-center">
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
                                                                            <div className="flex flex-col gap-1.5 w-28">
                                                                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                                                                                    <span>Timeline</span>
                                                                                    <span>{Math.round(pct)}%</span>
                                                                                </div>
                                                                                <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden relative ring-1 ring-black/[0.02]">
                                                                                    <div
                                                                                        className={`h-full absolute top-0 left-0 rounded-full transition-all duration-1000 ${isOverdue ? 'bg-rose-500' : 'bg-[var(--color-primary)]'}`}
                                                                                        style={{ width: `${pct}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex justify-between text-[8px] font-bold opacity-60">
                                                                                    <span>{new Date(issue.startDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                                                    <span className={isOverdue ? 'text-rose-500' : ''}>
                                                                                        {dueDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // Due date only
                                                                    if (hasDue && dueDate) {
                                                                        return (
                                                                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${isOverdue ? 'border-rose-500/30 bg-rose-500/10 text-rose-500' : 'border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] text-[var(--color-text-main)]'}`}>
                                                                                <span className="material-symbols-outlined text-[14px]">event</span>
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-[8px] font-black uppercase tracking-[0.15em] opacity-70">{isOverdue ? 'Overdue' : 'Due'}</span>
                                                                                    <span className="text-[10px] font-semibold">{dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
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
                                                                    className={`
                                                                        size-8 rounded-full flex items-center justify-center transition-colors
                                                                        ${isPinned(issue.id)
                                                                            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}
                                                                    `}
                                                                    title={isPinned(issue.id) ? 'Unpin issue' : 'Pin issue'}
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">push_pin</span>
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
                                        Initiatives
                                        <span className="text-xs font-medium text-[var(--color-text-muted)]">({initiatives.length})</span>
                                    </h3>
                                    <Link to={`/project/${id}/tasks`} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">
                                        View all
                                    </Link>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {initiatives.slice(0, 8).map(initiative => {
                                        const hasStart = Boolean(initiative.startDate);
                                        const hasDue = Boolean(initiative.dueDate);
                                        const dueDate = initiative.dueDate ? new Date(initiative.dueDate) : null;
                                        const isOverdue = dueDate && dueDate < new Date() && !initiative.isCompleted;
                                        let pct = 0;
                                        if (hasStart && hasDue) {
                                            const start = new Date(initiative.startDate!).getTime();
                                            const end = dueDate!.getTime();
                                            const now = new Date().getTime();
                                            const total = end - start;
                                            const elapsed = now - start;
                                            pct = Math.max(0, Math.min(100, (elapsed / total) * 100));
                                        }

                                        // Status-based glow styling
                                        const status = initiative.status?.toLowerCase() || '';
                                        const isInProgress = status === 'in progress' || status === 'inprogress';
                                        const isReview = status === 'review' || status === 'in review';
                                        const isBlocked = status === 'blocked';

                                        let glowClass = '';
                                        if (isBlocked) {
                                            glowClass = 'shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse';
                                        } else if (isInProgress) {
                                            glowClass = 'shadow-[0_0_15px_rgba(59,130,246,0.3)]';
                                        } else if (isReview) {
                                            glowClass = 'shadow-[0_0_15px_rgba(168,85,247,0.3)]';
                                        }

                                        return (
                                            <div
                                                key={initiative.id}
                                                onClick={() => navigate(`/project/${id}/tasks/${initiative.id}${project?.tenantId ? `?tenant=${project.tenantId}` : ''}`)}
                                                className={`group relative rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-card)] p-4 hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer ${glowClass} ${isBlocked ? 'border-rose-500/40' :
                                                    isInProgress ? 'border-blue-500/30 hover:border-blue-500/50' :
                                                        isReview ? 'border-purple-500/30 hover:border-purple-500/50' :
                                                            'hover:border-indigo-500/30'
                                                    }`}
                                            >
                                                {/* Priority indicator */}
                                                <div className={`absolute top-0 left-4 w-8 h-1 rounded-b-full ${initiative.priority === 'Urgent' ? 'bg-rose-500' :
                                                    initiative.priority === 'High' ? 'bg-amber-500' :
                                                        initiative.priority === 'Medium' ? 'bg-blue-500' : 'bg-slate-400'
                                                    }`} />

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
                                                            {initiative.status}
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
                                                            {initiative.priority}
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
                                                        <span className="font-semibold">{new Date(initiative.startDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                        <div className="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${isOverdue ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                        <span className={`font-semibold ${isOverdue ? 'text-rose-500' : ''}`}>
                                                            {dueDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Due Date Only */}
                                                {!hasStart && hasDue && (
                                                    <div className={`flex items-center gap-1.5 text-[9px] ${isOverdue ? 'text-rose-500 font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                                                        <span className="material-symbols-outlined text-[12px] fill-current">event</span>
                                                        Due {dueDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">Updates</h2>
                            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Timeline</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <Card className={`flex flex-col ${showGithubCard ? 'lg:col-span-2' : 'lg:col-span-4'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                        <span className="material-symbols-outlined text-slate-500">history</span>
                                        Latest Activity
                                    </h3>
                                    <Link to={`/project/${id}/activity`} className="text-xs font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                                        History
                                    </Link>
                                </div>

                                <div className="relative pl-0 space-y-5 max-h-[320px] overflow-y-auto pr-2 before:absolute before:inset-y-2 before:left-[15px] before:w-px before:bg-[var(--color-surface-border)]">
                                    {activity.slice(0, 6).map((item) => {
                                        const { icon, color, bg } = activityIcon(item.type, item.action);
                                        return (
                                            <div key={item.id} className="relative flex gap-3 pl-10">
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
                                    {activity.length === 0 && <p className="text-xs text-[var(--color-text-muted)] pl-2">No recent activity.</p>}
                                </div>
                            </Card>

                            {showGithubCard && (
                                <Card className="flex flex-col lg:col-span-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-xl">terminal</span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-[var(--color-text-main)] truncate">GitHub Commits</h3>
                                                <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-tight line-clamp-1">
                                                    {project.githubRepo || 'No repository linked'}
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
                                                Repo <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            </a>
                                        )}
                                    </div>

                                    {!project.githubRepo ? (
                                        <div className="text-xs text-[var(--color-text-muted)] space-y-3">
                                            <p>Link a repository in project settings to show recent commits.</p>
                                            {isOwner && (
                                                <button
                                                    onClick={() => setShowEditModal(true)}
                                                    className="inline-flex items-center gap-1 text-[var(--color-primary)] font-semibold hover:underline"
                                                >
                                                    Open settings <span className="material-symbols-outlined text-sm">settings</span>
                                                </button>
                                            )}
                                        </div>
                                    ) : commitsLoading ? (
                                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                                            <span className="material-symbols-outlined animate-spin text-[14px] text-[var(--color-primary)]">progress_activity</span>
                                            Loading recent commits...
                                        </div>
                                    ) : commitsError ? (
                                        <div className="text-xs text-rose-600 dark:text-rose-400">{commitsError}</div>
                                    ) : githubCommits.length === 0 ? (
                                        <div className="text-xs text-[var(--color-text-muted)]">No recent commits found.</div>
                                    ) : (
                                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2">
                                            {githubCommits.map(commit => (
                                                <a
                                                    key={commit.sha}
                                                    href={commit.html_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block p-3 rounded-xl border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] transition-all"
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
                                                                    <span>@{commit.author?.login || commit.commit.author.name || 'unknown'}</span>
                                                                    <span>•</span>
                                                                    <span>{timeAgo(commit.commit.author.date)}</span>
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
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-[var(--color-text-main)]">Resources</h2>
                            <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-[0.2em]">Assets</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="h-full flex flex-col">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)]">Quick Links</h3>
                                    {isOwner && (
                                        <Button size="sm" variant="ghost" onClick={() => setShowEditModal(true)}>
                                            Manage
                                        </Button>
                                    )}
                                </div>
                                <div className="mt-4 space-y-2 flex-1">
                                    {project.links?.slice(0, 4).map((link, i) => (
                                        <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group">
                                            <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[18px]">link</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[var(--color-text-main)] truncate group-hover:text-indigo-600 transition-colors">{link.title}</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)] truncate">{link.url.replace(/^https?:\/\//, '')}</p>
                                            </div>
                                            <span className="material-symbols-outlined text-[14px] text-[var(--color-text-subtle)] opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                                        </a>
                                    ))}
                                    {(!project.links || project.links.length === 0) && <p className="text-sm text-[var(--color-text-muted)]">No links available.</p>}
                                </div>
                                {project.links && project.links.length > 4 && (
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2">+{project.links.length - 4} more links</p>
                                )}
                            </Card>

                            <Card className="h-full flex flex-col">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-[var(--color-text-main)]">Gallery</h3>
                                    <Button size="sm" variant="ghost" onClick={() => setShowMediaLibrary(true)}>Manage</Button>
                                </div>

                                <div className="mt-4 grid grid-cols-3 gap-2">
                                    {galleryAssets.map((asset) => (
                                        <div
                                            key={`${asset.url}-${asset.index}`}
                                            className="aspect-square rounded-lg overflow-hidden border border-[var(--color-surface-border)] cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => { setSelectedImageIndex(asset.index); setShowGalleryModal(true); }}
                                        >
                                            <img src={asset.url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    {projectAssets.length < 3 && (
                                        <button onClick={() => setShowMediaLibrary(true)} className="aspect-square rounded-lg border border-dashed border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </section>
                </div>

                <div className="xl:col-span-1 space-y-6">
                    {showInsight && (
                        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md text-white">
                            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-8xl">auto_awesome</span>
                            </div>
                            <div className="relative z-10 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                                        <span className="material-symbols-outlined text-xl text-white">psychology</span>
                                    </div>
                                    <h3 className="font-bold">Project Insight</h3>
                                </div>
                                <p className="text-indigo-100 leading-relaxed text-sm selection:bg-white/30">
                                    {cleanText(insight) || "Generate a report to get tailored guidance and discover potential risks early."}
                                </p>
                                <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="bg-white text-indigo-600 hover:bg-indigo-50 border-none shadow-sm w-full justify-center" onClick={handleGenerateReport} isLoading={reportLoading}>
                                        {pinnedReport ? 'Refresh' : 'Analyze'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <Card className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">schedule</span>
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Planning Snapshot</h3>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            <span>Timeline & milestones</span>
                            <span className="flex items-center gap-1.5">
                                <span className="size-1.5 rounded-full bg-[var(--color-primary)]" />
                                <span className="text-[var(--color-text-main)]">{progress}%</span>
                                complete
                            </span>
                        </div>

                        <div className="mt-4 space-y-4 flex-1">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Start</p>
                                    <p className="text-sm font-semibold text-[var(--color-text-main)]">
                                        {project.startDate ? new Date(project.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Due</p>
                                    <p className="text-sm font-semibold text-[var(--color-text-main)]">
                                        {project.dueDate ? new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                                    </p>
                                </div>
                            </div>
                            <div className="h-2 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                                <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                            </div>


                        </div>

                        {isOwner && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="text-[10px] font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1 mt-4"
                            >
                                Edit dates <span className="material-symbols-outlined text-[12px]">settings</span>
                            </button>
                        )}
                    </Card>

                    <Card className="flex flex-col relative overflow-hidden">
                        <div className="flex items-center justify-between mb-2 z-10 relative">
                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-text-subtle)]">flag</span>
                                Milestones
                            </h3>
                            <Link to={`/project/${id}/milestones`} className="size-6 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                            </Link>
                        </div>

                        {/* Progress Header */}
                        <div className="flex items-center gap-3 mb-6 z-10 relative">
                            <div className="flex-1">
                                <div className="h-1 w-full bg-[var(--color-surface-hover)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                        style={{ width: `${milestones.length > 0 ? (milestones.filter(m => m.status === 'Achieved').length / milestones.length) * 100 : 0}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Progress</span>
                                    <span className="text-[10px] font-bold text-[var(--color-text-main)]">{milestones.filter(m => m.status === 'Achieved').length}/{milestones.length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 flex-1 relative min-h-[160px] z-10">
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
                                            <div key={milestone.id} className="relative flex items-start gap-4 group">
                                                {/* Timeline Dot */}
                                                <div className={`
                                                    relative z-10 shrink-0 flex items-center justify-center rounded-full transition-all duration-300
                                                    ${isFirst
                                                        ? 'size-6 bg-white dark:bg-[var(--color-surface-card)] border-2 border-indigo-500 shadow-[0_0_0_2px_rgba(99,102,241,0.2)]'
                                                        : 'size-2.5 ml-[7px] mt-[5px] bg-[var(--color-surface-border)] border-2 border-white dark:border-[var(--color-surface-card)]'
                                                    }
                                                 `}>
                                                    {isFirst && <div className="size-1.5 bg-indigo-500 rounded-full animate-pulse" />}
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
                                                                    {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'}
                                                                </p>
                                                                {isFirst && (
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-1.5 py-px rounded">
                                                                        Next Up
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {isFirst && (
                                                            <button
                                                                onClick={() => handleToggleMilestone(milestone)}
                                                                className="size-7 rounded-lg bg-[var(--color-surface-hover)] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-[var(--color-text-muted)] hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition-all shrink-0"
                                                                title="Mark as achieved"
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
                                    <p className="text-xs font-medium">All milestones achieved!</p>
                                    <p className="text-[10px] opacity-70 mt-1">Time to celebrate or set new goals.</p>
                                </div>
                            )}
                        </div>

                        {/* Background Decoration */}
                        <div className="absolute -bottom-6 -right-6 text-[var(--color-surface-hover)] opacity-50 pointer-events-none">
                            <span className="material-symbols-outlined text-[120px]">flag</span>
                        </div>
                    </Card>
                    <Card className="flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-500">group</span>
                                Team
                                <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded-full">
                                    {teamMemberProfiles.length}
                                </span>
                                {activeProjectUsers.length > 0 && (
                                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        {activeProjectUsers.filter(u => u.isOnline || u.isBusy).length} active
                                    </span>
                                )}
                            </h3>
                            <Link to={`/project/${id}/team`} className="text-xs font-semibold text-[var(--color-primary)] hover:underline flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">settings</span>
                                Manage
                            </Link>
                        </div>

                        {teamMemberProfiles.length === 0 ? (
                            <div className="py-4 text-center text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-3xl opacity-30 mb-2 block">person_add</span>
                                <p className="text-sm">No team members yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                                {teamMemberProfiles.map(member => {
                                    const presenceData = activeProjectUsers.find(u => u.uid === member.id);
                                    const isOnline = presenceData?.isOnline || false;
                                    const isIdle = presenceData?.isIdle || false;
                                    const isBusy = presenceData?.isBusy || false;

                                    return (
                                        <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group/member">
                                            <div className="relative shrink-0">
                                                {member.photoURL ? (
                                                    <img
                                                        src={member.photoURL}
                                                        alt={member.displayName}
                                                        className={`size-10 rounded-full border-2 object-cover shadow-sm transition-all ${isOnline ? 'border-emerald-500' : isIdle ? 'border-amber-400' : isBusy ? 'border-rose-500' : 'border-[var(--color-surface-border)]'
                                                            }`}
                                                    />
                                                ) : (
                                                    <div className={`size-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 border-2 flex items-center justify-center text-sm font-bold text-indigo-600 dark:text-indigo-400 shadow-sm transition-all ${isOnline ? 'border-emerald-500' : isIdle ? 'border-amber-400' : isBusy ? 'border-rose-500' : 'border-[var(--color-surface-border)]'
                                                        }`}>
                                                        {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                {isOnline ? (
                                                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[var(--color-surface-card)] shadow-sm" title="Online now" />
                                                ) : isIdle ? (
                                                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-amber-400 rounded-full border-2 border-white dark:border-[var(--color-surface-card)] shadow-sm flex items-center justify-center" title="Away">
                                                        <span className="material-symbols-outlined text-[6px] text-amber-900">schedule</span>
                                                    </div>
                                                ) : isBusy ? (
                                                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-rose-500 rounded-full border-2 border-white dark:border-[var(--color-surface-card)] shadow-sm flex items-center justify-center" title="Busy">
                                                        <span className="material-symbols-outlined text-[6px] text-white">do_not_disturb_on</span>
                                                    </div>
                                                ) : member.id === project?.ownerId ? (
                                                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-amber-400 rounded-full border-2 border-white dark:border-[var(--color-surface-card)] flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[12px] text-amber-900">star</span>
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-[var(--color-text-main)] truncate">
                                                        {member.displayName}
                                                    </span>
                                                    {member.id === auth.currentUser?.uid && (
                                                        <span className="text-[9px] font-bold text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded uppercase tracking-wider">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${member.role === 'Owner'
                                                        ? 'text-amber-600 dark:text-amber-400'
                                                        : member.role === 'Editor'
                                                            ? 'text-indigo-600 dark:text-indigo-400'
                                                            : 'text-[var(--color-text-muted)]'
                                                        }`}>
                                                        {member.role}
                                                    </span>
                                                    {isOnline && (
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">• Online</span>
                                                    )}
                                                    {isIdle && (
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">• Away</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {can('canInvite') && (
                            <button
                                onClick={handleInvite}
                                className="w-full mt-4 py-2.5 rounded-xl border border-dashed border-[var(--color-surface-border)] flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all"
                            >
                                <span className="material-symbols-outlined text-[18px]">person_add</span>
                                Invite Team Member
                            </button>
                        )}
                    </Card>

                    {isOwner && (
                        <Card className="space-y-4">
                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-text-subtle)]">tune</span>
                                Project Controls
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <Select
                                        label="Status"
                                        value={project.status}
                                        onChange={(e) => handleUpdateField('status', e.target.value)}
                                        className="!py-2 !text-sm"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Planning">Planning</option>
                                        <option value="On Hold">On Hold</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Brainstorming">Brainstorming</option>
                                        <option value="Review">Review</option>
                                    </Select>

                                    <Select
                                        label="Priority"
                                        value={project.priority || 'Medium'}
                                        onChange={(e) => handleUpdateField('priority', e.target.value)}
                                        className="!py-2 !text-sm"
                                    >
                                        <option value="Low">Low Priority</option>
                                        <option value="Medium">Medium Priority</option>
                                        <option value="High">High Priority</option>
                                        <option value="Urgent">Urgent</option>
                                    </Select>
                                </div>

                                <div>
                                    <Select
                                        label="Project State"
                                        value={project.projectState || 'not specified'}
                                        onChange={(e) => handleUpdateField('projectState', e.target.value)}
                                        className="!py-2 !text-sm"
                                    >
                                        <option value="not specified">Not Specified</option>
                                        <option value="pre-release">Pre-Release</option>
                                        <option value="released">Released</option>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Start</label>
                                        <DatePicker
                                            value={project.startDate}
                                            onChange={(date) => handleUpdateField('startDate', date)}
                                            placeholder="Start Date"
                                            className="!py-2 !text-sm w-full"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Due</label>
                                        <DatePicker
                                            value={project.dueDate}
                                            onChange={(date) => handleUpdateField('dueDate', date)}
                                            placeholder="Due Date"
                                            className="!py-2 !text-sm w-full"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            </div >

            {/* Gallery Modal */}
            < Modal isOpen={showGalleryModal} onClose={() => setShowGalleryModal(false)} title="Project Gallery" size="xl" >
                <div className="space-y-4">
                    <div className="aspect-video w-full bg-black rounded-xl overflow-hidden flex items-center justify-center relative group">
                        {projectAssets[selectedImageIndex] ? (
                            <>
                                <img src={projectAssets[selectedImageIndex]} alt="Gallery" className="max-w-full max-h-[70vh] object-contain" />
                                {selectedImageIndex > 0 && (
                                    <button
                                        className="absolute left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex - 1); }}
                                    >
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                )}
                                {selectedImageIndex < projectAssets.length - 1 && (
                                    <button
                                        className="absolute right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex + 1); }}
                                    >
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="text-white/50">No Image</p>
                        )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto py-2">
                        {projectAssets.map((shot, idx) => (
                            <button
                                key={idx}
                                onClick={() => setSelectedImageIndex(idx)}
                                className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${selectedImageIndex === idx ? 'border-[var(--color-primary)] opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                            >
                                <img src={shot} alt="" className="w-full h-full object-cover" />
                            </button>
                        ))}
                    </div>
                </div>
            </Modal >

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
                        onClose={() => setShowEditModal(false)}
                        project={project}
                        onSave={handleSaveEdit}
                    />
                )
            }

            {/* Delete Modal */}
            <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Project"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteProject} isLoading={deletingProject}>Delete Project</Button>
                    </>
                }
            >
                <p className="text-sm text-[var(--color-text-muted)]">
                    Are you sure you want to delete <span className="font-bold text-[var(--color-text-main)]">{project.title}</span>? This action cannot be undone and will remove all associated tasks and data.
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
                        onGenerateLink={async (role: ProjectRole, maxUses?: number, expiresInHours?: number) => {
                            const { generateInviteLink } = await import('../services/dataService');
                            return await generateInviteLink(id || '', role, maxUses, expiresInHours, project.tenantId);
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
        </div >
    );
};
