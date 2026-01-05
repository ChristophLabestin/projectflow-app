import React, { memo, useCallback, useState, useRef } from 'react';
import { useMindmap, MindmapNodeData } from './hooks/useMindmapStore';

// ============================================================================
// Node Type Configurations (using CSS variables for theme consistency)
// ============================================================================

const NODE_CONFIGS: Record<string, {
    icon: string;
    colorClass: string;
    bgClass: string;
    borderColor: string;
}> = {
    project: {
        icon: 'hub',
        colorClass: 'text-indigo-600 dark:text-indigo-400',
        bgClass: 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30',
        borderColor: 'border-indigo-200 dark:border-indigo-700',
    },
    group: {
        icon: 'category',
        colorClass: 'text-violet-600 dark:text-violet-400',
        bgClass: 'bg-card',
        borderColor: 'border-surface',
    },
    idea: {
        icon: 'lightbulb',
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-card',
        borderColor: 'border-amber-200 dark:border-amber-800/50',
    },
    task: {
        icon: 'task_alt',
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-card',
        borderColor: 'border-emerald-200 dark:border-emerald-800/50',
    },
    issue: {
        icon: 'bug_report',
        colorClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-card',
        borderColor: 'border-rose-200 dark:border-rose-800/50',
    },
    milestone: {
        icon: 'flag',
        colorClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-card',
        borderColor: 'border-blue-200 dark:border-blue-800/50',
    },
    campaign: {
        icon: 'campaign',
        colorClass: 'text-pink-600 dark:text-pink-400',
        bgClass: 'bg-card',
        borderColor: 'border-pink-200 dark:border-pink-800/50',
    },
};

const DEFAULT_CONFIG = NODE_CONFIGS.idea;

// ============================================================================
// Priority Badge
// ============================================================================

function PriorityBadge({ priority }: { priority?: string }) {
    if (!priority) return null;

    const colors: Record<string, string> = {
        Urgent: 'bg-rose-500 text-white',
        High: 'bg-orange-500 text-white',
        Medium: 'bg-amber-500 text-amber-900',
        Low: 'bg-emerald-500 text-white',
    };

    return (
        <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full shadow-sm ${colors[priority] || 'bg-slate-400 text-white'}`}>
            {priority[0]}
        </span>
    );
}

// ============================================================================
// Status Indicator
// ============================================================================

function StatusIndicator({ status }: { status?: string }) {
    if (!status) return null;

    const colors: Record<string, string> = {
        Done: 'bg-emerald-500',
        'In Progress': 'bg-blue-500',
        Blocked: 'bg-rose-500 animate-pulse',
        Review: 'bg-purple-500',
        Todo: 'bg-slate-400',
        Open: 'bg-slate-400',
    };

    return (
        <div
            className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-800 ${colors[status] || 'bg-slate-400'}`}
            title={status}
        />
    );
}

// ============================================================================
// Collapse Button
// ============================================================================

function CollapseButton({ collapsed, onClick }: { collapsed?: boolean; onClick: () => void }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-card border border-surface flex items-center justify-center hover:bg-surface-hover transition-colors z-10 shadow-sm"
        >
            <span className="material-symbols-outlined text-[14px] text-muted">
                {collapsed ? 'expand_more' : 'expand_less'}
            </span>
        </button>
    );
}

// ============================================================================
// Main Node Component
// ============================================================================

interface MindmapNodeProps {
    node: MindmapNodeData;
    hasChildren?: boolean;
}

