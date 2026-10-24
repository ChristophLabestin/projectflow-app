import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { playCompletionBurst } from '../../components/brand';
import { AiWorking } from '../../components/ai/AiWorking';
import '../../components/ai/ai-family.scss';
import './ai-accent-showcase.scss';

/**
 * `/ui` → AI: brand accent before/after (proposal, not live). The real classes of the AI family are used;
 * the toggle only sets `data-ai-accent="brand"` on this container, exactly like the live switch would.
 */
export const AiAccentShowcase: React.FC = () => {
    const { t } = useLanguage();
    const [brand, setBrand] = useState(true);
    const [working, setWorking] = useState(true);
    const [chipOpen, setChipOpen] = useState(false);
    const [applied, setApplied] = useState(false);
    const [generating, setGenerating] = useState(false);
    const applyRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!chipOpen) return undefined;
        const timer = window.setTimeout(() => setChipOpen(false), 900);
        return () => window.clearTimeout(timer);
    }, [chipOpen]);

    const generate = () => {
        setGenerating(true);
        window.setTimeout(() => setGenerating(false), 2600);
    };

    return (
        <div className="ai-accent" data-ai-accent={brand ? 'brand' : undefined}>
            <div className="ai-accent__switch" role="radiogroup" aria-label={t('styleGuide.ai.accent.toggle')}>
                <button type="button" role="radio" aria-checked={!brand} className={!brand ? 'is-on' : ''} onClick={() => setBrand(false)}>{t('styleGuide.ai.accent.off')}</button>
                <button type="button" role="radio" aria-checked={brand} className={brand ? 'is-on' : ''} onClick={() => setBrand(true)}>{t('styleGuide.ai.accent.on')}</button>
            </div>

            <div className="ai-accent__grid">
                <section>
                    <h4>{t('styleGuide.ai.accent.working')}</h4>
                    <div className="ai-accent__stage">{working ? <AiWorking label={t('ai.step.get_task')} /> : <span className="ai-accent__text">Conflict resolution is in progress and overdue …</span>}</div>
                    <button type="button" className="ai-accent__replay" onClick={() => { setWorking(true); window.setTimeout(() => setWorking(false), 2200); }}>{t('styleGuide.ai.accent.replay')}</button>
                </section>

                <section>
                    <h4>{t('styleGuide.ai.accent.caret')}</h4>
                    <div className="ai-accent__stage">
                        <span className="ai-accent__line">login fails after reset<span className="ai-accent__caret" /></span>
                        <span className="ai-caret-chip ai-accent__static">
                            <button type="button" aria-expanded={chipOpen} aria-label={t('ai.spark.open')}><span className="ai-caret-chip__mark" aria-hidden="true">✦</span>{t('ai.label')}</button>
                        </span>
                    </div>
                    <button type="button" className="ai-accent__replay" onClick={() => { setChipOpen(false); window.requestAnimationFrame(() => setChipOpen(true)); }}>{t('styleGuide.ai.accent.replay')}</button>
                </section>

                <section>
                    <h4>{t('styleGuide.ai.accent.apply')}</h4>
                    <div className="ai-accent__stage">
                        <div className="ai-suggestion-card__actions ai-accent__bar">
                            {applied ? <span className="ai-accent__text">{t('ai.field.changed')}</span> : (
                                <>
                                    <button ref={applyRef} type="button" className="ai-btn-primary" onClick={() => { if (brand) playCompletionBurst(applyRef.current); setApplied(true); }}>{t('ai.spark.apply')} <kbd>⏎</kbd></button>
                                    <button type="button" className="ai-btn-ghost">{t('ai.spark.discard')} <kbd>Esc</kbd></button>
                                </>
                            )}
                        </div>
                    </div>
                    <button type="button" className="ai-accent__replay" onClick={() => setApplied(false)}>{t('styleGuide.ai.accent.replay')}</button>
                </section>

                <section>
                    <h4>{t('styleGuide.ai.accent.bar')}</h4>
                    <div className="ai-accent__stage">
                        <div className="ai-bar ai-accent__static-bar" data-generating={generating ? 'true' : 'false'}>
                            <div className="ai-bar__input"><span className="ai-bar__mark" aria-hidden="true">✦</span><span className="ai-accent__text">What is overdue for me?</span></div>
                            <div className="ai-bar__body">{generating ? <AiWorking label={t('ai.step.my_today')} /> : <span className="ai-accent__text">You have 2 overdue tasks.</span>}</div>
                        </div>
                    </div>
                    <button type="button" className="ai-accent__replay" onClick={generate}>{t('styleGuide.ai.accent.replay')}</button>
                </section>
            </div>
        </div>
    );
};
