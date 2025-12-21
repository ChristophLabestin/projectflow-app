import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    icon?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, icon, className = '', ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                {label && (
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)] pointer-events-none group-focus-within:text-[var(--color-primary)] transition-colors">
                            <span className="material-symbols-outlined text-[20px]">{icon}</span>
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
                            w-full 
                            bg-[var(--color-surface-bg)] 
                            border 
                            text-[var(--color-text-main)] 
                            rounded-xl 
                            py-2.5 
                            ${icon ? 'pl-10' : 'pl-3'} 
                            pr-3 
                            text-sm 
                            placeholder-[var(--color-text-subtle)] 
                            transition-all 
                            focus:outline-none 
                            focus:ring-2 
                            focus:ring-[var(--color-primary-fade)]
                            ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-surface-border)] focus:border-[var(--color-primary)]'}
                            ${className}
                        `}
                        style={{
                            backgroundColor: 'var(--color-surface-bg)',
                            color: 'var(--color-text-main)'
                        }}
                        {...props}
                    />
                </div>
                {error && (
                    <span className="text-xs text-[var(--color-error)] ml-1">{error}</span>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
