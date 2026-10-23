import { useLayoutEffect, useState } from 'react';

type IndicatorStyle = { transform: string; width: number; height: number; opacity: number };

const HIDDEN: IndicatorStyle = { transform: 'translate(0px, 0px)', width: 0, height: 0, opacity: 0 };

/**
 * Position of a sliding tab/segment indicator under the active item of `containerRef`.
 * Render an absolutely positioned element with the returned style and the class `motion-indicator`
 * (transitions transform + width). `activeSelector` picks the active child, e.g. '[aria-selected="true"]'.
 */
export const useSlidingIndicator = (
    containerRef: React.RefObject<HTMLElement | null>,
    activeKey: unknown,
    activeSelector = '[aria-selected="true"], [data-active="true"], .is-active'
) => {
    const [style, setStyle] = useState<IndicatorStyle>(HIDDEN);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;
        const measure = () => {
            const active = container.querySelector<HTMLElement>(activeSelector);
            if (!active) {
                setStyle((current) => (current.opacity === 0 ? current : { ...current, opacity: 0 }));
                return;
            }
            setStyle({
                transform: `translate(${active.offsetLeft}px, ${active.offsetTop}px)`,
                width: active.offsetWidth,
                height: active.offsetHeight,
                opacity: 1,
            });
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, [containerRef, activeKey, activeSelector]);

    return style;
};
