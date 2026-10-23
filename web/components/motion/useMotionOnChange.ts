import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../brand/motion';
import { MOTION } from './tokens';

type Preset = 'route' | 'fade' | 'rise' | 'tick';

const PRESETS: Record<Preset, { keyframes: Keyframe[]; duration: number }> = {
    route: { keyframes: [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], duration: MOTION.slow },
    fade: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: MOTION.base },
    rise: { keyframes: [{ opacity: 0, transform: `translateY(${MOTION.rise}px)` }, { opacity: 1, transform: 'none' }], duration: MOTION.base },
    tick: { keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'scale(1)' }], duration: MOTION.base },
};

/**
 * Plays a one-off entrance on `ref` whenever `key` changes (not on first mount). The element is not
 * remounted, so state below it survives – used for route content, tab panels and counters.
 */
export const useMotionOnChange = (ref: React.RefObject<HTMLElement | null>, key: unknown, preset: Preset = 'fade') => {
    const previous = useRef(key);

    useEffect(() => {
        if (Object.is(previous.current, key)) return;
        previous.current = key;
        const element = ref.current;
        if (!element || prefersReducedMotion() || typeof element.animate !== 'function') return;
        const { keyframes, duration } = PRESETS[preset];
        element.animate(keyframes, { duration, easing: MOTION.easeOut });
    }, [key, preset, ref]);
};
