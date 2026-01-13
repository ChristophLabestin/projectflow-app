import React from 'react';
import { useArrowReplacement } from '../../hooks/useArrowReplacement';
import { TextArea } from '../common/Input/TextArea';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
    helpText?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, helpText, className = '', onChange, ...props }, ref) => {
        const handleChange = useArrowReplacement(onChange);

        return (
            <TextArea
                ref={ref}
                label={label}
                error={error}
                helpText={helpText}
                className={className}
                onChange={handleChange}
                {...props}
            />
        );
    }
);

Textarea.displayName = 'Textarea';
