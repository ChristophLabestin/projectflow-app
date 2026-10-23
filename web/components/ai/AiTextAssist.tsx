import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useInAppAi } from '../../hooks/useInAppAi';
import {
    AiAssistError,
    streamAiAssist,
    type AiFieldKind,
    type AiWriteAction
} from '../../services/aiAssistClient';
import './ai-text-assist.scss';

/**
 * ✦ in a text field (in-app AI, package P1): wraps any textarea, offers writing actions on the whole
 * text or the selection, streams the suggestion below the field and only writes it back on
 * "Übernehmen". ⌘J/Ctrl+J inside the field opens the menu. Renders the plain children when the
 * workspace has no in-app AI.
 */
export interface AiTextAssistProps {
    children: React.ReactNode;
    /** The textarea the actions read from (value + selection); defaults to the first textarea inside. */
    textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
    value: string;
    /** Receives the full new field value. */
    onApply: (next: string) => void;
    field: AiFieldKind;
    itemTitle?: string;
    projectTitle?: string;
    className?: string;
}

type Phase = 'idle' | 'menu' | 'running' | 'done' | 'error';

const ACTIONS: AiWriteAction[] = ['expand', 'shorten', 'rephrase', 'bullets', 'friendlier', 'formal', 'fix', 'translate'];

const ACTION_ICONS: Record<AiWriteAction, string> = {
    draft: 'edit_note',
    expand: 'notes',
    shorten: 'short_text',
    rephrase: 'autorenew',
    friendlier: 'sentiment_satisfied',
    formal: 'work',
    bullets: 'format_list_bulleted',
    translate: 'translate',
    fix: 'spellcheck',
    custom: 'auto_awesome'
};

