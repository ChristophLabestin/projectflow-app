import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';

export type OnboardingStep = {
    id: string;
    title: string;
    description: string;
    targetId: string;
    placement?: 'top' | 'right' | 'bottom' | 'left';
};

type OnboardingOverlayProps = {
    isOpen: boolean;
    steps: OnboardingStep[];
    stepIndex: number;
    onStepChange: (index: number) => void;
    onFinish: () => void;
    onSkip: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const OnboardingOverlay = ({
    isOpen,
    steps,
    stepIndex,
    onStepChange,
    onFinish,
    onSkip
}: OnboardingOverlayProps) => {
    const { t } = useLanguage();
    const tooltipRef = useRef<HTMLDivElement | null>(null);
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties | null>(null);

    const activeStep = useMemo(() => steps[stepIndex], [steps, stepIndex]);
    const stepCounter = t('onboarding.stepCounter')
        .replace('{current}', String(stepIndex + 1))
        .replace('{total}', String(steps.length));

    const resolveTarget = (targetId: string) => {
        return document.querySelector(`[data-onboarding-id="${targetId}"]`) as HTMLElement | null;
    };

    const findNextAvailableStep = (startIndex: number) => {
        if (!steps.length) return -1;
        for (let offset = 0; offset < steps.length; offset += 1) {
            const idx = (startIndex + offset) % steps.length;
            const candidate = steps[idx];
            if (candidate && resolveTarget(candidate.targetId)) {
                return idx;
            }
        }
        return -1;
    };

    const updatePositions = (element: HTMLElement, placement: OnboardingStep['placement']) => {
        const rect = element.getBoundingClientRect();
        const highlightPadding = 8;
        const radiusValue = parseFloat(window.getComputedStyle(element).borderRadius || '12');
        const radius = Number.isNaN(radiusValue) ? 12 : radiusValue + highlightPadding;

        setHighlightStyle({
            top: Math.max(rect.top - highlightPadding, 0),
            left: Math.max(rect.left - highlightPadding, 0),
            width: rect.width + highlightPadding * 2,
            height: rect.height + highlightPadding * 2,
            borderRadius: `${radius}px`
        });

        requestAnimationFrame(() => {
            const tooltip = tooltipRef.current;
            const tooltipWidth = tooltip?.offsetWidth || 320;
            const tooltipHeight = tooltip?.offsetHeight || 180;
            const offset = 12;

            let top = rect.bottom + offset;
            let left = rect.left;

            if (placement === 'top') {
                top = rect.top - tooltipHeight - offset;
            } else if (placement === 'left') {
                left = rect.left - tooltipWidth - offset;
                top = rect.top;
            } else if (placement === 'right') {
                left = rect.right + offset;
                top = rect.top;
            }

            const maxLeft = window.innerWidth - tooltipWidth - offset;
            const maxTop = window.innerHeight - tooltipHeight - offset;
            left = clamp(left, offset, Math.max(offset, maxLeft));
            top = clamp(top, offset, Math.max(offset, maxTop));

            setTooltipStyle({ top, left });
        });
    };

    useEffect(() => {
        if (!isOpen || !activeStep) return;

        const target = resolveTarget(activeStep.targetId);
        if (!target) {
            const nextIndex = findNextAvailableStep(stepIndex + 1);
            if (nextIndex !== -1 && nextIndex !== stepIndex) {
                onStepChange(nextIndex);
            } else {
                onFinish();
            }
            return;
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        updatePositions(target, activeStep.placement);

        const handleResize = () => updatePositions(target, activeStep.placement);
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, [activeStep, isOpen, onFinish, onStepChange, stepIndex]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onSkip();
                return;
            }
            if (event.key === 'ArrowRight') {
                if (stepIndex >= steps.length - 1) {
                    onFinish();
                } else {
                    onStepChange(stepIndex + 1);
                }
            }
            if (event.key === 'ArrowLeft' && stepIndex > 0) {
                onStepChange(stepIndex - 1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onFinish, onSkip, onStepChange, stepIndex, steps.length]);

    if (!isOpen || !activeStep || !highlightStyle || !tooltipStyle) return null;

    const isLastStep = stepIndex === steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
            onFinish();
            return;
        }
        onStepChange(stepIndex + 1);
    };

    const handlePrev = () => {
        if (stepIndex === 0) return;
        onStepChange(stepIndex - 1);
    };

    return createPortal(
        <div className="fixed inset-0 z-[90]">
            <div className="absolute inset-0" aria-hidden="true" />
            <div
                className="absolute transition-all duration-200 ease-out pointer-events-none"
                style={{
                    ...highlightStyle,
                    border: '2px solid var(--color-primary)',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)',
                    background: 'rgba(255,255,255,0.02)'
                }}
            />
            <div
                ref={tooltipRef}
                className="absolute w-[320px] max-w-[90vw] rounded-2xl border border-surface bg-card shadow-2xl p-4 space-y-3 pointer-events-auto"
                style={tooltipStyle}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            {stepCounter}
                        </div>
                        <h4 className="text-base font-bold text-main mt-1">
                            {activeStep.title}
                        </h4>
                    </div>
                    <button
                        type="button"
                        onClick={onSkip}
                        className="p-1 rounded-full text-muted hover:bg-surface-hover hover:text-main transition-colors"
                        aria-label={t('onboarding.skip')}
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
                <p className="text-sm text-muted leading-relaxed">
                    {activeStep.description}
                </p>
                <div className="pt-3 border-t border-surface flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onSkip}
                        className="text-xs font-semibold text-muted hover:text-main transition-colors"
                    >
                        {t('onboarding.skip')}
                    </button>
                    <div className="flex items-center gap-2">
                        {stepIndex > 0 && (
                            <Button variant="ghost" size="sm" onClick={handlePrev}>
                                {t('onboarding.back')}
                            </Button>
                        )}
                        <Button size="sm" onClick={handleNext}>
                            {isLastStep ? t('onboarding.finish') : t('onboarding.next')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
