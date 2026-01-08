import React, { useState, useEffect, useMemo } from 'react';
import { generateBrainstormIdeas, generateProjectBlueprint, analyzeProjectRisks } from '../services/geminiService';
import { saveIdea, createProject, addTask, getAIUsage } from '../services/dataService';
import { Idea, ProjectBlueprint, ProjectRisk, StudioTool, AIUsage } from '../types';
import { auth } from '../services/firebase';
import { AIStudioHero } from '../components/studio/AIStudioHero';
import { StudioToolCard } from '../components/studio/StudioToolCard';
import { BlueprintResult } from '../components/studio/BlueprintResult';
import { RiskResult } from '../components/studio/RiskResult';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { Button } from '../components/common/Button/Button';
import { Card, CardBody, CardFooter, CardHeader } from '../components/common/Card/Card';
import { TextArea } from '../components/common/Input/TextArea';
import { Badge } from '../components/common/Badge/Badge';
import './brainstorming.scss';


const TOOL_CONFIGS: { id: StudioTool; titleKey: string; descriptionKey: string; placeholderKey: string; icon: string }[] = [
    {
        id: 'Architect',
        titleKey: 'aiStudio.tools.architect.title',
        descriptionKey: 'aiStudio.tools.architect.description',
        icon: 'architecture',
        placeholderKey: 'aiStudio.tools.architect.placeholder'
    },
    {
        id: 'Brainstormer',
        titleKey: 'aiStudio.tools.brainstormer.title',
        descriptionKey: 'aiStudio.tools.brainstormer.description',
        icon: 'lightbulb',
        placeholderKey: 'aiStudio.tools.brainstormer.placeholder'
    },
    {
        id: 'RiskScout',
        titleKey: 'aiStudio.tools.riskscout.title',
        descriptionKey: 'aiStudio.tools.riskscout.description',
        icon: 'shield',
        placeholderKey: 'aiStudio.tools.riskscout.placeholder'
    }
];

