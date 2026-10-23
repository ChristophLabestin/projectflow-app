import React from 'react';
import './brand.scss';

interface StatusDotsProps {
    size?: 'xs' | 'sm' | 'md';
    /** `wave`: dots rise one after another (loading / thinking). `static`: quiet accent. */
    motion?: 'wave' | 'static';
    className?: string;
    /** Accessible label; without one the dots are decorative. */
    label?: string;
}

/** The four brand hues (open, planning, review, done) as a row of dots. */
export const StatusDots = ({ size = 'sm', motion = 'static', className = '', label }: StatusDotsProps) => (
    <span
        className={`status-dots status-dots--${size}${motion === 'wave' ? ' status-dots--wave' : ''} ${className}`.trim()}
        {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
        <i /><i /><i /><i />
    </span>
);

/** Thin track with a gliding brand-gradient segment (port of iOS PFLoadingTrack). */
export const LoadingTrack = ({ className = '' }: { className?: string }) => (
    <span className={`loading-track ${className}`.trim()} aria-hidden="true" />
);
