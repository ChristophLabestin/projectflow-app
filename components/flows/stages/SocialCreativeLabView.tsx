import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { Idea, SocialPlatform } from '../../../types';
import { generatePlatformConceptsAI } from '../../../services/geminiService';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCreativeLabViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface CreativeConcept {
    hook: string;
    contentBody: string;
    visualCue: string;
    format: string;
}

interface CreativeLabData {
    tone: string;
    concepts: Record<string, CreativeConcept>;
    // Legacy fields preserved for safety, though unused in new UI
    hooks?: string[];
    storyboard?: any[];
}

export const SocialCreativeLabView: React.FC<SocialCreativeLabViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);

    // Parse Strategy & Lab Data
    const strategy = (() => {
        try {
            return idea.concept ? JSON.parse(idea.concept) : {};
        } catch { return {}; }
    })();

    const labData: CreativeLabData = {
        tone: strategy.tone || 'Friendly & Professional',
        concepts: strategy.concepts || {},
        hooks: strategy.hooks,
        storyboard: strategy.storyboard
    };

    const updateLabData = (updates: Partial<CreativeLabData>) => {
        const newData = { ...strategy, ...updates }; // Merge into existing strategy JSON
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const handleGenerateConcepts = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const concepts = await generatePlatformConceptsAI(idea, strategy, labData.tone);
            updateLabData({ concepts });
        } catch (error) {
            console.error("Concept generation error:", error);
        } finally {
            setGenerating(false);
        }
    };

    const validChannels: SocialPlatform[] = strategy.channels || [];
    const hasConcepts = Object.keys(labData.concepts).length > 0;

    const TONES = [
        { id: 'Professional', label: t('flowStages.socialCreativeLab.tones.professional') },
        { id: 'Witty', label: t('flowStages.socialCreativeLab.tones.witty') },
        { id: 'Bold', label: t('flowStages.socialCreativeLab.tones.bold') },
        { id: 'Educational', label: t('flowStages.socialCreativeLab.tones.educational') },
        { id: 'Authentic', label: t('flowStages.socialCreativeLab.tones.authentic') },
        { id: 'High Energy', label: t('flowStages.socialCreativeLab.tones.highEnergy') },
        { id: 'Minimalist', label: t('flowStages.socialCreativeLab.tones.minimalist') },
    ];
    const toneLabel = TONES.find((tone) => tone.id === labData.tone)?.label || labData.tone;

    const missionText = (
        <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            "{t('flowStages.socialCreativeLab.mission.prefix')} <span className="text-rose-500 font-black">{t('flowStages.socialCreativeLab.mission.plays').replace('{count}', `${validChannels.length}`)}</span>
            {' '}{t('flowStages.socialCreativeLab.mission.into')} <span className="text-rose-500 font-black">{t('flowStages.socialCreativeLab.mission.concepts')}</span>
            {' '}{t('flowStages.socialCreativeLab.mission.amplify')} <span className="text-rose-500 font-black">{toneLabel}</span> {t('flowStages.socialCreativeLab.mission.voiceSuffix')}"
        </div>
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-4 pt-6 px-6">

                {/* Hero Section */}
                <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-white dark:from-indigo-900/30 dark:via-purple-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-indigo-100 dark:border-indigo-800/50 relative overflow-hidden shadow-xl shadow-indigo-100/50 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-indigo-600 rotate-12 -translate-y-10 translate-x-10">science</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-indigo-200 dark:shadow-none">
                                    {t('flowStages.socialCreativeLab.hero.badge')}
                                </div>
                                <div className="h-[1px] w-8 bg-indigo-200 dark:bg-indigo-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                {t('flowStages.socialCreativeLab.hero.title')}
                            </h1>
                        </div>
                        <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-indigo-100/50 dark:shadow-none backdrop-blur-md">
                            {missionText}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">

                    {/* Left Column: Ingredients & Controls */}
                    <div className="lg:col-span-4 space-y-5">

                        {/* Strategy Recap Card */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative overflow-hidden">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50 relative z-10">{t('flowStages.socialCreativeLab.ingredients.title')}</h3>
                            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                                <span className="material-symbols-outlined text-8xl text-indigo-900 -rotate-12 translate-x-4 -translate-y-4">playlist_add_check</span>
                            </div>

                            {validChannels.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-xs text-slate-400 font-bold mb-2">{t('flowStages.socialCreativeLab.ingredients.empty')}</p>
                                    <Button
                                        onClick={() => onUpdate({ stage: 'Strategy' })}
                                        className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600"
                                    >
                                        {t('flowStages.socialCreativeLab.ingredients.return')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3 relative z-10">
                                    {validChannels.map(c => (
                                        <div key={c} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                                            <div className="size-8 shrink-0">
                                                <PlatformIcon platform={c} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-0.5">{c}</div>
                                                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate leading-tight">
                                                    {strategy.plays?.[c]?.play || t('flowStages.socialCreativeLab.ingredients.defaultPlay')}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {idea.keywords && idea.keywords.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 relative z-10">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('flowStages.socialCreativeLab.ingredients.themes')}</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {idea.keywords.slice(0, 5).map(k => (
                                            <span key={k} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-md text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/30">
                                                {k}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Tone Selector */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50">{t('flowStages.socialCreativeLab.voice.title')}</h3>
                            <div className="flex flex-wrap gap-2">
                                {TONES.map((tone) => (
                                    <button
                                        key={tone.id}
                                        onClick={() => updateLabData({ tone: tone.id })}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all border ${labData.tone === tone.id
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                                            }`}
                                    >
                                        {tone.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Button Wrapper */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center text-center">
                            <div className="size-16 bg-gradient-to-br from-indigo-100 to-white dark:from-indigo-900/20 dark:to-slate-900 rounded-full flex items-center justify-center mb-4 border border-indigo-50 dark:border-indigo-800 shadow-inner">
                                <span className={`material-symbols-outlined text-3xl text-indigo-500 ${generating ? 'animate-spin' : ''}`}>
                                    {generating ? 'change_circle' : 'science'}
                                </span>
                            </div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">{t('flowStages.socialCreativeLab.actions.title')}</h3>
                            <p className="text-[11px] text-slate-500 font-medium mb-4 leading-tight max-w-[200px]">
                                {t('flowStages.socialCreativeLab.actions.subtitle')}
                            </p>
                            <Button
                                onClick={handleGenerateConcepts}
                                isLoading={generating}
                                disabled={validChannels.length === 0}
                                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-[.2em] shadow-lg shadow-indigo-200 dark:shadow-none"
                            >
                                {hasConcepts ? t('flowStages.socialCreativeLab.actions.regenerate') : t('flowStages.socialCreativeLab.actions.run')}
                            </Button>
                        </div>
                    </div>

                    {/* Right Column: Concept Grid */}
                    <div className="lg:col-span-8 space-y-5 flex flex-col">
                        <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm min-h-[500px] flex flex-col">

                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">{t('flowStages.socialCreativeLab.results.title')}</h3>
                                    <p className="text-[10px] text-slate-500 font-bold mt-1 tracking-tight">{t('flowStages.socialCreativeLab.results.subtitle')}</p>
                                </div>
                                {hasConcepts && (
                                    <div className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-green-100 dark:border-green-900/30">
                                        {t('flowStages.socialCreativeLab.results.success')}
                                    </div>
                                )}
                            </div>

                            {!hasConcepts ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-indigo-50/50 dark:bg-slate-800/20 rounded-[2rem] border-2 border-dashed border-indigo-100 dark:border-slate-800">
                                    <div className="size-24 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl border border-indigo-50 dark:border-slate-800 mb-6">
                                        <span className="material-symbols-outlined text-5xl text-indigo-200 dark:text-indigo-900">experiment</span>
                                    </div>
                                    <h4 className="text-xl font-black text-indigo-900/40 dark:text-indigo-100/40 tracking-tight">{t('flowStages.socialCreativeLab.results.empty.title')}</h4>
                                    <p className="text-sm text-indigo-900/30 dark:text-indigo-100/30 font-bold max-w-[280px] mt-2 leading-relaxed">
                                        {t('flowStages.socialCreativeLab.results.empty.subtitle')}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {validChannels.map(platform => {
                                        const concept = labData.concepts[platform];
                                        if (!concept) return null;

                                        return (
                                            <div key={platform} className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-5 border-2 border-slate-100 dark:border-slate-800 flex flex-col hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all hover:shadow-lg group">

                                                {/* Card Header */}
                                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700/50">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6">
                                                            <PlatformIcon platform={platform} />
                                                        </div>
                                                        <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                            {concept.format || t('flowStages.socialCreativeLab.results.formatFallback')}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        {/* Quick Edit Actions could go here */}
                                                        <span className="material-symbols-outlined text-[16px] text-slate-300">more_horiz</span>
                                                    </div>
                                                </div>

                                                {/* Concept Content */}
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1.5 opacity-80 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px]">phishing</span> {t('flowStages.socialCreativeLab.results.hook')}
                                                        </div>
                                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                                            "{concept.hook}"
                                                        </p>
                                                    </div>

                                                    <div className="bg-white dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1.5 opacity-80">{t('flowStages.socialCreativeLab.results.contentOutline')}</div>
                                                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                                            {concept.contentBody}
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 opacity-80">{t('flowStages.socialCreativeLab.results.visualDirection')}</div>
                                                        <div className="flex items-start gap-2">
                                                            <span className="material-symbols-outlined text-[14px] text-slate-400 mt-0.5">videocam</span>
                                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-snug italic">
                                                                {concept.visualCue}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>

                        {/* Footer Link */}
                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <Button
                                className="h-14 px-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-[.2em] shadow-xl shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group"
                                onClick={() => onUpdate({ stage: 'Studio' })}
                                disabled={!hasConcepts}
                            >
                                {t('flowStages.socialCreativeLab.actions.advance')}
                                <div className="size-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-2 transition-all">
                                    <span className="material-symbols-outlined text-[18px] font-black">movie_edit</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
