import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    getPersonalTaskById,
    updatePersonalTask,
    deletePersonalTask,
    togglePersonalTaskStatus,
    movePersonalTaskToProject,
    getUserProjects
} from '../services/dataService';
import { PersonalTask, Project } from '../types';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';
import { useConfirm, useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';

export const PersonalTaskDetailPage = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { showSuccess, showError } = useToast();
    const { dateFormat, dateLocale } = useLanguage();

    const [task, setTask] = useState<PersonalTask | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showMoveDropdown, setShowMoveDropdown] = useState(false);
    const [moving, setMoving] = useState(false);
    const [editingDescription, setEditingDescription] = useState(false);
    const [descValue, setDescValue] = useState('');

    useEffect(() => {
        loadData();
    }, [taskId]);

    const loadData = async () => {
        if (!taskId) return;
        try {
            const [taskData, projectsData] = await Promise.all([
                getPersonalTaskById(taskId),
                getUserProjects()
            ]);
            setTask(taskData);
            setProjects(projectsData);
            if (taskData) {
                setDescValue(taskData.description || '');
            }
        } catch (error) {
            console.error('Failed to load task', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTask = async () => {
        if (!task) return;
        const newStatus = !task.isCompleted;
        setTask({ ...task, isCompleted: newStatus, status: newStatus ? 'Done' : 'Open' });
        await togglePersonalTaskStatus(task.id, task.isCompleted);
    };

    const handleDeleteTask = async () => {
        if (!task) return;
        setDeleting(true);
        try {
            await deletePersonalTask(task.id);
            navigate('/personal-tasks');
        } catch (error) {
            console.error('Failed to delete task', error);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleUpdateField = async (field: keyof PersonalTask, value: any) => {
        if (!task) return;
        setTask({ ...task, [field]: value });
        await updatePersonalTask(task.id, { [field]: value });
    };

    const handleSaveDescription = async () => {
        if (!task) return;
        await updatePersonalTask(task.id, { description: descValue });
        setTask({ ...task, description: descValue });
        setEditingDescription(false);
    };

    const handleMoveToProject = async (projectId: string) => {
        if (!task) return;
        setMoving(true);
        setShowMoveDropdown(false);

        try {
            const newTaskId = await movePersonalTaskToProject(task.id, projectId);
            const project = projects.find(p => p.id === projectId);
            showSuccess(`Task moved to "${project?.title || 'project'}"`);
            navigate(`/project/${projectId}/tasks/${newTaskId}`);
        } catch (error: any) {
            console.error('Failed to move task', error);
            showError(`Failed to move task: ${error.message}`);
            setMoving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)]">progress_activity</span>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h3 className="text-xl font-bold text-[var(--color-text-main)]">Task not found</h3>
                <Link to="/personal-tasks" className="btn-secondary">Return to Personal Tasks</Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 animate-fade-in pb-20">
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)]">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Delete Task?</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Are you sure you want to delete <strong>"{task.title}"</strong>?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                                <Button variant="danger" onClick={handleDeleteTask} isLoading={deleting}>Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Header Section */}
            <header className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-bg)] border border-[var(--color-surface-border)] shadow-sm">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-primary)]/5 blur-3xl rounded-full -mr-20 -mt-20 pointer-events-none" />

                <div className="relative px-6 py-8 md:px-10 md:py-10">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-4 flex-wrap">
                                {/* Personal Task Badge */}
                                <Link to="/personal-tasks" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 transition-all group">
                                    <span className="material-symbols-outlined text-[14px] text-indigo-500">person</span>
                                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Personal</span>
                                </Link>

                                {/* Status Badge */}
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${task.status === 'Done' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                    task.status === 'In Progress' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                    }`}>
                                    <span className="material-symbols-outlined text-[14px] leading-none">
                                        {task.status === 'Done' ? 'check_circle' : 'radio_button_unchecked'}
                                    </span>
                                    {task.status || 'Open'}
                                </span>

                                {/* Priority Badge */}
                                {task.priority && (
                                    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${task.priority === 'Urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                        task.priority === 'High' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                                            task.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                                'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                        }`}>
                                        {task.priority}
                                    </span>
                                )}
                            </div>

                            <h1 className="text-3xl md:text-4xl font-black text-[var(--color-text-main)] leading-[1.1] tracking-tight mb-6">
                                {task.title}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                {task.dueDate && (
                                    <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-surface-hover)] rounded-xl border border-[var(--color-surface-border)]">
                                        <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">calendar_today</span>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] leading-none uppercase font-bold text-[var(--color-text-subtle)] mb-0.5">Due Date</span>
                                            <span className="text-[var(--color-text-main)] font-semibold whitespace-nowrap">
                                                {format(new Date(task.dueDate), dateFormat, { locale: dateLocale })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col items-stretch lg:items-end gap-3 lg:mb-1">
                            <div className="flex items-center gap-2 bg-[var(--color-surface-hover)] p-1 rounded-xl border border-[var(--color-surface-border)] w-full lg:w-fit">
                                {/* Move to Project Button */}
                                <div className="relative">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowMoveDropdown(!showMoveDropdown)}
                                        disabled={moving}
                                        className="flex-1 lg:flex-none hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600"
                                        icon={moving ?
                                            <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span> :
                                            <span className="material-symbols-outlined text-[20px]">drive_file_move</span>
                                        }
                                    >
                                        Move to Project
                                    </Button>

                                    {showMoveDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowMoveDropdown(false)} />
                                            <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl overflow-hidden animate-scale-up origin-top-right">
                                                <div className="px-3 py-2 border-b border-[var(--color-surface-border)] text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                                                    Select Project
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {projects.length === 0 ? (
                                                        <div className="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">
                                                            No projects available
                                                        </div>
                                                    ) : (
                                                        projects.map(project => (
                                                            <button
                                                                key={project.id}
                                                                onClick={() => handleMoveToProject(project.id)}
                                                                className="w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2"
                                                            >
                                                                <span className="size-2 rounded-full bg-[var(--color-primary)]" />
                                                                <span className="truncate text-[var(--color-text-main)]">{project.title}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="w-[1px] h-4 bg-[var(--color-surface-border)]" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 lg:flex-none text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() => setShowDeleteConfirm(true)}
                                >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                </Button>
                            </div>

                            <Button
                                variant={task.isCompleted ? 'secondary' : 'primary'}
                                onClick={handleToggleTask}
                                size="lg"
                                className="shadow-lg shadow-primary/10 w-full lg:w-fit"
                                icon={<span className="material-symbols-outlined">{task.isCompleted ? 'check_circle' : 'check'}</span>}
                            >
                                {task.isCompleted ? 'Completed' : 'Mark as Done'}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Description */}
                    <div>
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3 flex items-center gap-2 tracking-wider">
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            Description
                        </h3>
                        <div className="app-card p-6 min-h-[120px]">
                            {editingDescription ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={descValue}
                                        onChange={(e) => setDescValue(e.target.value)}
                                        className="w-full h-32 p-3 text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none resize-none text-[var(--color-text-main)]"
                                        placeholder="Add a description..."
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingDescription(false); setDescValue(task.description || ''); }}>
                                            Cancel
                                        </Button>
                                        <Button variant="primary" size="sm" onClick={handleSaveDescription}>
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={() => setEditingDescription(true)}
                                    className="cursor-pointer hover:bg-[var(--color-surface-hover)] -m-2 p-2 rounded-lg transition-colors group"
                                >
                                    {task.description ? (
                                        <div className="prose prose-sm max-w-none text-[var(--color-text-main)]">
                                            <p className="whitespace-pre-wrap leading-relaxed">{task.description}</p>
                                        </div>
                                    ) : (
                                        <p className="text-[var(--color-text-muted)] italic">Click to add a description...</p>
                                    )}
                                    <span className="material-symbols-outlined text-[14px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 absolute top-3 right-3">edit</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Status Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Status</h3>
                        <Select
                            value={task.status || 'Open'}
                            onChange={(e) => {
                                const newStatus = e.target.value as PersonalTask['status'];
                                const isDone = newStatus === 'Done';
                                setTask(prev => prev ? ({ ...prev, status: newStatus, isCompleted: isDone }) : null);
                                updatePersonalTask(task.id, { status: newStatus, isCompleted: isDone });
                            }}
                            className="w-full"
                        >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Done">Done</option>
                        </Select>
                    </div>

                    {/* Schedule Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Schedule</h3>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-medium text-[var(--color-text-subtle)] uppercase">Due Date</label>
                            <DatePicker
                                value={task.dueDate || ''}
                                onChange={(date) => handleUpdateField('dueDate', date)}
                                placeholder="Set due date"
                                align="right"
                            />
                        </div>
                    </div>

                    {/* Priority Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Priority</h3>
                        <div className="flex flex-col gap-1">
                            {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => handleUpdateField('priority', p)}
                                    className={`
                                        flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all
                                        ${task.priority === p
                                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-sm'
                                            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`size-2 rounded-full ${p === 'Urgent' ? 'bg-rose-500' :
                                            p === 'High' ? 'bg-orange-500' :
                                                p === 'Medium' ? 'bg-yellow-500' : 'bg-slate-400'
                                            }`} />
                                        {p}
                                    </div>
                                    {task.priority === p && <span className="material-symbols-outlined text-[16px] text-[var(--color-primary)]">check</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Task Details Card */}
                    <div className="app-card p-5">
                        <h3 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Task Details</h3>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Task ID</span>
                                <code className="text-[11px] font-mono text-[var(--color-text-main)] bg-[var(--color-surface-hover)] p-2 rounded-lg border border-[var(--color-surface-border)] break-all truncate">
                                    {task.id}
                                </code>
                            </div>

                            <div className="pt-3 border-t border-[var(--color-surface-border)] flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[var(--color-text-subtle)] uppercase">Completion</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${task.isCompleted ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                    {task.isCompleted ? 'Finished' : 'Active'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
