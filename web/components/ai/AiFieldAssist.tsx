import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAiAccess } from '../../hooks/useAiAccess';
import { useAiPrefs } from '../../hooks/useAiPrefs';
import { AiPlanHint } from '../billing/AiPlanHint';
import type { AiFieldKind, AiWriteAction } from '../../services/aiAssistClient';
import { useAiWrite } from './core/useAiWrite';
import { getCaretRect, type CaretRect } from './caret';
import { AiWorking } from './AiWorking';
import './ai-family.scss';

/**
 * In-app AI for a text field (brain/plans/in-app-ai-concept.md, decision 2026-10-24: all three
 * directions, by situation):
 * - no selection → a small ✦ just below the caret; hidden while typing, back after a typing pause
 *   (`CARET_SPARK_DELAY_MS`); opens a mini popover („What should I do?“ + quick actions);
 *   the result is previewed in the field (old struck through, new highlighted), ⏎/Tab apply, Esc discard;
 * - text selected → selection tools at the selection; the result replaces it in place;
 * - after applying, ⌘Z (or „Undo“) restores the previous text.
 * Wraps any textarea; renders only the children when the workspace has no in-app AI.
 */
export const CARET_SPARK_DELAY_MS = 800;
const UNDO_VISIBLE_MS = 8000;
const MIN_SELECTION = 3;
const TOOLBAR_HEIGHT = 42;
const CONTEXT_CHARS = 600;

export interface AiFieldAssistProps {
    children: React.ReactNode;
    /** The field (multi-line or single-line); default: the first textarea / text input inside. */
    textareaRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
    value: string;
    /** Receives the full new field value. */
    onApply: (next: string) => void;
    field: AiFieldKind;
    itemTitle?: string;
    projectTitle?: string;
    /** No AI for this field (e.g. secrets, code). */
    disabled?: boolean;
}

type Mode = 'idle' | 'mini' | 'tools' | 'preview' | 'replacing';
type Range = { start: number; end: number };
type Point = { left: number; top: number };

export const QUICK_ACTIONS: Array<[AiWriteAction, string]> = [['expand', 'notes'], ['shorten', 'short_text'], ['rephrase', 'autorenew'], ['fix', 'spellcheck']];
const TOOLS_PRIMARY: Array<[AiWriteAction, string]> = [['rephrase', 'autorenew'], ['shorten', 'short_text'], ['fix', 'spellcheck']];
const TOOLS_MORE: Array<[AiWriteAction, string]> = [
    ['expand', 'notes'], ['friendlier', 'sentiment_satisfied'], ['formal', 'work'], ['bullets', 'format_list_bulleted'], ['translate', 'translate']
];

const Floating: React.FC<{ at: Point; className: string; children: React.ReactNode; label?: string }> = ({ at, className, children, label }) =>
    createPortal(
        <div className={className} style={{ left: at.left, top: at.top }} role={label ? 'dialog' : undefined} aria-label={label}
            onMouseDown={(event) => { if (!(event.target as HTMLElement).closest('input')) event.preventDefault(); }}>
            {children}
        </div>,
        document.body
    );

