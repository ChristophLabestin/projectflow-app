import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button/Button';
import { Select } from '../components/common/Select/Select';
import { deleteField } from 'firebase/firestore';
import { updateIdea, addTask, getSocialCampaign, updateCampaign, deleteSocialCampaign, subscribeToIdea } from '../services/dataService';
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
import { PaidAdsBriefView } from '../components/flows/stages/PaidAdsBriefView';
import { PaidAdsResearchView } from '../components/flows/stages/PaidAdsResearchView';
import { PaidAdsCreativeView } from '../components/flows/stages/PaidAdsCreativeView';
import { PaidAdsTargetingView } from '../components/flows/stages/PaidAdsTargetingView';
import { PaidAdsBudgetView } from '../components/flows/stages/PaidAdsBudgetView';
import { PaidAdsBuildView } from '../components/flows/stages/PaidAdsBuildView';
import { PaidAdsReviewView } from '../components/flows/stages/PaidAdsReviewView';
import { PaidAdsLiveView } from '../components/flows/stages/PaidAdsLiveView';
import { PaidAdsOptimizationView } from '../components/flows/stages/PaidAdsOptimizationView';
import { MarketingTypeSelection } from '../components/flows/stages/MarketingTypeSelection';
import { Idea, SocialCampaign } from '../types';
import { PIPELINE_CONFIGS } from '../components/flows/constants';
import { useLanguage } from '../context/LanguageContext';



