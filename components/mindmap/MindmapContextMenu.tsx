import React, { memo, useCallback, useEffect, useRef } from 'react';
import { useMindmap, MindmapNodeData } from './hooks/useMindmapStore';

// ============================================================================
// Types
// ============================================================================

interface MindmapContextMenuProps {
    position: { x: number; y: number } | null;
    targetNode: MindmapNodeData | null;
    onClose: () => void;
}

interface MenuItemProps {
    icon: string;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    danger?: boolean;
    shortcut?: string;
}

// ============================================================================
// Menu Item
// ============================================================================

const MenuItem = memo(function MenuItem({ icon, label, onClick, disabled, danger, shortcut }: MenuItemProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-lg mx-1
                ${disabled
                    ? 'opacity-40 cursor-not-allowed text-[var(--color-text-muted)]'
                    : danger
                        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                        : 'text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                }
            `}
            style={{ width: 'calc(100% - 8px)' }}
        >
            <span className={`material-symbols-outlined text-[18px] ${danger ? '' : 'text-[var(--color-text-muted)]'}`}>
                {icon}
            </span>
            <span className="flex-1 text-left">{label}</span>
            {shortcut && (
                <span className="text-xs text-[var(--color-text-subtle)] font-mono bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded">
                    {shortcut}
                </span>
            )}
        </button>
    );
});

// ============================================================================
// Menu Divider
// ============================================================================

const MenuDivider = () => (
    <div className="h-px bg-[var(--color-surface-border)] my-1.5 mx-3" />
);

// ============================================================================
// Context Menu Component
// ============================================================================

export const MindmapContextMenu = memo(function MindmapContextMenu({
    position,
    targetNode,
    onClose,
}: MindmapContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const { state, dispatch, deleteSelectedNodes, pushHistory, setNodes } = useMindmap();

    // Close on outside click
    useEffect(() => {
        if (!position) return;

        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleScroll = () => onClose();

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('scroll', handleScroll, true);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [position, onClose]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Actions
    const handleAddChildIdea = useCallback(() => {
        if (!targetNode) return;
        pushHistory();

        const newNode: MindmapNodeData = {
            id: `idea-${Date.now()}`,
            type: 'idea',
            label: 'New Idea',
            parentId: targetNode.id,
            groupName: targetNode.groupName,
            position: {
                x: targetNode.position.x + 150,
                y: targetNode.position.y + 80,
            },
        };

        setNodes([...state.nodes, newNode]);
        dispatch({ type: 'SELECT_NODES', ids: [newNode.id] });
        onClose();
    }, [targetNode, state.nodes, setNodes, dispatch, pushHistory, onClose]);

    const handleDuplicate = useCallback(() => {
        if (!targetNode || targetNode.type === 'project') return;
        pushHistory();

        const newNode = {
            ...targetNode,
            id: `${targetNode.id}-copy-${Date.now()}`,
            label: `${targetNode.label} (copy)`,
            position: {
                x: targetNode.position.x + 50,
                y: targetNode.position.y + 50,
            },
        };

        setNodes([...state.nodes, newNode]);
        dispatch({ type: 'SELECT_NODES', ids: [newNode.id] });
        onClose();
    }, [targetNode, state.nodes, setNodes, dispatch, pushHistory, onClose]);

    const handleSelectAll = useCallback(() => {
        dispatch({ type: 'SELECT_NODES', ids: state.nodes.map(n => n.id) });
        onClose();
    }, [state.nodes, dispatch, onClose]);

    const handleDelete = useCallback(() => {
        if (targetNode) {
            dispatch({ type: 'SELECT_NODES', ids: [targetNode.id] });
        }
        deleteSelectedNodes();
        onClose();
    }, [targetNode, dispatch, deleteSelectedNodes, onClose]);

    if (!position) return null;

    // Adjust position to stay within viewport
    const adjustedX = Math.min(position.x, window.innerWidth - 220);
    const adjustedY = Math.min(position.y, window.innerHeight - 300);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[200px] py-2 rounded-2xl bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] shadow-xl animate-in fade-in zoom-in-95 duration-150"
            style={{ left: adjustedX, top: adjustedY }}
        >
            {targetNode ? (
                <>
                    {/* Node Header */}
                    <div className="px-4 py-2 mb-1">
                        <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                            {targetNode.type}
                        </div>
                        <div className="text-sm font-medium text-[var(--color-text-main)] truncate max-w-[180px]">
                            {targetNode.label}
                        </div>
                    </div>
                    <MenuDivider />

                    {/* Node Actions */}
                    <MenuItem icon="add" label="Add Child Idea" onClick={handleAddChildIdea} />
                    <MenuItem icon="content_copy" label="Duplicate" onClick={handleDuplicate} shortcut="⌘D" disabled={targetNode.type === 'project'} />

                    <MenuDivider />

                    <MenuItem icon="delete" label="Delete" onClick={handleDelete} danger disabled={targetNode.type === 'project'} shortcut="Del" />
                </>
            ) : (
                <>
                    {/* Canvas Actions */}
                    <MenuItem icon="lightbulb" label="Add New Idea" onClick={handleAddChildIdea} />
                    <MenuItem icon="select_all" label="Select All" onClick={handleSelectAll} shortcut="⌘A" />

                    <MenuDivider />

                    {state.selectedNodeIds.size > 0 && (
                        <>
                            <MenuItem
                                icon="delete"
                                label={`Delete ${state.selectedNodeIds.size} selected`}
                                onClick={handleDelete}
                                danger
                            />
                            <MenuDivider />
                        </>
                    )}

                    <div className="px-4 py-2 text-xs text-[var(--color-text-muted)]">
                        Right-click a node for more options
                    </div>
                </>
            )}
        </div>
    );
});

export default MindmapContextMenu;
