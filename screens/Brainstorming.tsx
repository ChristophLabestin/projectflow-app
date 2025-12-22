import React, { useState, useEffect } from 'react';
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

const TOOLS: { id: StudioTool; title: string; description: string; icon: string; color: string; placeholder: string }[] = [
    {
        id: 'Architect',
        title: 'Project Architect',
        description: 'Turn a rough seed into a full project blueprint with milestones and tasks.',
        icon: 'architecture',
        color: 'indigo',
        placeholder: 'Describe your project goal (e.g. "A marketplace for vintage cameras")....'
    },
    {
        id: 'Brainstormer',
        title: 'Idea Engine',
        description: 'Generate specific, actionable ideas and features for any objective.',
        icon: 'lightbulb',
        color: 'amber',
        placeholder: 'What are we brainstorming today? (e.g. "Features for a productivity app")....'
    },
    {
        id: 'RiskScout',
        title: 'Risk Scout',
        description: 'Identify potential roadblocks and get strategic mitigation plans.',
        icon: 'shield',
        color: 'rose',
        placeholder: 'Paste your project concept here for risk analysis...'
    }
];

export const Brainstorming = () => {
    const { showToast } = useToast();
    const [activeTool, setActiveTool] = useState<StudioTool>('Architect');
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    // Results
    const [blueprint, setBlueprint] = useState<ProjectBlueprint | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [risks, setRisks] = useState<ProjectRisk[]>([]);

    const [history, setHistory] = useState<Idea[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);

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

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await getUserIdeas();
                setHistory(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingHistory(false);
            }
        };
        fetchHistory();
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
                // Save ideas to history
                for (const idea of result) {
                    await saveIdea(idea);
                }
                const updated = await getUserIdeas();
                setHistory(updated);
            } else if (activeTool === 'RiskScout') {
                const result = await analyzeProjectRisks(prompt);
                setRisks(result);
            }

            showToast(`Studio: ${activeTool} analysis complete`, 'success');
            fetchUsage(); // Refresh usage after success
        } catch (e) {
            console.error(e);
            showToast(e instanceof Error ? e.message : 'Generation failed', 'error');
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
                await addTask(projectId, `Milestone: ${ms.title}`, undefined, undefined, 'High', {
                    description: ms.description,
                    category: ['Milestone']
                });
            }

            showToast(`Success! "${bp.title}" is now live.`, 'success');
            // Reset blueprint after conversion?
            setBlueprint(null);
            setPrompt('');
        } catch (e) {
            console.error(e);
            showToast('Failed to convert blueprint to project.', 'error');
        } finally {
            setIsConverting(false);
        }
    };

    const currentToolPlaceholder = TOOLS.find(t => t.id === activeTool)?.placeholder || "...";

    return (
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-10 animate-fade-up space-y-12">
            <AIStudioHero />

            {/* Tool Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {TOOLS.map((tool) => (
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

            {/* Prompt Area */}
            <div className="app-panel p-6 md:p-8 space-y-6 bg-white dark:bg-zinc-900 shadow-soft">
                <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500 text-white`}>
                        <span className="material-symbols-outlined text-[20px]">terminal</span>
                    </div>
                    <h3 className="text-xl font-display font-bold text-ink dark:text-white">Studio Input</h3>
                </div>

                {aiUsage && (
                    <div className="flex items-center justify-between p-3 px-4 bg-zinc-50 dark:bg-white/5 rounded-xl border border-line dark:border-white/5">
                        <div className="flex items-center gap-2 text-sm text-muted">
                            <span className="material-symbols-outlined text-[18px]">token</span>
                            <span>AI Credit usage this month</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-ink dark:text-white">
                                {aiUsage.tokensUsed.toLocaleString()} / {aiUsage.tokenLimit.toLocaleString()}
                            </span>
                            <div className="w-32 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mt-1 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${aiUsage.tokensUsed >= aiUsage.tokenLimit * 0.9 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                                    style={{ width: `${Math.min(100, (aiUsage.tokensUsed / aiUsage.tokenLimit) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                )}

                <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full p-6 text-lg"
                    placeholder={currentToolPlaceholder}
                    rows={6}
                />

                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="material-symbols-outlined text-[14px]">info</span>
                        <span>Specific prompts yield better results. Try focusing on your unique value prop.</span>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        className="w-full md:w-auto inline-flex items-center justify-center gap-3 px-10 py-4 btn-primary rounded-xl text-base font-bold shadow-lift disabled:opacity-50 transition-all active:scale-95"
                    >
                        <span className={`material-symbols-outlined text-[22px] ${isGenerating ? 'animate-spin' : ''}`}>
                            {isGenerating ? 'autorenew' : 'auto_awesome'}
                        </span>
                        <span>{isGenerating ? 'Synthesizing...' : `Run ${activeTool}`}</span>
                    </button>
                </div>
            </div>

            {/* Results Section */}
            {(blueprint || ideas.length > 0 || risks.length > 0) && (
                <div className="pt-12 border-t border-line dark:border-white/5 space-y-10">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-indigo-500">output</span>
                        <h3 className="text-2xl font-display font-bold">Studio Results</h3>
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
            )}

            {/* Recent Ideas / History (simplified for cleaner UI) */}
            <div className="pt-12 border-t border-line dark:border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-display font-bold flex items-center gap-3 text-ink dark:text-white">
                        <span className="material-symbols-outlined text-muted">history</span>
                        Brainstorming Archive
                    </h3>
                </div>

                {isLoadingHistory ? (
                    <div className="flex justify-center py-12">
                        <span className="material-symbols-outlined animate-spin text-ink/20">progress_activity</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12 bg-zinc-50 dark:bg-white/5 rounded-3xl border border-dashed">
                        <p className="text-muted">No recent ideas found. Start by running a studio tool!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 opacity-70">
                        {history.slice(0, 8).map((idea) => (
                            <div key={idea.id} className="p-4 rounded-xl border border-line dark:border-white/5 bg-white/50 dark:bg-zinc-800/50">
                                <h4 className="text-sm font-bold truncate mb-1">{idea.title}</h4>
                                <p className="text-xs text-muted line-clamp-2">{idea.description}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
