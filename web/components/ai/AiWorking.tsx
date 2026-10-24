import React from 'react';
import { StatusDots } from '../brand';

/**
 * „Working…“ line for every AI surface. Default: a quiet text shimmer. With the brand accent
 * (`[data-ai-accent="brand"]` on an ancestor, STYLING §1.9) the four status dots wave instead; it is
 * only rendered while the AI works and disappears with the first token.
 */
export const AiWorking: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
    <span className={`ai-working ${className}`.trim()} role="status">
        <StatusDots size="xs" motion="wave" className="ai-working__dots" />
        <span className="ai-working__label">{label}</span>
    </span>
);
