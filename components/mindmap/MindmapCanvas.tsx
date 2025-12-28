import React, { useCallback, useRef, useState, useEffect, useMemo, memo } from 'react';
import { useMindmap } from './hooks/useMindmapStore';
import { MindmapNode } from './MindmapNode';
import { MindmapEdge } from './MindmapEdge';

// ============================================================================
// Constants
// ============================================================================

const CANVAS_SIZE = 4000;
const GRID_SIZE = 50;

// ============================================================================
// Grid Background Pattern
// ============================================================================

const GridPattern = memo(function GridPattern() {
    return (
        <defs>
            <pattern
                id="mindmap-grid-dots"
                width={GRID_SIZE}
                height={GRID_SIZE}
                patternUnits="userSpaceOnUse"
            >
                <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={1.5} fill="currentColor" opacity={0.15} />
            </pattern>
        </defs>
    );
});

// ============================================================================
// Canvas Component
// ============================================================================

export function MindmapCanvas() {
    const { state, setPan, setZoom, deselectAll, dispatch, pushHistory, moveNode } = useMindmap();
    const containerRef = useRef<HTMLDivElement>(null);

    // Pan state
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

    // Lasso selection state
    const [isLassoing, setIsLassoing] = useState(false);
    const [lassoStart, setLassoStart] = useState<{ x: number; y: number } | null>(null);
    const [lassoEnd, setLassoEnd] = useState<{ x: number; y: number } | null>(null);

    // ========================================================================
    // View Manipulation
    // ========================================================================

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const isPinch = e.ctrlKey || e.metaKey;

        if (isPinch) {
            const sensitivity = 0.002;
            const scaleFactor = Math.exp(-e.deltaY * sensitivity);
            const newZoom = Math.min(3, Math.max(0.15, state.zoom * scaleFactor));

            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;

            const worldX = cursorX / state.zoom - state.pan.x;
            const worldY = cursorY / state.zoom - state.pan.y;

            setZoom(newZoom);
            setPan({
                x: cursorX / newZoom - worldX,
                y: cursorY / newZoom - worldY,
            });
        } else {
            setPan({
                x: state.pan.x - e.deltaX / state.zoom,
                y: state.pan.y - e.deltaY / state.zoom,
            });
        }
    }, [state.zoom, state.pan, setZoom, setPan]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // ========================================================================
    // Pan Handlers
    // ========================================================================

    const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('[data-node-id]')) return;

        if (e.shiftKey) {
            setIsLassoing(true);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const x = (e.clientX - rect.left) / state.zoom - state.pan.x;
                const y = (e.clientY - rect.top) / state.zoom - state.pan.y;
                setLassoStart({ x, y });
                setLassoEnd({ x, y });
            }
            return;
        }

        deselectAll();
        setIsPanning(true);
        panStart.current = {
            x: e.clientX,
            y: e.clientY,
            panX: state.pan.x,
            panY: state.pan.y,
        };

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }, [state.pan, state.zoom, deselectAll]);

    const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
        if (isLassoing && lassoStart) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const x = (e.clientX - rect.left) / state.zoom - state.pan.x;
                const y = (e.clientY - rect.top) / state.zoom - state.pan.y;
                setLassoEnd({ x, y });
            }
            return;
        }

        if (!isPanning || !panStart.current) return;

        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;

        setPan({
            x: panStart.current.panX + dx / state.zoom,
            y: panStart.current.panY + dy / state.zoom,
        });
    }, [isPanning, isLassoing, lassoStart, state.zoom, state.pan, setPan]);

    const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
        if (isLassoing && lassoStart && lassoEnd) {
            const minX = Math.min(lassoStart.x, lassoEnd.x);
            const maxX = Math.max(lassoStart.x, lassoEnd.x);
            const minY = Math.min(lassoStart.y, lassoEnd.y);
            const maxY = Math.max(lassoStart.y, lassoEnd.y);

            const selectedIds = state.nodes
                .filter(node =>
                    node.position.x >= minX &&
                    node.position.x <= maxX &&
                    node.position.y >= minY &&
                    node.position.y <= maxY
                )
                .map(node => node.id);

            dispatch({ type: 'SELECT_NODES', ids: selectedIds });
            setIsLassoing(false);
            setLassoStart(null);
            setLassoEnd(null);
        }

        setIsPanning(false);
        panStart.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }, [isLassoing, lassoStart, lassoEnd, state.nodes, dispatch]);

    // ========================================================================
    // Visible Nodes (respect collapsed groups)
    // ========================================================================

    const visibleNodes = useMemo(() => {
        const collapsedGroupIds = new Set(
            state.nodes.filter(n => n.type === 'group' && n.collapsed).map(n => n.id)
        );

        if (collapsedGroupIds.size === 0) return state.nodes;

        return state.nodes.filter(node => {
            if (!node.parentId) return true;
            let parent = state.nodes.find(n => n.id === node.parentId);
            while (parent) {
                if (collapsedGroupIds.has(parent.id)) return false;
                parent = state.nodes.find(n => n.id === parent?.parentId);
            }
            return true;
        });
    }, [state.nodes]);

    const hasChildren = useMemo(() => {
        const childCounts = new Map<string, number>();
        state.nodes.forEach(n => {
            if (n.parentId) {
                childCounts.set(n.parentId, (childCounts.get(n.parentId) || 0) + 1);
            }
        });
        return childCounts;
    }, [state.nodes]);

    const visibleEdges = useMemo(() => {
        const visibleIds = new Set(visibleNodes.map(n => n.id));
        return state.edges.filter(e => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId));
    }, [state.edges, visibleNodes]);

    const nodeMap = useMemo(() => new Map(state.nodes.map(n => [n.id, n])), [state.nodes]);

    // ========================================================================
    // Render
    // ========================================================================

    return (
        <div
            ref={containerRef}
            className={`w-full h-full overflow-hidden touch-none bg-[var(--color-surface-bg)] ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={handleCanvasPointerUp}
        >
            <div
                className="relative origin-top-left transition-transform duration-75"
                style={{
                    width: CANVAS_SIZE,
                    height: CANVAS_SIZE,
                    transform: `translate(${state.pan.x * state.zoom}px, ${state.pan.y * state.zoom}px) scale(${state.zoom})`,
                }}
            >
                {/* Grid Background */}
                {state.isGridVisible && (
                    <svg
                        className="absolute inset-0 pointer-events-none text-[var(--color-text-subtle)]"
                        width={CANVAS_SIZE}
                        height={CANVAS_SIZE}
                    >
                        <GridPattern />
                        <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="url(#mindmap-grid-dots)" />
                    </svg>
                )}

                {/* Edges (SVG Layer) */}
                <svg
                    className="absolute inset-0 pointer-events-none overflow-visible"
                    width={CANVAS_SIZE}
                    height={CANVAS_SIZE}
                >
                    {visibleEdges.map(edge => {
                        const source = nodeMap.get(edge.sourceId);
                        const target = nodeMap.get(edge.targetId);
                        if (!source || !target) return null;

                        const isHighlighted =
                            state.selectedNodeIds.has(edge.sourceId) ||
                            state.selectedNodeIds.has(edge.targetId);

                        return (
                            <MindmapEdge
                                key={edge.id}
                                edge={edge}
                                sourceNode={source}
                                targetNode={target}
                                isHighlighted={isHighlighted}
                            />
                        );
                    })}
                </svg>

                {/* Nodes */}
                {visibleNodes.map(node => (
                    <MindmapNode
                        key={node.id}
                        node={node}
                        hasChildren={(hasChildren.get(node.id) || 0) > 0}
                    />
                ))}

                {/* Lasso Selection Rectangle */}
                {isLassoing && lassoStart && lassoEnd && (
                    <div
                        className="absolute border-2 border-dashed border-indigo-500 bg-indigo-500/10 pointer-events-none rounded-lg"
                        style={{
                            left: Math.min(lassoStart.x, lassoEnd.x),
                            top: Math.min(lassoStart.y, lassoEnd.y),
                            width: Math.abs(lassoEnd.x - lassoStart.x),
                            height: Math.abs(lassoEnd.y - lassoStart.y),
                        }}
                    />
                )}
            </div>
        </div>
    );
}

export default MindmapCanvas;
