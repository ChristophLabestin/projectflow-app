import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../brand/motion';

type AnimatedNumberProps = {
    value: number;
    /** Formats every frame (default: rounded, locale grouping). */
    format?: (value: number) => string;
    duration?: number;
    className?: string;
};

const defaultFormat = (value: number) => Math.round(value).toLocaleString();
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counter that tweens to a new value (ease-out). The first render shows the value directly, so
 * pages do not count up on every load; only changes animate. Screen readers get the final value.
 */
export const AnimatedNumber = ({ value, format = defaultFormat, duration = 420, className }: AnimatedNumberProps) => {
    const [display, setDisplay] = useState(value);
    const fromRef = useRef(value);
    const frameRef = useRef(0);

    useEffect(() => {
        const from = fromRef.current;
        if (from === value || prefersReducedMotion() || !Number.isFinite(value) || !Number.isFinite(from)) {
            fromRef.current = value;
            setDisplay(value);
            return undefined;
        }
        const start = performance.now();
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const current = from + (value - from) * easeOutCubic(t);
            fromRef.current = current;
            setDisplay(t === 1 ? value : current);
            if (t < 1) frameRef.current = requestAnimationFrame(step);
        };
        frameRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frameRef.current);
    }, [value, duration]);

    return (
        <span className={`motion-number ${className || ''}`.trim()}>
            <span aria-hidden="true">{format(display)}</span>
            <span className="motion-number__sr">{format(value)}</span>
        </span>
    );
};
