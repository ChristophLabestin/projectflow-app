import React from 'react';
import { useAiPanel } from '../../context/AiPanelContext';

/**
 * A section-level ✦ action (e.g. „Teilaufgaben vorschlagen“ on a task): opens the ⌘J bar for the current
 * screen and sends the prompt right away. Results arrive as action cards to confirm (undo included).
 * Renders nothing while in-app AI is off for the workspace.
 */
export const AiAskButton: React.FC<{ label: string; prompt: string; className?: string }> = ({ label, prompt, className }) => {
    const { enabled, openPanel } = useAiPanel();
    if (!enabled) return null;
    return (
        <button type="button" className={`ai-ask-button${className ? ` ${className}` : ''}`} onClick={() => openPanel(prompt, null, { send: true })}>
            <span className="ai-ask-button__mark" aria-hidden="true">✦</span>{label}
        </button>
    );
};
