import React, { memo, useMemo } from 'react';
import { MindmapEdgeData, MindmapNodeData, MindmapEdgeType } from './hooks/useMindmapStore';

// ============================================================================
// Types
// ============================================================================

interface MindmapEdgeProps {
    edge: MindmapEdgeData;
    sourceNode: MindmapNodeData;
    targetNode: MindmapNodeData;
    isHighlighted?: boolean;
}

// ============================================================================
// Edge Type Configurations
// ============================================================================

const EDGE_CONFIGS: Record<MindmapEdgeType, {
    strokeWidth: number;
    opacity: number;
    dashArray?: string;
    animated?: boolean;
    color?: string;
}> = {
    hierarchy: {
        strokeWidth: 2,
        opacity: 0.4,
    },
    conversion: {
        strokeWidth: 2.5,
        opacity: 0.7,
        dashArray: '8 4',
        animated: true,
        color: '#8b5cf6', // Violet for conversion
    },
    dependency: {
        strokeWidth: 2,
        opacity: 0.5,
        dashArray: '4 4',
        color: '#f59e0b', // Amber for dependency
    },
    linked: {
        strokeWidth: 2,
        opacity: 0.5,
        dashArray: '2 2',
        color: '#06b6d4', // Cyan for links
    },
    link: {
        strokeWidth: 1.5,
        opacity: 0.3,
        dashArray: '5 5',
    },
};

// ============================================================================
// Node Type Colors (for gradient edges)
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
    project: '#6366f1',
    group: '#8b5cf6',
    idea: '#f59e0b',
    task: '#10b981',
    issue: '#ef4444',
    milestone: '#3b82f6',
    campaign: '#ec4899',
};

// ============================================================================
// Bezier Curve Calculation
// ============================================================================

function calculateBezierPath(
    x1: number, y1: number,
    x2: number, y2: number
): string {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Control points for smooth curves
    const cx1 = x1 + dx * 0.5;
    const cy1 = y1;
    const cx2 = x2 - dx * 0.5;
    const cy2 = y2;

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

// ============================================================================
// Component
// ============================================================================

export const MindmapEdge = memo(function MindmapEdge({
    edge,
    sourceNode,
    targetNode,
    isHighlighted,
}: MindmapEdgeProps) {
    const { path, gradientId, animationId } = useMemo(() => {
        const x1 = sourceNode.position.x;
        const y1 = sourceNode.position.y;
        const x2 = targetNode.position.x;
        const y2 = targetNode.position.y;

        return {
            path: calculateBezierPath(x1, y1, x2, y2),
            gradientId: `edge-gradient-${edge.id}`,
            animationId: `edge-animation-${edge.id}`,
        };
    }, [sourceNode.position, targetNode.position, edge.id]);

    const config = EDGE_CONFIGS[edge.type] || EDGE_CONFIGS.hierarchy;
    const sourceColor = config.color || TYPE_COLORS[sourceNode.type] || '#64748b';
    const targetColor = config.color || TYPE_COLORS[targetNode.type] || '#64748b';

    const strokeWidth = isHighlighted ? config.strokeWidth + 1 : config.strokeWidth;
    const opacity = isHighlighted ? Math.min(config.opacity + 0.3, 1) : config.opacity;

    return (
        <g className="mindmap-edge">
            {/* Gradient Definition */}
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={sourceColor} stopOpacity={opacity} />
                    <stop offset="100%" stopColor={targetColor} stopOpacity={opacity} />
                </linearGradient>
            </defs>

            {/* Background glow for highlighted edges */}
            {isHighlighted && (
                <path
                    d={path}
                    fill="none"
                    stroke={sourceColor}
                    strokeWidth={strokeWidth + 4}
                    strokeOpacity={0.15}
                    strokeLinecap="round"
                />
            )}

            {/* Main Edge Path */}
            <path
                d={path}
                fill="none"
                stroke={config.color ? sourceColor : `url(#${gradientId})`}
                strokeWidth={strokeWidth}
                strokeOpacity={opacity}
                strokeLinecap="round"
                strokeDasharray={config.dashArray || 'none'}
                className="transition-opacity duration-200"
            />

            {/* Animated flow particles for conversion edges */}
            {config.animated && (
                <>
                    <circle r={3} fill={sourceColor} opacity={0.8}>
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={path}
                        />
                    </circle>
                    <circle r={3} fill={sourceColor} opacity={0.6}>
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path={path}
                            begin="1s"
                        />
                    </circle>
                </>
            )}

            {/* Edge label for relationship types */}
            {edge.label && (
                <text
                    x={(sourceNode.position.x + targetNode.position.x) / 2}
                    y={(sourceNode.position.y + targetNode.position.y) / 2 - 8}
                    textAnchor="middle"
                    fill="var(--color-text-muted)"
                    fontSize={10}
                    fontWeight={500}
                    className="pointer-events-none"
                >
                    {edge.label}
                </text>
            )}
        </g>
    );
});

export default MindmapEdge;
