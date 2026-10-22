/**
 * Access to the ProjectFlow desktop shell (Electron, `desktop/`). In a normal browser every helper
 * is a no-op. Mirror of desktop/src/contract.ts — installed shells update slower than the web app,
 * so always feature-detect with `hasDesktopCapability` before calling newer bridge methods.
 */

export type DesktopPlatform = 'darwin' | 'win32' | 'linux';
export type DesktopWindowKind = 'main' | 'quick-access';
export type DesktopCapability = 'titlebar' | 'app-menu' | 'popout' | 'badge' | 'tray' | 'notifications' | 'language';

export type DesktopCommand =
    | 'new-task'
    | 'new-project'
    | 'open-settings'
    | 'open-search'
    | 'open-help'
    | 'open-quick-access-modal'
    | 'go-dashboard'
    | 'go-projects'
    | 'go-tasks'
    | 'go-calendar'
    | 'go-notifications'
    | 'navigate';

export interface DesktopCommandEvent {
    command: DesktopCommand;
    path?: string;
}

export interface DesktopWindowState {
    isMaximized: boolean;
    isFullScreen: boolean;
    isFocused: boolean;
    isAlwaysOnTop: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    zoomFactor: number;
}

export interface DesktopQuickAccessState {
    isOpen: boolean;
    alwaysOnTop: boolean;
}

export interface DesktopTraySnapshot {
    focus: { id: string; title: string; status: 'active' | 'snoozed' | 'blocked' } | null;
    pinned: { id: string; title: string; path: string | null }[];
}

export interface DesktopBridge {
    apiVersion: number;
    capabilities: DesktopCapability[];
    platform: DesktopPlatform;
    windowKind: DesktopWindowKind;
    isDev: boolean;
    getWindowState(): Promise<DesktopWindowState | null>;
    onWindowStateChange(callback: (state: DesktopWindowState) => void): () => void;
    windowAction(action: 'minimize' | 'toggle-maximize' | 'close' | 'back' | 'forward'): void;
    showAppMenu(x: number, y: number): void;
    setTitleBarTheme(theme: { mode: 'light' | 'dark' | 'system'; color: string; symbolColor: string }): void;
    quickAccess(
        action: 'open' | 'close' | 'toggle' | 'dock' | 'state' | 'set-always-on-top',
        value?: boolean
    ): Promise<DesktopQuickAccessState>;
    onQuickAccessChange(callback: (state: DesktopQuickAccessState) => void): () => void;
    openInMain(path: string): void;
    onCommand(callback: (event: DesktopCommandEvent) => void): () => void;
    ready(): void;
    setBadge(count: number, overlayDataUrl?: string | null): void;
    notify(payload: { id: string; title: string; body?: string; path?: string }): void;
    updateTray(snapshot: DesktopTraySnapshot): void;
    setLanguage(language: 'de' | 'en'): void;
}

declare global {
    interface Window {
        projectflowDesktop?: DesktopBridge;
    }
}

export const getDesktopBridge = (): DesktopBridge | null => (
    typeof window !== 'undefined' && window.projectflowDesktop ? window.projectflowDesktop : null
);

export const isDesktop = () => Boolean(getDesktopBridge());

export const desktopPlatform = (): DesktopPlatform | null => getDesktopBridge()?.platform ?? null;

export const isDesktopQuickAccessWindow = () => getDesktopBridge()?.windowKind === 'quick-access';

export const hasDesktopCapability = (capability: DesktopCapability) => (
    Boolean(getDesktopBridge()?.capabilities?.includes(capability))
);

/** Route of the pop-out window (rendered without AppLayout). */
export const DESKTOP_QUICK_ACCESS_PATH = '/desktop/quick-access';

/** Window event the desktop menu uses to open global search (⌘K itself stays a page shortcut). */
export const DESKTOP_OPEN_SEARCH_EVENT = 'projectflow:open-search';

/** In-app path of a pinned item (tray menu, notifications); null when it cannot be opened. */
export const pinnedItemPath = (item: { id: string; type: string; projectId?: string }) => {
    if (item.type === 'personal-task') return `/personal-tasks/${item.id}`;
    if (!item.projectId) return null;
    return `/project/${item.projectId}/${item.type === 'initiative' ? 'initiatives' : 'tasks'}/${item.id}`;
};
