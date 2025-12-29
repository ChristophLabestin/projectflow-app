import React, { useState } from 'react';
import { AdData, Idea } from '../../../../types';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface ModuleProps {
    adData: Partial<AdData>;
    updateAdData: (updates: Partial<AdData>) => void;
    onBack: () => void;
    onLaunch: (projectId: string) => Promise<string>;
    idea: Idea;
}

export const LaunchPad: React.FC<ModuleProps> = ({ adData, onBack, onLaunch, idea }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const [isLaunching, setIsLaunching] = useState(false);
    const [campaignId, setCampaignId] = useState<string | null>(idea.convertedCampaignId || null);
    const [error, setError] = useState<string | null>(null);

    const handleIgnite = async () => {
        if (!projectId) return;
        setIsLaunching(true);
        setError(null);
        try {
            const id = await onLaunch(projectId);
            setCampaignId(id);
        } catch (e) {
            console.error(e);
            setError("Mission Abort! Failed to create campaign.");
        } finally {
            setIsLaunching(false);
        }
    };

    if (campaignId) {
        return (
            <div className="h-full flex items-center justify-center p-6 bg-slate-900 overflow-hidden relative">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/20 to-transparent pointer-events-none" />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative z-10 text-center max-w-2xl"
                >
                    <div className="size-32 mx-auto bg-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(16,185,129,0.5)] animate-bounce-slow">
                        <span className="material-symbols-outlined text-6xl text-white">rocket_launch</span>
                    </div>

                    <h2 className="text-5xl font-black text-white mb-6 tracking-tight">Liftoff Confirmed!</h2>
                    <p className="text-xl text-slate-300 mb-10 leading-relaxed">
                        Your campaign <span className="text-white font-bold">{idea.title}</span> is now fully operational.
                    </p>

                    <div className="flex justify-center gap-4">
                        <Link
                            to={`/project/${projectId}/marketing/ads/${campaignId}`}
                            className="px-8 py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-transform flex items-center gap-3"
                        >
                            Open Mission Control
                            <span className="material-symbols-outlined">analytics</span>
                        </Link>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full my-auto">
                <div className="text-center mb-12">
                    <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">Final Pre-Flight Check</h2>
                    <p className="text-lg text-slate-500 dark:text-slate-400">Review your campaign manifest before ignition.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    {/* Strategy Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                        <div className="flex items-center gap-3 mb-4 text-violet-500">
                            <span className="material-symbols-outlined">psychology</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Strategy</span>
                        </div>
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-500">Objective</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">{adData.objective || 'Traffic'}</div>
                        </div>
                    </div>

                    {/* Creative Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                        <div className="flex items-center gap-3 mb-4 text-fuchsia-500">
                            <span className="material-symbols-outlined">palette</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Creative</span>
                        </div>
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-500">Headline</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white truncate" title={adData.creative?.headline1}>{adData.creative?.headline1 || 'N/A'}</div>
                        </div>
                    </div>

                    {/* Budget Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                        <div className="flex items-center gap-3 mb-4 text-emerald-500">
                            <span className="material-symbols-outlined">payments</span>
                            <span className="text-xs font-bold uppercase tracking-widest">Budget</span>
                        </div>
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-slate-500">Daily Spend</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">${adData.budget?.amount || 0}</div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-50 text-red-600 rounded-xl text-center font-bold">
                        {error}
                    </div>
                )}

                <div className="flex justify-center gap-6">
                    <button
                        onClick={onBack}
                        className="px-8 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                    >
                        Review Parameters
                    </button>
                    <button
                        onClick={handleIgnite}
                        disabled={isLaunching}
                        className="px-12 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl font-black text-xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLaunching ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">sync</span>
                                Initiating...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">rocket_launch</span>
                                Ignite Campaign
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
