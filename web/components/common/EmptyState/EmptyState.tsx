import React from 'react';
import './empty-state.scss';

export interface EmptyStateProps {
    title: string;
    message?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    compact?: boolean;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    message,
    icon,
    actions,
    compact = false,
    className = '',
}) => (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`.trim()}>
        <div className="empty-state__icon" aria-hidden="true">
            {icon || <span className="material-symbols-outlined">inbox</span>}
        </div>
        <div className="empty-state__copy">
            <h3>{title}</h3>
            {message && <p>{message}</p>}
        </div>
        {actions && <div className="empty-state__actions">{actions}</div>}
    </div>
);
