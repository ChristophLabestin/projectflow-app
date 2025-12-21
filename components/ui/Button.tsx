import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    icon?: React.ReactNode;
};

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    isLoading,
    icon,
    disabled,
    ...props
}: ButtonProps) => {

    const baseStyles = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";



    // Mapping to our new index.css classes manually for now to ensure explicit control
    let variantClass = "";
    if (variant === 'primary') {
        variantClass = "bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 shadow-md transform active:scale-95";
    } else if (variant === 'secondary') {
        variantClass = "bg-[var(--color-surface-card)] text-[var(--color-text-main)] border border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]";
    } else if (variant === 'ghost') {
        variantClass = "bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]";
    } else if (variant === 'danger') {
        variantClass = "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100";
    }

    let sizeClass = "";
    if (size === 'sm') sizeClass = "text-xs px-3 py-1.5 gap-1.5 h-8";
    if (size === 'md') sizeClass = "text-sm px-4 py-2 gap-2 h-10";
    if (size === 'lg') sizeClass = "text-base px-6 py-3 gap-3 h-12";
    if (size === 'icon') sizeClass = "p-2 w-10 h-10 justify-center";

    return (
        <button
            className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`}
            disabled={isLoading || disabled}
            style={{
                // Fallback for dynamic colors if needed
                backgroundColor: variant === 'primary' ? 'var(--color-primary)' : undefined,
                color: variant === 'primary' ? 'var(--color-primary-text)' : undefined,
                borderColor: variant === 'primary' ? 'transparent' : undefined,
            }}
            {...props}
        >
            {isLoading && (
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
            )}
            {!isLoading && icon && <span className="flex items-center">{icon}</span>}
            {!isLoading && children}
        </button>
    );
};
