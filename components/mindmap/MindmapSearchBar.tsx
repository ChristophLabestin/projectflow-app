import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useMindmap } from './hooks/useMindmapStore';

// ============================================================================
// Search Bar Component
// ============================================================================

interface MindmapSearchBarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MindmapSearchBar = memo(function MindmapSearchBar({ isOpen, onClose }: MindmapSearchBarProps) {
    const { state, dispatch, setPan, setZoom } = useMindmap();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter nodes by search query
    const results = state.nodes.filter(node =>
        query.length > 0 && (
            node.label.toLowerCase().includes(query.toLowerCase()) ||
            node.type.toLowerCase().includes(query.toLowerCase()) ||
            node.groupName?.toLowerCase().includes(query.toLowerCase())
        )
    );

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen]);

    // Update search query in state
    useEffect(() => {
        dispatch({ type: 'SET_SEARCH_QUERY', query });
    }, [query, dispatch]);

    // Clear on close
    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    // Navigate to a node
    const navigateToNode = useCallback((nodeId: string) => {
        const node = state.nodes.find(n => n.id === nodeId);
        if (!node) return;

        dispatch({ type: 'SELECT_NODES', ids: [nodeId] });
        setPan({
            x: -node.position.x + 600,
            y: -node.position.y + 350,
        });
        setZoom(1);
        onClose();
    }, [state.nodes, dispatch, setPan, setZoom, onClose]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, results.length - 1));
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
            return;
        }

        if (e.key === 'Enter' && results.length > 0) {
            e.preventDefault();
            navigateToNode(results[selectedIndex].id);
            return;
        }
    }, [results, selectedIndex, navigateToNode, onClose]);

    if (!isOpen) return null;

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl shadow-xl overflow-hidden">
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-surface-border)]">
                    <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">search</span>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search nodes..."
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] outline-none text-sm"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] rounded-lg"
                    >
                        ESC
                    </button>
                </div>

                {/* Results */}
                {query.length > 0 && (
                    <div className="max-h-64 overflow-y-auto">
                        {results.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-3xl mb-2 block opacity-50">search_off</span>
                                No nodes found
                            </div>
                        ) : (
                            results.map((node, index) => (
                                <button
                                    key={node.id}
                                    onClick={() => navigateToNode(node.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                        ${index === selectedIndex
                                            ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                            : 'hover:bg-[var(--color-surface-hover)]'
                                        }
                                    `}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center">
                                        <span className={`material-symbols-outlined text-[16px] ${node.type === 'project' ? 'text-indigo-500' :
                                                node.type === 'group' ? 'text-violet-500' :
                                                    node.type === 'idea' ? 'text-amber-500' :
                                                        node.type === 'task' ? 'text-emerald-500' :
                                                            node.type === 'issue' ? 'text-rose-500' :
                                                                'text-blue-500'
                                            }`}>
                                            {node.type === 'project' ? 'hub' :
                                                node.type === 'group' ? 'category' :
                                                    node.type === 'idea' ? 'lightbulb' :
                                                        node.type === 'task' ? 'task_alt' :
                                                            node.type === 'issue' ? 'bug_report' :
                                                                'flag'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-[var(--color-text-main)] truncate">
                                            {node.label}
                                        </div>
                                        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-2">
                                            <span className="capitalize">{node.type}</span>
                                            {node.groupName && (
                                                <>
                                                    <span>•</span>
                                                    <span>{node.groupName}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-[16px] text-[var(--color-text-subtle)]">arrow_forward</span>
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Helper text */}
                {query.length === 0 && (
                    <div className="px-4 py-4 text-xs text-[var(--color-text-muted)] text-center">
                        Type to search • ↑↓ Navigate • Enter to select
                    </div>
                )}
            </div>
        </div>
    );
});

export default MindmapSearchBar;
