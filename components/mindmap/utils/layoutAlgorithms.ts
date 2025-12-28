import { MindmapNodeData, LayoutType } from '../hooks/useMindmapStore';

// ============================================================================
// Constants
// ============================================================================

const CANVAS_SIZE = 4000;
const CENTER = CANVAS_SIZE / 2;

// ============================================================================
// Force-Directed Layout
// ============================================================================

interface ForceNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fixed?: boolean;
}

export function applyForceDirectedLayout(nodes: MindmapNodeData[]): MindmapNodeData[] {
    if (nodes.length === 0) return nodes;

    // Initialize force nodes
    const forceNodes: ForceNode[] = nodes.map(n => ({
        id: n.id,
        x: n.position.x || CENTER + (Math.random() - 0.5) * 400,
        y: n.position.y || CENTER + (Math.random() - 0.5) * 400,
        vx: 0,
        vy: 0,
        fixed: n.type === 'project',
    }));

    // Find project node and fix it at center
    const projectNode = forceNodes.find(n => nodes.find(nn => nn.id === n.id)?.type === 'project');
    if (projectNode) {
        projectNode.x = CENTER;
        projectNode.y = CENTER;
        projectNode.fixed = true;
    }

    // Build adjacency for attraction
    const edges = new Map<string, string[]>();
    nodes.forEach(node => {
        if (node.parentId) {
            if (!edges.has(node.parentId)) edges.set(node.parentId, []);
            edges.get(node.parentId)!.push(node.id);
        }
    });

    // Simulation parameters
    const iterations = 100;
    const repulsionStrength = 8000;
    const attractionStrength = 0.05;
    const dampening = 0.85;
    const minDistance = 120;

    for (let iter = 0; iter < iterations; iter++) {
        // Repulsion between all nodes
        for (let i = 0; i < forceNodes.length; i++) {
            for (let j = i + 1; j < forceNodes.length; j++) {
                const a = forceNodes[i];
                const b = forceNodes[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);

                if (dist < minDistance * 3) {
                    const force = repulsionStrength / (dist * dist);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (!a.fixed) { a.vx += fx; a.vy += fy; }
                    if (!b.fixed) { b.vx -= fx; b.vy -= fy; }
                }
            }
        }

        // Attraction along edges
        const nodeMap = new Map(forceNodes.map(n => [n.id, n]));
        edges.forEach((children, parentId) => {
            const parent = nodeMap.get(parentId);
            if (!parent) return;
            children.forEach(childId => {
                const child = nodeMap.get(childId);
                if (!child) return;

                const dx = parent.x - child.x;
                const dy = parent.y - child.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const idealDist = 200;

                const force = (dist - idealDist) * attractionStrength;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (!child.fixed) { child.vx += fx; child.vy += fy; }
                if (!parent.fixed) { parent.vx -= fx * 0.3; parent.vy -= fy * 0.3; }
            });
        });

        // Apply velocities
        forceNodes.forEach(n => {
            if (!n.fixed) {
                n.x += n.vx;
                n.y += n.vy;
                n.vx *= dampening;
                n.vy *= dampening;

                // Keep within bounds
                n.x = Math.max(100, Math.min(CANVAS_SIZE - 100, n.x));
                n.y = Math.max(100, Math.min(CANVAS_SIZE - 100, n.y));
            }
        });
    }

    // Map back to nodes
    const posMap = new Map(forceNodes.map(n => [n.id, { x: n.x, y: n.y }]));
    return nodes.map(n => ({
        ...n,
        position: posMap.get(n.id) || n.position,
    }));
}

// ============================================================================
// Radial Layout
// ============================================================================

