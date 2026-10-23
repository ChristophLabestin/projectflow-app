import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { desktopWindowKind, getDesktopBridge } from '../services/desktop';
import { completeItem } from '../services/desktopActions';
import { loadDesktopSearchItems, rankDesktopSearchItems, type DesktopSearchItem } from '../services/desktopSearch';

const REFRESH_AFTER_MS = 60 * 1000;
/** Removed on sign-out (services/firebase.ts). */
export const PALETTE_CACHE_PREFIX = 'pf_desktop_palette_items_';
const ICONS: Record<DesktopSearchItem['kind'], string> = { project: 'folder', task: 'task_alt', 'personal-task': 'lock' };

type Row = { type: 'item'; item: DesktopSearchItem } | { type: 'create'; text: string };

/**
 * Desktop app only: the command palette (global shortcut, Raycast-like). Search projects and my open tasks;
 * ↩ opens in the main window, ⌘↩ completes a task, ⌥↩ starts a focus on it, the last row creates a task
 * from the query (Quick Capture). Hidden again after every action.
 */
export const DesktopCommandPalette = () => {
    const bridge = getDesktopBridge();
    const { t } = useLanguage();
    const { activeWorkspaceId, status: workspaceStatus, refresh: refreshWorkspace } = useWorkspace();
    const { startFocusItem } = usePinnedTasks();
    const [items, setItems] = useState<DesktopSearchItem[]>([]);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const loadedAt = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const isMac = bridge?.platform === 'darwin';
    const mod = isMac ? '⌘' : 'Ctrl';
    const alt = isMac ? '⌥' : 'Alt';

    // The last results are kept locally, so the palette shows them at once (also offline) and refreshes behind.
    const load = useCallback(async () => {
        if (!activeWorkspaceId) return;
        const key = `${PALETTE_CACHE_PREFIX}${activeWorkspaceId}`;
        loadedAt.current = Date.now();
        setItems((current) => {
            if (current.length) return current;
            try {
                return JSON.parse(localStorage.getItem(key) || '[]') as DesktopSearchItem[];
            } catch {
                return current;
            }
        });
        try {
            const fresh = await loadDesktopSearchItems(activeWorkspaceId);
            setItems(fresh);
            localStorage.setItem(key, JSON.stringify(fresh));
        } catch {
            // offline / failed: keep what we have
        }
    }, [activeWorkspaceId]);

    useEffect(() => { void load(); }, [load]);

    // Shown again (shortcut; the shell sends a payload): fresh query, refreshed data when stale.
    useEffect(() => {
        const onFocus = () => {
            setQuery('');
            setIndex(0);
            setMessage(null);
            if (workspaceStatus === 'error') void refreshWorkspace();
            if (Date.now() - loadedAt.current > REFRESH_AFTER_MS) void load();
            requestAnimationFrame(() => inputRef.current?.focus());
        };
        const unsubscribe = bridge?.onWindowPayload?.(onFocus);
        return () => unsubscribe?.();
    }, [bridge, load, workspaceStatus, refreshWorkspace]);

    const rows = useMemo<Row[]>(() => {
        const found: Row[] = rankDesktopSearchItems(items, query).map((item) => ({ type: 'item', item }));
        return query.trim() ? [...found, { type: 'create', text: query.trim() }] : found;
    }, [items, query]);

    useEffect(() => setIndex(0), [query]);

    if (!bridge || desktopWindowKind() !== 'palette') return <Navigate to="/" replace />;

    const close = () => bridge.closeSelf?.();

    const run = async (row: Row | undefined, action: 'open' | 'complete' | 'focus') => {
        if (!row || busy) return;
        if (row.type === 'create') {
            close();
            bridge.openWindow?.({ kind: 'capture', text: row.text });
            return;
        }
        const { item } = row;
        if (action === 'open' || item.kind === 'project') {
            bridge.openInMain(item.path);
            close();
            return;
        }
        if (action === 'focus') {
            if (item.kind !== 'task' || !item.projectId) {
                setMessage(t('desktop.palette.focusNeedsProject'));
                return;
            }
            startFocusItem({ id: item.id, type: 'task', title: item.title, projectId: item.projectId, tenantId: item.tenantId });
            close();
            return;
        }
        setBusy(true);
        try {
            await completeItem({ id: item.id, type: item.kind === 'task' ? 'task' : 'personal-task', projectId: item.projectId, tenantId: item.tenantId });
            setItems((current) => current.filter((entry) => entry.id !== item.id));
            setMessage(t('desktop.palette.completed').replace('{title}', item.title));
        } catch {
            setMessage(t('desktop.toast.actionFailed'));
        } finally {
            setBusy(false);
        }
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIndex((current) => Math.min(current + 1, rows.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const modKey = isMac ? event.metaKey : event.ctrlKey;
            void run(rows[index], modKey ? 'complete' : event.altKey ? 'focus' : 'open');
        }
    };

    const active = rows[index];
    const activeIsTask = active?.type === 'item' && active.item.kind !== 'project';

    return (
        <div className="command-palette">
            <div className="command-palette__card" onKeyDown={onKeyDown}>
                <div className="command-palette__field">
                    <span className="material-symbols-outlined command-palette__icon">search</span>
                    <input
                        ref={inputRef}
                        autoFocus
                        className="command-palette__input"
                        value={query}
                        placeholder={t('desktop.palette.placeholder')}
                        aria-label={t('desktop.palette.placeholder')}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <ul className="command-palette__list" role="listbox" aria-label={t('desktop.palette.results')}>
                    {rows.map((row, rowIndex) => (
                        <li key={row.type === 'item' ? `${row.item.kind}-${row.item.id}` : 'create'}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={rowIndex === index}
                                className={`command-palette__row ${rowIndex === index ? 'is-active' : ''}`.trim()}
                                onMouseEnter={() => setIndex(rowIndex)}
                                onClick={() => void run(row, 'open')}
                            >
                                <span className="material-symbols-outlined">{row.type === 'create' ? 'add_task' : ICONS[row.item.kind]}</span>
                                <span className="command-palette__title">
                                    {row.type === 'create' ? t('desktop.palette.create').replace('{text}', row.text) : row.item.title}
                                </span>
                                {row.type === 'item' && (
                                    <span className="command-palette__context">
                                        {row.item.kind === 'project' ? t('desktop.palette.kind.project')
                                            : row.item.kind === 'personal-task' ? t('desktop.palette.kind.personal') : row.item.context}
                                    </span>
                                )}
                            </button>
                        </li>
                    ))}
                    {rows.length === 0 && <li className="command-palette__empty">{t(items.length ? 'desktop.palette.noResults' : 'desktop.palette.loading')}</li>}
                </ul>
                <div className="command-palette__footer">
                    {message ? <span className="command-palette__message">{message}</span> : (
                        <>
                            <span><kbd>↩</kbd> {t('desktop.palette.hint.open')}</span>
                            {activeIsTask && <span><kbd>{mod}↩</kbd> {t('desktop.palette.hint.complete')}</span>}
                            {activeIsTask && <span><kbd>{alt}↩</kbd> {t('desktop.palette.hint.focus')}</span>}
                            <span><kbd>esc</kbd> {t('desktop.palette.hint.close')}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
