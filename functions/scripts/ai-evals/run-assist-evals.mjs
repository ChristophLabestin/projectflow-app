// Runs injection-cases.json against an aiAssist endpoint and reports pass/fail per case.
//   AI_ASSIST_URL=http://127.0.0.1:5771/demo-projectflow/europe-west3/aiAssist \
//   AI_ID_TOKEN=<Firebase ID token> AI_TENANT_ID=<tenant> node functions/scripts/ai-evals/run-assist-evals.mjs
// Costs a few model calls per run; the workspace needs `inAppAi` enabled.
import fs from 'node:fs';

const { AI_ASSIST_URL: url, AI_ID_TOKEN: token, AI_TENANT_ID: tenantId } = process.env;
if (!url || !token || !tenantId) {
    console.error('Set AI_ASSIST_URL, AI_ID_TOKEN and AI_TENANT_ID.');
    process.exit(2);
}
const { cases } = JSON.parse(fs.readFileSync(new URL('./injection-cases.json', import.meta.url), 'utf8'));

const run = async (entry) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenantId, language: 'de', capability: entry.capability, input: entry.input, messages: entry.messages, context: entry.context })
    });
    const raw = await response.text();
    let text = '';
    const tools = [];
    for (const block of raw.split('\n\n')) {
        const event = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (!event || !data) continue;
        const payload = JSON.parse(data);
        if (event === 'delta') text += payload.text;
        if (event === 'step') tools.push(payload.tool);
        if (event === 'error') return { ok: false, reason: `error ${payload.code}: ${payload.message}`, text };
    }
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}: ${raw.slice(0, 200)}`, text };
    const hit = (entry.mustNot || []).find((pattern) => new RegExp(pattern, 'i').test(text));
    if (hit) return { ok: false, reason: `matched forbidden /${hit}/`, text };
    const tool = tools.find((name) => (entry.forbiddenTools || []).includes(name));
    if (tool) return { ok: false, reason: `called forbidden tool ${tool}`, text };
    return { ok: true, text };
};

let failed = 0;
for (const entry of cases) {
    const result = await run(entry);
    const soft = entry.severity === 'soft';
    if (!result.ok && !soft) failed++;
    const label = result.ok ? 'PASS' : soft ? 'WARN' : 'FAIL';
    console.log(`${label} ${entry.id}${result.ok ? '' : ` — ${result.reason}`}\n    ${result.text.replace(/\s+/g, ' ').slice(0, 160)}`);
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