export const FlowDetail = () => {
    const { id: projectId, flowId } = useParams<{ id: string; flowId: string }>();
    const navigate = useNavigate();
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
        // Paid Ads stages
        Brief: t('flows.stage.brief'),
        Creative: t('flows.stage.creative'),
        Targeting: t('flows.stage.targeting'),
        Budget: t('flows.stage.budget'),
        Live: t('flows.stage.live'),
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
        PaidAds: t('flows.type.paidAds'),
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
        if (idea.type === 'Marketing') {
            // 1. Interception: Select Type if not set (Paid Ads vs Email Marketing)
            if (!idea.marketingType) {
                return (
                    <MarketingTypeSelection
                        onSelect={(type) => {
                            const updates: Partial<Idea> = { marketingType: type };
                            if (type === 'paidAd') {
                                // Switch to PaidAds pipeline
                                updates.type = 'PaidAds';
                                updates.stage = 'Brief';
                            } else {
                                // Stay in Marketing pipeline for email marketing
                                updates.stage = 'Strategy';
                            }
                            handleUpdate(updates);
                        }}
                    />
                );
            }

            // Email Marketing pipeline (default Marketing stages)
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

        // Paid Ads specific mappings
        if (idea.type === 'PaidAds') {
            switch (activeTab) {
                case 'Brief': return <PaidAdsBriefView idea={idea} onUpdate={handleUpdate} />;
                case 'Research': return <PaidAdsResearchView idea={idea} onUpdate={handleUpdate} />;
                case 'Creative': return <PaidAdsCreativeView idea={idea} onUpdate={handleUpdate} />;
                case 'Targeting': return <PaidAdsTargetingView idea={idea} onUpdate={handleUpdate} />;
                case 'Budget': return <PaidAdsBudgetView idea={idea} onUpdate={handleUpdate} />;
                case 'Build': return <PaidAdsBuildView idea={idea} onUpdate={handleUpdate} />;
                case 'Review': return <PaidAdsReviewView idea={idea} onUpdate={handleUpdate} />;
                case 'Live': return <PaidAdsLiveView idea={idea} onUpdate={handleUpdate} />;
                case 'Optimization': return <PaidAdsOptimizationView idea={idea} onUpdate={handleUpdate} />;
                default: return <PaidAdsBriefView idea={idea} onUpdate={handleUpdate} />;
            }
        }

        // Return Generic View for other types (for now)
        return <GenericStageView idea={idea} stageId={activeTab} onUpdate={handleUpdate} />;
    };

    if (loading) return (
        <div className="flow-detail__loading">
            <span className="material-symbols-outlined flow-detail__loading-icon animate-spin">progress_activity</span>
        </div>
    );

    if (!idea) return null;

    const isSocialCampaign = idea.type === 'Social' && idea.socialType === 'campaign';
    const isSocialStageFullBleed = idea.type === 'Social' && ['Strategy', 'Brainstorm', 'CreativeLab', 'Studio', 'Distribution'].includes(activeTab);
    const isFullBleed = isSocialCampaign || idea.type === 'PaidAds' || isSocialStageFullBleed;

    // Get current pipeline configuration
    let pipelineStages = PIPELINE_CONFIGS[idea.type] || PIPELINE_CONFIGS['Feature'];
    if (isSocialCampaign) {
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

    const stageOptions = [
        ...pipelineStages.map(stage => ({
            value: stage.id,
            label: isSocialCampaign
                ? (socialCampaignStageLabels[stage.id] || stage.title)
                : (stageLabels[stage.id] || stage.title),
        })),
        { value: 'Implemented', label: stageLabels.Implemented },
        { value: 'Archived', label: stageLabels.Archived },
    ];

    return (
        <div className="flow-detail">
            {/* Unified Toolbar: Back, Title, Nav, Actions */}
            <div className="flow-detail__toolbar">
                {/* Left: Back & Title & Tabs */}
                <div className="flow-detail__toolbar-left">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="flow-detail__back"
                        onClick={handleBack}
                        aria-label={t('flows.actions.back')}
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Button>

                    <div className="flow-detail__divider" />

                    <div className="flow-detail__title-block">
                        <h1 className="flow-detail__title" title={idea.title}>{idea.title}</h1>
                        <span className="flow-detail__type">{flowTypeLabels[idea.type] || idea.type}</span>
                    </div>

                    <div className="flow-detail__divider" />

                    <div className="flow-detail__tabs">
                        {pipelineStages.map((step) => (
                            <button
                                key={step.id}
                                type="button"
                                onClick={() => setActiveTab(step.id)}
                                className={`flow-detail__tab ${activeTab === step.id ? 'is-active' : ''}`}
                            >
                                <span className={`material-symbols-outlined flow-detail__tab-icon ${activeTab === step.id ? 'filled' : ''}`}>{step.icon}</span>
                                {isSocialCampaign
                                    ? (socialCampaignStageLabels[step.id] || step.title)
                                    : (stageLabels[step.id] || step.title)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flow-detail__toolbar-right">
                    <div className="flow-detail__divider" />

                    <Select
                        value={idea.stage || pipelineStages[0].id}
                        onChange={(value) => handleUpdate({ stage: value as any })}
                        options={stageOptions}
                        className="flow-detail__stage-select"
                    />

                    <div className="flow-detail__save">
                        {saveStatus === 'saving' && (
                            <span className="flow-detail__save-status" data-state="saving">
                                <span className="material-symbols-outlined">sync</span>
                                {t('flows.save.saving')}
                            </span>
                        )}
                        {saveStatus === 'saved' && (
                            <span className="flow-detail__save-status" data-state="saved">
                                <span className="material-symbols-outlined">cloud_done</span>
                                {t('flows.save.saved')}
                            </span>
                        )}
                        {saveStatus === 'error' && (
                            <span className="flow-detail__save-status" data-state="error">
                                <span className="material-symbols-outlined">error</span>
                                {t('flows.save.error')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className={`flow-detail__content ${isFullBleed ? 'flow-detail__content--flush' : 'flow-detail__content--padded'}`}>
                <div className={`flow-detail__content-inner ${isFullBleed ? 'flow-detail__content-inner--full' : 'flow-detail__content-inner--centered'}`}>
                    {renderStageView()}
                </div>
            </div>
        </div >
    );
};
