import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { labels } from '../labels';
import { openExternalSafe } from '../security';
import { showNativeNotification } from './notifications';

/**
 * Updates from GitHub Releases (electron-builder `publish` config, latest*.yml feed).
 * - Windows (NSIS) and signed macOS builds download in the background and install on the next restart.
 * - Unsigned macOS builds cannot self-update (Squirrel.Mac validates the code signature): they only announce the
 *   new version and open the download page. The release workflow marks signed builds (`pfSigned` in package.json).
 */

export const RELEASES_URL = 'https://github.com/ChristophLabestin/projectflow-app/releases/latest';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let manualCheck = false;
let downloadedVersion: string | null = null;

const isSignedBuild = () => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8')) as { pfSigned?: boolean };
        return Boolean(pkg.pfSigned);
    } catch {
        return false;
    }
};

const canInstallUpdates = () => process.platform !== 'darwin' || isSignedBuild();

export const checkForUpdates = (manual = false) => {
    if (!app.isPackaged) return;
    manualCheck = manual;
    void autoUpdater.checkForUpdates().catch((error) => {
        console.warn('[desktop] update check failed', error?.message ?? error);
        if (manual) {
            showNativeNotification({ key: 'update-error', title: labels().updateCheckFailed });
        }
    });
};

export const installDownloadedUpdate = () => {
    if (downloadedVersion) autoUpdater.quitAndInstall();
};

export const startUpdater = () => {
    if (!app.isPackaged) return;
    autoUpdater.autoDownload = canInstallUpdates();
    autoUpdater.autoInstallOnAppQuit = canInstallUpdates();
    autoUpdater.logger = null;

    autoUpdater.on('update-available', (info) => {
        if (canInstallUpdates()) return; // downloads silently; announced when ready
        const l = labels();
        showNativeNotification({
            key: 'update-available',
            title: l.updateAvailableTitle.replace('{version}', info.version),
            body: l.updateAvailableBody,
            actions: [l.updateDownload],
            onClick: () => openExternalSafe(RELEASES_URL),
            onAction: () => openExternalSafe(RELEASES_URL)
        });
    });

    autoUpdater.on('update-not-available', () => {
        if (!manualCheck) return;
        showNativeNotification({ key: 'update-none', title: labels().updateNone.replace('{version}', app.getVersion()) });
    });

    autoUpdater.on('update-downloaded', (info) => {
        downloadedVersion = info.version;
        const l = labels();
        showNativeNotification({
            key: 'update-ready',
            title: l.updateReadyTitle.replace('{version}', info.version),
            body: l.updateReadyBody,
            actions: [l.updateRestart],
            onClick: installDownloadedUpdate,
            onAction: installDownloadedUpdate
        });
    });

    autoUpdater.on('error', (error) => console.warn('[desktop] updater error', error?.message ?? error));

    setTimeout(() => checkForUpdates(false), 30 * 1000);
    timer = setInterval(() => checkForUpdates(false), CHECK_INTERVAL_MS);
};

export const stopUpdater = () => {
    if (timer) clearInterval(timer);
    timer = null;
};
