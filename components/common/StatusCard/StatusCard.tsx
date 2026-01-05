import React from 'react';
import { Card } from '../Card/Card';
import './status-card.scss';

export type StatusTone = 'info' | 'success' | 'error';

interface StatusCardProps {
    title: string;
    message?: string;
    icon?: React.ReactNode;
    tone?: StatusTone;
    className?: string;
    children?: React.ReactNode;
}

export const StatusCard: React.FC<StatusCardProps> = ({
    title,
    message,
    icon,
    tone = 'info',
    className = '',
    children,
}) => {
    return (
        <Card className={`status-card status-card--${tone} ${className}`.trim()}>
            <div className="status-card__icon">
                {icon}
            </div>
            <div className="status-card__content">
                <h2 className="status-card__title">{title}</h2>
                {message && <p className="status-card__message">{message}</p>}
            </div>
            {children && <div className="status-card__extra">{children}</div>}
        </Card>
    );
};
