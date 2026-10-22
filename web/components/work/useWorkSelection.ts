import { useCallback, useEffect, useRef, useState } from 'react';

const isTyping = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    return !!element && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
};

/**
 * Multi-select state for work lists.
 *
 * - `toggle(id, { range: true })` selects everything between the last clicked
 *   row and `id`, in the order rows are rendered inside `listRef` (so collapsed
 *   groups are skipped).
 * - Selection mode is the explicit "Select" toggle (touch devices have no hover
 *   checkboxes); while it is on, a row click selects instead of opening.
 * - Keyboard: Escape clears the selection, `x` toggles the row that has focus.
 */
export const useWorkSelection = ({ enabled = true, availableIds }: { enabled?: boolean; availableIds?: string[] } = {}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const anchorRef = useRef<string | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const orderedIds = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-task-id]') || [])
        .map((element) => element.dataset.taskId as string);

    const toggle = useCallback((id: string, options: { range?: boolean } = {}) => {
        // Read the anchor and row order now: the state updater may run later.
        const anchor = anchorRef.current;
        const order = options.range && anchor ? orderedIds() : [];
        setSelectedIds((current) => {
            const next = new Set(current);
            const from = order.indexOf(anchor || '');
            const to = order.indexOf(id);
            if (from >= 0 && to >= 0) {
                const shouldSelect = !current.has(id);
                order.slice(Math.min(from, to), Math.max(from, to) + 1).forEach((entry) => {
                    if (shouldSelect) next.add(entry); else next.delete(entry);
                });
            } else if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
        anchorRef.current = id;
    }, []);

    const setMany = useCallback((ids: string[], selected: boolean) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            ids.forEach((id) => (selected ? next.add(id) : next.delete(id)));
            return next;
        });
    }, []);

    const clear = useCallback(() => {
        setSelectedIds(new Set());
        setSelectionMode(false);
        anchorRef.current = null;
    }, []);

    // Drop ids of tasks that no longer exist (deleted elsewhere, filtered by the subscription).
    const availableKey = availableIds?.join('|');
    useEffect(() => {
        if (!availableIds) return;
        const available = new Set(availableIds);
        setSelectedIds((current) => {
            const next = new Set(Array.from(current).filter((id) => available.has(id)));
            return next.size === current.size ? current : next;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availableKey]);

    const isSelecting = enabled && (selectionMode || selectedIds.size > 0);

    useEffect(() => {
        if (!enabled) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
            if (document.querySelector('[aria-modal="true"]')) return;
            // Escape from a drawer or popover elsewhere closes that, not the selection.
            const target = event.target as HTMLElement | null;
            const inPage = !target || target === document.body || !!target.closest?.('.work-page');
            if (event.key === 'Escape' && isSelecting && inPage) {
                event.preventDefault();
                clear();
                return;
            }
            if (event.key.toLowerCase() === 'x') {
                const row = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-task-id]');
                if (!row?.dataset.taskId || !listRef.current?.contains(row)) return;
                event.preventDefault();
                toggle(row.dataset.taskId, { range: event.shiftKey });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [enabled, isSelecting, clear, toggle]);

    return {
        selectedIds,
        isSelecting,
        selectionMode,
        setSelectionMode,
        toggle,
        setMany,
        clear,
        listRef
    };
};
