import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { addTask, deleteIdea, getProjectIdeas, getProjectTasks, saveIdea, updateIdea, getProjectMindmaps } from '../services/dataService';
import { generateProjectIdeasAI } from '../services/geminiService';
import { Idea, Project, Task, Mindmap } from '../types';
import { getProjectById } from '../services/dataService';

export const ProjectIdeas = () => {
    const { id } = useParams<{ id: string }>();
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingDesc, setEditingDesc] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newType, setNewType] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [mindmapFilter, setMindmapFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [outsideIdeaTargets, setOutsideIdeaTargets] = useState<Record<string, string>>({});

    const primaryMindmapId = mindmaps[0]?.id || null;

    const resolveMindmapId = (idea: Idea) => {
        // Treat missing mindmapId as belonging to the primary/default mindmap.
        return idea.mindmapId || primaryMindmapId || null;
    };

    const filteredIdeas = ideas.filter((idea) => {
        const resolved = resolveMindmapId(idea);
        if (mindmapFilter === 'all') return true;
        if (mindmapFilter === 'unassigned') return !resolved;
        return resolved === mindmapFilter;
    });

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const [proj, projIdeas, projTasks, projMindmaps] = await Promise.all([
                getProjectById(id),
                getProjectIdeas(id),
                getProjectTasks(id),
                getProjectMindmaps(id)
            ]);
            setProject(proj);
            setIdeas(projIdeas);
            setTasks(projTasks);
            setMindmaps(projMindmaps);
        } catch (e) {
            console.error(e);
            setError("Failed to load project ideas.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleGenerate = async () => {
        if (!project || !id) return;
        setGenerating(true);
        setError(null);
        try {
            const ensuredMindmaps = mindmaps.length ? mindmaps : await getProjectMindmaps(id);
            if (!mindmaps.length) setMindmaps(ensuredMindmaps);
            const defaultMindmapId = ensuredMindmaps[0]?.id;
            const generated = await generateProjectIdeasAI(project, tasks);
            for (const idea of generated) {
                await saveIdea({ ...idea, projectId: id, mindmapId: defaultMindmapId });
            }
            await loadData();
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : "Failed to generate ideas.");
        } finally {
            setGenerating(false);
        }
    };

    const startEdit = (idea: Idea) => {
        setEditingId(idea.id);
        setEditingTitle(idea.title);
        setEditingDesc(idea.description);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        setError(null);
        try {
            const idea = ideas.find((i) => i.id === editingId);
            const isTransient = !idea?.projectId || editingId.startsWith('gen-');
            if (isTransient) {
                await saveIdea({
                    title: editingTitle,
                    description: editingDesc,
                    type: idea?.type || 'Idea',
                    projectId: id,
                    generated: idea?.generated,
                });
            } else {
                await updateIdea(editingId, { title: editingTitle, description: editingDesc }, id);
            }
            await loadData();
            setEditingId(null);
        } catch (e) {
            console.error(e);
            setError("Failed to update idea.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (ideaId: string) => {
        setSaving(true);
        setError(null);
        try {
            await deleteIdea(ideaId, id || undefined);
            await loadData();
        } catch (e) {
            console.error(e);
            setError("Failed to delete idea.");
        } finally {
            setSaving(false);
        }
    };

    const handleConvertToTask = async (idea: Idea) => {
        if (!id || idea.convertedTaskId) return;
        setSaving(true);
        setError(null);
        try {
            const taskId = await addTask(id, idea.title, undefined, undefined, "Medium", {
                description: idea.description || "",
                category: idea.type ? [idea.type] : undefined,
                status: "Backlog",
            });
            const isTransient = !idea.projectId || idea.id.startsWith('gen-');
            if (!isTransient) {
                await updateIdea(idea.id, { convertedTaskId: taskId, convertedAt: new Date().toISOString() }, id);
                await loadData();
            } else {
                setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
            }
        } catch (e) {
            console.error(e);
            setError("Failed to convert idea.");
        } finally {
            setSaving(false);
        }
    };

    const handleCreateIdea = async () => {
        if (!id || !newTitle.trim()) {
            setError('Please enter a title for the idea.');
            return;
        }
        setCreating(true);
        setError(null);
        try {
            await saveIdea({
                title: newTitle.trim(),
                description: newDesc.trim(),
                type: newType.trim() || 'Idea',
                projectId: id,
                generated: false
            });
            setNewTitle('');
            setNewDesc('');
            setNewType('');
            await loadData();
        } catch (e) {
            console.error(e);
            setError("Failed to add idea.");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Project Ideas</h1>
                    <p className="text-sm text-gray-500">Use Gemini to suggest ideas and turn them into tasks.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">Mindmap</label>
                        <select
                            value={mindmapFilter}
                            onChange={(e) => setMindmapFilter(e.target.value)}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm min-w-[180px]"
                        >
                            <option value="all">All mindmaps</option>
                            <option value="unassigned">Unassigned</option>
                            {mindmaps.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-2 text-sm font-bold ${viewMode === 'list' ? 'bg-black text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
                        >
                            List
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-2 text-sm font-bold border-l border-slate-200 dark:border-slate-700 ${viewMode === 'grid' ? 'bg-black text-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'}`}
                        >
                            Grid
                        </button>
                    </div>
                    <button onClick={handleGenerate} disabled={generating || !project} className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50">
                        {generating ? "Generating..." : "Generate Ideas"}
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Add your own idea</p>
                        <p className="text-xs text-slate-500">Capture a quick thought and refine later.</p>
                    </div>
                    <button
                        onClick={handleCreateIdea}
                        disabled={creating || !project}
                        className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50"
                    >
                        {creating ? 'Adding...' : 'Add Idea'}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2 flex flex-col gap-2">
                        <input
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            placeholder="Idea title"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                        />
                        <textarea
                            value={newDesc}
                            onChange={(e) => setNewDesc(e.target.value)}
                            placeholder="Short description (optional)"
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <input
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                            placeholder="Category / Type"
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                        />
                        <p className="text-[11px] text-slate-500">Use a short label to group ideas.</p>
                    </div>
                </div>
            </div>

            {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">{error}</div>}

            {loading ? (
                <div className="flex justify-center py-10">
                    <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
                </div>
            ) : ideas.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                    <p className="text-gray-500">No ideas yet. Generate some with Gemini or add one above.</p>
                </div>
            ) : (
                viewMode === 'list' ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                        <div className="grid grid-cols-[1.8fr_1fr_1fr_1.2fr] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                            <span>Idea</span>
                            <span>Mindmap</span>
                            <span>Status</span>
                            <span className="text-right">Actions</span>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredIdeas.length === 0 && (
                            <div className="px-4 py-5 text-sm text-slate-500 dark:text-slate-300">
                                No ideas match this mindmap filter.
                            </div>
                        )}
                        {filteredIdeas.map((idea) => {
                            const convertedTask = idea.convertedTaskId ? tasks.find(t => t.id === idea.convertedTaskId) : undefined;
                            const resolvedId = resolveMindmapId(idea);
                            const mindmapName = resolvedId ? (mindmaps.find((m) => m.id === resolvedId)?.name || 'Mindmap') : 'Unassigned';
                            return (
                                <div key={idea.id} className="grid grid-cols-[1.8fr_1fr_1fr_1.2fr] items-start gap-3 px-4 py-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex flex-col gap-1">
                                        {editingId === idea.id ? (
                                            <>
                                                <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm font-bold text-neutral-900 dark:text-white" />
                                                <textarea value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300" rows={2} />
                                                <div className="flex gap-2 mt-2">
                                                    <button onClick={saveEdit} disabled={saving} className="px-3 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50">Save</button>
                                                    <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold">Cancel</button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 bg-gray-100 dark:bg-neutral-800 text-black dark:text-white text-[11px] font-bold uppercase tracking-wider rounded">{idea.type || 'Idea'}</span>
                                                    {idea.generated && <span className="material-symbols-outlined text-[16px] text-black dark:text-white" title="AI Generated">auto_awesome</span>}
                                                </div>
                                                <h4 className="text-neutral-900 dark:text-white text-base font-bold leading-tight">{idea.title}</h4>
                                                <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 dark:text-gray-300">{idea.description}</p>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{mindmapName}</span>
                                        <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-bold">{resolvedId ? 'Linked' : 'Not linked'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-[11px] font-semibold rounded-full border ${idea.convertedTaskId ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            {idea.convertedTaskId ? 'Task created' : 'Not a task yet'}
                                        </span>
                                    </div>
                                    <div className="flex justify-end gap-2 flex-wrap">
                                        {editingId !== idea.id && (
                                            <>
                                                <button onClick={() => startEdit(idea)} className="px-3 py-2 text-sm font-bold text-gray-700 border border-gray-200 rounded-lg">Edit</button>
                                                <button onClick={() => handleDelete(idea.id)} className="px-3 py-2 text-sm font-bold text-rose-600 border border-rose-200 rounded-lg">Delete</button>
                                            </>
                                        )}
                                        {idea.convertedTaskId ? (
                                            convertedTask ? (
                                                <Link to={`/project/${id}/tasks/${convertedTask.id}`} className="px-3 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                                                    View Task
                                                </Link>
                                            ) : (
                                                <button disabled className="px-3 py-2 text-sm font-bold text-white bg-emerald-400 rounded-lg opacity-70">
                                                    Task Created
                                                </button>
                                            )
                                        ) : (
                                            <button onClick={() => handleConvertToTask(idea)} disabled={saving} className="px-3 py-2 text-sm font-bold text-white bg-black rounded-lg disabled:opacity-50">
                                                Convert to Task
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredIdeas.length === 0 && (
                            <div className="col-span-full px-4 py-5 text-sm text-slate-500 dark:text-slate-300 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                No ideas match this mindmap filter.
                            </div>
                        )}
                        {filteredIdeas.map((idea) => {
                            const convertedTask = idea.convertedTaskId ? tasks.find(t => t.id === idea.convertedTaskId) : undefined;
                            const resolvedId = resolveMindmapId(idea);
                            return (
                                <div key={idea.id} className="group relative flex flex-col p-5 bg-white dark:bg-card-dark rounded-xl border border-gray-200 dark:border-neutral-800 hover:border-black/50 dark:hover:border-white/50 hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-neutral-800 text-black dark:text-white text-xs font-bold uppercase tracking-wider rounded">{idea.type || 'Idea'}</span>
                                            <span className={`px-2 py-1 text-[11px] font-semibold rounded-full border ${idea.convertedTaskId ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                                {idea.convertedTaskId ? 'Task created' : 'Not a task yet'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-slate-500">{resolvedId ? (mindmaps.find((m) => m.id === resolvedId)?.name || 'Mindmap') : 'Unassigned'}</span>
                                            {idea.generated && <span className="material-symbols-outlined text-[16px] text-black dark:text-white" title="AI Generated">auto_awesome</span>}
                                        </div>
                                    </div>
                                    {editingId === idea.id ? (
                                        <>
                                            <input value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm font-bold text-neutral-900 dark:text-white mb-2" />
                                            <textarea value={editingDesc} onChange={(e) => setEditingDesc(e.target.value)} className="w-full bg-transparent border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 mb-3" rows={3} />
                                            <div className="flex gap-2">
                                                <button onClick={saveEdit} disabled={saving} className="px-3 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50">Save</button>
                                                <button onClick={() => setEditingId(null)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold">Cancel</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <h4 className="text-neutral-900 dark:text-white text-lg font-bold mb-2 leading-tight">{idea.title}</h4>
                                            <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{idea.description}</p>
                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={() => startEdit(idea)} className="px-3 py-2 text-sm font-bold text-gray-700 border border-gray-200 rounded-lg">Edit</button>
                                                <button onClick={() => handleDelete(idea.id)} className="px-3 py-2 text-sm font-bold text-rose-600 border border-rose-200 rounded-lg">Delete</button>
                                                {idea.convertedTaskId ? (
                                                    convertedTask ? (
                                                        <Link to={`/project/${id}/tasks/${convertedTask.id}`} className="px-3 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                                                            View Task
                                                        </Link>
                                                    ) : (
                                                        <button disabled className="px-3 py-2 text-sm font-bold text-white bg-emerald-400 rounded-lg opacity-70">
                                                            Task Created
                                                        </button>
                                                    )
                                                ) : (
                                                    <button onClick={() => handleConvertToTask(idea)} disabled={saving} className="px-3 py-2 text-sm font-bold text-white bg-black rounded-lg disabled:opacity-50">
                                                        Convert to Task
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
};
