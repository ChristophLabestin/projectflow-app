import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deleteIdea, subscribeProjectIdeas, getProjectTasks, getProjectById, updateIdea } from '../services/dataService';
import { generateProjectIdeasAI } from '../services/geminiService';
import { Idea, Project, Task } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { IdeaPipelineBoard } from '../components/ideas/IdeaPipelineBoard';
import { CreateIdeaModal } from '../components/ideas/CreateIdeaModal';
import { auth } from '../services/firebase';
import { useConfirm } from '../context/UIContext';
import { PIPELINE_CONFIGS, PipelineStageConfig, OVERVIEW_COLUMNS, TYPE_COLORS } from '../components/ideas/constants';

// ... (STAGE_CONFIG, TYPE_COLORS, OVERVIEW_COLUMNS constants remain unchanged)

export const ProjectIdeas = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const confirm = useConfirm();

    const isProjectOwner = useMemo(() => {
        return project?.ownerId === auth.currentUser?.uid;
    }, [project?.ownerId]);

    // UI State
    const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
    const [activePipeline, setActivePipeline] = useState<string>('Overview'); // Default to Overview (Triage)

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({ id: '', title: '', description: '', type: '' });
    const [error, setError] = useState<string | null>(null);

    // Stats
    const stats = useMemo(() => {
        const brainstorm = ideas.filter(i => (i.stage || 'Brainstorm') === 'Brainstorm').length;
        const refining = ideas.filter(i => i.stage === 'Refining').length;
        const concept = ideas.filter(i => i.stage === 'Concept').length;
        const approved = ideas.filter(i => i.stage === 'Approved').length;
        const aiGenerated = ideas.filter(i => i.generated).length;

        return { total: ideas.length, brainstorm, refining, concept, approved, aiGenerated };
    }, [ideas]);

    // Initial Load for Project & Tasks (Non-realtime for now, or could change)
    const loadStaticData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [proj, projTasks] = await Promise.all([
                getProjectById(id),
                getProjectTasks(id),
            ]);
            setProject(proj);
            setTasks(projTasks);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStaticData();
    }, [id]);

    // Real-time Subscription for Ideas
    useEffect(() => {
        if (!id) return;

        const unsubscribe = subscribeProjectIdeas(id, (newIdeas) => {
            setIdeas(newIdeas);
        });

        return () => unsubscribe();
    }, [id]);

    const handleGenerate = async () => {
        if (!project || !id) return;
        setGenerating(true);
        try {
            // For Overview, we could default to 'Feature' or ask user. For now let's default to Feature if in overview
            const targetType = activePipeline === 'Overview' ? 'Feature' : activePipeline;

            // Generate ideas for the active pipeline
            const generated = await generateProjectIdeasAI(project, tasks, targetType);

            // Determine the correct first stage
            const initialStage = PIPELINE_CONFIGS[targetType]?.[0]?.id || 'Brainstorm';

            // Map generated ideas to have the correct initial stage
            const ideasToSave = generated.map(idea => ({
                ...idea,
                projectId: id,
                mindmapId: null,
                stage: initialStage
            }));

            const { saveIdea } = await import('../services/dataService');
            await Promise.all(ideasToSave.map(idea => saveIdea(idea)));
            // No need to reload, real-time listener will catch it
        } catch (e) {
            console.error(e);
            setError("AI generation failed.");
        } finally {
            setGenerating(false);
        }
    };

    // Callback when dragging on board
    const handleIdeaMove = async (ideaId: string, newStageOrType: string) => {
        if (!id) return;

        // Clone current ideas for optimistic update
        const previousIdeas = [...ideas];
        const targetIdea = ideas.find(i => i.id === ideaId);
        if (!targetIdea) return;

        try {
            if (activePipeline === 'Overview') {
                // In Overview mode, dragging functionality:
                // Dragging from one column (Type) to another changes the Idea Type
                // AND resets its stage to the new pipeline's first stage.

                const newType = newStageOrType;
                if (targetIdea.type === newType) return; // No change

                const newInitialStage = PIPELINE_CONFIGS[newType]?.[0]?.id || 'Brainstorm';

                // Optimistic Update
                setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, type: newType, stage: newInitialStage, isTriage: false } : i));

                await updateIdea(ideaId, { type: newType, stage: newInitialStage, isTriage: false }, id);

            } else {
                // Standard Pipeline Mode: Dragging changes Stage
                const newStage = newStageOrType;

                // Optimistic Update
                setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, stage: newStage } : i));

                await updateIdea(ideaId, { stage: newStage }, id);
            }
        } catch (e) {
            console.error("Failed to move idea", e);
            setIdeas(previousIdeas); // Revert
            // No need to call loadData, we reverted state.
        }
    };

    const handleDelete = async (ideaId: string) => {
        if (!await confirm("Delete Idea", "Are you sure you want to delete this idea?")) return;
        try {
            await deleteIdea(ideaId, id);
            // Real-time listener handles update
        } catch (e) { console.error(e); }
    };

    const filteredIdeas = useMemo(() => {
        if (activePipeline === 'Overview') {
            // Triage View:
            // Show ideas that are in the *First Stage* of their respective pipeline.
            // This allows users to triage new/raw ideas.

            return ideas.map(idea => {
                // No, IdeaPipelineBoard expects grouped by 'stage'.
                // If we pass OVERVIEW_COLUMNS (where id=Type), the Board will look for ideas where idea.stage === Type.
                // We need to trick the board or map the data.

                // Let's create a virtual 'stage' for the board rendering only equivalent to the type.
                // But only if it's in the actual first stage.

                const firstStage = PIPELINE_CONFIGS[idea.type]?.[0]?.id;
                if (idea.stage === firstStage) {
                    return { ...idea, stage: idea.type }; // Temporarily override stage to match Type ID for column grouping
                }
                return null;
            }).filter(Boolean) as Idea[];
        }

        // Standard Pipeline Filtering
        return ideas.filter(idea => idea.type === activePipeline);
    }, [ideas, activePipeline]);

    const activeColumns = activePipeline === 'Overview' ? OVERVIEW_COLUMNS : (PIPELINE_CONFIGS[activePipeline] || PIPELINE_CONFIGS['Feature']);

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden fade-in px-6 pt-4 pb-0 gap-4">
            {/* Header - Compact Design */}
            <div className="flex flex-col gap-4 shrink-0 border-b border-[var(--color-surface-border)] pb-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-[var(--color-text-main)]">Innovation Pipeline</h1>
                        <div className="h-6 w-px bg-[var(--color-surface-border)]" />

                        {/* Pipeline Selector - Compact */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setActivePipeline('Overview')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${activePipeline === 'Overview'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                                Triage
                            </button>
                            {Object.keys(PIPELINE_CONFIGS).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setActivePipeline(type)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${activePipeline === type
                                        ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] ring-1 ring-[var(--color-surface-border)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View Mode Toggle - Compact */}
                        <div className="flex items-center rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] overflow-hidden p-0.5">
                            <button
                                onClick={() => setViewMode('board')}
                                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'board'
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                                title="Board View"
                            >
                                <span className="material-symbols-outlined text-[18px]">view_kanban</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all flex items-center justify-center ${viewMode === 'list'
                                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                                title="List View"
                            >
                                <span className="material-symbols-outlined text-[18px]">view_list</span>
                            </button>
                        </div>

                        <div className="h-6 w-px bg-[var(--color-surface-border)] mx-1" />

                        <Button size="sm" variant="secondary" onClick={() => {
                            setFormData({ id: '', title: '', description: '', type: 'Idea' });
                            setShowCreateModal(true);
                        }} icon={<span className="material-symbols-outlined text-[16px]">add</span>}>
                            Add
                        </Button>
                        <Button size="sm" onClick={handleGenerate} isLoading={generating} icon={<span className="material-symbols-outlined text-[16px]">auto_awesome</span>}>
                            Generate
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {filteredIdeas.length === 0 && !loading && !generating ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center py-16 max-w-md">
                        <div className="size-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-[40px] text-indigo-500">lightbulb</span>
                        </div>
                        <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">No ideas here</h3>
                        <p className="text-[var(--color-text-muted)] mb-6">
                            Start adding ideas to the {activePipeline} pipeline!
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                                Add Manually
                            </Button>
                        </div>
                    </div>
                </div>
            ) : viewMode === 'board' ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <IdeaPipelineBoard
                        ideas={filteredIdeas}
                        columns={activeColumns}
                        onIdeaMove={handleIdeaMove}
                        onIdeaClick={(idea) => navigate(`/project/${id}/ideas/${idea.id}`)}
                    />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="flex flex-col gap-2">
                        {filteredIdeas.map((idea) => {
                            // Find config from ACTIVE columns to ensure colors match the current view
                            // Fallback to global config search if needed
                            const activeStageConfig = activeColumns.find(c => c.id === idea.stage);
                            const icon = activeStageConfig?.icon || 'circle';
                            const bgColor = activeStageConfig?.color?.replace('bg-', 'text-') || 'text-slate-500';
                            const bgClass = activeStageConfig?.color?.replace('500', '100 dark:bg-opacity-10') || 'bg-slate-100 dark:bg-slate-800';

                            const typeColor = TYPE_COLORS[idea.type] || TYPE_COLORS['default'];

                            return (
                                <div
                                    key={idea.id}
                                    className="group bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-[var(--color-surface-border)] cursor-pointer transition-all"
                                    onClick={() => navigate(`/project/${id}/ideas/${idea.id}`)}
                                >
                                    {/* Stage Icon */}
                                    <div className={`size-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
                                        <span className={`material-symbols-outlined text-[20px] ${bgColor.replace('bg-', 'text-')}`}>{icon}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${typeColor}`}>
                                                {idea.type}
                                            </span>
                                            {idea.generated && (
                                                <span className="text-[10px] font-medium text-indigo-500 flex items-center gap-0.5">
                                                    <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                                    AI
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="font-semibold text-[var(--color-text-main)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                                            {idea.title}
                                        </h4>
                                        {idea.description && (
                                            <p className="text-sm text-[var(--color-text-muted)] truncate mt-0.5">{idea.description}</p>
                                        )}
                                    </div>

                                    {/* Meta */}
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="flex items-center gap-3 text-[var(--color-text-subtle)]">
                                            <span className="flex items-center gap-1 text-xs">
                                                <span className="material-symbols-outlined text-[14px]">thumb_up</span>
                                                {idea.votes || 0}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs">
                                                <span className="material-symbols-outlined text-[14px]">chat_bubble</span>
                                                {idea.comments || 0}
                                            </span>
                                        </div>
                                        <Badge size="sm" variant="outline" className={`${bgClass} border-0`}>
                                            {activeStageConfig?.title || idea.stage}
                                        </Badge>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(idea.id); }}
                                            className="p-2 text-[var(--color-text-muted)] hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Create Modal */}
            <CreateIdeaModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                projectId={id || ''}
                onCreated={() => { }}
            />
        </div >
    );
};
