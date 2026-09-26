import { useCallback, useEffect, useRef, useState } from 'react';

import { parseDateValue, toIsoDate } from '../../utils/taskDates';

const DAY_MS = 86400000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

/** Whole calendar days between two dates (DST-safe). */
export const dayDiff = (from: Date, to: Date) => Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);

export const toDate = (value?: string | null) => {
    if (!value) return null;
    const date = parseDateValue(value);
    return Number.isNaN(date.getTime()) ? null : startOfDay(date);
};

export interface TimeScale {
    start: Date;
    days: number;
    dayWidth: number;
    width: number;
    x: (date: Date) => number;
    /** Left position + width for an inclusive date range (end day included). */
    span: (start: Date, end: Date) => { left: number; width: number };
}

/**
 * Linear day scale covering every given date plus padding, always including
 * today so "now" is visible.
 */
export const buildTimeScale = (
    dates: (Date | null | undefined)[],
    { dayWidth, padBefore = 7, padAfter = 14, minDays = 42 }: { dayWidth: number; padBefore?: number; padAfter?: number; minDays?: number }
): TimeScale => {
    const today = startOfDay(new Date());
    const valid = [today, ...dates.filter((date): date is Date => !!date)];
    const min = valid.reduce((a, b) => (a < b ? a : b));
    const max = valid.reduce((a, b) => (a > b ? a : b));
    const start = addDays(min, -padBefore);
    const days = Math.max(minDays, dayDiff(start, max) + 1 + padAfter);
    return {
        start,
        days,
        dayWidth,
        width: days * dayWidth,
        x: (date) => dayDiff(start, date) * dayWidth,
        span: (from, to) => {
            const left = dayDiff(start, from) * dayWidth;
            return { left, width: Math.max(dayWidth, (dayDiff(from, to) + 1) * dayWidth) };
        }
    };
};

export type BarDragMode = 'move' | 'start' | 'end';

export interface BarDragPreview {
    id: string;
    start: Date;
    end: Date;
}

/**
 * Pointer-driven drag for date bars: move the whole bar or resize either edge
 * in whole days. `onCommit` receives ISO dates once the pointer is released.
 */
export const useBarDrag = (
    dayWidth: number,
    onCommit: (id: string, dates: { startDate: string; dueDate: string }) => void
) => {
    const [preview, setPreviewState] = useState<BarDragPreview | null>(null);
    const previewRef = useRef<BarDragPreview | null>(null);
    const setPreview = (next: BarDragPreview | null) => {
        previewRef.current = next;
        setPreviewState(next);
    };
    const dragRef = useRef<{ id: string; mode: BarDragMode; originX: number; start: Date; end: Date; moved: boolean } | null>(null);

    const onPointerDown = useCallback((event: React.PointerEvent, id: string, mode: BarDragMode, start: Date, end: Date) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        dragRef.current = { id, mode, originX: event.clientX, start, end, moved: false };
    }, []);

    const onPointerMove = useCallback((event: React.PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const delta = Math.round((event.clientX - drag.originX) / dayWidth);
        if (delta !== 0) drag.moved = true;
        let start = drag.start;
        let end = drag.end;
        if (drag.mode === 'move') {
            start = addDays(drag.start, delta);
            end = addDays(drag.end, delta);
        } else if (drag.mode === 'start') {
            start = addDays(drag.start, delta);
            if (start > end) start = end;
        } else {
            end = addDays(drag.end, delta);
            if (end < start) end = start;
        }
        setPreview({ id: drag.id, start, end });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayWidth]);

    const onPointerUp = useCallback(() => {
        const drag = dragRef.current;
        const current = previewRef.current;
        dragRef.current = null;
        setPreview(null);
        if (drag && drag.moved && current && current.id === drag.id) {
            onCommit(drag.id, { startDate: toIsoDate(current.start), dueDate: toIsoDate(current.end) });
        }
        return !!drag?.moved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onCommit]);

    /** True while the last pointer interaction dragged (suppresses click-to-open). */
    const wasDragRef = useRef(false);
    const handlers = {
        onPointerMove,
        onPointerUp: () => { wasDragRef.current = onPointerUp(); },
        onPointerCancel: () => { dragRef.current = null; setPreview(null); }
    };

    return { preview, onPointerDown, handlers, wasDragRef };
};

/** Scale over a fixed [start, end] range (inclusive) with a given day width. */
export const buildRangeScale = (start: Date, end: Date, dayWidth: number): TimeScale => {
    const from = startOfDay(start);
    const days = Math.max(1, dayDiff(from, end) + 1);
    return {
        start: from,
        days,
        dayWidth,
        width: days * dayWidth,
        x: (date) => dayDiff(from, date) * dayWidth,
        span: (a, b) => ({ left: dayDiff(from, a) * dayWidth, width: Math.max(dayWidth * 2, (dayDiff(a, b) + 1) * dayWidth) })
    };
};

/** Tracks an element's content width (for fitting charts to their card). */
export const useElementWidth = <T extends HTMLElement>() => {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const element = ref.current;
        if (!element) return undefined;
        const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width || 0));
        observer.observe(element);
        setWidth(element.clientWidth);
        return () => observer.disconnect();
    }, []);
    return { ref, width };
};
