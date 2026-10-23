/**
 * Sandboxed preload: bundled into one CommonJS file (esbuild) because a sandboxed preload can only
 * `require('electron')`. Exposes `window.projectflowDesktop` to the app origin only.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
    BRIDGE_VERSION,
    CAPABILITIES,
    IPC,
    type DesktopCommandEvent,
    type DesktopNotificationPayload,
    type DesktopPreferences,
    type DesktopPreferencesInfo,
    type OpenWindowRequest,
    type AppAction,
    type UpcomingEvent,
    type DesktopWindowState,
    type QuickAccessAction,
    type QuickAccessState,
    type TitleBarTheme,
    type TraySnapshot,
    type WindowAction,
    type WindowKind
} from './contract';

const argValue = (name: string) => {
    const prefix = `--${name}=`;
    return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? '';
};

const appOrigin = argValue('pf-origin');
const windowKind = (argValue('pf-window') || 'main') as WindowKind;
const isDev = argValue('pf-dev') === '1';
const language = argValue('pf-lang') === 'de' ? 'de' : 'en';
const platform = process.platform;

const subscribe = <T>(channel: string, callback: (payload: T) => void) => {
    const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => {
        ipcRenderer.removeListener(channel, listener);
    };
};

const markDocument = () => {
    const root = document.documentElement;
    if (!root) return false;
    const platformClass = platform === 'darwin' ? 'desktop-mac' : platform === 'win32' ? 'desktop-win' : 'desktop-linux';
    root.classList.add('is-desktop', platformClass, `desktop-window-${windowKind}`);
    return true;
};

if (location.origin === appOrigin) {
    // Classes before first paint so the title bar layout never jumps.
    if (!markDocument()) document.addEventListener('DOMContentLoaded', markDocument, { once: true });

    contextBridge.exposeInMainWorld('projectflowDesktop', {
        apiVersion: BRIDGE_VERSION,
        capabilities: [...CAPABILITIES],
        platform,
        windowKind,
        isDev,
        /** Last UI language known to the shell (persisted); the web app's fallback when it has none stored. */
        language,
        getWindowState: (): Promise<DesktopWindowState> => ipcRenderer.invoke(IPC.windowState),
        onWindowStateChange: (callback: (state: DesktopWindowState) => void) => subscribe(IPC.windowStateChanged, callback),
        windowAction: (action: WindowAction) => ipcRenderer.send(IPC.windowAction, action),
        showAppMenu: (x: number, y: number) => ipcRenderer.send(IPC.showAppMenu, { x, y }),
        setTitleBarTheme: (theme: TitleBarTheme) => ipcRenderer.send(IPC.setTitleBarTheme, theme),
        quickAccess: (action: QuickAccessAction, value?: boolean): Promise<QuickAccessState> => (
            ipcRenderer.invoke(IPC.quickAccess, action, value)
        ),
        onQuickAccessChange: (callback: (state: QuickAccessState) => void) => subscribe(IPC.quickAccessChanged, callback),
        openInMain: (path: string) => ipcRenderer.send(IPC.openInMain, path),
        onCommand: (callback: (event: DesktopCommandEvent) => void) => subscribe(IPC.command, callback),
        ready: () => ipcRenderer.send(IPC.rendererReady),
        setBadge: (count: number, overlayDataUrl?: string | null) => ipcRenderer.send(IPC.setBadge, { count, overlayDataUrl }),
        notify: (payload: DesktopNotificationPayload) => ipcRenderer.send(IPC.notify, payload),
        updateTray: (snapshot: TraySnapshot) => ipcRenderer.send(IPC.updateTray, snapshot),
        setLanguage: (language: 'de' | 'en') => ipcRenderer.send(IPC.setLanguage, language),
        getPreferences: (): Promise<DesktopPreferencesInfo> => ipcRenderer.invoke(IPC.getPreferences),
        setPreferences: (patch: Partial<DesktopPreferences>): Promise<DesktopPreferencesInfo> => ipcRenderer.invoke(IPC.setPreferences, patch),
        openWindow: (request: OpenWindowRequest) => ipcRenderer.send(IPC.openWindow, request),
        closeSelf: () => ipcRenderer.send(IPC.closeSelf),
        addRecent: (recent: { path: string; title: string }) => ipcRenderer.send(IPC.addRecent, recent),
        onWindowPayload: (callback: (payload: Record<string, unknown>) => void) => subscribe(IPC.windowPayload, callback),
        getUpcomingEvents: (): Promise<UpcomingEvent[]> => ipcRenderer.invoke(IPC.upcomingEvents),
        appAction: (action: AppAction) => ipcRenderer.send(IPC.appAction, action),
        signInExternally: (): Promise<boolean> => ipcRenderer.invoke(IPC.signInExternally),
        indexSpotlight: (items: unknown[]) => ipcRenderer.send(IPC.indexSpotlight, items)
    });
}
