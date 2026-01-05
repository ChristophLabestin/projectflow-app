import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../ui/Input';
import { helpCenterPages } from './helpCenterContent';
import type { HelpCenterPageDefinition } from './helpCenterTypes';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { answerQuestionWithContext } from '../../services/aiSearchService';
import { useLanguage } from '../../context/LanguageContext';

type SearchResult = {
    key: string;
    type: 'page' | 'section';
    pageId: string;
    sectionId?: string;
    title: string;
    context: string;
    detail?: string;
};

const groupPagesByCategory = (pages: HelpCenterPageDefinition[]) => {
    const grouped: Record<string, HelpCenterPageDefinition[]> = {};
    pages.forEach(page => {
        if (!grouped[page.category]) grouped[page.category] = [];
        grouped[page.category].push(page);
    });
    return Object.entries(grouped);
};

export const HelpCenterDrawer = () => {
    const {
        isOpen,
        activePageId,
        activeSectionId,
        searchQuery,
        closeHelpCenter,
        setActivePage,
        setActiveSection,
        setSearchQuery
    } = useHelpCenter();
    const { t } = useLanguage();

    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedPageId, setExpandedPageId] = useState<string | null>(activePageId);
    const [aiAnswer, setAiAnswer] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const aiRequestRef = useRef(0);

    const activePage = useMemo(() => {
        return helpCenterPages.find(page => page.id === activePageId) || helpCenterPages[0];
    }, [activePageId]);

    const categories = useMemo(() => groupPagesByCategory(helpCenterPages), []);
    const ActivePageComponent = activePage?.component;
    const categoryLabels = useMemo(() => ({
        Basics: t('help.category.basics'),
        Workflows: t('help.category.workflows'),
        'CORA Studio': t('help.category.aiStudio'),
        Assets: t('help.category.assets'),
        'Social Studio': t('help.category.socialStudio'),
        Marketing: t('help.category.marketing'),
        Account: t('help.category.account')
    }), [t]);
    const resolveCategoryLabel = (category: string) => categoryLabels[category] || category;

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsExpanded(false);
            setExpandedPageId(activePageId);
            requestAnimationFrame(() => searchInputRef.current?.focus());
        } else {
            const timeout = window.setTimeout(() => setShouldRender(false), 200);
            return () => window.clearTimeout(timeout);
        }
    }, [isOpen]);
    
    useEffect(() => {
        setExpandedPageId(activePageId);
    }, [activePageId]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeHelpCenter();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeHelpCenter, isOpen]);

    useEffect(() => {
        if (!isOpen || !activeSectionId) return;
        const container = contentRef.current;
        const target = container?.querySelector(`[data-section-id="${activeSectionId}"]`) as HTMLElement | null;
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('help-highlight');
        const timeout = window.setTimeout(() => target.classList.remove('help-highlight'), 1200);
        return () => window.clearTimeout(timeout);
    }, [activePage?.id, activeSectionId, isOpen]);

    const trimmedQuery = searchQuery.trim();
    const normalizedQuery = trimmedQuery.toLowerCase();
    const searchResults = useMemo(() => {
        if (!normalizedQuery) return [];
        const results: SearchResult[] = [];

        helpCenterPages.forEach(page => {
            const pageText = [
                page.title,
                page.description,
                ...(page.keywords || [])
            ].join(' ').toLowerCase();

            if (pageText.includes(normalizedQuery)) {
                results.push({
                    key: `page-${page.id}`,
                    type: 'page',
                    pageId: page.id,
                    title: page.title,
                    context: page.description
                });
            }

            page.sections.forEach(section => {
                const sectionText = [
                    section.title,
                    section.summary || '',
                    section.content || '',
                    ...(section.keywords || [])
                ].join(' ').toLowerCase();

                if (sectionText.includes(normalizedQuery)) {
                    results.push({
                        key: `section-${page.id}-${section.id}`,
                        type: 'section',
                        pageId: page.id,
                        sectionId: section.id,
                        title: section.title,
                        context: page.title,
                        detail: section.summary
                    });
                }
            });
        });

        return results.slice(0, 20);
    }, [normalizedQuery]);

    useEffect(() => {
        if (!normalizedQuery) {
            setAiAnswer(null);
            setAiError(null);
            setIsAiLoading(false);
            aiRequestRef.current += 1;
            return;
        }
        setAiAnswer(null);
        setAiError(null);
        setIsAiLoading(false);
        aiRequestRef.current += 1;
    }, [normalizedQuery]);

    const drawerWidth = isExpanded
        ? 'var(--help-center-width-expanded)'
        : 'var(--help-center-width-collapsed)';

    const handleResultClick = (result: SearchResult) => {
        setActivePage(result.pageId);
        setActiveSection(result.sectionId || null);
        setSearchQuery('');
    };

    const handleAiSearch = async () => {
        if (!trimmedQuery) return;
        const requestId = aiRequestRef.current + 1;
        aiRequestRef.current = requestId;
        setIsAiLoading(true);
        setAiError(null);
        setAiAnswer(null);
        try {
            const response = await answerQuestionWithContext(trimmedQuery);
            if (aiRequestRef.current !== requestId) return;
            setAiAnswer(response.answer);
        } catch (error: any) {
            if (aiRequestRef.current !== requestId) return;
            setAiError(error?.message || t('help.drawer.aiError'));
        } finally {
            if (aiRequestRef.current === requestId) {
                setIsAiLoading(false);
            }
        }
    };

    const handleTogglePage = (pageId: string) => {
        setActivePage(pageId);
        setExpandedPageId(prev => (prev === pageId ? null : pageId));
    };

    if (!shouldRender) return null;

    return createPortal(
        <div
            className={`fixed inset-0 z-[999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
            aria-hidden={!isOpen}
        >
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                onClick={closeHelpCenter}
            />

            <div
                className={`
                    absolute right-0 top-0 h-full
                    bg-card border-l border-surface
                    shadow-2xl flex flex-col transition-[transform,width] duration-200
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
                style={{ width: drawerWidth }}
                role="dialog"
                aria-modal="true"
                aria-label={t('help.drawer.title')}
            >
                <div className="flex items-start justify-between px-5 py-4 border-b border-surface">
                    <div>
                        <div className="text-lg font-bold text-main">{t('help.drawer.title')}</div>
                        <div className="text-xs text-muted">{t('help.drawer.subtitle')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExpanded((prev) => !prev)}
                            className="p-1 rounded-full text-muted hover:bg-surface-hover hover:text-main transition-colors"
                            aria-label={isExpanded ? t('help.drawer.collapse') : t('help.drawer.expand')}
                            aria-pressed={isExpanded}
                            title={isExpanded ? t('help.drawer.collapseTitle') : t('help.drawer.expandTitle')}
                        >
                            <span className="material-symbols-outlined text-[20px]">
                                {isExpanded ? 'close_fullscreen' : 'open_in_full'}
                            </span>
                        </button>
                        <button
                            onClick={closeHelpCenter}
                            className="p-1 rounded-full text-muted hover:bg-surface-hover hover:text-main transition-colors"
                            aria-label={t('help.drawer.close')}
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </div>

                <div className="px-5 py-4 border-b border-surface">
                    <Input
                        ref={searchInputRef}
                        icon="search"
                        placeholder={t('help.drawer.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchResults.length === 0 && trimmedQuery) {
                                e.preventDefault();
                                handleAiSearch();
                            }
                        }}
                    />
                </div>

                <div className="flex-1 overflow-hidden">
                    {normalizedQuery ? (
                        <div className="h-full overflow-y-auto px-5 py-4 space-y-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                {t('help.drawer.searchResults')}
                            </div>
                            {searchResults.length === 0 && (
                                <div className="space-y-3">
                                    <div className="text-sm text-muted bg-surface border border-dashed border-surface rounded-xl p-4">
                                        {t('help.drawer.noResults')}
                                    </div>
                                    <div className="rounded-2xl border border-surface bg-surface p-4 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-[20px] text-subtle">
                                                auto_awesome
                                            </span>
                                            <div>
                                                <div className="text-sm font-semibold text-main">
                                                    {t('help.drawer.askAiTitle')}
                                                </div>
                                                <div className="text-xs text-muted mt-1">
                                                    {t('help.drawer.askAiSubtitle')}
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAiSearch}
                                            disabled={isAiLoading}
                                            className="w-full text-left rounded-xl border border-surface bg-card hover:bg-surface-hover transition-colors px-3 py-2 text-sm font-semibold text-main disabled:opacity-60"
                                        >
                                            {isAiLoading
                                                ? t('help.drawer.askAiLoading')
                                                : t('help.drawer.askAiPrompt').replace('{query}', trimmedQuery)}
                                        </button>
                                        {aiError && (
                                            <div className="text-xs text-error">
                                                {aiError}
                                            </div>
                                        )}
                                        {aiAnswer && (
                                            <div className="rounded-xl border border-surface bg-card p-3 text-xs text-muted leading-relaxed">
                                                {aiAnswer}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {searchResults.map(result => (
                                <button
                                    key={result.key}
                                    onClick={() => handleResultClick(result)}
                                    className="w-full text-left rounded-2xl border border-surface bg-surface hover:bg-surface-hover transition-colors p-4"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-main">
                                            {result.title}
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                            {result.type === 'page' ? t('help.drawer.resultPage') : t('help.drawer.resultSection')}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted mt-1">
                                        {result.context}
                                    </div>
                                    {result.detail && (
                                        <div className="text-[11px] text-subtle mt-2">
                                            {result.detail}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
                            <aside className="border-r border-surface h-full overflow-y-auto px-4 py-4 space-y-5">
                                {categories.map(([category, pages]) => (
                                    <div key={category} className="space-y-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                                            {resolveCategoryLabel(category)}
                                        </div>
                                        <div className="space-y-2">
                                            {pages.map(page => {
                                                const isActive = page.id === activePage?.id;
                                                const isExpandedNav = expandedPageId === page.id;
                                                return (
                                                    <div key={page.id} className="space-y-1">
                                                        <button
                                                            onClick={() => handleTogglePage(page.id)}
                                                            title={page.description}
                                                            className={`
                                                                w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between gap-2
                                                                ${isActive
                                                                    ? 'bg-primary text-on-primary'
                                                                    : 'text-main hover:bg-surface-hover'
                                                                }
                                                            `}
                                                        >
                                                            <span className="truncate">{page.title}</span>
                                                            <span className={`material-symbols-outlined text-[18px] transition-transform ${isExpandedNav ? 'rotate-180' : ''}`}>
                                                                expand_more
                                                            </span>
                                                        </button>
                                                        {isExpandedNav && (
                                                            <div className="ml-2 pl-3 border-l border-surface space-y-1">
                                                                {page.sections.map(section => (
                                                                    <button
                                                                        key={`${page.id}-${section.id}`}
                                                                        onClick={() => setActiveSection(section.id)}
                                                                        className={`w-full text-left text-xs px-2 py-1 rounded-lg transition-colors ${
                                                                            activeSectionId === section.id
                                                                                ? 'text-primary bg-surface-hover'
                                                                                : 'text-muted hover:text-main'
                                                                        }`}
                                                                    >
                                                                        {section.title}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </aside>

                            <section ref={contentRef} className="h-full overflow-y-auto">
                                {ActivePageComponent && (
                                    <ActivePageComponent
                                        sections={activePage.sections}
                                        activeSectionId={activeSectionId}
                                        onSectionSelect={setActiveSection}
                                    />
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
