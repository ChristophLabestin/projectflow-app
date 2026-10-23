import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

import { diffMarkdown, renderMarkdown } from '../../utils/legalConsent';
import './legal-consent.scss';

/** Renders a legal Markdown document (subset, see utils/legalConsent.ts), sanitized. */
export const MarkdownContent: React.FC<{ markdown: string; className?: string }> = ({ markdown, className = '' }) => {
    const html = useMemo(() => DOMPurify.sanitize(renderMarkdown(markdown), { ADD_ATTR: ['target'] }), [markdown]);
    return <div className={`legal-markdown ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
};

/** Paragraph-level diff between two Markdown versions (added = green, removed = struck through). */
export const MarkdownDiff: React.FC<{ before: string; after: string; labels: { added: string; removed: string; unchanged: string } }> = ({ before, after, labels }) => {
    const blocks = useMemo(() => diffMarkdown(before, after), [before, after]);
    const changed = blocks.some((block) => block.kind !== 'same');
    if (!changed) return <p className="legal-diff__empty">{labels.unchanged}</p>;
    // Unchanged paragraphs are skipped; unchanged headings stay as context.
    const visible = blocks.filter((block) => block.kind !== 'same' || block.text.startsWith('#'));
    return (
        <div className="legal-diff">
            {visible.map((block, index) => (
                <div
                    key={index}
                    className={`legal-diff__block legal-diff__block--${block.kind}`}
                    aria-label={block.kind === 'added' ? labels.added : block.kind === 'removed' ? labels.removed : undefined}
                >
                    <MarkdownContent markdown={block.text} />
                </div>
            ))}
        </div>
    );
};
