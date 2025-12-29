import React, { useState } from 'react';
import { AdData } from '../../../../types';
import { motion } from 'framer-motion';

interface ModuleProps {
    adData: Partial<AdData>;
    updateAdData: (updates: Partial<AdData>) => void;
    onNext: () => void;
}

export const IntelligenceModule: React.FC<ModuleProps> = ({ adData, updateAdData, onNext }) => {
    const [url, setUrl] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);

    // Simulated Intelligence Data
    const [strategy, setStrategy] = useState<{
        hooks: string[];
        tone: string;
        audience: string[];
    } | null>(null);

    const handleScan = () => {
        setIsScanning(true);
        // Simulate AI Latency
        setTimeout(() => {
            setIsScanning(false);
            setScanComplete(true);
            setStrategy({
                hooks: [
                    "Stop wasting time on X.",
                    "The secret to Y is finally here.",
                    "Why top experts are switching to Z."
                ],
                tone: "Professional yet Urgent",
                audience: ["Marketing Managers", "Growth Hackers", "agency Owners"]
            });

            // Auto-populate adData
            updateAdData({
                missionStatement: "Empower professionals to achieve X with Y.",
                competitors: "Competitor A, Competitor B",
                targeting: {
                    ...adData.targeting,
                    interests: ["Marketing", "Growth Hacking"],
                    locations: ["United States", "United Kingdom", "Canada", "Australia"],
                    ageMin: 25,
                    ageMax: 45,
                    genders: ['All']
                },
                creative: {
                    ...adData.creative,
                    primaryText: "Stop wasting time on manual tasks. Our tool automates the heavy lifting so you can focus on strategy.",
                    headline1: "The Future of productivity is Here",
                    cta: "Learn More"
                }
            });
        }, 2000);
    };

    return (
        <div className="h-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
            <div className="w-full max-w-4xl">

                {/* Initial Input State */}
                {!scanComplete && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <div className="mb-8">
                            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">
                                Where are we sending traffic?
                            </h1>
                            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                                Paste your landing page URL. We'll extract your brand voice, assets, and value propositions automatically.
                            </p>
                        </div>

                        <div className="relative max-w-2xl mx-auto">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400">link</span>
                            </div>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://your-website.com/landing-page"
                                className="w-full pl-12 pr-32 py-5 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl text-lg font-medium shadow-xl focus:border-emerald-500 focus:ring-0 transition-all outline-none"
                            />
                            <div className="absolute inset-y-2 right-2">
                                <button
                                    onClick={handleScan}
                                    disabled={isScanning || !url}
                                    className={`h-full px-6 rounded-xl font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-2 ${isScanning
                                            ? 'bg-slate-100 text-slate-400 cursor-wait'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg hover:shadow-emerald-500/30'
                                        }`}
                                >
                                    {isScanning ? (
                                        <>
                                            <span className="animate-spin material-symbols-outlined text-lg">autorenew</span>
                                            Scanning...
                                        </>
                                    ) : (
                                        <>
                                            Analyze
                                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Quick Start Options */}
                        <div className="mt-8 flex gap-3 justify-center text-sm text-slate-400 font-medium">
                            <button onClick={() => setUrl('https://example.com')} className="hover:text-emerald-500 transition-colors">
                                Try Example URL
                            </button>
                            <span>•</span>
                            <button onClick={onNext} className="hover:text-emerald-500 transition-colors">
                                Skip Intelligence
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Results State */}
                {scanComplete && strategy && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8"
                    >
                        {/* Summary Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-10">
                                <span className="material-symbols-outlined text-[120px]">psychology</span>
                            </div>

                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                                <span className="size-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center material-symbols-outlined text-xl">
                                    auto_awesome
                                </span>
                                Strategy Extracted
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Target Audience</div>
                                    <div className="flex flex-wrap gap-2">
                                        {strategy.audience.map(a => (
                                            <span key={a} className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Found Hooks</div>
                                    <ul className="space-y-2">
                                        {strategy.hooks.map((hook, i) => (
                                            <li key={i} className="flex gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                                                <span className="text-emerald-500 font-black">{i + 1}.</span>
                                                {hook}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Tone of Voice</div>
                                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                                        "{strategy.tone}"
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Card */}
                        <div className="flex flex-col justify-center space-y-6 p-4">
                            <div>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
                                    We've built a starter campaign.
                                </h3>
                                <p className="text-lg text-slate-500 dark:text-slate-400">
                                    Based on your landing page, we've pre-filled the targeting and draft creative. You can refine everything in the next steps.
                                </p>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button
                                    onClick={() => setScanComplete(false)}
                                    className="px-6 py-4 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Scan Again
                                </button>
                                <button
                                    onClick={onNext}
                                    className="flex-1 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                >
                                    Enter Creative Studio
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
};
