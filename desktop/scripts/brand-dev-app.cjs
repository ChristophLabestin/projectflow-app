// macOS dev only: `npx electron .` runs the generic node_modules/electron/dist/Electron.app, and macOS
// takes the menu-bar/Dock name, icon and notification sender from that bundle (not from app.setName).
// This brands the dev bundle as "ProjectFlow" once (idempotent; re-run after reinstalling electron).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

if (process.platform !== 'darwin') process.exit(0);

const NAME = 'ProjectFlow';
const BUNDLE_ID = 'de.christophlabestin.projectflow.desktop.dev';
const appDir = path.join(path.dirname(require.resolve('electron/package.json')), 'dist', 'Electron.app');
const plist = path.join(appDir, 'Contents', 'Info.plist');
const icon = path.join(__dirname, '..', 'assets', 'icon.icns');
const targetIcon = path.join(appDir, 'Contents', 'Resources', 'electron.icns');

if (!fs.existsSync(plist)) process.exit(0);

const read = (key) => {
    try {
        return execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
};
const set = (key, value) => {
    const command = read(key) === null ? `Add :${key} string ${value}` : `Set :${key} ${value}`;
    execFileSync('/usr/libexec/PlistBuddy', ['-c', command, plist]);
};

const iconCurrent = fs.existsSync(targetIcon) && fs.readFileSync(targetIcon).equals(fs.readFileSync(icon));
if (read('CFBundleName') === NAME && read('CFBundleIdentifier') === BUNDLE_ID && iconCurrent) process.exit(0);

set('CFBundleName', NAME);
set('CFBundleDisplayName', NAME);
set('CFBundleIdentifier', BUNDLE_ID);
fs.copyFileSync(icon, targetIcon);
// Editing the bundle breaks Electron's ad-hoc signature; re-sign so macOS keeps launching it.
execFileSync('codesign', ['--force', '--deep', '--sign', '-', appDir], { stdio: 'ignore' });
// Refresh Launch Services so the Dock and menu bar pick up the new name/icon.
execFileSync('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister', ['-f', appDir], { stdio: 'ignore' });
console.log(`desktop: branded dev Electron.app as ${NAME}`);
