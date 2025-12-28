import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../ui/Input';
import { helpCenterPages, HelpCenterPage } from './helpCenterContent';
import { useHelpCenter } from '../../context/HelpCenterContext';

type SearchResult = {
    key: string;
    type: 'page' | 'section';
    pageId: string;
    sectionId?: string;
    title: string;
    context: string;
    detail?: string;
};

const groupPagesByCategory = (pages: HelpCenterPage[]) => {
    const grouped: Record<string, HelpCenterPage[]> = {};
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

    const [shouldRender, setShouldRender] = useState(isOpen);
    const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

    const activePage = useMemo(() => {
        return helpCenterPages.find(page => page.id === activePageId) || helpCenterPages[0];
    }, [activePageId]);

    const categories = useMemo(() => groupPagesByCategory(helpCenterPages), []);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setIsExpanded(false);
            requestAnimationFrame(() => searchInputRef.current?.focus());
        } else {
            const timeout = window.setTimeout(() => setShouldRender(false), 200);
            return () => window.clearTimeout(timeout);
        }
    }, [isOpen]);

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
        setHighlightedSectionId(activeSectionId);
        const timeout = window.setTimeout(() => setHighlightedSectionId(null), 1200);
        return () => window.clearTimeout(timeout);
    }, [activePage?.id, activeSectionId, isOpen]);

    const normalizedQuery = searchQuery.trim().toLowerCase();
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
                    ...(section.bullets || []),
                    ...(section.steps || []),
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

    const drawerWidth = isExpanded
        ? 'var(--help-center-width-expanded)'
        : 'var(--help-center-width-collapsed)';

    const handleResultClick = (result: SearchResult) => {
        setActivePage(result.pageId);
        setActiveSection(result.sectionId || null);
        setSearchQuery('');
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
                    bg-[var(--color-surface-card)] border-l border-[var(--color-surface-border)]
                    shadow-2xl flex flex-col transition-[transform,width] duration-200
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
                style={{ width: drawerWidth }}
                role="dialog"
                aria-modal="true"
                aria-label="Help Center"
            >
                <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--color-surface-border)]">
                    <div>
                        <div className="text-lg font-bold text-[var(--color-text-main)]">Help Center</div>
                        <div className="text-xs text-[var(--color-text-muted)]">Search or browse guides</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExpanded((prev) => !prev)}
                            className="p-1 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-colors"
                            aria-label={isExpanded ? 'Collapse help center' : 'Expand help center'}
                            aria-pressed={isExpanded}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            <span className="material-symbols-outlined text-[20px]">
                                {isExpanded ? 'close_fullscreen' : 'open_in_full'}
                            </span>
                        </button>
                        <button
                            onClick={closeHelpCenter}
                            className="p-1 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)] transition-colors"
                            aria-label="Close help center"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>
                </div>

                <div className="px-5 py-4 border-b border-[var(--color-surface-border)]">
                    <Input
                        ref={searchInputRef}
                        icon="search"
                        placeholder="Search help topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-hidden">
                    {normalizedQuery ? (
                        <div className="h-full overflow-y-auto px-5 py-4 space-y-4">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                Search results
                            </div>
                            {searchResults.length === 0 && (
                                <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] border border-dashed border-[var(--color-surface-border)] rounded-xl p-4">
                                    No results found. Try a different keyword.
                                </div>
                            )}
                            {searchResults.map(result => (
                                <button
                                    key={result.key}
                                    onClick={() => handleResultClick(result)}
                                    className="w-full text-left rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] hover:bg-[var(--color-surface-hover)] transition-colors p-4"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-[var(--color-text-main)]">
                                            {result.title}
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                            {result.type === 'page' ? 'Page' : 'Section'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[var(--color-text-muted)] mt-1">
                                        {result.context}
                                    </div>
                                    {result.detail && (
                                        <div className="text-[11px] text-[var(--color-text-subtle)] mt-2">
                                            {result.detail}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] overflow-hidden">
                            <aside className="border-r border-[var(--color-surface-border)] h-full overflow-y-auto px-4 py-4 space-y-5">
                                {categories.map(([category, pages]) => (
                                    <div key={category} className="space-y-2">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                            {category}
                                        </div>
                                        <div className="space-y-1">
                                            {pages.map(page => {
                                                const isActive = page.id === activePage?.id;
                                                return (
                                                    <button
                                                        key={page.id}
                                                        onClick={() => setActivePage(page.id)}
                                                        title={page.description}
                                                        className={`
                                                            w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors
                                                            ${isActive
                                                                ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]'
                                                                : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                                            }
                                                        `}
                                                    >
                                                        {page.title}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </aside>

                            <section ref={contentRef} className="h-full overflow-y-auto px-6 py-5 space-y-6">
                                <div className="space-y-2">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                        {activePage?.category}
                                    </div>
                                    <h2 className="text-2xl font-bold text-[var(--color-text-main)]">
                                        {activePage?.title}
                                    </h2>
                                    <p className="text-sm text-[var(--color-text-muted)]">
                                        {activePage?.description}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {activePage?.sections.map(section => (
                                        <button
                                            key={section.id}
                                            onClick={() => setActiveSection(section.id)}
                                            className={`
                                                px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors
                                                ${activeSectionId === section.id
                                                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-primary)]'
                                                    : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] border-[var(--color-surface-border)] hover:text-[var(--color-text-main)]'
                                                }
                                            `}
                                        >
                                            {section.title}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    {activePage?.sections.map(section => (
                                        <div
                                            key={section.id}
                                            data-section-id={section.id}
                                            className={`
                                                rounded-2xl border border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] p-4 space-y-2 transition-colors
                                                ${highlightedSectionId === section.id ? 'ring-2 ring-[var(--color-primary)]/40 bg-[var(--color-surface-hover)]' : ''}
                                            `}
                                        >
                                            <div className="text-sm font-semibold text-[var(--color-text-main)]">
                                                {section.title}
                                            </div>
                                            {section.summary && (
                                                <div className="text-sm text-[var(--color-text-muted)]">
                                                    {section.summary}
                                                </div>
                                            )}
                                            {section.bullets && (
                                                <ul className="list-disc list-inside text-sm text-[var(--color-text-main)] space-y-1">
                                                    {section.bullets.map((bullet, index) => (
                                                        <li key={`${section.id}-bullet-${index}`}>{bullet}</li>
                                                    ))}
                                                </ul>
                                            )}
                                            {section.steps && (
                                                <ol className="list-decimal list-inside text-sm text-[var(--color-text-main)] space-y-1">
                                                    {section.steps.map((step, index) => (
                                                        <li key={`${section.id}-step-${index}`}>{step}</li>
                                                    ))}
                                                </ol>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
