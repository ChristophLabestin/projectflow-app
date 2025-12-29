import React, { useState } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateAdCopy } from '../../../services/geminiService';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';

interface PaidAdsCreativeViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

const CTA_OPTIONS = [
    'Learn More', 'Shop Now', 'Sign Up', 'Get Started',
    'Download', 'Contact Us', 'Book Now', 'Apply Now',
];

export const PaidAdsCreativeView: React.FC<PaidAdsCreativeViewProps> = ({ idea, onUpdate }) => {
    const { adData, updateCreative } = usePaidAdsData(idea, onUpdate);
    const [isGenerating, setIsGenerating] = useState(false);
    const creative = adData.creative || {};

    const handleGenerateCopy = async () => {
        setIsGenerating(true);
        try {
            const objective = adData.objective?.toString() || 'General';

            const copy = await generateAdCopy(idea.title, objective, 'Social Media', idea.description || adData.missionStatement || '');

            if (copy) {
                // Randomly pick one from the suggestions or just take the first one
                const newHeadline = copy.headlines && copy.headlines.length > 0 ? copy.headlines[0] : '';
                const newPrimaryText = copy.primaryText && copy.primaryText.length > 0 ? copy.primaryText[0] : '';

                const updates: any = {};
                if (newHeadline) updates.headline1 = newHeadline;
                if (newPrimaryText) updates.primaryText = newPrimaryText;

                // Add others as variations
                const newVariations = [...(creative.variations || [])];
                if (copy.headlines && copy.headlines.length > 1) {
                    newVariations.push(...copy.headlines.slice(1));
                }
                updates.variations = [...new Set(newVariations)];

                updateCreative(updates);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const [variationInput, setVariationInput] = useState('');

    const addVariation = () => {
        if (variationInput.trim()) {
            updateCreative({ variations: [...(creative.variations || []), variationInput.trim()] });
            setVariationInput('');
        }
    };

    const removeVariation = (index: number) => {
        if (!creative.variations) return;
        updateCreative({ variations: creative.variations.filter((_, i) => i !== index) });
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-6 pt-6 px-6 pb-20">
                {/* Header */}
                <div className="bg-gradient-to-br from-fuchsia-100 via-pink-50 to-white dark:from-fuchsia-900/30 dark:via-pink-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-fuchsia-200 dark:border-fuchsia-800/50 relative overflow-hidden shadow-xl shadow-fuchsia-100 dark:shadow-none flex items-center justify-between">
                    <div className="relative z-10 flex flex-col justify-center h-full">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="px-3 py-1 bg-fuchsia-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-fuchsia-200 dark:shadow-none">
                                CREATIVE STUDIO
                            </div>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            Ad Creative Design
                        </h1>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-fuchsia-100/50 to-transparent dark:from-fuchsia-900/20" />
                    <span className="material-symbols-outlined absolute right-10 -bottom-10 text-[180px] text-fuchsia-500/10 rotate-12">palette</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Creative Setup (7/12) */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Ad Copy</h3>
                                <button
                                    onClick={handleGenerateCopy}
                                    disabled={isGenerating}
                                    className="text-[10px] font-bold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 flex items-center gap-1 bg-fuchsia-50 dark:bg-fuchsia-900/20 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${isGenerating ? 'animate-spin' : ''}`}>
                                        {isGenerating ? 'sync' : 'auto_awesome'}
                                    </span>
                                    {isGenerating ? 'Writing...' : 'Generate New Copy'}
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-fuchsia-600 uppercase tracking-[.25em] mb-2 block opacity-80">Headline 1</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={creative.headline1 || ''}
                                                onChange={(e) => updateCreative({ headline1: e.target.value })}
                                                placeholder="Catchy hook..."
                                                maxLength={30}
                                                className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-fuchsia-500 outline-none"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{(creative.headline1 || '').length}/30</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-fuchsia-600 uppercase tracking-[.25em] mb-2 block opacity-80">Headline 2</label>
                                        <input
                                            type="text"
                                            value={creative.headline2 || ''}
                                            onChange={(e) => updateCreative({ headline2: e.target.value })}
                                            placeholder="Supporting point..."
                                            maxLength={30}
                                            className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-fuchsia-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-fuchsia-600 uppercase tracking-[.25em] mb-2 block opacity-80">Primary Text</label>
                                    <textarea
                                        value={creative.primaryText || ''}
                                        onChange={(e) => updateCreative({ primaryText: e.target.value })}
                                        placeholder="The main body text of your ad..."
                                        className="w-full h-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-fuchsia-500 resize-none leading-relaxed"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[9px] font-black text-fuchsia-600 uppercase tracking-[.25em] mb-2 block opacity-80">Link Description</label>
                                        <input
                                            type="text"
                                            value={creative.description || ''}
                                            onChange={(e) => updateCreative({ description: e.target.value })}
                                            placeholder="Small text under headline..."
                                            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-fuchsia-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-fuchsia-600 uppercase tracking-[.25em] mb-2 block opacity-80">Call to Action</label>
                                        <select
                                            value={creative.cta || 'Learn More'}
                                            onChange={(e) => updateCreative({ cta: e.target.value })}
                                            className="w-full text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-1 focus:ring-fuchsia-500 outline-none appearance-none"
                                        >
                                            {CTA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[11px] tracking-[.25em]">Visual Direction</h3>
                                <button className="text-[10px] font-black text-fuchsia-600 uppercase tracking-widest flex items-center gap-1 hover:underline">
                                    <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                                    Attach Reference
                                </button>
                            </div>
                            <textarea
                                value={creative.visualConcept || ''}
                                onChange={(e) => updateCreative({ visualConcept: e.target.value })}
                                placeholder="Describe the image or video style, colors, and mood..."
                                className="w-full h-24 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-fuchsia-500 resize-none leading-relaxed"
                            />
                        </div>
                    </div>

                    {/* Right Column: Preview & Iteration (5/12) */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col min-h-[500px]">
                            <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                                <span className="material-symbols-outlined text-[150px] text-white -mr-10 -mt-10">visibility</span>
                            </div>

                            <div className="relative z-10">
                                <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em] mb-6">Live Preview</h3>

                                {/* Ad Mockup Card */}
                                <div className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-[320px] mx-auto mb-8 transform hover:scale-105 transition-transform duration-500">
                                    <div className="p-3 flex items-center gap-2 border-b border-slate-100">
                                        <div className="size-8 rounded-full bg-slate-200 animate-pulse" />
                                        <div className="flex-1 space-y-1">
                                            <div className="h-2 w-20 bg-slate-200 rounded animate-pulse" />
                                            <div className="h-1.5 w-12 bg-slate-100 rounded animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="aspect-square bg-slate-100 flex items-center justify-center text-slate-300">
                                        {creative.visualConcept ? (
                                            <span className="text-xs p-4 text-center font-medium">{creative.visualConcept}</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-4xl">image</span>
                                        )}
                                    </div>
                                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                                        <div className="flex-1 mr-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{creative.headline1 || 'Headline'}</div>
                                            <div className="text-[11px] font-black text-slate-800 leading-tight line-clamp-1">{creative.headline1 || 'Your Ad Headline'}</div>
                                        </div>
                                        <button className="px-3 py-1 bg-slate-200 text-[10px] font-black text-slate-600 rounded uppercase">{creative.cta || 'Learn More'}</button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-black text-white uppercase text-[11px] tracking-[.25em] opacity-80">A/B Experiments</h3>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={variationInput}
                                            onChange={(e) => setVariationInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addVariation()}
                                            placeholder="Add variation..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-fuchsia-500"
                                        />
                                        <button
                                            onClick={addVariation}
                                            className="px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold"
                                        >
                                            <span className="material-symbols-outlined text-sm">add</span>
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                        {creative.variations?.map((variation, index) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[9px] font-black text-fuchsia-400 border border-fuchsia-500/30 px-1.5 py-0.5 rounded">V{index + 1}</span>
                                                    <span className="text-xs text-slate-300 leading-tight">{variation}</span>
                                                </div>
                                                <button onClick={() => removeVariation(index)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                className="w-full h-14 rounded-2xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-fuchsia-500/20 flex items-center justify-between px-6 group/btn border-none"
                                onClick={() => onUpdate({ stage: 'Targeting' })}
                            >
                                <span>Next Step</span>
                                <div className="flex items-center gap-2 group-hover/btn:translate-x-1 transition-transform">
                                    <span>Targeting</span>
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
