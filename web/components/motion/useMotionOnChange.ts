import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../brand/motion';
import { MOTION } from './tokens';

type Preset = 'route' | 'fade' | 'rise' | 'tick' | 'directional';

const PRESETS: Record<Preset, { keyframes: Keyframe[]; duration: number }> = {
    route: { keyframes: [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], duration: MOTION.slow },
    fade: { keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: MOTION.base },
    rise: { keyframes: [{ opacity: 0, transform: `translateY(${MOTION.rise}px)` }, { opacity: 1, transform: 'none' }], duration: MOTION.base },
    // Placeholder; 'directional' slides from the side the numeric key moved towards.
    directional: { keyframes: [], duration: MOTION.slow },
    tick: { keyframes: [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.4 }, { transform: 'scale(1)' }], duration: MOTION.base },
};

/**
 * Plays a one-off entrance on `ref` whenever `key` changes (not on first mount). The element is not
 * remounted, so state below it survives – used for route content, tab panels and counters.
 * 'directional' expects a numeric key (e.g. a date's time) and slides in from the side it moved to.
 */
export const useMotionOnChange = (ref: React.RefObject<HTMLElement | null>, key: unknown, preset: Preset = 'fade') => {
    const previous = useRef(key);

    useEffect(() => {
        if (Object.is(previous.current, key)) return;
        const before = previous.current;
        previous.current = key;
        const element = ref.current;
        if (!element || prefersReducedMotion() || typeof element.animate !== 'function') return;
        const { duration } = PRESETS[preset];
        let { keyframes } = PRESETS[preset];
        if (preset === 'directional') {
            const sign = Number(key) >= Number(before) ? 1 : -1;
            keyframes = [{ opacity: 0, transform: `translateX(${sign * MOTION.rise * 2}px)` }, { opacity: 1, transform: 'none' }];
        }
        element.animate(keyframes, { duration, easing: MOTION.easeOut });
    }, [key, preset, ref]);
};
