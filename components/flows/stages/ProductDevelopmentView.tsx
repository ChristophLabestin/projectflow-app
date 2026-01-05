import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateProductDevelopmentAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface ProductDevelopmentViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface TechStackCategory {
    id: string;
    category: string;
    items: string[];
}

interface Phase {
    id: string;
    name: string;
    weeks: string;
    tasks: { id: string, title: string, done: boolean }[];
    isCollapsed?: boolean;
}

export const ProductDevelopmentView: React.FC<ProductDevelopmentViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    // Store development data in the idea's devPlan field as JSON
    const devData = (() => {
        try {
            if (idea.devPlan && idea.devPlan.startsWith('{')) {
                return JSON.parse(idea.devPlan);
            }
        } catch { }
        return {
            techStack: [] as TechStackCategory[],
            phases: [] as Phase[]
        };
    })();

    const updateDevData = (updates: Partial<typeof devData>) => {
        const newData = { ...devData, ...updates };
        onUpdate({ devPlan: JSON.stringify(newData) });
    };

    // Tech Stack Helpers
    const addStackCategory = () => {
        const newCat: TechStackCategory = {
            id: Date.now().toString(),
            category: t('flowStages.productDevelopment.defaults.category'),
            items: []
        };
        updateDevData({ techStack: [...devData.techStack, newCat] });
    };

    const updateStackCategory = (id: string, updates: Partial<TechStackCategory>) => {
        const newStack = devData.techStack.map((s: TechStackCategory) => s.id === id ? { ...s, ...updates } : s);
        updateDevData({ techStack: newStack });
    };

    const addItemToStack = (id: string) => {
        const newStack = devData.techStack.map((s: TechStackCategory) =>
            s.id === id ? { ...s, items: [...s.items, ''] } : s
        );
        updateDevData({ techStack: newStack });
    };

    const updateStackItem = (id: string, index: number, value: string) => {
        const newStack = devData.techStack.map((s: TechStackCategory) => {
            if (s.id !== id) return s;
            const newItems = [...s.items];
            newItems[index] = value;
            return { ...s, items: newItems };
        });
        updateDevData({ techStack: newStack });
    };

    const removeStackItem = (id: string, index: number) => {
        const newStack = devData.techStack.map((s: TechStackCategory) => {
            if (s.id !== id) return s;
            const newItems = [...s.items];
            newItems.splice(index, 1);
            return { ...s, items: newItems };
        });
        updateDevData({ techStack: newStack });
    };

    const removeStackCategory = (id: string) => {
        updateDevData({ techStack: devData.techStack.filter((s: TechStackCategory) => s.id !== id) });
    };

    // Phase Helpers
    const addPhase = () => {
        const newPhase: Phase = {
            id: Date.now().toString(),
            name: t('flowStages.productDevelopment.defaults.phase'),
            weeks: t('flowStages.productDevelopment.defaults.weeks'),
            tasks: [],
            isCollapsed: false
        };
        updateDevData({ phases: [...devData.phases, newPhase] });
    };

    const updatePhase = (id: string, updates: Partial<Phase>) => {
        const newPhases = devData.phases.map((p: Phase) => p.id === id ? { ...p, ...updates } : p);
        updateDevData({ phases: newPhases });
    };

    const addTaskToPhase = (phaseId: string) => {
        const newPhases = devData.phases.map((p: Phase) =>
            p.id === phaseId ? { ...p, tasks: [...p.tasks, { id: Date.now().toString(), title: '', done: false }] } : p
        );
        updateDevData({ phases: newPhases });
    };

    const updateTask = (phaseId: string, taskId: string, updates: Partial<{ title: string, done: boolean }>) => {
        const newPhases = devData.phases.map((p: Phase) => {
            if (p.id !== phaseId) return p;
            const newTasks = p.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
            return { ...p, tasks: newTasks };
        });
        updateDevData({ phases: newPhases });
    };

    const removeTask = (phaseId: string, taskId: string) => {
        const newPhases = devData.phases.map((p: Phase) => {
            if (p.id !== phaseId) return p;
            return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
        });
        updateDevData({ phases: newPhases });
    };

    const removePhase = (id: string) => {
        updateDevData({ phases: devData.phases.filter((p: Phase) => p.id !== id) });
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const result = await generateProductDevelopmentAI(idea);
            const newStack = result.techStack.map((s: any, i: number) => ({
                id: `ai-stack-${Date.now()}-${i}`,
                category: s.category,
                items: s.items
            }));
            const newPhases = result.phases.map((p: any, i: number) => ({
                id: `ai-phase-${Date.now()}-${i}`,
                name: p.name,
                weeks: p.weeks,
                tasks: p.tasks.map((t: string, j: number) => ({ id: `ai-task-${Date.now()}-${i}-${j}`, title: t, done: false })),
                isCollapsed: false
            }));

            // Merge logic: append if not present
            updateDevData({
                techStack: [...devData.techStack, ...newStack],
                phases: [...devData.phases, ...newPhases]
            });

        } catch (error) {
            console.error("Failed to generate dev plan:", error);
        } finally {
            setGenerating(false);
        }
    };

    // Calcs
    const totalTasks = devData.phases.reduce((acc, p) => acc + p.tasks.length, 0);
    const completedTasks = devData.phases.reduce((acc, p) => acc + p.tasks.filter(t => t.done).length, 0);
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-main flex items-center gap-3">
                        {t('flowStages.productDevelopment.title')}
                        {totalTasks > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${progress === 100 ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-surface-hover border-surface text-muted'}`}>
                                {t('flowStages.productDevelopment.velocity').replace('{value}', String(progress))}
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-muted">{t('flowStages.productDevelopment.subtitle')}</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerate}
                    loading={generating}
                    className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 border-none shadow-md !text-white"
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                >
                    {t('flowStages.productDevelopment.actions.generate')}
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto pr-2 pb-4">

                {/* Left Panel: Tech Stack (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="bg-surface-paper rounded-2xl border border-surface shadow-sm flex flex-col overflow-hidden h-full">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div className="font-bold text-main flex items-center gap-2">
                                <span className="material-symbols-outlined text-[20px] text-sky-500">dns</span>
                                {t('flowStages.productDevelopment.stack.title')}
                            </div>
                            <button onClick={addStackCategory} className="text-xs text-primary hover:underline">{t('flowStages.productDevelopment.stack.addCategory')}</button>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto space-y-6">
                            {devData.techStack.length === 0 && (
                                <div className="text-center py-8 text-muted text-sm">
                                    {t('flowStages.productDevelopment.stack.empty')}
                                </div>
                            )}
                            {devData.techStack.map((stack, i: number) => (
                                <div key={stack.id} className="group/cat">
                                    <div className="flex items-center justify-between mb-2">
                                        <input
                                            value={stack.category}
                                            onChange={(e) => updateStackCategory(stack.id, { category: e.target.value })}
                                            className="font-bold text-sm bg-transparent border-none p-0 focus:ring-0 text-main placeholder-[var(--color-text-subtle)]"
                                            placeholder={t('flowStages.productDevelopment.stack.categoryPlaceholder')}
                                        />
                                        <button onClick={() => removeStackCategory(stack.id)} className="text-muted hover:text-rose-500 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pl-2 border-l-2 border-surface ml-1 min-h-[30px]">
                                        {stack.items.map((item, j) => (
                                            <div key={j} className="group/item relative flex items-center">
                                                <input
                                                    value={item}
                                                    onChange={(e) => updateStackItem(stack.id, j, e.target.value)}
                                                    className="bg-surface-hover rounded-md pl-2 pr-6 py-1 text-xs font-medium text-main placeholder-[var(--color-text-subtle)] min-w-[60px] max-w-[120px] focus:ring-1 ring-primary border-none"
                                                    placeholder={t('flowStages.productDevelopment.stack.itemPlaceholder')}
                                                />
                                                <button
                                                    onClick={() => removeStackItem(stack.id, j)}
                                                    className="absolute right-1 text-muted hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => addItemToStack(stack.id)}
                                            className="bg-transparent border border-dashed border-muted rounded-md px-2 py-1 text-xs text-muted hover:text-primary hover:border-primary transition-colors"
                                        >
                                            {t('flowStages.productDevelopment.actions.add')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel: Implementation Roadmap (8 cols) */}
                <div className="lg:col-span-8 flex flex-col h-full bg-surface-paper rounded-2xl border border-surface shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                        <div className="font-bold text-main flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px] text-indigo-500">calendar_view_week</span>
                            {t('flowStages.productDevelopment.roadmap.title')}
                        </div>
                        <Button onClick={addPhase} size="sm" className="rounded-lg text-xs hover:bg-primary/90 shadow-sm gap-1">
                            <span className="material-symbols-outlined text-[14px]">add</span> {t('flowStages.productDevelopment.roadmap.addPhase')}
                        </Button>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        {devData.phases.length === 0 && (
                            <div className="text-center py-12 text-muted">
                                <span className="material-symbols-outlined text-[40px] opacity-20 mb-2">splitscreen</span>
                                <p className="text-sm">{t('flowStages.productDevelopment.roadmap.empty')}</p>
                            </div>
                        )}
                        {devData.phases.map((phase, i) => {
                            const pTotal = phase.tasks.length;
                            const pDone = phase.tasks.filter(t => t.done).length;
                            const pProgress = pTotal > 0 ? (pDone / pTotal) * 100 : 0;

                            return (
                                <div key={phase.id} className="border border-surface rounded-xl overflow-hidden bg-surface shadow-sm group/phase transition-all">
                                    {/* Phase Header */}
                                    <div
                                        className="bg-white dark:bg-slate-900/40 p-3 border-b border-surface flex flex-col gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        onClick={(e) => {
                                            if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
                                            updatePhase(phase.id, { isCollapsed: !phase.isCollapsed });
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={`flex items-center justify-center size-6 rounded-full text-xs font-bold transition-colors ${pProgress === 100
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-primary/10 text-primary'
                                                    }`}>
                                                    {pProgress === 100 ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                                                </div>
                                                <input
                                                    value={phase.name}
                                                    onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                                                    className="font-bold bg-transparent border-none p-0 focus:ring-0 text-main placeholder-[var(--color-text-subtle)] w-full max-w-xs"
                                                    placeholder={t('flowStages.productDevelopment.roadmap.phasePlaceholder')}
                                                />
                                                <span className="text-xs text-muted bg-surface-hover px-2 py-0.5 rounded">
                                                    {phase.weeks}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-muted tabular-nums">{pDone}/{pTotal}</span>
                                                <span className={`material-symbols-outlined text-[20px] text-muted transition-transform duration-300 ${phase.isCollapsed ? '-rotate-90' : ''}`}>expand_more</span>
                                            </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="h-1 w-full bg-surface-border rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all duration-500 ${pProgress === 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                                                style={{ width: `${pProgress}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Task List (Collapsible) */}
                                    <div className={`transition-all duration-300 overflow-hidden ${phase.isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
                                        <div className="p-3 space-y-1">
                                            {phase.tasks.map(task => (
                                                <div key={task.id} className="flex items-center gap-3 p-2 rounded hover:bg-surface-paper group/task transition-colors">
                                                    <div
                                                        onClick={() => updateTask(phase.id, task.id, { done: !task.done })}
                                                        className={`size-4 rounded border cursor-pointer flex items-center justify-center transition-all ${task.done
                                                            ? 'bg-emerald-500 border-emerald-500 text-white'
                                                            : 'border-muted hover:border-primary'
                                                            }`}
                                                    >
                                                        {task.done && <span className="material-symbols-outlined text-[12px]">check</span>}
                                                    </div>
                                                    <input
                                                        value={task.title}
                                                        onChange={(e) => updateTask(phase.id, task.id, { title: e.target.value })}
                                                        className={`flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 ${task.done ? 'text-muted line-through' : 'text-main'}`}
                                                        placeholder={t('flowStages.productDevelopment.roadmap.taskPlaceholder')}
                                                    />
                                                    <button onClick={() => removeTask(phase.id, task.id)} className="text-muted hover:text-rose-500 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="flex justify-start pt-2">
                                                <button
                                                    onClick={() => addTaskToPhase(phase.id)}
                                                    className="text-xs text-muted hover:text-primary flex items-center gap-1 pl-2 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">add</span> {t('flowStages.productDevelopment.roadmap.addTask')}
                                                </button>
                                                <div className="flex-1"></div>
                                                <button onClick={() => removePhase(phase.id)} className="text-xs text-rose-500/50 hover:text-rose-500 px-2 transition-colors">
                                                    {t('flowStages.productDevelopment.roadmap.deletePhase')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Advance Action */}
                    <div className="p-4 border-t border-surface shrink-0">
                        <Button
                            className="w-full h-12 text-base justify-between group hover:opacity-90 shadow-lg hover:shadow-xl transition-all rounded-xl border-none"
                            onClick={() => onUpdate({ stage: 'Concept' })}
                        >
                            <span className="font-bold pl-1">{t('flowStages.productDevelopment.actions.advance')}</span>
                            <div className="size-8 rounded-lg bg-white/20 dark:bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    );
};
