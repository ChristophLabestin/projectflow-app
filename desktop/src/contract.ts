/**
 * IPC contract between the Electron shell and the web app.
 * Mirror: web/services/desktop.ts (keep both in sync; bump BRIDGE_VERSION on breaking changes).
 */
export const BRIDGE_VERSION = 1;

/** Feature flags the web app checks before calling into the bridge (old shells meet new web code). */
export const CAPABILITIES = ['titlebar', 'app-menu', 'popout', 'badge', 'tray', 'notifications', 'language'] as const;
export type DesktopCapability = typeof CAPABILITIES[number];

export type WindowKind = 'main' | 'quick-access';

/** Commands from menus, tray, dock, jump list and shortcuts; routed by the web app's DesktopBridge. */
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

export interface TitleBarTheme {
    /** Theme preference of the web app; drives nativeTheme.themeSource (menus, prefers-color-scheme). */
    mode: 'light' | 'dark' | 'system';
    color: string;
    symbolColor: string;
}

export interface QuickAccessState {
    isOpen: boolean;
    alwaysOnTop: boolean;
}

export interface DesktopNotificationPayload {
    id: string;
    title: string;
    body?: string;
    path?: string;
}

export interface TraySnapshot {
    focus: { id: string; title: string; status: 'active' | 'snoozed' | 'blocked' } | null;
    pinned: { id: string; title: string; path: string | null }[];
}

export const IPC = {
    windowState: 'pf:window-state',
    windowAction: 'pf:window-action',
    windowStateChanged: 'pf:window-state-changed',
    showAppMenu: 'pf:show-app-menu',
    setTitleBarTheme: 'pf:set-title-bar-theme',
    quickAccess: 'pf:quick-access',
    quickAccessChanged: 'pf:quick-access-changed',
    openInMain: 'pf:open-in-main',
    command: 'pf:command',
    rendererReady: 'pf:renderer-ready',
    setBadge: 'pf:set-badge',
    notify: 'pf:notify',
    updateTray: 'pf:update-tray',
    setLanguage: 'pf:set-language'
} as const;

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close' | 'back' | 'forward';
/** `dock` closes the pop-out and reopens the Quick Access modal in the main window. */
export type QuickAccessAction = 'open' | 'close' | 'toggle' | 'dock' | 'state' | 'set-always-on-top';