export function applyRadialLayout(nodes: MindmapNodeData[]): MindmapNodeData[] {
    if (nodes.length === 0) return nodes;

    const positions = new Map<string, { x: number; y: number }>();
    const projectNode = nodes.find(n => n.type === 'project');

    // Project at center
    if (projectNode) {
        positions.set(projectNode.id, { x: CENTER, y: CENTER });
    }

    // Group nodes by parent
    const childrenOf = new Map<string, MindmapNodeData[]>();
    nodes.forEach(n => {
        if (n.parentId) {
            if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
            childrenOf.get(n.parentId)!.push(n);
        }
    });

    // Place nodes in rings
    const placeChildren = (parentId: string, ringRadius: number, startAngle: number, arcSpan: number) => {
        const children = childrenOf.get(parentId) || [];
        if (children.length === 0) return;

        const parentPos = positions.get(parentId) || { x: CENTER, y: CENTER };
        const angleStep = arcSpan / Math.max(children.length, 1);

        children.forEach((child, idx) => {
            const angle = startAngle + angleStep * (idx + 0.5);
            const x = parentPos.x + Math.cos(angle) * ringRadius;
            const y = parentPos.y + Math.sin(angle) * ringRadius;
            positions.set(child.id, { x, y });

            // Recurse for children
            const childArcSpan = angleStep * 0.9;
            placeChildren(child.id, ringRadius * 0.6, angle - childArcSpan / 2, childArcSpan);
        });
    };

    // Start from project node
    if (projectNode) {
        const groups = nodes.filter(n => n.type === 'group');
        const angleStep = (Math.PI * 2) / Math.max(groups.length, 1);

        groups.forEach((group, idx) => {
            const angle = -Math.PI / 2 + angleStep * idx;
            const x = CENTER + Math.cos(angle) * 300;
            const y = CENTER + Math.sin(angle) * 300;
            positions.set(group.id, { x, y });

            // Place group children
            placeChildren(group.id, 180, angle - angleStep * 0.4, angleStep * 0.8);
        });

        // Place ungrouped ideas directly around project
        const ungrouped = nodes.filter(n => n.type === 'idea' && (!n.parentId || n.parentId === projectNode.id));
        const ungroupedAngleStep = (Math.PI * 2) / Math.max(ungrouped.length, 1);
        ungrouped.forEach((node, idx) => {
            if (!positions.has(node.id)) {
                const angle = ungroupedAngleStep * idx;
                positions.set(node.id, {
                    x: CENTER + Math.cos(angle) * 220,
                    y: CENTER + Math.sin(angle) * 220,
                });
            }
        });
    }

    // Recursively place remaining nodes without positions
    nodes.forEach(n => {
        if (!positions.has(n.id) && n.parentId && positions.has(n.parentId)) {
            const parentPos = positions.get(n.parentId)!;
            positions.set(n.id, {
                x: parentPos.x + (Math.random() - 0.5) * 150,
                y: parentPos.y + (Math.random() - 0.5) * 150,
            });
        }
    });

    // Fallback for any remaining
    nodes.forEach(n => {
        if (!positions.has(n.id)) {
            positions.set(n.id, {
                x: CENTER + (Math.random() - 0.5) * 600,
                y: CENTER + (Math.random() - 0.5) * 600,
            });
        }
    });

    return nodes.map(n => ({
        ...n,
        position: positions.get(n.id) || n.position,
    }));
}

// ============================================================================
// Tree Layout (Vertical)
// ============================================================================

export function applyTreeVerticalLayout(nodes: MindmapNodeData[]): MindmapNodeData[] {
    if (nodes.length === 0) return nodes;

    const positions = new Map<string, { x: number; y: number }>();
    const projectNode = nodes.find(n => n.type === 'project');

    // Build hierarchy
    const childrenOf = new Map<string, MindmapNodeData[]>();
    nodes.forEach(n => {
        if (n.parentId) {
            if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
            childrenOf.get(n.parentId)!.push(n);
        }
    });

    // Calculate subtree widths
    const subtreeWidth = new Map<string, number>();
    const nodeWidth = 180;
    const levelHeight = 140;

    const calcWidth = (nodeId: string): number => {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            subtreeWidth.set(nodeId, nodeWidth);
            return nodeWidth;
        }
        const totalWidth = children.reduce((sum, c) => sum + calcWidth(c.id), 0);
        subtreeWidth.set(nodeId, Math.max(nodeWidth, totalWidth));
        return subtreeWidth.get(nodeId)!;
    };

    // Position nodes
    const positionNode = (nodeId: string, x: number, y: number) => {
        positions.set(nodeId, { x, y });
        const children = childrenOf.get(nodeId) || [];
        const totalWidth = children.reduce((sum, c) => sum + (subtreeWidth.get(c.id) || nodeWidth), 0);
        let currentX = x - totalWidth / 2;

        children.forEach(child => {
            const childWidth = subtreeWidth.get(child.id) || nodeWidth;
            positionNode(child.id, currentX + childWidth / 2, y + levelHeight);
            currentX += childWidth;
        });
    };

    // Start from project
    if (projectNode) {
        calcWidth(projectNode.id);
        positionNode(projectNode.id, CENTER, 200);
    }

    // Handle orphan nodes
    nodes.forEach(n => {
        if (!positions.has(n.id)) {
            positions.set(n.id, {
                x: CENTER + (Math.random() - 0.5) * 400,
                y: CENTER + (Math.random() - 0.5) * 400,
            });
        }
    });

    return nodes.map(n => ({
        ...n,
        position: positions.get(n.id) || n.position,
    }));
}

// ============================================================================
// Tree Layout (Horizontal)
// ============================================================================

