import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Idea, Mindmap, MindmapGrouping, Project } from '../types';
import { addTask, deleteIdea, getProjectById, getProjectIdeas, getProjectMindmaps, saveIdea, updateIdea, createMindmap, updateMindmapName } from '../services/dataService';
import { suggestMindmapGrouping } from '../services/geminiService';

type MapNodeType = 'project' | 'group' | 'idea';

type MapNode = {
    id: string;
    label: string;
    type: MapNodeType;
    parentId?: string;
    idea?: Idea;
    groupName?: string;
};

const WORLD_SIZE = 2200;
const ORIGIN = WORLD_SIZE / 2;
const MIN_NODE_DISTANCE = 60;
const NODE_HALF_WIDTH: Record<MapNodeType, number> = {
    project: 160,
    group: 120,
    idea: 100,
};
const NODE_HALF_HEIGHT: Record<MapNodeType, number> = {
    project: 70,
    group: 56,
    idea: 44,
};

const normalizeGroupName = (value?: string) => (value && value.trim() ? value.trim() : '');
const groupNodeId = (name: string) => `group-${name}`;
const GROUP_COLOR_PALETTE = [
    { bg: '#f6f4ff', border: '#d9d0ff', text: '#2f2a4a' },
    { bg: '#eef7ff', border: '#cce5ff', text: '#0f3a63' },
    { bg: '#ebfff5', border: '#c9f3e2', text: '#0f3b2c' },
    { bg: '#fff6ed', border: '#ffd7b8', text: '#5b2a02' },
    { bg: '#fff1f4', border: '#ffc7d4', text: '#611126' },
    { bg: '#f0f9ff', border: '#b6e0fe', text: '#083c5a' },
];
const DEFAULT_GROUP_VISUAL = { bg: '#f5f5f4', border: '#d4d4d4', text: '#111827' };

