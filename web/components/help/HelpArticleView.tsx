import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { HelpInline } from './HelpInline';
import type { HelpArticle, HelpBlock } from './helpTypes';

const CALLOUT_ICONS = { tip: 'lightbulb', note: 'info', warning: 'warning' } as const;

const HelpBlockView = ({ block, onNavigate }: { block: HelpBlock; onNavigate: (href: string) => void }) => {
    switch (block.type) {
        case 'text':
            return <p className="help-text"><HelpInline text={block.text} onNavigate={onNavigate} /></p>;
        case 'steps':
            return (
                <ol className="help-steps">
                    {block.items.map((item, index) => (
                        <li key={index} className="help-steps__item">
                            <span className="help-steps__index" aria-hidden="true">{index + 1}</span>
                            <span><HelpInline text={item} onNavigate={onNavigate} /></span>
                        </li>
                    ))}
                </ol>
            );
        case 'list':
            return (
                <ul className="help-list">
                    {block.items.map((item, index) => (
                        <li key={index}><HelpInline text={item} onNavigate={onNavigate} /></li>
                    ))}
                </ul>
            );
        case 'callout':
            return (
                <div className={`help-callout help-callout--${block.tone}`}>
                    <span className="material-symbols-outlined help-callout__icon" aria-hidden="true">
                        {CALLOUT_ICONS[block.tone]}
                    </span>
                    <p><HelpInline text={block.text} onNavigate={onNavigate} /></p>
                </div>
            );
        case 'terms':
            return (
                <dl className="help-terms">
                    {block.items.map(item => (
                        <div key={item.term} className="help-terms__row">
                            <dt>{item.term}</dt>
                            <dd><HelpInline text={item.text} onNavigate={onNavigate} /></dd>
                        </div>
                    ))}
                </dl>
            );
        case 'shortcuts':
            return (
                <div className="help-shortcuts">
                    {block.items.map(item => (
                        <div key={item.label} className="help-shortcuts__row">
                            <span className="help-shortcuts__label">{item.label}</span>
                            <span className="help-shortcuts__keys">
                                {item.keys.map(key => <kbd key={key} className="help-kbd">{key}</kbd>)}
                            </span>
                        </div>
                    ))}
                </div>
            );
    }
};

type HelpArticleViewProps = {
    article: HelpArticle;
    next?: HelpArticle;
    onSectionSelect: (sectionId: string) => void;
    onOpenArticle: (articleId: string) => void;
    onNavigate: (href: string) => void;
};

export const HelpArticleView = ({ article, next, onSectionSelect, onOpenArticle, onNavigate }: HelpArticleViewProps) => {
    const { t } = useLanguage();

    return (
        <article className="help-article">
            <header className="help-article__header">
                <span className="material-symbols-outlined help-article__icon" aria-hidden="true">{article.icon}</span>
                <h2 className="help-article__title">{article.title}</h2>
                <p className="help-article__summary">{article.summary}</p>
            </header>

            {article.sections.length > 2 && (
                <nav className="help-toc" aria-label={t('help.drawer.onThisPage')}>
                    <div className="help-eyebrow">{t('help.drawer.onThisPage')}</div>
                    <div className="help-toc__chips">
                        {article.sections.map(section => (
                            <button key={section.id} type="button" className="help-chip" onClick={() => onSectionSelect(section.id)}>
                                {section.title}
                            </button>
                        ))}
                    </div>
                </nav>
            )}

            {article.sections.map(section => (
                <section key={section.id} className="help-section" data-section-id={section.id}>
                    <h3 className="help-section__title">{section.title}</h3>
                    {section.blocks.map((block, index) => (
                        <HelpBlockView key={index} block={block} onNavigate={onNavigate} />
                    ))}
                </section>
            ))}

            {next && (
                <button type="button" className="help-next" onClick={() => onOpenArticle(next.id)}>
                    <span className="help-next__text">
                        <span className="help-eyebrow">{t('help.drawer.next')}</span>
                        <span className="help-next__title">{next.title}</span>
                    </span>
                    <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </button>
            )}
        </article>
    );
};
