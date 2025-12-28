import { useEffect, useCallback } from 'react';
import { useMindmap, LayoutType } from './useMindmapStore';
import { applyLayout } from '../utils/layoutAlgorithms';

// ============================================================================
// Keyboard Shortcuts Hook
// ============================================================================

interface UseKeyboardShortcutsProps {
    onAddNode?: () => void;
    onEditNode?: () => void;
    onOpenSearch?: () => void;
    onFitView?: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
}

export function useMindmapKeyboard({
    onAddNode,
    onEditNode,
    onOpenSearch,
    onFitView,
    onToggleFullscreen,
    isFullscreen,
}: UseKeyboardShortcutsProps = {}) {
    const {
        state,
        dispatch,
        undo,
        redo,
        deleteSelectedNodes,
        deselectAll,
        setLayout,
        setZoom,
        setNodes,
        pushHistory,
    } = useMindmap();

    // Apply layout with animation
    const applyLayoutWithHistory = useCallback((layout: LayoutType) => {
        pushHistory();
        const newNodes = applyLayout(state.nodes, layout);
        setNodes(newNodes);
        setLayout(layout);
    }, [state.nodes, setNodes, setLayout, pushHistory]);

    // Select all nodes
    const selectAll = useCallback(() => {
        dispatch({ type: 'SELECT_NODES', ids: state.nodes.map(n => n.id) });
    }, [state.nodes, dispatch]);

    // Duplicate selected nodes
    const duplicateSelected = useCallback(() => {
        if (state.selectedNodeIds.size === 0) return;

        pushHistory();
        const newNodes = [...state.nodes];
        const offset = 50;

        state.selectedNodeIds.forEach(id => {
            const original = state.nodes.find(n => n.id === id);
            if (original && original.type !== 'project') {
                const duplicate = {
                    ...original,
                    id: `${original.id}-copy-${Date.now()}`,
                    label: `${original.label} (copy)`,
                    position: {
                        x: original.position.x + offset,
                        y: original.position.y + offset,
                    },
                };
                newNodes.push(duplicate);
            }
        });

        setNodes(newNodes);
    }, [state.selectedNodeIds, state.nodes, setNodes, pushHistory]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const cmdKey = isMac ? e.metaKey : e.ctrlKey;

            // Undo: Cmd/Ctrl + Z
            if (cmdKey && !e.shiftKey && e.key === 'z') {
                e.preventDefault();
                undo();
                return;
            }

            // Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
            if ((cmdKey && e.shiftKey && e.key === 'z') || (cmdKey && e.key === 'y')) {
                e.preventDefault();
                redo();
                return;
            }

            // Select All: Cmd/Ctrl + A
            if (cmdKey && e.key === 'a') {
                e.preventDefault();
                selectAll();
                return;
            }

            // Duplicate: Cmd/Ctrl + D
            if (cmdKey && e.key === 'd') {
                e.preventDefault();
                duplicateSelected();
                return;
            }

            // Search: Cmd/Ctrl + F
            if (cmdKey && e.key === 'f') {
                e.preventDefault();
                onOpenSearch?.();
                return;
            }

            // Delete: Delete or Backspace
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (state.selectedNodeIds.size > 0) {
                    e.preventDefault();
                    deleteSelectedNodes();
                }
                return;
            }

            // Escape: Deselect all, close search, exit fullscreen
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    onToggleFullscreen?.();
                    return;
                }
                deselectAll();
                dispatch({ type: 'SET_SEARCH_OPEN', open: false });
                return;
            }

            // Fullscreen: F
            if (e.key === 'f' && !cmdKey) {
                e.preventDefault();
                onToggleFullscreen?.();
                return;
            }

            // Fit View: 0
            if (e.key === '0' && !cmdKey) {
                e.preventDefault();
                onFitView?.();
                return;
            }

            // Zoom: + / -
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                setZoom(state.zoom + 0.15);
                return;
            }
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                setZoom(state.zoom - 0.15);
                return;
            }

            // Quick Layout Switch: 1-5
            if (['1', '2', '3', '4', '5'].includes(e.key) && !cmdKey) {
                e.preventDefault();
                const layouts: LayoutType[] = ['radial', 'force', 'tree-vertical', 'tree-horizontal', 'grid'];
                const index = parseInt(e.key) - 1;
                if (index < layouts.length) {
                    applyLayoutWithHistory(layouts[index]);
                }
                return;
            }

            // Enter: Edit selected node
            if (e.key === 'Enter' && state.selectedNodeIds.size === 1) {
                e.preventDefault();
                onEditNode?.();
                return;
            }

            // N: Add new node
            if (e.key === 'n' && !cmdKey) {
                e.preventDefault();
                onAddNode?.();
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        state.zoom,
        state.selectedNodeIds,
        undo,
        redo,
        selectAll,
        duplicateSelected,
        deleteSelectedNodes,
        deselectAll,
        setZoom,
        applyLayoutWithHistory,
        onAddNode,
        onEditNode,
        onOpenSearch,
        onFitView,
        onToggleFullscreen,
        isFullscreen,
        dispatch,
    ]);

    return {
        selectAll,
        duplicateSelected,
        applyLayoutWithHistory,
    };
}

export default useMindmapKeyboard;
