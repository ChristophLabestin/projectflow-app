import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getCaretRect, type CaretRect } from '../../components/ai/caret';
import './ai-directions.scss';

/**
 * `/ui` → AI: three fundamentally different directions for the in-app AI, as working prototypes
 * (simulated streaming, no model calls). 1 inline-first at the caret, 2 command bar (⌘J),
 * 3 selection tools (Writing-Tools style).
 */

const REWRITE = 'After a password reset, the iOS app rejects the new password with "invalid session". Steps: reset via email link, sign in on iOS 18. Expected: sign-in works. Actual: "Invalid session" until reinstall.';
const SHORTER = 'Login fails on iOS 18 after a password reset ("invalid session").';

const QUICK: Array<[string, string]> = [
    ['notes', 'ai.action.expand'], ['short_text', 'ai.action.shorten'], ['autorenew', 'ai.action.rephrase'], ['spellcheck', 'ai.action.fix']
];
const TOOLS: Array<[string, string]> = [
    ['autorenew', 'ai.action.rephrase'], ['short_text', 'ai.action.shorten'], ['notes', 'ai.action.expand'],
    ['sentiment_satisfied', 'ai.action.friendlier'], ['format_list_bulleted', 'ai.action.bullets'], ['spellcheck', 'ai.action.fix'], ['translate', 'ai.action.translate']
];

/** Word-by-word fake stream. */
const useStream = () => {
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const timer = useRef<number | null>(null);
    const stop = useCallback(() => { if (timer.current) window.clearInterval(timer.current); timer.current = null; setBusy(false); }, []);
    useEffect(() => stop, [stop]);
    const run = useCallback((full: string, onDone?: (value: string) => void, delay = 450) => {
        stop();
        setText('');
        setBusy(true);
        const words = full.split(/(\s+)/);
        let index = 0;
        window.setTimeout(() => {
            timer.current = window.setInterval(() => {
                index += 2;
                const next = words.slice(0, index).join('');
                setText(next);
                if (index >= words.length) { stop(); onDone?.(full); }
            }, 45);
        }, delay);
    }, [stop]);
    return { text, busy, run, stop, setText };
};

const Floating: React.FC<{ left: number; top: number; className: string; children: React.ReactNode; onPointerDown?: (event: React.PointerEvent) => void }> = ({ left, top, className, children, onPointerDown }) =>
    createPortal(<div className={className} style={{ left, top }} onPointerDown={onPointerDown}>{children}</div>, document.body);

// ------------------------------------------------------------------ 1 · inline-first at the caret
const InlineFirst: React.FC = () => {
    const { t } = useLanguage();
    const ref = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('login after pw reset broken on ios 18, says invalid session');
    const [focused, setFocused] = useState(false);
    const [caret, setCaret] = useState<CaretRect | null>(null);
    const [open, setOpen] = useState(false);
    const [instruction, setInstruction] = useState('');
    const [preview, setPreview] = useState<string | null>(null);
    const stream = useStream();

    const measure = useCallback(() => { if (ref.current) setCaret(getCaretRect(ref.current)); }, []);
    useLayoutEffect(() => { if (focused) measure(); }, [value, focused, measure]);
    useEffect(() => {
        const onScroll = () => focused && measure();
        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [focused, measure]);

    const run = (target: string) => {
        setOpen(false);
        setPreview('');
        stream.run(target, (full) => setPreview(full));
        ref.current?.focus();
    };
    const apply = () => { if (preview) setValue(preview); setPreview(null); stream.stop(); };
    const discard = () => { setPreview(null); stream.stop(); };

    const showing = preview !== null;
    const ghost = stream.busy ? stream.text : preview;

    return (
        <div className="ai-dir__field">
            <textarea
                ref={ref}
                className={showing ? 'is-previewing' : ''}
                value={value}
                rows={4}
                aria-label={t('styleGuide.ai.dir1.title')}
                onChange={(event) => setValue(event.target.value)}
                onFocus={() => { setFocused(true); measure(); }}
                onBlur={() => window.setTimeout(() => setFocused(false), 150)}
                onClick={measure}
                onKeyUp={measure}
                onSelect={measure}
                onKeyDown={(event) => {
                    if (showing && (event.key === 'Enter' || event.key === 'Tab') && !stream.busy) { event.preventDefault(); apply(); }
                    else if (showing && event.key === 'Escape') { event.preventDefault(); discard(); }
                    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') { event.preventDefault(); setOpen(true); }
                }}
            />
            {showing && (
                <div className="ai-dir__ghost" aria-live="polite">
                    <span className="ai-dir__ghost-old">{value}</span>
                    <span className="ai-dir__ghost-new">{ghost}</span>
                </div>
            )}
            {showing && ref.current && (() => {
                const box = ref.current.getBoundingClientRect();
                return (
                    <Floating left={box.left} top={box.bottom + 4} className="ai-dir__caret-chip">
                        <span className="ai-dir__hint">
                            {stream.busy ? <span className="ai-dir__dots" aria-label={t('ai.spark.writing')} /> : <><kbd>⏎</kbd> {t('ai.spark.apply')} <kbd>Esc</kbd> {t('ai.spark.discard')}</>}
                        </span>
                    </Floating>
                );
            })()}
            {caret && focused && !open && !showing && (
                <Floating left={caret.left - 2} top={caret.bottom + 3} className="ai-dir__caret-chip">
                    <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(true)} aria-label={t('ai.spark.open')} title={`${t('ai.spark.open')} (⌘J)`}>✦</button>
                </Floating>
            )}
            {open && caret && (
                <Floating left={caret.left - 8} top={caret.bottom + 4} className="ai-dir__mini" onPointerDown={(event) => event.stopPropagation()}>
                    <form onSubmit={(event) => { event.preventDefault(); run(REWRITE); setInstruction(''); }}>
                        <span aria-hidden="true">✦</span>
                        <input autoFocus value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={t('styleGuide.ai.dir1.placeholder')}
                            onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); ref.current?.focus(); } }} aria-label={t('styleGuide.ai.dir1.placeholder')} />
                    </form>
                    <div className="ai-dir__mini-actions">
                        {QUICK.map(([icon, key]) => (
                            <button key={key} type="button" onClick={() => run(key === 'ai.action.shorten' ? SHORTER : REWRITE)}>
                                <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(key)}
                            </button>
                        ))}
                    </div>
                </Floating>
            )}
        </div>
    );
};

