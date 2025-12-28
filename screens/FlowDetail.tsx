import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { deleteField } from 'firebase/firestore';
import { getIdeaById, updateIdea, addTask, createSocialCampaign, getSocialCampaign, updateCampaign, deleteSocialCampaign, subscribeToIdea } from '../services/dataService';
import { BrainstormView } from '../components/flows/stages/BrainstormView';
import { RefinementView } from '../components/flows/stages/RefinementView';
import { ConceptView } from '../components/flows/stages/ConceptView';
import { ApprovalView } from '../components/flows/stages/ApprovalView';
import { GenericStageView } from '../components/flows/stages/GenericStageView';
import { ProductStrategyView } from '../components/flows/stages/ProductStrategyView';
import { ProductDiscoveryView } from '../components/flows/stages/ProductDiscoveryView';
import { ProductDefinitionView } from '../components/flows/stages/ProductDefinitionView';
import { ProductDevelopmentView } from '../components/flows/stages/ProductDevelopmentView';
import { ProductLaunchView } from '../components/flows/stages/ProductLaunchView';
import { MarketingStrategyView } from '../components/flows/stages/MarketingStrategyView';
import { MarketingPlanningView } from '../components/flows/stages/MarketingPlanningView';
import { MarketingExecutionView } from '../components/flows/stages/MarketingExecutionView';
import { MarketingAnalysisView } from '../components/flows/stages/MarketingAnalysisView';
import { SocialStrategyView } from '../components/flows/stages/SocialStrategyView';
import { SocialCreativeLabView } from '../components/flows/stages/SocialCreativeLabView';
import { SocialStudioView } from '../components/flows/stages/SocialStudioView';
import { SocialPerformanceView } from '../components/flows/stages/SocialPerformanceView';
import { MoonshotFeasibilityView } from '../components/flows/stages/MoonshotFeasibilityView';
import { MoonshotPrototypeView } from '../components/flows/stages/MoonshotPrototypeView';
import { MoonshotGreenlightView } from '../components/flows/stages/MoonshotGreenlightView';
import { SocialTypeSelection } from '../components/flows/stages/SocialTypeSelection';
import { SocialCampaignConceptView } from '../components/flows/stages/SocialCampaignConceptView';
import { SocialCampaignStrategyView } from '../components/flows/stages/SocialCampaignStrategyView';
import { SocialCampaignPlanningView } from '../components/flows/stages/SocialCampaignPlanningView';
import { SocialCampaignSubmitView } from '../components/flows/stages/SocialCampaignSubmitView';
import { SocialCampaignApprovedView } from '../components/flows/stages/SocialCampaignApprovedView';
import { Idea, SocialCampaign } from '../types';
import { useConfirm } from '../context/UIContext';
import { PIPELINE_CONFIGS } from '../components/flows/constants';
import { useLanguage } from '../context/LanguageContext';



