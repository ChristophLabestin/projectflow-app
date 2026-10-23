import React, { useMemo, useRef } from 'react';

/**
 * Streamed text that fades in chunk by chunk (each new delta softly un-blurs). Plain text only;
 * swap to `AiMessageText` once the answer is complete for links and lists.
 */
export const AiStreamText: React.FC<{ text: string; streaming?: boolean; className?: string }> = ({ text, streaming = true, className = '' }) => {
    const chunksRef = useRef<string[]>([]);
    const chunks = useMemo(() => {
        const joined = chunksRef.current.join('');
        if (text.startsWith(joined)) {
            const rest = text.slice(joined.length);
            if (rest) chunksRef.current = [...chunksRef.current, rest];
        } else {
            chunksRef.current = text ? [text] : [];
        }
        return chunksRef.current;
    }, [text]);

    return (
        <p className={`ai-stream ${className}`.trim()}>
            {chunks.map((chunk, index) => <span key={index} className="ai-stream__chunk">{chunk}</span>)}
            {streaming && <span className="ai-stream__caret" aria-hidden="true" />}
        </p>
    );
};

/** Placeholder while nothing has streamed yet: quiet shimmer lines. */
export const AiThinking: React.FC<{ label?: string; lines?: number }> = ({ label, lines = 3 }) => (
    <div className="ai-thinking" role="status" aria-live="polite">
        {label && <span className="ai-thinking__label">{label}</span>}
        {Array.from({ length: lines }, (_, index) => (
            <span key={index} className="ai-thinking__line" style={{ width: `${[92, 78, 54, 66][index % 4]}%` }} />
        ))}
    </div>
);
