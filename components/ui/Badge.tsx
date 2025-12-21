import React from 'react';

type BadgeProps = {
    children: React.ReactNode;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
    className?: string;
};

export const Badge = ({ children, variant = 'default', size = 'md', className = '' }: {
    children: React.ReactNode;
    variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
    size?: 'sm' | 'md';
    className?: string;
}) => {
    let variantStyles = "";

    if (variant === 'default') {
        variantStyles = "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border-[var(--color-surface-border)]";
    } else if (variant === 'primary') {
        variantStyles = "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800";
    } else if (variant === 'secondary') {
        variantStyles = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    } else if (variant === 'success') {
        variantStyles = "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800";
    } else if (variant === 'warning') {
        variantStyles = "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800";
    } else if (variant === 'error') {
        variantStyles = "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border-rose-100 dark:border-rose-800";
    } else if (variant === 'outline') {
        variantStyles = "bg-transparent text-[var(--color-text-subtle)] border-[var(--color-surface-border)]";
    }

    const sizeStyles = size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2.5 py-0.5 text-[11px]';

    return (
        <span
            className={`
                inline-flex items-center 
                ${sizeStyles}
                rounded-full 
                font-bold uppercase tracking-wider 
                border 
                ${variantStyles} 
                ${className}
            `}
        >
            {children}
        </span>
    );
};
