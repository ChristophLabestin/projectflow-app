import { useEffect, useRef } from 'react';

export const BRAND_PALETTE_VARS = ['--brand-blue-rgb', '--brand-violet-rgb', '--brand-amber-rgb', '--brand-green-rgb'] as const;

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Resolves the brand palette from CSS custom properties ("59, 130, 246" → [59, 130, 246]). */
export const readBrandPalette = (element: Element): Array<[number, number, number]> => {
    const style = getComputedStyle(element);
    return BRAND_PALETTE_VARS.map((name) => {
        const parts = style.getPropertyValue(name).split(',').map((part) => Number(part.trim()));
        return parts.length === 3 && parts.every((value) => Number.isFinite(value))
            ? [parts[0], parts[1], parts[2]] as [number, number, number]
            : [128, 128, 128];
    });
};

/**
 * requestAnimationFrame loop that only runs while the element is on screen and the tab is visible.
 * With reduced motion it renders a single frame at a fixed time instead.
 */
export const useVisibleAnimationFrame = (
    ref: React.RefObject<Element | null>,
    frame: (seconds: number) => void,
    stillTime = 0.6
) => {
    const frameRef = useRef(frame);
    frameRef.current = frame;

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        if (prefersReducedMotion()) {
            frameRef.current(stillTime);
            return;
        }
        let handle = 0;
        let onScreen = false;
        const tick = (now: number) => {
            frameRef.current(now / 1000);
            handle = requestAnimationFrame(tick);
        };
        const sync = () => {
            const shouldRun = onScreen && document.visibilityState === 'visible';
            if (shouldRun && !handle) handle = requestAnimationFrame(tick);
            if (!shouldRun && handle) {
                cancelAnimationFrame(handle);
                handle = 0;
            }
        };
        const observer = new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
        });
        observer.observe(element);
        document.addEventListener('visibilitychange', sync);
        return () => {
            observer.disconnect();
            document.removeEventListener('visibilitychange', sync);
            if (handle) cancelAnimationFrame(handle);
        };
    }, [ref, stillTime]);
};
