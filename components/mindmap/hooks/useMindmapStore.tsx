import React, { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from 'react';
import { Idea, Task, Issue, Milestone, SocialCampaign } from '../../../types';

// ============================================================================
// Types
// ============================================================================

export type MindmapNodeType = 'project' | 'group' | 'idea' | 'task' | 'issue' | 'milestone' | 'campaign';

export interface MindmapNodeData {
    id: string;
    type: MindmapNodeType;
    label: string;
    parentId?: string;
    groupName?: string;
    position: { x: number; y: number };
    // Source data
    idea?: Idea;
    task?: Task;
    issue?: Issue;
    milestone?: Milestone;
    campaign?: SocialCampaign;
    // Visual state
    collapsed?: boolean;
    color?: string;
}

export type MindmapEdgeType =
    | 'hierarchy'    // Parent-child relationship
    | 'conversion'   // Idea → Task, Idea → Campaign
    | 'dependency'   // Task → Task dependencies
    | 'linked'       // Issue ↔ Task, Milestone → Tasks
    | 'link';        // Generic link

export interface MindmapEdgeData {
    id: string;
    sourceId: string;
    targetId: string;
    type: MindmapEdgeType;
    label?: string;
}

export type LayoutType = 'force' | 'radial' | 'tree-vertical' | 'tree-horizontal' | 'grid';

export interface HistoryEntry {
    nodes: MindmapNodeData[];
    timestamp: number;
}

export interface MindmapState {
    // Data
    nodes: MindmapNodeData[];
    edges: MindmapEdgeData[];

    // View state
    zoom: number;
    pan: { x: number; y: number };
    selectedNodeIds: Set<string>;
    hoveredNodeId: string | null;

    // UI state
    isMinimapVisible: boolean;
    isGridVisible: boolean;
    activeLayout: LayoutType;
    isSearchOpen: boolean;
    searchQuery: string;

    // History
    history: HistoryEntry[];
    historyIndex: number;

    // Loading
    isLoading: boolean;
    error: string | null;
}

// ============================================================================
// Actions
// ============================================================================

type MindmapAction =
    | { type: 'SET_NODES'; nodes: MindmapNodeData[] }
    | { type: 'SET_EDGES'; edges: MindmapEdgeData[] }
    | { type: 'SET_ZOOM'; zoom: number }
    | { type: 'SET_PAN'; pan: { x: number; y: number } }
    | { type: 'SELECT_NODE'; id: string; multi?: boolean }
    | { type: 'SELECT_NODES'; ids: string[] }
    | { type: 'DESELECT_ALL' }
    | { type: 'SET_HOVERED'; id: string | null }
    | { type: 'MOVE_NODE'; id: string; position: { x: number; y: number } }
    | { type: 'MOVE_NODES'; moves: { id: string; position: { x: number; y: number } }[] }
    | { type: 'TOGGLE_COLLAPSE'; id: string }
    | { type: 'TOGGLE_MINIMAP' }
    | { type: 'TOGGLE_GRID' }
    | { type: 'SET_LAYOUT'; layout: LayoutType }
    | { type: 'SET_SEARCH_OPEN'; open: boolean }
    | { type: 'SET_SEARCH_QUERY'; query: string }
    | { type: 'PUSH_HISTORY' }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'SET_LOADING'; loading: boolean }
    | { type: 'SET_ERROR'; error: string | null }
    | { type: 'DELETE_NODES'; ids: string[] }
    | { type: 'ADD_NODE'; node: MindmapNodeData };

// ============================================================================
// Initial State
// ============================================================================

const initialState: MindmapState = {
    nodes: [],
    edges: [],
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedNodeIds: new Set(),
    hoveredNodeId: null,
    isMinimapVisible: true,
    isGridVisible: true,
    activeLayout: 'radial',
    isSearchOpen: false,
    searchQuery: '',
    history: [],
    historyIndex: -1,
    isLoading: false,
    error: null,
};

// ============================================================================
// Reducer
// ============================================================================

