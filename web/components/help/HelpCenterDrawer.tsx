import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '../ui/Input';
import { useHelpCenter } from '../../context/HelpCenterContext';
import { useLanguage } from '../../context/LanguageContext';
import { answerQuestionWithContext } from '../../services/aiSearchService';
import { HelpArticleView } from './HelpArticleView';
import { searchHelp } from './helpSearch';
import { getHelpContextForPath } from './helpRouting';
import type { HelpArticle, HelpCategoryId } from './helpTypes';
import { useHelpContent } from './useHelpContent';
import './help-center.scss';

const CATEGORY_ORDER: HelpCategoryId[] = ['basics', 'work', 'planning', 'collaboration', 'cora', 'workspace'];

const ArticleRow = ({ article, onOpen }: { article: HelpArticle; onOpen: (id: string) => void }) => (
    <button type="button" className="help-row" onClick={() => onOpen(article.id)}>
        <span className="material-symbols-outlined help-row__icon" aria-hidden="true">{article.icon}</span>
        <span className="help-row__text">
            <span className="help-row__title">{article.title}</span>
            <span className="help-row__summary">{article.summary}</span>
        </span>
        <span className="material-symbols-outlined help-row__chevron" aria-hidden="true">chevron_right</span>
    </button>
);

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
    const location = useLocation();
    const navigate = useNavigate();

    const [shouldRender, setShouldRender] = useState(isOpen);
    const [aiAnswer, setAiAnswer] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const bodyRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const aiRequestRef = useRef(0);

    const content = useHelpContent(shouldRender);
    const articles = content?.articles ?? [];
    const activeArticle = activePageId ? articles.find(article => article.id === activePageId) : undefined;
    const nextArticle = activeArticle ? articles[articles.indexOf(activeArticle) + 1] : undefined;

    const context = useMemo(() => getHelpContextForPath(location.pathname), [location.pathname]);
    const contextArticle = articles.find(article => article.id === context.articleId);

    const trimmedQuery = searchQuery.trim();
    const results = useMemo(
        () => (content && trimmedQuery ? searchHelp(content, trimmedQuery) : []),
        [content, trimmedQuery]
    );

    const grouped = useMemo(
        () => CATEGORY_ORDER
            .map(category => ({ category, items: articles.filter(article => article.category === category) }))
            .filter(group => group.items.length > 0),
        [articles]
    );

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            requestAnimationFrame(() => searchInputRef.current?.focus());
            return;
        }
        const timeout = window.setTimeout(() => setShouldRender(false), 220);
        return () => window.clearTimeout(timeout);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeHelpCenter();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [closeHelpCenter, isOpen]);

    // New view → back to top; a section target scrolls into view and flashes once.
    useEffect(() => {
        const body = bodyRef.current;
        if (!body || !isOpen) return;
        if (!activeSectionId) {
            body.scrollTop = 0;
            return;
        }
        const target = body.querySelector(`[data-section-id="${activeSectionId}"]`) as HTMLElement | null;
        if (!target) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        target.classList.add('is-highlighted');
        const timeout = window.setTimeout(() => target.classList.remove('is-highlighted'), 1400);
        return () => window.clearTimeout(timeout);
    }, [activeArticle, activeSectionId, isOpen, trimmedQuery]);

    useEffect(() => {
        aiRequestRef.current += 1;
        setAiAnswer(null);
        setAiError(null);
        setIsAiLoading(false);
    }, [trimmedQuery]);

    const openArticle = (articleId: string, sectionId?: string) => {
        setSearchQuery('');
        setActivePage(articleId);
        setActiveSection(sectionId ?? null);
    };

    const goHome = () => {
        setSearchQuery('');
        setActivePage(null);
    };

    const handleNavigate = (href: string) => {
        closeHelpCenter();
        navigate(href);
    };

    const handleAskCora = async () => {
        if (!trimmedQuery) return;
        const requestId = aiRequestRef.current + 1;
        aiRequestRef.current = requestId;
        setIsAiLoading(true);
        setAiError(null);
        setAiAnswer(null);
        try {
            const response = await answerQuestionWithContext(trimmedQuery);
            if (aiRequestRef.current === requestId) setAiAnswer(response.answer);
        } catch (error: any) {
            if (aiRequestRef.current === requestId) setAiError(error?.message || t('help.drawer.aiError'));
        } finally {
            if (aiRequestRef.current === requestId) setIsAiLoading(false);
        }
    };

    if (!shouldRender) return null;

    const showBack = Boolean(trimmedQuery || activeArticle);

    const renderSearch = () => (
        <div className="help-view">
            <div className="help-eyebrow">{t('help.drawer.searchResults')}</div>
            {results.length === 0 && <p className="help-empty">{t('help.drawer.noResults')}</p>}
            {results.length > 0 && (
                <div className="help-results">
                    {results.map(result => (
                        <button
                            key={result.key}
                            type="button"
                            className="help-row"
                            onClick={() => openArticle(result.articleId, result.sectionId)}
                        >
                            <span className="material-symbols-outlined help-row__icon" aria-hidden="true">{result.icon}</span>
                            <span className="help-row__text">
                                <span className="help-row__title">{result.title}</span>
                                {result.context && <span className="help-row__context">{result.context}</span>}
                                <span className="help-row__summary">{result.snippet}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
            <div className="help-cora">
                <div className="help-cora__head">
                    <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                    <div>
                        <div className="help-cora__title">{t('help.drawer.askAiTitle')}</div>
                        <div className="help-cora__subtitle">{t('help.drawer.askAiSubtitle')}</div>
                    </div>
                </div>
                <button type="button" className="help-cora__ask" onClick={handleAskCora} disabled={isAiLoading}>
                    {isAiLoading ? t('help.drawer.askAiLoading') : t('help.drawer.askAiPrompt').replace('{query}', trimmedQuery)}
                </button>
                {aiAnswer && <p className="help-cora__answer">{aiAnswer}</p>}
                {aiError && <p className="help-cora__error">{aiError}</p>}
            </div>
        </div>
    );

    const renderHome = () => (
        <div className="help-view">
            {contextArticle && (
                <section className="help-context">
                    <div className="help-eyebrow">{t('help.drawer.forThisPage')}</div>
                    <ArticleRow article={contextArticle} onOpen={id => openArticle(id, context.sectionId)} />
                </section>
            )}
            {grouped.map(group => (
                <section key={group.category} className="help-group">
                    <div className="help-eyebrow">{content?.categories[group.category]}</div>
                    <div className="help-group__rows">
                        {group.items.map(article => <ArticleRow key={article.id} article={article} onOpen={openArticle} />)}
                    </div>
                </section>
            ))}
        </div>
    );

    return createPortal(
        <div className={`help-center${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
            <div className="help-center__scrim" onClick={closeHelpCenter} />
            <aside className="help-center__panel" role="dialog" aria-modal="true" aria-label={t('help.drawer.title')}>
                <header className="help-center__header">
                    {showBack ? (
                        <button type="button" className="help-icon-button" onClick={goHome} aria-label={t('help.drawer.back')}>
                            <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                        </button>
                    ) : (
                        <span className="material-symbols-outlined help-center__mark" aria-hidden="true">help</span>
                    )}
                    <div className="help-center__heading">
                        <div className="help-center__title">{t('help.drawer.title')}</div>
                        <div className="help-center__subtitle">{t('help.drawer.subtitle')}</div>
                    </div>
                    <button type="button" className="help-icon-button" onClick={closeHelpCenter} aria-label={t('help.drawer.close')}>
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </header>

                <div className="help-center__search">
                    <Input
                        ref={searchInputRef}
                        icon="search"
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        placeholder={t('help.drawer.searchPlaceholder')}
                        aria-label={t('help.drawer.searchPlaceholder')}
                    />
                </div>

                <div className="help-center__body" ref={bodyRef}>
                    {!content && <p className="help-empty">{t('help.drawer.loading')}</p>}
                    {content && trimmedQuery && renderSearch()}
                    {content && !trimmedQuery && activeArticle && (
                        <HelpArticleView
                            article={activeArticle}
                            next={nextArticle}
                            onSectionSelect={sectionId => setActiveSection(sectionId)}
                            onOpenArticle={id => openArticle(id)}
                            onNavigate={handleNavigate}
                        />
                    )}
                    {content && !trimmedQuery && !activeArticle && renderHome()}
                </div>
            </aside>
        </div>,
        document.body
    );
};
