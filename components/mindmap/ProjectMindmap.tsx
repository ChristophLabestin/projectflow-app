import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    MindmapProvider,
    useMindmap,
    MindmapNodeData,
    MindmapEdgeData,
    LayoutType
} from './hooks/useMindmapStore';
import { MindmapCanvas } from './MindmapCanvas';
import { MindmapToolbar } from './MindmapToolbar';
import { MindmapMinimap } from './MindmapMinimap';
import { MindmapSearchBar } from './MindmapSearchBar';
import { MindmapContextMenu } from './MindmapContextMenu';
import { useMindmapKeyboard } from './hooks/useMindmapKeyboard';
import { applyLayout, resolveCollisions } from './utils/layoutAlgorithms';
import { Idea, Mindmap, Project, Task, Issue, SocialCampaign, Milestone } from '../../types';
import {
    getProjectById,
    getProjectIdeas,
    getProjectMindmaps,
    createMindmap,
    updateIdea,
    saveIdea,
    subscribeProjectTasks,
    subscribeProjectIssues,
    subscribeProjectMilestones,
} from '../../services/dataService';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { suggestMindmapGrouping } from '../../services/geminiService';

// ============================================================================
// Constants
// ============================================================================

const CANVAS_CENTER = 2000;

const GROUP_COLORS = [
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#f97316', // Orange
    '#84cc16', // Lime
];

// ============================================================================
// Helper: Normalize Group Name
// ============================================================================

const normalizeGroupName = (value?: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return '';
    return trimmed.toLowerCase() === 'ideas' ? 'Flows' : trimmed;
};

// ============================================================================
// Inner Component (has access to context)
// ============================================================================

interface ProjectMindmapInnerProps {
    projectId: string;
}

