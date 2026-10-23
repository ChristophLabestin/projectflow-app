import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { AiPopover, type AiAnchor } from '../../components/ai/AiPopover';
import { AiSpark, AiSparkButton } from '../../components/ai/AiSpark';
import { AiStreamText, AiThinking } from '../../components/ai/AiStreamText';
import { AiMessageText } from '../../components/ai/AiMessageText';
import { AiActionCard } from '../../components/ai/AiActionCard';
import type { AiProposalPreview } from '../../services/aiAssistClient';
import './ai-showcase.scss';

/**
 * `/ui` → AI: the in-app AI design system with simulated streaming (no model calls).
 * Field ✦ (popover at the field/selection) and ⌘J (popover top centre, chips, suggestions, card).
 */
const FIELD_ANSWER = 'After a password reset, the iOS app rejects the new password with "invalid session". Steps: 1) reset via email link, 2) sign in on iOS 18 with the new password. Expected: sign-in works. Actual: "Invalid session" until the app is reinstalled.';
const PANEL_ANSWER = '**Overdue (2):**\n- [Conflict resolution for offline edits](pf://task/p-app/t-sync) — urgent, since Oct 22\n- [Set up 301 redirects](pf://task/p-website/t-redirects) — since Oct 19\n\nStart with the offline conflicts; I prepared a subtask for the regression test below.';

const DEMO_PROPOSAL: AiProposalPreview = {
    id: 'demo',
    tool: 'update_task',
    target: { projectId: 'p-app', projectTitle: 'Mobile App v2', taskId: 't-sync', taskTitle: 'Conflict resolution for offline edits' },
    changes: [{ field: 'priority', from: 'Urgent', to: 'High' }, { field: 'dueDate', from: '2026-10-22', to: '2026-10-28' }]
};

const ACTIONS: Array<[string, string]> = [
    ['notes', 'ai.action.expand'], ['short_text', 'ai.action.shorten'], ['autorenew', 'ai.action.rephrase'],
    ['format_list_bulleted', 'ai.action.bullets'], ['spellcheck', 'ai.action.fix'], ['translate', 'ai.action.translate']
];

/** Streams `text` word by word after a short "thinking" pause. */
const useFakeStream = () => {
    const [text, setText] = useState('');
    const [phase, setPhase] = useState<'idle' | 'thinking' | 'streaming' | 'done'>('idle');
    const timer = useRef<number | null>(null);
    const stop = () => { if (timer.current) window.clearInterval(timer.current); timer.current = null; };
    useEffect(() => stop, []);
    const start = (full: string) => {
        stop();
        setText('');
        setPhase('thinking');
        const words = full.split(/(\s+)/);
        let index = 0;
        window.setTimeout(() => {
            setPhase('streaming');
            timer.current = window.setInterval(() => {
                index += 3;
                setText(words.slice(0, index).join(''));
                if (index >= words.length) { stop(); setPhase('done'); }
            }, 70);
        }, 900);
    };
    const reset = () => { stop(); setText(''); setPhase('idle'); };
    return { text, phase, start, reset };
};

