// Runs scripts/automations-emulator-test.js (Flows) against throw-away emulators (never production).
//
//   cd functions && npm run test:automations
//
// The emulator config is derived from the repo's firebase.json (same rules, indexes and functions
// source) with its own ports, so it does not collide with other emulator sessions:
// Auth 9831, Firestore 8831, Functions 5831. The generated file lives in the repo root because the
// Firebase CLI only accepts config paths inside the project directory (git-ignored).
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, '.firebase.automations-test.json');

const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
config.emulators = {
    auth: { host: '127.0.0.1', port: 9831 },
    firestore: { host: '127.0.0.1', port: 8831 },
    functions: { host: '127.0.0.1', port: 5831 },
    ui: { enabled: false },
    hub: { port: 9832 },
    logging: { port: 9833 },
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
        'node functions/scripts/automations-emulator-test.js'
    ],
    { cwd: root, stdio: 'inherit' }
);

fs.rmSync(configPath, { force: true });
process.exit(result.status === null ? 1 : result.status);
