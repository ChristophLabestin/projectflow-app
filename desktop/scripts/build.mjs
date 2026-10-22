// Bundles main + preload into dist/ (CommonJS). The sandboxed preload must be a single file.
import { build } from 'esbuild';

const watch = process.argv.includes('--watch');
const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
    sourcemap: 'inline',
    logLevel: 'warning'
};

await Promise.all([
    build({ ...common, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' }),
    build({ ...common, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js' })
]);
if (!watch) console.log('desktop: built dist/main.js + dist/preload.js');