export const AiFieldAssist: React.FC<AiFieldAssistProps> = ({
    children, textareaRef, value, onApply, field, itemTitle, projectTitle, disabled = false
}) => {
    const { t } = useLanguage();
    const writer = useAiWrite({ field, itemTitle, projectTitle });
    const access = useAiAccess();
    const { caretSpark } = useAiPrefs();
    const blocked = access.status === 'addon-required' || access.status === 'plan-required';
    const rootRef = useRef<HTMLDivElement>(null);
    const [el, setEl] = useState<HTMLTextAreaElement | HTMLInputElement | null>(null);
    const [mode, setMode] = useState<Mode>('idle');
    const [focused, setFocused] = useState(false);
    const [chipAt, setChipAt] = useState<Point | null>(null);
    const tipId = useId();
    const [menuAt, setMenuAt] = useState<Point | null>(null);
    const [selection, setSelection] = useState<Range | null>(null);
    const [instruction, setInstruction] = useState('');
    const [toolsMore, setToolsMore] = useState(false);
    const [undo, setUndo] = useState<{ previous: string; applied: string; at: Point } | null>(null);
    const timer = useRef<number | null>(null);
    const original = useRef('');
    const valueRef = useRef(value);
    valueRef.current = value;
    const active = writer.enabled && !disabled;

    useLayoutEffect(() => {
        setEl(textareaRef?.current || rootRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>('textarea, input[type="text"], input:not([type])') || null);
    });

    const below = (rect: CaretRect | null, gap = 3): Point | null => (rect ? { left: rect.left - 2, top: rect.bottom + gap } : null);
    /** Selection toolbar sits above the first selected line (below it when there is no room). */
    const aboveSelection = (range: Range): Point | null => {
        if (!el) return null;
        const start = getCaretRect(el, range.start);
        if (!start) return null;
        const top = start.top - TOOLBAR_HEIGHT - 6;
        return top > 8 ? { left: start.left - 4, top } : below(getCaretRect(el, range.end), 6);
    };
    const fieldBottom = (): Point | null => {
        if (!el) return null;
        const box = el.getBoundingClientRect();
        return { left: box.left, top: box.bottom + 4 };
    };

    const clearTimer = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; };

    /** Show the caret ✦ after a typing pause (no flicker on short pauses: every keystroke restarts the timer). */
    const scheduleChip = useCallback(() => {
        clearTimer();
        setChipAt(null);
        if (!el || !caretSpark) return;
        timer.current = window.setTimeout(() => {
            if (document.activeElement !== el || !el.value.trim() || el.selectionEnd !== el.selectionStart) return;
            setChipAt(below(getCaretRect(el)));
        }, CARET_SPARK_DELAY_MS);
    }, [el, caretSpark]);

    const closeAll = useCallback(() => {
        writer.reset();
        setMode('idle');
        setMenuAt(null);
        setInstruction('');
    }, [writer]);

    const contextAround = (range: Range) => ({
        before: valueRef.current.slice(Math.max(0, range.start - CONTEXT_CHARS), range.start),
        after: valueRef.current.slice(range.end, range.end + CONTEXT_CHARS)
    });

    const openMini = useCallback(() => {
        if (!el) return;
        clearTimer();
        setChipAt(null);
        setMenuAt(below(getCaretRect(el), 4));
        setMode('mini');
    }, [el]);

    const openTools = useCallback((range: Range) => {
        if (!el) return;
        clearTimer();
        setChipAt(null);
        setSelection(range);
        setToolsMore(false);
        setMenuAt(aboveSelection(range));
        setMode('tools');
    }, [el]);

    // Field events (native listeners: the wrapped child can be any textarea component).
    useEffect(() => {
        if (!el || !active) return undefined;
        const selectionRange = () => (el.selectionEnd - el.selectionStart >= MIN_SELECTION ? { start: el.selectionStart, end: el.selectionEnd } : null);
        const onFocus = () => { setFocused(true); scheduleChip(); };
        const onBlur = () => window.setTimeout(() => {
            if (document.activeElement !== el && !document.activeElement?.closest('.ai-menu, .ai-toolbar, .ai-suggestion-card')) {
                setFocused(false);
                clearTimer();
                setChipAt(null);
                setMode((current) => (current === 'mini' || current === 'tools' ? 'idle' : current));
            }
        }, 120);
        const onInput = () => { setUndo(null); scheduleChip(); };
        const onPointerUp = () => {
            const range = selectionRange();
            if (range) openTools(range);
            else scheduleChip();
        };
        const onKeyUp = (event: KeyboardEvent) => {
            // Keyboard selections: Shift+Arrow/Home/End/PageUp/Down, ⌘A / Ctrl+A.
            const selecting = (event.shiftKey && /^(Arrow|Home|End|Page)/.test(event.key)) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a');
            if (selecting) {
                const range = selectionRange();
                if (range) openTools(range);
            } else if (event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End') {
                scheduleChip();
            }
        };
        const onScroll = () => { setChipAt(null); scheduleChip(); };
        el.addEventListener('focus', onFocus);
        el.addEventListener('blur', onBlur);
        el.addEventListener('input', onInput);
        el.addEventListener('mouseup', onPointerUp);
        el.addEventListener('keyup', onKeyUp);
        el.addEventListener('scroll', onScroll);
        if (document.activeElement === el) onFocus();
        return () => {
            clearTimer();
            el.removeEventListener('focus', onFocus);
            el.removeEventListener('blur', onBlur);
            el.removeEventListener('input', onInput);
            el.removeEventListener('mouseup', onPointerUp);
            el.removeEventListener('keyup', onKeyUp);
            el.removeEventListener('scroll', onScroll);
        };
    }, [el, active, scheduleChip, openTools]);

    // Re-anchor on page scroll / resize.
    useEffect(() => {
        if (!el || mode === 'idle') return undefined;
        const reposition = () => {
            if (mode === 'mini') setMenuAt(below(getCaretRect(el), 4));
            if (mode === 'tools' && selection) setMenuAt(aboveSelection(selection));
        };
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition); };
    }, [el, mode, selection]);

    const runWhole = (action: AiWriteAction, custom?: string) => {
        original.current = valueRef.current;
        setMode('preview');
        setMenuAt(null);
        void writer.run(action, valueRef.current, { instruction: custom });
        el?.focus();
    };

    const runSelection = (action: AiWriteAction) => {
        if (!selection) return;
        original.current = valueRef.current;
        setMode('replacing');
        setMenuAt(null);
        void writer.run(action, valueRef.current, { range: selection, ...contextAround(selection) });
    };

    // Selection mode: stream the replacement straight into the field.
    useEffect(() => {
        if (mode !== 'replacing' || !selection) return;
        const base = original.current;
        if (writer.phase === 'running' && writer.suggestion) {
            onApply(`${base.slice(0, selection.start)}${writer.suggestion}${base.slice(selection.end)}`);
        } else if (writer.phase === 'done') {
            const next = writer.applyTo(base);
            if (next !== null) {
                onApply(next);
                const end = selection.start + writer.suggestion.trim().length;
                window.requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(selection.start, end); });
                setUndo({ previous: base, applied: next, at: below(el ? getCaretRect(el, selection.end) : null, 6) || { left: 0, top: 0 } });
            }
            writer.reset();
            setMode('idle');
        } else if (writer.phase === 'error') {
            onApply(base);
            setMenuAt(fieldBottom());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, writer.phase, writer.suggestion]);

    const applyPreview = useCallback(() => {
        const next = writer.applyTo(original.current);
        if (next === null) return;
        onApply(next);
        setUndo({ previous: original.current, applied: next, at: fieldBottom() || { left: 0, top: 0 } });
        closeAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [writer, onApply, closeAll, el]);

    // Keyboard: ⌘J opens, ⏎/Tab apply the preview, Esc discards, ⌘Z undoes the last AI change.
    useEffect(() => {
        if (!el || !active) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            const mod = event.metaKey || event.ctrlKey;
            if (mod && event.key.toLowerCase() === 'j' && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                const range = el.selectionEnd - el.selectionStart >= MIN_SELECTION ? { start: el.selectionStart, end: el.selectionEnd } : null;
                if (range) openTools(range); else openMini();
                return;
            }
            if (mode === 'preview' && (event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
                // The field's own Enter (e.g. „send comment“) must not run while a preview is open.
                event.preventDefault();
                event.stopPropagation();
                if (writer.phase === 'done') applyPreview();
                return;
            }
            if (event.key === 'Escape' && mode !== 'idle') {
                event.preventDefault();
                event.stopPropagation();
                if (mode === 'replacing') onApply(original.current);
                closeAll();
                return;
            }
            if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey && undo && valueRef.current !== undo.previous) {
                event.preventDefault();
                event.stopPropagation();
                onApply(undo.previous);
                setUndo(null);
            }
        };
        el.addEventListener('keydown', onKeyDown, true);
        return () => el.removeEventListener('keydown', onKeyDown, true);
    }, [el, active, mode, writer.phase, undo, openMini, openTools, applyPreview, closeAll, onApply]);

    useEffect(() => {
        if (!undo) return undefined;
        const timeout = window.setTimeout(() => setUndo(null), UNDO_VISIBLE_MS);
        return () => window.clearTimeout(timeout);
    }, [undo]);

    if (!active) return <>{children}</>;

    const empty = !value.trim();
    const box = el?.getBoundingClientRect();

    return (
        <div ref={rootRef} className="ai-field">
            {children}

            {focused && chipAt && mode === 'idle' && !undo && (
                <Floating at={chipAt} className="ai-caret-chip">
                    <button type="button" onClick={openMini} aria-expanded={false} aria-label={t('ai.spark.tooltip')} aria-describedby={tipId}>
                        <span className="ai-caret-chip__mark" aria-hidden="true">✦</span>{t('ai.label')}
                    </button>
                    <span id={tipId} role="tooltip" className="ai-caret-chip__tip">{t('ai.spark.tooltip')} <kbd>⌘J</kbd></span>
                </Floating>
            )}

            {mode === 'mini' && menuAt && (
                <Floating at={menuAt} className="ai-menu" label={t('ai.spark.menuLabel')}>
                    <div className="ai-menu__head">
                        <span><span aria-hidden="true">✦ </span>{t('ai.label')}</span>
                        <span className="ai-menu__scope">{empty ? t('ai.spark.scope.empty') : t('ai.spark.scope.all')}</span>
                    </div>
                    {blocked ? <div className="ai-menu__hint"><AiPlanHint status={access.status} compact /></div> : (
                        <>
                            <form className="ai-menu__ask" onSubmit={(event) => { event.preventDefault(); if (instruction.trim()) runWhole('custom', instruction.trim()); }}>
                                <input autoFocus value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={300}
                                    placeholder={t('ai.spark.customPlaceholder')} aria-label={t('ai.spark.customPlaceholder')}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') { event.preventDefault(); closeAll(); el?.focus(); return; }
                                        const quick = empty ? [] : QUICK_ACTIONS;
                                        const index = Number(event.key) - 1;
                                        if (!instruction && index >= 0 && index < quick.length) { event.preventDefault(); runWhole(quick[index][0]); }
                                    }} />
                            </form>
                            <div className="ai-menu__list" role="menu">
                                {(empty ? [['draft', 'edit_note'] as [AiWriteAction, string]] : QUICK_ACTIONS).map(([action, icon], index) => (
                                    <button key={action} type="button" role="menuitem" onClick={() => runWhole(action)}>
                                        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                                        <span className="ai-menu__label">{t(`ai.action.${action}`)}</span>
                                        {!empty && <kbd>{index + 1}</kbd>}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </Floating>
            )}

            {mode === 'tools' && menuAt && (
                <Floating at={menuAt} className="ai-toolbar" label={t('ai.spark.menuLabel')}>
                    {blocked ? <AiPlanHint status={access.status} compact /> : (
                        <>
                            {TOOLS_PRIMARY.map(([action, icon]) => (
                                <button key={action} type="button" onClick={() => runSelection(action)}>
                                    <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(`ai.action.${action}`)}
                                </button>
                            ))}
                            <button type="button" className={toolsMore ? 'is-open' : ''} aria-expanded={toolsMore} onClick={() => setToolsMore((value) => !value)}>
                                {t('ai.spark.more')}<span className="material-symbols-outlined" aria-hidden="true">expand_more</span>
                            </button>
                            {toolsMore && (
                                <div className="ai-toolbar__more" role="menu">
                                    {TOOLS_MORE.map(([action, icon]) => (
                                        <button key={action} type="button" role="menuitem" onClick={() => runSelection(action)}>
                                            <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(`ai.action.${action}`)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </Floating>
            )}

            {(mode === 'preview' || (mode === 'replacing' && writer.phase === 'error')) && box && (
                <Floating at={{ left: box.left, top: box.bottom + 6 }} className="ai-suggestion-card" label={t('ai.spark.suggestion')}>
                    <div className="ai-suggestion-card__inner" style={{ width: Math.max(320, Math.min(box.width, 640)) }}>
                        <div className="ai-suggestion-card__head">
                            <span><span aria-hidden="true">✦ </span>{t('ai.spark.suggestion')}</span>
                        </div>
                        {writer.phase === 'error' ? (
                            writer.planStatus ? <AiPlanHint status={writer.planStatus} compact /> : <p className="ai-suggestion-card__error" role="alert">{writer.error}</p>
                        ) : writer.suggestion ? (
                            <p className="ai-suggestion-card__text">{writer.suggestion}</p>
                        ) : (
                            <AiWorking label={t('ai.spark.writing')} />
                        )}
                        <div className="ai-suggestion-card__actions">
                            {writer.phase === 'done' && (
                                <button type="button" className="ai-btn-primary" onMouseDown={(event) => event.preventDefault()} onClick={applyPreview}>
                                    {t('ai.spark.apply')} <kbd>⏎</kbd>
                                </button>
                            )}
                            {(writer.phase === 'done' || writer.phase === 'error') && (
                                <button type="button" className="ai-btn-secondary" onMouseDown={(event) => event.preventDefault()} onClick={() => writer.retry()}>
                                    <span className="material-symbols-outlined" aria-hidden="true">refresh</span>{t('ai.spark.retry')}
                                </button>
                            )}
                            <button type="button" className="ai-btn-ghost" onMouseDown={(event) => event.preventDefault()} onClick={closeAll}>
                                {writer.phase === 'running' ? t('ai.spark.stop') : t('ai.spark.discard')} <kbd>Esc</kbd>
                            </button>
                        </div>
                    </div>
                </Floating>
            )}

            {undo && (
                <Floating at={undo.at} className="ai-undo">
                    <span className="ai-undo__text"><span aria-hidden="true">✦ </span>{t('ai.field.changed')}</span>
                    <button type="button" onClick={() => { onApply(undo.previous); setUndo(null); el?.focus(); }}>{t('ai.card.undo')} <kbd>⌘Z</kbd></button>
                </Floating>
            )}
        </div>
    );
};
