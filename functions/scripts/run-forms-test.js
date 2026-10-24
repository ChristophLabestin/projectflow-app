// Runs scripts/forms-e2e-test.js (Forms: callables + public HTTP endpoints) against throw-away emulators.
//
//   cd functions && npm run test:forms
//
// The emulator config is derived from the repo's firebase.json (same rules, indexes, functions source)
// with its own ports, so it does not collide with other emulator sessions:
// Auth 9955, Firestore 8955, Functions 5955, Storage 9956. The generated file lives in the repo root
// (the Firebase CLI only accepts config paths inside the project directory; git-ignored).
// FORMS_MIN_SESSION_MS lowers the 3 s minimum session age; only the emulator honors it.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, '.firebase.forms-test.json');

const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
config.emulators = {
    auth: { host: '127.0.0.1', port: 9955 },
    firestore: { host: '127.0.0.1', port: 8955 },
    functions: { host: '127.0.0.1', port: 5955 },
    storage: { host: '127.0.0.1', port: 9956 },
    ui: { enabled: false },
    hub: { port: 9957 },
    logging: { port: 9958 },
    singleProjectMode: true
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

const result = spawnSync(
    'firebase',
    [
        'emulators:exec',
        '--only', 'auth,firestore,functions,storage',
        '--project', 'demo-projectflow',
        '--config', configPath,
        'node functions/scripts/forms-e2e-test.js'
    ],
    { cwd: root, stdio: 'inherit', env: { ...process.env, FORMS_MIN_SESSION_MS: '1500' } }
);

fs.rmSync(configPath, { force: true });
process.exit(result.status === null ? 1 : result.status);
