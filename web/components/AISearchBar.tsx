import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { SearchResult } from '../types';
import { searchProjectsAndTasks, answerQuestionWithContext, isQuestionQuery } from '../services/aiSearchService';
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
    const { t } = useLanguage();
    const [query, setQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
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

    const openSearchModal = () => {
        setIsModalOpen(true);
        setIsFocused(true);
    };

    const closeSearchModal = () => {
        setIsModalOpen(false);
        setIsFocused(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
    };

    // Keyboard shortcut (Cmd+K / Ctrl+K)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                openSearchModal();
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    useEffect(() => {
        if (!isModalOpen) return undefined;

        const frame = requestAnimationFrame(() => {
            inputRef.current?.focus();
        });

        return () => cancelAnimationFrame(frame);
    }, [isModalOpen]);

    useEffect(() => {
        if (!isModalOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isModalOpen]);

    // Perform LOCAL search with debouncing (INSTANT)
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (!query.trim()) {
            setResults([]);
            setAiAnswer(null);
            setError(null);
            setIsLoading(false);
            setSelectedIndex(-1);
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
                // Reset selected index when results change
                setSelectedIndex(-1);
            } catch (err: any) {
                console.error('Search error:', err);
                setResults(helpResults);
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
        setIsModalOpen(true);

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
            closeSearchModal();
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
            closeSearchModal();
        }
    };

    // Navigate to selected result
    const handleSelectResult = (result: SearchResult) => {
        if (!result) return;

        if (result.type === 'project') {
            navigate(`/project/${result.id}`);
        } else if (result.type === 'initiative') {
            if (result.projectId) {
                navigate(`/project/${result.projectId}/initiatives/${result.id}`);
            }
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
        closeSearchModal();
    };

    const projectResults = results.filter(r => r.type === 'project');
    const initiativeResults = results.filter(r => r.type === 'initiative');
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

    const renderProjectContext = (result: SearchResult) => {
        if (!result.projectTitle && !result.companyProjectTitle) return result.description;

        return (
            <>
                {result.projectTitle && (
                    <>
                        {inProjectPrefix}
                        <span>{result.projectTitle}</span>
                        {inProjectSuffix}
                    </>
                )}
                {result.companyProjectTitle && (
                    <span> - {t('search.companyProjectContext').replace('{company}', result.companyProjectTitle)}</span>
                )}
            </>
        );
    };

    const renderResultRow = (
        result: SearchResult,
        icon: string,
        tone: 'primary' | 'success' | 'warning' | 'error' | 'muted',
        detail?: React.ReactNode
    ) => {
        const actualIndex = results.indexOf(result);

        return (
            <button
                key={result.id}
                type="button"
                onClick={() => handleSelectResult(result)}
                onMouseEnter={() => setSelectedIndex(actualIndex)}
                className={`ai-search-modal__result ${selectedIndex === actualIndex ? 'is-selected' : ''}`}
            >
                <span className={`ai-search-modal__result-icon ai-search-modal__result-icon--${tone}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </span>
                <span className="ai-search-modal__result-copy">
                    <span className="ai-search-modal__result-title">{result.title}</span>
                    {detail && (
                        <span className="ai-search-modal__result-detail">
                            {detail}
                        </span>
                    )}
                </span>
                <span className="material-symbols-outlined ai-search-modal__result-arrow">arrow_forward</span>
            </button>
        );
    };

    const hasQuery = Boolean(query.trim());

    return (
        <div ref={searchRef} className="ai-search-bar">
            <button
                type="button"
                className={`ai-search-trigger ${isModalOpen ? 'is-active' : ''}`}
                onClick={openSearchModal}
                aria-haspopup="dialog"
                aria-expanded={isModalOpen}
                aria-label={t('search.open', t('common.search'))}
            >
                <span className="material-symbols-outlined ai-search-trigger__icon">search</span>
                <span className="ai-search-trigger__shortcut" aria-hidden="true">
                    <span>⌘</span>
                    <span>K</span>
                </span>
            </button>

            {isModalOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="ai-search-modal"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeSearchModal();
                        }
                    }}
                >
                    <section
                        className="ai-search-modal__panel"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('search.modalLabel', t('common.search'))}
                    >
                        <div className={`ai-search-modal__input-row ${isFocused ? 'is-focused' : ''}`}>
                            <span className="material-symbols-outlined ai-search-modal__search-icon">search</span>
                            <input
                                ref={inputRef}
                                className="ai-search-modal__input"
                                placeholder={t('search.placeholder')}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('');
                                        setResults([]);
                                        setAiAnswer(null);
                                        inputRef.current?.focus();
                                    }}
                                    className="ai-search-modal__clear"
                                    aria-label={t('search.clear', 'Clear search')}
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            )}
                        </div>

                        {(hasQuery || aiAnswer || isAiLoading || error) && (
                            <div className="ai-search-modal__content">
                                {isAiLoading && (
                                    <div className="ai-search-modal__state">
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                        <div>
                                            <strong>{t('search.thinking')}</strong>
                                            <p>{t('search.aiAnalyzing')}</p>
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="ai-search-modal__state ai-search-modal__state--error">
                                        <span className="material-symbols-outlined">error</span>
                                        <div>
                                            <strong>{t('search.aiErrorTitle')}</strong>
                                            <p>{error}</p>
                                        </div>
                                    </div>
                                )}

                                {aiAnswer && (
                                    <div className="ai-search-modal__answer">
                                        <div className="ai-search-modal__answer-title">
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                            <span>{t('search.aiInsight')}</span>
                                        </div>
                                        <p>{aiAnswer}</p>
                                    </div>
                                )}

                                {!isLoading && results.length === 0 && hasQuery && !aiAnswer && !isAiLoading && (
                                    <div className="ai-search-modal__empty">
                                        <span className="material-symbols-outlined">search_off</span>
                                        <p>{noResultsLabel}</p>
                                    </div>
                                )}

                                {projectResults.length > 0 && (
                                    <div className="ai-search-modal__section">
                                        <div className="ai-search-modal__section-title">{t('nav.projects')}</div>
                                        {projectResults.map((result) => renderResultRow(
                                            result,
                                            result.projectCategory === 'startup_company' ? 'domain' : 'folder',
                                            'primary',
                                            result.companyProjectTitle
                                                ? t('search.companyProjectContext').replace('{company}', result.companyProjectTitle)
                                                : result.description
                                        ))}
                                    </div>
                                )}

                                {initiativeResults.length > 0 && (
                                    <div className="ai-search-modal__section">
                                        <div className="ai-search-modal__section-title">{t('nav.initiatives')}</div>
                                        {initiativeResults.map((result) => renderResultRow(
                                            result,
                                            'rocket_launch',
                                            'primary',
                                            renderProjectContext(result)
                                        ))}
                                    </div>
                                )}

                                {taskResults.length > 0 && (
                                    <div className="ai-search-modal__section">
                                        <div className="ai-search-modal__section-title">{t('nav.tasks')}</div>
                                        {taskResults.map((result) => renderResultRow(
                                            result,
                                            'task_alt',
                                            'success',
                                            renderProjectContext(result)
                                        ))}
                                    </div>
                                )}

                                {issueResults.length > 0 && (
                                    <div className="ai-search-modal__section">
                                        <div className="ai-search-modal__section-title">{t('nav.issues')}</div>
                                        {issueResults.map((result) => renderResultRow(
                                            result,
                                            'bug_report',
                                            'error',
                                            renderProjectContext(result)
                                        ))}
                                    </div>
                                )}

                                {ideaResults.length > 0 && (
                                    <div className="ai-search-modal__section">
                                        <div className="ai-search-modal__section-title">{t('nav.flows')}</div>
                                        {ideaResults.map((result) => renderResultRow(
                                            result,
                                            'lightbulb',
                                            'warning',
                                            renderProjectContext(result)
                                        ))}
                                    </div>
                                )}

                                {helpResults.length > 0 && (
                                    <div className="ai-search-modal__section">
                                        <div className="ai-search-modal__section-title">{t('topbar.helpCenter')}</div>
                                        {helpResults.map((result) => {
                                            const isSection = result.type === 'help_section';
                                            const detail = isSection
                                                ? helpSectionTemplate.replace('{page}', result.helpPageTitle || '')
                                                : result.description;

                                            return renderResultRow(
                                                result,
                                                isSection ? 'description' : 'menu_book',
                                                'muted',
                                                detail
                                            );
                                        })}
                                    </div>
                                )}

                                {hasQuery && !aiAnswer && !isAiLoading && (
                                    <button
                                        type="button"
                                        onClick={handleAiSearch}
                                        className={`ai-search-modal__ask ${selectedIndex === -1 && results.length === 0 ? 'is-selected' : ''}`}
                                    >
                                        <span className={`ai-search-modal__ask-icon ${isQuestion ? 'is-question' : ''}`}>
                                            <span className="material-symbols-outlined">auto_awesome</span>
                                        </span>
                                        <span className="ai-search-modal__ask-copy">
                                            <span>
                                                {askAiPromptPrefix}
                                                <strong>{query}</strong>
                                                {askAiPromptSuffix}
                                            </span>
                                            <span>
                                                {askAiHintParts[0]}
                                                <kbd>Enter</kbd>
                                                {askAiHintParts[1]}
                                            </span>
                                        </span>
                                        <span className="material-symbols-outlined ai-search-modal__result-arrow">arrow_forward</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>,
                document.body
            )}
        </div>
    );
};
