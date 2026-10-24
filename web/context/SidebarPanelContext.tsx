import React from 'react';

/**
 * Context panels for the app sidebar (STYLING.md "Sidebar context panels").
 * A workspace area with its own navigation (e.g. the wiki page tree) claims the sidebar's
 * context layer — the same slide-in layer a project uses — and portals its navigation into
 * the slot the sidebar exposes. When no sidebar can host it (collapsed, mobile drawer closed)
 * `useSidebarPanel` returns null and the page renders its navigation inline.
 */
export interface SidebarPanelAction {
    icon: string;
    label: string;
    onSelect: () => void;
}

export interface SidebarPanelDef {
    key: string;
    title: string;
    icon: string;
    subtitle?: string;
    /** Route of the area's landing page (header click). */
    href?: string;
    actions?: SidebarPanelAction[];
}

interface SidebarPanelValue {
    panel: SidebarPanelDef | null;
    slot: HTMLElement | null;
    setPanel: (panel: SidebarPanelDef | null, key?: string) => void;
    registerSlot: (element: HTMLElement) => void;
    unregisterSlot: (element: HTMLElement) => void;
}

const SidebarPanelContext = React.createContext<SidebarPanelValue | null>(null);

export const SidebarPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [panel, setPanelState] = React.useState<SidebarPanelDef | null>(null);
    const [slot, setSlot] = React.useState<HTMLElement | null>(null);

    const setPanel = React.useCallback((next: SidebarPanelDef | null, key?: string) => {
        // Clearing only removes the panel that asked for it (a newer page may own it already).
        setPanelState((current) => (next || !key || current?.key === key ? next : current));
    }, []);
    const registerSlot = React.useCallback((element: HTMLElement) => setSlot(element), []);
    const unregisterSlot = React.useCallback((element: HTMLElement) => setSlot((current) => (current === element ? null : current)), []);

    const value = React.useMemo(() => ({ panel, slot, setPanel, registerSlot, unregisterSlot }), [panel, registerSlot, setPanel, slot, unregisterSlot]);
    return <SidebarPanelContext.Provider value={value}>{children}</SidebarPanelContext.Provider>;
};

/** Sidebar side: the active panel and slot registration. Safe outside the provider. */
export const useSidebarPanelHost = () => React.useContext(SidebarPanelContext);

/**
 * Page side: claims the sidebar context layer while mounted. Returns the DOM slot to portal the
 * area navigation into, or null when it must be rendered inline.
 */
export const useSidebarPanel = (def: SidebarPanelDef | null): HTMLElement | null => {
    const ctx = React.useContext(SidebarPanelContext);
    const actionsRef = React.useRef(def?.actions);
    actionsRef.current = def?.actions;
    const setPanel = ctx?.setPanel;
    const key = def?.key;
    const title = def?.title;
    const icon = def?.icon;
    const subtitle = def?.subtitle;
    const href = def?.href;
    const actionShape = (def?.actions || []).map((action) => `${action.icon}:${action.label}`).join('|');

    React.useEffect(() => {
        if (!setPanel || !key || !title || !icon) return undefined;
        const actions = actionShape
            ? (actionsRef.current || []).map((action, index) => ({ ...action, onSelect: () => actionsRef.current?.[index]?.onSelect() }))
            : undefined;
        setPanel({ key, title, icon, subtitle, href, actions });
        return () => setPanel(null, key);
    }, [actionShape, href, icon, key, setPanel, subtitle, title]);

    return key && ctx?.panel?.key === key ? ctx.slot : null;
};
