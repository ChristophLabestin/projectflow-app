import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { getIdeaById, updateIdea, addTask } from '../services/dataService';
import { BrainstormView } from '../components/ideas/stages/BrainstormView';
import { RefinementView } from '../components/ideas/stages/RefinementView';
import { ConceptView } from '../components/ideas/stages/ConceptView';
import { ApprovalView } from '../components/ideas/stages/ApprovalView';
import { GenericStageView } from '../components/ideas/stages/GenericStageView';
import { ProductStrategyView } from '../components/ideas/stages/ProductStrategyView';
import { ProductDiscoveryView } from '../components/ideas/stages/ProductDiscoveryView';
import { ProductDefinitionView } from '../components/ideas/stages/ProductDefinitionView';
import { ProductDevelopmentView } from '../components/ideas/stages/ProductDevelopmentView';
import { ProductLaunchView } from '../components/ideas/stages/ProductLaunchView';
import { MarketingStrategyView } from '../components/ideas/stages/MarketingStrategyView';
import { MarketingPlanningView } from '../components/ideas/stages/MarketingPlanningView';
import { MarketingExecutionView } from '../components/ideas/stages/MarketingExecutionView';
import { MarketingAnalysisView } from '../components/ideas/stages/MarketingAnalysisView';
import { SocialIdeationView } from '../components/ideas/stages/SocialIdeationView';
import { SocialDraftingView } from '../components/ideas/stages/SocialDraftingView';
import { SocialScheduledView } from '../components/ideas/stages/SocialScheduledView';
import { SocialPostedView } from '../components/ideas/stages/SocialPostedView';
import { MoonshotFeasibilityView } from '../components/ideas/stages/MoonshotFeasibilityView';
import { MoonshotPrototypeView } from '../components/ideas/stages/MoonshotPrototypeView';
import { MoonshotGreenlightView } from '../components/ideas/stages/MoonshotGreenlightView';
import { Idea } from '../types';
import { useConfirm } from '../context/UIContext';
import { PIPELINE_CONFIGS } from '../components/ideas/constants';



