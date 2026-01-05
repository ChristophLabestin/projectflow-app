import React from 'react';
import { useArrowReplacement } from '../../hooks/useArrowReplacement';
import { TextInput } from '../common/Input/TextInput';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    icon?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, className = '', onChange, ...props }, ref) => {
        const handleChange = useArrowReplacement(onChange);
        const leftElement = icon ? (
            <span className="material-symbols-outlined" aria-hidden="true">
                {icon}
            </span>
        ) : undefined;

        return (
            <TextInput
                ref={ref}
                label={label}
                error={error}
                leftElement={leftElement}
                className={className}
                onChange={handleChange}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';
