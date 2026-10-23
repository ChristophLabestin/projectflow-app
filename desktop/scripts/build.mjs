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

// macOS helpers, built universal (arm64 + x86_64) so the universal app bundle can ship one binary each.
// Optional: without swiftc the meeting / Spotlight features stay off.
// pf-calendar: EventKit meetings (Contents/Resources/native). pf-spotlight: CoreSpotlight index (Contents/MacOS).
const NATIVE_HELPERS = [
    { source: 'native/calendar-events.swift', name: 'pf-calendar', feature: 'meeting awareness' },
    { source: 'native/spotlight-index.swift', name: 'pf-spotlight', feature: 'Spotlight search' }
];
if (process.platform === 'darwin') {
    for (const { source, name, feature } of NATIVE_HELPERS) {
        const target = `dist/native/${name}`;
        const stale = !fs.existsSync(target) || fs.statSync(target).mtimeMs < fs.statSync(source).mtimeMs;
        if (!stale) continue;
        try {
            fs.mkdirSync('dist/native', { recursive: true });
            const slices = ['arm64', 'x86_64'].map((arch) => {
                const out = `${target}-${arch}`;
                execFileSync('xcrun', ['swiftc', '-O', '-target', `${arch}-apple-macos13.0`, source, '-o', out], { stdio: 'inherit' });
                return out;
            });
            execFileSync('lipo', ['-create', ...slices, '-output', target]);
            slices.forEach((slice) => fs.rmSync(slice));
        } catch (error) {
            console.warn(`desktop: ${name} not built (swiftc missing?) — ${feature} disabled`, error.message);
        }
    }
}
