import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAiPanel } from '../../context/AiPanelContext';
import { useAiAccess } from '../../hooks/useAiAccess';
import { AiPlanHint } from '../billing/AiPlanHint';
import { AiActionCard } from './AiActionCard';
import { AiMessageText } from './AiMessageText';
import { AiWorking } from './AiWorking';
import { useAiConversation } from './core/useAiConversation';
import './ai-ds.scss';
import './ai-family.scss';

/**
 * ⌘J command bar (decision 2026-10-24, direction 2): one slim input like Spotlight/Raycast that knows
 * the current screen; the answer appears as a short text plus compact rows and proposals (action
 * cards) — only as large as needed. Follow-up questions continue the conversation of this object.
 */
const SUGGESTIONS: Record<string, string[]> = {
    dashboard: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay', 'ai.panel.suggest.whatsNew'],
    project: ['ai.panel.suggest.projectStatus', 'ai.panel.suggest.projectBlockers', 'ai.panel.suggest.projectNext'],
    task: ['ai.panel.suggest.taskWhat', 'ai.panel.suggest.taskNext', 'ai.panel.suggest.taskSplit'],
    list: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.overdue'],
    board: ['ai.panel.suggest.listPriorities', 'ai.panel.suggest.projectBlockers'],
    other: ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay']
};

export const AiCommandBar: React.FC = () => {
    const { t } = useLanguage();
    const location = useLocation();
    const { enabled, open, draft, closePanel, getContext } = useAiPanel();
    const access = useAiAccess();
    const blocked = access.status === 'addon-required' || access.status === 'plan-required';
    const { messages, running, steps, error, planStatus, chips, context, send, stop, reset } =
        useAiConversation({ active: open, getContext, screenKey: location.pathname });
    const [input, setInput] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setInput(draft || '');
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, draft]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); if (running) stop(); else closePanel(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, running, stop, closePanel]);

    if (!enabled || !open) return null;

    const submit = (text: string) => {
        if (!text.trim() || running || blocked) return;
        setInput('');
        void send(text);
    };

    const last = messages.length && messages[messages.length - 1].role === 'assistant' ? messages[messages.length - 1] : null;
    const question = [...messages].reverse().find((message) => message.role === 'user');
    const suggestions = SUGGESTIONS[context.surface] || SUGGESTIONS.other;
    const contextLabel = chips.find((chip) => chip.kind === 'task')?.label || chips.find((chip) => chip.kind === 'project')?.label || chips[0]?.label;
    const stepKey = steps.length ? `ai.step.${steps[steps.length - 1]}` : '';
    const stepLabel = stepKey && t(stepKey) !== stepKey ? t(stepKey) : t('ai.step.default');

    return createPortal(
        <div className="ai-bar-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel(); }}>
            <div className="ai-bar" role="dialog" aria-label={t('ai.panel.title')} data-generating={running ? 'true' : 'false'}>
                <form className="ai-bar__input" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
                    <span className="ai-bar__mark" aria-hidden="true">✦</span>
                    <input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} maxLength={4000}
                        placeholder={messages.length ? t('ai.bar.followUp') : t('ai.bar.placeholder')} aria-label={t('ai.bar.placeholder')} disabled={blocked} />
                    {contextLabel && <span className="ai-bar__context" title={contextLabel}>{contextLabel}</span>}
                    {messages.length > 0 && !running && (
                        <button type="button" className="ai-bar__icon" onClick={reset} aria-label={t('ai.panel.reset')} title={t('ai.panel.reset')}>
                            <span className="material-symbols-outlined" aria-hidden="true">restart_alt</span>
                        </button>
                    )}
                </form>

                {(blocked || messages.length > 0 || running || error) ? (
                    <div className="ai-bar__body" aria-live="polite">
                        {blocked && <AiPlanHint status={access.status} />}
                        {!blocked && question && messages.length > 2 && <p className="ai-bar__question">{question.content}</p>}
                        {!blocked && running && !last?.content && <AiWorking label={stepLabel} className="ai-bar__working" />}
                        {!blocked && last?.content && <div className="ai-message"><AiMessageText text={last.content} streaming={running} /></div>}
                        {!blocked && last?.proposals?.map((proposal) => <AiActionCard key={proposal.id} proposal={proposal} />)}
                        {error && (planStatus ? <AiPlanHint status={planStatus} /> : <p className="ai-bar__error" role="alert">{error}</p>)}
                    </div>
                ) : (
                    <div className="ai-bar__body">
                        <ul className="ai-bar__rows">
                            {suggestions.map((key) => (
                                <li key={key}>
                                    <button type="button" onClick={() => submit(t(key))}>
                                        <span className="material-symbols-outlined" aria-hidden="true">subdirectory_arrow_right</span>{t(key)}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="ai-bar__foot">
                    <span><kbd>⏎</kbd> {t('ai.bar.send')}</span>
                    <span><kbd>Esc</kbd> {running ? t('ai.spark.stop') : t('common.close')}</span>
                </div>
            </div>
        </div>,
        document.body
    );
};
