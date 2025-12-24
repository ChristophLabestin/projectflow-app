import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { addTask, deleteIdea, getProjectIdeas, getProjectTasks, saveIdea, updateIdea, getProjectMindmaps, getProjectById } from '../services/dataService';
import { generateProjectIdeasAI } from '../services/geminiService';
import { Idea, Project, Task, Mindmap } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { CommentSection } from '../components/CommentSection';
import { auth } from '../services/firebase';
import { useConfirm } from '../context/UIContext';

export const ProjectIdeas = () => {
    const { id } = useParams<{ id: string }>();
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const confirm = useConfirm();

    const isProjectOwner = useMemo(() => {
        return project?.ownerId === auth.currentUser?.uid;
    }, [project?.ownerId]);

    // UI State
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [mindmapFilter, setMindmapFilter] = useState<string>('all');

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({ id: '', title: '', description: '', type: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        if (!id) return;
        setLoading(true);
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
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [id]);

    const handleGenerate = async () => {
        if (!project || !id) return;
        setGenerating(true);
        try {
            const ensuredMindmaps = mindmaps.length ? mindmaps : await getProjectMindmaps(id);
            if (!mindmaps.length) setMindmaps(ensuredMindmaps);
            const defaultMindmapId = ensuredMindmaps[0]?.id;
            const generated = await generateProjectIdeasAI(project, tasks);
            await Promise.all(generated.map(idea => saveIdea({ ...idea, projectId: id, mindmapId: defaultMindmapId })));
            await loadData();
        } catch (e) {
            console.error(e);
            setError("AI generation failed.");
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!id || !formData.title.trim()) return;
        setSaving(true);
        try {
            if (formData.id) {
                await updateIdea(formData.id, { title: formData.title, description: formData.description, type: formData.type || 'Idea' }, id);
            } else {
                await saveIdea({
                    title: formData.title,
                    description: formData.description,
                    type: formData.type || 'Idea',
                    projectId: id,
                    generated: false
                });
            }
            await loadData();
            setShowCreateModal(false);
            setShowEditModal(false);
            setFormData({ id: '', title: '', description: '', type: '' });
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (ideaId: string) => {
        if (!await confirm("Delete Idea", "Are you sure you want to delete this idea?")) return;
        try {
            await deleteIdea(ideaId, id);
            await loadData();
        } catch (e) { console.error(e); }
    };

    const handleConvertToTask = async (idea: Idea) => {
        if (!id || idea.convertedTaskId) return;
        try {
            const taskId = await addTask(id, idea.title, undefined, undefined, "Medium", {
                description: idea.description || "",
                category: idea.type ? [idea.type] : undefined,
                status: "Backlog",
            });
            await updateIdea(idea.id, { convertedTaskId: taskId, convertedAt: new Date().toISOString() }, id);
            await loadData();
        } catch (e) { console.error(e); }
    };

    const filteredIdeas = ideas.filter((idea) => {
        const resolved = idea.mindmapId || mindmaps[0]?.id || null;
        if (mindmapFilter === 'all') return true;
        if (mindmapFilter === 'unassigned') return !resolved;
        return resolved === mindmapFilter;
    });

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-6 fade-in max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="h2 text-[var(--color-text-main)]">Ideas Board</h1>
                    <p className="text-[var(--color-text-muted)] text-sm">Capture, organize, and refine project concepts.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-48">
                        <Select
                            value={mindmapFilter}
                            onChange={(e) => setMindmapFilter(e.target.value)}
                            className="h-10"
                        >
                            <option value="all">All Groups</option>
                            {mindmaps.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex items-center rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] overflow-hidden">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[var(--color-surface-hover)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">view_list</span>
                        </button>
                        <div className="w-px h-6 bg-[var(--color-surface-border)]" />
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-surface-hover)] text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                    </div>
                </div>
            </div>

            <Card padding="sm" className="bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent border-[var(--color-primary)]/20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2">
                    <div className="flex items-center gap-4">
                        <div className="size-10 rounded-full bg-white flex items-center justify-center shadow-sm text-[var(--color-primary)]">
                            <span className="material-symbols-outlined">lightbulb</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-[var(--color-text-main)]">Suggestion Engine</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">Use AI to generate ideas based on your tasks.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={() => {
                            setFormData({ id: '', title: '', description: '', type: 'Idea' });
                            setShowCreateModal(true);
                        }}>Add Manually</Button>
                        <Button onClick={handleGenerate} loading={generating} icon={<span className="material-symbols-outlined">auto_awesome</span>}>
                            Generate Ideas
                        </Button>
                    </div>
                </div>
            </Card>

            {filteredIdeas.length === 0 ? (
                <div className="text-center py-20 app-card-soft">
                    <p className="text-[var(--color-text-muted)]">No details visible for this filter.</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredIdeas.map((idea) => {
                        const resolved = idea.mindmapId || mindmaps[0]?.id;
                        const mapName = mindmaps.find(m => m.id === resolved)?.name;
                        return (
                            <Card key={idea.id} padding="md" className="flex flex-col group relative">
                                <div className="flex items-start justify-between mb-3">
                                    <Badge size="sm" variant="secondary">{idea.type || 'Idea'}</Badge>
                                    {idea.generated && <span className="material-symbols-outlined text-[16px] text-indigo-500" title="AI Generated">auto_awesome</span>}
                                </div>
                                <h4 className="text-lg font-bold text-[var(--color-text-main)] mb-2 leading-tight">{idea.title}</h4>
                                <p className="text-sm text-[var(--color-text-muted)] mb-6 flex-1 line-clamp-4">{idea.description}</p>

                                <div className="pt-4 border-t border-[var(--color-surface-border)] flex items-center justify-between mt-auto">
                                    <span className="text-xs font-semibold text-[var(--color-text-subtle)] truncate max-w-[100px]">{mapName}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => {
                                            setFormData({ id: idea.id, title: idea.title, description: idea.description || '', type: idea.type || '' });
                                            setShowEditModal(true);
                                        }} className="p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(idea.id)} className="p-1.5 rounded-md hover:bg-rose-50 text-[var(--color-text-muted)] hover:text-rose-600">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>
                                </div>

                                {!idea.convertedTaskId && (
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button size="sm" variant="ghost" onClick={() => handleConvertToTask(idea)} icon={<span className="material-symbols-outlined">add_task</span>}>Convert</Button>
                                    </div>
                                )}
                                {idea.convertedTaskId && (
                                    <div className="absolute top-4 right-4 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 border border-emerald-100">
                                        <span className="material-symbols-outlined text-[14px]">check</span> Task
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <Card padding="none">
                    <div className="divide-y divide-[var(--color-surface-border)]">
                        {filteredIdeas.map((idea) => (
                            <div key={idea.id} className="p-4 flex items-center gap-4 hover:bg-[var(--color-surface-hover)] group">
                                <div className="size-10 rounded-full bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0">
                                    <span className="material-symbols-outlined text-[20px]">{idea.type === 'Bug' ? 'bug_report' : 'lightbulb'}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-[var(--color-text-main)] truncate">{idea.title}</h4>
                                    <p className="text-xs text-[var(--color-text-muted)] truncate">{idea.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {idea.convertedTaskId ? (
                                        <Badge variant="success">Task Created</Badge>
                                    ) : (
                                        <Button size="sm" variant="secondary" onClick={() => handleConvertToTask(idea)}>Convert</Button>
                                    )}
                                    <button onClick={() => {
                                        setFormData({ id: idea.id, title: idea.title, description: idea.description || '', type: idea.type || '' });
                                        setShowEditModal(true);
                                    }} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                                        <span className="material-symbols-outlined">edit</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Modal isOpen={showCreateModal || showEditModal} onClose={() => { setShowCreateModal(false); setShowEditModal(false); }} title={showCreateModal ? 'New Idea' : 'Edit Idea'}
                footer={
                    <>
                        <Button variant="ghost" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}>Cancel</Button>
                        <Button onClick={handleSave} loading={saving}>Save Idea</Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Input label="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Add dark mode" />
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-[var(--color-text-main)]">Description</label>
                        <Textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={4}
                            className="w-full"
                        />
                    </div>
                    <Input label="Type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="e.g. Feature, Bug, Marketing" />

                    {formData.id && (
                        <div className="pt-4 border-t border-[var(--color-surface-border)]">
                            <h4 className="text-sm font-bold text-[var(--color-text-main)] mb-2">Comments</h4>
                            <div className="h-64">
                                <CommentSection projectId={id || ''} targetId={formData.id} targetType="idea" tenantId={project?.tenantId} isProjectOwner={isProjectOwner} />
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};
