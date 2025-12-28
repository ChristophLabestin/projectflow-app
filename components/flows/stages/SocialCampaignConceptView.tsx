import React from 'react';
import { Button } from '../../ui/Button';
import { Idea } from '../../../types';
import { generateSocialCampaignConceptAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialCampaignConceptViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
    isChangeReq?: boolean;
}

interface CampaignConcept {
    bigIdea: string;
    hook: string;
    themes: string[];
    mood: string;
    visualDirection: string;
}

export const SocialCampaignConceptView: React.FC<SocialCampaignConceptViewProps> = ({ idea, onUpdate, isChangeReq }) => {
    const { t } = useLanguage();
    // Parse concept data
    const conceptData: CampaignConcept = React.useMemo(() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    bigIdea: parsed.bigIdea || '',
                    hook: parsed.hook || '',
                    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
                    mood: parsed.mood || '',
                    visualDirection: parsed.visualDirection || '',
                    ...parsed
                };
            }
        } catch { }
        // Fallback or if it's just a string, treat string as Core Flow
        return {
            bigIdea: (!idea.concept || idea.concept.startsWith('{')) ? '' : idea.concept,
            hook: '',
            themes: [],
            mood: '',
            visualDirection: ''
        };
    }, [idea.concept]);

    const [generating, setGenerating] = React.useState(false);

    const handleGenerateAI = async () => {
        if (generating) return;
        setGenerating(true);
        try {
            const result = await generateSocialCampaignConceptAI(idea);
            updateConcept(result);
        } catch (e) {
            console.error(e);
        } finally {
            setGenerating(false);
        }
    };

    const updateConcept = (updates: Partial<CampaignConcept>) => {
        const newData = { ...conceptData, ...updates };
        // We preserve other fields that might be in the JSON (like strategy fields from next step if they exist, though unlikely if we are linear)
        // Actually, if we use the same JSON blob, we must be careful not to wipe 'strategy' fields if they share the same storage.
        // SocialStrategyView reads: subGoal, targetAudience, channels...
        // We are adding: bigIdea, hook, themes, mood...
        // So we should try to merge with existing JSON if possible.
        let existingJson = {};
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                existingJson = JSON.parse(idea.concept);
            }
        } catch { }

        onUpdate({ concept: JSON.stringify({ ...existingJson, ...newData }) });
    };

    const addTheme = () => {
        updateConcept({ themes: [...conceptData.themes, ''] });
    };

    const updateTheme = (index: number, val: string) => {
        const newThemes = [...conceptData.themes];
        newThemes[index] = val;
        updateConcept({ themes: newThemes });
    };

    const removeTheme = (index: number) => {
        const newThemes = conceptData.themes.filter((_, i) => i !== index);
        updateConcept({ themes: newThemes });
    };

    const MOODS = [
        { id: 'Energetic', label: t('flowStages.socialCampaignConcept.moods.energetic') },
        { id: 'Professional', label: t('flowStages.socialCampaignConcept.moods.professional') },
        { id: 'Minimalist', label: t('flowStages.socialCampaignConcept.moods.minimalist') },
        { id: 'Playful', label: t('flowStages.socialCampaignConcept.moods.playful') },
        { id: 'Luxurious', label: t('flowStages.socialCampaignConcept.moods.luxurious') },
        { id: 'Gritty', label: t('flowStages.socialCampaignConcept.moods.gritty') },
        { id: 'Authentic', label: t('flowStages.socialCampaignConcept.moods.authentic') },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                {/* Hero / Header */}
                <div className="bg-gradient-to-br from-violet-100 via-fuchsia-50 to-white dark:from-violet-900/30 dark:via-fuchsia-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-violet-200 dark:border-violet-800/50 relative overflow-hidden shadow-xl shadow-violet-100 dark:shadow-none flex flex-col md:flex-row justify-between gap-6">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-violet-600 rotate-12 -translate-y-10 translate-x-10">lightbulb</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-violet-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-violet-200 dark:shadow-none">
                                    {t('flowStages.socialCampaignConcept.hero.badge')}
                                </div>
                                <div className="h-[1px] w-8 bg-violet-200 dark:bg-violet-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                {t('flowStages.socialCampaignConcept.hero.title')}
                            </h1>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-2xl leading-relaxed">
                            {t('flowStages.socialCampaignConcept.hero.subtitle')}
                        </p>
                    </div>
                    {/* AI Action */}
                    <div className="relative z-10 flex flex-col justify-between items-end">
                        <Button
                            onClick={handleGenerateAI}
                            disabled={generating}
                            className="h-10 px-5 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm font-black text-[10px] uppercase tracking-[.2em] transition-all flex items-center gap-2"
                        >
                            <span className={`material-symbols-outlined text-[18px] ${generating ? 'animate-spin' : ''}`}>
                                {generating ? 'progress_activity' : 'auto_awesome'}
                            </span>
                            {generating ? t('flowStages.socialCampaignConcept.actions.dreaming') : t('flowStages.socialCampaignConcept.actions.aiSuggest')}
                        </Button>
                    </div>
                </div>

                {/* Feedback Banner for Change Requests */}
                {(isChangeReq || idea.lastRejectionReason) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-6 mb-6 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-start gap-4">
                            <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">edit_note</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-amber-900 dark:text-amber-100 text-lg mb-1">{t('flowStages.socialCampaignConcept.changes.title')}</h3>
                                <p className="text-sm font-medium text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                                    {idea.lastRejectionReason || t('flowStages.socialCampaignConcept.changes.default')}
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/60 dark:text-amber-300/60">{t('flowStages.socialCampaignConcept.changes.action')}</span>
                                    <span className="h-px w-8 bg-amber-200 dark:bg-amber-700"></span>
                                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200">{t('flowStages.socialCampaignConcept.changes.actionHint')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Core Definition */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* The Core Flow */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400">
                                    <span className="material-symbols-outlined text-xl">auto_awesome</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">{t('flowStages.socialCampaignConcept.core.title')}</h3>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t('flowStages.socialCampaignConcept.core.subtitle')}</p>
                                </div>
                            </div>
                            <textarea
                                className="w-full min-h-[160px] bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-base md:text-lg font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all resize-none leading-relaxed"
                                placeholder={t('flowStages.socialCampaignConcept.core.placeholder')}
                                value={conceptData.bigIdea}
                                onChange={(e) => updateConcept({ bigIdea: e.target.value })}
                            />
                        </div>

                        {/* Visual Direction & Mood */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-800">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="size-10 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/30 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400">
                                    <span className="material-symbols-outlined text-xl">palette</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">{t('flowStages.socialCampaignConcept.visual.title')}</h3>
                                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t('flowStages.socialCampaignConcept.visual.subtitle')}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70">{t('flowStages.socialCampaignConcept.visual.descriptionLabel')}</label>
                                    <textarea
                                        className="w-full h-32 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-fuchsia-500 focus:ring-4 focus:ring-fuchsia-500/10 transition-all resize-none leading-relaxed"
                                        placeholder={t('flowStages.socialCampaignConcept.visual.descriptionPlaceholder')}
                                        value={conceptData.visualDirection}
                                        onChange={(e) => updateConcept({ visualDirection: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[.15em] mb-3 block opacity-70">{t('flowStages.socialCampaignConcept.visual.moodLabel')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {MOODS.map((mood) => (
                                            <button
                                                key={mood.id}
                                                onClick={() => updateConcept({ mood: mood.id })}
                                                className={`px-3 py-2 text-[10px] font-black rounded-xl border-2 transition-all ${conceptData.mood === mood.id
                                                    ? 'bg-fuchsia-600 text-white border-fuchsia-600 shadow-lg shadow-fuchsia-200 dark:shadow-none'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 hover:border-fuchsia-200'
                                                    }`}
                                            >
                                                {mood.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Hooks & Themes */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Elevator Pitch / Hook */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50 flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">anchor</span>
                                {t('flowStages.socialCampaignConcept.hook.title')}
                            </h3>
                            <textarea
                                className="w-full h-24 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-3 text-xs md:text-sm font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none leading-snug"
                                placeholder={t('flowStages.socialCampaignConcept.hook.placeholder')}
                                value={conceptData.hook}
                                onChange={(e) => updateConcept({ hook: e.target.value })}
                            />
                        </div>

                        {/* Content Pillars / Themes */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest opacity-50 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">view_column</span>
                                    {t('flowStages.socialCampaignConcept.themes.title')}
                                </h3>
                                <button onClick={addTheme} className="size-6 bg-slate-100 dark:bg-slate-800 hover:bg-violet-100 text-slate-500 hover:text-violet-600 rounded-full flex items-center justify-center transition-all">
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {conceptData.themes.length === 0 && (
                                    <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{t('flowStages.socialCampaignConcept.themes.empty')}</p>
                                    </div>
                                )}
                                {conceptData.themes.map((theme, i) => (
                                    <div key={i} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <span className="text-[10px] font-black text-slate-300 w-4">{i + 1}</span>
                                        <input
                                            type="text"
                                            value={theme}
                                            onChange={(e) => updateTheme(i, e.target.value)}
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border-b-2 border-slate-100 dark:border-slate-700 hover:border-violet-200 focus:border-violet-500 px-2 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none transition-all rounded-t-md"
                                            placeholder={t('flowStages.socialCampaignConcept.themes.placeholder').replace('{index}', `${i + 1}`)}
                                        />
                                        <button onClick={() => removeTheme(i)} className="text-slate-300 hover:text-rose-500 transition-colors">
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Action */}
                        <div className="pt-4">
                            <Button
                                className="w-full h-12 rounded-xl bg-slate-900 dark:bg-white hover:bg-violet-600 dark:hover:bg-violet-500 text-white dark:text-slate-900 hover:text-white font-black text-xs uppercase tracking-[.2em] shadow-lg shadow-slate-200 dark:shadow-none transition-all flex items-center justify-center gap-2 group"
                                onClick={() => onUpdate({ stage: 'Strategy' })}
                            >
                                {t('flowStages.socialCampaignConcept.actions.advance')}
                                <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
