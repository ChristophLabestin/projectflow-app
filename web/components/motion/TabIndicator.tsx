import React, { useMemo, useRef } from 'react';
import { useSlidingIndicator } from './useSlidingIndicator';

/**
 * Sliding active-tab background. Put it first inside a tablist that has the class `motion-tabs`;
 * the active tab's own background is handed over to it once it is placed (see _motion.scss).
 * Tune per list with --motion-indicator-bg / -shadow / -radius.
 */
export const TabIndicator = ({ activeKey }: { activeKey: unknown }) => {
    const selfRef = useRef<HTMLSpanElement>(null);
    // The tablist is our parent; resolving it through our own node works on the first layout pass
    // (a parent's ref is attached only after its children's layout effects run).
    const listRef = useMemo(() => ({
        get current() { return selfRef.current?.parentElement ?? null; },
    }), []);
    const style = useSlidingIndicator(listRef, activeKey);
    return <span ref={selfRef} className="motion-indicator" style={style} aria-hidden="true" />;
};
