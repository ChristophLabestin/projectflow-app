import React from 'react';
import './stepper.scss';

export type StepperStepStatus = 'complete' | 'current' | 'upcoming' | 'error';

export interface StepperStep {
    id: string;
    label: string;
    description?: string;
    status?: StepperStepStatus;
}

export interface StepperProps {
    steps: StepperStep[];
    onStepClick?: (step: StepperStep) => void;
    className?: string;
}

export const Stepper: React.FC<StepperProps> = ({ steps, onStepClick, className = '' }) => (
    <ol className={`stepper ${className}`.trim()}>
        {steps.map((step, index) => {
            const status = step.status || 'upcoming';
            const isClickable = !!onStepClick;
            const content = (
                <>
                    <span className="stepper__marker" aria-hidden="true">
                        {status === 'complete' ? (
                            <span className="material-symbols-outlined">check</span>
                        ) : (
                            index + 1
                        )}
                    </span>
                    <span className="stepper__copy">
                        <span className="stepper__label">{step.label}</span>
                        {step.description && <span className="stepper__description">{step.description}</span>}
                    </span>
                </>
            );

            return (
                <li key={step.id} className={`stepper__item stepper__item--${status}`.trim()}>
                    {isClickable ? (
                        <button type="button" onClick={() => onStepClick(step)} aria-current={status === 'current' ? 'step' : undefined}>
                            {content}
                        </button>
                    ) : (
                        <div aria-current={status === 'current' ? 'step' : undefined}>{content}</div>
                    )}
                </li>
            );
        })}
    </ol>
);
