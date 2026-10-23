import React from 'react';

/**
 * ✦ — the only mark of the in-app AI (no name, no persona). Gradient glyph from the brand accents;
 * `generating` adds a slow turn + breathing glow. STYLING.md §1.9.
 */
export type AiSparkState = 'idle' | 'active' | 'generating';

export const AiSpark: React.FC<{ size?: 'sm' | 'md' | 'lg'; state?: AiSparkState; className?: string }> = ({
    size = 'md', state = 'idle', className = ''
}) => (
    <span className={`ai-spark ai-spark--${size} ${className}`.trim()} data-state={state} aria-hidden="true">✦</span>
);

/** Round trigger with the spark (text fields, top bar, demo). */
export const AiSparkButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { state?: AiSparkState; size?: 'sm' | 'md' }>(
    ({ state = 'idle', size = 'sm', className = '', ...props }, ref) => (
        <button ref={ref} type="button" className={`ai-spark-button ai-spark-button--${size} ${className}`.trim()} data-state={state} {...props}>
            <AiSpark size={size} state={state} />
        </button>
    )
);
AiSparkButton.displayName = 'AiSparkButton';
