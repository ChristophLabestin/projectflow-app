import React, { useId } from 'react';
import './checkbox.scss';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ label, className = '', id, disabled, ...props }, ref) => {
        const generatedId = useId();
        const inputId = id || generatedId;

        return (
            <label
                className={`checkbox ${className}`.trim()}
                data-disabled={disabled ? 'true' : 'false'}
            >
                <input
                    id={inputId}
                    ref={ref}
                    type="checkbox"
                    className="checkbox__input"
                    disabled={disabled}
                    {...props}
                />
                <span className="checkbox__box">
                    <span className="material-symbols-outlined checkbox__icon">check</span>
                </span>
                {label && <span className="checkbox__label">{label}</span>}
            </label>
        );
    }
);

Checkbox.displayName = 'Checkbox';