export const AiShowcase: React.FC = () => {
    const { t } = useLanguage();
    const fieldRef = useRef<HTMLTextAreaElement>(null);
    const [fieldValue, setFieldValue] = useState('login after pw reset broken on ios, invalid session, only ios 18');
    const [fieldAnchor, setFieldAnchor] = useState<AiAnchor>(null);
    const [fieldOpen, setFieldOpen] = useState(false);
    const field = useFakeStream();

    const [panelOpen, setPanelOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [question, setQuestion] = useState('');
    const panel = useFakeStream();

    const openField = () => {
        const el = fieldRef.current;
        if (!el) return;
        field.reset();
        setFieldAnchor(el.getBoundingClientRect());
        setFieldOpen(true);
    };

    const generating = (phase: string) => phase === 'thinking' || phase === 'streaming';

    return (
        <div className="ai-showcase">
            <div className="ai-showcase__row">
                <div className="ai-showcase__item"><AiSpark size="sm" /><span>sm</span></div>
                <div className="ai-showcase__item"><AiSpark size="md" /><span>md</span></div>
                <div className="ai-showcase__item"><AiSpark size="lg" /><span>lg</span></div>
                <div className="ai-showcase__item"><AiSpark size="lg" state="generating" /><span>generating</span></div>
                <div className="ai-showcase__item"><AiSparkButton size="sm" aria-label="AI" /><span>button sm</span></div>
                <div className="ai-showcase__item"><AiSparkButton size="md" aria-label="AI" /><span>button md</span></div>
            </div>

            <div className="ai-showcase__grid">
                <div className="ai-showcase__demo">
                    <h3>{t('styleGuide.ai.fieldTitle')}</h3>
                    <p>{t('styleGuide.ai.fieldHint')}</p>
                    <div className="ai-showcase__field">
                        <textarea ref={fieldRef} value={fieldValue} onChange={(event) => setFieldValue(event.target.value)} rows={4} aria-label={t('styleGuide.ai.fieldTitle')} />
                        <AiSparkButton className="ai-showcase__field-spark" state={fieldOpen ? 'active' : 'idle'} onClick={openField} aria-label={t('ai.spark.open')} />
                    </div>
                </div>

                <div className="ai-showcase__demo">
                    <h3>{t('styleGuide.ai.globalTitle')}</h3>
                    <p>{t('styleGuide.ai.globalHint')}</p>
                    <button type="button" className="ai-btn ai-btn--primary" onClick={() => { panel.reset(); setPanelOpen(true); }}>
                        <AiSpark size="sm" /> {t('styleGuide.ai.openGlobal')} <kbd>⌘J</kbd>
                    </button>
                </div>
            </div>

            <AiPopover
                open={fieldOpen}
                onClose={() => { field.reset(); setFieldOpen(false); }}
                anchor={fieldAnchor}
                generating={generating(field.phase)}
                ariaLabel={t('ai.spark.menuLabel')}
                width={360}
                closeLabel={t('common.close')}
                footer={field.phase === 'done' ? (
                    <div className="ai-showcase__actions">
                        <button type="button" className="ai-btn ai-btn--primary" onClick={() => { setFieldValue(field.text); setFieldOpen(false); field.reset(); }}>{t('ai.spark.apply')} <kbd>⏎</kbd></button>
                        <button type="button" className="ai-btn" onClick={() => field.start(FIELD_ANSWER)}><span className="material-symbols-outlined" aria-hidden="true">refresh</span></button>
                        <button type="button" className="ai-btn" onClick={() => { field.reset(); setFieldOpen(false); }}>{t('ai.spark.discard')} <kbd>Esc</kbd></button>
                    </div>
                ) : field.phase === 'idle' ? (
                    <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); field.start(FIELD_ANSWER); }}>
                        <input placeholder={t('ai.spark.customPlaceholder')} aria-label={t('ai.spark.customPlaceholder')} />
                    </form>
                ) : undefined}
            >
                {field.phase === 'idle' && (
                    <div className="ai-options" role="menu">
                        {ACTIONS.map(([icon, key]) => (
                            <button key={key} type="button" role="menuitem" className="ai-option" onClick={() => field.start(FIELD_ANSWER)}>
                                <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>{t(key)}
                            </button>
                        ))}
                    </div>
                )}
                {field.phase === 'thinking' && <AiThinking label={t('ai.spark.writing')} />}
                {(field.phase === 'streaming' || field.phase === 'done') && <AiStreamText text={field.text} streaming={field.phase === 'streaming'} />}
            </AiPopover>

            <AiPopover
                open={panelOpen}
                onClose={() => { panel.reset(); setPanelOpen(false); setExpanded(false); }}
                anchor={null}
                generating={generating(panel.phase)}
                expanded={expanded}
                onExpandedChange={setExpanded}
                ariaLabel={t('ai.panel.title')}
                width={420}
                closeLabel={t('common.close')}
                expandLabel={t('styleGuide.ai.expand')}
                collapseLabel={t('styleGuide.ai.collapse')}
                footer={(
                    <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); panel.start(PANEL_ANSWER); setQuestion(''); }}>
                        <textarea rows={1} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t('ai.panel.placeholder')} aria-label={t('ai.panel.placeholder')} />
                        <button type="submit" className="ai-send" aria-label={t('ai.panel.send')}>
                            <span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
                        </button>
                    </form>
                )}
            >
                <div className="ai-chips">
                    <span className="ai-chip"><span className="material-symbols-outlined" aria-hidden="true">folder</span>Mobile App v2</span>
                    <span className="ai-chip"><span className="material-symbols-outlined" aria-hidden="true">task_alt</span>Conflict resolution for offline edits</span>
                </div>
                {panel.phase === 'idle' && (
                    <div className="ai-suggestions">
                        {['ai.panel.suggest.overdue', 'ai.panel.suggest.taskNext', 'ai.panel.suggest.taskSplit'].map((key) => (
                            <button key={key} type="button" className="ai-suggestion" onClick={() => panel.start(PANEL_ANSWER)}>{t(key)}</button>
                        ))}
                    </div>
                )}
                {panel.phase === 'thinking' && <AiThinking label={t('ai.step.my_today')} />}
                {panel.phase === 'streaming' && <div className="ai-message"><AiMessageText text={panel.text} streaming /></div>}
                {panel.phase === 'done' && (
                    <>
                        <div className="ai-message"><AiMessageText text={panel.text} /></div>
                        <AiActionCard
                            proposal={DEMO_PROPOSAL}
                            onApply={() => new Promise((resolve) => window.setTimeout(() => resolve({ canUndo: true, createdId: null }), 600))}
                            onUndo={() => new Promise((resolve) => window.setTimeout(resolve, 400))}
                        />
                    </>
                )}
            </AiPopover>
        </div>
    );
};
