import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron';
import { IS_DEV } from './config';
import type { DesktopCommand } from './contract';
import { labels } from './labels';
import { openExternalSafe } from './security';
import { getMainWindow, sendCommand, setZoomLevel, showMainWindow } from './windows/mainWindow';
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
            command(l.newTask, 'new-task'),
            { label: l.quickAccessPopOut, click: () => toggleQuickAccess() }
        ]));
    }
    // Keep the hidden Windows menu bar out of the way (accelerators stay active through the application menu).
    BrowserWindow.getAllWindows().forEach((win) => win.setMenuBarVisibility(false));
};
