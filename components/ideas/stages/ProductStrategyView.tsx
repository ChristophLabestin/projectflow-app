import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { SWOTCard } from './SWOTCard';
import { generateProductStrategyAI, generateSWOTAnalysisAI } from '../../../services/geminiService';

interface ProductStrategyViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const ProductStrategyView: React.FC<ProductStrategyViewProps> = ({ idea, onUpdate }) => {
    const [generating, setGenerating] = useState(false);

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

    const handleGenerateStrategy = async () => {
        setGenerating(true);
        try {
            // Run both in parallel
            const [strategyData, swotData] = await Promise.all([
                generateProductStrategyAI(idea),
                generateSWOTAnalysisAI(idea)
            ]);

            onUpdate({
                description: strategyData.vision, // Use description field for Vision for now
                riskWinAnalysis: {
                    ...(idea.riskWinAnalysis || {
                        successProbability: 0,
                        risks: [], wins: [], recommendation: ''
                    }),
                    marketFitScore: strategyData.marketFit,
                    technicalFeasibilityScore: strategyData.feasibility
                },
                analysis: {
                    strengths: Array.from(new Set([...analysis.strengths, ...swotData.strengths])),
                    weaknesses: Array.from(new Set([...analysis.weaknesses, ...swotData.weaknesses])),
                    opportunities: Array.from(new Set([...analysis.opportunities, ...swotData.opportunities])),
                    threats: Array.from(new Set([...analysis.threats, ...swotData.threats])),
                }
            });
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="h-full flex flex-col gap-6 overflow-hidden animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-[var(--color-text-main)]">Product Strategy</h2>
                    <p className="text-sm text-[var(--color-text-muted)]">Define the core vision and strategic positioning.</p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateStrategy}
                    loading={generating}
                    className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 border-none shadow-md !text-white"
                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                >
                    Draft Strategy with AI
                </Button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-y-auto pr-2 pb-4">

                {/* Left Panel: Vision & Metrics (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-6">

                    {/* Vision Statement */}
                    <div className="bg-[var(--color-surface-paper)] p-5 rounded-2xl border border-[var(--color-surface-border)] shadow-sm flex flex-col gap-3 min-h-[200px]">
                        <div className="flex items-center gap-2 text-[var(--color-text-main)] font-bold border-b border-[var(--color-surface-border)] pb-3">
                            <span className="material-symbols-outlined text-[20px] text-rose-500">visibility</span>
                            Product Vision
                        </div>
                        <textarea
                            value={idea.description}
                            onChange={(e) => onUpdate({ description: e.target.value })}
                            className="flex-1 w-full bg-transparent border-none focus:ring-0 p-0 resize-none text-sm leading-relaxed text-[var(--color-text-main)] placeholder-[var(--color-text-subtle)] focus:outline-none"
                            placeholder="Describe the long-term vision for this product. What problem does it solve? Who is it for?"
                        />
                    </div>

                    {/* Target Audience (Stored in concept for now or custom field if available, reusing concept as a scratchpad potentially, but let's stick to description for vision. 
                        Let's use a new section for 'Target Audience' but store it in 'keywords' for simplicity as we don't have a dedicated field yet? 
                        Actually, let's keep it simple: Vision (Description) + SWOT + Market Fit (RiskWinAnalysis).
                    */}

                    {/* Strategic value / Market Fit */}
                    <div className="bg-[var(--color-surface-paper)] p-5 rounded-2xl border border-[var(--color-surface-border)] shadow-sm space-y-6">
                        <div className="flex items-center gap-2 text-[var(--color-text-main)] font-bold border-b border-[var(--color-surface-border)] pb-3">
                            <span className="material-symbols-outlined text-[20px] text-amber-500">ads_click</span>
                            Market Fit Estimation
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-2 text-[var(--color-text-subtle)]">
                                    <span>Market Demand</span>
                                    <span>{idea.riskWinAnalysis?.marketFitScore || 0}/10</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="10"
                                    value={idea.riskWinAnalysis?.marketFitScore || 0}
                                    onChange={(e) => onUpdate({
                                        riskWinAnalysis: {
                                            ...(idea.riskWinAnalysis || {
                                                successProbability: 0,
                                                technicalFeasibilityScore: 0,
                                                risks: [], wins: [], recommendation: ''
                                            }),
                                            marketFitScore: parseInt(e.target.value)
                                        }
                                    })}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-rose-500"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-2 text-[var(--color-text-subtle)]">
                                    <span>Technical Feasibility</span>
                                    <span>{idea.riskWinAnalysis?.technicalFeasibilityScore || 0}/10</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="10"
                                    value={idea.riskWinAnalysis?.technicalFeasibilityScore || 0}
                                    onChange={(e) => onUpdate({
                                        riskWinAnalysis: {
                                            ...(idea.riskWinAnalysis || {
                                                successProbability: 0,
                                                marketFitScore: 0,
                                                risks: [], wins: [], recommendation: ''
                                            }),
                                            technicalFeasibilityScore: parseInt(e.target.value)
                                        }
                                    })}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Advance Action */}
                    <div className="mt-auto">
                        <Button
                            className="w-full h-12 text-base justify-between group bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 shadow-lg hover:shadow-xl transition-all rounded-xl border-none"
                            onClick={() => onUpdate({ stage: 'Discovery' })}
                        >
                            <span className="font-bold pl-1">Proceed to Discovery</span>
                            <div className="size-8 rounded-lg bg-white/20 dark:bg-black/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>

                </div>

                {/* Right Panel: SWOT (7 cols) */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                    {/* SWOT Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
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
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
