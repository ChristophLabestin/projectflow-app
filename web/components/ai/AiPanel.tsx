import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAiPanel } from '../../context/AiPanelContext';
import { AiActionCard } from './AiActionCard';
import { useAiConversation } from './core/useAiConversation';
import { useAiAccess } from '../../hooks/useAiAccess';
import { AiPlanHint } from '../billing/AiPlanHint';
import { AiMessageText } from './AiMessageText';
import './ai-panel.scss';

/**
 * ⌘J assistant panel (in-app AI, package P2). Knows the current screen (route + screen extras),
 * answers with the user's own rights through read tools, links objects, keeps the conversation at
 * the object for 30 days. Concept: brain/plans/in-app-ai-concept.md §5 A.
 */
const SUGGESTIONS: Record<string, string[]> = {
    dashboard: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay', 'ai.panel.suggest.whatsNew'],
    project: ['ai.panel.suggest.projectStatus', 'ai.panel.suggest.projectBlockers', 'ai.panel.suggest.projectNext'],
    task: ['ai.panel.suggest.taskWhat', 'ai.panel.suggest.taskNext', 'ai.panel.suggest.taskSplit'],
    list: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.overdue'],
    board: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.projectBlockers'],
    other: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay']
};


export const AiPanel: React.FC = () => {
    const { t } = useLanguage();
    const location = useLocation();
    const { enabled, open, draft, closePanel, getContext } = useAiPanel();
    const access = useAiAccess();
    const blocked = access.status === 'addon-required' || access.status === 'plan-required';
    const { messages, running, steps, error, planStatus, chips, context, send: sendMessage, stop, reset: resetConversation } =
        useAiConversation({ active: open, getContext, screenKey: location.pathname });
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        if (draft) setInput(draft);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, draft]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages, steps]);

    const send = (text: string) => {
        if (!text.trim() || running) return;
        setInput('');
        void sendMessage(text);
    };

    const reset = () => {
        resetConversation();
        inputRef.current?.focus();
    };

    if (!enabled || !open) return null;

    const suggestions = SUGGESTIONS[context.surface] || SUGGESTIONS.other;

    return (
        <aside className="ai-panel motion-slide-in-right" role="complementary" aria-label={t('ai.panel.title')}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); closePanel(); } }}>
            <header className="ai-panel__head">
                <span className="ai-panel__title"><span aria-hidden="true">✦</span> {t('ai.label')}</span>
                <div className="ai-panel__head-actions">
                    {messages.length > 0 && (
                        <button type="button" className="ai-panel__icon" onClick={reset} title={t('ai.panel.reset')} aria-label={t('ai.panel.reset')}>
                            <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
                        </button>
                    )}
                    <button type="button" className="ai-panel__icon" onClick={closePanel} title={`${t('common.close')} (Esc)`} aria-label={t('common.close')}>
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>
            </header>

            <div className="ai-panel__chips" aria-label={t('ai.panel.contextLabel')}>
                {chips.map((chip, index) => (
                    <span key={`${chip.kind}-${index}`} className={`ai-panel__chip ai-panel__chip--${chip.kind}`}>
                        <span className="material-symbols-outlined" aria-hidden="true">
                            {chip.kind === 'task' ? 'task_alt' : chip.kind === 'project' ? 'folder' : chip.kind === 'selection' ? 'select_all' : 'visibility'}
                        </span>
                        {chip.label}
                    </span>
                ))}
            </div>

            <div ref={listRef} className="ai-panel__messages" aria-live="polite">
                {blocked && <AiPlanHint status={access.status} />}
                {!blocked && messages.length === 0 && (
                    <div className="ai-panel__empty">
                        <p>{t('ai.panel.intro')}</p>
                        <div className="ai-panel__suggestions">
                            {suggestions.map((key) => (
                                <button key={key} type="button" className="ai-panel__suggestion" onClick={() => send(t(key))}>
                                    {t(key)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((message, index) => (
                    <div key={index} className={`ai-message ai-message--${message.role}`}>
                        {message.role === 'assistant'
                            ? (message.content ? <AiMessageText text={message.content} /> : !message.proposals?.length && <span className="ai-message__pending">…</span>)
                            : <p className="ai-message__text">{message.content}</p>}
                        {message.proposals?.map((proposal) => <AiActionCard key={proposal.id} proposal={proposal} />)}
                    </div>
                ))}
                {running && steps.length > 0 && (
                    <ul className="ai-panel__steps">
                        {steps.map((tool, index) => {
                            const key = `ai.step.${tool}`;
                            const label = t(key);
                            return <li key={`${tool}-${index}`}>{label === key ? t('ai.step.default') : label}</li>;
                        })}
                    </ul>
                )}
                {error && (planStatus ? <AiPlanHint status={planStatus} /> : <p className="ai-panel__error" role="alert">{error}</p>)}
            </div>

            <form className="ai-panel__composer" onSubmit={(event) => { event.preventDefault(); send(input); }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            send(input);
                        }
                    }}
                    placeholder={t('ai.panel.placeholder')}
                    rows={2}
                    maxLength={4000}
                    aria-label={t('ai.panel.placeholder')}
                />
                {running ? (
                    <button type="button" className="ai-panel__send" onClick={stop} aria-label={t('ai.spark.stop')}>
                        <span className="material-symbols-outlined" aria-hidden="true">stop</span>
                    </button>
                ) : (
                    <button type="submit" className="ai-panel__send" disabled={!input.trim() || blocked} aria-label={t('ai.panel.send')}>
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
                    </button>
                )}
            </form>
        </aside>
    );
};
