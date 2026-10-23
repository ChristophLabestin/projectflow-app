// Bundles main + preload into dist/ (CommonJS). The sandboxed preload must be a single file.
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const watch = process.argv.includes('--watch');
const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    // electron-updater stays a real dependency (packaged in node_modules) instead of being bundled.
    external: ['electron', 'electron-updater'],
    sourcemap: 'inline',
    logLevel: 'warning'
};

await Promise.all([
    build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' }),
    build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js' })
]);
if (!watch) console.log('desktop: built dist/main.js + dist/preload.js');

// macOS calendar helper (EventKit), built universal (arm64 + x86_64) so the universal app bundle can ship one
// binary. Optional: without swiftc the meeting features stay off.
if (process.platform === 'darwin') {
    const source = 'native/calendar-events.swift';
    const target = 'dist/native/pf-calendar';
    const stale = !fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs;
    if (stale) {
        try {
            fs.mkdirSync('dist/native', { recursive: true });
            const slices = ['arm64', 'x86_64'].map((arch) => {
                const out = `dist/native/pf-calendar-${arch}`;
                execFileSync('xcrun', ['swiftc', '-O', '-target', `${arch}-apple-macos13.0`, source, '-o', out], { stdio: 'inherit' });
                return out;
            });
            execFileSync('lipo', ['-create', ...slices, '-output', target]);
            slices.forEach((slice) => fs.rmSync(slice));
        } catch (error) {
            console.warn('desktop: calendar helper not built (swiftc missing?) — meeting awareness disabled', error.message);
        }
    }
}
