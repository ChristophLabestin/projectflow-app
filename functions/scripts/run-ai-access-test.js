// Runs scripts/ai-access-emulator-test.js against throw-away emulators (never production).
//
//   cd functions && npm run test:ai-access
//
// Own ports (Auth 9951, Firestore 8951, Functions 5951) so it does not collide with other emulator sessions.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const configPath = path.join(root, '.firebase.ai-access-test.json');

const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
config.emulators = {
    auth: { host: '127.0.0.1', port: 9951 },
    firestore: { host: '127.0.0.1', port: 8951 },
    functions: { host: '127.0.0.1', port: 5951 },
    ui: { enabled: false },
    hub: { port: 9961 },
    logging: { port: 9962 },
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
        'node functions/scripts/ai-access-emulator-test.js'
    ],
    { cwd: root, stdio: 'inherit' }
);

fs.rmSync(configPath, { force: true });
process.exit(result.status ?? 1);
