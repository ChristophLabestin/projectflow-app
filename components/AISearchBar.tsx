import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchResult } from '../types';
import { searchProjectsAndTasks, answerQuestionWithContext, isQuestionQuery } from '../services/aiSearchService';
import { useIsSafari } from '../hooks/useIsSafari';
import { useHelpCenter } from '../context/HelpCenterContext';
import { helpCenterPages } from './help/helpCenterContent';
import { useLanguage } from '../context/LanguageContext';

const buildHelpResults = (query: string): SearchResult[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) return [];

    const results: SearchResult[] = [];

    const scoreText = (text: string | undefined, weight: number) => {
        if (!text) return 0;
        return text.toLowerCase().includes(normalizedQuery) ? weight : 0;
    };

    const scoreKeywords = (keywords: string[] | undefined, weight: number) => {
        if (!keywords) return 0;
        return keywords.some(keyword => keyword.toLowerCase().includes(normalizedQuery)) ? weight : 0;
    };

    helpCenterPages.forEach(page => {
        const pageScore = scoreText(page.title, 10)
            + scoreText(page.description, 6)
            + scoreKeywords(page.keywords, 4);

        if (pageScore > 0) {
            results.push({
                type: 'help_page',
                id: `help-${page.id}`,
                title: page.title,
                description: page.description,
                helpPageId: page.id,
                helpPageTitle: page.title,
                relevance: pageScore
            });
        }

        page.sections.forEach(section => {
            const sectionScore = scoreText(section.title, 10)
                + scoreText(section.summary, 6)
                + scoreText(section.content, 4)
                + scoreKeywords(section.keywords, 3);

            if (sectionScore > 0) {
                results.push({
                    type: 'help_section',
                    id: `help-${page.id}-${section.id}`,
                    title: section.title,
                    description: section.summary || section.content,
                    helpPageId: page.id,
                    helpSectionId: section.id,
                    helpPageTitle: page.title,
                    relevance: sectionScore
                });
            }
        });
    });

    return results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 12);
};

