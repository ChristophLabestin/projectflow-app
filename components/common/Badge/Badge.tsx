import React from 'react';
import './badge.scss';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'neutral' | 'success' | 'warning' | 'error';
    children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    className = '',
    ...props
}) => {
    return (
        <span className={`badge badge--${variant} ${className}`.trim()} {...props}>
            {children}
        </span>
    );
};