export const AiTextAssist: React.FC<AiTextAssistProps> = ({
    children, textareaRef, value, onApply, field, itemTitle, projectTitle, className = ''
}) => {
    const { t } = useLanguage();
    const { enabled, tenantId } = useInAppAi();
    const [phase, setPhase] = useState<Phase>('idle');
    const [suggestion, setSuggestion] = useState('');
    const [error, setError] = useState('');
    const [instruction, setInstruction] = useState('');
    const [range, setRange] = useState<{ start: number; end: number } | null>(null);
    const lastRequest = useRef<{ action: AiWriteAction; instruction?: string } | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const applyRef = useRef<HTMLButtonElement>(null);
    const getTextarea = useCallback(
        () => textareaRef?.current || rootRef.current?.querySelector('textarea') || null,
        [textareaRef]
    );

    const close = useCallback(() => {
        abortRef.current?.abort();
        setPhase('idle');
        setSuggestion('');
        setError('');
        setInstruction('');
        getTextarea()?.focus();
    }, [getTextarea]);

    useEffect(() => () => abortRef.current?.abort(), []);

    // Click outside closes the menu (not a running/finished suggestion).
    useEffect(() => {
        if (phase !== 'menu') return undefined;
        const onPointer = (event: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setPhase('idle');
        };
        document.addEventListener('pointerdown', onPointer);
        return () => document.removeEventListener('pointerdown', onPointer);
    }, [phase]);

    useEffect(() => {
        if (phase === 'done') applyRef.current?.focus();
    }, [phase]);

    const openMenu = useCallback(() => {
        const textarea = getTextarea();
        const start = textarea?.selectionStart ?? 0;
        const end = textarea?.selectionEnd ?? 0;
        setRange(end > start ? { start, end } : null);
        setError('');
        setPhase('menu');
    }, [getTextarea]);

    const sourceText = range ? value.slice(range.start, range.end) : value;

    const run = useCallback(async (action: AiWriteAction, customInstruction?: string) => {
        if (!tenantId) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        lastRequest.current = { action, instruction: customInstruction };
        setSuggestion('');
        setError('');
        setPhase('running');
        try {
            const result = await streamAiAssist({
                capability: 'write',
                tenantId,
                input: { action, field, text: sourceText, instruction: customInstruction, itemTitle, projectTitle }
            }, {
                signal: controller.signal,
                onDelta: (delta) => setSuggestion((current) => current + delta)
            });
            if (controller.signal.aborted) return;
            setSuggestion(result.text.trim());
            setPhase('done');
        } catch (caught) {
            if (controller.signal.aborted) return;
            const code = caught instanceof AiAssistError ? caught.code : 'internal';
            const key = `ai.error.${code}`;
            const message = t(key);
            setError(message === key ? t('ai.error.internal') : message);
            setPhase('error');
        }
    }, [tenantId, field, sourceText, itemTitle, projectTitle, t]);

    const apply = () => {
        const text = suggestion.trim();
        if (!text) return;
        const next = range ? `${value.slice(0, range.start)}${text}${value.slice(range.end)}` : text;
        onApply(next);
        close();
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j' && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            if (phase === 'menu') setPhase('idle');
            else openMenu();
            return;
        }
        if (event.key === 'Escape' && phase !== 'idle') {
            event.preventDefault();
            event.stopPropagation();
            close();
        }
    };

    if (!enabled) return <>{children}</>;

    const empty = !value.trim();

    return (
        <div ref={rootRef} className={`ai-text-assist ${className}`.trim()} onKeyDown={onKeyDown} data-phase={phase}>
            <div className="ai-text-assist__field">
                {children}
                <button
                    type="button"
                    className="ai-text-assist__trigger"
                    onClick={() => (phase === 'menu' ? setPhase('idle') : openMenu())}
                    aria-label={t('ai.spark.open')}
                    aria-expanded={phase === 'menu'}
                    title={`${t('ai.spark.open')} (⌘J)`}
                >
                    <span aria-hidden="true">✦</span>
                </button>

                {phase === 'menu' && (
                    <div className="ai-text-assist__menu motion-pop-in" role="menu" aria-label={t('ai.spark.menuLabel')}>
                        <p className="ai-text-assist__scope">
                            {range ? t('ai.spark.scope.selection') : empty ? t('ai.spark.scope.empty') : t('ai.spark.scope.all')}
                        </p>
                        {empty && !range ? (
                            <button type="button" role="menuitem" className="ai-text-assist__item" onClick={() => void run('draft')}>
                                <span className="material-symbols-outlined" aria-hidden="true">{ACTION_ICONS.draft}</span>
                                {t('ai.action.draft')}
                            </button>
                        ) : ACTIONS.map((action) => (
                            <button key={action} type="button" role="menuitem" className="ai-text-assist__item" onClick={() => void run(action)}>
                                <span className="material-symbols-outlined" aria-hidden="true">{ACTION_ICONS[action]}</span>
                                {t(`ai.action.${action}`)}
                            </button>
                        ))}
                        {!(empty && !range) && (
                            <form
                                className="ai-text-assist__custom"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (instruction.trim()) void run('custom', instruction.trim());
                                }}
                            >
                                <span aria-hidden="true">✦</span>
                                <input
                                    value={instruction}
                                    onChange={(event) => setInstruction(event.target.value)}
                                    placeholder={t('ai.spark.customPlaceholder')}
                                    maxLength={300}
                                    aria-label={t('ai.spark.customPlaceholder')}
                                />
                            </form>
                        )}
                    </div>
                )}
            </div>

            {(phase === 'running' || phase === 'done' || phase === 'error') && (
                <div className="ai-text-assist__suggestion motion-pop-in" aria-live="polite">
                    <div className="ai-text-assist__suggestion-head">
                        <span className="ai-text-assist__badge"><span aria-hidden="true">✦</span> {t('ai.label')}</span>
                        {phase === 'running' && <span className="ai-text-assist__status">{t('ai.spark.writing')}</span>}
                    </div>
                    {phase === 'error'
                        ? <p className="ai-text-assist__error" role="alert">{error}</p>
                        : <p className="ai-text-assist__text">{suggestion || '…'}</p>}
                    <div className="ai-text-assist__actions">
                        {phase === 'running' && (
                            <button type="button" className="ai-text-assist__btn" onClick={close}>{t('ai.spark.stop')}</button>
                        )}
                        {phase === 'done' && (
                            <button ref={applyRef} type="button" className="ai-text-assist__btn ai-text-assist__btn--primary" onClick={apply}>
                                {t('ai.spark.apply')} <kbd>⏎</kbd>
                            </button>
                        )}
                        {phase !== 'running' && lastRequest.current && (
                            <button
                                type="button"
                                className="ai-text-assist__btn"
                                onClick={() => lastRequest.current && void run(lastRequest.current.action, lastRequest.current.instruction)}
                                aria-label={t('ai.spark.retry')}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                            </button>
                        )}
                        {phase !== 'running' && (
                            <button type="button" className="ai-text-assist__btn" onClick={close}>{t('ai.spark.discard')} <kbd>Esc</kbd></button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
