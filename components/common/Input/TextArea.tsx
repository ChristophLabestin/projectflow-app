import React, { useId } from 'react';
import './text-area.scss';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helpText?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
    label,
    error,
    helpText,
    className = '',
    id,
    ...props
}) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helpId = helpText ? `${inputId}-help` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
        <div className={`text-area-group ${className}`.trim()}>
            {label && (
                <label htmlFor={inputId} className="text-area-group__label">
                    {label}
                </label>
            )}
            <textarea
                id={inputId}
                className={`text-area ${error ? 'text-area--error' : ''}`}
                aria-invalid={!!error}
                aria-describedby={[errorId, helpId].filter(Boolean).join(' ')}
                {...props}
            />
            {error && (
                <p id={errorId} className="text-area-group__error" role="alert">
                    {error}
                </p>
            )}
            {!error && helpText && (
                <p id={helpId} className="text-area-group__help">
                    {helpText}
                </p>
            )}
        </div>
    );
};
