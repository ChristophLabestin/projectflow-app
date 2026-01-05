import React, { useId } from 'react';
import './text-input.scss';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helpText?: string;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
    label,
    error,
    helpText,
    leftElement,
    rightElement,
    className = '',
    id,
    ...props
}) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helpId = helpText ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
        <div className={`text-input-group ${className}`.trim()}>
            {label && (
                <label htmlFor={inputId} className="text-input-group__label">
                    {label}
                </label>
            )}
            <div className="text-input-group__input-wrapper" style={{ position: 'relative' }}>
                {leftElement && (
                    <div className="text-input__left-element">
                        {leftElement}
                    </div>
                )}
                <input
                    id={inputId}
                    className={`text-input ${error ? 'text-input--error' : ''}`}
                    aria-invalid={!!error}
                    aria-describedby={[errorId, helpId].filter(Boolean).join(' ')}
                    style={{
                        paddingLeft: leftElement ? '40px' : '12px',
                        paddingRight: rightElement ? '40px' : '12px',
                        ...props.style,
                    }}
                    {...props}
                />
                {rightElement && (
                    <div className="text-input__right-element">
                        {rightElement}
                    </div>
                )}
            </div>
            {error && (
                <p id={errorId} className="text-input-group__error" role="alert">
                    {error}
                </p>
            )}
            {!error && helpText && (
                <p id={helpId} className="text-input-group__help">
                    {helpText}
                </p>
            )}
        </div>
    );
};
