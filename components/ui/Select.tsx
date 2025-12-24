import React from 'react';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    error?: string;
    icon?: string;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, icon, className = '', children, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                {label && (
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider ml-1">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {icon && (
                        <div className="absolute left-3 inset-y-0 flex items-center justify-center text-[var(--color-text-subtle)] pointer-events-none group-focus-within:text-[var(--color-primary)] transition-colors">
                            <span className="material-symbols-outlined text-[20px] leading-none">{icon}</span>
                        </div>
                    )}
                    <select
                        ref={ref}
                        className={`
                            w-full 
                            bg-[var(--color-surface-bg)] 
                            border 
                            text-[var(--color-text-main)] 
                            rounded-xl 
                            py-2.5 
                            ${icon ? 'pl-10' : 'pl-3'} 
                            pr-10 
                            text-sm 
                            placeholder-[var(--color-text-subtle)] 
                            transition-all 
                            focus:outline-none 
                            focus:ring-0
                            focus:ring-offset-0
                            appearance-none
                            [&::-webkit-calendar-picker-indicator]:hidden
                            [&::-ms-expand]:hidden
                            ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-surface-border)]'}
                            ${className}
                        `}

                        {...props}
                    >
                        {children}
                    </select>
                </div>
                {error && (
                    <span className="text-xs text-[var(--color-error)] ml-1">{error}</span>
                )}
            </div>
        );
    }
);

Select.displayName = 'Select';