export const IdeaDetail = () => {
    const { id: projectId, ideaId } = useParams<{ id: string; ideaId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();

    const [idea, setIdea] = useState<Idea | null>(null);
    const [loading, setLoading] = useState(true);
    // Active tab is now just the stage ID string
    const [activeTab, setActiveTab] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Refs for auto-save
    const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const pendingUpdatesRef = React.useRef<Partial<Idea>>({});

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const loadIdea = async () => {
            if (!ideaId || !projectId) return;
            setLoading(true);
            try {
                const data = await getIdeaById(ideaId, projectId);
                if (data) {
                    setIdea(data);
                    // Use the idea's stage as the active tab directly
                    setActiveTab(data.stage);
                } else {
                    // Handle not found
                    console.error("Idea not found");
                    navigate(`/project/${projectId}/ideas`);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadIdea();
    }, [ideaId, projectId, navigate]);

    const handleUpdate = (updates: Partial<Idea>) => {
        if (!idea || !projectId) return;

        // 1. Optimistic Update
        setIdea(prev => prev ? ({ ...prev, ...updates }) : null);

        // Auto-switch tab on stage progression
        if (updates.stage) {
            setActiveTab(updates.stage);
        }

        // 2. Accumulate changes
        pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

        // 3. Debounce Save
        setSaveStatus('saving');

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
            const updatesToSave = pendingUpdatesRef.current;
            pendingUpdatesRef.current = {};

            try {
                // Ensure we don't save excessive data if not needed, but updatesToSave is Partial<Idea>
                await updateIdea(idea.id, updatesToSave, projectId);
                setSaveStatus('saved');

                // Reset to idle after 2 seconds
                setTimeout(() => {
                    setSaveStatus(prev => prev === 'saved' ? 'idle' : prev);
                }, 2000);
            } catch (e) {
                console.error('Auto-save failed:', e);
                setSaveStatus('error');
            }
        }, 1000); // 1 second debounce
    };

    const handleConvertToTask = async (startDate?: string, dueDate?: string) => {
        if (!idea || !projectId) return;
        setSaving(true);
        try {
            // Extract Executive Summary if available
            let taskDescription = idea.description || "";
            if (idea.concept) {
                const summaryMatch = idea.concept.match(/<h2>Executive Summary<\/h2>\s*<p>([\s\S]*?)<\/p>/i);
                if (summaryMatch && summaryMatch[1]) {
                    // Create a temporary element to decode HTML entities if needed, but for now simple strip tags
                    taskDescription = summaryMatch[1].replace(/<[^>]*>?/gm, '');
                }
            }

            const taskId = await addTask(projectId, idea.title, undefined, dueDate, "Medium", {
                description: taskDescription,
                category: idea.type ? [idea.type] : undefined,
                status: "Backlog",
                convertedIdeaId: idea.id,
                startDate: startDate,
            });
            await updateIdea(idea.id, {
                convertedTaskId: taskId,
                convertedAt: new Date().toISOString(),
                stage: 'Implemented'
            }, projectId);
            setHasUnsavedChanges(false);
            navigate(`/project/${projectId}/tasks/${taskId}`);
        } catch (e) { console.error(e); }
        finally { setSaving(false); }
    };

    const handleBack = async () => {
        // Blocker will intercept this if changes exist
        navigate(`/project/${projectId}/ideas`);
    };

    // Render Logic
    const renderStageView = () => {
        if (!idea) return null;

        // Legacy/Feature specific mappings
        if (idea.type === 'Feature' || !idea.type) {
            switch (activeTab) {
                case 'Brainstorm': return <BrainstormView idea={idea} onUpdate={handleUpdate} />;
                case 'Refining': return <RefinementView idea={idea} onUpdate={handleUpdate} />;
                case 'Concept': return <ConceptView idea={idea} onUpdate={handleUpdate} />;
                case 'Review':
                case 'Approved':
                    return <ApprovalView idea={idea} onUpdate={handleUpdate} onConvert={handleConvertToTask} />;
            }
        }

        // Product specific mappings
        if (idea.type === 'Product') {
            switch (activeTab) {
                case 'Strategy': return <ProductStrategyView idea={idea} onUpdate={handleUpdate} />;
                case 'Concept': return <ConceptView idea={idea} onUpdate={handleUpdate} />;
                case 'Discovery': return <ProductDiscoveryView idea={idea} onUpdate={handleUpdate} />;
                case 'Definition': return <ProductDefinitionView idea={idea} onUpdate={handleUpdate} />;
                case 'Development': return <ProductDevelopmentView idea={idea} onUpdate={handleUpdate} />;
                case 'Launch': return <ProductLaunchView idea={idea} onUpdate={handleUpdate} />;
            }
        }

        // Marketing specific mappings
        // Marketing specific mappings
        if (idea.type === 'Marketing') {
            switch (activeTab) {
                case 'Strategy': return <MarketingStrategyView idea={idea} onUpdate={handleUpdate} />;
                case 'Planning': return <MarketingPlanningView idea={idea} onUpdate={handleUpdate} />;
                case 'Execution': return <MarketingExecutionView idea={idea} onUpdate={handleUpdate} />;
                case 'Analysis': return <MarketingAnalysisView idea={idea} onUpdate={handleUpdate} />;
            }
        }

        // Social specific mappings
        if (idea.type === 'Social') {
            switch (activeTab) {
                case 'Ideation': return <SocialIdeationView idea={idea} onUpdate={handleUpdate} />;
                case 'Drafting': return <SocialDraftingView idea={idea} onUpdate={handleUpdate} />;
                case 'Scheduled': return <SocialScheduledView idea={idea} onUpdate={handleUpdate} />;
                case 'Posted': return <SocialPostedView idea={idea} onUpdate={handleUpdate} />;
            }
        }

        // Moonshot specific mappings
        if (idea.type === 'Moonshot') {
            switch (activeTab) {
                case 'Feasibility': return <MoonshotFeasibilityView idea={idea} onUpdate={handleUpdate} />;
                case 'Prototype': return <MoonshotPrototypeView idea={idea} onUpdate={handleUpdate} />;
                case 'Greenlight': return <MoonshotGreenlightView idea={idea} onUpdate={handleUpdate} />;
            }
        }

        // Return Generic View for other types (for now)
        return <GenericStageView idea={idea} stageId={activeTab} onUpdate={handleUpdate} />;
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-4xl">progress_activity</span>
        </div>
    );

    if (!idea) return null;

    // Get current pipeline configuration
    const pipelineStages = PIPELINE_CONFIGS[idea.type] || PIPELINE_CONFIGS['Feature'];

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-bg)]">
            {/* Unified Toolbar: Back, Title, Nav, Actions */}
            <div className="flex items-center justify-between border-b border-[var(--color-surface-border)] px-4 h-14 shrink-0 bg-[var(--color-surface-paper)] z-10 gap-4">

                {/* Left: Back & Title & Tabs */}
                <div className="flex items-center h-full gap-4 overflow-x-auto no-scrollbar">
                    <button onClick={handleBack} className="size-8 rounded-lg hover:bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] transition-colors shrink-0">
                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    </button>

                    <div className="h-6 w-px bg-[var(--color-surface-border)] shrink-0" />

                    <div className="flex items-center gap-2 max-w-[200px] shrink-0">
                        <h1 className="text-sm font-bold text-[var(--color-text-main)] truncate" title={idea.title}>{idea.title}</h1>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] font-medium shrink-0">{idea.type}</span>
                    </div>

                    <div className="h-6 w-px bg-[var(--color-surface-border)] shrink-0" />

                    <div className="flex items-center h-full gap-1">
                        {pipelineStages.map((step) => (
                            <button
                                key={step.id}
                                onClick={() => setActiveTab(step.id)}
                                className={`relative h-8 px-3 rounded-md flex items-center gap-2 text-xs font-bold transition-all whitespace-nowrap ${activeTab === step.id
                                    ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:text-[var(--color-text-muted)]/10'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[16px] ${activeTab === step.id ? 'filled' : ''}`}>{step.icon}</span>
                                {step.title}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 shrink-0">

                    <div className="h-6 w-px bg-[var(--color-surface-border)]" />

                    <Select
                        value={idea.stage || pipelineStages[0].id}
                        onChange={(e) => handleUpdate({ stage: e.target.value as any })}
                        className="w-28 h-8 text-xs bg-transparent hover:bg-[var(--color-surface-hover)] border-none font-semibold focus:ring-0 cursor-pointer text-right"
                    >
                        {pipelineStages.map(stage => (
                            <option key={stage.id} value={stage.id}>{stage.title}</option>
                        ))}
                        <option value="Implemented">Implemented</option>
                        <option value="Archived">Archived</option>
                    </Select>

                    <div className="flex items-center gap-2 px-3">
                        {saveStatus === 'saving' && (
                            <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                                Saving...
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">cloud_done</span>
                                Saved
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">error</span>
                                Error
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-[var(--color-surface-bg)] p-6">
                <div className="max-w-6xl mx-auto h-full flex flex-col">
                    {renderStageView()}
                </div>
            </div>
        </div >
    );
};
