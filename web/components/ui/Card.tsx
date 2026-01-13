import React from 'react';
import './card.scss';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hoverable?: boolean;
};

export const Card = ({ children, className = '', padding = 'md', hoverable = false, ...props }: CardProps) => {
    let paddingClass = "";
    if (padding === 'sm') paddingClass = "ui-card--pad-sm";
    if (padding === 'md') paddingClass = "ui-card--pad-md";
    if (padding === 'lg') paddingClass = "ui-card--pad-lg";

    return (
        <div
            className={`ui-card ${hoverable ? 'ui-card--hoverable' : ''} ${paddingClass} ${className}`.trim()}
            {...props}
        >
            {children}
        </div>
    );
};
