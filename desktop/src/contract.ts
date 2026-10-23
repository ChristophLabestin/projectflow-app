/**
 * IPC contract between the Electron shell and the web app.
 * Mirror: web/services/desktop.ts (keep both in sync; bump BRIDGE_VERSION on breaking changes).
 */
export const BRIDGE_VERSION = 1;

/** Feature flags the web app checks before calling into the bridge (old shells meet new web code). */
export const CAPABILITIES = [
    'titlebar', 'app-menu', 'popout', 'badge', 'tray', 'notifications', 'language',
    'preferences', 'quick-capture', 'notification-actions', 'day-flow', 'file-drop', 'calendar', 'recents', 'windows',
    'tray-panel', 'external-auth', 'spotlight', 'open-in-browser'
] as const;
export type DesktopCapability = typeof CAPABILITIES[number];

export type WindowKind = 'main' | 'quick-access' | 'capture' | 'day' | 'secondary' | 'tray';

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

/** User-facing shell preferences (Settings → Desktop). */
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
    spotlightEnabled: boolean;
}

export interface DesktopPreferencesInfo extends DesktopPreferences {
    /** Platform support, so the settings UI can hide what does not exist there. */
    supports: { calendar: boolean; focusShortcuts: boolean; touchBar: boolean; notificationActions: boolean; spotlight: boolean };
    /** Result of the last calendar access attempt. */
    calendarStatus: 'unknown' | 'granted' | 'denied' | 'unavailable';
    /** Set when a requested global shortcut was taken by another app (the previous one stays active). */
    shortcutConflict?: boolean;
}

export interface DesktopFilePayload {
    name: string;
    type: string;
    bytes: Uint8Array;
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
    /** Task context enables the native actions (complete, snooze, reply). */
    taskId?: string;
    projectId?: string;
    tenantId?: string;
}

export interface TraySnapshot {
    focus: { id: string; title: string; status: 'active' | 'snoozed' | 'blocked'; startedAt?: string | null } | null;
    /** Unread notifications (badge on the menu bar panel's inbox). */
    unread?: number;
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
    setLanguage: 'pf:set-language',
    getPreferences: 'pf:get-preferences',
    setPreferences: 'pf:set-preferences',
    openWindow: 'pf:open-window',
    closeSelf: 'pf:close-self',
    addRecent: 'pf:add-recent',
    windowPayload: 'pf:window-payload',
    upcomingEvents: 'pf:upcoming-events',
    appAction: 'pf:app-action',
    signInExternally: 'pf:sign-in-externally',
    indexSpotlight: 'pf:index-spotlight',
    openInBrowser: 'pf:open-in-browser'
} as const;

/** Shell actions offered by the menu bar panel. */
export type AppAction = 'show-main' | 'quick-access' | 'capture' | 'settings' | 'day-close' | 'quit';

export interface UpcomingEvent {
    id: string;
    title: string;
    start: string;
    end: string;
}

/** Windows the web app may ask the shell to open. */
export type OpenWindowRequest =
    | { kind: 'capture'; text?: string }
    | { kind: 'day'; mode: 'start' | 'close' }
    | { kind: 'secondary'; path: string };

export type WindowAction = 'minimize' | 'toggle-maximize' | 'close' | 'back' | 'forward';
/** `dock` closes the pop-out and reopens the Quick Access modal in the main window. */
export type QuickAccessAction = 'open' | 'close' | 'toggle' | 'dock' | 'state' | 'set-always-on-top';
