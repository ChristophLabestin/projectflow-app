import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAiAccess } from '../../hooks/useAiAccess';
import { useAiPrefs } from '../../hooks/useAiPrefs';
import { AiPlanHint } from '../billing/AiPlanHint';
import type { AiFieldKind, AiWriteAction } from '../../services/aiAssistClient';
import { useAiWrite } from './core/useAiWrite';
import { getCaretRect, type CaretRect } from './caret';
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
const CONTEXT_CHARS = 600;

export interface AiFieldAssistProps {
    children: React.ReactNode;
    textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
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

const QUICK: Array<[AiWriteAction, string]> = [['expand', 'notes'], ['shorten', 'short_text'], ['rephrase', 'autorenew'], ['fix', 'spellcheck']];
const TOOLS: Array<[AiWriteAction, string]> = [
    ['rephrase', 'autorenew'], ['shorten', 'short_text'], ['expand', 'notes'], ['friendlier', 'sentiment_satisfied'],
    ['formal', 'work'], ['bullets', 'format_list_bulleted'], ['fix', 'spellcheck'], ['translate', 'translate']
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
    const [el, setEl] = useState<HTMLTextAreaElement | null>(null);
    const [mode, setMode] = useState<Mode>('idle');
    const [focused, setFocused] = useState(false);
    const [chipAt, setChipAt] = useState<Point | null>(null);
    const [menuAt, setMenuAt] = useState<Point | null>(null);
    const [selection, setSelection] = useState<Range | null>(null);
    const [instruction, setInstruction] = useState('');
    const [undo, setUndo] = useState<{ previous: string; applied: string; at: Point } | null>(null);
    const timer = useRef<number | null>(null);
    const original = useRef('');
    const valueRef = useRef(value);
    valueRef.current = value;
    const active = writer.enabled && !disabled;

    useLayoutEffect(() => {
        setEl(textareaRef?.current || rootRef.current?.querySelector('textarea') || null);
    });

    const below = (rect: CaretRect | null, gap = 3): Point | null => (rect ? { left: rect.left - 2, top: rect.bottom + gap } : null);
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
        setMenuAt(below(getCaretRect(el, range.end), 6));
        setMode('tools');
    }, [el]);

    // Field events (native listeners: the wrapped child can be any textarea component).
    useEffect(() => {
        if (!el || !active) return undefined;
        const selectionRange = () => (el.selectionEnd - el.selectionStart >= MIN_SELECTION ? { start: el.selectionStart, end: el.selectionEnd } : null);
        const onFocus = () => { setFocused(true); scheduleChip(); };
        const onBlur = () => window.setTimeout(() => {
            if (document.activeElement !== el && !document.activeElement?.closest('.ai-mini, .ai-tools')) {
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
            if (event.shiftKey && event.key.startsWith('Arrow')) {
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
            if (mode === 'tools' && selection) setMenuAt(below(getCaretRect(el, selection.end), 6));
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

    // Ghost preview overlay matches the textarea's box and type.
    const ghostStyle = (): React.CSSProperties => {
        if (!el) return {};
        const style = window.getComputedStyle(el);
        return {
            padding: style.padding, font: style.font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
            borderRadius: style.borderRadius
        };
    };

    if (!active) return <>{children}</>;

    const previewing = mode === 'preview';
    const ghostText = writer.phase === 'running' || writer.phase === 'done' ? writer.suggestion : '';
    const empty = !value.trim();

    return (
        <div ref={rootRef} className={`ai-field${previewing && writer.phase !== 'error' ? ' is-previewing' : ''}`}>
            {children}

            {previewing && writer.phase !== 'error' && (
                <div className="ai-field__preview">
                    <div className="ai-field__ghost" style={ghostStyle()} aria-live="polite">
                        <span className="ai-field__ghost-old">{original.current}</span>
                        {ghostText && <span className="ai-field__ghost-new">{ghostText}</span>}
                    </div>
                    <div className="ai-field__bar">
                        {writer.phase === 'running' ? (
                            <>
                                <span className="ai-hint__working">{t('ai.spark.writing')}</span>
                                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={closeAll}>{t('ai.spark.stop')} <kbd>Esc</kbd></button>
                            </>
                        ) : (
                            <>
                                <button type="button" className="ai-hint__primary" onMouseDown={(event) => event.preventDefault()} onClick={applyPreview}><kbd>⏎</kbd> {t('ai.spark.apply')}</button>
                                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => writer.retry()} aria-label={t('ai.spark.retry')}>
                                    <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                                </button>
                                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={closeAll}><kbd>Esc</kbd> {t('ai.spark.discard')}</button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {focused && chipAt && mode === 'idle' && !undo && (
                <Floating at={chipAt} className="ai-caret-chip">
                    <button type="button" onClick={openMini} aria-label={t('ai.spark.open')} title={`${t('ai.spark.open')} (⌘J)`}>✦</button>
                </Floating>
            )}

            {mode === 'mini' && menuAt && (
                <Floating at={menuAt} className="ai-mini" label={t('ai.spark.menuLabel')}>
                    {blocked ? <AiPlanHint status={access.status} compact /> : (
                        <>
                            <form onSubmit={(event) => { event.preventDefault(); if (instruction.trim()) runWhole('custom', instruction.trim()); }}>
                                <span aria-hidden="true">✦</span>
                                <input autoFocus value={instruction} onChange={(event) => setInstruction(event.target.value)} maxLength={300}
                                    placeholder={t('ai.spark.customPlaceholder')} aria-label={t('ai.spark.customPlaceholder')}
                                    onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); closeAll(); el?.focus(); } }} />
                            </form>
                            <div className="ai-mini__actions" role="menu">
                                {(empty ? [['draft', 'edit_note'] as [AiWriteAction, string]] : QUICK).map(([action, icon]) => (
                                    <button key={action} type="button" role="menuitem" onClick={() => runWhole(action)}>
                                        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(`ai.action.${action}`)}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </Floating>
            )}

            {mode === 'tools' && menuAt && (
                <Floating at={menuAt} className="ai-tools" label={t('ai.spark.menuLabel')}>
                    <div className="ai-tools__head"><span aria-hidden="true">✦</span>{t('ai.label')}</div>
                    {blocked ? <AiPlanHint status={access.status} compact /> : TOOLS.map(([action, icon]) => (
                        <button key={action} type="button" role="menuitem" onClick={() => runSelection(action)}>
                            <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(`ai.action.${action}`)}
                        </button>
                    ))}
                </Floating>
            )}

            {(mode === 'preview' || mode === 'replacing') && writer.phase === 'error' && fieldBottom() && (
                <Floating at={fieldBottom() as Point} className="ai-hint">
                    {writer.phase === 'error' ? (
                        writer.planStatus ? <AiPlanHint status={writer.planStatus} compact /> : (
                            <>
                                <span className="ai-hint__error">{writer.error}</span>
                                <button type="button" onClick={() => writer.retry()}>{t('ai.spark.retry')}</button>
                                <button type="button" onClick={closeAll}>{t('ai.spark.discard')}</button>
                            </>
                        )
                    ) : writer.phase === 'running' ? (
                        <>
                            <span className="ai-hint__working">{t('ai.spark.writing')}</span>
                            <button type="button" onClick={closeAll}>{t('ai.spark.stop')} <kbd>Esc</kbd></button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="ai-hint__primary" onClick={applyPreview}><kbd>⏎</kbd> {t('ai.spark.apply')}</button>
                            <button type="button" onClick={() => writer.retry()} aria-label={t('ai.spark.retry')}>
                                <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                            </button>
                            <button type="button" onClick={closeAll}><kbd>Esc</kbd> {t('ai.spark.discard')}</button>
                        </>
                    )}
                </Floating>
            )}

            {undo && (
                <Floating at={undo.at} className="ai-undo">
                    <span aria-hidden="true">✦</span>{t('ai.field.changed')}
                    <button type="button" onClick={() => { onApply(undo.previous); setUndo(null); el?.focus(); }}>{t('ai.card.undo')} <kbd>⌘Z</kbd></button>
                </Floating>
            )}
        </div>
    );
};
