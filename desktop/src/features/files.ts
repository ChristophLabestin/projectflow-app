import fs from 'node:fs';
import path from 'node:path';
import { PROTOCOL } from '../config';
import { sendCommand, showMainWindow } from '../windows/mainWindow';

/**
 * Files dropped onto the Dock icon (macOS `open-file`) or the app shortcut / "Open with" (Windows argv)
 * are attached to the current focus task by the web app (upload + comment with the links).
 */

const MAX_FILES = 5;
const MAX_BYTES = 25 * 1024 * 1024;

const MIME: Record<string, string> = {
    '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
    '.json': 'application/json', '.zip': 'application/zip', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg'
};

let pending: string[] = [];
let flushTimer: NodeJS.Timeout | null = null;

const flush = () => {
    flushTimer = null;
    const paths = [...new Set(pending)].slice(0, MAX_FILES);
    pending = [];
    const files = paths.flatMap((filePath) => {
        try {
            const stat = fs.statSync(filePath);
            if (!stat.isFile() || stat.size === 0 || stat.size > MAX_BYTES) return [];
            return [{
                name: path.basename(filePath),
                type: MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
                bytes: new Uint8Array(fs.readFileSync(filePath))
            }];
        } catch {
            return [];
        }
    });
    const skipped = paths.length - files.length;
    if (!files.length && !skipped) return;
    showMainWindow();
    sendCommand({ command: 'attach-files', data: { files, skipped } });
};

/** Collects files for a moment: a multi-file drop arrives as several `open-file` events. */
export const queueFilesForFocus = (filePaths: string[]) => {
    pending.push(...filePaths);
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 400);
};

/** Windows: files passed on the command line (drop on the shortcut, "Open with"). */
export const filesFromArgv = (argv: string[]) => argv.slice(1).filter((arg) => {
    if (arg.startsWith('-') || arg.startsWith(`${PROTOCOL}://`)) return false;
    try {
        return path.isAbsolute(arg) && fs.statSync(arg).isFile();
    } catch {
        return false;
    }
});
