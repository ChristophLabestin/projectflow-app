import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { QUICK_ACTIONS } from '../../components/ai/AiFieldAssist';
import '../../components/ai/ai-family.scss';
import './ai-caret-demo.scss';

/**
 * `/ui` → AI: the ✦ at the caret, played through end to end with the real classes of AiFieldAssist
 * (no model call): typing → pause → ✦ fades in → click → menu with quick actions → preview below the
 * field → ⏎ apply → undo pill. Timings match the editor (`CARET_SPARK_DELAY_MS` = 800 ms).
 */
type Phase = 'idle' | 'typing' | 'pause' | 'chip' | 'click' | 'menu' | 'pick' | 'writing' | 'preview' | 'apply' | 'done';

const STEPS: Array<{ key: string; phases: Phase[] }> = [
    { key: 'type', phases: ['typing'] },
    { key: 'pause', phases: ['pause'] },
    { key: 'chip', phases: ['chip'] },
    { key: 'click', phases: ['click', 'menu', 'pick'] },
    { key: 'preview', phases: ['writing', 'preview'] },
    { key: 'apply', phases: ['apply', 'done'] }
];

export const AiCaretDemo: React.FC = () => {
    const { t } = useLanguage();
    const typed = t('styleGuide.ai.caretDemo.typed');
    const result = t('styleGuide.ai.caretDemo.result');
    const [phase, setPhase] = useState<Phase>('idle');
    const [chars, setChars] = useState(typed.length);
    const [streamed, setStreamed] = useState(0);
    const timers = useRef<number[]>([]);

    const clear = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };
    const at = (ms: number, run: () => void) => { timers.current.push(window.setTimeout(run, ms)); };

    const play = useCallback(() => {
        clear();
        setPhase('typing');
        setChars(0);
        setStreamed(0);
        const typeMs = 55;
        for (let i = 1; i <= typed.length; i++) at(i * typeMs, () => setChars(i));
        let time = typed.length * typeMs;
        at(time, () => setPhase('pause'));
        time += 800; // CARET_SPARK_DELAY_MS
        at(time, () => setPhase('chip'));
        time += 1300;
        at(time, () => setPhase('click'));
        time += 250;
        at(time, () => setPhase('menu'));
        time += 1200;
        at(time, () => setPhase('pick'));
        time += 450;
        at(time, () => setPhase('writing'));
        time += 700;
        const streamMs = 22;
        for (let i = 1; i <= result.length; i++) at(time + i * streamMs, () => setStreamed(i));
        time += result.length * streamMs;
        at(time, () => setPhase('preview'));
        time += 1400;
        at(time, () => setPhase('apply'));
        time += 450;
        at(time, () => setPhase('done'));
    }, [typed, result]);

    useEffect(() => clear, []);

    const before = ['idle', 'typing', 'pause', 'chip', 'click', 'menu', 'pick', 'writing', 'preview', 'apply'].includes(phase);
    const fieldText = phase === 'done' ? result : typed.slice(0, chars);
    const showCaret = phase !== 'done' && !['menu', 'pick', 'writing', 'preview', 'apply'].includes(phase);
    const activeStep = STEPS.findIndex((step) => step.phases.includes(phase));

    return (
        <div className="ai-caret-demo">
            <div className="ai-caret-demo__stage">
                <div className="ai-caret-demo__field" aria-hidden="true">
                    <span className="ai-caret-demo__text">
                        {fieldText}
                        <span className="ai-caret-demo__anchor">
                        {showCaret && <span className={`ai-caret-demo__caret${phase === 'typing' ? ' is-typing' : ''}`} />}
                        {(phase === 'chip' || phase === 'click') && (
                            <span className="ai-caret-chip ai-caret-demo__float ai-caret-demo__chip">
                                <button type="button" tabIndex={-1} className={phase === 'click' ? 'is-pressed' : ''}>
                                    <span className="ai-caret-chip__mark" aria-hidden="true">✦</span>{t('ai.label')}
                                </button>
                                <span className={`ai-caret-chip__tip${phase === 'chip' ? ' is-shown' : ''}`}>{t('ai.spark.tooltip')} <kbd>⌘J</kbd></span>
                            </span>
                        )}
                        {(phase === 'menu' || phase === 'pick') && (
                            <span className="ai-menu ai-caret-demo__float ai-caret-demo__menu">
                                <span className="ai-menu__head">
                                    <span><span aria-hidden="true">✦ </span>{t('ai.label')}</span>
                                    <span className="ai-menu__scope">{t('ai.spark.scope.all')}</span>
                                </span>
                                <span className="ai-menu__ask"><input tabIndex={-1} readOnly placeholder={t('ai.spark.customPlaceholder')} /></span>
                                <span className="ai-menu__list">
                                    {QUICK_ACTIONS.map(([action, icon], index) => (
                                        <button key={action} type="button" tabIndex={-1} className={phase === 'pick' && index === 0 ? 'is-pressed' : ''}>
                                            <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
                                            <span className="ai-menu__label">{t(`ai.action.${action}`)}</span>
                                            <kbd>{index + 1}</kbd>
                                        </button>
                                    ))}
                                </span>
                            </span>
                        )}
                        </span>
                    </span>
                </div>
                {(phase === 'writing' || phase === 'preview' || phase === 'apply') && (
                    <div className="ai-suggestion-card ai-caret-demo__card">
                        <div className="ai-suggestion-card__inner">
                            <div className="ai-suggestion-card__head"><span><span aria-hidden="true">✦ </span>{t('ai.spark.suggestion')}</span></div>
                            <p className="ai-suggestion-card__text">{result.slice(0, streamed) || '…'}</p>
                            <div className="ai-suggestion-card__actions">
                                {phase !== 'writing' && (
                                    <button type="button" tabIndex={-1} className={`ai-btn-primary${phase === 'apply' ? ' is-pressed' : ''}`}>{t('ai.spark.apply')} <kbd>⏎</kbd></button>
                                )}
                                <button type="button" tabIndex={-1} className="ai-btn-ghost">{phase === 'writing' ? t('ai.spark.stop') : t('ai.spark.discard')} <kbd>Esc</kbd></button>
                            </div>
                        </div>
                    </div>
                )}
                {phase === 'done' && (
                    <div className="ai-undo ai-caret-demo__undo">
                        <span className="ai-undo__text"><span aria-hidden="true">✦ </span>{t('ai.field.changed')}</span>
                        <button type="button" tabIndex={-1}>{t('ai.card.undo')} <kbd>⌘Z</kbd></button>
                    </div>
                )}
            </div>

            <ol className="ai-caret-demo__steps">
                {STEPS.map((step, index) => (
                    <li key={step.key} className={index === activeStep ? 'is-active' : index < activeStep || (!before && phase === 'done') ? 'is-done' : ''}>
                        {t(`styleGuide.ai.caretDemo.step.${step.key}`)}
                    </li>
                ))}
            </ol>
            <button type="button" className="ai-accent__replay" onClick={play}>
                {phase === 'idle' || phase === 'done' ? t('styleGuide.ai.accent.replay') : t('styleGuide.ai.caretDemo.restart')}
            </button>
        </div>
    );
};
