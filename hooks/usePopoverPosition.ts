import { useState, useEffect, RefObject } from 'react';

/**
 * A hook to automatically position a popover above or below a trigger element
 * based on available screen space.
 * 
 * @param triggerRef Reference to the trigger element
 * @param contentRef Reference to the popover content element (to measure height)
 * @param isOpen Whether the popover is currently open
 * @param preferredPosition The preferred position ('bottom' or 'top'), defaults to 'bottom'
 * @returns The calculating position ('bottom' or 'top')
 */
export const usePopoverPosition = (
    triggerRef: RefObject<HTMLElement>,
    contentRef: RefObject<HTMLElement>,
    isOpen: boolean,
    preferredPosition: 'bottom' | 'top' = 'bottom'
): 'top' | 'bottom' => {
    const [position, setPosition] = useState<'top' | 'bottom'>(preferredPosition);

    useEffect(() => {
        if (!isOpen || !triggerRef.current) return;

        const updatePosition = () => {
            const triggerRect = triggerRef.current?.getBoundingClientRect();
            // Fallback height if contentRef is not yet available/rendered
            const contentHeight = contentRef.current?.offsetHeight || 300;

            if (!triggerRect) return;

            const windowHeight = window.innerHeight;
            const spaceBelow = windowHeight - triggerRect.bottom;
            const spaceAbove = triggerRect.top;

            // Padding/Margin buffer
            const buffer = 10;

            if (preferredPosition === 'bottom') {
                // If preferred bottom but not enough space, and there IS enough space above, flip to top
                if (spaceBelow < contentHeight + buffer && spaceAbove > contentHeight + buffer) {
                    setPosition('top');
                } else {
                    setPosition('bottom');
                }
            } else {
                // If preferred top but not enough space, and there IS enough space below, flip to bottom
                if (spaceAbove < contentHeight + buffer && spaceBelow > contentHeight + buffer) {
                    setPosition('bottom');
                } else {
                    setPosition('top');
                }
            }
        };

        // Run immediately
        updatePosition();

        // And on resize/scroll
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, triggerRef, contentRef, preferredPosition]);

    return position;
};
