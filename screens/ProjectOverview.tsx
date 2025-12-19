import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProjectById, toggleTaskStatus, updateProjectFields, addActivityEntry, deleteProjectById, subscribeProjectTasks, subscribeProjectActivity, subscribeProjectIdeas, getActiveTenantId } from '../services/dataService';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { generateProjectReport, getGeminiInsight } from '../services/geminiService';
import { Activity, Idea, Project, Task } from '../types';
import { toMillis } from '../utils/time';
import { auth, storage } from '../services/firebase';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const cleanText = (value?: string | null) => (value || '').replace(/\*\*/g, '');
const timeAgo = (timestamp?: any) => {
    if (!timestamp) return '';
    const diff = Date.now() - toMillis(timestamp);
    const mins = Math.max(0, Math.round(diff / 60000));
    if (mins < 60) return `${mins || 1} min${mins === 1 ? '' : 's'} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
};
const formatToParagraph = (value: string) => {
    const cleaned = value
        .split(/\n+/)
        .map(line => line.replace(/^[*-]\s*/, '').trim())
        .filter(Boolean)
        .join(' ');
    return cleaned;
};

const buildSimpleSummary = (raw: string, project?: Project | null, tasks: Task[] = [], ideas: Idea[] = []) => {
    const paragraph = formatToParagraph(cleanText(raw || '')).replace(/\s+/g, ' ').trim();
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
    const noiseTokens = ['status report', 'status:', 'priority:', 'start:', 'due:', 'dates:', 'description:'];
    const filteredSentences = sentences.filter(s => !noiseTokens.some(n => s.toLowerCase().includes(n)));

    const projectName = project?.title || 'This project';
    const topTasks = tasks.slice(0, 3).map(t => t.title).filter(Boolean);
    const topIdeas = ideas.slice(0, 2).map(i => i.title).filter(Boolean);

    const firstIdea = filteredSentences[0]?.replace(/^(this project|project)\s+/i, '').replace(/^is\s+/i, '').replace(/^aims to\s+/i, '').trim();
    const ideaLead = topIdeas.length ? `${projectName} is a project exploring ${topIdeas.join(', ')}.` : '';
    const lead = firstIdea
        ? `${projectName} is ${firstIdea}`
        : (ideaLead || `${projectName} is a project to achieve its key goals.`);

    const taskLine = topTasks.length ? `It tackles work like ${topTasks.join(', ')}.` : '';
    const ideaLine = topIdeas.length ? `It explores ideas such as ${topIdeas.join(', ')}.` : '';

    const combined = [lead, taskLine, ideaLine].filter(Boolean).join(' ');
    const trimmed = combined.length > 260 ? `${combined.slice(0, 257).trimEnd()}...` : combined;
    return trimmed || `${projectName} is a project to achieve its key goals.`;
};
const activityIcon = (type?: Activity['type'], actionText?: string) => {
    const action = (actionText || '').toLowerCase();
    if (type === 'task') {
        if (action.includes('deleted') || action.includes('remove')) {
            return { bg: 'bg-rose-100', icon: 'delete', iconColor: 'text-rose-700' };
        }
        if (action.includes('reopened')) {
            return { bg: 'bg-amber-100', icon: 'undo', iconColor: 'text-amber-700' };
        }
        if (action.includes('completed') || action.includes('done')) {
            return { bg: 'bg-emerald-100', icon: 'check', iconColor: 'text-emerald-700' };
        }
        return { bg: 'bg-blue-100', icon: 'add_task', iconColor: 'text-blue-700' };
    }
    if (type === 'status') return { bg: 'bg-indigo-100', icon: 'swap_horiz', iconColor: 'text-indigo-700' };
    if (type === 'report') return { bg: 'bg-purple-100', icon: 'auto_awesome', iconColor: 'text-purple-700' };
    if (type === 'comment') return { bg: 'bg-amber-100', icon: 'chat_bubble', iconColor: 'text-amber-700' };
    if (type === 'file') return { bg: 'bg-slate-100', icon: 'attach_file', iconColor: 'text-slate-700' };
    if (type === 'commit') return { bg: 'bg-blue-100', icon: 'code', iconColor: 'text-blue-700' };
    if (type === 'priority') {
        if (action.includes('raised') || action.includes('high') || action.includes('urgent')) {
            return { bg: 'bg-rose-100', icon: 'priority_high', iconColor: 'text-rose-700' };
        }
        return { bg: 'bg-emerald-100', icon: 'low_priority', iconColor: 'text-emerald-700' };
    }
    return { bg: 'bg-slate-100', icon: 'more_horiz', iconColor: 'text-slate-700' };
};

export const ProjectOverview = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingStatus, setSavingStatus] = useState(false);
    const [savingPriority, setSavingPriority] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [activity, setActivity] = useState<Activity[]>([]);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<string | null>(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [lastReport, setLastReport] = useState<string | null>(null);
    const [showInsight, setShowInsight] = useState<boolean>(true);
    const [showMenu, setShowMenu] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editStatus, setEditStatus] = useState<Project['status']>('Active');
    const [editPriority, setEditPriority] = useState<Project['priority'] | 'High' | 'Medium' | 'Low' | 'Urgent'>('Medium');
    const [editStartDate, setEditStartDate] = useState('');
    const [editDueDate, setEditDueDate] = useState('');
    const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
    const [editIconFile, setEditIconFile] = useState<File | null>(null);
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingProject, setDeletingProject] = useState(false);
    const [generatingDesc, setGeneratingDesc] = useState(false);

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
                setEditTitle(projData.title || '');
                setEditDescription(projData.description || '');
                setEditStatus(projData.status || 'Active');
                setEditPriority(projData.priority || 'Medium');
                setEditStartDate(projData.startDate || '');
                setEditDueDate(projData.dueDate || '');
                setEditCoverFile(null);
                setEditIconFile(null);
                const ai = await getGeminiInsight();
                setInsight(ai);
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
        if (!id) return;
        const unsubTasks = subscribeProjectTasks(id, setTasks);
        const unsubActivity = subscribeProjectActivity(id, setActivity);
        const unsubIdeas = subscribeProjectIdeas(id, setIdeas);
        return () => {
            unsubTasks();
            unsubActivity();
            unsubIdeas();
        };
    }, [id]);

    useEffect(() => {
        const existingReport = activity.find(a => a.type === 'report');
        setLastReport(existingReport?.details || null);
        if (existingReport?.createdAt) {
            const created = toMillis(existingReport.createdAt);
            const aMonth = 1000 * 60 * 60 * 24 * 30;
            setShowInsight(Date.now() - created > aMonth);
        } else {
            setShowInsight(!existingReport);
        }
    }, [activity]);

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        // Optimistic update
        setTasks(tasks.map(t => t.id === taskId ? { ...t, isCompleted: !currentStatus } : t));
        await toggleTaskStatus(taskId, currentStatus);
    };

    const handleGenerateReport = async () => {
        if (!project) return;
        setReportLoading(true);
        setError(null);
        try {
            const rep = await generateProjectReport(project, tasks);
            setReport(rep);
            setLastReport(rep);
            await addActivityEntry(project.id, { action: "Generated project report", target: project.title, details: rep, type: "report", user: auth?.currentUser?.displayName || "User" });
        } catch (e) {
            console.error(e);
            setError("Could not generate report. Please try again.");
        } finally {
            setReportLoading(false);
        }
    };

    if (loading) return <div className="flex h-full items-center justify-center"><span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span></div>;
    if (!project) return <div className="p-8">Project not found</div>;

    const completedTasks = tasks.filter(t => t.isCompleted).length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const openTasks = tasks.length - completedTasks;

    const statusOptions: Project['status'][] = ['Brainstorming', 'Planning', 'Active', 'Review', 'On Hold', 'Completed'];
    const priorityOptions: Array<Project['priority'] | 'High' | 'Medium' | 'Low' | 'Urgent'> = ['Low', 'Medium', 'High', 'Urgent'];
    const urgentCount = tasks.filter(t => t.priority === 'Urgent').length;
    const ideasCount = ideas.length;

    const priorityTasks = [...tasks].sort((a, b) => {
        const rank: Record<string, number> = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        return (rank[a.priority || 'Medium'] ?? 2) - (rank[b.priority || 'Medium'] ?? 2);
    }).slice(0, 4);
    const recentTasks = [...tasks].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)).slice(0, 5);

    const handleStatusChange = async (nextStatus: Project['status']) => {
        if (!project || project.status === nextStatus) return;
        setSavingStatus(true);
        const prev = project.status;
        setProject({ ...project, status: nextStatus });
        try {
            await updateProjectFields(project.id, { status: nextStatus }, { action: `Status set to ${nextStatus}`, target: "Status", type: "status" });
        } catch (err) {
            console.error(err);
            setProject({ ...project, status: prev });
        } finally {
            setSavingStatus(false);
        }
    };

    const handlePriorityChange = async (nextPriority: string) => {
        if (!project || project.priority === nextPriority) return;
        setSavingPriority(true);
        const prev = project.priority;
        setProject({ ...project, priority: nextPriority });
        try {
            await updateProjectFields(project.id, { priority: nextPriority }, { action: `Priority set to ${nextPriority}`, target: "Priority", type: "priority" });
        } catch (err) {
            console.error(err);
            setProject({ ...project, priority: prev });
        } finally {
            setSavingPriority(false);
        }
    };

    const reportButtonLabel = report || lastReport
        ? (reportLoading ? 'Generating...' : 'Generate new report')
        : (reportLoading ? 'Generating...' : 'Generate report');

    const uploadProjectAsset = async (file: File, kind: 'cover' | 'icon') => {
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
                dueDate: editDueDate || null
            };

            if (editCoverFile) {
                updates.coverImage = await uploadProjectAsset(editCoverFile, 'cover');
            }
            if (editIconFile) {
                updates.squareIcon = await uploadProjectAsset(editIconFile, 'icon');
            }

            await updateProjectFields(project.id, updates, { action: 'Updated project details', target: project.title, type: 'status' });
            const refreshed = await getProjectById(project.id);
            if (refreshed) setProject(refreshed);
            if (refreshed) {
                setEditTitle(refreshed.title || '');
                setEditDescription(refreshed.description || '');
                setEditStatus(refreshed.status || 'Active');
                setEditPriority(refreshed.priority || 'Medium');
                setEditStartDate(refreshed.startDate || '');
                setEditDueDate(refreshed.dueDate || '');
            }
            setEditCoverFile(null);
            setEditIconFile(null);
            setShowEditModal(false);
        } catch (err) {
            console.error(err);
            setError('Failed to update project.');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleGenerateDescription = async () => {
        if (!project) return;
        setGeneratingDesc(true);
        setError(null);
        try {
            const description = await generateProjectReport(project, tasks);
            setEditDescription(buildSimpleSummary(description || '', project, tasks, ideas));
        } catch (err) {
            console.error(err);
            setError('Failed to generate description.');
        } finally {
            setGeneratingDesc(false);
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

    return (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-10 py-6 relative space-y-8">
            {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">{error}</div>}
            <section className="space-y-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-8 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {project.squareIcon && (
                                <div className="size-12 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white">
                                    <img src={project.squareIcon} alt="" className="w-full h-full object-cover" />
                                </div>
                            )}
                            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{project.title}</h1>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold uppercase tracking-wide border border-emerald-200 dark:border-emerald-800">{project.status || 'Active'}</span>
                        </div>
                        {project.description && (
                            <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed max-w-3xl">
                                {project.description}
                            </p>
                        )}
                    </div>
                    <div className="xl:col-span-4 w-full flex flex-col gap-3 items-stretch">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button onClick={() => setShowTaskModal(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-bold shadow-sm hover:bg-slate-900">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                New Task
                            </button>
                            <Link to={`/project/${id}/ideas`} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-slate-400">
                                <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                                Ideas
                            </Link>
                            <div className="relative">
                                <button onClick={() => setShowMenu(prev => !prev)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-400">
                                    <span className="material-symbols-outlined">more_horiz</span>
                                </button>
                                {showMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-30">
                                        <button
                                            onClick={() => { setShowMenu(false); setShowEditModal(true); }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                        >
                                            Edit project
                                        </button>
                                        <button
                                            onClick={() => { setShowMenu(false); setShowDeleteModal(true); }}
                                            className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                                        >
                                            Delete project
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard label="Open Tasks" value={openTasks} delta={`${tasks.length} total`} deltaColor="text-slate-500" icon="checklist" />
                            <StatCard label="Ideas" value={ideasCount} delta={`${ideasCount} collected`} deltaColor="text-slate-500" icon="lightbulb" />
                            <StatCard label="Blockers" value={urgentCount} delta={urgentCount ? 'Needs attention' : 'All clear'} deltaColor={urgentCount ? 'text-rose-500' : 'text-emerald-500'} icon="warning" />
                            <StatCard label="Progress" value={`${progress}%`} delta={`${completedTasks} done`} deltaColor="text-slate-500" icon="trending_up" />
                        </div>

                        {(report || lastReport) && (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-slate-500">description</span>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Generated Report</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setReport(null)} className="text-xs text-slate-500">Clear</button>
                                        <button
                                            onClick={handleGenerateReport}
                                            disabled={reportLoading}
                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-black text-white disabled:opacity-50"
                                        >
                                            {reportButtonLabel}
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{cleanText(report || lastReport)}</p>
                            </div>
                        )}

                        {showInsight && (
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-900/50 p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-[0.05em] mb-2">
                                            <span className="material-symbols-outlined text-[18px]">stars</span>
                                            Gemini Insight
                                        </div>
                                        <p className="text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                                            {cleanText(insight) || "Generate a report to get tailored guidance for this project."}
                                        </p>
                                        <div className="flex gap-3 mt-3">
                                            <button onClick={handleGenerateReport} disabled={reportLoading} className="px-3 py-2 text-sm font-bold rounded-lg bg-black text-white disabled:opacity-50">
                                                {reportButtonLabel}
                                            </button>
                                            <button onClick={() => setShowInsight(false)} className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300">Dismiss for a month</button>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-300 text-[32px]">auto_awesome</span>
                                </div>
                            </div>
                        )}

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase text-slate-500">Tasks Snapshot</p>
                                    <p className="text-sm text-slate-500">Recent work across this project</p>
                                </div>
                                <Link to={`/project/${id}/tasks`} className="text-sm font-bold text-black dark:text-white hover:underline">Open tasks</Link>
                            </div>
                            <div className="flex gap-3 flex-wrap">
                                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">Open: {openTasks}</span>
                                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200">Done: {completedTasks}</span>
                                <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200">Urgent: {urgentCount}</span>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {recentTasks.length === 0 ? (
                                    <div className="py-6 text-sm text-slate-500 text-center">No tasks yet. Start by creating one.</div>
                                ) : recentTasks.map(task => (
                                    <div key={task.id} className="py-3 flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            readOnly
                                            checked={task.isCompleted}
                                            onClick={() => handleToggleTask(task.id, task.isCompleted)}
                                            className="mt-1 size-4 rounded border-slate-300 dark:border-slate-600 text-black"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <Link to={`/project/${id}/tasks/${task.id}`} className={`text-sm font-bold truncate ${task.isCompleted ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                                                {task.title}
                                            </Link>
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                                                {task.priority && <span className="px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold">{task.priority}</span>}
                                                {task.status && <span className="px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold">{task.status}</span>}
                                                {task.dueDate && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">calendar_today</span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    <div className="space-y-4">
                <div id="details" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full bg-slate-900 dark:bg-white rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                        <span className="text-xs text-slate-600 font-semibold whitespace-nowrap">{progress}% Done</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-4">Project Details</h3>
                            <div className="space-y-4 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Start Date</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{project.startDate || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Due Date</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{project.dueDate || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Priority</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{project.priority || 'Medium'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-lg font-extrabold text-slate-900 dark:text-white">Activity Stream</h4>
                            </div>
                            <div className="space-y-6">
                                {activity.length === 0 ? (
                                    <div className="text-sm text-slate-500">No recent activity.</div>
                                ) : activity.slice(0,4).map((item, idx, arr) => {
                                    const iconMeta = activityIcon(item.type, item.action);
                                    return (
                                        <div key={item.id} className="relative pl-7">
                                            {idx < arr.length - 1 && <span className="absolute left-3 top-6 bottom-[-10px] w-px bg-slate-200"></span>}
                                            <span className={`absolute left-0 top-2 size-7 rounded-full flex items-center justify-center ${iconMeta.bg}`}>
                                                <span className={`material-symbols-outlined text-[16px] ${iconMeta.iconColor}`}>{iconMeta.icon}</span>
                                            </span>
                                            <div className="flex-1 min-w-0 space-y-1 pl-2">
                                                <p className="text-base text-slate-800 dark:text-slate-200 leading-snug">
                                                    <span className="font-extrabold">{item.user || 'User'}</span> {item.action}
                                                </p>
                                                <p className="text-sm text-slate-500 leading-snug line-clamp-2">"{cleanText(item.details || item.target)}"</p>
                                                <p className="text-sm text-slate-400">{timeAgo(item.createdAt) || 'Just now'}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="pt-2 border-t border-slate-200">
                                <Link to={`/project/${id}/activity`} className="block text-center text-base font-semibold text-slate-500 hover:text-slate-800">
                                    View all history
                                </Link>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-slate-900 dark:text-white">Recent Ideas</h4>
                                <Link to={`/project/${id}/ideas`} className="text-xs text-slate-500">View all</Link>
                            </div>
                            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                {ideas.length === 0 ? (
                                    <div className="text-slate-500 text-sm">No recent ideas.</div>
                                ) : ideas.slice(0,3).map(idea => (
                                    <div key={idea.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                        <p className="font-semibold text-slate-800 dark:text-slate-100">{idea.title}</p>
                                        <p className="text-xs text-slate-500 line-clamp-2">{idea.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-slate-900 dark:text-white">Gallery</h4>
                                {project?.screenshots?.length ? <span className="text-xs text-slate-500">{project.screenshots.length} screenshots</span> : null}
                            </div>
                            {project?.screenshots && project.screenshots.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {project.screenshots.map((shot, idx) => (
                                        <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                                            <img src={shot} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-500 dark:text-slate-400">No screenshots yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {showEditModal && (
                <Modal onClose={() => setShowEditModal(false)}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 dark:text-white">Edit Project</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-sm text-slate-500">Close</button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" rows={4} />
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-slate-500">Let Gemini draft a description from tasks and ideas.</span>
                                    <button
                                        type="button"
                                        onClick={handleGenerateDescription}
                                        disabled={generatingDesc}
                                        className="text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:border-slate-400 disabled:opacity-50"
                                    >
                                        {generatingDesc ? 'Generating…' : 'Generate description'}
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as Project['status'])} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm">
                                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
                                    <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as any)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm">
                                        {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                                    <input
                                        type="date"
                                        value={editStartDate}
                                        onChange={(e) => setEditStartDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Due Date</label>
                                    <input
                                        type="date"
                                        value={editDueDate}
                                        onChange={(e) => setEditDueDate(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Cover image</label>
                                    <label className="relative h-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center cursor-pointer overflow-hidden">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) setEditCoverFile(e.target.files[0]);
                                            }}
                                        />
                                        {editCoverFile ? (
                                            <img src={URL.createObjectURL(editCoverFile)} alt="Cover preview" className="w-full h-full object-cover" />
                                        ) : project?.coverImage ? (
                                            <img src={project.coverImage} alt="Current cover" className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-slate-500 text-xs font-semibold">
                                                <span className="material-symbols-outlined text-base">cloud_upload</span>
                                                Upload cover
                                            </div>
                                        )}
                                    </label>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Square icon</label>
                                    <label className="relative size-24 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-center cursor-pointer overflow-hidden">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) setEditIconFile(e.target.files[0]);
                                            }}
                                        />
                                        {editIconFile ? (
                                            <img src={URL.createObjectURL(editIconFile)} alt="Icon preview" className="w-full h-full object-cover" />
                                        ) : project?.squareIcon ? (
                                            <img src={project.squareIcon} alt="Current icon" className="w-full h-full object-cover opacity-80" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-slate-500 text-xs font-semibold">
                                                <span className="material-symbols-outlined text-base">apps</span>
                                                Upload icon
                                            </div>
                                        )}
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowEditModal(false)} className="px-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                            <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-sm font-bold bg-black text-white rounded-lg disabled:opacity-50">
                                {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showDeleteModal && (
                <Modal onClose={() => setShowDeleteModal(false)}>
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-900 dark:text-white">Delete Project</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Are you sure you want to delete this project? This cannot be undone.</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowDeleteModal(false)} className="px-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg">Cancel</button>
                            <button onClick={handleDeleteProject} disabled={deletingProject} className="px-4 py-2 text-sm font-bold bg-rose-600 text-white rounded-lg disabled:opacity-50">
                                {deletingProject ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {showTaskModal && project && (
                <TaskCreateModal
                    projectId={project.id}
                    onClose={() => setShowTaskModal(false)}
                    onCreated={(updatedTasks) => {
                        setTasks(updatedTasks);
                        setShowTaskModal(false);
                    }}
                />
            )}

        </div>
    );
};

const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const StatCard = ({ label, value, delta, deltaColor, icon }: { label: string; value: string | number; delta: string; deltaColor: string; icon: string }) => (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-500 uppercase">{label}</div>
            <span className="material-symbols-outlined text-slate-400 text-[18px]">{icon}</span>
        </div>
        <div className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">{value}</div>
        <p className={`text-xs ${deltaColor}`}>{delta}</p>
    </div>
);
