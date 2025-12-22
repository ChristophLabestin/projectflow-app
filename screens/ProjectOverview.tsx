import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProjectById, toggleTaskStatus, updateProjectFields, addActivityEntry, deleteProjectById, subscribeProjectTasks, subscribeProjectActivity, subscribeProjectIdeas, subscribeProjectIssues, getActiveTenantId, generateInviteLink, getLatestGeminiReport, saveGeminiReport } from '../services/dataService';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { generateProjectReport, getGeminiInsight } from '../services/geminiService';
import { Activity, Idea, Project, Task, Issue, ProjectRole, GeminiReport } from '../types';
import { toMillis, timeAgo } from '../utils/time';
import { auth, storage } from '../services/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { ImageCropper } from '../components/ui/ImageCropper';
import { DonutChart } from '../components/charts/DonutChart';
import { TeamCard } from '../components/TeamCard';
import { InviteMemberModal } from '../components/InviteMemberModal';
import { MilestoneCard } from '../components/Milestones/MilestoneCard';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { Checkbox } from '../components/ui/Checkbox';
import { fetchLastCommits, fetchUserRepositories, GithubCommit, GithubRepo } from '../services/githubService';
import { getUserProfile, linkWithGithub, updateUserData } from '../services/dataService';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');



const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) return { icon: 'delete', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' };
        if (action.includes('reopened')) return { icon: 'undo', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' };
        if (action.includes('completed') || action.includes('done')) return { icon: 'check_circle', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' };
        return { icon: 'add_task', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' };
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
    if (name === 'activity') return { icon: 'history', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' };
    return { icon: 'more_horiz', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-[var(--color-surface-hover)]' };
};

import { updatePresence } from '../services/dataService';

export const ProjectOverview = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [insight, setInsight] = useState<string | null>(null);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
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

    // Permission system
    const { can, isOwner } = useProjectPermissions(project);

    // Edit Form State
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState<Project['status']>('Active');
    const [editPriority, setEditPriority] = useState<Project['priority'] | 'High' | 'Medium' | 'Low' | 'Urgent'>('Medium');
    const [editStartDate, setEditStartDate] = useState('');
    const [editDueDate, setEditDueDate] = useState('');
    const [editModules, setEditModules] = useState<Project['modules']>([]);
    const [editLinks, setEditLinks] = useState<{ title: string; url: string }[]>([]);
    const [editExternalResources, setEditExternalResources] = useState<{ title: string; url: string; icon?: string }[]>([]);
    const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
    const [editIconFile, setEditIconFile] = useState<File | null>(null);
    const [editGalleryFiles, setEditGalleryFiles] = useState<File[]>([]);
    const [editKeptGalleryUrls, setEditKeptGalleryUrls] = useState<string[]>([]);
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [coverRemoved, setCoverRemoved] = useState(false);
    const [iconRemoved, setIconRemoved] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [connectingGithub, setConnectingGithub] = useState(false);

    // GitHub Integration State
    const [githubCommits, setGithubCommits] = useState<GithubCommit[]>([]);
    const [githubLoading, setGithubLoading] = useState(false);
    const [githubError, setGithubError] = useState<string | null>(null);

    const [editGithubRepo, setEditGithubRepo] = useState('');
    const [editGithubIssueSync, setEditGithubIssueSync] = useState(false);
    const [userGithubRepos, setUserGithubRepos] = useState<GithubRepo[]>([]);
    const [fetchingRepos, setFetchingRepos] = useState(false);

    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [cropAspectRatio, setCropAspectRatio] = useState(1);
    const [cropType, setCropType] = useState<'cover' | 'icon' | null>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'icon') => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCropImageSrc(reader.result as string);
                setCropType(type);
                setCropAspectRatio(type === 'cover' ? 16 / 9 : 1);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handleCropComplete = (croppedBlob: Blob) => {
        if (cropType === 'cover') {
            const file = new File([croppedBlob], "cover.jpg", { type: "image/jpeg" });
            setEditCoverFile(file);
            setCoverRemoved(false);
        } else if (cropType === 'icon') {
            const file = new File([croppedBlob], "icon.jpg", { type: "image/jpeg" });
            setEditIconFile(file);
            setIconRemoved(false);
        }
        closeCropper();
    };

    const closeCropper = () => {
        setCropImageSrc(null);
        setCropType(null);
    };

    // Presence
    useEffect(() => {
        if (!id) return;
        updatePresence(id, 'online');
        const interval = setInterval(() => updatePresence(id, 'online'), 60000); // Heartbeat

        const handleUnload = () => {
            updatePresence(id, 'offline');
        };
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            clearInterval(interval);
            updatePresence(id, 'offline');
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, [id]);

    useEffect(() => {
        if (!id) return;
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
                // Initialize form
                setEditTitle(projData.title || '');
                setEditDescription(projData.description || '');
                setEditStatus(projData.status || 'Active');
                setEditPriority(projData.priority || 'Medium');
                setEditStartDate(projData.startDate || '');
                setEditDueDate(projData.dueDate || '');
                setEditModules(projData.modules || ['tasks', 'ideas', 'mindmap', 'activity']);
                setEditLinks(projData.links || []);
                setEditExternalResources(projData.externalResources || []);
                setEditKeptGalleryUrls(projData.screenshots || []);
                setEditGalleryFiles([]);
                setCoverRemoved(false);
                setIconRemoved(false);
                setEditCoverFile(null);
                setEditIconFile(null);

                // Initialize GitHub form
                setEditGithubRepo(projData.githubRepo || '');
                setEditGithubIssueSync(projData.githubIssueSync || false);

                // Fetch User's Repositories & Token if they have a linked account
                if (auth.currentUser) {
                    // Check Unauthorized Access
                    // 1. Check if user is in the tenant
                    const tenantProfile = await getUserProfile(auth.currentUser.uid, projData.tenantId);

                    // 2. Check if user is a member of the project
                    const isProjectMember = projData.members?.some(m => m.userId === auth.currentUser?.uid) || projData.ownerId === auth.currentUser.uid;

                    // If not in tenant AND not invited to project -> Unauthorized
                    if (!tenantProfile && !isProjectMember) {
                        setUnauthorized(true);
                        setLoading(false);
                        return;
                    }

                    const userProfile = tenantProfile || await getUserProfile(auth.currentUser.uid); // Fallback to default if cross-tenant?

                    // Fetch GitHub commits if repository is set
                    if (projData.githubRepo) {
                        setGithubLoading(true);
                        setGithubError(null);
                        const token = projData.githubToken || userProfile?.githubToken;
                        fetchLastCommits(projData.githubRepo, token)
                            .then(setGithubCommits)
                            .catch(err => setGithubError(err.message))
                            .finally(() => setGithubLoading(false));
                    }

                    if (userProfile?.githubToken) {
                        setFetchingRepos(true);
                        fetchUserRepositories(userProfile.githubToken)
                            .then(setUserGithubRepos)
                            .catch(e => console.error("Failed to fetch user repos", e))
                            .finally(() => setFetchingRepos(false));
                    }
                }

                const ai = await getGeminiInsight();
                setInsight(ai);

                // Fetch latest pinned report
                const latest = await getLatestGeminiReport(id);
                setPinnedReport(latest);

                // Subscribe to real-time data using the correct tenant
                const unsubTasks = subscribeProjectTasks(id, setTasks, projData.tenantId);
                const unsubActivity = subscribeProjectActivity(id, setActivity, projData.tenantId);
                const unsubIdeas = subscribeProjectIdeas(id, setIdeas, projData.tenantId);
                const unsubIssues = subscribeProjectIssues(id, setIssues, projData.tenantId);

                return () => {
                    unsubTasks();
                    unsubActivity();
                    unsubIdeas();
                    unsubIssues();
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

    const handleConnectGithub = async () => {
        if (!auth.currentUser) return;
        setConnectingGithub(true);
        try {
            const token = await linkWithGithub();
            await updateUserData(auth.currentUser.uid, { githubToken: token });
            // Fetch repos immediately
            setFetchingRepos(true);
            const repos = await fetchUserRepositories(token);
            setUserGithubRepos(repos);
        } catch (error: any) {
            console.error("Failed to link GitHub", error);
        } finally {
            setConnectingGithub(false);
            setFetchingRepos(false);
        }
    };

    useEffect(() => {
        if (pinnedReport?.createdAt) {
            const created = toMillis(pinnedReport.createdAt);
            const twoWeeks = 1000 * 60 * 60 * 24 * 14;
            setShowInsight(Date.now() - created > twoWeeks);
        } else {
            setShowInsight(true);
        }
    }, [pinnedReport]);

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!project) return;
        setTasks(tasks.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus, project.id);
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
        const tenant = getActiveTenantId() || project?.ownerId || auth?.currentUser?.uid || 'public';
        const path = `tenants/${tenant}/projects/${Date.now()}_${kind}_${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    };

    const handleSaveEdit = async () => {
        if (!project) return;
        setSavingEdit(true);
        try {
            const updates: Partial<Project> = {
                title: editTitle,
                description: editDescription,
                status: editStatus,
                priority: editPriority,
                startDate: editStartDate || null,
                dueDate: editDueDate || null,
                modules: editModules,
                links: editLinks,
                externalResources: editExternalResources,
                githubRepo: editGithubRepo,
                githubIssueSync: editGithubIssueSync
            };

            if (editCoverFile) {
                updates.coverImage = await uploadProjectAsset(editCoverFile, 'cover');
            } else if (coverRemoved) {
                updates.coverImage = null;
            }

            if (editIconFile) {
                updates.squareIcon = await uploadProjectAsset(editIconFile, 'icon');
            } else if (iconRemoved) {
                updates.squareIcon = null;
            }

            // Handle Gallery
            const newGalleryUrls = await Promise.all(editGalleryFiles.map(f => uploadProjectAsset(f, 'gallery')));
            updates.screenshots = [...editKeptGalleryUrls, ...newGalleryUrls];

            await updateProjectFields(project.id, updates, { action: 'Updated project details', target: project.title, type: 'status' });

            // Optimistic update or refetch
            const refreshed = await getProjectById(project.id);
            if (refreshed) setProject(refreshed);

            setShowEditModal(false);
        } catch (err) {
            console.error(err);
            setError('Failed to update project.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setEditGalleryFiles(prev => [...prev, ...files]);
        }
        e.target.value = '';
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

    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const openTasks = tasks.length - completedTasks;
    const urgentCount = tasks.filter(t => t.priority === 'Urgent').length;

    const priorityMap: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

    const recentTasks = tasks
        .filter(t => !t.isCompleted && t.status !== 'Done')
        .sort((a, b) => {
            const pA = priorityMap[a.priority || 'Medium'] || 0;
            const pB = priorityMap[b.priority || 'Medium'] || 0;
            if (pA !== pB) return pB - pA; // Descending Priority
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            return dateA - dateB; // Ascending Due Date
        })
        .slice(0, 5);

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

    return (
        <div className="flex flex-col gap-6 fade-in pb-10">
            <ImageCropper
                isOpen={!!cropImageSrc}
                imageSrc={cropImageSrc}
                aspectRatio={cropAspectRatio}
                onCropComplete={handleCropComplete}
                onCancel={closeCropper}
            />
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                {/* Cover Image */}
                <div className="relative w-full h-48 md:h-64 rounded-xl overflow-hidden bg-[var(--color-surface-hover)] border border-[var(--color-surface-border)]">
                    {project.coverImage ? (
                        <img src={project.coverImage} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 opacity-50" />
                    )}
                    <div className="absolute top-4 right-4 flex gap-2">
                        {isOwner && (
                            <>
                                <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)} icon={<span className="material-symbols-outlined">edit</span>}>
                                    Edit
                                </Button>
                                <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(true)} icon={<span className="material-symbols-outlined text-rose-500">delete</span>} />
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 md:items-start px-2">
                    {/* Project Icon */}
                    <div className="relative -mt-16 md:-mt-20 shrink-0">
                        <div className="size-24 md:size-32 rounded-2xl border-4 border-[var(--color-surface-paper)] bg-white shadow-md overflow-hidden flex items-center justify-center">
                            {project.squareIcon ? (
                                <img src={project.squareIcon} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-indigo-500">{project.title.charAt(0)}</span>
                            )}
                        </div>
                    </div>

                    {/* Title & Desc */}
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-3xl font-bold text-[var(--color-text-main)]">{project.title}</h1>
                            <Badge variant={project.status === 'Active' ? 'success' : 'primary'}>{project.status}</Badge>
                            <Badge variant="secondary">{project.priority} Priority</Badge>
                        </div>
                        <p className="text-[var(--color-text-muted)] text-lg leading-relaxed max-w-3xl">
                            {project.description || 'No description provided.'}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        {can('canManageTasks') && (
                            <Button onClick={() => setShowTaskModal(true)} icon={<span className="material-symbols-outlined">add_task</span>}>New Task</Button>
                        )}
                        {project.modules?.includes('ideas') && (
                            <Link to={`/project/${id}/ideas`}>
                                <Button variant="secondary" icon={<span className="material-symbols-outlined">lightbulb</span>}>Ideas</Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Col */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Card padding="sm" className="flex items-center gap-4 p-4 col-span-1 sm:col-span-2 md:col-span-2">
                            <div className="relative size-16 shrink-0">
                                <DonutChart
                                    data={[
                                        { name: 'Completed', value: completedTasks, color: 'var(--color-success)' },
                                        { name: 'Open', value: openTasks, color: 'var(--color-surface-border)' }
                                    ]}
                                    size={64}
                                    thickness={8}
                                    showEmptyLabel={false}
                                />
                                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">{progress}%</div>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-[var(--color-text-main)]">Task Progress</h4>
                                <p className="text-xs text-[var(--color-text-muted)]">{completedTasks} of {tasks.length} tasks completed</p>
                            </div>
                        </Card>

                        {[
                            { label: 'Open Tasks', value: openTasks, icon: 'list' },
                            { label: 'Urgent', value: urgentCount, icon: 'warning', color: urgentCount > 0 ? 'text-rose-500' : undefined },
                        ].map((stat, i) => (
                            <Card key={i} padding="sm" className="flex flex-col items-center justify-center text-center py-4">
                                <span className={`material-symbols-outlined text-2xl mb-1 ${stat.color || 'text-[var(--color-text-subtle)]'}`}>{stat.icon}</span>
                                <span className="text-xl font-bold text-[var(--color-text-main)]">{stat.value}</span>
                                <span className="text-xs text-[var(--color-text-muted)] uppercase font-semibold">{stat.label}</span>
                            </Card>
                        ))}
                    </div>

                    {/* AI Insight / Generator */}
                    {showInsight && (
                        <div className="rounded-xl p-5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/50">
                            <div className="flex items-start gap-4">
                                <span className="material-symbols-outlined text-indigo-500 text-3xl">auto_awesome</span>
                                <div className="space-y-2 flex-1">
                                    <h3 className="font-bold text-indigo-900 dark:text-indigo-100">AI Assistant</h3>
                                    <p className="text-sm text-indigo-800 dark:text-indigo-200 leading-relaxed">
                                        {cleanText(insight) || "Generate a report to get tailored guidance."}
                                    </p>
                                    <div className="flex gap-3 pt-2">
                                        <Button size="sm" variant="primary" onClick={handleGenerateReport} isLoading={reportLoading}>
                                            {pinnedReport ? 'Update Report' : 'Generate Report'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Latest Project Report */}
                    {pinnedReport && (
                        <div className="rounded-xl bg-white dark:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-sm overflow-hidden transition-all duration-300">
                            <div
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                                onClick={() => setReportExpanded(!reportExpanded)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-500/10 rounded-lg">
                                        <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">text_snippet</span>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[var(--color-text-main)]">Latest AI Report</h3>
                                        <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                                            Generated {timeAgo(pinnedReport.createdAt)} • By {pinnedReport.userName}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => { e.stopPropagation(); handleGenerateReport(); }}
                                        isLoading={reportLoading}
                                        icon={<span className="material-symbols-outlined">refresh</span>}
                                    >
                                        Regenerate
                                    </Button>
                                    <span className={`material-symbols-outlined text-[var(--color-text-muted)] transition-transform duration-300 ${reportExpanded ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </div>
                            </div>

                            {/* Expandable Content */}
                            <div className={`
                                border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]/30
                                transition-all duration-300 ease-in-out
                                ${reportExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}
                            `}>
                                <div className="p-6 text-sm text-[var(--color-text-main)] leading-relaxed whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                                    {cleanText(pinnedReport.content)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Tasks */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="h4">Recent Tasks</h3>
                            <Link to={`/project/${id}/tasks`} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">View All</Link>
                        </div>
                        <div className="flex flex-col gap-2">
                            {recentTasks.length === 0 ? (
                                <p className="text-center py-6 text-[var(--color-text-muted)]">No active tasks.</p>
                            ) : recentTasks.map(task => (
                                <div
                                    key={task.id}
                                    onClick={() => navigate(`/project/${id}/tasks/${task.id}`)}
                                    className="group flex items-center gap-3 p-3 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] hover:bg-[var(--color-surface-paper)] hover:border-[var(--color-primary)]/30 hover:shadow-sm transition-all cursor-pointer"
                                >
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleTask(task.id, task.isCompleted); }}
                                        className={`
                                            flex-shrink-0 size-5 rounded-[6px] border flex items-center justify-center transition-all duration-200
                                            ${task.isCompleted
                                                ? 'bg-green-500 border-green-500 text-white shadow-sm shadow-green-500/20'
                                                : 'border-[var(--color-surface-border)] hover:border-green-500 text-transparent bg-[var(--color-surface-paper)]'}
                                        `}
                                    >
                                        <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-sm font-semibold truncate hover:text-[var(--color-primary)] transition-colors ${task.isCompleted ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}>
                                                {task.title}
                                            </span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="material-symbols-outlined text-[var(--color-text-muted)] text-[16px]">arrow_forward</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 mt-1 text-xs">
                                            {task.priority && (
                                                <Badge size="sm" variant={task.priority === 'Urgent' ? 'danger' : task.priority === 'High' ? 'warning' : 'secondary'}>
                                                    {task.priority}
                                                </Badge>
                                            )}
                                            {task.dueDate && (
                                                <div className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.isCompleted ? 'text-rose-500 font-bold' : 'text-[var(--color-text-subtle)]'}`}>
                                                    <span className="material-symbols-outlined text-[12px]">event</span>
                                                    <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                            {task.scheduledDate && (
                                                <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-md">
                                                    <span className="material-symbols-outlined text-[14px]">event_available</span>
                                                    <span>Scheduled {new Date(task.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Recent Issues */}
                    {project.modules?.includes('issues') && (
                        <Card>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="h4">Recent Issues</h3>
                                <Link to={`/project/${id}/issues`} className="text-sm font-semibold text-[var(--color-primary)] hover:underline">View All</Link>
                            </div>
                            <div className="flex flex-col gap-2">
                                {recentIssues.length === 0 ? (
                                    <p className="text-center py-6 text-[var(--color-text-muted)]">No active issues.</p>
                                ) : recentIssues.map(issue => (
                                    <div key={issue.id} className="group flex items-center gap-3 p-3 rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] hover:bg-[var(--color-surface-paper)] hover:border-[var(--color-primary)]/30 hover:shadow-sm transition-all">
                                        <div className={`
                                            flex-shrink-0 size-8 rounded-lg flex items-center justify-center
                                            ${issue.status === 'Open' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' :
                                                issue.status === 'In Progress' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' :
                                                    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}
                                        `}>
                                            <span className="material-symbols-outlined text-[18px]">bug_report</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <Link to={`/project/${id}/issues/${issue.id}`} className="text-sm font-semibold truncate hover:text-[var(--color-primary)] transition-colors text-[var(--color-text-main)]">
                                                    {issue.title}
                                                </Link>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="material-symbols-outlined text-[var(--color-text-muted)] text-[16px]">arrow_forward</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 mt-1 text-xs">
                                                <Badge size="sm" variant={issue.priority === 'Urgent' ? 'danger' : issue.priority === 'High' ? 'warning' : 'secondary'}>
                                                    {issue.priority}
                                                </Badge>
                                                <span className={`flex items-center gap-1.5 font-medium ${issue.status === 'Open' ? 'text-blue-600 dark:text-blue-400' :
                                                    issue.status === 'In Progress' ? 'text-amber-600 dark:text-amber-400' :
                                                        'text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                    <span className="size-1.5 rounded-full bg-current"></span>
                                                    {issue.status}
                                                </span>
                                                {issue.scheduledDate && (
                                                    <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-md">
                                                        <span className="material-symbols-outlined text-[14px]">event_available</span>
                                                        <span>Scheduled {new Date(issue.scheduledDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Col */}
                <div className="space-y-6">
                    {/* Team Card */}
                    <TeamCard projectId={id || ''} tenantId={project?.tenantId} onInvite={can('canInvite') ? handleInvite : undefined} />

                    {/* Activity Stream */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="h4">Activity</h3>
                            <Link to={`/project/${id}/activity`} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">View History</Link>
                        </div>
                        <div className="space-y-6">
                            {activity.slice(0, 5).map((item, idx) => {
                                const { icon, color, bg } = activityIcon(item.type, item.action);
                                return (
                                    <div key={item.id} className="flex gap-3 relative">
                                        {idx !== 4 && <div className="absolute left-3.5 top-8 bottom-[-16px] w-px bg-[var(--color-surface-border)]" />}
                                        <div className={`size-7 rounded-full shrink-0 flex items-center justify-center ${bg} ${color}`}>
                                            <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                        </div>
                                        <div className="space-y-1 pb-1">
                                            <p className="text-sm text-[var(--color-text-main)] leading-snug">
                                                <span className="font-semibold">{item.user}</span> {item.action}
                                            </p>
                                            <p className="text-xs text-[var(--color-text-muted)]">{timeAgo(item.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                            {activity.length === 0 && <p className="text-sm text-[var(--color-text-muted)]">No recent activity.</p>}
                        </div>
                    </Card>

                    {/* Milestones (Right Col) */}
                    {(!project.modules || project.modules.includes('milestones')) && (
                        <div className="h-48 md:h-56">
                            <MilestoneCard projectId={project.id} />
                        </div>
                    )}

                    {/* GitHub Commits */}
                    {project.githubRepo && (
                        <Card>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-500">terminal</span>
                                    <h3 className="h4">Latest Commits</h3>
                                </div>
                                <a
                                    href={`https://github.com/${project.githubRepo}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1"
                                >
                                    Repo <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                </a>
                            </div>

                            {githubLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <span className="material-symbols-outlined animate-spin text-[var(--color-text-subtle)]">progress_activity</span>
                                </div>
                            ) : githubError ? (
                                <p className="text-xs text-rose-500 py-4">{githubError}</p>
                            ) : githubCommits.length === 0 ? (
                                <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">No recent commits found.</p>
                            ) : (
                                <div className="space-y-4">
                                    {githubCommits.map((commit) => (
                                        <div key={commit.sha} className="flex gap-3 relative last:mb-0">
                                            <div className="size-8 rounded-lg overflow-hidden shrink-0 border border-[var(--color-surface-border)] bg-[var(--color-surface-hover)]">
                                                {commit.author?.avatar_url ? (
                                                    <img src={commit.author.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                                                        {commit.commit.author.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[var(--color-text-main)] truncate leading-tight">
                                                    {commit.commit.message.split('\n')[0]}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[11px] text-[var(--color-text-muted)] font-semibold">{commit.author?.login || commit.commit.author.name}</span>
                                                    <span className="text-[10px] text-[var(--color-text-subtle)]">• {timeAgo(new Date(commit.commit.author.date))}</span>
                                                </div>
                                            </div>
                                            <a
                                                href={commit.html_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shrink-0 p-1 text-[var(--color-text-subtle)] hover:text-[var(--color-primary)] transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {/* Project Links */}
                    <Card>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="h4">Links</h3>
                        </div>
                        {project?.links && project.links.length > 0 ? (
                            <div className="space-y-2">
                                {project.links.map((link, i) => (
                                    <a
                                        key={i}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)] transition-colors group"
                                    >
                                        <div className="size-8 rounded-full bg-[var(--color-text-main)] text-[var(--color-surface-bg)] flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-[18px]">link</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate group-hover:text-[var(--color-primary)] transition-colors">{link.title}</p>
                                            <p className="text-xs text-[var(--color-text-muted)] truncate">{link.url}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-subtle)]">open_in_new</span>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--color-text-muted)]">No important links added.</p>
                        )}
                    </Card>

                    {/* Screenshots */}
                    <Card>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="h4">Gallery</h3>
                            <Button size="sm" variant="ghost" onClick={() => { setSelectedImageIndex(0); setShowGalleryModal(true); }}>View All</Button>
                        </div>
                        {project?.screenshots?.length ? (
                            <div className="grid grid-cols-2 gap-2">
                                {project.screenshots.slice(0, 4).map((shot, i) => (
                                    <div
                                        key={i}
                                        className="aspect-video rounded-lg bg-[var(--color-surface-hover)] overflow-hidden border border-[var(--color-surface-border)] cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => { setSelectedImageIndex(i); setShowGalleryModal(true); }}
                                    >
                                        <img src={shot} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-6 text-center border-2 border-dashed border-[var(--color-surface-border)] rounded-lg">
                                <p className="text-xs text-[var(--color-text-muted)]">No screenshots uploaded.</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div >

            {/* Gallery Modal */}
            < Modal isOpen={showGalleryModal} onClose={() => setShowGalleryModal(false)} title="Project Gallery" size="xl" >
                <div className="space-y-4">
                    <div className="aspect-video w-full bg-black rounded-xl overflow-hidden flex items-center justify-center relative group">
                        {project?.screenshots?.[selectedImageIndex] ? (
                            <>
                                <img src={project.screenshots[selectedImageIndex]} alt="Gallery" className="max-w-full max-h-[70vh] object-contain" />
                                {selectedImageIndex > 0 && (
                                    <button
                                        className="absolute left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(selectedImageIndex - 1); }}
                                    >
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                )}
                                {project.screenshots && selectedImageIndex < project.screenshots.length - 1 && (
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
                        {project?.screenshots?.map((shot, idx) => (
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

            {/* Edit Modal */}
            < Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Edit Project Details"
                size="xl"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit} isLoading={savingEdit}>Save Changes</Button>
                    </>
                }
            >
                <div className="space-y-6">
                    {/* Top Row: Title & Description */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <Input
                                label="Project Title"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full"
                            />
                            <Textarea
                                label="Description"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={4}
                                className="w-full"
                            />
                        </div>

                        <div className="space-y-4">
                            <Select
                                label="Status"
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value as any)}
                                className="w-full"
                            >
                                <option>Active</option>
                                <option>Planning</option>
                                <option>Completed</option>
                                <option>On Hold</option>
                            </Select>

                            <Select
                                label="Priority"
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as any)}
                                className="w-full"
                            >
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                                <option>Urgent</option>
                            </Select>

                            {/* Restored Image Uploads */}
                            <div className="space-y-2 pt-2 border-t border-[var(--color-surface-border)]">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Assets</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="cursor-pointer group relative flex flex-col items-center justify-center h-20 rounded-xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] dark:bg-[var(--color-surface-hover)]/30 transition-all overflow-hidden bg-cover bg-center" style={{ backgroundImage: !coverRemoved && (editCoverFile || project.coverImage) ? `url(${editCoverFile ? URL.createObjectURL(editCoverFile) : project.coverImage})` : 'none' }}>
                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => handleFileSelect(e, 'cover')} />
                                        {!coverRemoved && (editCoverFile || project.coverImage) ? (
                                            <div className="absolute top-1 right-1 z-20">
                                                <Button size="icon" variant="danger" className="size-6" onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setEditCoverFile(null);
                                                    setCoverRemoved(true);
                                                }}>
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-colors ${!coverRemoved && (editCoverFile || project.coverImage) ? 'bg-black/50 text-white opacity-0 group-hover:opacity-100' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]'}`}>
                                                <span className="material-symbols-outlined text-[20px]">image</span>
                                                <span className="text-[10px] font-medium mt-1">Change Cover</span>
                                            </div>
                                        )}
                                    </label>
                                    <label className="cursor-pointer group relative flex flex-col items-center justify-center h-20 rounded-xl border border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] dark:bg-[var(--color-surface-hover)]/30 transition-all overflow-hidden bg-cover bg-center" style={{ backgroundImage: !iconRemoved && (editIconFile || project.squareIcon) ? `url(${editIconFile ? URL.createObjectURL(editIconFile) : project.squareIcon})` : 'none' }}>
                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" accept="image/*" onChange={(e) => handleFileSelect(e, 'icon')} />
                                        {!iconRemoved && (editIconFile || project.squareIcon) ? (
                                            <div className="absolute top-1 right-1 z-20">
                                                <Button size="icon" variant="danger" className="size-6" onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setEditIconFile(null);
                                                    setIconRemoved(true);
                                                }}>
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className={`absolute inset-0 flex flex-col items-center justify-center transition-colors ${!iconRemoved && (editIconFile || project.squareIcon) ? 'bg-black/50 text-white opacity-0 group-hover:opacity-100' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]'}`}>
                                                <span className="material-symbols-outlined text-[20px]">apps</span>
                                                <span className="text-[10px] font-medium mt-1">Change Icon</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-[var(--color-surface-border)]" />

                    {/* Modules Grid */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Enabled Modules</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                            {['tasks', 'ideas', 'milestones', 'mindmap', 'activity', 'issues', 'social'].map(mod => (
                                <label key={mod} className={`
                                    flex flex-col items-center justify-center gap-2 cursor-pointer p-3 rounded-xl border transition-all text-center
                                    ${editModules?.includes(mod as any)
                                        ? 'border-[var(--color-primary)] bg-[var(--color-surface-hover)]'
                                        : 'border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'}
                                `}>
                                    <Checkbox
                                        checked={editModules ? editModules.includes(mod as any) : true}
                                        onChange={(e) => {
                                            const current = editModules || ['tasks', 'ideas', 'mindmap', 'activity', 'issues', 'social'];
                                            let next = [...current];
                                            if (e.target.checked) {
                                                if (!next.includes(mod as any)) next.push(mod as any);
                                            } else {
                                                next = next.filter(m => m !== mod);
                                            }
                                            setEditModules(next as any);
                                        }}
                                        className="hidden"
                                    />
                                    <div className={`
                                        size-8 rounded-full flex items-center justify-center transition-colors
                                        ${editModules?.includes(mod as any) ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'bg-[var(--color-surface-border)] text-[var(--color-text-muted)]'}
                                    `}>
                                        <span className="material-symbols-outlined text-[18px]">
                                            {mod === 'tasks' ? 'check_circle' :
                                                mod === 'ideas' ? 'lightbulb' :
                                                    mod === 'milestones' ? 'flag' :
                                                        mod === 'mindmap' ? 'hub' :
                                                            mod === 'social' ? 'campaign' :
                                                                mod === 'activity' ? 'history' : 'bug_report'}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold capitalize">{mod}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-[var(--color-surface-border)]" />

                    {/* GitHub Integration Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">GitHub Integration</label>
                            <Badge variant={editGithubRepo ? 'success' : 'secondary'}>{editGithubRepo ? 'Connected' : 'Disconnected'}</Badge>
                        </div>
                        <div className="bg-[var(--color-surface-hover)]/30 p-4 rounded-xl border border-[var(--color-surface-border)]">
                            <div className="space-y-4">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] ml-1">Repository Selection</label>
                                {userGithubRepos.length > 0 ? (
                                    <Select
                                        value={editGithubRepo}
                                        onChange={(e) => setEditGithubRepo(e.target.value)}
                                        icon="terminal"
                                    >
                                        <option value="">Select a repository...</option>
                                        {userGithubRepos.map(r => (
                                            <option key={r.id} value={r.full_name}>
                                                {r.full_name}
                                            </option>
                                        ))}
                                    </Select>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 bg-[var(--color-surface-paper)] rounded-lg border border-dashed border-[var(--color-surface-border)] gap-3">
                                        <div className="size-12 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
                                            <span className="material-symbols-outlined text-2xl">terminal</span>
                                        </div>
                                        <div className="text-center px-4">
                                            <p className="text-sm font-semibold text-[var(--color-text-main)]">GitHub Connection Required</p>
                                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Connect your account to browse and sync with your repositories.</p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={handleConnectGithub}
                                            isLoading={connectingGithub}
                                        >
                                            Link GitHub Account
                                        </Button>
                                    </div>
                                )}
                                {fetchingRepos && <p className="text-[10px] text-[var(--color-primary)] animate-pulse mt-1 ml-1">Fetching your repositories...</p>}
                            </div>

                            <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)]">
                                <div className="flex items-center gap-3 bg-[var(--color-surface-paper)]/50 p-3 rounded-lg border border-[var(--color-surface-border)]">
                                    <Checkbox
                                        id="github-sync-toggle"
                                        checked={editGithubIssueSync}
                                        onChange={(e) => setEditGithubIssueSync(e.target.checked)}
                                    />
                                    <label htmlFor="github-sync-toggle" className="text-sm font-medium cursor-pointer text-[var(--color-text-main)]">
                                        Enable GitHub Issue Sync
                                        <span className="block text-[10px] text-[var(--color-text-muted)] font-normal">Automatically cross-post issues to the selected repository</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-[var(--color-surface-border)]" />

                    {/* Resources & Links */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Sidebar Resources */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Sidebar Resources</label>
                                <Button size="sm" variant="ghost" onClick={() => setEditExternalResources([...editExternalResources, { title: '', url: '', icon: 'open_in_new' }])} icon={<span className="material-symbols-outlined">add</span>}>
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                {editExternalResources.length === 0 && <p className="text-xs text-[var(--color-text-muted)] py-2">No sidebar resources.</p>}
                                {editExternalResources.map((res, idx) => (
                                    <div key={idx} className="flex gap-2 items-start group">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                placeholder="Label"
                                                value={res.title}
                                                onChange={(e) => {
                                                    const newRes = [...editExternalResources];
                                                    newRes[idx].title = e.target.value;
                                                    setEditExternalResources(newRes);
                                                }}
                                            />
                                            <Input
                                                placeholder="https://..."
                                                value={res.url}
                                                onChange={(e) => {
                                                    const newRes = [...editExternalResources];
                                                    newRes[idx].url = e.target.value;
                                                    setEditExternalResources(newRes);
                                                }}
                                            />
                                        </div>
                                        <button onClick={() => setEditExternalResources(editExternalResources.filter((_, i) => i !== idx))} className="text-[var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Overview Links */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">Overview Links</label>
                                <Button size="sm" variant="ghost" onClick={() => setEditLinks([...editLinks, { title: '', url: '' }])} icon={<span className="material-symbols-outlined">add</span>}>
                                    Add
                                </Button>
                            </div>
                            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
                                {editLinks.length === 0 && <p className="text-xs text-[var(--color-text-muted)] py-2">No overview links.</p>}
                                {editLinks.map((link, idx) => (
                                    <div key={idx} className="flex gap-2 items-start group">
                                        <div className="flex-1 space-y-1">
                                            <Input
                                                placeholder="Title"
                                                value={link.title}
                                                onChange={(e) => {
                                                    const newLinks = [...editLinks];
                                                    newLinks[idx].title = e.target.value;
                                                    setEditLinks(newLinks);
                                                }}
                                            />
                                            <Input
                                                placeholder="https://..."
                                                value={link.url}
                                                onChange={(e) => {
                                                    const newLinks = [...editLinks];
                                                    newLinks[idx].url = e.target.value;
                                                    setEditLinks(newLinks);
                                                }}
                                            />
                                        </div>
                                        <button onClick={() => setEditLinks(editLinks.filter((_, i) => i !== idx))} className="text-[var(--color-text-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </Modal >

            {/* Delete Modal */}
            < Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Project"
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
            </Modal >

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
        </div >
    );
};
