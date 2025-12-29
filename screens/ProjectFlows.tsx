import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deleteIdea, subscribeProjectIdeas, getProjectTasks, getProjectById, updateIdea } from '../services/dataService';
import { generateProjectIdeasAI } from '../services/geminiService';
import { Idea, Project, Task } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { FlowPipelineBoard } from '../components/flows/FlowPipelineBoard';
import { CreateFlowModal } from '../components/flows/CreateFlowModal';
import { auth } from '../services/firebase';
import { useConfirm } from '../context/UIContext';
import { PIPELINE_CONFIGS, PipelineStageConfig, OVERVIEW_COLUMNS, TYPE_COLORS } from '../components/flows/constants';
import { PipelineSummary } from '../components/flows/PipelineSummary';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { useLanguage } from '../context/LanguageContext';

// ... (STAGE_CONFIG, TYPE_COLORS, OVERVIEW_COLUMNS constants remain unchanged)

export const ProjectFlows = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLanguage();
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
    const [activePipeline, setActivePipeline] = useState<string>(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('pipeline') || params.get('tab');
        if (tab && (PIPELINE_CONFIGS[tab] || tab === 'Overview')) {
            return tab;
        }
        return 'Overview';
    }); // Default to Overview (Triage) or URL param

    // Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState({ id: '', title: '', description: '', type: '' });
    const [error, setError] = useState<string | null>(null);

    const pipelineTypeLabels = useMemo(() => ({
        Overview: t('flows.type.overview'),
        Feature: t('flows.type.feature'),
        Product: t('flows.type.product'),
        Moonshot: t('flows.type.moonshot'),
        Optimization: t('flows.type.optimization'),
        Marketing: t('flows.type.marketing'),
        Social: t('flows.type.social'),
        SocialCampaign: t('flows.type.socialCampaign'),
        PaidAds: t('flows.type.paidAds'),
    }), [t]);

    const overviewLabels = useMemo(() => ({
        Feature: t('flows.overview.featurePipeline'),
        Product: t('flows.overview.productLaunch'),
        Marketing: t('flows.overview.marketing'),
        Social: t('flows.overview.social'),
        Moonshot: t('flows.overview.moonshot'),
        Optimization: t('flows.overview.optimization'),
    }), [t]);

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

    // Stats - Enhanced for Pipeline Summary
    const pipelineStats = useMemo(() => {
        const stats = {
            total: 0,
            byStage: {} as Record<string, number>
        };

        const targetIdeas = ideas.filter(idea => {
            if (activePipeline === 'Overview') return true;

            if (activePipeline === 'SocialCampaign') {
                return idea.type === 'Social' && idea.socialType === 'campaign';
            }
            if (activePipeline === 'Social') {
                // Determine if this idea appears on the Social board
                if (idea.type === 'Social' && idea.socialType === 'campaign' && idea.stage === 'Concept') return true;
                return idea.type === 'Social' && idea.socialType !== 'campaign';
            }

            return idea.type === activePipeline;
        });

        stats.total = targetIdeas.length;

        targetIdeas.forEach(idea => {
            let stageKey = idea.stage || 'Brainstorm';

            if (activePipeline === 'Overview') {
                stageKey = idea.type;
            } else if (activePipeline === 'SocialCampaign') {
                if (stageKey === 'PendingReview') {
                    stageKey = 'Submit';
                }
            } else if (activePipeline === 'Social') {
                if (idea.socialType === 'campaign' && stageKey === 'Concept') {
                    stageKey = 'Brainstorm';
                }
            }

            stats.byStage[stageKey] = (stats.byStage[stageKey] || 0) + 1;
        });

        return stats;
    }, [ideas, activePipeline]);

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
            const ideasToSave = generated.map(idea => {
                const isSocialCampaign = targetType === 'SocialCampaign';
                const type = isSocialCampaign ? 'Social' : targetType;
                const socialType = isSocialCampaign ? 'campaign' : (type === 'Social' ? 'post' : undefined);

                return {
                    ...idea,
                    projectId: id,
                    mindmapId: null,
                    type,
                    socialType: socialType as any,
                    stage: initialStage
                };
            });

            const { saveIdea } = await import('../services/dataService');
            await Promise.all(ideasToSave.map(idea => saveIdea(idea)));
            // No need to reload, real-time listener will catch it
        } catch (e) {
            console.error(e);
            setError(t('flows.errors.generationFailed'));
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

                const isSocialCampaign = newType === 'SocialCampaign';
                const finalType = isSocialCampaign ? 'Social' : newType;
                const socialType = isSocialCampaign ? 'campaign' : (finalType === 'Social' ? 'post' : undefined);

                // Optimistic Update
                setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, type: finalType as any, socialType: socialType as any, stage: newInitialStage } : i));

                await updateIdea(ideaId, { type: finalType as any, socialType: socialType as any, stage: newInitialStage }, id);

            } else {
                // Standard Pipeline Mode: Dragging changes Stage
                let newStage = newStageOrType;

                // Special handling for Social Pipeline: Board column 'Brainstorm' maps to 'Concept' for Campaigns
                if (activePipeline === 'Social' && targetIdea.socialType === 'campaign' && newStage === 'Brainstorm') {
                    newStage = 'Concept';
                }

                // Optimistic Update
                setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, stage: newStage } : i));

                await updateIdea(ideaId, { stage: newStage }, id);
            }
        } catch (e) {
            console.error("Failed to move flow", e);
            setIdeas(previousIdeas); // Revert
            // No need to call loadData, we reverted state.
        }
    };

    const handleDelete = async (ideaId: string) => {
        if (!await confirm(t('flows.confirm.deleteTitle'), t('flows.confirm.deleteMessage'))) return;
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
                // FlowPipelineBoard expects grouped by 'stage'.
                // If we pass OVERVIEW_COLUMNS (where id=Type), the Board will look for ideas where idea.stage === Type.
                // We need to trick the board or map the data.

                // Let's create a virtual 'stage' for the board rendering only equivalent to the type.
                // But only if it's in the actual first stage.

                const firstStage = PIPELINE_CONFIGS[idea.type]?.[0]?.id;

                if (idea.stage === firstStage) {
                    // Group PaidAds under Marketing column in Overview
                    const columnType = idea.type === 'PaidAds' ? 'Marketing' : idea.type;
                    return { ...idea, stage: columnType }; // Temporarily override stage to match Type ID for column grouping
                }
                return null;
            }).filter(Boolean) as Idea[];
        }

        // Standard Pipeline Filtering
        // Standard Pipeline Filtering
        return ideas.map(idea => {
            if (activePipeline === 'Social') {
                // Show Social Posts as normal
                if (idea.type === 'Social' && idea.socialType !== 'campaign') {
                    return idea;
                }
                // Also show Social Campaigns that are in the 'Concept' stage (mapped to Brainstorm column)
                if (idea.type === 'Social' && idea.socialType === 'campaign' && idea.stage === 'Concept') {
                    return { ...idea, stage: 'Brainstorm' }; // Visual mapping: Concept -> Brainstorm column
                }
                return null;
            }
            if (activePipeline === 'SocialCampaign') {
                if (idea.type === 'Social' && idea.socialType === 'campaign') {
                    if (idea.stage === 'PendingReview') {
                        return { ...idea, stage: 'Submit' };
                    }
                    return idea;
                }
                return null;
            }
            return idea.type === activePipeline ? idea : null;
        }).filter(Boolean) as Idea[];
    }, [ideas, activePipeline]);

    const activeColumns = useMemo(() => {
        const baseColumns = activePipeline === 'Overview'
            ? OVERVIEW_COLUMNS
            : (PIPELINE_CONFIGS[activePipeline] || PIPELINE_CONFIGS['Feature']);

        return baseColumns.map((column) => {
            let title = column.title;
            if (activePipeline === 'Overview') {
                title = overviewLabels[column.id] || column.title;
            } else if (activePipeline === 'SocialCampaign') {
                title = socialCampaignStageLabels[column.id] || stageLabels[column.id] || column.title;
            } else {
                title = stageLabels[column.id] || column.title;
            }
            return { ...column, title };
        });
    }, [activePipeline, overviewLabels, stageLabels, socialCampaignStageLabels]);

    const onboardingSteps = useMemo<OnboardingStep[]>(() => ([
        {
            id: 'header',
            targetId: 'project-flows-header',
            title: t('onboarding.projectFlows.header.title'),
            description: t('onboarding.projectFlows.header.description')
        },
        {
            id: 'tabs',
            targetId: 'project-flows-tabs',
            title: t('onboarding.projectFlows.tabs.title'),
            description: t('onboarding.projectFlows.tabs.description')
        },
        {
            id: 'summary',
            targetId: 'project-flows-summary',
            title: t('onboarding.projectFlows.summary.title'),
            description: t('onboarding.projectFlows.summary.description')
        },
        {
            id: 'board',
            targetId: 'project-flows-board',
            title: t('onboarding.projectFlows.board.title'),
            description: t('onboarding.projectFlows.board.description')
        }
    ]), [t]);

    const {
        onboardingActive,
        stepIndex,
        setStepIndex,
        skip,
        finish
    } = useOnboardingTour('project_flows', { stepCount: onboardingSteps.length, autoStart: true, enabled: !loading });

    if (loading) return (
        <div className="flex items-center justify-center p-12">
            <span className="material-symbols-outlined text-[var(--color-text-subtle)] animate-spin text-3xl">rotate_right</span>
        </div>
    );

    return (
        <>
            <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden fade-in px-6 pt-4 pb-0 gap-6">
                {/* Header - Reworked for Pipeline Variants */}
                <div className="flex flex-col gap-6 shrink-0 border-b border-[var(--color-surface-border)] pb-0">
                    <div data-onboarding-id="project-flows-header" className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl font-bold text-[var(--color-text-main)]">{t('flows.page.title')}</h1>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('flows.page.subtitle')}</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* View Mode */}
                            <div className="flex items-center rounded-lg border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)] overflow-hidden p-0.5">
                                <button
                                    onClick={() => setViewMode('board')}
                                    className={`p-2 rounded-md transition-all flex items-center justify-center ${viewMode === 'board'
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                                    title={t('flows.view.board')}
                                >
                                    <span className="material-symbols-outlined text-[20px]">view_kanban</span>
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded-md transition-all flex items-center justify-center ${viewMode === 'list'
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] shadow-sm'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'}`}
                                    title={t('flows.view.list')}
                                >
                                    <span className="material-symbols-outlined text-[20px]">view_list</span>
                                </button>
                            </div>

                            <div className="h-8 w-px bg-[var(--color-surface-border)]" />

                            <Button
                                variant="secondary"
                                onClick={handleGenerate}
                                isLoading={generating}
                                icon={<span className="material-symbols-outlined">auto_awesome</span>}
                            >
                                {t('flows.actions.generate')}
                            </Button>
                            <Button
                                onClick={() => {
                                    setFormData({ id: '', title: '', description: '', type: activePipeline === 'Overview' ? 'Feature' : activePipeline });
                                    setShowCreateModal(true);
                                }}
                                icon={<span className="material-symbols-outlined">add</span>}
                            >
                                {t('flows.actions.add')}
                            </Button>
                        </div>
                    </div>

                    {/* Navigation Tabs - Scrollable */}
                    <div data-onboarding-id="project-flows-tabs" className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px">
                        <button
                            onClick={() => setActivePipeline('Overview')}
                            className={`
                            px-4 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2
                            ${activePipeline === 'Overview'
                                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-surface-border-hover)]'
                                }
                        `}
                        >
                            <span className="material-symbols-outlined text-[18px]">dashboard</span>
                            {t('flows.tabs.overview')}
                        </button>
                        {Object.keys(PIPELINE_CONFIGS).map(type => (
                            <button
                                key={type}
                                onClick={() => setActivePipeline(type)}
                                className={`
                                px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap
                                ${activePipeline === type
                                        ? 'border-[var(--color-primary)] text-[var(--color-text-main)]'
                                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-surface-border-hover)]'
                                    }
                            `}
                            >
                                {pipelineTypeLabels[type] || type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-h-0">

                    {/* Summary Dashboard */}
                    <div data-onboarding-id="project-flows-summary">
                        <PipelineSummary
                            stats={pipelineStats}
                            stageConfigs={activeColumns}
                            pipelineName={activePipeline}
                        />
                    </div>

                    <div data-onboarding-id="project-flows-board" className="flex-1 flex flex-col min-h-0">
                        {filteredIdeas.length === 0 && !loading && !generating ? (
                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-[var(--color-surface-border)] rounded-2xl bg-[var(--color-surface-bg)]/50 m-1">
                                <div className="text-center py-16 max-w-md">
                                    <div className="size-20 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 flex items-center justify-center mx-auto mb-6">
                                        <span className="material-symbols-outlined text-[40px] text-indigo-500">lightbulb</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">{t('flows.empty.title')}</h3>
                                    <p className="text-[var(--color-text-muted)] mb-6">
                                        {t('flows.empty.description').replace('{pipeline}', pipelineTypeLabels[activePipeline] || activePipeline)}
                                    </p>
                                    <div className="flex items-center justify-center gap-3">
                                        <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                                            {t('flows.empty.actions.add')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : viewMode === 'board' ? (
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <FlowPipelineBoard
                                    flows={filteredIdeas}
                                    columns={activeColumns}
                                    onFlowMove={handleIdeaMove}
                                    onFlowClick={(idea) => navigate(`/project/${id}/flows/${idea.id}`)}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar pb-8">
                                <div className="grid grid-cols-1 gap-2">
                                    {filteredIdeas.map((idea) => {
                                        const activeStageConfig = activeColumns.find(c => c.id === idea.stage);
                                        const icon = activeStageConfig?.icon || 'circle';
                                        const bgColor = activeStageConfig?.color?.replace('bg-', 'text-') || 'text-slate-500';
                                        const bgClass = activeStageConfig?.color?.replace('500', '100 dark:bg-opacity-10') || 'bg-slate-100 dark:bg-slate-800';
                                        const typeColor = TYPE_COLORS[idea.type] || TYPE_COLORS['default'];

                                        return (
                                            <div
                                                key={idea.id}
                                                className="group bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] rounded-xl p-4 flex items-center gap-4 hover:shadow-md hover:border-[var(--color-surface-border)] cursor-pointer transition-all"
                                                onClick={() => navigate(`/project/${id}/flows/${idea.id}`)}
                                            >
                                                {/* Stage Icon */}
                                                <div className={`size-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0`}>
                                                    <span className={`material-symbols-outlined text-[20px] ${bgColor.replace('bg-', 'text-')}`}>{icon}</span>
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${typeColor}`}>
                                                            {pipelineTypeLabels[idea.type] || idea.type}
                                                        </span>
                                                        {idea.generated && (
                                                            <span className="text-[10px] font-medium text-indigo-500 flex items-center gap-0.5">
                                                                <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                                                {t('flows.badge.ai')}
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
                    </div>
                </div>

                {/* Create Modal */}
                <CreateFlowModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    projectId={id || ''}
                    onCreated={() => { }}
                />
            </div>
            <OnboardingOverlay
                isOpen={onboardingActive}
                steps={onboardingSteps}
                stepIndex={stepIndex}
                onStepChange={setStepIndex}
                onFinish={finish}
                onSkip={skip}
            />
        </>
    );
};
