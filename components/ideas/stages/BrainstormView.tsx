import React, { useState, useEffect, useRef } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
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

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left: Control Hub */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 p-4 opacity-50 pointer-events-none">
                    <span className="material-symbols-outlined text-[120px] text-[var(--color-surface-border)] rotate-12 -mr-8 -mt-8">lightbulb</span>
                </div>

                {/* Main Content Container */}
                <div className="flex flex-col h-full relative z-10">
                    {/* Title Section - Minimal & Large */}
                    <div className="mb-8">
                        <Input
                            value={idea.title}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                            className="text-3xl font-extrabold bg-transparent border-none px-0 py-2 h-auto focus:ring-0 placeholder:text-[var(--color-text-subtle)] text-[var(--color-text-main)] tracking-tight w-full"
                            placeholder="What's the big idea?"
                        />
                        <div className="h-1 w-12 bg-[var(--color-primary)] rounded-full mt-2" />
                    </div>

                    {/* Keywords Section - Clean & Functional */}
                    <div className="flex-1 flex flex-col overflow-hidden min-h-0 pr-2 pb-4">
                        <div className="flex-1 flex flex-col gap-4 min-h-0">
                            <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">label</span>
                                Core Associates
                            </label>

                            {/* Manual Input */}
                            <div className="flex gap-2 p-1 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)] focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] transition-all">
                                <span className="material-symbols-outlined text-[var(--color-text-muted)] self-center ml-2">add</span>
                                <input
                                    value={keywordInput}
                                    onChange={(e) => setKeywordInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword(keywordInput)}
                                    className="flex-1 bg-transparent border-none text-sm focus:ring-0 placeholder:text-[var(--color-text-muted)] py-2"
                                    placeholder="Add keyword..."
                                />
                            </div>

                            {/* AI Generation Button */}
                            <Button
                                onClick={handleGenerateKeywords}
                                isLoading={suggesting}
                                variant="secondary"
                                className="w-full justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                            >
                                <span className="material-symbols-outlined">auto_awesome</span>
                                <span>Generate Suggestions</span>
                            </Button>

                            {/* AI Suggestions (Contextual) */}
                            {suggestions.length > 0 && (
                                <div className="mt-2 animate-fadeIn flex flex-col flex-1 min-h-0 bg-[var(--color-surface-hover)]/30 rounded-xl p-3 border border-dashed border-[var(--color-surface-border)]">
                                    <div className="flex items-center justify-between mb-2 shrink-0">
                                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide">AI Suggestions</p>
                                        <button onClick={() => setSuggestions([])} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] underline decoration-dotted">
                                            Clear
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap content-start gap-2 overflow-y-auto flex-1 pr-1 thin-scrollbar">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleAddKeyword(s)}
                                                className="px-2.5 py-1 text-xs rounded-full border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-1 group shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-[12px] opacity-50 group-hover:opacity-100">add</span>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Action - Pinned Bottom */}
                    <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)]">
                        <Button
                            className="w-full h-12 text-base justify-between group bg-[var(--color-text-main)] text-[var(--color-surface-bg)] hover:bg-[var(--color-text-main)]/90 shadow-lg hover:shadow-xl transition-all rounded-xl"
                            onClick={() => onUpdate({ stage: 'Refining' })}
                        >
                            <span className="font-bold pl-1">Advance to Refinement</span>
                            <div className="size-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </div>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Right: Visualizer (2 Columns) */}
            <div className="col-span-1 lg:col-span-2 relative bg-[var(--color-surface-bg)] rounded-2xl border border-[var(--color-surface-border)] overflow-hidden flex items-center justify-center shadow-inner select-none">
                {/* Clean Background with Subtle Grid */}
                <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
                    style={{
                        backgroundImage: 'linear-gradient(var(--color-text-main) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-main) 1px, transparent 1px)',
                        backgroundSize: '40px 40px',
                    }}
                />

                {/* Soft Gradient Orbs */}
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px]" />

                {/* Center Node: Main Idea */}
                <div className="relative z-20 size-40 rounded-full bg-white dark:bg-slate-800 border-[6px] border-[var(--color-surface-bg)] shadow-2xl flex flex-col items-center justify-center p-4 text-center ring-1 ring-[var(--color-surface-border)]">
                    <div className="absolute inset-0 rounded-full border border-dashed border-[var(--color-text-muted)]/20 animate-spin-slow" style={{ animationDuration: '60s' }} />

                    <span className="material-symbols-outlined text-4xl text-amber-400 mb-2 drop-shadow-sm">lightbulb</span>
                    <span className="font-bold text-[var(--color-text-main)] text-sm line-clamp-2 leading-tight px-2">
                        {idea.title || 'Untitled'}
                    </span>
                </div>

                {/* Floating Keywords */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {keywords.map((keyword, i) => {
                        const pos = getKeywordPosition(i, keywords.length);
                        // Using template literals safely
                        const delay = `${i * 0.1}s`;

                        return (
                            <React.Fragment key={keyword}>
                                {/* Connection Line */}
                                <svg className="absolute w-full h-full pointer-events-none top-0 left-0 z-0 overflow-visible">
                                    <line
                                        x1="50%" y1="50%"
                                        x2={`calc(50% + ${pos.x}px)`} y2={`calc(50% + ${pos.y}px)`}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        className="text-[var(--color-surface-border)]"
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
                                    <div className={`px-3 py-1.5 rounded-full backdrop-blur-md cursor-pointer transition-all duration-300 flex items-center gap-2 border shadow-sm
                                        ${hoveredKeyword === keyword
                                            ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 scale-110 z-20'
                                            : 'bg-white/90 dark:bg-slate-800/90 border-[var(--color-surface-border)] text-[var(--color-text-main)] hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                                        }`}
                                    >
                                        <span className="text-xs font-semibold whitespace-nowrap max-w-[120px] truncate">{keyword}</span>
                                        {hoveredKeyword === keyword && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeKeyword(keyword); }}
                                                className="size-4 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-200"
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
    );
};
