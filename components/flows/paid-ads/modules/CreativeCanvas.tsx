import React, { useState } from 'react';
import { AdData } from '../../../../types';
import { motion } from 'framer-motion';

interface ModuleProps {
    adData: Partial<AdData>;
    updateAdData: (updates: Partial<AdData>) => void;
    onNext: () => void;
    onBack: () => void;
}

export const CreativeCanvas: React.FC<ModuleProps> = ({ adData, updateAdData, onNext, onBack }) => {
    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile');
    const [activeTab, setActiveTab] = useState<'edit' | 'library'>('edit');

    const updateCreative = (field: string, value: any) => {
        updateAdData({
            creative: {
                ...adData.creative,
                [field]: value
            }
        } as Partial<AdData>);
    };

    // Simulated AI Generator
    const generateVariant = (field: 'headline1' | 'primaryText') => {
        const variants = {
            headline1: [
                "Boost ROI by 300% Today",
                "The #1 Tool for Modern Teams",
                "Stop Guessing, Start Growing"
            ],
            primaryText: [
                "Join 50,000+ professionals using our platform to scale faster.",
                "Don't let manual tasks slow you down. Automate everything.",
                "See why industry leaders trust us for their mission-critical workflows."
            ]
        };
        const random = variants[field][Math.floor(Math.random() * variants[field].length)];
        updateCreative(field, random);
    };

    return (
        <div className="h-full flex overflow-hidden">
            {/* LEFT PANE: Editors */}
            <div className="w-1/2 h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-xl">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Creative Studio</h2>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'edit' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-400'}`}
                        >
                            Editor
                        </button>
                        <button
                            onClick={() => setActiveTab('library')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'library' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-white' : 'text-slate-400'}`}
                        >
                            Library
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Primary Text */}
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Primary Text</label>
                            <button onClick={() => generateVariant('primaryText')} className="text-xs font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                AI Variant
                            </button>
                        </div>
                        <textarea
                            value={adData.creative?.primaryText || ''}
                            onChange={(e) => updateCreative('primaryText', e.target.value)}
                            className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 resize-none transition-shadow"
                            placeholder="What is the main value prop?"
                        />
                    </div>

                    {/* Headline */}
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Headline</label>
                            <button onClick={() => generateVariant('headline1')} className="text-xs font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                AI Variant
                            </button>
                        </div>
                        <input
                            type="text"
                            value={adData.creative?.headline1 || ''}
                            onChange={(e) => updateCreative('headline1', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="Catchy Headline"
                        />
                    </div>

                    {/* Media Upload (Mock) */}
                    <div className="space-y-3">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Visual Asset</label>
                        <div className="h-40 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all cursor-pointer group">
                            <span className="material-symbols-outlined text-4xl mb-2 group-hover:text-emerald-500 transition-colors">add_photo_alternate</span>
                            <span className="text-xs font-bold">Drop Image or Video</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between bg-white dark:bg-slate-900">
                    <button onClick={onBack} className="px-6 py-3 font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        Back
                    </button>
                    <button onClick={onNext} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:transform hover:translate-y-[-2px] transition-all">
                        Targeting & Budget
                    </button>
                </div>
            </div>

            {/* RIGHT PANE: Preview */}
            <div className="w-1/2 h-full bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-40 mix-blend-overlay pointer-events-none" />

                {/* Device Toggle */}
                <div className="mb-8 flex bg-white/50 backdrop-blur-md rounded-full p-1 border border-white/20 shadow-sm relative z-10">
                    <button
                        onClick={() => setPreviewDevice('mobile')}
                        className={`size-10 rounded-full flex items-center justify-center transition-all ${previewDevice === 'mobile' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined text-sm">phone_iphone</span>
                    </button>
                    <button
                        onClick={() => setPreviewDevice('desktop')}
                        className={`size-10 rounded-full flex items-center justify-center transition-all ${previewDevice === 'desktop' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                    >
                        <span className="material-symbols-outlined text-sm">desktop_mac</span>
                    </button>
                </div>

                {/* Simulated Ad Preview (Instagram Style) */}
                <motion.div
                    layout
                    className={`bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-500 border border-slate-200 ${previewDevice === 'mobile' ? 'w-[375px] h-[667px]' : 'w-[800px] h-[500px]'}`}
                >
                    {/* Ad Header */}
                    <div className="p-4 flex items-center justify-between border-b border-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-slate-200" />
                            <div>
                                <div className="text-sm font-bold text-slate-900">Your Brand</div>
                                <div className="text-[10px] text-slate-400">Sponsored</div>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-slate-400">more_horiz</span>
                    </div>

                    {/* Ad Visual */}
                    <div className="flex-1 bg-slate-100 flex items-center justify-center relative overflow-hidden group">
                        <span className="material-symbols-outlined text-6xl text-slate-300">image</span>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                            <button className="w-full py-3 bg-white text-slate-900 font-bold rounded-lg shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform">
                                {adData.creative?.cta || 'Learn More'}
                            </button>
                        </div>
                    </div>

                    {/* Ad Footer / Copy */}
                    <div className="p-4 bg-white space-y-2">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-slate-900 text-lg leading-tight">
                                {adData.creative?.headline1 || 'Your Headline Here'}
                            </h3>
                            <button className="bg-slate-100 text-slate-900 px-4 py-1.5 rounded-md text-xs font-bold hover:bg-slate-200 transition-colors">
                                {adData.creative?.cta || 'Learn More'}
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                            {adData.creative?.primaryText || 'Your primary text will appear here. It should be compelling and describe the value proposition clearly.'}
                        </p>
                    </div>
                </motion.div>

                <div className="mt-6 text-xs font-medium text-slate-400 flex gap-4">
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500"></span> Live Preview</span>
                    <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500"></span> AI Insights Active</span>
                </div>
            </div>
        </div>
    );
};
