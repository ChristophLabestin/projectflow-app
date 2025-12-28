import React, { useState, useEffect, useMemo } from 'react';
import { generateBrainstormIdeas, generateProjectBlueprint, analyzeProjectRisks } from '../services/geminiService';
import { getUserIdeas, saveIdea, createProject, addTask, getAIUsage } from '../services/dataService';
import { Idea, ProjectBlueprint, ProjectRisk, StudioTool, AIUsage } from '../types';
import { auth } from '../services/firebase';
import { AIStudioHero } from '../components/studio/AIStudioHero';
import { StudioToolCard } from '../components/studio/StudioToolCard';
import { BlueprintResult } from '../components/studio/BlueprintResult';
import { RiskResult } from '../components/studio/RiskResult';
import { useToast } from '../context/UIContext';
import { Textarea } from '../components/ui/Textarea';
import { useLanguage } from '../context/LanguageContext';

const TOOL_CONFIGS: { id: StudioTool; titleKey: string; descriptionKey: string; placeholderKey: string; icon: string; color: string }[] = [
    {
        id: 'Architect',
        titleKey: 'aiStudio.tools.architect.title',
        descriptionKey: 'aiStudio.tools.architect.description',
        icon: 'architecture',
        color: 'indigo',
        placeholderKey: 'aiStudio.tools.architect.placeholder'
    },
    {
        id: 'Brainstormer',
        titleKey: 'aiStudio.tools.brainstormer.title',
        descriptionKey: 'aiStudio.tools.brainstormer.description',
        icon: 'lightbulb',
        color: 'amber',
        placeholderKey: 'aiStudio.tools.brainstormer.placeholder'
    },
    {
        id: 'RiskScout',
        titleKey: 'aiStudio.tools.riskscout.title',
        descriptionKey: 'aiStudio.tools.riskscout.description',
        icon: 'shield',
        color: 'rose',
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
                    category: ['AI Generated', 'Setup']
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

    const currentToolPlaceholder = tools.find(tool => tool.id === activeTool)?.placeholder || "...";

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-10 animate-fade-up space-y-12">
            <AIStudioHero />

            {/* Tool Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {tools.map((tool) => (
                    <StudioToolCard
                        key={tool.id}
                        tool={tool.id}
                        title={tool.title}
                        description={tool.description}
                        icon={tool.icon}
                        color={tool.color}
                        active={activeTool === tool.id}
                        onClick={() => setActiveTool(tool.id)}
                    />
                ))}
            </div>

            {/* Studio Command - Clean Professional Design */}
            <div className="max-w-4xl mx-auto">
                <div className={`rounded-2xl border shadow-lg dark:shadow-2xl overflow-hidden transition-colors duration-300 ${activeTool === 'Architect'
                    ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/50'
                    : activeTool === 'Brainstormer'
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50'
                    }`}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-300 ${activeTool === 'Architect'
                                    ? 'bg-indigo-100 dark:bg-indigo-500/20'
                                    : activeTool === 'Brainstormer'
                                        ? 'bg-amber-100 dark:bg-amber-500/20'
                                        : 'bg-rose-100 dark:bg-rose-500/20'
                                }`}>
                                <span className={`material-symbols-outlined text-[20px] transition-colors duration-300 ${activeTool === 'Architect'
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : activeTool === 'Brainstormer'
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                    }`}>terminal</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-white">{t('aiStudio.command.title')}</h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('aiStudio.command.subtitle')}</p>
                            </div>
                        </div>

                        {aiUsage && (
                            <div className="flex items-center gap-3 text-xs">
                                <span className="text-zinc-500 dark:text-zinc-400 font-medium">{t('aiStudio.usage.label')}</span>
                                <div className="w-20 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${aiUsage.tokensUsed >= aiUsage.tokenLimit * 0.9
                                            ? 'bg-rose-500'
                                            : 'bg-indigo-500'
                                            }`}
                                        style={{ width: `${Math.min(100, (aiUsage.tokensUsed / aiUsage.tokenLimit) * 100)}%` }}
                                    ></div>
                                </div>
                                <span className="text-zinc-700 dark:text-zinc-300 font-bold">{Math.round((aiUsage.tokensUsed / aiUsage.tokenLimit) * 100)}%</span>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-6">
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className={`w-full min-h-[200px] border-2 rounded-xl p-5 text-lg font-display text-zinc-900 dark:text-white focus:ring-2 focus:border-transparent resize-none transition-all ${activeTool === 'Architect'
                                ? 'bg-white dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-500/50 focus:ring-indigo-500 placeholder:text-indigo-400 dark:placeholder:text-indigo-400/60'
                                : activeTool === 'Brainstormer'
                                    ? 'bg-white dark:bg-amber-950/50 border-amber-300 dark:border-amber-500/50 focus:ring-amber-500 placeholder:text-amber-400 dark:placeholder:text-amber-400/60'
                                    : 'bg-white dark:bg-rose-950/50 border-rose-300 dark:border-rose-500/50 focus:ring-rose-500 placeholder:text-rose-400 dark:placeholder:text-rose-400/60'
                                }`}
                            placeholder={currentToolPlaceholder}
                        />
                    </div>

                    {/* Footer */}
                    <div className={`px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors duration-300 ${activeTool === 'Architect'
                        ? 'bg-indigo-100/50 dark:bg-indigo-900/30 border-indigo-200/50 dark:border-indigo-700/30'
                        : activeTool === 'Brainstormer'
                            ? 'bg-amber-100/50 dark:bg-amber-900/30 border-amber-200/50 dark:border-amber-700/30'
                            : 'bg-rose-100/50 dark:bg-rose-900/30 border-rose-200/50 dark:border-rose-700/30'
                        }`}>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            <span className="material-symbols-outlined text-[16px] align-middle mr-1">info</span>
                            {t('aiStudio.hint.specific')}
                        </p>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className={`
                                w-full sm:w-auto h-12 px-8 rounded-xl font-display font-bold text-sm
                                flex items-center justify-center gap-2 transition-all duration-200
                                ${isGenerating || !prompt.trim()
                                    ? 'bg-zinc-200 text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500 cursor-not-allowed'
                                    : activeTool === 'Architect'
                                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-md'
                                        : activeTool === 'Brainstormer'
                                            ? 'bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-md'
                                            : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95 shadow-md'
                                }
                            `}
                        >
                            <span className={`material-symbols-outlined text-[18px] ${isGenerating ? 'animate-spin' : ''}`}>
                                {isGenerating ? 'refresh' : 'play_arrow'}
                            </span>
                            <span>{isGenerating ? t('aiStudio.actions.generating') : t('aiStudio.actions.execute').replace('{tool}', activeToolLabel)}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Section */}
            {(blueprint || ideas.length > 0 || risks.length > 0) && (
                <div className="pt-12 border-t border-line dark:border-white/5 space-y-10">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-indigo-500">output</span>
                        <h3 className="text-2xl font-display font-bold">{t('aiStudio.results.title')}</h3>
                    </div>

                    {activeTool === 'Architect' && blueprint && (
                        <BlueprintResult
                            blueprint={blueprint}
                            onConvert={handleConvertToProject}
                            isConverting={isConverting}
                        />
                    )}

                    {activeTool === 'Brainstormer' && ideas.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
                            {ideas.map((idea) => (
                                <div key={idea.id} className="app-card group relative flex flex-col p-6 hover:translate-y-[-4px] transition-transform duration-300">
                                    <div className="flex justify-between items-start mb-4">
                                        <span className="app-tag bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-none px-3">{idea.type}</span>
                                        <span className="material-symbols-outlined text-indigo-400">auto_awesome</span>
                                    </div>
                                    <h4 className="text-ink dark:text-white text-lg font-display font-bold mb-3 leading-tight font-display">{idea.title}</h4>
                                    <p className="text-muted text-sm leading-relaxed flex-1">{idea.description}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTool === 'RiskScout' && risks.length > 0 && (
                        <RiskResult risks={risks} />
                    )}
                </div>
            )
            }


        </div >
    );
};
