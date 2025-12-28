import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';

interface MarketingAnalysisViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface AnalysisData {
    impressions: string;
    clicks: string;
    conversions: string;
    costPerAcquisition: string;
    roi: string;
    keyTakeaways: string;
}

export const MarketingAnalysisView: React.FC<MarketingAnalysisViewProps> = ({ idea, onUpdate }) => {
    const analysis: AnalysisData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    impressions: parsed.impressions || '',
                    clicks: parsed.clicks || '',
                    conversions: parsed.conversions || '',
                    costPerAcquisition: parsed.costPerAcquisition || '',
                    roi: parsed.roi || '',
                    keyTakeaways: parsed.keyTakeaways || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            impressions: '',
            clicks: '',
            conversions: '',
            costPerAcquisition: '',
            roi: '',
            keyTakeaways: ''
        };
    })();

    const updateAnalysis = (updates: Partial<AnalysisData>) => {
        const newData = { ...analysis, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const [isEditing, setIsEditing] = useState(false);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            <div className="col-span-1 lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Performance Report</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">Campaign Results</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(!isEditing)}>
                        {isEditing ? 'Save Metrics' : 'Edit Metrics'}
                    </Button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <MetricCard label="Impressions" value={analysis.impressions} onChange={v => updateAnalysis({ impressions: v })} isEditing={isEditing} icon="visibility" color="blue" />
                    <MetricCard label="Clicks (CTR)" value={analysis.clicks} onChange={v => updateAnalysis({ clicks: v })} isEditing={isEditing} icon="mouse" color="indigo" />
                    <MetricCard label="Conversions" value={analysis.conversions} onChange={v => updateAnalysis({ conversions: v })} isEditing={isEditing} icon="shopping_cart" color="emerald" />
                    <MetricCard label="CPA" value={analysis.costPerAcquisition} onChange={v => updateAnalysis({ costPerAcquisition: v })} isEditing={isEditing} icon="attach_money" color="amber" />
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-[var(--color-text-main)] mb-2">Key Takeaways & Learnings</h3>
                    <textarea
                        value={analysis.keyTakeaways}
                        onChange={(e) => updateAnalysis({ keyTakeaways: e.target.value })}
                        className="w-full h-40 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-4 py-3 focus:ring-1 focus:ring-green-500 outline-none text-sm leading-relaxed resize-none"
                        placeholder="What worked? What didn't? Recommendations for next time..."
                    />
                </div>
            </div>

            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <h3 className="font-bold text-[var(--color-text-main)] mb-4">Final Verdict</h3>

                <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-6 text-center mb-6">
                    <div className="text-xs font-bold uppercase text-emerald-600 mb-2">ROI</div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={analysis.roi}
                            onChange={(e) => updateAnalysis({ roi: e.target.value })}
                            className="bg-white text-emerald-700 text-3xl font-black text-center w-full rounded"
                            placeholder="0%"
                        />
                    ) : (
                        <div className="text-4xl font-black text-emerald-700 dark:text-emerald-400">{analysis.roi || '-'}%</div>
                    )}
                </div>

                <Button className="w-full justify-center bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:opacity-90 mt-auto">
                    Archive Campaign
                </Button>
            </div>
        </div>
    );
};

const MetricCard = ({ label, value, onChange, isEditing, icon, color }: any) => (
    <div className={`p-4 rounded-xl border flex flex-col gap-2 ${color === 'blue' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30' :
            color === 'indigo' ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/10 dark:border-indigo-900/30' :
                color === 'emerald' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30' :
                    'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30'
        }`}>
        <div className="flex items-center gap-1.5 opacity-70">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            <span className="text-[10px] font-bold uppercase">{label}</span>
        </div>
        {isEditing ? (
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="bg-white rounded px-2 py-0.5 w-full text-lg font-bold"
                placeholder="-"
            />
        ) : (
            <span className="text-xl font-bold truncate">{value || '-'}</span>
        )}
    </div>
);
