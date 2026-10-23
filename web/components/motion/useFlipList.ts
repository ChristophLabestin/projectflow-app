import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../brand/motion';
import { MOTION } from './tokens';

type FlipOptions = {
    /** Attribute holding each item's stable key (default `data-flip-key`, e.g. `data-task-id`). */
    keyAttribute?: string;
    /** Fade/rise newly added items in. */
    enter?: boolean;
    /** Let removed items slide out (a detached copy is animated in place, then dropped). */
    exit?: boolean;
    /** Keys that just landed via drag & drop: they settle in place instead of gliding from their old slot. */
    settleKeys?: React.MutableRefObject<Set<string>>;
    /** Skip all motion while true (e.g. during an active drag, which animates itself). */
    disabled?: boolean;
};

type Snapshot = { x: number; y: number; width: number; height: number; node: HTMLElement; parent: Node | null; next: Node | null };

const MAX_ANIMATED = 80;

/**
 * FLIP list motion: reordered items glide to their new slot, new items rise in, removed items slide
 * away. Positions are measured relative to the container (scroll-compensated), so scrolling between
 * renders never animates. Runs after every commit of the owning component; costs one rect read per item.
 */
export const useFlipList = (containerRef: React.RefObject<HTMLElement | null>, options: FlipOptions = {}) => {
    const { keyAttribute = 'data-flip-key', enter = true, exit = true, disabled = false, settleKeys } = options;
    const snapshots = useRef(new Map<string, Snapshot>());
    const ready = useRef(false);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const origin = container.getBoundingClientRect();
        const items = Array.from(container.querySelectorAll<HTMLElement>(`[${keyAttribute}]`));
        const animate = ready.current && !disabled && !prefersReducedMotion() && typeof container.animate === 'function';
        const next = new Map<string, Snapshot>();
        const viewport = window.innerHeight || document.documentElement.clientHeight;
        let budget = MAX_ANIMATED;

        for (const node of items) {
            const key = node.getAttribute(keyAttribute);
            if (!key || node.dataset.flipGhost) continue;
            const rect = node.getBoundingClientRect();
            const snap: Snapshot = {
                x: rect.left - origin.left + container.scrollLeft,
                y: rect.top - origin.top + container.scrollTop,
                width: rect.width,
                height: rect.height,
                node,
                parent: node.parentNode,
                next: node.nextSibling,
            };
            next.set(key, snap);
            if (!animate || budget <= 0) continue;
            const inView = !viewport || (rect.bottom > 0 && rect.top < viewport);
            const prev = snapshots.current.get(key);
            if (settleKeys?.current.has(key) && (!prev || Math.abs(prev.x - snap.x) > 0.5 || Math.abs(prev.y - snap.y) > 0.5)) {
                settleKeys.current.delete(key);
                budget -= 1;
                node.animate(
                    [{ opacity: 0.5, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
                    { duration: MOTION.slow, easing: MOTION.spring }
                );
            } else if (prev) {
                const dx = prev.x - snap.x;
                const dy = prev.y - snap.y;
                if ((Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) && inView) {
                    budget -= 1;
                    node.animate(
                        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
                        { duration: MOTION.slow, easing: MOTION.easeOut }
                    );
                }
            } else if (enter && inView) {
                budget -= 1;
                node.animate(
                    [{ opacity: 0, transform: `translateY(${MOTION.rise}px)` }, { opacity: 1, transform: 'none' }],
                    { duration: MOTION.base, easing: MOTION.easeOut, fill: 'backwards' }
                );
            }
        }

        if (animate && exit) {
            snapshots.current.forEach((prev, key) => {
                if (next.has(key) || prev.node.isConnected || !prev.parent || !(prev.parent as Element).isConnected) return;
                if (budget <= 0) return;
                budget -= 1;
                const ghost = prev.node;
                ghost.dataset.flipGhost = 'true';
                ghost.setAttribute('aria-hidden', 'true');
                ghost.removeAttribute('id');
                Object.assign(ghost.style, {
                    position: 'absolute', top: '0px', left: '0px', margin: '0px',
                    width: `${prev.width}px`, height: `${prev.height}px`, pointerEvents: 'none', zIndex: '1',
                });
                const anchor = prev.next && prev.next.parentNode === prev.parent ? prev.next : null;
                prev.parent.insertBefore(ghost, anchor);
                const placed = ghost.getBoundingClientRect();
                const dx = prev.x - (placed.left - origin.left + container.scrollLeft);
                const dy = prev.y - (placed.top - origin.top + container.scrollTop);
                const base = `translate(${dx}px, ${dy}px)`;
                const motion = ghost.animate(
                    [{ opacity: 1, transform: base }, { opacity: 0, transform: `${base} translateX(${MOTION.rise * 3}px)` }],
                    { duration: MOTION.base, easing: MOTION.easeIn, fill: 'forwards' }
                );
                const drop = () => ghost.remove();
                motion.onfinish = drop;
                motion.oncancel = drop;
                // Background tabs pause the animation timeline; never leave a ghost behind.
                window.setTimeout(drop, MOTION.base + 100);
            });
        }

        snapshots.current = next;
        ready.current = true;
    });
};
