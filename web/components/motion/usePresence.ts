import { useEffect, useState } from 'react';
import { prefersReducedMotion } from '../brand/motion';
import { MOTION } from './tokens';

/**
 * Keeps an element mounted for its exit animation.
 * `mounted` → render it; `exiting` → add the exit class (e.g. `motion-exit`, `is-exiting`).
 */
export const usePresence = (open: boolean, exitMs: number = MOTION.exit) => {
    const [mounted, setMounted] = useState(open);

    useEffect(() => {
        if (open) {
            setMounted(true);
            return undefined;
        }
        if (prefersReducedMotion()) {
            setMounted(false);
            return undefined;
        }
        const timer = window.setTimeout(() => setMounted(false), exitMs);
        return () => window.clearTimeout(timer);
    }, [open, exitMs]);

    return { mounted: open || mounted, exiting: !open && mounted };
};
