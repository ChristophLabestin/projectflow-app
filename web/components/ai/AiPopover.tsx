import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePresence } from '../motion';
import { AiSpark } from './AiSpark';
import './ai-ds.scss';

/**
 * The one surface for every AI interaction (STYLING.md §1.9, COMPONENTS „In-app AI“): a floating glass
 * popover anchored at a point (caret), a rect (selection, field, button) or the top centre (⌘J).
 * Drag it by its header, expand it for long answers, Esc closes. While `generating`, a quiet shimmer
 * runs along the top edge and the spark turns.
 */
export type AiAnchor = { x: number; y: number } | DOMRect | null;

export interface AiPopoverProps {
    open: boolean;
    onClose: () => void;
    anchor?: AiAnchor;
    generating?: boolean;
    expanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    /** Text next to the spark (default: none — the AI has no name). */
    label?: React.ReactNode;
    headerExtra?: React.ReactNode;
    footer?: React.ReactNode;
    children: React.ReactNode;
    width?: number;
    closeOnOutside?: boolean;
    ariaLabel: string;
    expandLabel?: string;
    collapseLabel?: string;
    closeLabel?: string;
    className?: string;
}

const MARGIN = 12;
const GAP = 8;
const EXPANDED = { width: 680, maxHeight: 0.8 };

const isRect = (anchor: AiAnchor): anchor is DOMRect => Boolean(anchor && 'width' in anchor);

const place = (anchor: AiAnchor | undefined, width: number, height: number) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vw - width - MARGIN);
    const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh - height - MARGIN);
    if (!anchor) return { left: clampX((vw - width) / 2), top: clampY(Math.round(vh * 0.14)), origin: 'top center', above: false };
    const top = isRect(anchor) ? anchor.top : anchor.y;
    const bottom = isRect(anchor) ? anchor.bottom : anchor.y;
    const left = isRect(anchor) ? anchor.left : anchor.x - 24;
    const fitsBelow = bottom + GAP + height <= vh - MARGIN;
    const above = !fitsBelow && top - GAP - height >= MARGIN;
    return {
        left: clampX(left),
        top: clampY(above ? top - GAP - height : bottom + GAP),
        origin: `${above ? 'bottom' : 'top'} left`,
        above
    };
};

export const AiPopover: React.FC<AiPopoverProps> = ({
    open, onClose, anchor, generating = false, expanded = false, onExpandedChange, label, headerExtra, footer, children,
    width = 380, closeOnOutside = false, ariaLabel, expandLabel = 'Expand', collapseLabel = 'Collapse', closeLabel = 'Close', className = ''
}) => {
    const { mounted, exiting } = usePresence(open);
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ left: number; top: number; origin: string } | null>(null);
    const dragged = useRef(false);
    const drag = useRef<{ dx: number; dy: number } | null>(null);

    const currentWidth = expanded ? Math.min(EXPANDED.width, window.innerWidth - MARGIN * 2) : width;

    // Place on open / anchor / size change (until the user moved it).
    useLayoutEffect(() => {
        if (!open || !ref.current) return;
        if (!dragged.current) setPosition(place(anchor, currentWidth, ref.current.offsetHeight || 240));
    }, [open, anchor, currentWidth]);

    // Keep it inside the viewport when content grows or the window resizes.
    useEffect(() => {
        if (!open || !ref.current) return undefined;
        const fit = () => {
            const el = ref.current;
            if (!el) return;
            setPosition((current) => {
                if (!current) return current;
                const maxTop = window.innerHeight - el.offsetHeight - MARGIN;
                const maxLeft = window.innerWidth - el.offsetWidth - MARGIN;
                const top = Math.max(MARGIN, Math.min(current.top, maxTop));
                const left = Math.max(MARGIN, Math.min(current.left, maxLeft));
                return top === current.top && left === current.left ? current : { ...current, top, left };
            });
        };
        const observer = new ResizeObserver(fit);
        observer.observe(ref.current);
        window.addEventListener('resize', fit);
        return () => { observer.disconnect(); window.removeEventListener('resize', fit); };
    }, [open]);

    useEffect(() => { if (!open) dragged.current = false; }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        };
        const onPointer = (event: PointerEvent) => {
            if (closeOnOutside && ref.current && !ref.current.contains(event.target as Node)) onClose();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
    }, [open, onClose, closeOnOutside]);

    const onHeaderPointerDown = useCallback((event: React.PointerEvent) => {
        if ((event.target as HTMLElement).closest('button, a, input, textarea') || !position) return;
        drag.current = { dx: event.clientX - position.left, dy: event.clientY - position.top };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }, [position]);

    const onHeaderPointerMove = useCallback((event: React.PointerEvent) => {
        if (!drag.current || !ref.current) return;
        dragged.current = true;
        const el = ref.current;
        const left = Math.min(Math.max(MARGIN, event.clientX - drag.current.dx), window.innerWidth - el.offsetWidth - MARGIN);
        const top = Math.min(Math.max(MARGIN, event.clientY - drag.current.dy), window.innerHeight - el.offsetHeight - MARGIN);
        setPosition((current) => (current ? { ...current, left, top } : current));
    }, []);

    const endDrag = useCallback(() => { drag.current = null; }, []);

    if (!mounted) return null;

    return createPortal(
        <div
            ref={ref}
            role="dialog"
            aria-label={ariaLabel}
            className={`ai-popover ${expanded ? 'ai-popover--expanded' : ''} ${exiting ? 'is-exiting' : ''} ${className}`.trim()}
            data-generating={generating ? 'true' : 'false'}
            style={{
                width: currentWidth,
                left: position?.left ?? -9999,
                top: position?.top ?? -9999,
                transformOrigin: position?.origin,
                maxHeight: expanded ? `${Math.round(window.innerHeight * EXPANDED.maxHeight)}px` : undefined
            }}
        >
            <div
                className="ai-popover__head"
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
            >
                <span className="ai-popover__label">
                    <AiSpark size="sm" state={generating ? 'generating' : 'active'} />
                    {label}
                </span>
                <div className="ai-popover__head-actions">
                    {headerExtra}
                    {onExpandedChange && (
                        <button type="button" className="ai-popover__icon" onClick={() => onExpandedChange(!expanded)} aria-label={expanded ? collapseLabel : expandLabel} title={expanded ? collapseLabel : expandLabel}>
                            <span className="material-symbols-outlined" aria-hidden="true">{expanded ? 'close_fullscreen' : 'open_in_full'}</span>
                        </button>
                    )}
                    <button type="button" className="ai-popover__icon" onClick={onClose} aria-label={closeLabel} title={`${closeLabel} (Esc)`}>
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>
            </div>
            <div className="ai-popover__body">{children}</div>
            {footer && <div className="ai-popover__footer">{footer}</div>}
        </div>,
        document.body
    );
};