export const ProjectMindmap = () => {
    const { id } = useParams<{ id: string }>();
    const containerRef = useRef<HTMLDivElement>(null);

    const [project, setProject] = useState<Project | null>(null);
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
    const [activeMindmapId, setActiveMindmapId] = useState<string | null>(null);
    const activeMindmap = useMemo(() => mindmaps.find(m => m.id === activeMindmapId) || mindmaps[0], [mindmaps, activeMindmapId]);
    const [loading, setLoading] = useState(true);
    const [aiLoading, setAiLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [groupReasons, setGroupReasons] = useState<Record<string, string>>({});
    const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editGroup, setEditGroup] = useState('');
    const [customGroup, setCustomGroup] = useState('');
    const [newIdeaTitle, setNewIdeaTitle] = useState('');
    const [newIdeaDesc, setNewIdeaDesc] = useState('');
    const [newBranchName, setNewBranchName] = useState('');
    const [attachBranchToSelected, setAttachBranchToSelected] = useState(false);
    const [renameGroupName, setRenameGroupName] = useState('');
    const [attachToSelectedIdea, setAttachToSelectedIdea] = useState(false);
    const [attachToSelectedGroup, setAttachToSelectedGroup] = useState(false);
    const [customBranches, setCustomBranches] = useState<{ name: string; parentId?: string | null; colorIndex?: number }[]>([]);
    const [linkMode, setLinkMode] = useState<{ type: 'branchParent' | 'ideaLink' | null }>({ type: null });
    const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<string | null>(null);
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const statusTimeout = useRef<NodeJS.Timeout | null>(null);
    const newIdeaInputRef = useRef<HTMLInputElement | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
    const [panOrigin, setPanOrigin] = useState({ x: 0, y: 0 });
    const [hasCentered, setHasCentered] = useState(false);
    const [autoExpanded, setAutoExpanded] = useState(false);
    const [drawerMode, setDrawerMode] = useState<'edit' | 'map'>('edit');
    const [showMapMenu, setShowMapMenu] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});
    const activePointerId = useRef<number | null>(null);
    const captureTarget = useRef<HTMLElement | null>(null);
    const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
    const resizeObserver = useRef<ResizeObserver | null>(null);

    const loadData = async (opts?: { silent?: boolean }) => {
        if (!id) return;
        if (!opts?.silent) setLoading(true);
        setError(null);
        try {
            const proj = await getProjectById(id);
            setProject(proj);
            const [maps, projIdeas] = await Promise.all([
                getProjectMindmaps(id),
                getProjectIdeas(id)
            ]);
            let mapList = maps;
            if (!mapList.length) {
                const defaultName = proj?.title || 'Mindmap';
                const newId = await createMindmap(id, defaultName);
                mapList = await getProjectMindmaps(id);
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
            if (!opts?.silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const getWorldCoordsForNode = (nodeId: string) => {
        const pos = positions[nodeId];
        if (!pos) return null;
        return { x: ORIGIN + pos.x, y: ORIGIN + pos.y };
    };

    const resolveAnchorPoint = (clientX?: number, clientY?: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (clientX !== undefined && clientY !== undefined) return { x: clientX, y: clientY };
        const hasLast = (lastPointer.current.x !== 0 || lastPointer.current.y !== 0);
        if (hasLast) return lastPointer.current;
        if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        return { x: 0, y: 0 };
    };

    const anchorFromWheel = (e: React.WheelEvent | WheelEvent) => {
        // Prefer client coordinates to avoid target-relative offsets from nested elements.
        const cx = (e as any).clientX;
        const cy = (e as any).clientY;
        return resolveAnchorPoint(cx, cy);
    };

    const isWheelOnPanel = (e: React.WheelEvent | WheelEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return false;
        return Boolean(target.closest('[data-panel-scroll="true"]'));
    };

    const centerOnWorldPoint = (worldX: number, worldY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const nextPan = {
            x: rect.width / (2 * zoom) - worldX,
            y: rect.height / (2 * zoom) - worldY,
        };
        setPan(nextPan);
    };

    const centerView = () => {
        const world = getWorldCoordsForNode(selectedIdeaId || 'project');
        if (world) {
            centerOnWorldPoint(world.x, world.y);
        } else {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                setPan({ x: rect.width / 2 - ORIGIN, y: rect.height / 2 - ORIGIN });
            } else {
                setPan({ x: 0, y: 0 });
            }
        }
    };

    useEffect(() => {
        if (!hasCentered) {
            centerView();
            setHasCentered(true);
        }
    }, [hasCentered]);

    const focusNode = (nodeId: string | null) => {
        if (!nodeId) return;
        const world = getWorldCoordsForNode(nodeId);
        if (world) {
            centerOnWorldPoint(world.x, world.y);
        }
    };

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = isFullscreen ? 'hidden' : previous;
        return () => {
            document.body.style.overflow = previous;
        };
    }, [isFullscreen]);

    useEffect(() => {
        if (statusTimeout.current) {
            clearTimeout(statusTimeout.current);
            statusTimeout.current = null;
        }
        if (status) {
            statusTimeout.current = setTimeout(() => setStatus(null), 3500);
        }
        return () => {
            if (statusTimeout.current) {
                clearTimeout(statusTimeout.current);
                statusTimeout.current = null;
            }
        };
    }, [status]);

    const mapIdeas = useMemo(() => {
        if (!activeMindmap || !mindmaps.length) return [];
        const primaryId = mindmaps[0]?.id;
        if (activeMindmap.id === primaryId) {
            return ideas.filter(i => !i.mindmapId || i.mindmapId === primaryId);
        }
        return ideas.filter(i => i.mindmapId === activeMindmap.id);
    }, [ideas, activeMindmap, mindmaps]);

    const ideasOutsideActive = useMemo(() => {
        if (!activeMindmap) return [];
        return ideas.filter((idea) => {
            if (!idea.mindmapId) return activeMindmap.id !== mindmaps[0]?.id; // only show unassigned if not default map
            return idea.mindmapId !== activeMindmap.id;
        });
    }, [ideas, activeMindmap, mindmaps]);

    const childrenByParent = useMemo(() => {
        const map: Record<string, Idea[]> = {};
        mapIdeas.forEach((idea) => {
            if (!idea.parentIdeaId) return;
            if (!map[idea.parentIdeaId]) map[idea.parentIdeaId] = [];
            map[idea.parentIdeaId].push(idea);
        });
        return map;
    }, [mapIdeas]);

    const groups = useMemo(() => {
        const names = new Set<string>();
        customBranches.forEach((b) => b.name && names.add(b.name));
        mapIdeas.forEach((idea) => {
            const name = normalizeGroupName(idea.type);
            if (name) names.add(name);
        });
        return Array.from(names);
    }, [mapIdeas, customBranches]);

    const groupVisuals = useMemo(() => {
        const visuals: Record<string, { bg: string; border: string; text: string }> = {};
        groups.forEach((group, idx) => {
            const branchInfo = customBranches.find((b) => b.name === group);
            const colorIndex = branchInfo?.colorIndex ?? idx;
            visuals[group] = GROUP_COLOR_PALETTE[colorIndex % GROUP_COLOR_PALETTE.length] || DEFAULT_GROUP_VISUAL;
        });
        return visuals;
    }, [groups, customBranches]);

    const groupIdeaCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        mapIdeas.forEach((idea) => {
            const key = normalizeGroupName(idea.type);
            if (!key) return;
            counts[key] = (counts[key] || 0) + 1;
        });
        return counts;
    }, [mapIdeas]);

    const activeIdea = useMemo(() => ideas.find((i) => i.id === selectedIdeaId) || null, [ideas, selectedIdeaId]);

    const mapSummary = useMemo(() => ({
        ideaCount: mapIdeas.length,
        groupCount: groups.length,
        collapsedCount: collapsedGroups.size,
        mindmapCount: mindmaps.length,
    }), [mapIdeas.length, groups.length, collapsedGroups, mindmaps.length]);

    const getGroupVisual = (groupName?: string) => groupVisuals[groupName || ''] || DEFAULT_GROUP_VISUAL;

    useEffect(() => {
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver((entries) => {
            entries.forEach(({ target, contentRect }) => {
                const id = (target as HTMLElement).dataset.nodeId;
                if (!id) return;
                const w = contentRect.width;
                const h = contentRect.height;
                setNodeSizes((prev) => {
                    const current = prev[id];
                    if (current && Math.abs(current.w - w) < 1 && Math.abs(current.h - h) < 1) return prev;
                    return { ...prev, [id]: { w, h } };
                });
            });
        });
        resizeObserver.current = ro;
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        seedPositions();
        if (!autoExpanded && mapIdeas.length > 0) {
            setCollapsedGroups(new Set());
            setAutoExpanded(true);
        }
    }, [groups, mapIdeas]);

    useEffect(() => {
        positionsRef.current = positions;
    }, [positions]);

    useEffect(() => {
        if (!mapIdeas.length) return;
        setPositions((prev) => {
            let changed = false;
            const next = { ...prev };
            mapIdeas.forEach((idea) => {
                if (idea.posX === undefined || idea.posY === undefined) return;
                const existing = next[idea.id];
                if (!existing || existing.x !== idea.posX || existing.y !== idea.posY) {
                    next[idea.id] = { x: idea.posX, y: idea.posY };
                    changed = true;
                }
            });
            if (!changed) return prev;
            positionsRef.current = next;
            return settleAllCollisions(next);
        });
    }, [mapIdeas]);

    useEffect(() => {
        if (!activeMindmapId) {
            setCustomBranches([]);
            return;
        }
        const raw = localStorage.getItem(`mindmap_branches_${activeMindmapId}`);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    const used = new Set<number>();
                    const normalized = parsed.map((b: any) => {
                        const idx = typeof b.colorIndex === 'number' ? b.colorIndex : -1;
                        if (idx >= 0) used.add(idx);
                        return { name: b.name, parentId: b.parentId ?? null, colorIndex: idx };
                    });
                    let next = 0;
                    const assignColor = () => {
                        while (used.has(next)) {
                            next = (next + 1) % GROUP_COLOR_PALETTE.length;
                        }
                        const chosen = next;
                        used.add(chosen);
                        next = (next + 1) % GROUP_COLOR_PALETTE.length;
                        return chosen;
                    };
                    const withColors = normalized.map((b: any) => {
                        if (b.colorIndex === -1) {
                            return { ...b, colorIndex: assignColor() };
                        }
                        return b;
                    });
                    setCustomBranches(withColors);
                    return;
                }
            } catch {
                setCustomBranches([]);
                return;
            }
        }
        setCustomBranches([]);
    }, [activeMindmapId]);

    useEffect(() => {
        if (!activeMindmapId) return;
        localStorage.setItem(`mindmap_branches_${activeMindmapId}`, JSON.stringify(customBranches));
    }, [customBranches, activeMindmapId]);

    const getNextBranchColorIndex = (branches: { colorIndex?: number }[]) => {
        const used = branches
            .map((b) => b.colorIndex)
            .filter((v): v is number => typeof v === 'number' && v >= 0);
        const max = used.length ? Math.max(...used) : -1;
        return (max + 1) % GROUP_COLOR_PALETTE.length;
    };

    useEffect(() => {
        // Reseed positions when switching maps to avoid stale layout
        seedPositions();
        setSelectedIdeaId(null);
        setSelectedGroup(null);
        setAttachToSelectedIdea(false);
        setAttachBranchToSelected(false);
        setAttachToSelectedGroup(false);
        setLinkMode({ type: null });
    }, [activeMindmapId]);

    useEffect(() => {
        if (drawerMode === 'map') {
            setEditTitle(activeMindmap?.name || '');
        }
    }, [activeMindmap?.name, drawerMode]);

    useEffect(() => {
        if (selectedIdeaId) {
            const idea = ideas.find((i) => i.id === selectedIdeaId);
            if (idea) {
                setEditTitle(idea.title);
                setEditDesc(idea.description);
                setEditGroup(normalizeGroupName(idea.type));
                setCustomGroup('');
                setDrawerMode('edit');
            }
            setAttachToSelectedIdea(true);
            setAttachToSelectedGroup(false);
            setSelectedGroup(null);
        }
        setLinkMode({ type: null });
    }, [selectedIdeaId, ideas]);

    useEffect(() => {
        if (selectedGroup) {
            setRenameGroupName(selectedGroup);
            setSelectedIdeaId(null);
            setAttachToSelectedGroup(true);
            setAttachToSelectedIdea(false);
            setLinkMode({ type: null });
        }
    }, [selectedGroup]);

    const nodes: MapNode[] = useMemo(() => {
        const base: MapNode[] = [
            { id: 'project', label: activeMindmap?.name || project?.title || 'Mindmap', type: 'project' }
        ];
        const ideaIdSet = new Set(mapIdeas.map((i) => i.id));
        const branchLookup: Record<string, { parentId?: string | null }> = {};
        customBranches.forEach((b) => { branchLookup[b.name] = { parentId: b.parentId }; });

        groups.forEach((group) => {
            base.push({
                id: groupNodeId(group),
                label: group,
                type: 'group',
                parentId: branchLookup[group]?.parentId || 'project',
                groupName: group,
            });
        });

        mapIdeas.forEach((idea) => {
            const groupName = normalizeGroupName(idea.type);
            const parentId = idea.parentIdeaId && ideaIdSet.has(idea.parentIdeaId)
                ? idea.parentIdeaId
                : groupName
                    ? groupNodeId(groupName)
                    : 'project';
            base.push({
                id: idea.id,
                label: idea.title,
                type: 'idea',
                parentId,
                idea,
                groupName,
            });
        });

        return base;
    }, [mapIdeas, project?.title, groups, activeMindmap?.name, customBranches]);

    const visibleNodes = nodes.filter((node) => {
        if (node.type !== 'idea') return true;
        if (!node.groupName) return true;
        return !collapsedGroups.has(node.groupName);
    });
    const selectedIdeaNode = useMemo(() => visibleNodes.find((n) => n.idea?.id === selectedIdeaId) || null, [visibleNodes, selectedIdeaId]);
    const selectedIdeaWorld = selectedIdeaNode ? getWorldCoordsForNode(selectedIdeaNode.id) : null;

    const calcGroupPosition = (index: number, total: number) => {
        const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
        const radius = 320;
        return {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
        };
    };

    const calcLeafPosition = (base: { x: number; y: number }, index: number, total: number) => {
        const ring = Math.floor(index / 5);
        const slots = Math.max(total, 5);
        const angle = ((index % slots) / slots) * Math.PI * 2 + ring * 0.35;
        const radius = 140 + ring * 80;
        return {
            x: base.x + Math.cos(angle) * radius,
            y: base.y + Math.sin(angle) * radius,
        };
    };

    const calcChildPosition = (base: { x: number; y: number }, index: number, total: number) => {
        const angle = (index / Math.max(total, 4)) * Math.PI * 2 - Math.PI / 2;
        const radius = 120;
        return {
            x: base.x + Math.cos(angle) * radius,
            y: base.y + Math.sin(angle) * radius,
        };
    };

    const seedPositions = () => {
        setPositions((prev) => {
            const next = { ...prev };
            if (!next['project']) next['project'] = { x: 0, y: 0 };

            const branchLookup: Record<string, { parentId?: string | null }> = {};
            customBranches.forEach((b) => { branchLookup[b.name] = { parentId: b.parentId }; });

            groups.forEach((group, idx) => {
                const nodeId = groupNodeId(group);
                if (!next[nodeId]) {
                    const parentId = branchLookup[group]?.parentId || 'project';
                    const anchor = next[parentId] || { x: 0, y: 0 };
                    next[nodeId] = parentId === 'project'
                        ? calcGroupPosition(idx, Math.max(groups.length, 3))
                        : calcChildPosition(anchor, idx, Math.max(groups.length, 3));
                }
            });

            groups.forEach((group) => {
                const groupId = groupNodeId(group);
                const groupIdeas = mapIdeas.filter((i) => normalizeGroupName(i.type) === group && !i.parentIdeaId);
                groupIdeas.forEach((idea, ideaIndex) => {
                    if (!next[idea.id]) {
                        next[idea.id] = calcLeafPosition(
                            next[groupId] || { x: 0, y: 0 },
                            ideaIndex,
                            groupIdeas.length
                        );
                    }
                });
            });

            const placeChildren = (parentId: string) => {
                const kids = childrenByParent[parentId];
                if (!kids || !kids.length) return;
                const parentPos = next[parentId] || { x: 0, y: 0 };
                kids.forEach((child, idx) => {
                    if (!next[child.id]) {
                        next[child.id] = calcChildPosition(parentPos, idx, kids.length);
                    }
                    placeChildren(child.id);
                });
            };

            // Attach children for root-level ideas and project-root children
            placeChildren('project');
            mapIdeas
                .filter((idea) => !idea.parentIdeaId || idea.parentIdeaId === 'project')
                .forEach((idea) => placeChildren(idea.id));

            return settleAllCollisions(next);
        });
    };

    const worldStyle = {
        width: WORLD_SIZE,
        height: WORLD_SIZE,
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: '0 0',
    };
    const canvasHeight = isFullscreen ? '100vh' : 'calc(100vh - 160px)';

    const panByDelta = (deltaX: number, deltaY: number) => {
        setPan((prev) => ({
            x: prev.x - deltaX / zoom,
            y: prev.y - deltaY / zoom,
        }));
    };

    const getHalfSize = (node: MapNode, padding: number) => {
        const measured = nodeSizes[node.id];
        const baseW = NODE_HALF_WIDTH[node.type];
        const baseH = NODE_HALF_HEIGHT[node.type];
        const w = (measured?.w ?? baseW * 2) / 2 + padding;
        const h = (measured?.h ?? baseH * 2) / 2 + padding;
        return { w, h };
    };

    const applyCollision = (posMap: Record<string, { x: number; y: number }>, nodeId: string) => {
        const dragged = visibleNodes.find((n) => n.id === nodeId);
        if (!dragged) return posMap;
        const maxPasses = 12;
        const padding = 6;
        let pass = 0;
        let next = { ...posMap };

        while (pass < maxPasses) {
            pass += 1;
            let adjusted = false;
            let draggedPos = next[nodeId];
            if (!draggedPos) break;

            visibleNodes.forEach((node) => {
                if (node.id === nodeId || node.type === 'project') return;
                const other = next[node.id];
                if (!other) return;
                const dx = draggedPos.x - other.x;
                const dy = draggedPos.y - other.y;

                const a = getHalfSize(dragged, padding);
                const b = getHalfSize(node, padding);
                const halfX = a.w + b.w;
                const halfY = a.h + b.h;
                const overlapX = halfX - Math.abs(dx);
                const overlapY = halfY - Math.abs(dy);

                if (overlapX > 0 && overlapY > 0) {
                    adjusted = true;
                    // Resolve on the axis with the smaller penetration to mimic rectangular collision.
                    if (overlapX < overlapY) {
                        const push = overlapX / 2;
                        const dir = dx >= 0 ? 1 : -1;
                        draggedPos = { x: draggedPos.x + dir * push, y: draggedPos.y };
                        next[node.id] = { x: other.x - dir * push, y: other.y };
                    } else {
                        const push = overlapY / 2;
                        const dir = dy >= 0 ? 1 : -1;
                        draggedPos = { x: draggedPos.x, y: draggedPos.y + dir * push };
                        next[node.id] = { x: other.x, y: other.y - dir * push };
                    }
                    next[nodeId] = draggedPos;
                    return;
                }
            });

            if (!adjusted) break;
        }

        return next;
    };

    const settleAllCollisions = (posMap: Record<string, { x: number; y: number }>) => {
        const padding = 6;
        const nodesToCheck = visibleNodes.filter((n) => n.type !== 'project');
        let next = { ...posMap };
        let changed = false;

        for (let pass = 0; pass < 10; pass++) {
            let adjusted = false;
            for (let i = 0; i < nodesToCheck.length; i++) {
                for (let j = i + 1; j < nodesToCheck.length; j++) {
                    const aNode = nodesToCheck[i];
                    const bNode = nodesToCheck[j];
                    const aPos = next[aNode.id];
                    const bPos = next[bNode.id];
                    if (!aPos || !bPos) continue;

                    const dx = aPos.x - bPos.x;
                    const dy = aPos.y - bPos.y;

                    const aSize = getHalfSize(aNode, padding);
                    const bSize = getHalfSize(bNode, padding);
                    const halfX = aSize.w + bSize.w;
                    const halfY = aSize.h + bSize.h;
                    const overlapX = halfX - Math.abs(dx);
                    const overlapY = halfY - Math.abs(dy);

                    if (overlapX > 0 && overlapY > 0) {
                        adjusted = true;
                        changed = true;
                        if (overlapX < overlapY) {
                            const push = overlapX / 2;
                            const dir = dx >= 0 ? 1 : -1;
                            next[aNode.id] = { x: aPos.x + dir * push, y: aPos.y };
                            next[bNode.id] = { x: bPos.x - dir * push, y: bPos.y };
                        } else {
                            const push = overlapY / 2;
                            const dir = dy >= 0 ? 1 : -1;
                            next[aNode.id] = { x: aPos.x, y: aPos.y + dir * push };
                            next[bNode.id] = { x: bPos.x, y: bPos.y - dir * push };
                        }
                    }
                }
            }
            if (!adjusted) break;
        }

        return changed ? next : posMap;
    };

    const zoomAtPoint = (deltaY: number, clientX?: number, clientY?: number) => {
        const point = resolveAnchorPoint(clientX, clientY);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const direction = deltaY < 0 ? 1 : -1; // negative deltaY means zoom in on most trackpads
        const magnitude = Math.min(Math.abs(deltaY) / 1600 + 0.01, 0.045); // soften sensitivity further
        const factor = direction * magnitude;
        const screenX = point.x - rect.left;
        const screenY = point.y - rect.top;

        setZoom((prevZoom) => {
            const nextZoom = Math.min(1.6, Math.max(0.6, prevZoom + factor));
            setPan((prevPan) => {
                const worldX = screenX / prevZoom - prevPan.x;
                const worldY = screenY / prevZoom - prevPan.y;
                return {
                    x: screenX / nextZoom - worldX,
                    y: screenY / nextZoom - worldY,
                };
            });
            return nextZoom;
        });
    };

    const handleWheelPan = (e: React.WheelEvent | WheelEvent) => {
        // Trackpad two-finger scroll pans the canvas; pinch/ctrl+scroll zooms.
        if (isWheelOnPanel(e)) return;
        e.preventDefault();
        const anchor = anchorFromWheel(e as React.WheelEvent);
        lastPointer.current = anchor;
        const deltaZ = (e as any).deltaZ || 0;
        const isPinchGesture = e.ctrlKey || (e as any).metaKey || Math.abs(deltaZ) > 0;
        if (isPinchGesture) {
            zoomAtPoint((e as any).deltaY ?? 0, anchor.x, anchor.y);
            return;
        }
        panByDelta((e as any).deltaX ?? 0, (e as any).deltaY ?? 0);
    };

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const listener = (event: WheelEvent) => handleWheelPan(event);
        // passive: false is required so preventDefault stops page scroll
        el.addEventListener('wheel', listener, { passive: false });
        return () => el.removeEventListener('wheel', listener);
    }, [zoom]);

    const handlePanStart = (e: React.PointerEvent) => {
        const targetNode = (e.target as HTMLElement).closest('[data-node-id]');
        if (targetNode) return;
        setSelectedIdeaId(null);
        setSelectedGroup(null);
        setConfirmDeleteId(null);
        setLinkMode({ type: null });
        setIsPanning(true);
        setPanOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        lastPointer.current = { x: e.clientX, y: e.clientY };
    };

    const updateDragPosition = (clientX: number, clientY: number) => {
        if (!draggingId) return;
        setPositions((prev) => {
            const current = prev[draggingId] || { x: 0, y: 0 };
            const dx = (clientX - dragOrigin.x) / zoom;
            const dy = (clientY - dragOrigin.y) / zoom;
            const nextMap = { ...prev, [draggingId]: { x: current.x + dx, y: current.y + dy } };
            const collided = applyCollision(nextMap, draggingId);
            positionsRef.current = collided;
            return collided;
        });
        setDragOrigin({ x: clientX, y: clientY });
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        lastPointer.current = { x: e.clientX, y: e.clientY };
        if (draggingId) {
            updateDragPosition(e.clientX, e.clientY);
            return;
        }
        if (isPanning) {
            setPan({ x: e.clientX - panOrigin.x, y: e.clientY - panOrigin.y });
        }
    };

    const reassignOnDrop = (ideaId: string) => {
        const idea = ideas.find((i) => i.id === ideaId);
        if (!idea) return;
        const ideaPos = positionsRef.current[ideaId];
        if (!ideaPos) return;
        let closest: { group: string; distance: number } | null = null;
        groups.forEach((group) => {
            const gid = groupNodeId(group);
            const gPos = positionsRef.current[gid];
            if (!gPos) return;
            const dx = gPos.x - ideaPos.x;
            const dy = gPos.y - ideaPos.y;
            const dist = Math.hypot(dx, dy);
            if (!closest || dist < closest.distance) {
                closest = { group, distance: dist };
            }
        });
        if (closest && closest.distance < 160 && normalizeGroupName(idea.type) !== closest.group) {
            handleGroupChange(ideaId, closest.group);
        }
    };

    const applyLinkSelection = async (node: MapNode) => {
        if (!linkMode.type) return false;
        try {
            if (linkMode.type === 'branchParent' && selectedGroup) {
                const parentId = node.type === 'idea' ? node.id : node.type === 'group' ? node.id : 'project';
                setCustomBranches((prev) => prev.map((b) => b.name === selectedGroup ? { ...b, parentId } : b));
                setStatus(`Branch linked to ${node.label}.`);
            }
            if (linkMode.type === 'ideaLink' && selectedIdeaId) {
                if (node.id === selectedIdeaId) {
                    setError('Cannot link an item to itself.');
                    setLinkMode({ type: null });
                    return true;
                }
                if (node.type === 'group' && node.groupName) {
                    await updateIdea(selectedIdeaId, { type: node.groupName, parentIdeaId: null }, id);
                    setStatus(`Idea linked to branch "${node.groupName}".`);
                } else if (node.type === 'idea' && node.idea) {
                    // Use the target idea's branch if present, otherwise derive from its parent group.
                    let targetGroup = normalizeGroupName(node.idea.type);
                    if (!targetGroup && node.parentId?.startsWith('group-')) {
                        targetGroup = node.parentId.replace('group-', '');
                    }
                    await updateIdea(selectedIdeaId, { parentIdeaId: node.id, type: targetGroup }, id);
                    setStatus(`Idea linked under "${node.label}".`);
                } else {
                    await updateIdea(selectedIdeaId, { parentIdeaId: null }, id);
                    setStatus('Idea detached to root.');
                }
                await loadData();
            }
        } catch (e) {
            console.error(e);
            setError('Failed to link.');
        } finally {
            setLinkMode({ type: null });
        }
        return true;
    };

    const persistChangedIdeaPositions = async () => {
        if (!id) return;
        const updates: Promise<void>[] = [];
        mapIdeas.forEach((idea) => {
            // Skip transient/generated ideas that are not stored in Firestore.
            if (!idea.projectId || idea.id.startsWith('gen-')) return;
            const pos = positionsRef.current[idea.id];
            if (!pos) return;
            if (idea.posX === pos.x && idea.posY === pos.y) return;
            updates.push(updateIdea(idea.id, { posX: pos.x, posY: pos.y }, id));
        });
        if (!updates.length) return;
        try {
            await Promise.all(updates);
        } catch (e) {
            console.error('Failed to persist node positions', e);
        }
    };

    const handlePointerUp = () => {
        if (draggingId) {
            reassignOnDrop(draggingId);
            persistChangedIdeaPositions();
        }
        setDraggingId(null);
        setIsPanning(false);
        if (activePointerId.current !== null && captureTarget.current) {
            try {
                captureTarget.current.releasePointerCapture(activePointerId.current);
            } catch {
                // ignore if capture was not set
            }
        }
        activePointerId.current = null;
        captureTarget.current = null;
    };

    useEffect(() => {
        if (draggingId) return;
        setPositions((prev) => settleAllCollisions(prev));
    }, [visibleNodes.length, draggingId]);

    const getBranchDescendants = (group: string) => {
        const targetId = groupNodeId(group);
        const result = new Set<string>();
        const walk = (parentId: string) => {
            customBranches.forEach((b) => {
                if (b.parentId === parentId) {
                    result.add(b.name);
                    walk(groupNodeId(b.name));
                }
            });
        };
        walk(targetId);
        return Array.from(result);
    };

    const toggleGroup = (group: string) => {
        const descendants = getBranchDescendants(group);
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(group)) {
                next.delete(group);
                descendants.forEach((d) => next.delete(d));
            } else {
                next.add(group);
                descendants.forEach((d) => next.add(d));
            }
            return next;
        });
    };

    const handleAutoGroup = async () => {
        if (!project || !mapIdeas.length) return;
        setAiLoading(true);
        setError(null);
        setStatus('Grouping ideas with Gemini...');
        try {
            const suggestion = await suggestMindmapGrouping(project, mapIdeas);
            if (!suggestion.length) {
                setStatus('Gemini could not infer better groups. Showing current layout.');
                return;
            }
            const updates: Promise<void>[] = [];
            suggestion.forEach((group: MindmapGrouping) => {
                group.ideaIds.forEach((ideaId) => {
                    const idea = mapIdeas.find((i) => i.id === ideaId);
                    if (idea && normalizeGroupName(idea.type) !== group.group) {
                        updates.push(updateIdea(idea.id, { type: group.group }, id));
                    }
                });
            });
            if (updates.length) {
                await Promise.all(updates);
            }
            const reasonMap: Record<string, string> = {};
            suggestion.forEach((g) => {
                reasonMap[g.group] = g.reason || '';
            });
            setGroupReasons(reasonMap);
            setStatus('Gemini proposed a new grouping. Drag to adjust or rename manually.');
            await loadData();
        } catch (e) {
            console.error(e);
            setError('Failed to auto-group ideas.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleGroupChange = async (ideaId: string, groupName: string) => {
        setActionLoading(true);
        setError(null);
        try {
            const idea = ideas.find((i) => i.id === ideaId);
            const parentIdeaId = idea?.parentIdeaId && idea?.parentIdeaId !== 'project' ? idea.parentIdeaId : null;
            await updateIdea(ideaId, { type: groupName, mindmapId: activeMindmap?.id, parentIdeaId }, id);
            setStatus(`Moved idea to "${groupName}".`);
            await loadData();
        } catch (e) {
            console.error(e);
            setError('Failed to move idea.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveIdea = async () => {
        if (!selectedIdeaId) return;
        const targetGroup = customGroup.trim() || editGroup || 'Ideas';
        setActionLoading(true);
        setError(null);
        try {
            const idea = ideas.find((i) => i.id === selectedIdeaId);
            const isTransient = !idea?.projectId || idea.id.startsWith('gen-');
            if (isTransient) {
                await saveIdea({
                    title: editTitle,
                    description: editDesc,
                    type: targetGroup,
                    projectId: id!,
                    mindmapId: activeMindmap?.id,
                    parentIdeaId: idea?.parentIdeaId ?? null,
                    votes: idea?.votes ?? 0,
                    comments: idea?.comments ?? 0,
                    generated: idea?.generated,
                });
                setIdeas((prev) => prev.filter((i) => i.id !== selectedIdeaId));
                setStatus('Idea saved to project.');
            } else {
                await updateIdea(selectedIdeaId, { title: editTitle, description: editDesc, type: targetGroup, mindmapId: activeMindmap?.id }, id);
                setStatus('Idea updated.');
            }
            setCustomGroup('');
            await loadData({ silent: true });
        } catch (e) {
            console.error(e);
            setError('Failed to update idea.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleImportIdeaToActive = async (idea: Idea) => {
        if (!id || !activeMindmap) return;
        setActionLoading(true);
        setError(null);
        try {
            const parentIdeaId = selectedIdeaId || null;
            const parentIdea = parentIdeaId ? mapIdeas.find((i) => i.id === parentIdeaId) : null;
            // When importing, avoid dragging over the original branch; keep branch only if attaching under a selected idea with a branch.
            const type = parentIdea ? normalizeGroupName(parentIdea.type) || '' : '';

            const isTransient = !idea.projectId || idea.id.startsWith('gen-');
            if (isTransient) {
                await saveIdea({
                    title: idea.title,
                    description: idea.description,
                    type,
                    projectId: id,
                    mindmapId: activeMindmap.id,
                    parentIdeaId,
                    votes: idea.votes ?? 0,
                    comments: idea.comments ?? 0,
                    generated: idea.generated,
                });
                // Drop the transient local idea so reload pulls the saved version
                setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
            } else {
                await updateIdea(idea.id, { mindmapId: activeMindmap.id, parentIdeaId, type }, id);
            }
            setStatus(`Added to ${activeMindmap.name}${parentIdea ? ` under ${parentIdea.title}` : ''}.`);
            await loadData({ silent: true });
        } catch (e) {
            console.error(e);
            setError('Failed to add idea to this mindmap.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteIdea = async (ideaId: string) => {
        setActionLoading(true);
        setError(null);
        try {
            await deleteIdea(ideaId, id || undefined);
            if (selectedIdeaId === ideaId) setSelectedIdeaId(null);
            setStatus('Idea deleted.');
            await loadData();
        } catch (e) {
            console.error(e);
            setError('Failed to delete idea.');
        } finally {
            setActionLoading(false);
            setConfirmDeleteId(null);
        }
    };

    const handleConvertIdea = async (idea: Idea) => {
        if (!id) return;
        setActionLoading(true);
        setError(null);
        try {
            await addTask(id, idea.title);
            const isTransient = !idea.projectId || idea.id.startsWith('gen-');
            if (!isTransient) {
                await deleteIdea(idea.id, id);
            } else {
                setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
            }
            if (selectedIdeaId === idea.id) setSelectedIdeaId(null);
            setStatus('Idea converted to a task.');
            await loadData();
        } catch (e) {
            console.error(e);
            setError('Failed to convert idea.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddIdea = async () => {
        if (!id || !newIdeaTitle.trim() || !activeMindmap) return;
        setActionLoading(true);
        setError(null);
        const restoreSelection = selectedGroup
            ? { type: 'group' as const, value: selectedGroup }
            : selectedIdeaId
                ? { type: 'idea' as const, value: selectedIdeaId }
                : null;
        const attachIdea = selectedIdeaId ? attachToSelectedIdea || true : false;
        const attachBranch = selectedGroup ? attachToSelectedGroup || true : false;
        const resolvedGroup = attachBranch && selectedGroup
            ? selectedGroup
            : attachIdea && activeIdea
                ? normalizeGroupName(activeIdea.type)
                : '';
        const parentId = attachIdea && selectedIdeaId ? selectedIdeaId : 'project';
        try {
            await saveIdea({
                title: newIdeaTitle,
                description: newIdeaDesc,
                type: resolvedGroup,
                projectId: id,
                mindmapId: activeMindmap.id,
                parentIdeaId: parentId,
                votes: 0,
                comments: 0,
            });
            setNewIdeaTitle('');
            setNewIdeaDesc('');
            setStatus('Idea added to the map.');
            await loadData({ silent: true });
            if (restoreSelection) {
                if (restoreSelection.type === 'idea') setSelectedIdeaId(restoreSelection.value);
                if (restoreSelection.type === 'group') setSelectedGroup(restoreSelection.value);
            }
            requestAnimationFrame(() => {
                newIdeaInputRef.current?.focus();
            });
        } catch (e) {
            console.error(e);
            setError('Failed to add idea.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddBranch = () => {
        if (!newBranchName.trim()) return;
        const name = newBranchName.trim();
        const parentId = attachBranchToSelected
            ? (selectedIdeaId ? selectedIdeaId : selectedGroup ? groupNodeId(selectedGroup) : 'project')
            : 'project';
        setCustomBranches((prev) => {
            const existing = prev.find((b) => b.name === name);
            if (existing) {
                return prev.map((b) => b.name === name ? { ...b, parentId } : b);
            }
            const colorIndex = getNextBranchColorIndex(prev);
            return [...prev, { name, parentId, colorIndex }];
        });
        setPositions((prev) => {
            const next = { ...prev };
            const nodeId = groupNodeId(name);
            if (!next[nodeId]) {
                const anchor = next[parentId] || { x: 0, y: 0 };
                next[nodeId] = parentId === 'project'
                    ? { x: anchor.x + 240, y: anchor.y }
                    : calcChildPosition(anchor, 0, 1);
            }
            return settleAllCollisions(next);
        });
        setNewBranchName('');
        setAttachBranchToSelected(false);
        setStatus('Branch added.');
    };

    const handleDeleteBranch = async (branchName?: string) => {
        const target = branchName || selectedGroup;
        if (!target) return;
        setActionLoading(true);
        setError(null);
        try {
            const updates = mapIdeas
                .filter((i) => normalizeGroupName(i.type) === target)
                .map((i) => updateIdea(i.id, { type: '' }, id));
            if (updates.length) await Promise.all(updates);
            setCustomBranches((prev) => prev.filter((b) => b.name !== target));
            setPositions((prev) => {
                const next = { ...prev };
                delete next[groupNodeId(target)];
                positionsRef.current = next;
                return settleAllCollisions(next);
            });
            setSelectedGroup(null);
            setRenameGroupName('');
            setConfirmDeleteBranch(null);
            setStatus('Branch deleted.');
            await loadData({ silent: true });
        } catch (e) {
            console.error(e);
            setError('Failed to delete branch.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRenameGroup = async () => {
        if (!selectedGroup) return;
        const nextName = renameGroupName.trim();
        if (!nextName || nextName === selectedGroup) return;
        setActionLoading(true);
        setError(null);
        try {
            const updates = mapIdeas
                .filter((i) => normalizeGroupName(i.type) === selectedGroup)
                .map((i) => updateIdea(i.id, { type: nextName }, id));
            if (updates.length) await Promise.all(updates);

            setCustomBranches((prev) =>
                prev.map((b) => b.name === selectedGroup ? { ...b, name: nextName } : b)
            );

            setPositions((prev) => {
                const next = { ...prev };
                const oldId = groupNodeId(selectedGroup);
                const newId = groupNodeId(nextName);
                if (next[oldId]) {
                    next[newId] = next[oldId];
                    delete next[oldId];
                }
                positionsRef.current = next;
                return next;
            });
            setSelectedGroup(nextName);
            setRenameGroupName(nextName);
            setStatus('Branch renamed.');
            await loadData({ silent: true });
        } catch (e) {
            console.error(e);
            setError('Failed to rename branch.');
        } finally {
            setActionLoading(false);
        }
    };

    const renderNode = (node: MapNode) => {
        const pos = positions[node.id];
        if (!pos) return null;
        const x = ORIGIN + pos.x;
        const y = ORIGIN + pos.y;
        const isSelected = selectedIdeaId === node.idea?.id;
        const isCollapsed = node.type === 'group' && node.groupName ? collapsedGroups.has(node.groupName) : false;
        const visual = getGroupVisual(node.groupName);
        const baseStyle: React.CSSProperties = {
            left: x,
            top: y,
            transform: 'translate(-50%, -50%)',
            cursor: 'grab',
        };
        if (node.type !== 'project') {
            baseStyle.backgroundColor = visual.bg;
            baseStyle.borderColor = visual.border;
            baseStyle.color = visual.text;
            baseStyle.boxShadow = '0 12px 32px rgba(0,0,0,0.08)';
        } else {
            baseStyle.borderColor = '#0f172a';
            baseStyle.boxShadow = '0 18px 42px rgba(0,0,0,0.18)';
        }

        const ideaSnippet = node.idea?.description || '';

        return (
            <div
                key={node.id}
                data-node-id={node.id}
                className={`absolute rounded-2xl border backdrop-blur select-none ${node.type === 'project' ? 'bg-gradient-to-r from-black to-slate-900 text-white px-5 py-4 shadow-2xl' : 'px-4 py-3 shadow-lg'} ${isSelected ? 'ring-2 ring-black ring-offset-2 ring-offset-white' : ''}`}
                style={baseStyle}
                ref={(el) => {
                    if (el && resizeObserver.current) {
                        resizeObserver.current.observe(el);
                    }
                }}
                onPointerDown={(e) => {
                    // If we're in link mode, just apply the link without starting a drag.
                    if (linkMode.type) {
                        applyLinkSelection(node);
                        return;
                    }
                    setDraggingId(node.id);
                    setDragOrigin({ x: e.clientX, y: e.clientY });
                    activePointerId.current = e.pointerId;
                    captureTarget.current = e.currentTarget as HTMLElement;
                    try {
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    } catch {
                        // ignore capture errors
                    }
                    if (node.idea) {
                        setSelectedIdeaId(node.idea.id);
                        setSelectedGroup(null);
                        setAttachToSelectedIdea(true);
                        setAttachToSelectedGroup(false);
                    }
                    if (node.type === 'group') {
                        setSelectedGroup(node.groupName || null);
                        setSelectedIdeaId(null);
                        setAttachToSelectedGroup(true);
                        setAttachToSelectedIdea(false);
                    }
                    if (node.type === 'project') {
                        setDrawerMode('map');
                        setEditTitle(activeMindmap?.name || '');
                        setSelectedGroup(null);
                    }
                }}
                onPointerMove={(e) => {
                    if (draggingId === node.id) {
                        e.stopPropagation();
                        e.preventDefault();
                        updateDragPosition(e.clientX, e.clientY);
                    }
                }}
                onPointerUp={(e) => {
                    if (draggingId === node.id) {
                        e.preventDefault();
                        handlePointerUp();
                    }
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    if (linkMode.type) {
                        applyLinkSelection(node);
                        return;
                    }
                    if (node.idea) {
                        setSelectedIdeaId(node.idea.id);
                        setSelectedGroup(null);
                        setAttachToSelectedIdea(true);
                        setAttachToSelectedGroup(false);
                    }
                    if (node.type === 'group') {
                        setSelectedGroup(node.groupName || null);
                        setSelectedIdeaId(null);
                        setAttachToSelectedGroup(true);
                        setAttachToSelectedIdea(false);
                    }
                }}
                onDoubleClick={() => {
                    if (node.type === 'group' && node.groupName) toggleGroup(node.groupName);
                    if (node.type === 'project') {
                        setDrawerMode('map');
                    }
                }}
            >
                {node.type === 'project' && (
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">hub</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-white/70 font-bold">Root mindmap</span>
                            <span className="text-lg font-black leading-tight">{node.label}</span>
                            <span className="text-xs text-white/70">Double-click to rename this map</span>
                        </div>
                    </div>
                )}
                {node.type === 'group' && (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <button
                                    className="size-7 rounded-full border border-black/10 bg-white/50 flex items-center justify-center text-[11px] font-bold text-slate-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (node.groupName) toggleGroup(node.groupName);
                                    }}
                                    title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
                                >
                                    {isCollapsed ? '+' : '–'}
                                </button>
                                <div className="flex flex-col">
                                    <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Branch</span>
                                    <span className="font-bold text-base leading-tight">{node.label}</span>
                                </div>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-1 rounded-full border border-black/10 bg-white/60 text-slate-700">
                                {groupIdeaCounts[node.groupName || 'Ideas'] || 0} nodes
                            </span>
                        </div>
                        {node.groupName && groupReasons[node.groupName] && (
                            <p className="text-[11px] text-slate-600 leading-snug max-w-[240px]">
                                {groupReasons[node.groupName]}
                            </p>
                        )}
                    </div>
                )}
                {node.type === 'idea' && (
                    <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-3">
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-bold leading-tight">{node.label}</span>
                                {ideaSnippet && (
                                    <p
                                        className="text-xs text-slate-700 leading-snug max-w-[220px]"
                                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                                    >
                                        {ideaSnippet}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const edges = visibleNodes
        .filter((node) => node.parentId)
        .map((node) => {
            const from = positions[node.parentId!];
            const to = positions[node.id];
            if (!from || !to) return null;
            const x1 = ORIGIN + from.x;
            const y1 = ORIGIN + from.y;
            const x2 = ORIGIN + to.x;
            const y2 = ORIGIN + to.y;
            const thickness = node.type === 'group' ? 3.2 : 2.4;
            const color = node.type === 'group' ? '#0b132b' : getGroupVisual(node.groupName).border;
            const opacity = node.type === 'group' ? 0.8 : 0.72;
            return (
                <line
                    key={`${node.parentId}-${node.id}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={thickness}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                />
            );
        });

    return (
        <div className="w-full flex flex-col gap-3 pb-4">
            <div
                ref={containerRef}
                className={`${isFullscreen ? 'fixed inset-0 z-50 rounded-none border-0' : 'relative rounded-2xl border border-slate-200'} w-full bg-[#f9fafb] overflow-hidden`}
                style={{ touchAction: 'none', height: canvasHeight }}
                onPointerDown={handlePanStart}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#0000000d_1px,_transparent_0)] bg-[size:28px_28px] pointer-events-none" />

                <div
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-xl flex items-center gap-2 px-3 py-2">
                        <button
                            onClick={() => { setSelectedIdeaId(null); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border border-slate-200 hover:border-black bg-white"
                        >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            Add idea
                        </button>
                        <button
                            onClick={handleAutoGroup}
                            disabled={aiLoading || loading || !ideas.length}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border border-slate-200 hover:border-black disabled:opacity-50 bg-white"
                        >
                            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                            {aiLoading ? 'Grouping…' : 'Auto-group'}
                        </button>
                        <button
                            onClick={() => centerView()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border border-slate-200 hover:border-black bg-white"
                        >
                            <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
                            Center
                        </button>
                        <button
                            onClick={() => { setDrawerMode('map'); setEditTitle(activeMindmap?.name || ''); }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border border-slate-200 hover:border-black bg-white"
                        >
                            <span className="material-symbols-outlined text-[16px]">edit_note</span>
                            Map settings
                        </button>
                        <button
                            onClick={() => setIsFullscreen((prev) => !prev)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold border border-slate-200 hover:border-black bg-white"
                        >
                            <span className="material-symbols-outlined text-[16px]">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                            {isFullscreen ? 'Exit' : 'Fullscreen'}
                        </button>
                    </div>
                </div>

                <button
                    className="absolute top-5 z-40 size-9 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center gap-0"
                    style={{ left: leftCollapsed ? '10px' : '344px' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setLeftCollapsed((v) => !v)}
                    title={leftCollapsed ? 'Show left panel' : 'Hide left panel'}
                >
                    <span className="material-symbols-outlined text-[18px] leading-none">{leftCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                    <span className="material-symbols-outlined text-[18px] leading-none -ml-[6px]">{leftCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                </button>

                {!leftCollapsed && (
                    <div
                        className="absolute top-4 left-4 z-30 w-[320px] overflow-y-auto pr-1"
                        data-panel-scroll="true"
                        style={{ maxHeight: 'calc(100% - 32px)', touchAction: 'auto', overscrollBehavior: 'contain' }}
                        onWheelCapture={(e) => {
                            e.stopPropagation();
                            if (e.nativeEvent.stopImmediatePropagation) {
                                e.nativeEvent.stopImmediatePropagation();
                            }
                        }}
                        onWheel={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col gap-3 pb-2">
                        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Map navigator</p>
                                    <p className="text-base font-extrabold text-slate-900">{activeMindmap?.name || 'Mindmap'}</p>
                                    <p className="text-xs text-slate-500">Switch layouts or create new ones.</p>
                                </div>
                                <button
                                    onClick={() => setShowMapMenu((prev) => !prev)}
                                    className="size-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:border-black"
                                >
                                    <span className="material-symbols-outlined text-[18px]">unfold_more</span>
                                </button>
                            </div>
                            {showMapMenu && (
                                <div className="px-3 py-3 space-y-2 max-h-52 overflow-y-auto">
                                    {mindmaps.map((map) => (
                                        <button
                                            key={map.id}
                                            onClick={() => { setActiveMindmapId(map.id); setShowMapMenu(false); }}
                                            className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-semibold flex items-center justify-between ${map.id === activeMindmap?.id ? 'border-black/60 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}
                                        >
                                            <span>{map.name}</span>
                                            {map.id === activeMindmap?.id && <span className="text-[11px] uppercase text-slate-500 font-bold">Active</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="px-3 py-3 border-t border-slate-200 flex gap-2">
                                <button
                                    onClick={async () => {
                                        if (!id) return;
                                        const newId = await createMindmap(id, 'New Mindmap');
                                        const refreshed = await getProjectMindmaps(id);
                                        setMindmaps(refreshed);
                                        setActiveMindmapId(newId);
                                        setShowMapMenu(false);
                                    }}
                                    className="flex-1 px-3 py-2 rounded-xl text-sm font-bold bg-black text-white hover:bg-slate-900"
                                >
                                    + New mindmap
                                </button>
                                <button
                                    onClick={() => { setDrawerMode('map'); setEditTitle(activeMindmap?.name || ''); }}
                                    className="px-3 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:border-black bg-white"
                                >
                                    Rename
                                </button>
                            </div>
                            <div className="px-3 py-3 border-t border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Branches</span>
                                    <span className="text-xs text-slate-500">{mapSummary.collapsedCount} collapsed</span>
                                </div>
                                <div className="grid gap-2 max-h-60 overflow-y-auto">
                                    {groups.map((group) => {
                                        const collapsed = collapsedGroups.has(group);
                                        const visuals = getGroupVisual(group);
                                        return (
                                            <button
                                                key={group}
                                                onClick={() => toggleGroup(group)}
                                                className="w-full text-left px-3 py-2 rounded-xl border text-sm font-semibold flex items-center justify-between gap-2 transition-transform hover:translate-x-[2px]"
                                                style={{ backgroundColor: visuals.bg, borderColor: visuals.border, color: visuals.text }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px]">account_tree</span>
                                                    <span>{group}</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-bold">
                                                    <span>{groupIdeaCounts[group] || 0}</span>
                                                    <span className="material-symbols-outlined text-[16px]">{collapsed ? 'chevron_right' : 'expand_more'}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Quick add idea</p>
                                    <p className="text-xs text-slate-500">Drop ideas straight onto this map.</p>
                                </div>
                                <button
                                        onClick={() => { setSelectedIdeaId(null); newIdeaInputRef.current?.focus(); }}
                                        className="size-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:border-black"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                    </button>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                                <input
                                    value={newIdeaTitle}
                                    onChange={(e) => setNewIdeaTitle(e.target.value)}
                                    placeholder="Idea title"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                    ref={newIdeaInputRef}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddIdea();
                                        }
                                    }}
                                />
                                <textarea
                                    value={newIdeaDesc}
                                    onChange={(e) => setNewIdeaDesc(e.target.value)}
                                    placeholder="Optional context, links, or acceptance criteria"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-black/10"
                                />
                                {selectedIdeaId && activeIdea && (
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={attachToSelectedIdea}
                                            onChange={(e) => {
                                                setAttachToSelectedIdea(e.target.checked);
                                            }}
                                            className="rounded border-slate-300"
                                        />
                                        Attach as child of “{activeIdea.title}”
                                    </label>
                                )}
                                {selectedGroup && (
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={attachToSelectedGroup}
                                            onChange={(e) => setAttachToSelectedGroup(e.target.checked)}
                                            className="rounded border-slate-300"
                                        />
                                        Link to branch “{selectedGroup}”
                                    </label>
                                )}
                                <button
                                    onClick={handleAddIdea}
                                    disabled={actionLoading || !newIdeaTitle.trim()}
                                    className="w-full px-4 py-2 rounded-xl bg-black text-white text-sm font-bold hover:bg-slate-900 disabled:opacity-50"
                                >
                                    Drop on map
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-200">
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Add branch</p>
                                    <p className="text-xs text-slate-500">Create a new branch node, optionally attached to a selected node.</p>
                                </div>
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                                <input
                                    value={newBranchName}
                                    onChange={(e) => setNewBranchName(e.target.value)}
                                    placeholder="Branch name"
                                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                />
                                {selectedIdeaId && activeIdea && (
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={attachBranchToSelected}
                                            onChange={(e) => setAttachBranchToSelected(e.target.checked)}
                                            className="rounded border-slate-300"
                                        />
                                        Attach to “{activeIdea.title}”
                                    </label>
                                )}
                                {selectedGroup && (
                                    <label className="flex items-center gap-2 text-xs text-slate-600">
                                        <input
                                            type="checkbox"
                                            checked={attachBranchToSelected}
                                            onChange={(e) => setAttachBranchToSelected(e.target.checked)}
                                            className="rounded border-slate-300"
                                        />
                                        Attach to branch “{selectedGroup}”
                                    </label>
                                )}
                                <button
                                    onClick={handleAddBranch}
                                    disabled={actionLoading || !newBranchName.trim()}
                                    className="w-full px-4 py-2 rounded-xl bg-white text-sm font-bold border border-slate-200 hover:border-black disabled:opacity-50"
                                >
                                    Add branch
                                </button>
                            </div>
                        </div>
                    </div>
                    </div>
                )}

                <button
                    className="absolute top-5 z-40 size-9 rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center gap-0"
                    style={{ right: rightCollapsed ? '10px' : '344px' }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setRightCollapsed((v) => !v)}
                    title={rightCollapsed ? 'Show inspector' : 'Hide inspector'}
                >
                    <span className="material-symbols-outlined text-[18px] leading-none">{rightCollapsed ? 'chevron_left' : 'chevron_right'}</span>
                    <span className="material-symbols-outlined text-[18px] leading-none -ml-[6px]">{rightCollapsed ? 'chevron_left' : 'chevron_right'}</span>
                </button>

                {!rightCollapsed && (
                    <div
                        className="absolute top-4 right-4 z-30 w-[320px] overflow-y-auto"
                        data-panel-scroll="true"
                        style={{ maxHeight: 'calc(100% - 32px)', touchAction: 'auto', overscrollBehavior: 'contain' }}
                        onWheelCapture={(e) => {
                            e.stopPropagation();
                            if (e.nativeEvent.stopImmediatePropagation) {
                                e.nativeEvent.stopImmediatePropagation();
                            }
                        }}
                        onWheel={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Idea inspector</p>
                                <p className="font-bold text-slate-900">
                                    {drawerMode === 'map'
                                        ? 'Mindmap settings'
                                        : selectedGroup || activeIdea?.title || 'Select a node'}
                                </p>
                            </div>
                            <button
                                onClick={() => (activeIdea ? focusNode(activeIdea.id) : centerView())}
                                className="px-3 py-1.5 rounded-full border border-slate-200 text-sm font-bold hover:border-black bg-white"
                            >
                                Focus
                            </button>
                        </div>
                        <div className="px-4 pt-3 flex flex-wrap gap-2">
                            <button
                                onClick={() => {
                                    setDrawerMode('edit');
                                    if (activeIdea) {
                                        setEditTitle(activeIdea.title);
                                        setEditDesc(activeIdea.description);
                                        setEditGroup(normalizeGroupName(activeIdea.type));
                                        setCustomGroup('');
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${drawerMode === 'edit' ? 'border-black bg-black text-white' : 'border-slate-200 bg-white hover:border-black'}`}
                            >
                                Edit / branches
                            </button>
                            <button
                                onClick={() => { setDrawerMode('map'); setEditTitle(activeMindmap?.name || ''); }}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${drawerMode === 'map' ? 'border-black bg-black text-white' : 'border-slate-200 bg-white hover:border-black'}`}
                            >
                                Map settings
                            </button>
                        </div>
                        <div className="p-4 space-y-3 border-t border-slate-100">
                            {drawerMode === 'map' && (
                                <>
                                    <input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                        placeholder="Mindmap name"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!activeMindmapId) return;
                                            setActionLoading(true);
                                        try {
                                            await updateMindmapName(activeMindmapId, editTitle || activeMindmap?.name || 'Mindmap', id);
                                        const refreshed = await getProjectMindmaps(id!);
                                        setMindmaps(refreshed);
                                        setStatus('Mindmap renamed.');
                                        } catch (e) {
                                            console.error(e);
                                            setError('Failed to rename mindmap.');
                                        } finally {
                                            setActionLoading(false);
                                        }
                                        }}
                                        disabled={actionLoading || !editTitle.trim()}
                                        className="w-full px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50"
                                    >
                                        Save name
                                    </button>
                                </>
                            )}

                            {drawerMode === 'edit' && (
                                selectedGroup ? (
                                    <>
                                        <input
                                            value={renameGroupName}
                                            onChange={(e) => setRenameGroupName(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                            placeholder="Branch name"
                                        />
                                        <button
                                            onClick={() => {
                                                setLinkMode({ type: 'branchParent' });
                                                setStatus('Select a node or branch to link this branch to.');
                                            }}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:border-black bg-white"
                                        >
                                            Change parent link
                                        </button>
                                        <button
                                            onClick={handleRenameGroup}
                                            disabled={actionLoading || !renameGroupName.trim()}
                                            className="w-full px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50"
                                        >
                                            Rename branch
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteBranch(selectedGroup)}
                                            disabled={actionLoading}
                                            className="w-full px-4 py-2 rounded-lg border border-rose-200 text-sm font-bold text-rose-600"
                                        >
                                            Delete branch
                                        </button>
                                    </>
                                ) : activeIdea ? (
                                    <>
                                        <input
                                            value={editTitle}
                                            onChange={(e) => setEditTitle(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                                            placeholder="Title"
                                        />
                                        <textarea
                                            value={editDesc}
                                            onChange={(e) => setEditDesc(e.target.value)}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-black/10"
                                            placeholder="Description"
                                        />
                                        <button
                                            onClick={() => {
                                                setLinkMode({ type: 'ideaLink' });
                                                setStatus('Select a branch or node to relink this idea.');
                                            }}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:border-black bg-white"
                                        >
                                            Relink (pick node/branch)
                                        </button>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={handleSaveIdea}
                                                disabled={actionLoading}
                                                className="px-4 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => activeIdea && handleConvertIdea(activeIdea)}
                                                disabled={actionLoading}
                                                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold col-span-2"
                                            >
                                                Convert to task
                                            </button>
                                            <button
                                                onClick={() => selectedIdeaId && setConfirmDeleteId(selectedIdeaId)}
                                                disabled={actionLoading}
                                                className="px-4 py-2 rounded-lg border border-rose-200 text-sm font-bold text-rose-600 col-span-2"
                                            >
                                                Delete idea
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-sm text-slate-600">
                                        Select a node or branch to edit.
                                    </div>
                                )
                            )}
                        </div>
                        {ideasOutsideActive.length > 0 && (
                            <div className="p-4 border-t border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-bold">Ideas outside this map</p>
                                        <p className="text-xs text-slate-500">Attach ideas from other mindmaps.</p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">{ideasOutsideActive.length}</span>
                                </div>
                                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                    {ideasOutsideActive.map((idea) => (
                                        <div key={idea.id} className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 flex items-center justify-between gap-3">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-900">{idea.title}</p>
                                                <p className="text-xs text-slate-500">From {mindmaps.find((m) => m.id === idea.mindmapId)?.name || 'Default mindmap'}</p>
                                            </div>
                                            <button
                                                onClick={() => handleImportIdeaToActive(idea)}
                                                disabled={actionLoading}
                                                className="px-3 py-2 rounded-lg bg-black text-white text-sm font-bold disabled:opacity-50 shrink-0"
                                                title={selectedIdeaId ? 'Add under the selected node' : 'Add to root'}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    </div>
                )}

                <div
                    className="absolute right-4 bottom-4 flex flex-col gap-2 z-30"
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <button
                        className="size-10 rounded-full border border-black bg-white shadow-sm flex items-center justify-center"
                        onClick={(e) => {
                            const anchor = anchorFromWheel(e as unknown as React.WheelEvent);
                            zoomAtPoint(-120, anchor.x, anchor.y);
                        }}
                    >
                        <span className="material-symbols-outlined text-base">add</span>
                    </button>
                    <button
                        className="size-10 rounded-full border border-black bg-white shadow-sm flex items-center justify-center"
                        onClick={(e) => {
                            const anchor = anchorFromWheel(e as unknown as React.WheelEvent);
                            zoomAtPoint(120, anchor.x, anchor.y);
                        }}
                    >
                        <span className="material-symbols-outlined text-base">remove</span>
                    </button>
                    <button
                        className="size-10 rounded-full border border-black bg-white shadow-sm flex items-center justify-center"
                        onClick={() => centerView()}
                        title="Center selection"
                    >
                        <span className="material-symbols-outlined text-base">center_focus_strong</span>
                    </button>
                </div>

                {(status || error || linkMode.type) && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none">
                        {linkMode.type && (
                            <div className="pointer-events-auto px-4 py-3 rounded-2xl bg-black text-white text-sm font-bold shadow-2xl flex items-center gap-2 animate-pulse">
                                <span className="material-symbols-outlined text-[18px] text-white">share</span>
                                {linkMode.type === 'branchParent' ? 'Link mode: pick a node/branch for this branch.' : 'Link mode: pick a branch or node for this idea.'}
                                <button
                                    className="text-xs font-bold ml-1 underline"
                                    onClick={() => setLinkMode({ type: null })}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                        {status && (
                            <div className="pointer-events-auto px-4 py-3 rounded-2xl border border-slate-300 bg-white text-sm font-bold text-slate-800 shadow-2xl flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-slate-700">info</span>
                                <span>{status}</span>
                                <button onClick={() => setStatus(null)} className="text-xs font-bold text-slate-500 ml-1">Dismiss</button>
                            </div>
                        )}
                        {error && (
                            <div className="pointer-events-auto px-4 py-3 rounded-2xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700 shadow-2xl flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px] text-rose-600">error</span>
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="text-xs font-bold text-rose-600 ml-1">Dismiss</button>
                            </div>
                        )}
                    </div>
                )}

                <svg
                    className="absolute top-0 left-0 pointer-events-none"
                    width={WORLD_SIZE}
                    height={WORLD_SIZE}
                    style={worldStyle}
                >
                    {edges}
                </svg>

                <div className="absolute top-0 left-0" style={worldStyle}>
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
                        </div>
                    ) : (
                        visibleNodes.map(renderNode)
                    )}
                </div>

                
                {confirmDeleteId && (
                    <div
                        className="absolute inset-0 z-40 bg-black/20 flex items-center justify-center"
                        onPointerDown={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    >
                        <div
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 flex flex-col gap-3"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-2">
                                <div className="size-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-slate-900">Delete this idea?</p>
                                    <p className="text-sm text-slate-600">This cannot be undone. The node will be removed from the map.</p>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:border-black bg-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => confirmDeleteId && handleDeleteIdea(confirmDeleteId)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {confirmDeleteBranch && (
                    <div
                        className="absolute inset-0 z-40 bg-black/20 flex items-center justify-center"
                        onPointerDown={(e) => { e.stopPropagation(); setConfirmDeleteBranch(null); }}
                    >
                        <div
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 flex flex-col gap-3"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-2">
                                <div className="size-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                                    <span className="material-symbols-outlined">warning</span>
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-slate-900">Delete this branch?</p>
                                    <p className="text-sm text-slate-600">Ideas in this branch will be detached to root.</p>
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => setConfirmDeleteBranch(null)}
                                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:border-black bg-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => confirmDeleteBranch && handleDeleteBranch(confirmDeleteBranch)}
                                    disabled={actionLoading}
                                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-60"
                                >
                                    Delete branch
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
