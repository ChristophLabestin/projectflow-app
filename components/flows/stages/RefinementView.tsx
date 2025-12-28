import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { Textarea } from '../../ui/Textarea';
import { generateSWOTAnalysisAI } from '../../../services/geminiService';
import { SWOTCard } from './SWOTCard';

interface RefinementViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const RefinementView: React.FC<RefinementViewProps> = ({ idea, onUpdate }) => {
    const [generating, setGenerating] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<{
        strengths: string[];
        weaknesses: string[];
        opportunities: string[];
        threats: string[];
    } | null>(null);

    // Default empty analysis if not present
    const analysis = idea.analysis || {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    };

    // Generic handler for SWOT updates
    const handleSwotUpdate = (category: keyof typeof analysis, newList: string[]) => {
        onUpdate({
            analysis: {
                ...analysis,
                [category]: newList
            }
        });
    };

    const handleGenerateSWOT = async () => {
        setGenerating(true);
        try {
            // "result" contains ONLY the new additive points from AI
            const result = await generateSWOTAnalysisAI(idea);

            // Merge with existing analysis (deduplicating just in case)
            const mergedAnalysis = {
                strengths: Array.from(new Set([...analysis.strengths, ...result.strengths])),
                weaknesses: Array.from(new Set([...analysis.weaknesses, ...result.weaknesses])),
                opportunities: Array.from(new Set([...analysis.opportunities, ...result.opportunities])),
                threats: Array.from(new Set([...analysis.threats, ...result.threats])),
            };

            onUpdate({ analysis: mergedAnalysis });
            setAiSuggestions(result); // Track ONLY the new items for highlighting
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    // Helper to render Impact/Effort pills
    const renderPillSelector = (
        label: string,
        value: string | undefined,
        options: string[],
        colors: Record<string, string>,
        field: 'impact' | 'effort'
    ) => (
        <div className="space-y-2">
            <span className="text-xs font-bold text-[var(--color-text-subtle)] uppercase tracking-wider">{label}</span>
            <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-lg">
                {options.map((option) => {
                    const isSelected = value === option;
                    return (
                        <button
                            key={option}
                            onClick={() => onUpdate({ [field]: option })}
                            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all duration-200 ${isSelected
                                ? `${colors[option]} shadow-sm transform scale-100`
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/50 dark:hover:bg-white/5'
                                }`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden">

            {/* Top Bar: Generate Action */}
            <div className="flex items-center justify-between shrink-0 px-1">
                <div>
                    <h2 className="text-lg font-bold text-[var(--color-text-main)]">Refinement Dashboard</h2>
                    <p className="text-xs text-[var(--color-text-muted)]">Analyze feasibility and strategic value.</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateSWOT}
                    loading={generating}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 border-none shadow-md !text-white"
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                >
                    Generate Analysis
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto pr-1">

                {/* Left Panel: Core Attributes (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-6 h-full">
                    {/* Description Editor */}
                    <div className="bg-[var(--color-surface-paper)] p-4 rounded-xl border border-[var(--color-surface-border)] shadow-sm flex flex-col gap-3 flex-1 min-h-[300px]">
                        <div className="flex items-center gap-2 text-[var(--color-text-main)] font-semibold border-b border-[var(--color-surface-border)] pb-2 shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">subject</span>
                            Execution Summary
                        </div>
                        <textarea
                            value={idea.description}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            className="flex-1 w-full bg-transparent border-none focus:ring-0 p-0 resize-none text-sm leading-relaxed text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)] focus:outline-none"
                            placeholder="Detail the execution plan..."
                        />
                    </div>

                    {/* Impact & Effort */}
                    <div className="bg-[var(--color-surface-paper)] p-4 rounded-xl border border-[var(--color-surface-border)] shadow-sm space-y-6 shrink-0">
                        {renderPillSelector(
                            "Impact Estimate",
                            idea.impact,
                            ['Low', 'Medium', 'High'],
                            {
                                'Low': 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
                                'Medium': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
                                'High': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200'
                            },
                            'impact'
                        )}

                        {renderPillSelector(
                            "Effort Estimate",
                            idea.effort,
                            ['Low', 'Medium', 'High'],
                            {
                                'Low': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
                                'Medium': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
                                'High': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                            },
                            'effort'
                        )}
                    </div>

                    {/* Footer Action - Advance */}
                    <div className="mt-auto pt-4 border-t border-[var(--color-surface-border)] shrink-0">
                        <Button
                            className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                            onClick={() => onUpdate({ stage: 'Concept' })}
                        >
                            <span className="font-bold pl-1">Advance to Concept</span>
                            <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>
                </div>

                {/* Right Panel: SWOT Matrix (8 cols) */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                        <SWOTCard
                            title="Strengths"
                            icon="check_circle"
                            items={analysis.strengths}
                            colorClass="emerald"
                            onAdd={(text) => handleSwotUpdate('strengths', [...analysis.strengths, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.strengths];
                                newItems[index] = text;
                                handleSwotUpdate('strengths', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.strengths];
                                newItems.splice(index, 1);
                                handleSwotUpdate('strengths', newItems);
                            }}
                            highlightedItems={aiSuggestions?.strengths}
                        />
                        <SWOTCard
                            title="Weaknesses"
                            icon="warning"
                            items={analysis.weaknesses}
                            colorClass="rose"
                            onAdd={(text) => handleSwotUpdate('weaknesses', [...analysis.weaknesses, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.weaknesses];
                                newItems[index] = text;
                                handleSwotUpdate('weaknesses', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.weaknesses];
                                newItems.splice(index, 1);
                                handleSwotUpdate('weaknesses', newItems);
                            }}
                            highlightedItems={aiSuggestions?.weaknesses}
                        />
                        <SWOTCard
                            title="Opportunities"
                            icon="trending_up"
                            items={analysis.opportunities}
                            colorClass="indigo"
                            onAdd={(text) => handleSwotUpdate('opportunities', [...analysis.opportunities, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.opportunities];
                                newItems[index] = text;
                                handleSwotUpdate('opportunities', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.opportunities];
                                newItems.splice(index, 1);
                                handleSwotUpdate('opportunities', newItems);
                            }}
                            highlightedItems={aiSuggestions?.opportunities}
                        />
                        <SWOTCard
                            title="Threats"
                            icon="security"
                            items={analysis.threats}
                            colorClass="amber"
                            onAdd={(text) => handleSwotUpdate('threats', [...analysis.threats, text])}
                            onEdit={(index, text) => {
                                const newItems = [...analysis.threats];
                                newItems[index] = text;
                                handleSwotUpdate('threats', newItems);
                            }}
                            onDelete={(index) => {
                                const newItems = [...analysis.threats];
                                newItems.splice(index, 1);
                                handleSwotUpdate('threats', newItems);
                            }}
                            highlightedItems={aiSuggestions?.threats}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
