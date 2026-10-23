import { app, clipboard, shell } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { IS_DEV } from '../config';
import { showCapture } from '../windows/auxWindows';

/**
 * Screenshot → task: a global shortcut starts the system's area selection; the image opens Quick Capture as an
 * attachment (uploaded to the task once it is saved in a project).
 * - macOS: `screencapture -i` (interactive; the first use asks for Screen Recording permission).
 * - Windows: Snipping Tool (`ms-screenclip:`) copies to the clipboard; we wait for a new clipboard image.
 */
const MAX_BYTES = 25 * 1024 * 1024;
let busy = false;

const fileName = () => {
    const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ').replace(/:/g, '.');
    return `Screenshot ${stamp}.png`;
};

const openCaptureWith = (bytes: Buffer) => {
    if (!bytes.length || bytes.length > MAX_BYTES) return;
    showCapture('', [{ name: fileName(), type: 'image/png', bytes: new Uint8Array(bytes) }]);
};

const captureMac = () => new Promise<void>((resolve) => {
    const target = path.join(app.getPath('temp'), `pf-screenshot-${Date.now()}.png`);
    execFile('/usr/sbin/screencapture', ['-i', '-x', target], () => {
        try {
            // Escape cancels the selection: no file.
            if (fs.existsSync(target)) openCaptureWith(fs.readFileSync(target));
        } finally {
            fs.rm(target, { force: true }, () => undefined);
            resolve();
        }
    });
});

/** PNG bytes of the clipboard image, or null (Electron 45: async ClipboardItem API). */
const clipboardPng = async (): Promise<Buffer | null> => {
    const items = await clipboard.read();
    for (const item of items) {
        if (!item.types.includes('image/png')) continue;
        const blob = await item.getType('image/png');
        if (blob instanceof Blob) return Buffer.from(await blob.arrayBuffer());
    }
    return null;
};

const captureWindows = async () => {
    const before = await clipboardPng().catch(() => null);
    await shell.openExternal('ms-screenclip:');
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const image = await clipboardPng().catch(() => null);
        if (image && !(before && image.equals(before))) {
            openCaptureWith(image);
            return;
        }
    }
};

export const captureScreenshotToTask = async () => {
    if (busy) return;
    busy = true;
    try {
        // Dev/QA: PF_DESKTOP_FAKE_SCREENSHOT=1 uses the app icon instead of a real selection.
        if (IS_DEV && process.env.PF_DESKTOP_FAKE_SCREENSHOT === '1') openCaptureWith(fs.readFileSync(path.join(__dirname, '..', 'assets', 'icon.png')));
        else if (process.platform === 'darwin') await captureMac();
        else if (process.platform === 'win32') await captureWindows();
    } catch (error) {
        console.warn('[desktop] screenshot failed', error);
    } finally {
        busy = false;
    }
};
