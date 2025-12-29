import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateTargetingSuggestions } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsTargetingViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const PLACEMENTS = [
    { id: 'feeds', label: 'Feeds', icon: 'feed' },
    { id: 'stories', label: 'Stories / Reels', icon: 'web_stories' },
    { id: 'search', label: 'Search Results', icon: 'search' },
    { id: 'messages', label: 'Messages', icon: 'chat' },
    { id: 'apps', label: 'Apps & Sites', icon: 'apps' },
];

export const PaidAdsTargetingView: React.FC<PaidAdsTargetingViewProps> = ({ idea, onUpdate }) => {
    const { adData, updateTargeting } = usePaidAdsData(idea, onUpdate);
    const [isGenerating, setIsGenerating] = useState(false);
    const targeting = adData.targeting || {};

    // Local state for inputs
    const [locationInput, setLocationInput] = useState('');
    const [interestInput, setInterestInput] = useState('');
    const [behaviorInput, setBehaviorInput] = useState('');
    const [customAudienceInput, setCustomAudienceInput] = useState('');
    const [lookalikeInput, setLookalikeInput] = useState('');
    const [languageInput, setLanguageInput] = useState('');

    const handleGenerateSuggestions = async () => {
        setIsGenerating(true);
        try {
            const suggestions = await generateTargetingSuggestions(
                idea.title,
                idea.description || adData.missionStatement || '',
                adData.objective?.toString() || ''
            );

            if (suggestions) {
                // Merge suggestions
                updateTargeting({
                    interests: [...new Set([...(targeting.interests || []), ...(suggestions.interests || [])])],
                    behaviors: [...new Set([...(targeting.behaviors || []), ...(suggestions.behaviors || [])])],
                    // We could also suggest age/gender if the AI returns it, but for now just interests/behaviors
                });
            }
        } finally {
            setIsGenerating(false);
        }
    };

    // Generic list handlers
    const addToList = (
        list: string[] | undefined,
        item: string,
        field: 'locations' | 'interests' | 'behaviors' | 'customAudiences' | 'lookalikes' | 'languages',
        setInput: (s: string) => void
    ) => {
        if (item.trim()) {
            const current = list || [];
            if (!current.includes(item.trim())) {
                updateTargeting({ [field]: [...current, item.trim()] });
            }
            setInput('');
        }
    };

    const removeFromList = (list: string[] | undefined, index: number, field: 'locations' | 'interests' | 'behaviors' | 'customAudiences' | 'lookalikes' | 'languages') => {
        if (!list) return;
        updateTargeting({ [field]: list.filter((_, i) => i !== index) });
    };

    const togglePlacement = (id: string) => {
        const current = targeting.placements || [];
        if (current.includes(id)) {
            updateTargeting({ placements: current.filter(p => p !== id) });
        } else {
            updateTargeting({ placements: [...current, id] });
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                {/* Header */}
                <div className="bg-gradient-to-br from-emerald-100 via-teal-50 to-white dark:from-emerald-900/30 dark:via-teal-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-emerald-200 dark:border-emerald-800/50 relative overflow-hidden shadow-xl shadow-emerald-100 dark:shadow-none flex items-center justify-between">
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-emerald-200 dark:shadow-none">
                                TARGETING
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            Audience Radar
                        </h1>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-emerald-100/50 to-transparent dark:from-emerald-900/20" />
                    <span className="material-symbols-outlined absolute right-10 -bottom-10 text-[180px] text-emerald-500/10 rotate-12">radar</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Demographics & Geo (6/12) */}
                    <div className="lg:col-span-6 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Demographics</h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-3 block opacity-80">Locations</label>
                                    <div className="relative mb-3">
                                        <input
                                            type="text"
                                            value={locationInput}
                                            onChange={(e) => setLocationInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addToList(targeting.locations, locationInput, 'locations', setLocationInput)}
                                            placeholder="Add countries, cities..."
                                            className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-emerald-500 outline-none pl-10"
                                        />
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">location_on</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.locations?.map((loc, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                                                {loc}
                                                <button onClick={() => removeFromList(targeting.locations, i, 'locations')} className="hover:text-emerald-900 dark:hover:text-emerald-100"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Min Age</label>
                                        <input
                                            type="number"
                                            value={targeting.ageMin || 18}
                                            onChange={(e) => updateTargeting({ ageMin: Number(e.target.value) })}
                                            className="w-full text-sm font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Max Age</label>
                                        <input
                                            type="number"
                                            value={targeting.ageMax || 65}
                                            onChange={(e) => updateTargeting({ ageMax: Number(e.target.value) })}
                                            className="w-full text-sm font-black bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-3 block opacity-80">Gender</label>
                                    <div className="flex bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
                                        {['All', 'Male', 'Female'].map((g) => {
                                            const isSelected = (targeting.genders || ['All']).includes(g as any); // Simplified check
                                            return (
                                                <button
                                                    key={g}
                                                    onClick={() => updateTargeting({ genders: [g as any] })} // Simplified to single select for UI, though type is array
                                                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${isSelected ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    {g}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Custom Audiences</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={customAudienceInput}
                                            onChange={(e) => setCustomAudienceInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addToList(targeting.customAudiences, customAudienceInput, 'customAudiences', setCustomAudienceInput)}
                                            placeholder="Retargeting, CRM list..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={() => addToList(targeting.customAudiences, customAudienceInput, 'customAudiences', setCustomAudienceInput)}
                                            className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.customAudiences?.map((aud, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                                                {aud}
                                                <button onClick={() => removeFromList(targeting.customAudiences, i, 'customAudiences')} className="hover:text-emerald-900 dark:hover:text-emerald-100"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Excluded Audiences</label>
                                    <input
                                        value={targeting.excludedAudiences || ''}
                                        onChange={(e) => updateTargeting({ excludedAudiences: e.target.value })}
                                        placeholder="Competitors, Current Customers..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                <Button
                                    className="w-full h-12 text-base justify-between group bg-white text-slate-900 hover:bg-violet-50 shadow-lg hover:shadow-xl transition-all rounded-xl border-none"
                                    onClick={() => onUpdate({ stage: 'Budget' })}
                                >
                                    <span className="font-bold pl-1 text-xs uppercase tracking-widest">Next: Budgeting</span>
                                    <div className="size-8 rounded-lg bg-slate-900/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Interests & Placements (6/12) */}
                    <div className="lg:col-span-6 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Interests & Behaviors</h3>
                                <button
                                    onClick={handleGenerateSuggestions}
                                    disabled={isGenerating}
                                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg transition-colors"
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${isGenerating ? 'animate-spin' : ''}`}>
                                        {isGenerating ? 'sync' : 'auto_awesome'}
                                    </span>
                                    {isGenerating ? 'Analyzing...' : 'Suggest'}
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Interests</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={interestInput}
                                            onChange={(e) => setInterestInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addToList(targeting.interests, interestInput, 'interests', setInterestInput)}
                                            placeholder="Add interests..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={() => addToList(targeting.interests, interestInput, 'interests', setInterestInput)}
                                            className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.interests?.map((interest, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                                                {interest}
                                                <button onClick={() => removeFromList(targeting.interests, i, 'interests')} className="hover:text-emerald-900 dark:hover:text-emerald-100"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Behaviors</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={behaviorInput}
                                            onChange={(e) => setBehaviorInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addToList(targeting.behaviors, behaviorInput, 'behaviors', setBehaviorInput)}
                                            placeholder="Add behaviors..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={() => addToList(targeting.behaviors, behaviorInput, 'behaviors', setBehaviorInput)}
                                            className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.behaviors?.map((behavior, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                                                {behavior}
                                                <button onClick={() => removeFromList(targeting.behaviors, i, 'behaviors')} className="hover:text-emerald-900 dark:hover:text-emerald-100"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Lookalikes & Languages</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Lookalikes</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={lookalikeInput}
                                            onChange={(e) => setLookalikeInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addToList(targeting.lookalikes, lookalikeInput, 'lookalikes', setLookalikeInput)}
                                            placeholder="Seed list, % range..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={() => addToList(targeting.lookalikes, lookalikeInput, 'lookalikes', setLookalikeInput)}
                                            className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.lookalikes?.map((lookalike, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                                                {lookalike}
                                                <button onClick={() => removeFromList(targeting.lookalikes, i, 'lookalikes')} className="hover:text-emerald-900 dark:hover:text-emerald-100"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-[.25em] mb-2 block opacity-80">Languages</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="text"
                                            value={languageInput}
                                            onChange={(e) => setLanguageInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addToList(targeting.languages, languageInput, 'languages', setLanguageInput)}
                                            placeholder="English, Spanish..."
                                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={() => addToList(targeting.languages, languageInput, 'languages', setLanguageInput)}
                                            className="px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {targeting.languages?.map((lang, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold">
                                                {lang}
                                                <button onClick={() => removeFromList(targeting.languages, i, 'languages')} className="hover:text-emerald-900 dark:hover:text-emerald-100"><span className="material-symbols-outlined text-[12px]">close</span></button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em] mb-6">Placements</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {PLACEMENTS.map(placement => {
                                    const selected = (targeting.placements || []).includes(placement.id);
                                    return (
                                        <button
                                            key={placement.id}
                                            onClick={() => togglePlacement(placement.id)}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${selected
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-emerald-300'
                                                }`}
                                        >
                                            <div className={`mb-2 size-8 rounded-lg flex items-center justify-center ${selected ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                <span className="material-symbols-outlined text-[18px]">{placement.icon}</span>
                                            </div>
                                            <span className={`text-[10px] font-black uppercase tracking-wider block ${selected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                                                {placement.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
