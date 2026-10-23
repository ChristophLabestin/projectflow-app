/**
 * Access to the ProjectFlow desktop shell (Electron, `desktop/`). In a normal browser every helper
 * is a no-op. Mirror of desktop/src/contract.ts — installed shells update slower than the web app,
 * so always feature-detect with `hasDesktopCapability` before calling newer bridge methods.
 */

export type DesktopPlatform = 'darwin' | 'win32' | 'linux';
export type DesktopWindowKind = 'main' | 'quick-access' | 'capture' | 'day' | 'secondary' | 'tray';
export type DesktopCapability =
    | 'titlebar' | 'app-menu' | 'popout' | 'badge' | 'tray' | 'notifications' | 'language'
    | 'preferences' | 'quick-capture' | 'notification-actions' | 'day-flow' | 'file-drop' | 'calendar' | 'recents' | 'windows'
    | 'tray-panel'
    | 'external-auth';

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
    | 'navigate'
    | 'focus-pause'
    | 'focus-resume'
    | 'focus-complete'
    | 'notification-action'
    | 'attach-files'
    | 'auth-code';

export interface DesktopCommandEvent {
    command: DesktopCommand;
    path?: string;
    data?: Record<string, unknown>;
}

export interface DesktopPreferences {
    launchAtLogin: boolean;
    quickCaptureShortcut: string | null;
    quickAccessShortcut: string | null;
    dayStartEnabled: boolean;
    dayCloseEnabled: boolean;
    dayCloseTime: string;
    calendarEnabled: boolean;
    meetingLeadMinutes: number;
    focusShortcutOn: string;
    focusShortcutOff: string;
    mediaKeysEnabled: boolean;
}

export interface DesktopPreferencesInfo extends DesktopPreferences {
    supports: { calendar: boolean; focusShortcuts: boolean; touchBar: boolean; notificationActions: boolean };
    calendarStatus: 'unknown' | 'granted' | 'denied' | 'unavailable';
    shortcutConflict?: boolean;
}

export type DesktopOpenWindowRequest =
    | { kind: 'capture'; text?: string }
    | { kind: 'day'; mode: 'start' | 'close' }
    | { kind: 'secondary'; path: string };

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
    focus: { id: string; title: string; status: 'active' | 'snoozed' | 'blocked'; startedAt?: string | null } | null;
    unread?: number;
    pinned: { id: string; title: string; path: string | null }[];
}

export interface DesktopBridge {
    apiVersion: number;
    capabilities: DesktopCapability[];
    platform: DesktopPlatform;
    windowKind: DesktopWindowKind;
    isDev: boolean;
    /** Since shell 0.2: last UI language persisted by the shell. */
    language?: 'de' | 'en';
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
    notify(payload: { id: string; title: string; body?: string; path?: string; taskId?: string; projectId?: string; tenantId?: string }): void;
    updateTray(snapshot: DesktopTraySnapshot): void;
    setLanguage(language: 'de' | 'en'): void;
    // Since capabilities 'preferences' … 'windows' (shell 0.2):
    getPreferences?(): Promise<DesktopPreferencesInfo>;
    setPreferences?(patch: Partial<DesktopPreferences>): Promise<DesktopPreferencesInfo>;
    openWindow?(request: DesktopOpenWindowRequest): void;
    closeSelf?(): void;
    addRecent?(recent: { path: string; title: string }): void;
    onWindowPayload?(callback: (payload: Record<string, unknown>) => void): () => void;
    // Since capability 'tray-panel':
    getUpcomingEvents?(): Promise<{ id: string; title: string; start: string; end: string }[]>;
    appAction?(action: 'show-main' | 'quick-access' | 'capture' | 'settings' | 'day-close' | 'quit'): void;
    // Since capability 'external-auth': opens the sign-in page in the system browser (OAuth handoff).
    signInExternally?(): Promise<boolean>;
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

export const desktopWindowKind = (): DesktopWindowKind | null => getDesktopBridge()?.windowKind ?? null;

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
