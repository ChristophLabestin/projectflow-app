import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron';
import { IS_DEV } from './config';
import type { DesktopCommand } from './contract';
import { labels } from './labels';
import { openExternalSafe } from './security';
import { getSettings, updateSettings } from './store';
import { showCapture } from './windows/auxWindows';
import { createSecondaryWindow, getMainWindow, sendCommand, setZoomLevel, showMainWindow } from './windows/mainWindow';
import { getQuickAccessState, setQuickAccessAlwaysOnTop, toggleQuickAccess } from './windows/quickAccess';

const isMac = process.platform === 'darwin';
const WEBSITE_URL = 'https://getprojectflow.com';

/** Every app command goes to the main window (the pop-out has no navigation). */
export const runCommand = (command: DesktopCommand, path?: string) => {
    showMainWindow();
    sendCommand({ command, path });
};

const command = (label: string, id: DesktopCommand, accelerator?: string, extra: Partial<MenuItemConstructorOptions> = {}): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => runCommand(id),
    ...extra
});

/** Page-level shortcuts (⌘K search, ⌘⇧F Quick Access) stay with the web app; the menu only shows them. */
const pageShortcut = { registerAccelerator: false } as const;

const mainContents = () => getMainWindow()?.webContents;

/** Path of the focused app window, so "New Window" duplicates what the user is looking at. */
const currentPath = () => {
    const contents = (BrowserWindow.getFocusedWindow() ?? getMainWindow())?.webContents;
    try {
        const url = new URL(contents?.getURL() || '');
        return url.pathname.startsWith('/desktop/') ? '/' : `${url.pathname}${url.search}`;
    } catch {
        return '/';
    }
};

const MAX_RECENTS = 6;

/** Recently opened projects, reported by the web app; shown in File, the Dock menu and the Windows jump list. */
export const addRecent = (recent: { path: string; title: string }) => {
    const recents = [recent, ...getSettings().recents.filter((item) => item.path !== recent.path)].slice(0, MAX_RECENTS);
    const changed = JSON.stringify(recents) !== JSON.stringify(getSettings().recents);
    if (!changed) return;
    updateSettings({ recents });
    installMenus();
};

const recentsSubmenu = (): MenuItemConstructorOptions[] => {
    const recents = getSettings().recents;
    if (!recents.length) return [];
    return [{
        label: labels().recent,
        submenu: recents.map((item) => ({ label: item.title, click: () => runCommand('navigate', item.path) }))
    }];
};

/** Windows jump list: tasks + recent projects, launched as deep links into the running instance. */
const applyJumpList = () => {
    if (process.platform !== 'win32') return;
    const l = labels();
    const link = (title: string, target: string) => ({
        type: 'task' as const,
        title,
        program: process.execPath,
        args: `${process.defaultApp ? `"${process.argv[1]}" ` : ''}projectflow://${target.replace(/^\//, '')}`,
        iconPath: process.execPath,
        iconIndex: 0
    });
    app.setJumpList([
        { type: 'tasks', items: [link(l.newTask, 'desktop/command/new-task'), link(l.quickCapture, 'desktop/command/quick-capture')] },
        ...(getSettings().recents.length ? [{
            type: 'custom' as const,
            name: l.recent,
            items: getSettings().recents.map((item) => link(item.title, item.path))
        }] : [])
    ]);
};

