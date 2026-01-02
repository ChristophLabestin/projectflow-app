import React, { useState } from 'react';
import { SocialPlatform } from '../../../types';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';
import { Button } from '../../ui/Button';

interface ReviewStrategyPanelProps {
    campaignData: any;
    onUpdate: (updates: any) => void;
}

const PHASE_COLORS = [
    { bg: 'from-rose-500 to-pink-600', light: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800' },
    { bg: 'from-orange-500 to-amber-500', light: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
    { bg: 'from-emerald-500 to-teal-500', light: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' },
    { bg: 'from-blue-500 to-indigo-500', light: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800' },
    { bg: 'from-violet-500 to-purple-600', light: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800' },
];

const GOALS = [
    { id: 'Brand Awareness', labelKey: 'flowStages.socialCampaignStrategy.goals.brandAwareness' },
    { id: 'Engagement', labelKey: 'flowStages.socialCampaignStrategy.goals.engagement' },
    { id: 'Traffic / Link', labelKey: 'flowStages.socialCampaignStrategy.goals.traffic' },
    { id: 'Sales / Promo', labelKey: 'flowStages.socialCampaignStrategy.goals.sales' },
    { id: 'Community Building', labelKey: 'flowStages.socialCampaignStrategy.goals.community' },
    { id: 'Education', labelKey: 'flowStages.socialCampaignStrategy.goals.education' },
];
const PILLARS = [
    { id: 'Educational', labelKey: 'flowStages.socialCampaignStrategy.pillars.educational' },
    { id: 'Promotional', labelKey: 'flowStages.socialCampaignStrategy.pillars.promotional' },
    { id: 'Entertainment', labelKey: 'flowStages.socialCampaignStrategy.pillars.entertainment' },
    { id: 'Inspirational', labelKey: 'flowStages.socialCampaignStrategy.pillars.inspirational' },
    { id: 'Community', labelKey: 'flowStages.socialCampaignStrategy.pillars.community' },
    { id: 'Behind the Scenes', labelKey: 'flowStages.socialCampaignStrategy.pillars.behindScenes' },
];

export const ReviewStrategyPanel: React.FC<ReviewStrategyPanelProps> = ({ campaignData, onUpdate }) => {
    const { t } = useLanguage();
    const [editingAudienceIndex, setEditingAudienceIndex] = useState<number | null>(null);
    const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
    const [expandedPlatformId, setExpandedPlatformId] = useState<string | null>(null);
    const frequencyUnitLabels: Record<string, string> = {
        'Posts/Day': t('flowStages.socialCampaignStrategy.tactics.frequency.units.day'),
        'Posts/Week': t('flowStages.socialCampaignStrategy.tactics.frequency.units.week'),
        'Posts/Month': t('flowStages.socialCampaignStrategy.tactics.frequency.units.month'),
    };
    const frequencyUnitShortLabels: Record<string, string> = {
        'Posts/Day': t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortDay'),
        'Posts/Week': t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortWeek'),
        'Posts/Month': t('flowStages.socialCampaignStrategy.tactics.frequency.units.shortMonth'),
    };

    const formatFrequencyUnitShort = (unit?: string) =>
        frequencyUnitShortLabels[unit || ''] || unit?.replace('Posts/', '') || '';

    // Helpers to update specific parts of the campaign data
    const updateStrategy = (updates: any) => {
        onUpdate(updates);
    };

    const updatePlatform = (platformId: string, updates: any) => {
        const newPlatforms = (campaignData.platforms || []).map((p: any) => {
            if (p.id === platformId) {
                return { ...p, ...updates };
            }
            return p;
        });
        updateStrategy({ platforms: newPlatforms });
    };

    const updatePhaseFrequency = (platformId: string, phaseId: string, frequencyValue: number, frequencyUnit: string) => {
        const platform = campaignData.platforms.find((p: any) => p.id === platformId);
        if (!platform) return;

        const currentFreqs = platform.phaseFrequencies || [];
        const existingIndex = currentFreqs.findIndex((pf: any) => pf.phaseId === phaseId);

        let newFreqs;
        if (existingIndex >= 0) {
            newFreqs = [...currentFreqs];
            newFreqs[existingIndex] = { phaseId, frequencyValue, frequencyUnit };
        } else {
            newFreqs = [...currentFreqs, { phaseId, frequencyValue, frequencyUnit }];
        }

        updatePlatform(platformId, { phaseFrequencies: newFreqs });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Column 1: Objectives & Audience */}
            <div className="space-y-6">

                {/* Objectives Card */}
                <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-6 opacity-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">flag</span>
                        {t('flowStages.reviewStrategyPanel.core.title')}
                    </h3>

                    <div className="space-y-5">
                        {/* Primary Goal */}
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[.15em] mb-2 block opacity-70">{t('flowStages.reviewStrategyPanel.core.primaryGoal')}</label>
                            <select
                                value={campaignData.campaignType || ''}
                                onChange={(e) => updateStrategy({ campaignType: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800/50 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
                            >
                                <option value="">{t('flowStages.reviewStrategyPanel.core.selectGoal')}</option>
                                {GOALS.map(g => <option key={g.id} value={g.id}>{t(g.labelKey)}</option>)}
                            </select>
                        </div>

                        {/* Secondary KPI */}
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[.15em] mb-2 block opacity-70">{t('flowStages.reviewStrategyPanel.core.kpiTarget')}</label>
                            <select
                                value={campaignData.subGoal || ''}
                                onChange={(e) => updateStrategy({ subGoal: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800/50 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:border-rose-500 transition-all"
                            >
                                <option value="">{t('flowStages.reviewStrategyPanel.core.selectKpi')}</option>
                                {GOALS.filter(g => g.id !== campaignData.campaignType).map(g => <option key={g.id} value={g.id}>{t(g.labelKey)}</option>)}
                            </select>
                        </div>

                        {/* Content Pillar */}
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-[.15em] mb-2 block opacity-70">{t('flowStages.reviewStrategyPanel.core.pillar')}</label>
                            <select
                                value={campaignData.pillar || ''}
                                onChange={(e) => updateStrategy({ pillar: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800/50 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-200 focus:outline-none focus:border-rose-500 transition-all"
                            >
                                <option value="">{t('flowStages.reviewStrategyPanel.core.selectPillar')}</option>
                                {PILLARS.map(p => <option key={p.id} value={p.id}>{t(p.labelKey)}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Audience Card */}
                <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest opacity-50 flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">groups</span>
                            {t('flowStages.socialCampaignStrategy.audience.title')}
                        </h3>
                        <button
                            onClick={() => {
                                const newIndex = (campaignData.audienceSegments || []).length;
                                updateStrategy({ audienceSegments: [...(campaignData.audienceSegments || []), ''] });
                                setEditingAudienceIndex(newIndex);
                            }}
                            className="size-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-600 transition-all"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {(campaignData.audienceSegments || []).map((segment: any, i: number) => {
                            const segText = typeof segment === 'string' ? segment : segment.name || '';
                            const isEditing = editingAudienceIndex === i;

                            return (
                                <div
                                    key={i}
                                    onClick={() => !isEditing && setEditingAudienceIndex(i)}
                                    className={`group relative p-3 rounded-xl border-2 transition-all cursor-pointer ${isEditing ? 'bg-white dark:bg-slate-900 border-rose-400/50 shadow-md' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-rose-400/30'}`}
                                >
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <textarea
                                                className="w-full text-[11px] font-bold bg-transparent border-0 outline-none h-16 resize-none leading-snug tracking-tight text-slate-700 dark:text-slate-200"
                                                value={segText}
                                                onChange={(e) => {
                                                    const newSegs = [...(campaignData.audienceSegments || [])];
                                                    newSegs[i] = e.target.value;
                                                    updateStrategy({ audienceSegments: newSegs });
                                                }}
                                                placeholder={t('flowStages.reviewStrategyPanel.audience.placeholder')}
                                                autoFocus
                                                onBlur={() => {
                                                    // If empty on blur, remove it? keeping it simple for now
                                                    if (segText.trim() !== '') setEditingAudienceIndex(null);
                                                }}
                                            />
                                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateStrategy({ audienceSegments: campaignData.audienceSegments.filter((_: any, idx: number) => idx !== i) }); setEditingAudienceIndex(null); }}
                                                    className="text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest flex items-center gap-1"
                                                >
                                                    {t('flowStages.socialCampaignStrategy.audience.remove')}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingAudienceIndex(null); }}
                                                    className="text-[9px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                                                >
                                                    {t('flowStages.socialCampaignStrategy.audience.save')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                                                {segText || <span className="text-slate-400 italic">{t('flowStages.socialCampaignStrategy.audience.emptySegment')}</span>}
                                            </p>
                                            <div className="opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                <span className="material-symbols-outlined text-[14px] text-slate-400">edit</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {(campaignData.audienceSegments || []).length === 0 && (
                            <div className="text-center py-4 text-[10px] text-slate-400 italic">
                                {t('flowStages.reviewStrategyPanel.audience.empty')}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Column 2 & 3: Channel Tactics */}
            <div className="md:col-span-2">
                <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm h-full">
                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-6 opacity-50 flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">hub</span>
                        {t('flowStages.socialCampaignStrategy.tactics.title')}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(campaignData.platforms || []).map((platform: any, i: number) => {
                            const isEditing = editingPlatformId === platform.id;

                            return (
                                <div
                                    key={platform.id}
                                    onClick={() => !isEditing && setEditingPlatformId(platform.id)}
                                    className={`relative group bg-slate-50 dark:bg-slate-800/30 rounded-2xl p-5 border-2 transition-all cursor-pointer ${isEditing ? 'bg-white dark:bg-slate-900 border-rose-400/50 shadow-xl z-10' : 'border-slate-100 dark:border-slate-800 hover:border-rose-400/30 hover:shadow-md'}`}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="size-8">
                                            <PlatformIcon platform={platform.id as SocialPlatform} />
                                        </div>
                                        <span className="font-black text-[11px] tracking-widest text-slate-900 dark:text-white uppercase">{platform.id}</span>
                                    </div>

                                    {isEditing ? (
                                        <div className="space-y-4 animate-fadeIn">
                                            <div>
                                                <label className="text-[9px] font-black text-rose-500 uppercase tracking-[.25em] mb-1.5 block opacity-80">{t('flowStages.socialCampaignStrategy.tactics.role.label')}</label>
                                                <textarea
                                                    value={platform.role}
                                                    onChange={(e) => updatePlatform(platform.id, { role: e.target.value })}
                                                    placeholder={t('flowStages.socialCampaignStrategy.tactics.role.placeholder')}
                                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500 h-16 resize-none"
                                                    autoFocus
                                                />
                                            </div>

                                            <div>
                                                <label className="text-[9px] font-black text-rose-500 uppercase tracking-[.25em] mb-1.5 block opacity-80">{t('flowStages.socialCampaignStrategy.tactics.frequency.label')}</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        value={platform.frequencyValue ?? ''}
                                                        onChange={(e) => updatePlatform(platform.id, { frequencyValue: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                                                        placeholder="3"
                                                        className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[11px] font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500 text-center"
                                                    />
                                                    <select
                                                        value={platform.frequencyUnit || 'Posts/Week'}
                                                        onChange={(e) => updatePlatform(platform.id, { frequencyUnit: e.target.value })}
                                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 dark:text-slate-300 focus:outline-none focus:border-rose-500"
                                                    >
                                                        <option value="Posts/Day">{frequencyUnitLabels['Posts/Day']}</option>
                                                        <option value="Posts/Week">{frequencyUnitLabels['Posts/Week']}</option>
                                                        <option value="Posts/Month">{frequencyUnitLabels['Posts/Month']}</option>
                                                    </select>
                                                </div>

                                                {/* Advanced Toggle */}
                                                <div className="mt-3">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setExpandedPlatformId(expandedPlatformId === platform.id ? null : platform.id); }}
                                                        className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                    >
                                                        <span className={`material-symbols-outlined text-[12px] transition-transform ${expandedPlatformId === platform.id ? 'rotate-180' : ''}`}>expand_more</span>
                                                        {expandedPlatformId === platform.id
                                                            ? t('flowStages.reviewStrategyPanel.tactics.overrides.hide')
                                                            : t('flowStages.reviewStrategyPanel.tactics.overrides.show')}
                                                    </button>

                                                    {expandedPlatformId === platform.id && (
                                                        <div className="mt-2 space-y-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                            {(campaignData.phases || []).map((phase: any, idx: number) => {
                                                                const phaseFreq = (platform.phaseFrequencies || []).find((pf: any) => pf.phaseId === phase.id);
                                                                const val = phaseFreq ? phaseFreq.frequencyValue : platform.frequencyValue ?? 1;
                                                                const unit = phaseFreq ? phaseFreq.frequencyUnit : platform.frequencyUnit ?? 'Posts/Week';
                                                                const isOverridden = !!phaseFreq;
                                                                const colors = PHASE_COLORS[idx % PHASE_COLORS.length];

                                                                return (
                                                                    <div key={phase.id} className="flex items-center justify-between gap-2">
                                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                            <div className={`size-1.5 rounded-full bg-gradient-to-r ${colors.bg}`} />
                                                                            <span className="text-[10px] font-bold text-slate-500 truncate">
                                                                                {phase.name || t('flowStages.reviewStrategyPanel.tactics.phaseFallback').replace('{index}', `${idx + 1}`)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            <input
                                                                                type="number"
                                                                                value={val ?? ''}
                                                                                onChange={(e) => updatePhaseFrequency(platform.id, phase.id, e.target.value === '' ? undefined : parseInt(e.target.value), unit)}
                                                                                className={`w-8 h-5 rounded px-1 text-[9px] font-bold text-center border ${isOverridden ? 'bg-white border-indigo-200 text-indigo-600' : 'bg-transparent border-transparent text-slate-400'}`}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                                <Button
                                                    onClick={(e) => { e.stopPropagation(); setEditingPlatformId(null); }}
                                                    size="sm"
                                                    className="px-4 py-1.5 h-auto rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md"
                                                >
                                                    {t('flowStages.reviewStrategyPanel.tactics.done')}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 min-h-[2.5em]">
                                                    {platform.role || t('flowStages.reviewStrategyPanel.tactics.emptyRole')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="px-2 py-1 bg-white dark:bg-slate-900 rounded-md border border-slate-100 dark:border-slate-700 text-[9px] font-black text-slate-500 uppercase">
                                                    {platform.frequencyValue || 1} {formatFrequencyUnitShort(platform.frequencyUnit)}
                                                </div>
                                            </div>

                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                                                <div className="size-6 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-slate-400">
                                                    <span className="material-symbols-outlined text-[14px]">edit</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {(campaignData.platforms || []).length === 0 && (
                            <div className="col-span-full py-8 text-center text-[11px] text-slate-400 italic">
                                {t('flowStages.reviewStrategyPanel.tactics.emptyPlatforms')}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