// ------------------------------------------------------------------ 2 · command bar (⌘J)
const ANSWER_ROWS: Array<{ icon: string; key: string; meta: string }> = [
    { icon: 'radio_button_unchecked', key: 'Conflict resolution for offline edits', meta: 'Mobile App v2 · overdue since Oct 22' },
    { icon: 'radio_button_unchecked', key: 'Set up 301 redirects', meta: 'Website · overdue since Oct 19' }
];

const CommandBar: React.FC = () => {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [asked, setAsked] = useState(false);
    const [applied, setApplied] = useState(false);
    const stream = useStream();

    const submit = (text: string) => {
        setQuery(text);
        setAsked(true);
        setApplied(false);
        stream.run('You have 2 overdue tasks. Start with the offline conflicts — it blocks the release.');
    };
    const close = () => { setOpen(false); setAsked(false); setQuery(''); stream.stop(); stream.setText(''); };

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    });

    const done = asked && !stream.busy && stream.text.length > 0;
    const suggestions = ['ai.panel.suggest.overdue', 'ai.panel.suggest.planDay', 'ai.panel.suggest.projectBlockers'];

    return (
        <>
            <button type="button" className="ai-dir__open" onClick={() => setOpen(true)}><span aria-hidden="true">✦</span> {t('styleGuide.ai.openGlobal')} <kbd>⌘J</kbd></button>
            {open && createPortal(
                <div className="ai-dir__scrim" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
                    <div className="ai-dir__bar" role="dialog" aria-label={t('ai.panel.title')}>
                        <form className="ai-dir__bar-input" onSubmit={(event) => { event.preventDefault(); if (query.trim()) submit(query); }}>
                            <span className="ai-dir__bar-mark" aria-hidden="true">✦</span>
                            <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setAsked(false); }} placeholder={t('styleGuide.ai.dir2.placeholder')} aria-label={t('styleGuide.ai.dir2.placeholder')} />
                        </form>
                        {!asked && (
                            <ul className="ai-dir__rows">
                                {suggestions.map((key) => (
                                    <li key={key}><button type="button" onClick={() => submit(t(key))}><span className="material-symbols-outlined" aria-hidden="true">subdirectory_arrow_right</span>{t(key)}</button></li>
                                ))}
                            </ul>
                        )}
                        {asked && (
                            <div className="ai-dir__bar-answer" aria-live="polite">
                                {stream.busy && !stream.text ? <p className="ai-dir__shimmer">{t('ai.step.my_today')}</p> : <p>{stream.text}</p>}
                                {done && (
                                    <ul className="ai-dir__rows">
                                        {ANSWER_ROWS.map((row) => (
                                            <li key={row.key}><button type="button"><span className="material-symbols-outlined" aria-hidden="true">{row.icon}</span>{row.key}<span className="ai-dir__meta">{row.meta}</span></button></li>
                                        ))}
                                        <li>
                                            <button type="button" className="ai-dir__action" onClick={() => setApplied(true)} disabled={applied}>
                                                <span className="material-symbols-outlined" aria-hidden="true">{applied ? 'check' : 'bolt'}</span>
                                                {applied ? t('styleGuide.ai.dir2.applied') : t('styleGuide.ai.dir2.action')}
                                                {!applied && <kbd>⏎</kbd>}
                                            </button>
                                        </li>
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

// ------------------------------------------------------------------ 3 · selection tools
const SelectionTools: React.FC = () => {
    const { t } = useLanguage();
    const ref = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('hey team, i looked at the sync thing yesterday night and i think the problem is that two devices editing offline overwrite each other, will check tmrw');
    const [menu, setMenu] = useState<{ left: number; top: number; start: number; end: number } | null>(null);
    const [undo, setUndo] = useState<{ value: string; left: number; top: number } | null>(null);
    const timer = useRef<number | null>(null);

    const check = () => {
        const field = ref.current;
        if (!field) return;
        const { selectionStart: start, selectionEnd: end } = field;
        if (end - start < 3) { setMenu(null); return; }
        const rect = getCaretRect(field, end);
        if (rect) setMenu({ left: rect.left - 8, top: rect.bottom + 6, start, end });
    };

    const replace = (target: string) => {
        if (!menu) return;
        const { start, end, left, top } = menu;
        const before = value;
        setMenu(null);
        const words = target.split(/(\s+)/);
        let index = 0;
        if (timer.current) window.clearInterval(timer.current);
        timer.current = window.setInterval(() => {
            index += 2;
            const partial = words.slice(0, index).join('');
            setValue(before.slice(0, start) + partial + before.slice(end));
            if (index >= words.length) {
                if (timer.current) window.clearInterval(timer.current);
                const field = ref.current;
                field?.focus();
                field?.setSelectionRange(start, start + target.length);
                setUndo({ value: before, left, top });
                window.setTimeout(() => setUndo((current) => (current?.value === before ? null : current)), 6000);
            }
        }, 40);
    };

    return (
        <div className="ai-dir__field">
            <textarea ref={ref} value={value} rows={4} aria-label={t('styleGuide.ai.dir3.title')}
                onChange={(event) => { setValue(event.target.value); setUndo(null); }}
                onMouseUp={check} onKeyUp={(event) => { if (event.shiftKey || event.key.startsWith('Arrow')) check(); }}
                onBlur={() => window.setTimeout(() => setMenu(null), 150)} />
            {menu && (
                <Floating left={menu.left} top={menu.top} className="ai-dir__tools" onPointerDown={(event) => event.preventDefault()}>
                    {TOOLS.map(([icon, key]) => (
                        <button key={key} type="button" onClick={() => replace(key === 'ai.action.shorten' ? 'Two offline devices overwrite each other — I’ll look into it tomorrow.' : 'Hi team, I looked into the sync issue last night. The problem seems to be that two devices editing offline overwrite each other — I’ll check tomorrow.')}>
                            <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(key)}
                        </button>
                    ))}
                </Floating>
            )}
            {undo && (
                <Floating left={undo.left} top={undo.top} className="ai-dir__undo">
                    <span aria-hidden="true">✦</span>{t('styleGuide.ai.dir3.replaced')}
                    <button type="button" onClick={() => { setValue(undo.value); setUndo(null); }}>{t('ai.card.undo')}</button>
                </Floating>
            )}
        </div>
    );
};

export const AiDirections: React.FC = () => {
    const { t } = useLanguage();
    return (
        <div className="ai-dir">
            {[
                { key: 'dir1', node: <InlineFirst /> },
                { key: 'dir2', node: <CommandBar /> },
                { key: 'dir3', node: <SelectionTools /> }
            ].map(({ key, node }, index) => (
                <section key={key} className="ai-dir__card">
                    <span className="ai-dir__num">{index + 1}</span>
                    <h3>{t(`styleGuide.ai.${key}.title`)}</h3>
                    <p>{t(`styleGuide.ai.${key}.hint`)}</p>
                    {node}
                </section>
            ))}
        </div>
    );
};
