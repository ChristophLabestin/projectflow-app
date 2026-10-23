import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Columns3, Download } from 'lucide-react';
import { downloadCsv } from '../lib/csv';
import { overlayOpen } from './Overlay';
import { Empty, Skeleton } from './primitives';

export type Column<T> = {
    key: string;
    label: string;
    render?: (row: T) => React.ReactNode;
    /** Value for sorting and CSV (defaults to row[key]). */
    value?: (row: T) => string | number | null | undefined;
    num?: boolean;
    hidden?: boolean;
    width?: number | string;
    wrap?: boolean;
};

type Props<T> = {
    id: string;
    rows: T[] | null;
    columns: Column<T>[];
    rowKey: (row: T) => string;
    onOpen?: (row: T) => void;
    loading?: boolean;
    defaultSort?: { key: string; dir: 'asc' | 'desc' };
    toolbar?: React.ReactNode;
    exportName?: string;
    emptyTitle?: string;
    emptyHint?: React.ReactNode;
    selectedKey?: string | null;
};

const isTyping = () => {
    const el = document.activeElement as HTMLElement | null;
    return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable));
};

/** Dense data table: sorting, column picker (persisted), CSV export, j/k/↑/↓ + Enter navigation. */
export function DataTable<T>({ id, rows, columns, rowKey, onOpen, loading, defaultSort, toolbar, exportName, emptyTitle = 'Keine Einträge', emptyHint, selectedKey }: Props<T>) {
    const storageKey = `pf.admin.cols.${id}`;
    const [hidden, setHidden] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            return stored ? JSON.parse(stored) : columns.filter((c) => c.hidden).map((c) => c.key);
        } catch {
            return [];
        }
    });
    const [sort, setSort] = useState(defaultSort ?? null);
    const [focus, setFocus] = useState(-1);
    const [colsOpen, setColsOpen] = useState(false);
    const bodyRef = useRef<HTMLTableSectionElement>(null);

    useEffect(() => localStorage.setItem(storageKey, JSON.stringify(hidden)), [hidden, storageKey]);

    const visible = columns.filter((c) => !hidden.includes(c.key));
    const valueOf = (column: Column<T>, row: T) => (column.value ? column.value(row) : (row as any)[column.key]);

    const sorted = useMemo(() => {
        if (!rows) return [];
        if (!sort) return rows;
        const column = columns.find((c) => c.key === sort.key);
        if (!column) return rows;
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            const va = valueOf(column, a);
            const vb = valueOf(column, b);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'de')) * dir;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, sort, columns]);

    useEffect(() => setFocus(-1), [rows]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (isTyping() || overlayOpen() || event.metaKey || event.ctrlKey || event.altKey || !sorted.length) return;
            if (event.key === 'j' || event.key === 'ArrowDown') {
                event.preventDefault();
                setFocus((f) => Math.min(sorted.length - 1, f + 1));
            } else if (event.key === 'k' || event.key === 'ArrowUp') {
                event.preventDefault();
                setFocus((f) => Math.max(0, f - 1));
            } else if (event.key === 'Enter' && focus >= 0 && onOpen) {
                event.preventDefault();
                onOpen(sorted[focus]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [sorted, focus, onOpen]);

    useEffect(() => {
        if (focus < 0) return;
        bodyRef.current?.children[focus]?.scrollIntoView({ block: 'nearest' });
    }, [focus]);

    const exportCsv = () => {
        downloadCsv(`${exportName || id}-${new Date().toISOString().slice(0, 10)}`, columns.map((c) => c.label), sorted.map((row) => columns.map((c) => valueOf(c, row))));
    };

    const toggleSort = (key: string) => setSort((current) => (current?.key === key ? (current.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }));

    return (
        <div>
            <div className="ac-toolbar">
                {toolbar}
                <span className="ac-toolbar__spacer" />
                <span className="ac-toolbar__count">{rows ? `${sorted.length} Einträge` : ''}</span>
                <div style={{ position: 'relative' }}>
                    <button className="ac-btn ac-btn--sm" onClick={() => setColsOpen((open) => !open)} aria-expanded={colsOpen}><Columns3 size={14} />Spalten</button>
                    {colsOpen && (
                        <div className="ac-cols-menu" onMouseLeave={() => setColsOpen(false)}>
                            {columns.map((c) => (
                                <label key={c.key}>
                                    <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => setHidden((h) => (h.includes(c.key) ? h.filter((k) => k !== c.key) : [...h, c.key]))} />
                                    {c.label}
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                <button className="ac-btn ac-btn--sm" onClick={exportCsv} disabled={!sorted.length}><Download size={14} />CSV</button>
            </div>
            <div className="ac-table-wrap">
                {loading && !rows ? <Skeleton /> : !sorted.length ? <Empty title={emptyTitle} hint={emptyHint} /> : (
                    <table className="ac-table">
                        <thead>
                            <tr>
                                {visible.map((c) => (
                                    <th key={c.key} style={{ width: c.width }} className={`is-sortable ${c.num ? 'is-num' : ''}`} onClick={() => toggleSort(c.key)} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        {c.label}
                                        {sort?.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody ref={bodyRef}>
                            {sorted.map((row, index) => {
                                const key = rowKey(row);
                                return (
                                    <tr key={key} className={`${onOpen ? 'is-clickable' : ''} ${index === focus || key === selectedKey ? 'is-focused' : ''}`} onClick={() => { setFocus(index); onOpen?.(row); }}>
                                        {visible.map((c) => (
                                            <td key={c.key} className={`${c.num ? 'is-num' : ''} ${c.wrap ? 'is-wrap' : ''}`}>{c.render ? c.render(row) : (valueOf(c, row) ?? '–')}</td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
