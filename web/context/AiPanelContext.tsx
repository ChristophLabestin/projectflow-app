import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useInAppAi } from '../hooks/useInAppAi';
import type { AiContextEnvelope } from '../services/aiAssistClient';

/**
 * In-app AI panel (⌘J, package P2): open state plus the context of the current screen.
 * The base context comes from the route (project, task); screens add what only they know
 * (visible items, selection) with `useAiScreenContext`. Concept §4.1.
 */
type ScreenExtras = Pick<AiContextEnvelope, 'selection' | 'view'> & { surface?: string };

interface AiPanelContextValue {
    enabled: boolean;
    open: boolean;
    /** Text to put into the input when opening (e.g. from a suggestion chip elsewhere). */
    draft: string;
    openPanel: (draft?: string) => void;
    closePanel: () => void;
    togglePanel: () => void;
    getContext: () => AiContextEnvelope;
    setScreenExtras: (extras: ScreenExtras | null) => void;
}

const AiPanelContext = createContext<AiPanelContextValue | null>(null);

const SURFACE_BY_SEGMENT: Record<string, string> = {
    tasks: 'list', board: 'board', calendar: 'calendar', wiki: 'wiki', files: 'file', flows: 'flow',
    activity: 'project', milestones: 'project', initiatives: 'project'
};

/** Route → base context. `/project/:id/tasks/:taskId` → task, `/project/:id/...` → project. */
export const contextFromPath = (pathname: string): AiContextEnvelope => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] === 'project' && parts[1]) {
        const projectId = parts[1];
        if (parts[2] === 'tasks' && parts[3]) {
            return { surface: 'task', route: pathname, projectId, entity: { kind: 'task', id: parts[3], projectId } };
        }
        return { surface: SURFACE_BY_SEGMENT[parts[2]] || 'project', route: pathname, projectId, entity: { kind: 'project', id: projectId } };
    }
    if (parts.length === 0 || parts[0] === 'dashboard') return { surface: 'dashboard', route: pathname || '/' };
    const surface = ({ tasks: 'list', calendar: 'calendar', notifications: 'inbox', inbox: 'inbox', wiki: 'wiki', files: 'file', settings: 'settings' } as Record<string, string>)[parts[0]];
    return { surface: surface || 'other', route: pathname };
};

export const AiPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { enabled } = useInAppAi();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const extrasRef = useRef<ScreenExtras | null>(null);
    const pathRef = useRef(location.pathname);
    pathRef.current = location.pathname;

    const openPanel = useCallback((text?: string) => {
        setDraft(text || '');
        setOpen(true);
    }, []);
    const closePanel = useCallback(() => setOpen(false), []);
    const togglePanel = useCallback(() => setOpen((value) => !value), []);

    const getContext = useCallback((): AiContextEnvelope => {
        const base = contextFromPath(pathRef.current);
        const extras = extrasRef.current;
        if (!extras) return base;
        return { ...base, surface: extras.surface || base.surface, selection: extras.selection, view: extras.view };
    }, []);

    const setScreenExtras = useCallback((extras: ScreenExtras | null) => { extrasRef.current = extras; }, []);

    // ⌘J / Ctrl+J everywhere; a focused ✦ field handles it first and stops propagation.
    useEffect(() => {
        if (!enabled) return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.shiftKey || event.altKey) return;
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
                event.preventDefault();
                setDraft('');
                setOpen((value) => !value);
            }
        };
        const onExternalOpen = (event: Event) => openPanel((event as CustomEvent<{ prompt?: string }>).detail?.prompt);
        window.addEventListener('keydown', onKey);
        window.addEventListener('pf:open-ai-panel', onExternalOpen);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('pf:open-ai-panel', onExternalOpen);
        };
    }, [enabled, openPanel]);

    useEffect(() => { if (!enabled) setOpen(false); }, [enabled]);

    const value = useMemo(() => ({
        enabled, open, draft, openPanel, closePanel, togglePanel, getContext, setScreenExtras
    }), [enabled, open, draft, openPanel, closePanel, togglePanel, getContext, setScreenExtras]);

    return <AiPanelContext.Provider value={value}>{children}</AiPanelContext.Provider>;
};

const FALLBACK: AiPanelContextValue = {
    enabled: false, open: false, draft: '',
    openPanel: () => undefined, closePanel: () => undefined, togglePanel: () => undefined,
    getContext: () => ({ surface: 'other' }), setScreenExtras: () => undefined
};

export const useAiPanel = () => useContext(AiPanelContext) || FALLBACK;

/** Screens report what is visible/selected so the assistant can refer to it. */
export const useAiScreenContext = (extras: ScreenExtras | null) => {
    const { setScreenExtras } = useAiPanel();
    const key = JSON.stringify(extras);
    useEffect(() => {
        setScreenExtras(extras);
        return () => setScreenExtras(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, setScreenExtras]);
};