export const AISearchBar = () => {
    const isSafari = useIsSafari();
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [aiAnswer, setAiAnswer] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false); // Separate loading state for AI
    const [error, setError] = useState<string | null>(null);
    const [selectedIndex, setSelectedIndex] = useState(-1); // Start with no selection

    const navigate = useNavigate();
    const { openHelpCenter } = useHelpCenter();
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Keyboard shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setIsFocused(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Perform LOCAL search with debouncing (INSTANT)
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!query.trim()) {
            setResults([]);
            setAiAnswer(null);
            setError(null);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        // Don't clear error here immediately to avoid flickering if we just had one

        debounceTimer.current = setTimeout(async () => {
            const helpResults = buildHelpResults(query);
            try {
                // Only do local search here
                const searchResults = await searchProjectsAndTasks(query);
                setResults([...searchResults, ...helpResults]);
                setIsOpen(true);
                // Reset selected index when results change
                setSelectedIndex(-1);
            } catch (err: any) {
                console.error('Search error:', err);
                setResults(helpResults);
                setIsOpen(true);
                setSelectedIndex(-1);
                // For local search, we might not want to show a big error
            } finally {
                setIsLoading(false);
            }
        }, 200); // Fast debounce for local results

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [query]);

    // Handle AI Search specifically
    const handleAiSearch = async () => {
        if (!query.trim()) return;

        setIsAiLoading(true);
        setError(null);
        setAiAnswer(null);
        setIsOpen(true);

        try {
            const answer = await answerQuestionWithContext(query);
            setAiAnswer(answer.answer);

            // If AI found relevant items, we could potentially merge them,
            // but for now let's keep the existing local results or refresh them.
            // (Optional: update results based on AI response if needed)

        } catch (err: any) {
            console.error('CORA search error:', err);
            setError(err.message || t('search.aiSearchFailed'));
        } finally {
            setIsAiLoading(false);
        }
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // If query is empty, allow closing
        if (!query.trim() && e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
            return;
        }

        // Special handling for Enter
        if (e.key === 'Enter') {
            e.preventDefault();

            // If an item is selected, navigate to it
            if (selectedIndex >= 0 && selectedIndex < results.length) {
                handleSelectResult(results[selectedIndex]);
                return;
            }

            // Otherwise, perform AI search (if it looks like a question or user forces it)
            // Or just always allow Enter to trigger AI search if no result is selected
            handleAiSearch();
            return;
        }

        if (!isOpen) {
            if (query.trim() && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                setIsOpen(true);
            }
            return;
        }

        const totalItems = results.length;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            // Allow cycling, but starts at -1. 
            // -1 -> 0, 0 -> 1 ... last -> -1 (back to input) ?? 
            // Let's cycle 0 to length-1 only for simplicity if items exist
            if (totalItems > 0) {
                setSelectedIndex((prev) => {
                    const next = prev + 1;
                    if (next >= totalItems) return 0;
                    return next;
                });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (totalItems > 0) {
                setSelectedIndex((prev) => {
                    const next = prev - 1;
                    if (next < 0) return totalItems - 1;
                    return next;
                });
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
        }
    };

    // Navigate to selected result
    const handleSelectResult = (result: SearchResult) => {
        if (!result) return;

        if (result.type === 'project') {
            navigate(`/project/${result.id}`);
        } else if (result.type === 'task') {
            navigate(`/project/${result.projectId}/tasks/${result.id}`);
        } else if (result.type === 'issue') {
            navigate(`/project/${result.projectId}/issues?issue=${result.id}`);
        } else if (result.type === 'idea') {
            navigate(`/project/${result.projectId}/flows?idea=${result.id}`);
        } else if (result.type === 'help_page') {
            openHelpCenter({ pageId: result.helpPageId });
        } else if (result.type === 'help_section') {
            openHelpCenter({ pageId: result.helpPageId, sectionId: result.helpSectionId });
        }

        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
    };

    const projectResults = results.filter(r => r.type === 'project');
    const taskResults = results.filter(r => r.type === 'task');
    const issueResults = results.filter(r => r.type === 'issue');
    const ideaResults = results.filter(r => r.type === 'idea');
    const helpResults = results.filter(r => r.type === 'help_page' || r.type === 'help_section');
    const isQuestion = isQuestionQuery(query);
    const [askAiPromptPrefix, askAiPromptSuffix] = t('search.askAiPrompt').split('{query}');
    const askAiHintParts = t('search.askAiHint').split('{key}');
    const noResultsLabel = t('search.noResults').replace('{query}', query);
    const [inProjectPrefix, inProjectSuffix] = t('search.inProject').split('{project}');
    const helpSectionTemplate = t('search.helpSectionIn');

    return (
        // Root container: Acts as an anchor with fixed width.
        // It reserves space in the layout but doesn't change size.
        <div ref={searchRef} className="relative z-50 h-[42px] w-full">

            {/* Search Input Container - Absolute Positioned */}
            {/* Anchored to the RIGHT. Expands to the LEFT. */}
            <div
                onClick={() => inputRef.current?.focus()}
                className={`
                    group flex items-center gap-2.5 rounded-lg px-3 py-1.5
                    transition-all duration-200 ease-out
                    bg-surface-offset 
                    border border-transparent
                    relative w-full
                    ${isFocused || isOpen
                        ? 'bg-card shadow-sm'
                        : 'hover:bg-surface-hover hover:border-surface'
                    }
                `}
            >
                {/* SVG Animated Border */}
                <svg
                    className={`absolute inset-0 w-full h-full pointer-events-none rounded-lg overflow-visible transition-opacity duration-500 ${isFocused || isOpen ? 'opacity-100' : 'opacity-0'}`}
                >
                    <defs>
                        <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" /> {/* Indigo-500 */}
                            <stop offset="50%" stopColor="#a855f7" /> {/* Purple-500 */}
                            <stop offset="100%" stopColor="#ec4899" /> {/* Pink-500 */}
                        </linearGradient>
                    </defs>
                    <rect
                        x="1" y="1"
                        rx="8" ry="8"
                        width="calc(100% - 2px)" height="calc(100% - 2px)"
                        pathLength="1"
                        fill="none"
                        stroke="url(#borderGradient)"
                        strokeWidth="2"
                        strokeDasharray="1"
                        strokeDashoffset={isFocused || isOpen ? '0' : '1'}
                        className="transition-[stroke-dashoffset]"
                        style={{
                            strokeLinecap: 'round',
                            transitionDuration: '1000ms',
                            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                </svg>

                {/* Search Icon */}
                <span className={`
                    material-symbols-outlined text-[18px] transition-colors duration-200
                    ${isFocused || isOpen ? 'text-primary' : 'text-subtle'}
                `}>
                    search
                </span>

                <input
                    ref={inputRef}
                    className="flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none focus:border-none p-0 text-sm text-main placeholder-[var(--color-text-subtle)]"
                    placeholder={t('search.placeholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        setIsFocused(true);
                        if (query.trim()) setIsOpen(true);
                    }}
                    onBlur={() => setIsFocused(false)}
                />

                {/* Keyboard Shortcut Hint / Clear Button */}
                <div className="flex items-center gap-2">
                    {query ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setQuery('');
                                setResults([]);
                                setAiAnswer(null);
                                inputRef.current?.focus();
                            }}
                            className="p-0.5 rounded-full hover:bg-surface-hover text-muted transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    ) : (
                        <div className={`
                            hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-surface bg-surface-offset
                            text-[10px] font-medium text-subtle transition-opacity duration-200
                            ${isFocused ? 'opacity-0' : 'opacity-100'}
                        `}>
                            <span className="text-xs">⌘</span>
                            <span>K</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Dropdown */}
            {
                isOpen && (
                    <div
                        className="absolute top-12 mt-1 right-0 w-full sm:w-[500px] max-h-[70vh] overflow-y-auto rounded-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 bg-card animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                        {/* Ask AI Action Hint */}
                        {query.trim() && !aiAnswer && !isAiLoading && (
                            <div
                                onClick={handleAiSearch}
                                className={`
                                mx-2 mt-2 px-3 py-3 rounded-xl cursor-pointer group transition-colors
                                ${selectedIndex === -1 ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-surface-hover'}
                            `}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`
                                    p-2 rounded-lg bg-white dark:bg-indigo-500/20 shadow-sm transition-transform group-hover:scale-110
                                    ${isQuestion ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted'}
                                `}>
                                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-main">
                                            {askAiPromptPrefix}
                                            <span className="text-muted font-normal">{query}</span>
                                            {askAiPromptSuffix}
                                        </p>
                                        <p className="text-xs text-subtle mt-0.5">
                                            {askAiHintParts[0]}
                                            <kbd className="font-sans font-semibold text-main">Enter</kbd>
                                            {askAiHintParts[1]}
                                        </p>
                                    </div>
                                    <span className="material-symbols-outlined text-subtle group-hover:text-indigo-500 transition-colors">
                                        arrow_forward
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* AI Loading State */}
                        {isAiLoading && (
                            <div className="p-6 text-center border-b border-surface">
                                <div className="inline-flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-xl animate-spin text-indigo-500">spark mode</span>
                                    <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{t('search.thinking')}</span>
                                </div>
                                <p className="text-xs text-subtle">{t('search.aiAnalyzing')}</p>
                            </div>
                        )}

                        {/* AI Error */}
                        {error && (
                            <div className="p-4 mx-2 mt-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('search.aiErrorTitle')}</p>
                                        <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* AI Answer Result */}
                        {aiAnswer && (
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-surface">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-indigo-500">auto_awesome</span>
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">{t('search.aiInsight')}</span>
                                </div>
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <p className="text-sm text-main leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
                                </div>
                            </div>
                        )}

                        {/* Results Sections */}
                        <div className="py-2">
                            {/* Empty Local Results State */}
                            {!isLoading && results.length === 0 && query.trim() && !aiAnswer && !isAiLoading && (
                                <div className="px-4 py-8 text-center text-muted">
                                    <span className="material-symbols-outlined text-4xl mb-2 opacity-50">search_off</span>
                                    <p className="text-sm">{noResultsLabel}</p>
                                </div>
                            )}

                            {/* Projects */}
                            {projectResults.length > 0 && (
                                <div className="mb-2">
                                    <div className="px-4 py-1.5">
                                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{t('nav.projects')}</span>
                                    </div>
                                    {projectResults.map((result, index) => {
                                        const isSelected = index === selectedIndex && results[index].type === 'project';
                                        // Note: selectedIndex indexes into the unified `results` array, not just projectResults.
                                        // We need to find the actual index in `results`.
                                        const actualIndex = results.indexOf(result);

                                        return (
                                            <button
                                                key={result.id}
                                                onClick={() => handleSelectResult(result)}
                                                onMouseEnter={() => setSelectedIndex(actualIndex)}
                                                className={`
                                                w-full text-left px-4 py-2 flex items-center gap-3 transition-colors
                                                ${selectedIndex === actualIndex ? 'bg-surface-hover border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}
                                            `}
                                            >
                                                <div className="flex items-center justify-center p-1.5 rounded-lg bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
                                                    <span className="material-symbols-outlined text-[18px] leading-none">folder</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-main truncate">{result.title}</p>
                                                    {result.description && (
                                                        <p className="text-xs text-muted truncate">{result.description}</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Tasks */}
                            {taskResults.length > 0 && (
                                <div>
                                    <div className="px-4 py-1.5 border-t border-surface mt-1 pt-3">
                                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{t('nav.tasks')}</span>
                                    </div>
                                    {taskResults.map((result, index) => {
                                        const actualIndex = results.indexOf(result);

                                        return (
                                            <button
                                                key={result.id}
                                                onClick={() => handleSelectResult(result)}
                                                onMouseEnter={() => setSelectedIndex(actualIndex)}
                                                className={`
                                                w-full text-left px-4 py-2 flex items-center gap-3 transition-colors
                                                ${selectedIndex === actualIndex ? 'bg-surface-hover border-l-2 border-emerald-500' : 'border-l-2 border-transparent'}
                                            `}
                                            >
                                                <div className="flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                                                    <span className="material-symbols-outlined text-[18px] leading-none">task_alt</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-main truncate">{result.title}</p>
                                                        <p className="text-xs text-muted truncate">
                                                            {inProjectPrefix}
                                                            <span className="text-main">{result.projectTitle}</span>
                                                            {inProjectSuffix}
                                                        </p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {helpResults.length > 0 && (
                                <div>
                                    <div className="px-4 py-1.5 border-t border-surface mt-1 pt-3">
                                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{t('topbar.helpCenter')}</span>
                                    </div>
                                    {helpResults.map((result) => {
                                        const actualIndex = results.indexOf(result);
                                        const isSection = result.type === 'help_section';
                                        const detail = isSection
                                            ? helpSectionTemplate.replace('{page}', result.helpPageTitle || '')
                                            : result.description;

                                        return (
                                            <button
                                                key={result.id}
                                                onClick={() => handleSelectResult(result)}
                                                onMouseEnter={() => setSelectedIndex(actualIndex)}
                                                className={`
                                                w-full text-left px-4 py-2 flex items-center gap-3 transition-colors
                                                ${selectedIndex === actualIndex ? 'bg-surface-hover border-l-2 border-amber-500' : 'border-l-2 border-transparent'}
                                            `}
                                            >
                                                <div className="flex items-center justify-center p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                                                    <span className="material-symbols-outlined text-[18px] leading-none">
                                                        {isSection ? 'description' : 'menu_book'}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-main truncate">
                                                        {result.title}
                                                    </p>
                                                    {detail && (
                                                        <p className="text-xs text-muted truncate">
                                                            {detail}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                                                    {isSection ? t('search.resultSection') : t('search.resultPage')}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="px-3 py-2 bg-surface-offset border-t border-surface flex items-center justify-between">
                            <div className="flex gap-3">
                                <div className="flex items-center gap-1.5">
                                    <kbd className="h-5 px-1.5 rounded bg-card border border-surface text-[10px] text-muted font-sans">↑↓</kbd>
                                    <span className="text-[10px] text-muted">{t('search.footer.navigate')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <kbd className="h-5 px-1.5 rounded bg-card border border-surface text-[10px] text-muted font-sans">Enter</kbd>
                                    <span className="text-[10px] text-muted">{t('search.footer.selectAskAi')}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <kbd className="h-5 px-1.5 rounded bg-card border border-surface text-[10px] text-muted font-sans">Esc</kbd>
                                    <span className="text-[10px] text-muted">{t('search.footer.close')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