export const buildMenuTemplate = (): MenuItemConstructorOptions[] => {
    const l = labels();
    const quickAccess = getQuickAccessState();

    const appMenu: MenuItemConstructorOptions = {
        label: app.name,
        submenu: [
            { role: 'about', label: l.about },
            { type: 'separator' },
            command(l.settings, 'open-settings', 'CmdOrCtrl+,'),
            { type: 'separator' },
            { role: 'services', label: l.services },
            { type: 'separator' },
            { role: 'hide', label: l.hide },
            { role: 'hideOthers', label: l.hideOthers },
            { role: 'unhide', label: l.showAll },
            { type: 'separator' },
            { role: 'quit', label: l.quit }
        ]
    };

    const fileMenu: MenuItemConstructorOptions = {
        label: l.file,
        submenu: [
            command(l.newTask, 'new-task', 'CmdOrCtrl+N'),
            command(l.newProject, 'new-project', 'CmdOrCtrl+Shift+N'),
            { label: l.quickCapture, click: () => showCapture() },
            { type: 'separator' },
            { label: l.newWindow, accelerator: 'CmdOrCtrl+Alt+N', click: () => createSecondaryWindow(currentPath()) },
            ...recentsSubmenu(),
            { type: 'separator' },
            ...(!isMac ? [command(l.settings, 'open-settings', 'Ctrl+,'), { type: 'separator' } as MenuItemConstructorOptions] : []),
            { role: 'close', label: l.closeWindow },
            ...(!isMac ? [{ role: 'quit', label: l.exit } as MenuItemConstructorOptions] : [])
        ]
    };

    const editMenu: MenuItemConstructorOptions = {
        label: l.edit,
        submenu: [
            { role: 'undo', label: l.undo },
            { role: 'redo', label: l.redo },
            { type: 'separator' },
            { role: 'cut', label: l.cut },
            { role: 'copy', label: l.copy },
            { role: 'paste', label: l.paste },
            ...(isMac ? [{ role: 'pasteAndMatchStyle', label: l.pasteAndMatchStyle } as MenuItemConstructorOptions] : []),
            { role: 'selectAll', label: l.selectAll }
        ]
    };

    const zoomBy = (delta: number | null) => {
        const win = getMainWindow();
        if (!win) return;
        setZoomLevel(win, delta === null ? 0 : win.webContents.getZoomLevel() + delta);
    };

    const viewMenu: MenuItemConstructorOptions = {
        label: l.view,
        submenu: [
            { label: l.reload, accelerator: 'CmdOrCtrl+R', click: () => mainContents()?.reload() },
            { label: l.back, accelerator: isMac ? 'Cmd+[' : 'Alt+Left', click: () => mainContents()?.navigationHistory.goBack() },
            { label: l.forward, accelerator: isMac ? 'Cmd+]' : 'Alt+Right', click: () => mainContents()?.navigationHistory.goForward() },
            { type: 'separator' },
            { label: l.actualSize, accelerator: 'CmdOrCtrl+0', click: () => zoomBy(null) },
            { label: l.zoomIn, accelerator: 'CmdOrCtrl+Plus', click: () => zoomBy(0.5) },
            { label: l.zoomOut, accelerator: 'CmdOrCtrl+-', click: () => zoomBy(-0.5) },
            { type: 'separator' },
            { role: 'togglefullscreen', label: l.toggleFullScreen },
            ...(IS_DEV ? [{ role: 'toggleDevTools', label: l.developerTools } as MenuItemConstructorOptions] : [])
        ]
    };

    const goMenu: MenuItemConstructorOptions = {
        label: l.go,
        submenu: [
            command(l.dashboard, 'go-dashboard', 'CmdOrCtrl+1'),
            command(l.projects, 'go-projects', 'CmdOrCtrl+2'),
            command(l.tasks, 'go-tasks', 'CmdOrCtrl+3'),
            command(l.calendar, 'go-calendar', 'CmdOrCtrl+4'),
            command(l.notifications, 'go-notifications', 'CmdOrCtrl+5'),
            { type: 'separator' },
            command(l.search, 'open-search', 'CmdOrCtrl+K', pageShortcut)
        ]
    };

    const windowMenu: MenuItemConstructorOptions = {
        label: l.window,
        submenu: [
            { role: 'minimize', label: l.minimize },
            ...(isMac ? [{ role: 'zoom', label: l.zoom } as MenuItemConstructorOptions] : []),
            { type: 'separator' },
            command(l.quickAccess, 'open-quick-access-modal', 'CmdOrCtrl+Shift+F', pageShortcut),
            {
                label: l.quickAccessPopOut,
                accelerator: 'CmdOrCtrl+Shift+P',
                type: 'checkbox',
                checked: quickAccess.isOpen,
                click: () => toggleQuickAccess()
            },
            {
                label: l.quickAccessOnTop,
                type: 'checkbox',
                checked: quickAccess.alwaysOnTop,
                click: (item) => setQuickAccessAlwaysOnTop(item.checked)
            },
            ...(isMac ? [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'front', label: l.bringAllToFront } as MenuItemConstructorOptions] : [])
        ]
    };

    const helpMenu: MenuItemConstructorOptions = {
        role: 'help',
        label: l.help,
        submenu: [
            command(l.helpCenter, 'open-help'),
            { label: l.website, click: () => openExternalSafe(WEBSITE_URL) },
            ...(!isMac ? [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'about', label: l.about } as MenuItemConstructorOptions] : [])
        ]
    };

    return [...(isMac ? [appMenu] : []), fileMenu, editMenu, viewMenu, goMenu, windowMenu, helpMenu];
};

export const installMenus = () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate()));
    if (isMac) {
        const l = labels();
        app.dock?.setMenu(Menu.buildFromTemplate([
            ...getSettings().recents.map((item) => ({ label: item.title, click: () => runCommand('navigate', item.path) })),
            ...(getSettings().recents.length ? [{ type: 'separator' } as MenuItemConstructorOptions] : []),
            command(l.newTask, 'new-task'),
            { label: l.quickCapture, click: () => showCapture() },
            { label: l.quickAccessPopOut, click: () => toggleQuickAccess() },
            { label: l.newWindow, click: () => createSecondaryWindow('/') }
        ]));
    }
    applyJumpList();
    // Keep the hidden Windows menu bar out of the way (accelerators stay active through the application menu).
    BrowserWindow.getAllWindows().forEach((win) => win.setMenuBarVisibility(false));
};
