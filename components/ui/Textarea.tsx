import React from 'react';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, className = '', ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                {label && (
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    className={`
                        w-full 
                        bg-[var(--color-surface-bg)] 
                        border 
                        text-[var(--color-text-main)] 
                        rounded-xl 
                        py-2.5 
                        px-3
                        text-sm 
                        placeholder-[var(--color-text-subtle)] 
                        transition-all 
                        focus:outline-none 
                        focus:ring-2 
                        focus:ring-[var(--color-primary-fade)]
                        resize-y
                        min-h-[100px]
                        ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-surface-border)] focus:border-[var(--color-primary)]'}
                        ${className}
                    `}
                    style={{
                        backgroundColor: 'var(--color-surface-bg)',
                        color: 'var(--color-text-main)'
                    }}
                    {...props}
                />
                {error && (
                    <span className="text-xs text-[var(--color-error)] ml-1">{error}</span>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';
