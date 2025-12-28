import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateProductDiscoveryAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface ProductDiscoveryViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface Persona {
    name: string;
    role: string;
    painPoints: string[];
    goals: string[];
}

interface Competitor {
    name: string;
    strengths: string;
    weaknesses: string;
}

export const ProductDiscoveryView: React.FC<ProductDiscoveryViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState<number | null>(null);

    // Store discovery data in the idea's concept field as JSON
    const discoveryData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                return JSON.parse(idea.concept);
            }
        } catch { }
        return {
            personas: [] as Persona[],
            competitors: [] as Competitor[],
            userResearchNotes: '',
            marketSize: '',
            targetSegment: ''
        };
    })();

    const updateDiscovery = (updates: Partial<typeof discoveryData>) => {
        const newData = { ...discoveryData, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleGenerateDiscovery = async () => {
        setGenerating(true);
        try {
            const result = await generateProductDiscoveryAI(idea);
            updateDiscovery({
                personas: [...discoveryData.personas, ...result.personas],
                competitors: [...discoveryData.competitors, ...result.competitors],
                marketSize: result.marketSize || discoveryData.marketSize,
                targetSegment: result.targetSegment || discoveryData.targetSegment
            });
        } catch (error) {
            console.error(error);
        } finally {
            setGenerating(false);
        }
    };

    const addPersona = () => {
        const newPersona = { name: '', role: '', painPoints: [], goals: [] };
        updateDiscovery({ personas: [...discoveryData.personas, newPersona] });
        setSelectedPersona(discoveryData.personas.length);
    };

    const updatePersona = (index: number, updates: Partial<Persona>) => {
        const newPersonas = [...discoveryData.personas];
        newPersonas[index] = { ...newPersonas[index], ...updates };
        updateDiscovery({ personas: newPersonas });
    };

    const removePersona = (index: number) => {
        const newPersonas = [...discoveryData.personas];
        newPersonas.splice(index, 1);
        updateDiscovery({ personas: newPersonas });
        setSelectedPersona(null);
    };

    const addCompetitor = () => {
        updateDiscovery({ competitors: [...discoveryData.competitors, { name: '', strengths: '', weaknesses: '' }] });
    };

    const updateCompetitor = (index: number, updates: Partial<Competitor>) => {
        const newCompetitors = [...discoveryData.competitors];
        newCompetitors[index] = { ...newCompetitors[index], ...updates };
        updateDiscovery({ competitors: newCompetitors });
    };

    const removeCompetitor = (index: number) => {
        const newCompetitors = [...discoveryData.competitors];
        newCompetitors.splice(index, 1);
        updateDiscovery({ competitors: newCompetitors });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

            {/* Left Column: Market & Research Control */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative overflow-hidden">
                {/* Background Icon */}
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <span className="material-symbols-outlined text-[100px] text-[var(--color-surface-border)] rotate-12 -mr-6 -mt-6">search</span>
                </div>

                <div className="flex flex-col h-full relative z-10">
                    {/* Header */}
                    <div className="mb-6">
                        <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">{t('flowStages.productDiscovery.title')}</h2>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('flowStages.productDiscovery.subtitle')}</p>
                        <div className="h-1 w-10 bg-[var(--color-primary)] rounded-full mt-3" />
                    </div>

                    {/* Market Info */}
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">{t('flowStages.productDiscovery.marketSize.label')}</label>
                            <input
                                type="text"
                                value={discoveryData.marketSize}
                                onChange={(e) => updateDiscovery({ marketSize: e.target.value })}
                                placeholder={t('flowStages.productDiscovery.marketSize.placeholder')}
                                className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 block">{t('flowStages.productDiscovery.target.label')}</label>
                            <input
                                type="text"
                                value={discoveryData.targetSegment}
                                onChange={(e) => updateDiscovery({ targetSegment: e.target.value })}
                                placeholder={t('flowStages.productDiscovery.target.placeholder')}
                                className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                            />
                        </div>
                    </div>

                    {/* Research Notes */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]">edit_note</span>
                            {t('flowStages.productDiscovery.notes.label')}
                        </label>
                        <textarea
                            value={discoveryData.userResearchNotes}
                            onChange={(e) => updateDiscovery({ userResearchNotes: e.target.value })}
                            className="flex-1 w-full bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm resize-none"
                            placeholder={t('flowStages.productDiscovery.notes.placeholder')}
                        />
                    </div>

                    {/* AI Button */}
                    <div className="mt-4">
                        <Button
                            onClick={handleGenerateDiscovery}
                            loading={generating}
                            variant="secondary"
                            className="w-full justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                        >
                            <span className="material-symbols-outlined">auto_awesome</span>
                            <span>{t('flowStages.productDiscovery.actions.generate')}</span>
                        </Button>
                    </div>

                    {/* Advance Button */}
                    <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)]">
                        <Button
                            className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                            onClick={() => onUpdate({ stage: 'Definition' })}
                        >
                            <span className="font-bold pl-1">{t('flowStages.productDiscovery.actions.advance')}</span>
                            <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Middle Column: User Personas */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {/* Add New Persona Card */}
                    <button
                        onClick={addPersona}
                        className="w-full p-4 rounded-xl border-2 border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all flex items-center gap-3 group"
                    >
                        <div className="size-10 rounded-full bg-[var(--color-surface-hover)] group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] text-xl">add</span>
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]">{t('flowStages.productDiscovery.personas.add')}</p>
                            <p className="text-xs text-[var(--color-text-subtle)]">{t('flowStages.productDiscovery.personas.addHint')}</p>
                        </div>
                    </button>

                    {discoveryData.personas.length === 0 ? (
                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                            <p className="text-xs">{t('flowStages.productDiscovery.personas.empty')}</p>
                        </div>
                    ) : (
                        discoveryData.personas.map((persona: Persona, index: number) => (
                            <div
                                key={index}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedPersona === index
                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                    : 'border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]'
                                    }`}
                                onClick={() => setSelectedPersona(selectedPersona === index ? null : index)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center text-lg">
                                            👤
                                        </div>
                                        <div>
                                            <input
                                                type="text"
                                                value={persona.name}
                                                onChange={(e) => updatePersona(index, { name: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder={t('flowStages.productDiscovery.personas.name')}
                                                className="font-semibold text-sm bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-main)] placeholder:text-[var(--color-text-subtle)] w-full"
                                            />
                                            <input
                                                type="text"
                                                value={persona.role}
                                                onChange={(e) => updatePersona(index, { role: e.target.value })}
                                                onClick={(e) => e.stopPropagation()}
                                                placeholder={t('flowStages.productDiscovery.personas.role')}
                                                className="text-xs bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-muted)] placeholder:text-[var(--color-text-subtle)] w-full"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removePersona(index); }}
                                        className="text-[var(--color-text-muted)] hover:text-rose-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>

                                {selectedPersona === index && (
                                    <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] space-y-3" onClick={(e) => e.stopPropagation()}>
                                        <div>
                                            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1 block">{t('flowStages.productDiscovery.personas.painPoints')}</label>
                                            <textarea
                                                value={persona.painPoints.join('\n')}
                                                onChange={(e) => updatePersona(index, { painPoints: e.target.value.split('\n').filter(Boolean) })}
                                                placeholder={t('flowStages.productDiscovery.personas.onePerLine')}
                                                rows={3}
                                                className="w-full text-xs bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[var(--color-primary)] outline-none resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1 block">{t('flowStages.productDiscovery.personas.goals')}</label>
                                            <textarea
                                                value={persona.goals.join('\n')}
                                                onChange={(e) => updatePersona(index, { goals: e.target.value.split('\n').filter(Boolean) })}
                                                placeholder={t('flowStages.productDiscovery.personas.onePerLine')}
                                                rows={3}
                                                className="w-full text-xs bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[var(--color-primary)] outline-none resize-none"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Column: Competitive Landscape */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {/* Add New Competitor Card */}
                    <button
                        onClick={addCompetitor}
                        className="w-full p-4 rounded-xl border-2 border-dashed border-[var(--color-surface-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all flex items-center gap-3 group"
                    >
                        <div className="size-10 rounded-full bg-[var(--color-surface-hover)] group-hover:bg-[var(--color-primary)]/10 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] text-xl">add</span>
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]">{t('flowStages.productDiscovery.competitors.add')}</p>
                            <p className="text-xs text-[var(--color-text-subtle)]">{t('flowStages.productDiscovery.competitors.addHint')}</p>
                        </div>
                    </button>

                    {discoveryData.competitors.length === 0 ? (
                        <div className="text-center py-8 text-[var(--color-text-muted)]">
                            <p className="text-xs">{t('flowStages.productDiscovery.competitors.empty')}</p>
                        </div>
                    ) : (
                        discoveryData.competitors.map((competitor: Competitor, index: number) => (
                            <div key={index} className="p-4 rounded-xl border border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)] transition-all space-y-3">
                                <div className="flex items-center justify-between">
                                    <input
                                        type="text"
                                        value={competitor.name}
                                        onChange={(e) => updateCompetitor(index, { name: e.target.value })}
                                        placeholder={t('flowStages.productDiscovery.competitors.name')}
                                        className="font-semibold text-sm bg-transparent border-none p-0 focus:ring-0 text-[var(--color-text-main)] placeholder:text-[var(--color-text-subtle)] flex-1"
                                    />
                                    <button
                                        onClick={() => removeCompetitor(index)}
                                        className="text-[var(--color-text-muted)] hover:text-rose-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1 block">{t('flowStages.productDiscovery.competitors.strengths')}</label>
                                    <textarea
                                        value={competitor.strengths}
                                        onChange={(e) => updateCompetitor(index, { strengths: e.target.value })}
                                        placeholder={t('flowStages.productDiscovery.competitors.strengthsPlaceholder')}
                                        rows={2}
                                        className="w-full text-xs bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[var(--color-primary)] outline-none resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase mb-1 block">{t('flowStages.productDiscovery.competitors.weaknesses')}</label>
                                    <textarea
                                        value={competitor.weaknesses}
                                        onChange={(e) => updateCompetitor(index, { weaknesses: e.target.value })}
                                        placeholder={t('flowStages.productDiscovery.competitors.weaknessesPlaceholder')}
                                        rows={2}
                                        className="w-full text-xs bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 focus:ring-1 focus:ring-[var(--color-primary)] outline-none resize-none"
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
