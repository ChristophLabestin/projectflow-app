// macOS dev only: `npx electron .` runs the generic node_modules/electron/dist/Electron.app, and macOS
// takes the menu-bar/Dock name, icon and notification sender from that bundle (not from app.setName).
// This brands the dev bundle as "ProjectFlow" (bundle renamed to ProjectFlow.app) once (idempotent; re-run after reinstalling electron).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'darwin' || process.env.CI) process.exit(0);

// "ProjectFlow Dev" + DEV icon, so it can run next to the installed ProjectFlow.app without being confused with it.
const NAME = 'ProjectFlow Dev';
const BUNDLE_ID = 'de.christophlabestin.projectflow.desktop.dev';
const electronDir = path.dirname(require.resolve('electron/package.json'));
const distDir = path.join(electronDir, 'dist');
const appDir = path.join(distDir, `${NAME}.app`);
const pathFile = path.join(electronDir, 'path.txt');

// The Dock labels a running app by its bundle file name, so the bundle itself is renamed and
// electron's path.txt (used by `electron .`) pointed at it.
const genericApp = fs.existsSync(path.join(distDir, 'Electron.app'))
    ? path.join(distDir, 'Electron.app')
    : path.join(distDir, 'ProjectFlow.app'); // bundles branded before the rename
const renamed = fs.existsSync(genericApp);
if (renamed) {
    fs.rmSync(appDir, { recursive: true, force: true });
    fs.renameSync(genericApp, appDir);
}
const executablePath = `${NAME}.app/Contents/MacOS/Electron`;
if (fs.existsSync(pathFile) && fs.readFileSync(pathFile, 'utf8') !== executablePath) {
    fs.writeFileSync(pathFile, executablePath);
}
const plist = path.join(appDir, 'Contents', 'Info.plist');
const baseIcon = path.join(__dirname, '..', 'assets', 'icon.icns');
// DEV band drawn once into dist/ (see dev-icon.swift); falls back to the plain icon without swift.
const icon = path.join(__dirname, '..', 'dist', 'icon-dev.icns');
if (!fs.existsSync(icon) || fs.statSync(icon).mtimeMs < fs.statSync(baseIcon).mtimeMs) {
    try {
        fs.mkdirSync(path.dirname(icon), { recursive: true });
        execFileSync('xcrun', ['swift', path.join(__dirname, 'dev-icon.swift'), baseIcon, icon], { stdio: 'ignore' });
    } catch {
        fs.copyFileSync(baseIcon, icon);
    }
}
const targetIcon = path.join(appDir, 'Contents', 'Resources', 'electron.icns');

if (!fs.existsSync(plist)) process.exit(0);

const read = (key) => {
    try {
        return execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return null;
    }
};
const set = (key, value) => {
    const command = read(key) === null ? `Add :${key} string ${value}` : `Set :${key} ${value}`;
    execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plist]);
};

const CALENDAR_TEXT = 'ProjectFlow reads your upcoming meetings to pause your focus task and to offer capturing meeting notes.';
const hasDocumentTypes = read('CFBundleDocumentTypes:0:CFBundleTypeRole') === 'Viewer';

const iconCurrent = fs.existsSync(targetIcon) && fs.readFileSync(targetIcon).equals(fs.readFileSync(icon));
if (!renamed && hasDocumentTypes && read('NSCalendarsFullAccessUsageDescription') && read('CFBundleName') === NAME && read('CFBundleIdentifier') === BUNDLE_ID && iconCurrent) process.exit(0);

set('CFBundleName', NAME);
set('CFBundleDisplayName', NAME);
set('CFBundleIdentifier', BUNDLE_ID);
set('NSCalendarsUsageDescription', `'${CALENDAR_TEXT}'`);
set('NSCalendarsFullAccessUsageDescription', `'${CALENDAR_TEXT}'`);
// Accept any file dropped onto the Dock icon (never becomes the default app for a file type).
if (!hasDocumentTypes) {
    const run = (command) => execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plist], { stdio: 'ignore' });
    try { run('Delete :CFBundleDocumentTypes'); } catch { /* not present */ }
    run('Add :CFBundleDocumentTypes array');
    run('Add :CFBundleDocumentTypes:0 dict');
    run('Add :CFBundleDocumentTypes:0:CFBundleTypeName string Attachment');
    run('Add :CFBundleDocumentTypes:0:CFBundleTypeRole string Viewer');
    run('Add :CFBundleDocumentTypes:0:LSHandlerRank string None');
    run('Add :CFBundleDocumentTypes:0:LSItemContentTypes array');
    run('Add :CFBundleDocumentTypes:0:LSItemContentTypes:0 string public.item');
}
fs.copyFileSync(icon, targetIcon);
// Editing the bundle breaks Electron's ad-hoc signature; re-sign so macOS keeps launching it.
execFileSync('codesign', ['--force', '--deep', '--sign', '-', appDir], { stdio: 'ignore' });
// Bump the bundle's mtime so the icon cache does not keep serving the old Electron icon.
const now = new Date();
fs.utimesSync(appDir, now, now);
// Refresh Launch Services so the Dock and menu bar pick up the new name/icon.
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', appDir], { stdio: 'ignore' });
console.log(`desktop: branded dev Electron.app as ${NAME}`);