export const MindmapNode = memo(function MindmapNode({ node, hasChildren }: MindmapNodeProps) {
    const { state, selectNode, moveNode, pushHistory, dispatch } = useMindmap();
    const isSelected = state.selectedNodeIds.has(node.id);
    const isHovered = state.hoveredNodeId === node.id;
    const matches = state.searchQuery && node.label.toLowerCase().includes(state.searchQuery.toLowerCase());

    const config = NODE_CONFIGS[node.type] || DEFAULT_CONFIG;

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{ x: number; y: number; nodeX: number; nodeY: number } | null>(null);

    // Get priority/status from source data
    const priority = node.task?.priority || node.issue?.priority;
    const status = node.task?.status || node.issue?.status || node.idea?.stage || node.campaign?.status || node.milestone?.status;

    // Handlers
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        dragStart.current = {
            x: e.clientX,
            y: e.clientY,
            nodeX: node.position.x,
            nodeY: node.position.y,
        };

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }, [node.position]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragStart.current) return;

        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!isDragging && distance > 5) {
            setIsDragging(true);
            pushHistory();
        }

        if (isDragging) {
            const zoom = state.zoom;
            moveNode(node.id, {
                x: dragStart.current.nodeX + dx / zoom,
                y: dragStart.current.nodeY + dy / zoom,
            });
        }
    }, [isDragging, state.zoom, node.id, moveNode, pushHistory]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

        if (!isDragging) {
            selectNode(node.id, e.shiftKey);
        }

        setIsDragging(false);
        dragStart.current = null;
    }, [isDragging, node.id, selectNode]);

    const handleMouseEnter = useCallback(() => {
        dispatch({ type: 'SET_HOVERED', id: node.id });
    }, [node.id, dispatch]);

    const handleMouseLeave = useCallback(() => {
        dispatch({ type: 'SET_HOVERED', id: null });
    }, [dispatch]);

    const handleToggleCollapse = useCallback(() => {
        dispatch({ type: 'TOGGLE_COLLAPSE', id: node.id });
    }, [node.id, dispatch]);

    // Dynamic color from node data (for groups)
    const dynamicStyle: React.CSSProperties = {};
    if (node.color && node.type === 'group') {
        dynamicStyle.borderColor = node.color;
        dynamicStyle.boxShadow = `0 0 0 1px ${node.color}20`;
    }

    const isProjectNode = node.type === 'project';

    return (
        <div
            data-node-id={node.id}
            className={`
                absolute rounded-2xl border-2 shadow-sm select-none 
                flex flex-col items-center justify-center
                cursor-grab active:cursor-grabbing
                ${config.bgClass} ${config.borderColor}
                ${isProjectNode ? 'px-6 py-4 min-w-[180px]' : 'px-4 py-3 min-w-[120px]'}
                ${isSelected
                    ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[var(--color-surface-bg)] scale-105 z-20 shadow-lg'
                    : 'z-10'
                }
                ${isHovered && !isSelected ? 'ring-1 ring-[var(--color-text-subtle)] scale-[1.02]' : ''}
                ${isDragging ? 'shadow-xl scale-110 z-30' : ''}
                ${matches ? 'ring-2 ring-amber-400' : ''}
            `}
            style={{
                left: node.position.x,
                top: node.position.y,
                transform: 'translate(-50%, -50%)',
                ...dynamicStyle,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Priority Badge */}
            <PriorityBadge priority={priority} />

            {/* Type Icon & Label */}
            <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isProjectNode ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-surface-hover'}`}>
                    <span className={`material-symbols-outlined text-[14px] ${config.colorClass}`}>
                        {config.icon}
                    </span>
                </div>
                {!isProjectNode && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
                        {node.type}
                    </span>
                )}
            </div>

            {/* Title */}
            <span className={`font-semibold text-center leading-tight max-w-[160px] truncate text-main ${isProjectNode ? 'text-base' : 'text-sm'}`}>
                {node.label}
            </span>

            {/* Group name for ideas */}
            {node.groupName && node.type === 'idea' && (
                <span className="text-[10px] text-muted mt-0.5 truncate max-w-[140px]">
                    {node.groupName}
                </span>
            )}

            {/* Status Indicator */}
            <StatusIndicator status={status} />

            {/* Collapse Button for groups */}
            {(node.type === 'group' || hasChildren) && (
                <CollapseButton collapsed={node.collapsed} onClick={handleToggleCollapse} />
            )}
        </div>
    );
});

export default MindmapNode;