function ProjectMindmapInner({ projectId }: ProjectMindmapInnerProps) {
    const {
        state,
        setNodes,
        setEdges,
        dispatch,
        pushHistory,
        setPan,
        setZoom
    } = useMindmap();

    // Data state
    const [project, setProject] = useState<Project | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
    const [activeMindmapId, setActiveMindmapId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UI state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        position: { x: number; y: number } | null;
        targetNode: MindmapNodeData | null;
    }>({ position: null, targetNode: null });

    const containerRef = useRef<HTMLDivElement>(null);

    // Active mindmap
    const activeMindmap = useMemo(
        () => mindmaps.find(m => m.id === activeMindmapId) || mindmaps[0],
        [mindmaps, activeMindmapId]
    );

    // Filter ideas for active mindmap
    const mapIdeas = useMemo(() => {
        if (!activeMindmap || !mindmaps.length) return [];
        const primaryId = mindmaps[0]?.id;
        if (activeMindmap.id === primaryId) {
            return ideas.filter(i => !i.mindmapId || i.mindmapId === primaryId);
        }
        return ideas.filter(i => i.mindmapId === activeMindmap.id);
    }, [ideas, activeMindmap, mindmaps]);

    // ========================================================================
    // Data Loading
    // ========================================================================

    const loadData = useCallback(async (silent = false) => {
        if (!projectId) return;
        if (!silent) setLoading(true);
        setError(null);

        try {
            const proj = await getProjectById(projectId);
            setProject(proj);

            const [maps, projIdeas] = await Promise.all([
                getProjectMindmaps(projectId),
                getProjectIdeas(projectId)
            ]);

            let mapList = maps;
            if (!mapList.length) {
                const defaultName = proj?.title || 'Mindmap';
                const newId = await createMindmap(projectId, defaultName);
                mapList = await getProjectMindmaps(projectId);
                setActiveMindmapId(newId);
            }

            setMindmaps(mapList);
            if (!activeMindmapId && mapList.length) {
                setActiveMindmapId(mapList[0].id);
            }
            setIdeas(projIdeas);
        } catch (e) {
            console.error(e);
            setError('Failed to load mindmap data.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, [projectId, activeMindmapId]);

    useEffect(() => {
        loadData();
    }, [projectId]);

    // Subscribe to real-time data for all entity types
    useEffect(() => {
        if (!project?.tenantId) return;

        // Subscribe to tasks
        const unsubTasks = subscribeProjectTasks(projectId, setTasks, project.tenantId);

        // Subscribe to issues (if module enabled)
        const unsubIssues = project.modules?.includes('issues')
            ? subscribeProjectIssues(projectId, setIssues, project.tenantId)
            : () => { };

        // Subscribe to milestones (if module enabled)
        const unsubMilestones = project.modules?.includes('milestones')
            ? subscribeProjectMilestones(projectId, setMilestones, project.tenantId)
            : () => { };

        // Subscribe to campaigns (if social module enabled)
        let unsubCampaigns = () => { };
        if (project.modules?.includes('social')) {
            const campaignsQuery = query(
                collection(db, 'tenants', project.tenantId, 'social_campaigns'),
                where('projectId', '==', projectId)
            );
            unsubCampaigns = onSnapshot(campaignsQuery, (snap) => {
                setCampaigns(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialCampaign)));
            });
        }

        return () => {
            unsubTasks();
            unsubIssues();
            unsubMilestones();
            unsubCampaigns();
        };
    }, [projectId, project?.tenantId, project?.modules]);

    // ========================================================================
    // Build Nodes & Edges from All Entities
    // ========================================================================

    useEffect(() => {
        if (!project) return;

        // Build nodes
        const nodes: MindmapNodeData[] = [];
        const edges: MindmapEdgeData[] = [];
        const groupSet = new Set<string>();
        const nodeIdSet = new Set<string>();

        // Project node (center)
        nodes.push({
            id: 'project',
            type: 'project',
            label: activeMindmap?.name || project.title,
            position: { x: CANVAS_CENTER, y: CANVAS_CENTER },
        });
        nodeIdSet.add('project');

        // Add entity type group nodes
        const entityGroups = [
            { id: 'ideas-group', label: 'Flows', color: '#f59e0b', hasData: mapIdeas.length > 0 },
            { id: 'tasks-group', label: 'Tasks', color: '#10b981', hasData: tasks.length > 0 },
            { id: 'issues-group', label: 'Issues', color: '#ef4444', hasData: issues.length > 0 },
            { id: 'campaigns-group', label: 'Campaigns', color: '#ec4899', hasData: campaigns.length > 0 },
            { id: 'milestones-group', label: 'Milestones', color: '#3b82f6', hasData: milestones.length > 0 },
        ].filter(g => g.hasData);

        entityGroups.forEach(group => {
            nodes.push({
                id: group.id,
                type: 'group',
                label: group.label,
                parentId: 'project',
                position: { x: 0, y: 0 },
                color: group.color,
            });
            nodeIdSet.add(group.id);
            edges.push({
                id: `edge-project-${group.id}`,
                sourceId: 'project',
                targetId: group.id,
                type: 'hierarchy',
            });
        });

        // Create Idea sub-groups and nodes
        mapIdeas.forEach(idea => {
            const groupName = normalizeGroupName(idea.type);
            if (groupName) groupSet.add(groupName);
        });

        Array.from(groupSet).forEach((groupName, idx) => {
            const groupId = `idea-subgroup-${groupName}`;
            nodes.push({
                id: groupId,
                type: 'group',
                label: groupName,
                parentId: 'ideas-group',
                groupName,
                position: { x: 0, y: 0 },
                color: GROUP_COLORS[idx % GROUP_COLORS.length],
            });
            nodeIdSet.add(groupId);
            edges.push({
                id: `edge-ideas-group-${groupId}`,
                sourceId: 'ideas-group',
                targetId: groupId,
                type: 'hierarchy',
            });
        });

        // Create idea nodes
        const ideaIdSet = new Set(mapIdeas.map(i => i.id));
        mapIdeas.forEach(idea => {
            const groupName = normalizeGroupName(idea.type);
            const parentId = idea.parentIdeaId && ideaIdSet.has(idea.parentIdeaId)
                ? idea.parentIdeaId
                : groupName ? `idea-subgroup-${groupName}` : 'ideas-group';

            nodes.push({
                id: idea.id,
                type: 'idea',
                label: idea.title,
                parentId,
                groupName,
                position: { x: idea.posX ?? 0, y: idea.posY ?? 0 },
                idea,
            });
            nodeIdSet.add(idea.id);
            edges.push({
                id: `edge-${parentId}-${idea.id}`,
                sourceId: parentId,
                targetId: idea.id,
                type: 'hierarchy',
            });
        });

        // Create task nodes
        tasks.forEach(task => {
            nodes.push({
                id: `task-${task.id}`,
                type: 'task',
                label: task.title,
                parentId: 'tasks-group',
                position: { x: 0, y: 0 },
                task,
            });
            nodeIdSet.add(`task-${task.id}`);
            edges.push({
                id: `edge-tasks-group-task-${task.id}`,
                sourceId: 'tasks-group',
                targetId: `task-${task.id}`,
                type: 'hierarchy',
            });
        });

        // Create issue nodes
        issues.forEach(issue => {
            nodes.push({
                id: `issue-${issue.id}`,
                type: 'issue',
                label: issue.title,
                parentId: 'issues-group',
                position: { x: 0, y: 0 },
                issue,
            });
            nodeIdSet.add(`issue-${issue.id}`);
            edges.push({
                id: `edge-issues-group-issue-${issue.id}`,
                sourceId: 'issues-group',
                targetId: `issue-${issue.id}`,
                type: 'hierarchy',
            });
        });

        // Create campaign nodes
        campaigns.forEach(campaign => {
            nodes.push({
                id: `campaign-${campaign.id}`,
                type: 'campaign',
                label: campaign.name,
                parentId: 'campaigns-group',
                position: { x: 0, y: 0 },
                campaign,
            });
            nodeIdSet.add(`campaign-${campaign.id}`);
            edges.push({
                id: `edge-campaigns-group-campaign-${campaign.id}`,
                sourceId: 'campaigns-group',
                targetId: `campaign-${campaign.id}`,
                type: 'hierarchy',
            });
        });

        // Create milestone nodes
        milestones.forEach(milestone => {
            nodes.push({
                id: `milestone-${milestone.id}`,
                type: 'milestone',
                label: milestone.title,
                parentId: 'milestones-group',
                position: { x: 0, y: 0 },
                milestone,
            });
            nodeIdSet.add(`milestone-${milestone.id}`);
            edges.push({
                id: `edge-milestones-group-milestone-${milestone.id}`,
                sourceId: 'milestones-group',
                targetId: `milestone-${milestone.id}`,
                type: 'hierarchy',
            });
        });

        // ====================================================================
        // Cross-Entity Connection Edges
        // ====================================================================

        // Idea → Task conversion edges
        mapIdeas.forEach(idea => {
            if (idea.convertedTaskId && nodeIdSet.has(`task-${idea.convertedTaskId}`)) {
                edges.push({
                    id: `conv-idea-task-${idea.id}-${idea.convertedTaskId}`,
                    sourceId: idea.id,
                    targetId: `task-${idea.convertedTaskId}`,
                    type: 'conversion',
                    label: 'converted',
                });
            }
        });

        // Idea → Campaign conversion edges (via originIdeaId on campaigns)
        campaigns.forEach(campaign => {
            if (campaign.originIdeaId && nodeIdSet.has(campaign.originIdeaId)) {
                edges.push({
                    id: `conv-idea-campaign-${campaign.originIdeaId}-${campaign.id}`,
                    sourceId: campaign.originIdeaId,
                    targetId: `campaign-${campaign.id}`,
                    type: 'conversion',
                    label: 'campaign',
                });
            }
        });

        // Task ← Issue linked edges
        tasks.forEach(task => {
            if (task.linkedIssueId && nodeIdSet.has(`issue-${task.linkedIssueId}`)) {
                edges.push({
                    id: `link-task-issue-${task.id}-${task.linkedIssueId}`,
                    sourceId: `task-${task.id}`,
                    targetId: `issue-${task.linkedIssueId}`,
                    type: 'linked',
                    label: 'linked',
                });
            }
        });

        // Task dependencies
        tasks.forEach(task => {
            if (task.dependencies?.length) {
                task.dependencies.forEach(depId => {
                    if (nodeIdSet.has(`task-${depId}`)) {
                        edges.push({
                            id: `dep-${depId}-${task.id}`,
                            sourceId: `task-${depId}`,
                            targetId: `task-${task.id}`,
                            type: 'dependency',
                            label: 'depends on',
                        });
                    }
                });
            }
        });

        // Milestone → linked Tasks
        milestones.forEach(milestone => {
            if (milestone.linkedTaskIds?.length) {
                milestone.linkedTaskIds.forEach(taskId => {
                    if (nodeIdSet.has(`task-${taskId}`)) {
                        edges.push({
                            id: `link-milestone-task-${milestone.id}-${taskId}`,
                            sourceId: `milestone-${milestone.id}`,
                            targetId: `task-${taskId}`,
                            type: 'linked',
                        });
                    }
                });
            }
        });

        // Always apply layout to ensure consistent positioning
        const layoutedNodes = applyLayout(nodes, state.activeLayout);

        // Resolve collisions
        const finalNodes = resolveCollisions(layoutedNodes);

        setNodes(finalNodes);
        setEdges(edges);

        // Auto fit view after layout
        setTimeout(() => {
            if (finalNodes.length === 0) return;

            // Calculate bounds
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            finalNodes.forEach(node => {
                minX = Math.min(minX, node.position.x);
                maxX = Math.max(maxX, node.position.x);
                minY = Math.min(minY, node.position.y);
                maxY = Math.max(maxY, node.position.y);
            });

            const padding = 200;
            const contentWidth = maxX - minX + padding * 2;
            const contentHeight = maxY - minY + padding * 2;
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // Get container size
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();

            // Calculate zoom to fit
            const zoomX = rect.width / contentWidth;
            const zoomY = rect.height / contentHeight;
            const newZoom = Math.min(zoomX, zoomY, 1.2);

            setZoom(Math.max(0.3, newZoom));
            setPan({
                x: rect.width / 2 / newZoom - centerX,
                y: rect.height / 2 / newZoom - centerY,
            });
        }, 100);
    }, [project, mapIdeas, tasks, issues, campaigns, milestones, activeMindmap, state.activeLayout, setNodes, setEdges, setZoom, setPan]);

    // ========================================================================
    // AI Auto-Group
    // ========================================================================

    const handleAutoGroup = useCallback(async () => {
        if (!project || !mapIdeas.length) return;
        setAiLoading(true);

        try {
            const suggestion = await suggestMindmapGrouping(project, mapIdeas);

            const updates: Promise<void>[] = [];
            suggestion.forEach(group => {
                group.ideaIds.forEach(ideaId => {
                    const idea = mapIdeas.find(i => i.id === ideaId);
                    if (idea && normalizeGroupName(idea.type) !== group.group) {
                        updates.push(updateIdea(idea.id, { type: group.group }, projectId));
                    }
                });
            });

            if (updates.length) {
                await Promise.all(updates);
                await loadData(true);
            }
        } catch (e) {
            console.error(e);
            setError('Failed to auto-group.');
        } finally {
            setAiLoading(false);
        }
    }, [project, mapIdeas, projectId, loadData]);

    // ========================================================================
    // Fit View
    // ========================================================================

    const handleFitView = useCallback(() => {
        if (state.nodes.length === 0) return;

        // Calculate bounds
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        state.nodes.forEach(node => {
            minX = Math.min(minX, node.position.x);
            maxX = Math.max(maxX, node.position.x);
            minY = Math.min(minY, node.position.y);
            maxY = Math.max(maxY, node.position.y);
        });

        const padding = 150;
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        // Get container size
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();

        // Calculate zoom to fit
        const zoomX = rect.width / contentWidth;
        const zoomY = rect.height / contentHeight;
        const newZoom = Math.min(zoomX, zoomY, 1.5);

        // Center the content
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        setZoom(Math.max(0.2, newZoom));
        setPan({
            x: rect.width / 2 / newZoom - centerX,
            y: rect.height / 2 / newZoom - centerY,
        });
    }, [state.nodes, setZoom, setPan]);

    // ========================================================================
    // Context Menu
    // ========================================================================

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        const target = (e.target as HTMLElement).closest('[data-node-id]');
        const nodeId = target?.getAttribute('data-node-id');
        const node = nodeId ? state.nodes.find(n => n.id === nodeId) : null;

        setContextMenu({
            position: { x: e.clientX, y: e.clientY },
            targetNode: node || null,
        });
    }, [state.nodes]);

    const closeContextMenu = useCallback(() => {
        setContextMenu({ position: null, targetNode: null });
    }, []);

    // ========================================================================
    // Keyboard Shortcuts
    // ========================================================================

    useMindmapKeyboard({
        onOpenSearch: () => setIsSearchOpen(true),
        onFitView: handleFitView,
        onToggleFullscreen: () => setIsFullscreen(!isFullscreen),
        isFullscreen,
    });

    // ========================================================================
    // Apply Layout
    // ========================================================================

    const handleLayoutChange = useCallback((layout: LayoutType) => {
        pushHistory();
        const newNodes = applyLayout(state.nodes, layout);
        const resolved = resolveCollisions(newNodes);
        setNodes(resolved);
        dispatch({ type: 'SET_LAYOUT', layout });
    }, [state.nodes, setNodes, pushHistory, dispatch]);

    // ========================================================================
    // Persist Node Positions
    // ========================================================================

    useEffect(() => {
        // Debounced position save
        const timeout = setTimeout(async () => {
            const updates: Promise<void>[] = [];
            state.nodes.forEach(node => {
                if (node.type === 'idea' && node.idea) {
                    const idea = node.idea;
                    if (idea.posX !== node.position.x || idea.posY !== node.position.y) {
                        updates.push(
                            updateIdea(node.id, {
                                posX: node.position.x,
                                posY: node.position.y
                            }, projectId)
                        );
                    }
                }
            });
            if (updates.length > 0) {
                try {
                    await Promise.all(updates);
                } catch (e) {
                    console.error('Failed to save positions:', e);
                }
            }
        }, 2000);

        return () => clearTimeout(timeout);
    }, [state.nodes, projectId]);

    // ========================================================================
    // Render
    // ========================================================================

    if (loading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl">
                <div className="flex flex-col items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-indigo-500 animate-spin">
                        progress_activity
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">Loading mindmap...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl">
                <div className="flex flex-col items-center gap-3 text-red-500">
                    <span className="material-symbols-outlined text-4xl">error</span>
                    <span className="text-sm">{error}</span>
                    <button
                        onClick={() => loadData()}
                        className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/30 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const mindmapContent = (
        <div
            ref={containerRef}
            className={`
                relative overflow-hidden w-full h-full
                ${isFullscreen ? 'bg-slate-900' : 'rounded-3xl border border-slate-200 dark:border-slate-800'}
            `}
            onContextMenu={handleContextMenu}
        >
            {/* Canvas */}
            <MindmapCanvas />

            {/* Toolbar */}
            <MindmapToolbar
                onAutoGroup={handleAutoGroup}
                onFitView={handleFitView}
                onLayoutChange={handleLayoutChange}
                onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
                isFullscreen={isFullscreen}
                isAiLoading={aiLoading}
            />

            {/* Minimap */}
            <MindmapMinimap />

            {/* Search Bar */}
            <MindmapSearchBar
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
            />

            {/* Context Menu */}
            <MindmapContextMenu
                position={contextMenu.position}
                targetNode={contextMenu.targetNode}
                onClose={closeContextMenu}
            />

            {/* Keyboard Shortcut Hint */}
            <div className="absolute bottom-4 left-4 z-20 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-4">
                <span>⌘F Search</span>
                <span>⌘Z Undo</span>
                <span>1-5 Layouts</span>
                <span>F Fullscreen</span>
            </div>
        </div>
    );

    // Fullscreen modal
    if (isFullscreen) {
        return (
            <>
                {/* Placeholder when fullscreen */}
                <div className="w-full h-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span className="material-symbols-outlined">fullscreen</span>
                        <span>Mindmap is in fullscreen mode</span>
                    </div>
                </div>

                {/* Fullscreen Modal Overlay - Rendered via Portal */}
                {createPortal(
                    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-400">hub</span>
                                Mindmap
                            </h2>
                            <button
                                onClick={() => setIsFullscreen(false)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">fullscreen_exit</span>
                                Exit Fullscreen
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden">
                            {mindmapContent}
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    }

    return mindmapContent;
}

// ============================================================================
// Main Export (with Provider)
// ============================================================================

interface ProjectMindmapProps {
    projectId: string;
    className?: string;
}

export function ProjectMindmap({ projectId, className }: ProjectMindmapProps) {
    return (
        <MindmapProvider>
            <div className={`w-full h-full ${className || ''}`}>
                <ProjectMindmapInner projectId={projectId} />
            </div>
        </MindmapProvider>
    );
}

export default ProjectMindmap;