export const Brainstorming = () => {
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [activeTool, setActiveTool] = useState<StudioTool>('Architect');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    // Results
    const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [risks, setRisks] = useState<ProjectRisk[]>([]);
    const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);

    const toolLabels = useMemo(() => ({
        Architect: t('aiStudio.tools.architect.label'),
        Brainstormer: t('aiStudio.tools.brainstormer.label'),
        RiskScout: t('aiStudio.tools.riskscout.label'),
    }), [t]);

    const tools = useMemo(() => TOOL_CONFIGS.map(tool => ({
        ...tool,
        title: t(tool.titleKey),
        description: t(tool.descriptionKey),
        placeholder: t(tool.placeholderKey),
    })), [t]);

    const activeToolLabel = toolLabels[activeTool] || activeTool;
    const activeToolKey = activeTool.toLowerCase();

    const fetchUsage = async () => {
        const user = auth.currentUser;
        if (user) {
            const usage = await getAIUsage(user.uid);
            setAiUsage(usage);
        }
    };

    useEffect(() => {
        fetchUsage();
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);

        // Clear previous results of the SAME type when generating new ones
        if (activeTool === 'Architect') setBlueprint(null);
        if (activeTool === 'Brainstormer') setIdeas([]);
        if (activeTool === 'RiskScout') setRisks([]);

        try {
            if (activeTool === 'Architect') {
                const result = await generateProjectBlueprint(prompt);
                setBlueprint(result);
            } else if (activeTool === 'Brainstormer') {
                const result = await generateBrainstormIdeas(prompt);
                setIdeas(result);
                // Save ideas to history (background)
                for (const idea of result) {
                    await saveIdea(idea);
                }
            } else if (activeTool === 'RiskScout') {
                const result = await analyzeProjectRisks(prompt);
                setRisks(result);
            }

            showToast(t('aiStudio.toast.completed').replace('{tool}', activeToolLabel), 'success');
            fetchUsage(); // Refresh usage after success
        } catch (e) {
            console.error(e);
            showToast(e instanceof Error ? e.message : t('aiStudio.errors.generate'), 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConvertToProject = async (bp: ProjectBlueprint) => {
        setIsConverting(true);
        try {
            const projectId = await createProject({
                title: bp.title,
                description: bp.description,
                status: 'Planning',
                priority: 'Medium',
            });

            // Add initial tasks
            for (const task of bp.initialTasks) {
                await addTask(projectId, task.title, undefined, undefined, task.priority, {
                    category: ['CORA Generated', 'Setup']
                });
            }

            // Add milestones as tasks with High priority? Or just mention in desc?
            // For now, let's add them as tasks too but marked as milestones
            for (const ms of bp.milestones) {
                await addTask(projectId, `${t('aiStudio.blueprint.milestonePrefix')} ${ms.title}`, undefined, undefined, 'High', {
                    description: ms.description,
                    category: ['Milestone']
                });
            }

            showToast(t('aiStudio.toast.projectCreated').replace('{title}', bp.title), 'success');
            // Reset blueprint after conversion?
            setBlueprint(null);
            setPrompt('');
        } catch (e) {
            console.error(e);
            showToast(t('aiStudio.errors.convert'), 'error');
        } finally {
            setIsConverting(false);
        }
    };

    const currentToolPlaceholder = tools.find(tool => tool.id === activeTool)?.placeholder ?? '';
    const usagePercent = aiUsage?.tokenLimit
        ? Math.min(100, (aiUsage.tokensUsed / aiUsage.tokenLimit) * 100)
        : 0;
    const isUsageCritical = usagePercent >= 90;

    return (
        <div className={`ai-studio ${isGenerating ? 'is-generating' : ''}`.trim()} data-tool={activeToolKey}>
            <div className="ai-studio__layout">
                <AIStudioHero />


                <div className="ai-studio__tool-grid">
                    {tools.map((tool) => (
                        <StudioToolCard
                            key={tool.id}
                            tool={tool.id}
                            title={tool.title}
                            description={tool.description}
                            icon={tool.icon}
                            active={activeTool === tool.id}
                            onClick={() => setActiveTool(tool.id)}
                        />
                    ))}
                </div>

                <div className="ai-studio__command">
                    <Card className="ai-studio-command">
                        <div className="ai-studio-command__header">
                            <div className="ai-studio-command__meta">
                                <div className="ai-studio-command__icon">
                                    <span className="material-symbols-outlined">{activeToolKey === 'brainstormer' ? 'lightbulb' : activeToolKey === 'riskscout' ? 'shield' : 'architecture'}</span>
                                </div>
                                <div>
                                    <h3>{activeToolLabel} Studio</h3>
                                    <p>{currentToolPlaceholder}</p>
                                </div>
                            </div>

                            {aiUsage && (
                                <div className={`ai-studio-usage ${isUsageCritical ? 'is-critical' : ''}`.trim()}>
                                    <span className="ai-studio-usage__label">Usage Efficiency</span>
                                    <div className="ai-studio-usage__bar">
                                        <div
                                            className="ai-studio-usage__fill"
                                            style={{ width: `${usagePercent}%` }}
                                        />
                                    </div>
                                    <span className="ai-studio-usage__value">{Math.round(usagePercent)}%</span>
                                </div>
                            )}
                        </div>

                        <CardBody className="ai-studio-command__body">
                            <TextArea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="ai-studio-command__input"
                                placeholder="Describe your vision or project goal..."
                            />
                        </CardBody>

                        <div className="ai-studio-command__footer">
                            <p className="ai-studio-command__hint">
                                <span className="material-symbols-outlined">auto_awesome</span>
                                {t('aiStudio.hint.specific')}
                            </p>

                            <Button
                                onClick={handleGenerate}
                                disabled={!prompt.trim()}
                                isLoading={isGenerating}
                                icon={<span className="material-symbols-outlined">bolt</span>}
                                className="ai-studio-command__action"
                            >
                                {isGenerating ? t('aiStudio.actions.generating') : 'Initialize Generation'}
                            </Button>
                        </div>
                    </Card>
                </div>

                {(blueprint || ideas.length > 0 || risks.length > 0) && (
                    <section className="ai-studio-results">
                        <div className="ai-studio-results__header">
                            <span className="material-symbols-outlined">output</span>
                            <h3>{t('aiStudio.results.title')}</h3>
                        </div>

                        {activeTool === 'Architect' && blueprint && (
                            <BlueprintResult
                                blueprint={blueprint}
                                onConvert={handleConvertToProject}
                                isConverting={isConverting}
                            />
                        )}

                        {activeTool === 'Brainstormer' && ideas.length > 0 && (
                            <div className="ai-studio-ideas animate-fade-in">
                                {ideas.map((idea) => (
                                    <Card key={idea.id} className="ai-studio-idea-card">
                                        <CardBody className="ai-studio-idea-card__body">
                                            <div className="ai-studio-idea-card__header">
                                                <Badge variant="neutral" className="ai-studio-idea-card__badge">{idea.type}</Badge>
                                                <span className="material-symbols-outlined">auto_awesome</span>
                                            </div>
                                            <h4 className="ai-studio-idea-card__title">{idea.title}</h4>
                                            <p className="ai-studio-idea-card__description">{idea.description}</p>
                                        </CardBody>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {activeTool === 'RiskScout' && risks.length > 0 && (
                            <RiskResult risks={risks} />
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};
