import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateProductLaunchAI, generateRiskWinAnalysis } from '../../../services/geminiService';
import { AnalysisDashboard } from '../AnalysisDashboard';

interface ProductLaunchViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ChecklistCategory {
    id: string;
    category: string;
    items: { id: string, title: string, done: boolean }[];
    isCollapsed?: boolean;
}

export const ProductLaunchView: React.FC<ProductLaunchViewProps> = ({ idea, onUpdate }) => {
    const [generating, setGenerating] = useState(false);
    const [viewMode, setViewMode] = useState<'execution' | 'analysis'>('execution');
    const [analyzing, setAnalyzing] = useState(false);

    // Store launch data in the idea's launchPlan field as JSON
    const launchData = (() => {
        try {
            if (idea.launchPlan && idea.launchPlan.startsWith('{')) {
                return JSON.parse(idea.launchPlan);
            }
        } catch { }
        return {
            checklist: [] as ChecklistCategory[],
            channels: [] as string[],
            announcement: '' as string
        };
    })();

    const updateLaunchData = (updates: Partial<typeof launchData>) => {
        const newData = { ...launchData, ...updates };
        onUpdate({ launchPlan: JSON.stringify(newData) });
    };

    // Checklist Helpers
    const addChecklistCategory = () => {
        const newCat: ChecklistCategory = {
            id: Date.now().toString(),
            category: 'New Checklist',
            items: [],
            isCollapsed: false
        };
        updateLaunchData({ checklist: [...launchData.checklist, newCat] });
    };

    const updateChecklistCategory = (id: string, updates: Partial<ChecklistCategory>) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) => c.id === id ? { ...c, ...updates } : c);
        updateLaunchData({ checklist: newList });
    };

    const addChecklistItem = (catId: string) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) =>
            c.id === catId ? { ...c, items: [...c.items, { id: Date.now().toString(), title: '', done: false }] } : c
        );
        updateLaunchData({ checklist: newList });
    };

    const updateChecklistItem = (catId: string, itemId: string, updates: Partial<{ title: string, done: boolean }>) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) => {
            if (c.id !== catId) return c;
            const newItems = c.items.map(i => i.id === itemId ? { ...i, ...updates } : i);
            return { ...c, items: newItems };
        });
        updateLaunchData({ checklist: newList });
    };

    const removeChecklistItem = (catId: string, itemId: string) => {
        const newList = launchData.checklist.map((c: ChecklistCategory) => {
            if (c.id !== catId) return c;
            return { ...c, items: c.items.filter(i => i.id !== itemId) };
        });
        updateLaunchData({ checklist: newList });
    };

    const removeChecklistCategory = (id: string) => {
        updateLaunchData({ checklist: launchData.checklist.filter((c: ChecklistCategory) => c.id !== id) });
    };

    // Channel Helpers
    const addChannel = () => {
        updateLaunchData({ channels: [...launchData.channels, ''] });
    };

    const updateChannel = (index: number, value: string) => {
        const newChannels = [...launchData.channels];
        newChannels[index] = value;
        updateLaunchData({ channels: newChannels });
    };

    const removeChannel = (index: number) => {
        const newChannels = [...launchData.channels];
        newChannels.splice(index, 1);
        updateLaunchData({ channels: newChannels });
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const result = await generateProductLaunchAI(idea);
            const newChecklist = result.checklist.map((c: any, i: number) => ({
                id: `ai-list-${Date.now()}-${i}`,
                category: c.category,
                items: c.items.map((item: string, j: number) => ({ id: `ai-item-${Date.now()}-${i}-${j}`, title: item, done: false })),
                isCollapsed: false
            }));

            updateLaunchData({
                checklist: [...launchData.checklist, ...newChecklist],
                channels: [...launchData.channels, ...result.channels],
                announcement: launchData.announcement ? launchData.announcement : result.announcement
            });

        } catch (error) {
            console.error("Failed to generate launch plan:", error);
        } finally {
            setGenerating(false);
        }
    };

    const handleRunAnalysis = async () => {
        setAnalyzing(true);
        try {
            const result = await generateRiskWinAnalysis(idea);
            onUpdate({ riskWinAnalysis: result });
        } catch (e) {
            console.error(e);
        } finally {
            setAnalyzing(false);
        }
    };

    // Calculate Progress
    const totalChecks = launchData.checklist.reduce((acc, c) => acc + c.items.length, 0);
    const completedChecks = launchData.checklist.reduce((acc, c) => acc + c.items.filter(i => i.done).length, 0);
    const progress = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text-main)] flex items-center gap-3">
                            Launch Prep
                            {totalChecks > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${progress === 100 ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-[var(--color-surface-hover)] border-[var(--color-surface-border)] text-[var(--color-text-muted)]'}`}>
                                    {progress}% Ready
                                </span>
                            )}
                        </h2>
                        <p className="text-sm text-[var(--color-text-muted)]">Finalize release checklist and marketing assets.</p>
                    </div>

                    {/* View Switcher */}
                    <div className="flex items-center p-1.5 bg-[var(--color-surface-paper)] rounded-xl border border-[var(--color-surface-border)] shadow-sm">
                        <button
                            onClick={() => setViewMode('execution')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'execution' ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">checklist_rtl</span>
                            Checklist & Marketing
                        </button>
                        <button
                            onClick={() => setViewMode('analysis')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'analysis' ? 'bg-[var(--color-surface-active)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            <span className="material-symbols-outlined text-[18px]">analytics</span>
                            Risk Analysis
                        </button>
                    </div>
                </div>

                {viewMode === 'execution' && (
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={handleGenerate}
                        loading={generating}
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 border-none shadow-md !text-white"
                        icon={<span className="material-symbols-outlined">auto_awesome</span>}
                    >
                        Draft Launch Plan
                    </Button>
                )}
            </div>

            {viewMode === 'execution' ? (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto pr-2 pb-4">

                    {/* Left Panel: Checklist (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col gap-4">
                        <div className="bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-sm flex flex-col overflow-hidden h-full">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <div className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[20px] text-emerald-500">checklist</span>
                                    Pre-Flight Checks
                                </div>
                                <button onClick={addChecklistCategory} className="text-xs text-[var(--color-primary)] hover:underline">+ Add Category</button>
                            </div>

                            <div className="p-4 flex-1 overflow-y-auto space-y-4">
                                {launchData.checklist.length === 0 && (
                                    <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
                                        No checklist items. Draft with AI to get started.
                                    </div>
                                )}
                                {launchData.checklist.map((cat, i: number) => {
                                    const catTotal = cat.items.length;
                                    const catDone = cat.items.filter(i => i.done).length;

                                    return (
                                        <div key={cat.id} className="border border-[var(--color-surface-border)] rounded-xl overflow-hidden bg-[var(--color-surface-bg)] shadow-sm group/cat transition-all">
                                            <div
                                                className="bg-white dark:bg-slate-900/40 p-3 border-b border-[var(--color-surface-border)] flex flex-col gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
                                                    updateChecklistCategory(cat.id, { isCollapsed: !cat.isCollapsed });
                                                }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-1">
                                                        <input
                                                            value={cat.category}
                                                            onChange={(e) => updateChecklistCategory(cat.id, { category: e.target.value })}
                                                            className="font-bold bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-main)] text-sm w-full"
                                                            placeholder="Category Name"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-[var(--color-text-muted)] tabular-nums">{catDone}/{catTotal}</span>
                                                        <button onClick={() => removeChecklistCategory(cat.id)} className="text-[var(--color-text-muted)] hover:text-rose-500 opacity-0 group-hover/cat:opacity-100 transition-opacity">
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>
                                                        <span className={`material-symbols-outlined text-[20px] text-[var(--color-text-muted)] transition-transform duration-300 ${cat.isCollapsed ? '-rotate-90' : ''}`}>expand_more</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`transition-all duration-300 overflow-hidden ${cat.isCollapsed ? 'max-h-0' : 'max-h-[500px]'}`}>
                                                <div className="p-2 space-y-1">
                                                    {cat.items.map(item => (
                                                        <div key={item.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-[var(--color-surface-paper)] group/item transition-colors">
                                                            <input
                                                                type="checkbox"
                                                                checked={item.done}
                                                                onChange={() => updateChecklistItem(cat.id, item.id, { done: !item.done })}
                                                                className="rounded border-[var(--color-surface-border)] text-emerald-500 focus:ring-emerald-500/20"
                                                            />
                                                            <input
                                                                value={item.title}
                                                                onChange={(e) => updateChecklistItem(cat.id, item.id, { title: e.target.value })}
                                                                className={`flex-1 bg-transparent border-none p-0 text-sm focus:ring-0 ${item.done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-main)]'}`}
                                                                placeholder="Checklist item..."
                                                            />
                                                            <button onClick={() => removeChecklistItem(cat.id, item.id)} className="text-[var(--color-text-muted)] hover:text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button
                                                        onClick={() => addChecklistItem(cat.id)}
                                                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] flex items-center gap-1 pl-2 pt-1 transition-colors w-full text-left"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">add</span> Add Item
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Marketing Prep (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        {/* Announcement Copy */}
                        <div className="bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-sm flex flex-col">
                            <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center gap-2 font-bold text-[var(--color-text-main)]">
                                <span className="material-symbols-outlined text-[20px] text-pink-500">campaign</span>
                                Announcement Draft
                            </div>
                            <div className="p-4">
                                <textarea
                                    value={launchData.announcement}
                                    onChange={(e) => updateLaunchData({ announcement: e.target.value })}
                                    className="w-full h-32 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl p-3 text-sm text-[var(--color-text-main)] focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                                    placeholder="Write your hook/announcement here..."
                                />
                            </div>
                        </div>

                        {/* Channels */}
                        <div className="bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-sm flex flex-col flex-1">
                            <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
                                <div className="flex items-center gap-2 font-bold text-[var(--color-text-main)]">
                                    <span className="material-symbols-outlined text-[20px] text-cyan-500">hub</span>
                                    Marketing Channels
                                </div>
                                <button onClick={addChannel} className="text-xs text-[var(--color-primary)] hover:underline">+ Add Channel</button>
                            </div>
                            <div className="p-4">
                                <div className="flex flex-wrap gap-2">
                                    {launchData.channels.map((channel, i) => (
                                        <div key={i} className="group relative flex items-center">
                                            <input
                                                value={channel}
                                                onChange={(e) => updateChannel(i, e.target.value)}
                                                className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-full pl-3 pr-8 py-1.5 text-sm font-medium text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)] min-w-[100px] max-w-[160px] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                                placeholder="Channel..."
                                            />
                                            <button
                                                onClick={() => removeChannel(i)}
                                                className="absolute right-2 text-[var(--color-text-muted)] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={addChannel}
                                        className="bg-transparent border border-dashed border-[var(--color-text-muted)] rounded-full px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-colors"
                                    >
                                        + Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Complete Button */}
                        <Button
                            className="w-full h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg rounded-xl border-none"
                            onClick={() => { /* Trigger Celebration or Archive */ }}
                        >
                            <span className="material-symbols-outlined mr-2">rocket_launch</span>
                            Initialize Launch
                        </Button>

                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-sm">
                    <AnalysisDashboard
                        analysis={idea.riskWinAnalysis}
                        loading={analyzing}
                        onRunAnalysis={handleRunAnalysis}
                    />
                </div>
            )}
        </div>
    );
};
