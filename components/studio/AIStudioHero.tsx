import React from 'react';

export const AIStudioHero = () => {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-ink p-8 md:p-12 mb-10 border border-white/5">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-bold uppercase tracking-wider mb-6">
                    <span className="material-symbols-outlined text-[14px] text-indigo-400">auto_awesome</span>
                    ProjectFlow AI Studio
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
                    From Spark to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-white to-indigo-400 animate-gradient-xy">Blueprint</span>.
                </h1>

                <p className="text-white/60 text-lg md:text-xl leading-relaxed mb-0">
                    Harness the power of Gemini 2.0 to architect projects, map out risks, and brainstorm breakthrough ideas in seconds.
                </p>
            </div>

            {/* Floating icon deco */}
            <div className="hidden lg:block absolute right-12 top-1/2 -translate-y-1/2 opacity-20">
                <span className="material-symbols-outlined text-[180px] text-white select-none">architecture</span>
            </div>
        </div>
    );
};
