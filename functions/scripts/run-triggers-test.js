// Runs scripts/triggers-emulator-test.js against throw-away emulators (never production).
//
//   cd functions && npm run test:triggers
//
// The emulator config is derived from the repo's firebase.json (same rules, indexes and functions
// source) with its own ports, so it does not collide with other emulator sessions:
// Auth 9731, Firestore 8731, Functions 5731. The generated file lives in the repo root because the
// Firebase CLI only accepts config paths inside the project directory (git-ignored).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, '.firebase.triggers-test.json');

const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
config.emulators = {
    auth: { host: '127.0.0.1', port: 9731 },
    firestore: { host: '127.0.0.1', port: 8731 },
    functions: { host: '127.0.0.1', port: 5731 },
    ui: { enabled: false },
    hub: { port: 9741 },
    logging: { port: 9742 },
    singleProjectMode: true
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

const result = spawnSync(
    'firebase',
    [
        'emulators:exec',
        '--only', 'auth,firestore,functions',
        '--project', 'demo-projectflow',
        '--config', configPath,
        'node functions/scripts/triggers-emulator-test.js'
    ],
    { cwd: root, stdio: 'inherit' }
);

fs.rmSync(configPath, { force: true });
process.exit(result.status === null ? 1 : result.status);
