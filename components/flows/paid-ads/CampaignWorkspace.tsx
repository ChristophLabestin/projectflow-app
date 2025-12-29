import React, { useState } from 'react';
import { Idea } from '../../../types';
import { usePaidAdsData } from '../../../hooks/usePaidAdsData';
import { AnimatePresence, motion } from 'framer-motion';

// Modules
import { IntelligenceModule } from './modules/IntelligenceModule';
import { CreativeCanvas } from './modules/CreativeCanvas';
import { WarRoomModule } from './modules/WarRoomModule';
import { LaunchPad } from './modules/LaunchPad';

interface CampaignWorkspaceProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

type CampaignModule = 'intelligence' | 'creative' | 'war-room' | 'launch';

export const CampaignWorkspace: React.FC<CampaignWorkspaceProps> = ({ idea, onUpdate }) => {
    const { adData, updateAdData, createCampaign } = usePaidAdsData(idea, onUpdate);
    const [currentModule, setCurrentModule] = useState<CampaignModule>('intelligence');

    // Navigation handlers
    const goToCreative = () => setCurrentModule('creative');
    const goToWarRoom = () => setCurrentModule('war-room');
    const goToLaunch = () => setCurrentModule('launch');
    const goBack = () => {
        if (currentModule === 'launch') setCurrentModule('war-room');
        else if (currentModule === 'war-room') setCurrentModule('creative');
        else if (currentModule === 'creative') setCurrentModule('intelligence');
    };

    // Animation variants for smooth module transitions
    const variants = {
        enter: { opacity: 0, x: 20 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Command Header */}
            <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-lg">campaign</span>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            {idea.title}
                        </h1>
                        <div className="flex gap-2 text-[10px] text-slate-500 font-medium">
                            <span>Cmd Center</span>
                            <span>•</span>
                            <span className="text-emerald-500">Active</span>
                        </div>
                    </div>
                </div>

                {/* Module Navigator */}
                <nav className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    {(['intelligence', 'creative', 'war-room', 'launch'] as CampaignModule[]).map((mod) => (
                        <button
                            key={mod}
                            onClick={() => setCurrentModule(mod)}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${currentModule === mod
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                        >
                            {mod.replace('-', ' ')}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Main Workspace Area */}
            <main className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentModule}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="h-full w-full"
                    >
                        {currentModule === 'intelligence' && (
                            <IntelligenceModule
                                adData={adData}
                                updateAdData={updateAdData}
                                onNext={goToCreative}
                            />
                        )}
                        {currentModule === 'creative' && (
                            <CreativeCanvas
                                adData={adData}
                                updateAdData={updateAdData}
                                onNext={goToWarRoom}
                                onBack={goBack}
                            />
                        )}
                        {currentModule === 'war-room' && (
                            <WarRoomModule
                                adData={adData}
                                updateAdData={updateAdData}
                                onNext={goToLaunch}
                                onBack={goBack}
                            />
                        )}
                        {currentModule === 'launch' && (
                            <LaunchPad
                                adData={adData}
                                updateAdData={updateAdData}
                                onBack={goBack}
                                onLaunch={(projectId) => createCampaign(projectId)}
                                idea={idea}
                            />
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
};
