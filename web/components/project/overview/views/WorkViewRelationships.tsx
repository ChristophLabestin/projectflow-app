import React from 'react';
import type { WorkViewContext } from './shared/viewTypes';

type GraphNode = {
    id: string;
    refId: string;
    kind: 'initiative' | 'task' | 'milestone';
    label: string;
    x: number;
    y: number;
};

type GraphEdge = { from: string; to: string; kind: 'member' | 'dependency' | 'milestone' };

const NODE_W = 150;
const NODE_H = 38;
const COL_GAP = 220;
const ROW_GAP = 54;

const kindColumn: Record<GraphNode['kind'], number> = { initiative: 0, task: 1, milestone: 2 };

export const WorkViewRelationships: React.FC<{ ctx: WorkViewContext }> = ({ ctx }) => {
    const { initiatives, items, milestones, t } = ctx;

    const { nodes, edges, width, height } = React.useMemo(() => {
        const tasks = items.filter((i) => i.kind === 'task' && i.task).map((i) => i.task!);
        const nodeList: GraphNode[] = [];
        const edgeList: GraphEdge[] = [];

        const colCounters: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
        const place = (kind: GraphNode['kind'], refId: string, label: string): GraphNode => {
            const col = kindColumn[kind];
            const row = colCounters[col]++;
            const node: GraphNode = {
                id: `${kind}:${refId}`,
                refId,
                kind,
                label,
                x: 16 + col * COL_GAP,
                y: 16 + row * ROW_GAP
            };
            nodeList.push(node);
            return node;
        };

        const nodeIndex = new Map<string, GraphNode>();
        const register = (node: GraphNode) => nodeIndex.set(node.id, node);

        initiatives.forEach((initiative) => register(place('initiative', initiative.id, initiative.title)));
        tasks.forEach((task) => register(place('task', task.id, task.title)));
        milestones.forEach((milestone) => register(place('milestone', milestone.id, milestone.title)));

        const has = (id: string) => nodeIndex.has(id);

        tasks.forEach((task) => {
            if (task.initiativeId && has(`initiative:${task.initiativeId}`)) {
                edgeList.push({ from: `initiative:${task.initiativeId}`, to: `task:${task.id}`, kind: 'member' });
            }
            (task.dependencies || []).forEach((dep) => {
                if (has(`task:${dep}`)) edgeList.push({ from: `task:${dep}`, to: `task:${task.id}`, kind: 'dependency' });
            });
        });

        milestones.forEach((milestone) => {
            (milestone.linkedTaskIds || []).forEach((taskId) => {
                if (has(`task:${taskId}`)) edgeList.push({ from: `task:${taskId}`, to: `milestone:${milestone.id}`, kind: 'milestone' });
            });
            if (milestone.linkedInitiativeId && has(`initiative:${milestone.linkedInitiativeId}`)) {
                edgeList.push({ from: `initiative:${milestone.linkedInitiativeId}`, to: `milestone:${milestone.id}`, kind: 'milestone' });
            }
        });

        const maxRows = Math.max(colCounters[0], colCounters[1], colCounters[2], 1);
        return {
            nodes: nodeList,
            edges: edgeList,
            width: 16 + 2 * COL_GAP + NODE_W + 16,
            height: 16 + maxRows * ROW_GAP + 16
        };
    }, [initiatives, items, milestones]);

    const nodeById = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

    if (nodes.length === 0) {
        return (
            <div className="po-view-empty">
                <span className="material-symbols-outlined">hub</span>
                <p>{t('projectOverview.v2.relationships.empty', 'No linked work to map yet')}</p>
            </div>
        );
    }

    const handleClick = (node: GraphNode) => {
        if (node.kind === 'task') {
            const item = ctx.items.find((i) => i.kind === 'task' && i.id === node.refId);
            if (item) ctx.onItemClick(item);
        } else if (node.kind === 'initiative') {
            const item = ctx.items.find((i) => i.kind === 'initiative' && i.id === node.refId);
            ctx.onItemClick(item || ({ kind: 'initiative', id: node.refId, title: node.label } as any));
        }
    };

    return (
        <div className="po-graph">
            <div className="po-graph__legend">
                <span className="po-graph__legend-item po-graph__legend-item--member">{t('projectOverview.v2.relationships.member', 'In initiative')}</span>
                <span className="po-graph__legend-item po-graph__legend-item--dependency">{t('projectOverview.v2.relationships.dependency', 'Depends on')}</span>
                <span className="po-graph__legend-item po-graph__legend-item--milestone">{t('projectOverview.v2.relationships.milestone', 'Milestone')}</span>
            </div>
            <div className="po-graph__scroll">
                <svg className="po-graph__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                    <defs>
                        <marker id="po-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                            <path d="M0,0 L8,4 L0,8 Z" className="po-graph__arrow" />
                        </marker>
                    </defs>
                    {edges.map((edge, idx) => {
                        const from = nodeById.get(edge.from);
                        const to = nodeById.get(edge.to);
                        if (!from || !to) return null;
                        const x1 = from.x + NODE_W;
                        const y1 = from.y + NODE_H / 2;
                        const x2 = to.x;
                        const y2 = to.y + NODE_H / 2;
                        const mid = (x1 + x2) / 2;
                        return (
                            <path
                                key={idx}
                                className={`po-graph__edge po-graph__edge--${edge.kind}`}
                                d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                                markerEnd="url(#po-arrow)"
                            />
                        );
                    })}
                    {nodes.map((node) => (
                        <g
                            key={node.id}
                            className={`po-graph__node po-graph__node--${node.kind}`}
                            transform={`translate(${node.x}, ${node.y})`}
                            onClick={() => handleClick(node)}
                        >
                            <rect width={NODE_W} height={NODE_H} rx="8" />
                            <text x="10" y={NODE_H / 2} dominantBaseline="central">
                                {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        </div>
    );
};
