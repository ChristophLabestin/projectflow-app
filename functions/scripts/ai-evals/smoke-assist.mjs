// Local smoke + latency check for aiAssist against the emulators (seeded demo workspace).
// Run from the repo root (fetches the real OPENAI_API_KEY from Secret Manager, writes only to emulators):
//   firebase emulators:exec --only auth,firestore,functions --project projectflow-labestin \
//     "SEED_PROJECT_ID=projectflow-labestin node scripts/seed-emulator.mjs && node functions/scripts/ai-evals/smoke-assist.mjs"
// Prints time to first byte, first text and total per call. AI_EVALS=1 also runs injection-cases.json.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(new URL('../../package.json', import.meta.url));
const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'projectflow-labestin';
const TENANT = 'ws-demo-studio';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const URL_ = `http://127.0.0.1:${process.env.FUNCTIONS_PORT || 5001}/${PROJECT_ID}/europe-west3/aiAssist`;

admin.initializeApp({ projectId: PROJECT_ID });
await admin.firestore().doc(`tenants/${TENANT}/ai_config/policy`).set({ inAppAi: true }, { merge: true });

const login = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@projectflow.test', password: 'projectflow-demo', returnSecureToken: true })
}).then((r) => r.json());
const token = login.idToken;
if (!token) throw new Error(`Login failed: ${JSON.stringify(login)}`);

const project = (await admin.firestore().collection(`tenants/${TENANT}/projects`).limit(1).get()).docs[0];
const task = project ? (await project.ref.collection('tasks').limit(1).get()).docs[0] : null;

const call = async (label, body) => {
    const start = Date.now();
    const response = await fetch(URL_, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId: TENANT, language: 'de', ...body })
    });
    const ttfb = Date.now() - start;
    let firstText = 0; let text = ''; const events = [];
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, index); buffer = buffer.slice(index + 2);
            const event = /^event: (.+)$/m.exec(block)?.[1]; const data = /^data: (.+)$/m.exec(block)?.[1];
            if (!event || !data) continue;
            const payload = JSON.parse(data);
            if (event === 'delta') { if (!firstText) firstText = Date.now() - start; text += payload.text; } else events.push(`${event}:${JSON.stringify(payload)}`);
        }
    }
    if (!response.ok) events.push(`HTTP ${response.status} ${buffer}`);
    console.log(`\n== ${label}: ttfb ${ttfb}ms, first text ${firstText}ms, total ${Date.now() - start}ms\n${events.join('\n')}\n${text.slice(0, 500)}`);
};

await call('write/draft', { capability: 'write', input: { action: 'draft', field: 'description', itemTitle: 'Login nach Passwort-Reset schlägt in der iOS-App fehl', projectTitle: 'Mobile App v2' } });
await call('write/shorten', { capability: 'write', input: { action: 'shorten', field: 'comment', text: 'Ich habe mir das gestern Abend noch einmal ganz in Ruhe angeschaut und bin mir inzwischen ziemlich sicher, dass der Fehler im Token-Refresh nach dem Passwort-Reset liegt, weil die alte Session nicht sauber invalidiert wird.' } });
await call('assist/overdue', { capability: 'assist', context: { surface: 'dashboard', route: '/' }, messages: [{ role: 'user', content: 'Was ist bei mir überfällig und was sollte ich heute zuerst machen?' }] });
if (task) {
    await call('assist/task', { capability: 'assist', context: { surface: 'task', projectId: project.id, entity: { kind: 'task', id: task.id, projectId: project.id } }, messages: [{ role: 'user', content: 'Was ist hier los und was sind die nächsten Schritte?' }] });
}
const credits = await admin.firestore().doc(`tenants/${TENANT}/ai_credits/${new Date().toISOString().slice(0, 7)}`).get();
console.log('\ncredits doc:', JSON.stringify(credits.data()));

if (process.env.AI_EVALS === '1') {
    const result = spawnSync('node', [new URL('./run-assist-evals.mjs', import.meta.url).pathname], {
        stdio: 'inherit', env: { ...process.env, AI_ASSIST_URL: URL_, AI_ID_TOKEN: token, AI_TENANT_ID: TENANT }
    });
    process.exitCode = result.status ?? 1;
}
process.exit(process.exitCode || 0);