function mindmapReducer(state: MindmapState, action: MindmapAction): MindmapState {
    switch (action.type) {
        case 'SET_NODES':
            return { ...state, nodes: action.nodes };

        case 'SET_EDGES':
            return { ...state, edges: action.edges };

        case 'SET_ZOOM':
            return { ...state, zoom: Math.min(3, Math.max(0.1, action.zoom)) };

        case 'SET_PAN':
            return { ...state, pan: action.pan };

        case 'SELECT_NODE': {
            const newSelected = new Set(action.multi ? state.selectedNodeIds : []);
            if (newSelected.has(action.id)) {
                newSelected.delete(action.id);
            } else {
                newSelected.add(action.id);
            }
            return { ...state, selectedNodeIds: newSelected };
        }

        case 'SELECT_NODES':
            return { ...state, selectedNodeIds: new Set(action.ids) };

        case 'DESELECT_ALL':
            return { ...state, selectedNodeIds: new Set() };

        case 'SET_HOVERED':
            return { ...state, hoveredNodeId: action.id };

        case 'MOVE_NODE':
            return {
                ...state,
                nodes: state.nodes.map(n =>
                    n.id === action.id ? { ...n, position: action.position } : n
                ),
            };

        case 'MOVE_NODES': {
            const moveMap = new Map(action.moves.map(m => [m.id, m.position]));
            return {
                ...state,
                nodes: state.nodes.map(n =>
                    moveMap.has(n.id) ? { ...n, position: moveMap.get(n.id)! } : n
                ),
            };
        }

        case 'TOGGLE_COLLAPSE':
            return {
                ...state,
                nodes: state.nodes.map(n =>
                    n.id === action.id ? { ...n, collapsed: !n.collapsed } : n
                ),
            };

        case 'TOGGLE_MINIMAP':
            return { ...state, isMinimapVisible: !state.isMinimapVisible };

        case 'TOGGLE_GRID':
            return { ...state, isGridVisible: !state.isGridVisible };

        case 'SET_LAYOUT':
            return { ...state, activeLayout: action.layout };

        case 'SET_SEARCH_OPEN':
            return { ...state, isSearchOpen: action.open, searchQuery: action.open ? state.searchQuery : '' };

        case 'SET_SEARCH_QUERY':
            return { ...state, searchQuery: action.query };

        case 'PUSH_HISTORY': {
            const entry: HistoryEntry = { nodes: [...state.nodes], timestamp: Date.now() };
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), entry];
            // Keep only last 50 entries
            if (newHistory.length > 50) newHistory.shift();
            return { ...state, history: newHistory, historyIndex: newHistory.length - 1 };
        }

        case 'UNDO': {
            if (state.historyIndex <= 0) return state;
            const prevEntry = state.history[state.historyIndex - 1];
            return { ...state, nodes: prevEntry.nodes, historyIndex: state.historyIndex - 1 };
        }

        case 'REDO': {
            if (state.historyIndex >= state.history.length - 1) return state;
            const nextEntry = state.history[state.historyIndex + 1];
            return { ...state, nodes: nextEntry.nodes, historyIndex: state.historyIndex + 1 };
        }

        case 'SET_LOADING':
            return { ...state, isLoading: action.loading };

        case 'SET_ERROR':
            return { ...state, error: action.error };

        case 'DELETE_NODES': {
            const idsToDelete = new Set(action.ids);
            return {
                ...state,
                nodes: state.nodes.filter(n => !idsToDelete.has(n.id)),
                edges: state.edges.filter(e => !idsToDelete.has(e.sourceId) && !idsToDelete.has(e.targetId)),
                selectedNodeIds: new Set([...state.selectedNodeIds].filter(id => !idsToDelete.has(id))),
            };
        }

        case 'ADD_NODE':
            return { ...state, nodes: [...state.nodes, action.node] };

        default:
            return state;
    }
}

// ============================================================================
// Context
// ============================================================================

