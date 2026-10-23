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
        variantStyles = "bg-surface-hover text-muted border-surface";
    } else if (variant === 'primary') {
        variantStyles = "bg-primary/10 text-primary border-primary/20";
    } else if (variant === 'secondary') {
        variantStyles = "bg-surface-hover text-main border-surface";
    } else if (variant === 'success') {
        variantStyles = "bg-success/10 text-success border-success/20";
    } else if (variant === 'warning') {
        variantStyles = "bg-warning/10 text-warning border-warning/20";
    } else if (variant === 'error') {
        variantStyles = "bg-error/10 text-error border-error/20";
    } else if (variant === 'outline') {
        variantStyles = "bg-transparent text-subtle border-surface";
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
