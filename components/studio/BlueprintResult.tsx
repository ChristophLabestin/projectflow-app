import React from 'react';
import { ProjectBlueprint } from '../../types';

interface BlueprintResultProps {
    blueprint: ProjectBlueprint;
    onConvert: (blueprint: ProjectBlueprint) => void;
    isConverting: boolean;
}

export const BlueprintResult: React.FC<BlueprintResultProps> = ({
    blueprint, onConvert, isConverting
}) => {
    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Project Concept</span>
                    <h2 className="text-3xl font-display font-bold text-ink dark:text-white">{blueprint.title}</h2>
                </div>
                <button
                    onClick={() => onConvert(blueprint)}
                    disabled={isConverting}
                    className="btn-primary px-8 py-3 rounded-xl flex items-center justify-center gap-2 group whitespace-nowrap"
                >
                    <span className={`material-symbols-outlined transition-transform ${isConverting ? 'animate-spin' : 'group-hover:translate-x-1'}`}>
                        {isConverting ? 'autorenew' : 'rocket_launch'}
                    </span>
                    <span>{isConverting ? 'Launching...' : 'Convert to Live Project'}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Description & Audience */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="app-panel p-6 space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500">description</span>
                            Strategic Vision
                        </h3>
                        <p className="text-muted leading-relaxed">{blueprint.description}</p>

                        <div className="pt-4 border-t border-line dark:border-white/5">
                            <h4 className="text-sm font-bold text-ink/60 dark:text-white/60 mb-2 uppercase tracking-tight">Target Audience</h4>
                            <p className="text-sm text-muted">{blueprint.targetAudience}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-indigo-500">flag</span>
                            Milestones
                        </h3>
                        <div className="space-y-4">
                            {blueprint.milestones.map((ms, idx) => (
                                <div key={idx} className="relative pl-8 pb-4 last:pb-0 border-l-2 border-indigo-100 dark:border-indigo-900/30 ml-3">
                                    <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white dark:border-zinc-900 shadow-sm"></div>
                                    <h4 className="font-bold text-ink dark:text-white">{ms.title}</h4>
                                    <p className="text-sm text-muted">{ms.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Tasks & Tech */}
                <div className="space-y-8">
                    <div className="app-panel p-6 space-y-4 bg-zinc-50 dark:bg-white/5 border-dashed">
                        <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-ink/40 dark:text-white/40">
                            Build Backlog
                        </h4>
                        <div className="space-y-3">
                            {blueprint.initialTasks.map((task, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-zinc-800 border border-line dark:border-white/5 shadow-sm">
                                    <span className={`w-2 h-2 rounded-full ${task.priority === 'High' ? 'bg-rose-500' :
                                            task.priority === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}></span>
                                    <span className="text-xs font-medium text-ink dark:text-white flex-1">{task.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {blueprint.suggestedTechStack && (
                        <div className="app-panel p-6 space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-ink/40 dark:text-white/40">Suggested Stack</h4>
                            <div className="flex flex-wrap gap-2">
                                {blueprint.suggestedTechStack.map((tech, idx) => (
                                    <span key={idx} className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-100 dark:border-indigo-900/30">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
