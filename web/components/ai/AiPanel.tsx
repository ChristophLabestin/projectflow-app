import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAiPanel } from '../../context/AiPanelContext';
import { useInAppAi } from '../../hooks/useInAppAi';
import { AiAssistError, streamAiAssist, type AiChatMessage, type AiContextEnvelope } from '../../services/aiAssistClient';
import { clearThread, loadThread, saveThread, threadKey } from '../../services/aiThreads';
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

type Chip = { kind: 'project' | 'task' | 'selection' | 'surface'; label: string };

export const AiPanel: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const location = useLocation();
    const { enabled, open, draft, closePanel, getContext } = useAiPanel();
    const { tenantId: activeTenantId } = useInAppAi();
    const tenantIdRef = useRef<string | null>(null);
    tenantIdRef.current = activeTenantId;

    const [messages, setMessages] = useState<AiChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [running, setRunning] = useState(false);
    const [steps, setSteps] = useState<string[]>([]);
    const [error, setError] = useState('');
    const [chips, setChips] = useState<Chip[]>([]);
    const [context, setContext] = useState<AiContextEnvelope>({ surface: 'other' });
    const abortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const keyRef = useRef('');

    // Context + thread follow the screen while the panel is open.
    useEffect(() => {
        if (!open) return;
        const next = getContext();
        setContext(next);
        setChips(next.entity ? [{ kind: next.entity.kind, label: t(`ai.panel.chip.${next.entity.kind}`) }] : [{ kind: 'surface', label: t(`ai.panel.surface.${next.surface}`) }]);
        const tenantId = tenantIdRef.current;
        if (!user || !tenantId) return;
        const key = threadKey(tenantId, next);
        if (key === keyRef.current) return;
        keyRef.current = key;
        abortRef.current?.abort();
        setMessages([]);
        setSteps([]);
        setError('');
        void loadThread(user.uid, key).then((loaded) => { if (keyRef.current === key) setMessages(loaded); });
    }, [open, location.pathname, getContext, user, t]);

    useEffect(() => {
        if (!open) return;
        if (draft) setInput(draft);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open, draft]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [messages, steps]);

    useEffect(() => () => abortRef.current?.abort(), []);

    const send = useCallback(async (text: string) => {
        const content = text.trim();
        const tenantId = tenantIdRef.current;
        if (!content || running || !tenantId || !user) return;
        const key = keyRef.current;
        const history: AiChatMessage[] = [...messages, { role: 'user', content }];
        setMessages([...history, { role: 'assistant', content: '' }]);
        setInput('');
        setSteps([]);
        setError('');
        setRunning(true);
        const controller = new AbortController();
        abortRef.current = controller;
        let answer = '';
        try {
            await streamAiAssist({ capability: 'assist', tenantId, messages: history, context }, {
                signal: controller.signal,
                onDelta: (delta) => {
                    answer += delta;
                    setMessages([...history, { role: 'assistant', content: answer }]);
                },
                onStep: ({ tool }) => setSteps((current) => [...current, tool]),
                onContext: (resolved: any) => {
                    const next: Chip[] = [];
                    if (resolved.project?.title) next.push({ kind: 'project', label: resolved.project.title });
                    if (resolved.task?.title) next.push({ kind: 'task', label: resolved.task.title });
                    if (resolved.selected) next.push({ kind: 'selection', label: t('ai.panel.chip.selected').replace('{count}', String(resolved.selected)) });
                    if (next.length) setChips(next);
                }
            });
            const final = [...history, { role: 'assistant' as const, content: answer.trim() || t('ai.panel.empty') }];
            setMessages(final);
            if (keyRef.current === key) void saveThread(user.uid, key, tenantId, final).catch(() => undefined);
        } catch (caught) {
            if (controller.signal.aborted) {
                setMessages(answer ? [...history, { role: 'assistant', content: answer }] : history);
                return;
            }
            const code = caught instanceof AiAssistError ? caught.code : 'internal';
            const messageKey = `ai.error.${code}`;
            const message = t(messageKey);
            setError(message === messageKey ? t('ai.error.internal') : message);
            setMessages(answer ? [...history, { role: 'assistant', content: answer }] : history);
        } finally {
            setRunning(false);
            setSteps([]);
        }
    }, [messages, running, user, context, t]);

    const reset = () => {
        abortRef.current?.abort();
        setMessages([]);
        setError('');
        if (user && keyRef.current) void clearThread(user.uid, keyRef.current).catch(() => undefined);
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
                {messages.length === 0 && (
                    <div className="ai-panel__empty">
                        <p>{t('ai.panel.intro')}</p>
                        <div className="ai-panel__suggestions">
                            {suggestions.map((key) => (
                                <button key={key} type="button" className="ai-panel__suggestion" onClick={() => void send(t(key))}>
                                    {t(key)}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((message, index) => (
                    <div key={index} className={`ai-message ai-message--${message.role}`}>
                        {message.role === 'assistant'
                            ? (message.content ? <AiMessageText text={message.content} /> : <span className="ai-message__pending">…</span>)
                            : <p className="ai-message__text">{message.content}</p>}
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
                {error && <p className="ai-panel__error" role="alert">{error}</p>}
            </div>

            <form className="ai-panel__composer" onSubmit={(event) => { event.preventDefault(); void send(input); }}>
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void send(input);
                        }
                    }}
                    placeholder={t('ai.panel.placeholder')}
                    rows={2}
                    maxLength={4000}
                    aria-label={t('ai.panel.placeholder')}
                />
                {running ? (
                    <button type="button" className="ai-panel__send" onClick={() => abortRef.current?.abort()} aria-label={t('ai.spark.stop')}>
                        <span className="material-symbols-outlined" aria-hidden="true">stop</span>
                    </button>
                ) : (
                    <button type="submit" className="ai-panel__send" disabled={!input.trim()} aria-label={t('ai.panel.send')}>
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
                    </button>
                )}
            </form>
        </aside>
    );
};