export function applyTreeHorizontalLayout(nodes: MindmapNodeData[]): MindmapNodeData[] {
    if (nodes.length === 0) return nodes;

    const positions = new Map<string, { x: number; y: number }>();
    const projectNode = nodes.find(n => n.type === 'project');

    // Build hierarchy
    const childrenOf = new Map<string, MindmapNodeData[]>();
    nodes.forEach(n => {
        if (n.parentId) {
            if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
            childrenOf.get(n.parentId)!.push(n);
        }
    });

    const nodeHeight = 80;
    const levelWidth = 220;

    // Calculate subtree heights
    const subtreeHeight = new Map<string, number>();

    const calcHeight = (nodeId: string): number => {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            subtreeHeight.set(nodeId, nodeHeight);
            return nodeHeight;
        }
        const totalHeight = children.reduce((sum, c) => sum + calcHeight(c.id), 0);
        subtreeHeight.set(nodeId, Math.max(nodeHeight, totalHeight));
        return subtreeHeight.get(nodeId)!;
    };

    // Position nodes
    const positionNode = (nodeId: string, x: number, y: number) => {
        positions.set(nodeId, { x, y });
        const children = childrenOf.get(nodeId) || [];
        const totalHeight = children.reduce((sum, c) => sum + (subtreeHeight.get(c.id) || nodeHeight), 0);
        let currentY = y - totalHeight / 2;

        children.forEach(child => {
            const childHeight = subtreeHeight.get(child.id) || nodeHeight;
            positionNode(child.id, x + levelWidth, currentY + childHeight / 2);
            currentY += childHeight;
        });
    };

    // Start from project
    if (projectNode) {
        calcHeight(projectNode.id);
        positionNode(projectNode.id, 300, CENTER);
    }

    // Handle orphan nodes
    nodes.forEach(n => {
        if (!positions.has(n.id)) {
            positions.set(n.id, {
                x: CENTER + (Math.random() - 0.5) * 400,
                y: CENTER + (Math.random() - 0.5) * 400,
            });
        }
    });

    return nodes.map(n => ({
        ...n,
        position: positions.get(n.id) || n.position,
    }));
}

// ============================================================================
// Grid Layout
// ============================================================================

export function applyGridLayout(nodes: MindmapNodeData[]): MindmapNodeData[] {
    if (nodes.length === 0) return nodes;

    const positions = new Map<string, { x: number; y: number }>();
    const cellWidth = 300;  // Increased from 200
    const cellHeight = 180; // Increased from 120

    // Sort by type priority
    const typePriority: Record<string, number> = {
        project: 0,
        group: 1,
        milestone: 2,
        idea: 3,
        task: 4,
        issue: 5,
    };

    const sorted = [...nodes].sort((a, b) =>
        (typePriority[a.type] || 99) - (typePriority[b.type] || 99)
    );

    const cols = Math.ceil(Math.sqrt(sorted.length * 1.5));
    const startX = CENTER - (cols * cellWidth) / 2;
    const startY = 200;

    sorted.forEach((node, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        positions.set(node.id, {
            x: startX + col * cellWidth + cellWidth / 2,
            y: startY + row * cellHeight + cellHeight / 2,
        });
    });

    return nodes.map(n => ({
        ...n,
        position: positions.get(n.id) || n.position,
    }));
}

// ============================================================================
// Main Layout Function
// ============================================================================

export function applyLayout(nodes: MindmapNodeData[], layout: LayoutType): MindmapNodeData[] {
    switch (layout) {
        case 'force':
            return applyForceDirectedLayout(nodes);
        case 'radial':
            return applyRadialLayout(nodes);
        case 'tree-vertical':
            return applyTreeVerticalLayout(nodes);
        case 'tree-horizontal':
            return applyTreeHorizontalLayout(nodes);
        case 'grid':
            return applyGridLayout(nodes);
        default:
            return nodes;
    }
}

// ============================================================================
// Collision Resolution
// ============================================================================

export function resolveCollisions(nodes: MindmapNodeData[], padding: number = 60): MindmapNodeData[] { // Increased padding default
    const nodeWidth = 220;  // Increased from 160
    const nodeHeight = 100; // Increased from 60

    const positions = new Map(nodes.map(n => [n.id, { ...n.position }]));

    for (let iteration = 0; iteration < 10; iteration++) {
        let hasCollision = false;

        nodes.forEach((a) => {
            nodes.forEach((b) => {
                if (a.id >= b.id) return;

                const posA = positions.get(a.id)!;
                const posB = positions.get(b.id)!;

                const dx = posA.x - posB.x;
                const dy = posA.y - posB.y;

                const minDistX = nodeWidth + padding;
                const minDistY = nodeHeight + padding;

                const overlapX = minDistX - Math.abs(dx);
                const overlapY = minDistY - Math.abs(dy);

                if (overlapX > 0 && overlapY > 0) {
                    hasCollision = true;

                    // Push apart along smallest overlap axis
                    if (overlapX < overlapY) {
                        const push = overlapX / 2;
                        const dir = dx >= 0 ? 1 : -1;
                        if (a.type !== 'project') posA.x += dir * push;
                        if (b.type !== 'project') posB.x -= dir * push;
                    } else {
                        const push = overlapY / 2;
                        const dir = dy >= 0 ? 1 : -1;
                        if (a.type !== 'project') posA.y += dir * push;
                        if (b.type !== 'project') posB.y -= dir * push;
                    }
                }
            });
        });

        if (!hasCollision) break;
    }

    return nodes.map(n => ({
        ...n,
        position: positions.get(n.id) || n.position,
    }));
}
