import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deleteIdea, subscribeProjectIdeas, getProjectTasks, getProjectById, updateIdea } from '../services/dataService';
import { generateProjectIdeasAI } from '../services/geminiService';
import { Idea, Project, Task } from '../types';
import { Button } from '../components/common/Button/Button';
import { Badge } from '../components/common/Badge/Badge';
import { FlowPipelineBoard } from '../components/flows/FlowPipelineBoard';
import { CreateFlowModal } from '../components/flows/CreateFlowModal';
import { auth } from '../services/firebase';
import { useConfirm } from '../context/UIContext';
import { PIPELINE_CONFIGS, PipelineStageConfig, OVERVIEW_COLUMNS, TYPE_TONES } from '../components/flows/constants';
import { PipelineSummary } from '../components/flows/PipelineSummary';
import { OnboardingOverlay, OnboardingStep } from '../components/onboarding/OnboardingOverlay';
import { useOnboardingTour } from '../components/onboarding/useOnboardingTour';
import { useLanguage } from '../context/LanguageContext';

// ... (STAGE_CONFIG, TYPE_TONES, OVERVIEW_COLUMNS constants remain unchanged)

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
        <div className="project-flows__loading">
            <span className="material-symbols-outlined">rotate_right</span>
        </div>
    );

    return (
        <>
            <div className="project-flows">
                <div className="project-flows__header">
                    <div data-onboarding-id="project-flows-header" className="project-flows__header-top">
                        <div className="project-flows__title">
                            <h1>{t('flows.page.title')}</h1>
                            <p>{t('flows.page.subtitle')}</p>
                        </div>

                        <div className="project-flows__actions">
                            <div className="project-flows__view-toggle">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('board')}
                                    className={`project-flows__view-button ${viewMode === 'board' ? 'is-active' : ''}`}
                                    title={t('flows.view.board')}
                                    aria-pressed={viewMode === 'board'}
                                >
                                    <span className="material-symbols-outlined">view_kanban</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={`project-flows__view-button ${viewMode === 'list' ? 'is-active' : ''}`}
                                    title={t('flows.view.list')}
                                    aria-pressed={viewMode === 'list'}
                                >
                                    <span className="material-symbols-outlined">view_list</span>
                                </button>
                            </div>

                            <div className="project-flows__divider" />

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

                    <div data-onboarding-id="project-flows-tabs" className="project-flows__tabs">
                        <button
                            type="button"
                            onClick={() => setActivePipeline('Overview')}
                            className={`project-flows__tab ${activePipeline === 'Overview' ? 'is-active' : ''}`}
                        >
                            <span className="material-symbols-outlined">dashboard</span>
                            {t('flows.tabs.overview')}
                        </button>
                        {Object.keys(PIPELINE_CONFIGS).map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setActivePipeline(type)}
                                className={`project-flows__tab ${activePipeline === type ? 'is-active' : ''}`}
                            >
                                {pipelineTypeLabels[type] || type}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="project-flows__content">
                    <div data-onboarding-id="project-flows-summary">
                        <PipelineSummary
                            stats={pipelineStats}
                            stageConfigs={activeColumns}
                            pipelineName={activePipeline}
                        />
                    </div>

                    <div data-onboarding-id="project-flows-board" className="project-flows__board">
                        {filteredIdeas.length === 0 && !loading && !generating ? (
                            <div className="project-flows__empty">
                                <div className="project-flows__empty-icon">
                                    <span className="material-symbols-outlined">lightbulb</span>
                                </div>
                                <h3>{t('flows.empty.title')}</h3>
                                <p>
                                    {t('flows.empty.description').replace('{pipeline}', pipelineTypeLabels[activePipeline] || activePipeline)}
                                </p>
                                <Button variant="secondary" onClick={() => setShowCreateModal(true)}>
                                    {t('flows.empty.actions.add')}
                                </Button>
                            </div>
                        ) : viewMode === 'board' ? (
                            <div className="project-flows__board-surface">
                                <FlowPipelineBoard
                                    flows={filteredIdeas}
                                    columns={activeColumns}
                                    onFlowMove={handleIdeaMove}
                                    onFlowClick={(idea) => navigate(`/project/${id}/flows/${idea.id}`)}
                                />
                            </div>
                        ) : (
                            <div className="project-flows__list-wrapper">
                                <div className="project-flows__list">
                                    {filteredIdeas.map((idea) => {
                                        const activeStageConfig = activeColumns.find(c => c.id === idea.stage);
                                        const icon = activeStageConfig?.icon || 'circle';
                                        const tone = activeStageConfig?.tone || 'neutral';
                                        const typeTone = TYPE_TONES[idea.type] || TYPE_TONES.default;
                                        const badgeVariant = tone === 'success'
                                            ? 'success'
                                            : tone === 'warning'
                                                ? 'warning'
                                                : tone === 'danger'
                                                    ? 'error'
                                                    : 'neutral';

                                        return (
                                            <div
                                                key={idea.id}
                                                className={`flow-list-card flow-tone--${tone}`}
                                                onClick={() => navigate(`/project/${id}/flows/${idea.id}`)}
                                            >
                                                <div className="flow-list-card__icon">
                                                    <span className="material-symbols-outlined">{icon}</span>
                                                </div>

                                                <div className="flow-list-card__body">
                                                    <div className="flow-list-card__tags">
                                                        <span className={`flow-tag flow-tag--${typeTone}`}>
                                                            {pipelineTypeLabels[idea.type] || idea.type}
                                                        </span>
                                                        {idea.generated && (
                                                            <span className="flow-tag flow-tag--ai">
                                                                <span className="material-symbols-outlined">auto_awesome</span>
                                                                {t('flows.badge.ai')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="flow-list-card__title">{idea.title}</h4>
                                                    {idea.description && (
                                                        <p className="flow-list-card__description">{idea.description}</p>
                                                    )}
                                                </div>

                                                <div className="flow-list-card__meta">
                                                    <div className="flow-list-card__stats">
                                                        <span className="flow-list-card__stat">
                                                            <span className="material-symbols-outlined">thumb_up</span>
                                                            {idea.votes || 0}
                                                        </span>
                                                        <span className="flow-list-card__stat">
                                                            <span className="material-symbols-outlined">chat_bubble</span>
                                                            {idea.comments || 0}
                                                        </span>
                                                    </div>
                                                    <Badge variant={badgeVariant} className={`flow-list-card__stage flow-tone--${tone}`}>
                                                        {activeStageConfig?.title || idea.stage}
                                                    </Badge>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant="ghost"
                                                        className="flow-list-card__delete"
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(idea.id); }}
                                                        aria-label={t('flows.actions.delete')}
                                                    >
                                                        <span className="material-symbols-outlined">delete</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

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