export const FlowDetail = () => {
    const { id: projectId, flowId } = useParams<{ id: string; flowId: string }>();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { t } = useLanguage();

    const [idea, setIdea] = useState<Idea | null>(null);
    const [loading, setLoading] = useState(true);
    const [linkedCampaign, setLinkedCampaign] = useState<SocialCampaign | null>(null);
    // Active tab is now just the stage ID string
    const [activeTab, setActiveTab] = useState<string>('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [saving, setSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
        if (!flowId || !projectId) return;

        setLoading(true);
        const unsubscribe = subscribeToIdea(flowId, projectId, (data) => {
            setIdea(data);
            setLoading(false);

            // Set active tab on first load
            if (!activeTab) {
                let stages = PIPELINE_CONFIGS[data.type] || PIPELINE_CONFIGS['Feature'];
                if (data.type === 'Social' && data.socialType === 'campaign') {
                    stages = PIPELINE_CONFIGS['SocialCampaign'];
                }

                const normalizedStage = (stage: string) => {
                    if (stage === 'ChangeRequested') return 'Submit';
                    if (stage === 'PendingReview') return 'Submit';
                    if (stage === 'Review') return 'Submit';
                    return stage;
                };

                setActiveTab(normalizedStage(data.stage) || stages[0].id);
            }
        });

        return () => unsubscribe();
    }, [flowId, projectId]);

    // Fetch linked campaign if exists
    useEffect(() => {
        const loadLinkedCampaign = async () => {
            if (!projectId || !idea?.convertedCampaignId) return;
            try {
                const campaign = await getSocialCampaign(projectId, idea.convertedCampaignId);
                setLinkedCampaign(campaign);
            } catch (e) {
                console.error("Failed to load linked campaign", e);
            }
        };
        loadLinkedCampaign();
    }, [projectId, idea?.convertedCampaignId]);

    const handleUpdate = (updates: Partial<Idea>) => {
        if (!idea || !projectId) return;

        // 1. Optimistic Update
        setIdea(prev => prev ? ({ ...prev, ...updates }) : null);

        // Auto-switch tab on stage progression
        if (updates.stage) {
            const normalizedStage = (stage: string) => {
                if (stage === 'ChangeRequested') return 'Submit';
                if (stage === 'PendingReview') return 'Submit';
                if (stage === 'Review') return 'Submit';
                return stage;
            };
            setActiveTab(normalizedStage(updates.stage));
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
        navigate(`/project/${projectId}/flows`);
    };

    const stageLabels = useMemo(() => ({
        Brainstorm: t('flows.stage.brainstorm'),
        Refining: t('flows.stage.refining'),
        Concept: t('flows.stage.concept'),
        Review: t('flows.stage.inReview'),
        Approved: t('flows.stage.approved'),
        Discovery: t('flows.stage.discovery'),
        Definition: t('flows.stage.definition'),
        Development: t('flows.stage.development'),
        Launch: t('flows.stage.launch'),
        Strategy: t('flows.stage.strategy'),
        Planning: t('flows.stage.planning'),
        Execution: t('flows.stage.execution'),
        Analysis: t('flows.stage.analysis'),
        CreativeLab: t('flows.stage.creativeLab'),
        Studio: t('flows.stage.studio'),
        Distribution: t('flows.stage.distribution'),
        Submit: t('flows.stage.submit'),
        Rejected: t('flows.stage.rejected'),
        Feasibility: t('flows.stage.feasibility'),
        Prototype: t('flows.stage.prototype'),
        Greenlight: t('flows.stage.greenlight'),
        Proposal: t('flows.stage.proposal'),
        Benchmark: t('flows.stage.benchmark'),
        Implementation: t('flows.stage.implementation'),
        Implemented: t('flows.stage.implemented'),
        Archived: t('flows.stage.archived'),
    }), [t]);

    const socialCampaignStageLabels = useMemo(() => ({
        Concept: t('flows.stage.concept'),
        Strategy: t('flows.stage.strategy'),
        Planning: t('flows.stage.planning'),
        Submit: t('flows.stage.submit'),
        Approved: t('flows.stage.liveIntegrated'),
        Rejected: t('flows.stage.rejected'),
    }), [t]);

    const flowTypeLabels = useMemo(() => ({
        Feature: t('flows.type.feature'),
        Product: t('flows.type.product'),
        Marketing: t('flows.type.marketing'),
        Social: t('flows.type.social'),
        Moonshot: t('flows.type.moonshot'),
        Optimization: t('flows.type.optimization'),
        SocialCampaign: t('flows.type.socialCampaign'),
    }), [t]);



    const handleRejectIdea = async (reason?: string) => {
        if (!idea || !projectId) return;
        // Move back to Refining (Generic) or appropriate stage
        await updateIdea(idea.id, {
            stage: 'Refining',
            lastRejectionReason: reason
        }, projectId);
    };

    const handleRejectEntirely = async () => {
        if (!idea || !projectId) return;
        await updateIdea(idea.id, { stage: 'Rejected' }, projectId);
    };

    const addApprovalEvent = async (type: 'submission' | 'approval' | 'rejection' | 'changes_requested', notes?: string) => {
        if (!idea || !projectId || !idea.convertedCampaignId) return;

        const event = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            actorId: 'current-user', // In real app, get from auth context
            date: new Date().toISOString(),
            notes,
            snapshot: idea.concept // Optional snapshot
        };

        // We need to fetch the current campaign to append history
        const currentCampaign = await getSocialCampaign(projectId, idea.convertedCampaignId);
        const history = currentCampaign?.approvalHistory || [];

        await updateCampaign(projectId, idea.convertedCampaignId, {
            approvalHistory: [...history, event]
        });
    };

    const handleSubmitSocialCampaign = async () => {
        if (!idea || !projectId) return;
        // Simply move to PendingReview state. No campaign creation yet.
        await updateIdea(idea.id, { stage: 'PendingReview' }, projectId);
    };






    const handleRejectSocialCampaignEntirely = async () => {
        if (!idea || !projectId) return;

        // 1. Delete the campaign linked to this idea
        if (idea.convertedCampaignId) {
            try {
                await deleteSocialCampaign(idea.convertedCampaignId);
            } catch (error) {
                console.error("Failed to delete campaign", error);
            }
        }

        // 2. Reset the idea state to allow resubmission
        // We remove the campaign link and set stage back to Submit
        await updateIdea(idea.id, {
            stage: 'Submit',
            convertedCampaignId: deleteField() as any
        }, projectId);
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
                    return (
                        <ApprovalView
                            idea={idea}
                            onUpdate={handleUpdate}
                            onConvert={handleConvertToTask}
                            onReject={handleRejectIdea}
                            onRejectEntirely={handleRejectEntirely}
                        />
                    );
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
            // 1. Interception: Select Type if not set
            if (!idea.socialType) {
                return (
                    <SocialTypeSelection
                        onSelect={(type) => {
                            // Update idea with selected type
                            // For 'campaign', also switch stage to 'Concept' if currently 'Brainstorm' (default)
                            const updates: Partial<Idea> = { socialType: type };
                            if (type === 'campaign') {
                                updates.stage = 'Concept';
                            } else {
                                // For 'post', ensure we are on a valid stage (usually Brainstorm which is default)
                                updates.stage = 'Brainstorm';
                            }
                            handleUpdate(updates);
                        }}
                    />
                );
            }

            // 2. Campaign Pipeline
            if (idea.socialType === 'campaign') {
                switch (activeTab) {
                    case 'Concept': return <SocialCampaignConceptView idea={idea} onUpdate={handleUpdate} />;

                    case 'Strategy': return <SocialCampaignStrategyView idea={idea} onUpdate={handleUpdate} />;
                    case 'Planning': return <SocialCampaignPlanningView idea={idea} onUpdate={handleUpdate} />;
                    case 'Submit':
                        return (
                            <SocialCampaignSubmitView
                                idea={idea}
                                onUpdate={handleUpdate}
                                campaignStatus={linkedCampaign?.status}
                                onSubmit={handleSubmitSocialCampaign}
                                onRejectEntirely={handleRejectSocialCampaignEntirely}
                            />
                        );
                    case 'Approved':
                        return <SocialCampaignApprovedView idea={idea} onUpdate={handleUpdate} />;
                }
            }

            // 3. Single Post Pipeline (Legacy/Default)
            switch (activeTab) {
                case 'Brainstorm': return <BrainstormView idea={idea} onUpdate={handleUpdate} />;
                case 'Strategy': return <SocialStrategyView idea={idea} onUpdate={handleUpdate} />;
                case 'CreativeLab': return <SocialCreativeLabView idea={idea} onUpdate={handleUpdate} />;
                case 'Studio': return <SocialStudioView idea={idea} onUpdate={handleUpdate} />;
                case 'Distribution': return <SocialPerformanceView idea={idea} onUpdate={handleUpdate} />;
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
    let pipelineStages = PIPELINE_CONFIGS[idea.type] || PIPELINE_CONFIGS['Feature'];
    if (idea.type === 'Social' && idea.socialType === 'campaign') {
        pipelineStages = PIPELINE_CONFIGS['SocialCampaign'].filter(stage => {
            if (stage.id === 'Approved') {
                return idea.stage === 'Approved' || linkedCampaign?.status === 'Active' || linkedCampaign?.status === 'Completed';
            }
            if (stage.id === 'Rejected') {
                return idea.stage === 'Rejected' || linkedCampaign?.status === 'Rejected';
            }
            return true;
        });
    }

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
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] font-medium shrink-0">{flowTypeLabels[idea.type] || idea.type}</span>
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
                                {(idea.type === 'Social' && idea.socialType === 'campaign')
                                    ? (socialCampaignStageLabels[step.id] || step.title)
                                    : (stageLabels[step.id] || step.title)}
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
                            <option key={stage.id} value={stage.id}>
                                {(idea.type === 'Social' && idea.socialType === 'campaign')
                                    ? (socialCampaignStageLabels[stage.id] || stage.title)
                                    : (stageLabels[stage.id] || stage.title)}
                            </option>
                        ))}
                        <option value="Implemented">{stageLabels.Implemented}</option>
                        <option value="Archived">{stageLabels.Archived}</option>
                    </Select>

                    <div className="flex items-center gap-2 px-3">
                        {saveStatus === 'saving' && (
                            <span className="text-[10px] text-[var(--color-text-muted)] animate-pulse flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                                {t('flows.save.saving')}
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">cloud_done</span>
                                {t('flows.save.saved')}
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">error</span>
                                {t('flows.save.error')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 overflow-auto bg-[var(--color-surface-bg)] ${(idea.type === 'Social' && idea.socialType === 'campaign') ||
                ((activeTab === 'Strategy' || activeTab === 'Brainstorm' || activeTab === 'CreativeLab' || activeTab === 'Studio' || activeTab === 'Distribution') && idea.type === 'Social')
                ? 'p-0' : 'p-6'
                }`}>
                <div className={`${(idea.type === 'Social' && idea.socialType === 'campaign') ||
                    ((activeTab === 'Strategy' || activeTab === 'Brainstorm' || activeTab === 'CreativeLab' || activeTab === 'Studio' || activeTab === 'Distribution') && idea.type === 'Social')
                    ? 'h-full flex flex-col' : 'max-w-6xl mx-auto h-full flex flex-col'
                    }`}>
                    {renderStageView()}
                </div>
            </div>
        </div >
    );
};
