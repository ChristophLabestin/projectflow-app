import React from 'react';
import './skeleton.scss';

export interface SkeletonProps {
    variant?: 'text' | 'row' | 'card' | 'avatar';
    width?: string;
    height?: string;
    count?: number;
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    variant = 'text',
    width,
    height,
    count = 1,
    className = '',
}) => (
    <>
        {Array.from({ length: count }).map((_, index) => (
            <span
                key={index}
                className={`skeleton skeleton--${variant} ${className}`.trim()}
                style={{ width, height }}
                aria-hidden="true"
            />
        ))}
    </>
);

export interface SkeletonBlockProps {
    rows?: number;
    label?: string;
    className?: string;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ rows = 4, label = 'Loading', className = '' }) => (
    <div className={`skeleton-block ${className}`.trim()} aria-label={label}>
        <div className="skeleton-block__header">
            <Skeleton variant="avatar" />
            <div className="skeleton-block__title">
                <Skeleton width="60%" />
                <Skeleton width="38%" />
            </div>
        </div>
        <div className="skeleton-block__rows">
            <Skeleton variant="row" count={rows} />
        </div>
    </div>
);
