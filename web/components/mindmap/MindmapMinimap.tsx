import React, { memo, useMemo, useCallback } from 'react';
import { useMindmap } from './hooks/useMindmapStore';

// ============================================================================
// Constants
// ============================================================================

const CANVAS_SIZE = 4000;
const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;

// ============================================================================
// Node Type Colors for Minimap (using project design tokens)
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
    project: '#6366f1',  // Indigo
    group: '#8b5cf6',    // Violet
    idea: '#f59e0b',     // Amber
    task: '#10b981',     // Emerald
    issue: '#ef4444',    // Rose
    milestone: '#3b82f6', // Blue
};

// ============================================================================
// Minimap Component
// ============================================================================

export const MindmapMinimap = memo(function MindmapMinimap() {
    const { state, setPan, toggleMinimap } = useMindmap();

    // Calculate scale factor
    const scale = MINIMAP_WIDTH / CANVAS_SIZE;

    // Calculate viewport rectangle
    const viewport = useMemo(() => {
        const containerWidth = 1200;
        const containerHeight = 700;
        const visibleWidth = containerWidth / state.zoom;
        const visibleHeight = containerHeight / state.zoom;

        return {
            x: -state.pan.x * scale,
            y: -state.pan.y * scale,
            width: visibleWidth * scale,
            height: visibleHeight * scale,
        };
    }, [state.pan, state.zoom, scale]);

    // Calculate content bounds for smart scaling
    const contentBounds = useMemo(() => {
        if (state.nodes.length === 0) {
            return { minX: 0, maxX: CANVAS_SIZE, minY: 0, maxY: CANVAS_SIZE, width: CANVAS_SIZE, height: CANVAS_SIZE };
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        state.nodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y);
        });

        const padding = 300;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
        };
    }, [state.nodes]);

    // Handle click to navigate
    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) / scale;
        const clickY = (e.clientY - rect.top) / scale;

        const containerWidth = 1200;
        const containerHeight = 700;
        const visibleWidth = containerWidth / state.zoom;
        const visibleHeight = containerHeight / state.zoom;

        setPan({
            x: -(clickX - visibleWidth / 2),
            y: -(clickY - visibleHeight / 2),
        });
    }, [scale, state.zoom, setPan]);

    if (!state.isMinimapVisible) return null;

    return (
        <div className="absolute bottom-4 right-4 z-30 flex flex-col overflow-hidden rounded-2xl bg-card border border-surface shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface bg-surface">
                <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px] text-indigo-500">map</span>
                    <span className="text-[11px] font-semibold text-main uppercase tracking-wide">
                        Navigator
                    </span>
                </div>
                <button
                    onClick={toggleMinimap}
                    className="p-1 -mr-1 rounded-lg text-muted hover:bg-surface-hover hover:text-main transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
            </div>

            {/* Map Area */}
            <div
                className="relative cursor-crosshair"
                style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
                onClick={handleClick}
            >
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-850 dark:to-slate-800" />

                {/* Grid pattern overlay */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage: 'radial-gradient(circle, var(--color-text-muted) 0.5px, transparent 0.5px)',
                        backgroundSize: '10px 10px',
                    }}
                />

                {/* Nodes visualization */}
                <svg
                    className="absolute inset-0 pointer-events-none"
                    width={MINIMAP_WIDTH}
                    height={MINIMAP_HEIGHT}
                    viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
                    preserveAspectRatio="xMidYMid meet"
                >
                    {/* Edge connections */}
                    <g opacity={0.4}>
                        {state.edges.map(edge => {
                            const source = state.nodes.find(n => n.id === edge.sourceId);
                            const target = state.nodes.find(n => n.id === edge.targetId);
                            if (!source || !target) return null;

                            return (
                                <line
                                    key={edge.id}
                                    x1={source.position.x}
                                    y1={source.position.y}
                                    x2={target.position.x}
                                    y2={target.position.y}
                                    stroke="var(--color-text-subtle)"
                                    strokeWidth={30}
                                    strokeLinecap="round"
                                />
                            );
                        })}
                    </g>

                    {/* Node dots */}
                    {state.nodes.map(node => {
                        const color = TYPE_COLORS[node.type] || '#64748b';
                        const isSelected = state.selectedNodeIds.has(node.id);
                        const baseSize = node.type === 'project' ? 100 : node.type === 'group' ? 70 : 50;
                        const size = isSelected ? baseSize * 1.3 : baseSize;

                        return (
                            <g key={node.id}>
                                {/* Glow effect for selected */}
                                {isSelected && (
                                    <circle
                                        cx={node.position.x}
                                        cy={node.position.y}
                                        r={size * 1.5}
                                        fill={color}
                                        opacity={0.2}
                                    />
                                )}
                                <circle
                                    cx={node.position.x}
                                    cy={node.position.y}
                                    r={size}
                                    fill={color}
                                    opacity={isSelected ? 1 : 0.8}
                                />
                                {/* Center dot for project node */}
                                {node.type === 'project' && (
                                    <circle
                                        cx={node.position.x}
                                        cy={node.position.y}
                                        r={size * 0.4}
                                        fill="white"
                                        opacity={0.9}
                                    />
                                )}
                            </g>
                        );
                    })}
                </svg>

                {/* Viewport indicator */}
                <div
                    className="absolute border-2 border-indigo-500 bg-indigo-500/15 rounded-sm pointer-events-none transition-all duration-100 shadow-sm"
                    style={{
                        left: Math.max(0, viewport.x),
                        top: Math.max(0, viewport.y),
                        width: Math.min(Math.max(viewport.width, 12), MINIMAP_WIDTH - viewport.x),
                        height: Math.min(Math.max(viewport.height, 8), MINIMAP_HEIGHT - viewport.y),
                    }}
                >
                    {/* Corner handles visual */}
                    <div className="absolute -top-0.5 -left-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    <div className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                </div>
            </div>

            {/* Footer stats */}
            <div className="flex items-center justify-between px-3 py-1.5 border-t border-surface bg-surface">
                <div className="flex items-center gap-3 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        {state.nodes.filter(n => n.type === 'project').length + state.nodes.filter(n => n.type === 'group').length} groups
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        {state.nodes.filter(n => n.type === 'idea').length} ideas
                    </span>
                </div>
                <span className="text-[10px] font-mono text-subtle">
                    {Math.round(state.zoom * 100)}%
                </span>
            </div>
        </div>
    );
});

export default MindmapMinimap;
