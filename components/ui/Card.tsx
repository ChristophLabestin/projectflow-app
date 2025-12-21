import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hoverable?: boolean;
};

export const Card = ({ children, className = '', padding = 'md', hoverable = false, ...props }: CardProps) => {
    let paddingClass = "";
    if (padding === 'sm') paddingClass = "p-3";
    if (padding === 'md') paddingClass = "p-5";
    if (padding === 'lg') paddingClass = "p-8";

    return (
        <div
            className={`
                bg-[var(--color-surface-card)] 
                border border-[var(--color-surface-border)] 
                rounded-[var(--radius-lg)] 
                shadow-sm 
                ${hoverable ? 'hover:shadow-md transition-shadow duration-200 cursor-pointer' : ''} 
                ${paddingClass} 
                ${className}
            `}
            style={{
                backgroundColor: 'var(--color-surface-card)',
                borderColor: 'var(--color-surface-border)'
            }}
            {...props}
        >
            {children}
        </div>
    );
};
