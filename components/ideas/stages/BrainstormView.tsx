import React, { useState, useEffect, useRef } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { generateKeywordsAI } from '../../../services/geminiService';

interface BrainstormViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const BrainstormView: React.FC<BrainstormViewProps> = ({ idea, onUpdate }) => {
    const [keywordInput, setKeywordInput] = useState('');
    const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);

    // Animation refs for the "breathing" effect
    const frameRef = useRef<number>();
    const [time, setTime] = useState(0);

    // LocalStorage key based on idea ID
    const storageKey = `brainstorm_suggestions_${idea.id}`;
    const dismissedKey = `brainstorm_dismissed_${idea.id}`;

    // Load cached suggestions and dismissed list on mount
    useEffect(() => {
        if (!idea.id) return;
        try {
            const cached = localStorage.getItem(storageKey);
            const dismissed = localStorage.getItem(dismissedKey);
            if (cached) setSuggestions(JSON.parse(cached));
            // Prefer Firestore data, fallback to localStorage
            if (idea.dismissedSuggestions?.length) {
                setDismissedSuggestions(idea.dismissedSuggestions);
            } else if (dismissed) {
                setDismissedSuggestions(JSON.parse(dismissed));
            }
        } catch (e) {
            console.warn('Failed to load cached suggestions', e);
        }
    }, [idea.id]);

    // Save suggestions to localStorage whenever they change
    useEffect(() => {
        if (!idea.id) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(suggestions));
        } catch (e) {
            console.warn('Failed to cache suggestions', e);
        }
    }, [suggestions, idea.id]);

    // Save dismissed suggestions to localStorage whenever they change
    useEffect(() => {
        if (!idea.id) return;
        try {
            localStorage.setItem(dismissedKey, JSON.stringify(dismissedSuggestions));
        } catch (e) {
            console.warn('Failed to cache dismissed suggestions', e);
        }
    }, [dismissedSuggestions, idea.id]);

    // Initial keywords if not present
    useEffect(() => {
        if (!idea.keywords) {
            onUpdate({ keywords: [] });
        }
    }, []);

    useEffect(() => {
        const animate = () => {
            setTime(t => t + 0.005);
            frameRef.current = requestAnimationFrame(animate);
        };
        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current!);
    }, []);

    const handleAddKeyword = (word: string) => {
        if (!word.trim()) return;
        const currentKeywords = idea.keywords || [];
        if (!currentKeywords.includes(word.trim())) {
            onUpdate({ keywords: [...currentKeywords, word.trim()] });
        }
        setKeywordInput('');
        // Remove from suggestions if added
        setSuggestions(prev => prev.filter(s => s !== word));
    };

    const handleDismissSuggestion = (word: string) => {
        setSuggestions(prev => prev.filter(s => s !== word));
        const newDismissed = [...dismissedSuggestions, word];
        setDismissedSuggestions(newDismissed);
        onUpdate({ dismissedSuggestions: newDismissed });
    };

    const removeKeyword = (keyword: string) => {
        const currentKeywords = idea.keywords || [];
        onUpdate({ keywords: currentKeywords.filter(k => k !== keyword) });
    };

    const handleGenerateKeywords = async () => {
        if (!idea.title) return;
        setSuggesting(true);
        try {
            // Combine existing keywords + current suggestions + dismissed to exclude
            const excludeList = [...(idea.keywords || []), ...suggestions, ...dismissedSuggestions];
            const results = await generateKeywordsAI(idea, excludeList);
            // Append new results to existing suggestions instead of replacing
            setSuggestions(prev => [...prev, ...results.filter(r => !prev.includes(r))]);
        } catch (e) {
            console.error(e);
        } finally {
            setSuggesting(false);
        }
    };

    // Calculate positions for circular layout with some floaty movement
    const getKeywordPosition = (index: number, total: number) => {
        if (total === 0) return { x: 0, y: 0 };
        // Minimum radius to avoid overlapping with center node (center is ~100px radius)
        const radiusBase = 220;

        // Add subtle movement based on time
        const floatX = Math.sin(time + index) * 8;
        const floatY = Math.cos(time + index * 1.5) * 8;

        // Distribute evenly around the circle
        const distributedAngle = (index / total) * 2 * Math.PI + time * 0.02;

        return {
            x: Math.cos(distributedAngle) * radiusBase + floatX,
            y: Math.sin(distributedAngle) * radiusBase + floatY
        };
    };

    const keywords = idea.keywords || [];

    const missionText = (
        <div className="text-sm md:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
            "We are exploring <span className="text-rose-500 font-black">Creative Concepts</span>
            {' '}for <span className="text-rose-500 font-black">{idea.title || 'Untitled Idea'}</span>
            {' '}expand by <span className="text-rose-500 font-black">{keywords.length} Core Keywords</span>
            {' '}and associations to unlock <span className="text-rose-500 font-black">
                Insightful Angles
            </span>."
        </div>
    );

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto flex flex-col gap-4 pt-6 px-6">
                {/* Campaign Mission Hero */}
                <div className="bg-gradient-to-br from-rose-100 via-pink-50 to-white dark:from-rose-900/30 dark:via-pink-900/10 dark:to-slate-900/50 rounded-3xl p-6 md:p-8 border border-rose-200 dark:border-rose-800/50 relative overflow-hidden shadow-xl shadow-rose-100 dark:shadow-none">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none select-none">
                        <span className="material-symbols-outlined text-[200px] text-rose-600 rotate-12 -translate-y-10 translate-x-10">lightbulb</span>
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-md shadow-rose-200 dark:shadow-none">
                                    Brainstorming
                                </div>
                                <div className="h-[1px] w-8 bg-rose-200 dark:bg-rose-800 rounded-full" />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                Creative Mind Map
                            </h1>
                        </div>
                        <div className="max-w-3xl p-5 bg-white/70 dark:bg-slate-950/50 rounded-2xl border border-white dark:border-slate-800 shadow-lg shadow-rose-100/50 dark:shadow-none backdrop-blur-md">
                            {missionText}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10">
                    {/* Column: Foundations (Controls) */}
                    <div className="lg:col-span-4 space-y-5">
                        {/* Core Concept Input */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest mb-4 opacity-50">Core Concept</h3>
                            <div className="relative">
                                <input
                                    value={idea.title}
                                    onChange={(e) => onUpdate({ title: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-400"
                                    placeholder="What's the big idea?"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                </div>
                            </div>
                        </div>

                        {/* Keyword Input & Suggestions */}
                        <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-slate-900 dark:text-white uppercase text-[10px] tracking-widest opacity-50">Associative Thinking</h3>
                                <button
                                    onClick={handleGenerateKeywords}
                                    disabled={suggesting}
                                    className="text-[9px] font-black text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-900/20 px-2.5 py-1.5 rounded-full flex items-center gap-1 transition-all"
                                >
                                    <span className={`material-symbols-outlined text-[12px] ${suggesting ? 'animate-spin' : ''}`}>
                                        {suggesting ? 'progress_activity' : 'auto_awesome'}
                                    </span>
                                    AI SUGGEST
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Input */}
                                <div className="flex gap-2">
                                    <input
                                        value={keywordInput}
                                        onChange={(e) => setKeywordInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword(keywordInput)}
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-slate-400"
                                        placeholder="Add a keyword..."
                                    />
                                    <button
                                        onClick={() => handleAddKeyword(keywordInput)}
                                        className="bg-rose-600 text-white rounded-xl px-3 flex items-center justify-center hover:bg-rose-700 transition-colors shadow-md shadow-rose-200 dark:shadow-none"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                    </button>
                                </div>

                                {/* Active Keywords List (Mini) */}
                                <div className="flex flex-wrap gap-1.5">
                                    {keywords.map(k => (
                                        <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                            {k}
                                            <button onClick={() => removeKeyword(k)} className="hover:text-rose-500">
                                                <span className="material-symbols-outlined text-[10px]">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    {keywords.length === 0 && (
                                        <p className="text-[10px] text-slate-400 italic">No keywords added yet.</p>
                                    )}
                                </div>

                                {/* Suggestions */}
                                {suggestions.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Suggested for you</span>
                                            <button onClick={() => setSuggestions([])} className="text-[9px] text-slate-400 hover:text-slate-600 underline decoration-dotted">Clear</button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleAddKeyword(s)}
                                                    className="group flex items-center gap-1.5 pl-2 pr-1.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg border border-rose-100 dark:border-rose-900/30 transition-all text-left"
                                                >
                                                    {s}
                                                    <div className="size-4 hover:bg-rose-200 dark:hover:bg-rose-800/50 rounded flex items-center justify-center text-rose-400 hover:text-rose-700 transition-colors"
                                                        onClick={(e) => { e.stopPropagation(); handleDismissSuggestion(s); }}
                                                    >
                                                        <span className="material-symbols-outlined text-[10px]">close</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Column: Visualizer */}
                    <div className="lg:col-span-8 flex flex-col space-y-5">
                        <div className="flex-1 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 relative overflow-hidden shadow-sm min-h-[500px]">
                            {/* Visualizer Background */}
                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
                                style={{
                                    backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
                                    backgroundSize: '40px 40px',
                                }}
                            />

                            {/* Visualizer Content */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Center Node: Main Idea */}
                                <div className="relative z-20 size-32 md:size-40 rounded-full bg-white dark:bg-slate-900 border-4 border-rose-100 dark:border-rose-900/30 shadow-2xl shadow-rose-200/50 dark:shadow-none flex flex-col items-center justify-center p-4 text-center group transition-all duration-500 hover:scale-105 hover:border-rose-200">
                                    <div className="absolute inset-0 rounded-full border border-dashed border-rose-200 dark:border-rose-800 animate-[spin_60s_linear_infinite]" />

                                    <span className="material-symbols-outlined text-3xl md:text-4xl text-rose-500 mb-2 drop-shadow-sm group-hover:scale-110 transition-transform">lightbulb</span>
                                    <span className="font-black text-slate-800 dark:text-white text-xs md:text-sm line-clamp-2 leading-tight px-2 tracking-tight">
                                        {idea.title || 'Untitled Idea'}
                                    </span>
                                </div>

                                {/* Floating Keywords */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {keywords.map((keyword, i) => {
                                        const pos = getKeywordPosition(i, keywords.length);

                                        return (
                                            <React.Fragment key={keyword}>
                                                {/* Connection Line */}
                                                <svg className="absolute w-full h-full pointer-events-none top-0 left-0 z-0 overflow-visible">
                                                    <line
                                                        x1="50%" y1="50%"
                                                        x2={`calc(50% + ${pos.x}px)`} y2={`calc(50% + ${pos.y}px)`}
                                                        className="stroke-slate-200 dark:stroke-slate-800"
                                                        strokeWidth="2"
                                                        strokeDasharray="4 4"
                                                    />
                                                </svg>

                                                {/* Keyword Node */}
                                                <div
                                                    className="absolute pointer-events-auto z-10"
                                                    style={{
                                                        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                                                        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                                    }}
                                                    onMouseEnter={() => setHoveredKeyword(keyword)}
                                                    onMouseLeave={() => setHoveredKeyword(null)}
                                                >
                                                    <div className={`px-4 py-2 rounded-xl backdrop-blur-md cursor-pointer transition-all duration-300 flex items-center gap-2 border shadow-sm group
                                                        ${hoveredKeyword === keyword
                                                            ? 'bg-rose-600 border-rose-600 text-white scale-110 z-20 shadow-xl shadow-rose-200 dark:shadow-none'
                                                            : 'bg-white/90 dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-400'
                                                        }`}
                                                    >
                                                        <span className="text-xs font-bold whitespace-nowrap max-w-[120px] truncate tracking-tight">{keyword}</span>
                                                        {hoveredKeyword === keyword && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); removeKeyword(keyword); }}
                                                                className="size-4 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
                                                            >
                                                                <span className="material-symbols-outlined text-[10px]">close</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="pt-2 flex justify-end">
                            <Button
                                className="h-14 px-10 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-[.2em] shadow-xl shadow-rose-200 dark:shadow-none hover:scale-105 active:scale-95 transition-all flex items-center gap-4 group"
                                onClick={() => {
                                    const nextStage = idea.type === 'Social' ? 'Strategy' : 'Refining';
                                    onUpdate({ stage: nextStage });
                                }}
                            >
                                Advance to {idea.type === 'Social' ? 'Strategy' : 'Refinement'}
                                <div className="size-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-2 transition-all">
                                    <span className="material-symbols-outlined text-[18px] font-black">arrow_forward</span>
                                </div>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
