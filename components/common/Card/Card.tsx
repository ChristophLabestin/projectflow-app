import React from 'react';
import './card.scss';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`card ${className}`.trim()} {...props}>
            {children}
        </div>
    );
};

export const CardHeader: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`card__header ${className}`.trim()} {...props}>
            {children}
        </div>
    );
};

export const CardBody: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`card__body ${className}`.trim()} {...props}>
            {children}
        </div>
    );
};

export const CardFooter: React.FC<CardProps> = ({ children, className = '', ...props }) => {
    return (
        <div className={`card__footer ${className}`.trim()} {...props}>
            {children}
        </div>
    );
};