interface MindmapContextValue {
    state: MindmapState;
    dispatch: React.Dispatch<MindmapAction>;
    // Convenience actions
    setNodes: (nodes: MindmapNodeData[]) => void;
    setEdges: (edges: MindmapEdgeData[]) => void;
    selectNode: (id: string, multi?: boolean) => void;
    deselectAll: () => void;
    moveNode: (id: string, position: { x: number; y: number }) => void;
    moveNodes: (moves: { id: string; position: { x: number; y: number } }[]) => void;
    setZoom: (zoom: number) => void;
    setPan: (pan: { x: number; y: number }) => void;
    toggleMinimap: () => void;
    toggleGrid: () => void;
    setLayout: (layout: LayoutType) => void;
    undo: () => void;
    redo: () => void;
    pushHistory: () => void;
    deleteSelectedNodes: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const MindmapContext = createContext<MindmapContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function MindmapProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(mindmapReducer, initialState);

    // Convenience actions
    const setNodes = useCallback((nodes: MindmapNodeData[]) => {
        dispatch({ type: 'SET_NODES', nodes });
    }, []);

    const setEdges = useCallback((edges: MindmapEdgeData[]) => {
        dispatch({ type: 'SET_EDGES', edges });
    }, []);

    const selectNode = useCallback((id: string, multi?: boolean) => {
        dispatch({ type: 'SELECT_NODE', id, multi });
    }, []);

    const deselectAll = useCallback(() => {
        dispatch({ type: 'DESELECT_ALL' });
    }, []);

    const moveNode = useCallback((id: string, position: { x: number; y: number }) => {
        dispatch({ type: 'MOVE_NODE', id, position });
    }, []);

    const moveNodes = useCallback((moves: { id: string; position: { x: number; y: number } }[]) => {
        dispatch({ type: 'MOVE_NODES', moves });
    }, []);

    const setZoom = useCallback((zoom: number) => {
        dispatch({ type: 'SET_ZOOM', zoom });
    }, []);

    const setPan = useCallback((pan: { x: number; y: number }) => {
        dispatch({ type: 'SET_PAN', pan });
    }, []);

    const toggleMinimap = useCallback(() => {
        dispatch({ type: 'TOGGLE_MINIMAP' });
    }, []);

    const toggleGrid = useCallback(() => {
        dispatch({ type: 'TOGGLE_GRID' });
    }, []);

    const setLayout = useCallback((layout: LayoutType) => {
        dispatch({ type: 'SET_LAYOUT', layout });
    }, []);

    const undo = useCallback(() => {
        dispatch({ type: 'UNDO' });
    }, []);

    const redo = useCallback(() => {
        dispatch({ type: 'REDO' });
    }, []);

    const pushHistory = useCallback(() => {
        dispatch({ type: 'PUSH_HISTORY' });
    }, []);

    const deleteSelectedNodes = useCallback(() => {
        if (state.selectedNodeIds.size > 0) {
            pushHistory();
            dispatch({ type: 'DELETE_NODES', ids: Array.from(state.selectedNodeIds) });
        }
    }, [state.selectedNodeIds, pushHistory]);

    const canUndo = state.historyIndex > 0;
    const canRedo = state.historyIndex < state.history.length - 1;

    const value = useMemo<MindmapContextValue>(() => ({
        state,
        dispatch,
        setNodes,
        setEdges,
        selectNode,
        deselectAll,
        moveNode,
        moveNodes,
        setZoom,
        setPan,
        toggleMinimap,
        toggleGrid,
        setLayout,
        undo,
        redo,
        pushHistory,
        deleteSelectedNodes,
        canUndo,
        canRedo,
    }), [
        state, setNodes, setEdges, selectNode, deselectAll, moveNode, moveNodes,
        setZoom, setPan, toggleMinimap, toggleGrid, setLayout, undo, redo,
        pushHistory, deleteSelectedNodes, canUndo, canRedo
    ]);

    return <MindmapContext.Provider value={value}>{children}</MindmapContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useMindmap() {
    const context = useContext(MindmapContext);
    if (!context) {
        throw new Error('useMindmap must be used within a MindmapProvider');
    }
    return context;
}

export default MindmapContext;
