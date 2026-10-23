// End-to-end check of the AI access model on `/api/projectflow` and `/mcp` (emulators only).
// Covers: creator membership, role ceiling, workspace AI policy, guest gate, audit log, annotations.
process.env.GCLOUD_PROJECT = 'demo-projectflow';
const crypto = require('node:crypto');
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-projectflow' });
const db = admin.firestore();

const BASE = 'http://127.0.0.1:5951/demo-projectflow/europe-west3';
const ALL = ['projects:read', 'projects:write', 'projects:delete', 'tasks:read', 'tasks:write', 'tasks:delete', 'initiatives:read', 'initiatives:write'];
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
let failures = 0;
const check = (label, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? `  — ${extra}` : ''}`);
    if (!ok) failures += 1;
};

const seedToken = async (tenantId, token, data) =>
    db.collection(`tenants/${tenantId}/api_tokens`).add({ tenantId, name: token, tokenHash: hash(token), tokenPrefix: token.slice(0, 12), projectScope: null, ...data });

const api = async (token, method, path, body) => {
    const res = await fetch(`${BASE}/api/projectflow${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
};

const mcp = async (token, method, params = {}) => {
    const res = await fetch(`${BASE}/mcp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    return { status: res.status, body: await res.json().catch(() => null) };
};

(async () => {
    const T = 'ws-ai';
    const OFF = 'ws-ai-off';
    await db.doc(`tenants/${T}`).set({ name: 'AI test' });
    await db.doc(`tenants/${T}/members/owner`).set({ uid: 'owner', role: 'Owner' });
    await db.doc(`tenants/${T}/members/member`).set({ uid: 'member', role: 'Member' });
    await db.doc(`tenants/${T}/members/guest`).set({ uid: 'guest', role: 'Guest' });
    await db.doc(`tenants/${T}/projects/p1`).set({ title: 'P1', memberIds: ['owner', 'guest'], createdAt: admin.firestore.Timestamp.now() });
    await db.doc(`tenants/${T}/projects/p2`).set({ title: 'P2', memberIds: ['owner'], createdAt: admin.firestore.Timestamp.now() });
    await seedToken(T, 'pfat_owner', { permissions: ALL, createdBy: 'owner' });
    await seedToken(T, 'pfat_member', { permissions: ALL, createdBy: 'member' });
    await seedToken(T, 'pfat_guest', { permissions: ALL, createdBy: 'guest' });
    await seedToken(T, 'pfat_orphan', { permissions: ALL });
    await seedToken(T, 'pfat_gone', { permissions: ALL, createdBy: 'left-the-workspace' });
    await db.doc(`tenants/${OFF}`).set({ name: 'AI off' });
    await db.doc(`tenants/${OFF}/members/owner`).set({ uid: 'owner', role: 'Owner' });
    await db.doc(`tenants/${OFF}/ai_config/policy`).set({ enabled: false });
    await seedToken(OFF, 'pfat_off', { permissions: ALL, createdBy: 'owner' });

    // Credential + membership
    const owner = await api('pfat_owner', 'GET', '/projects');
    check('owner token lists projects', owner.status === 200 && owner.body?.projects?.length === 2, `status=${owner.status}`);
    for (const [token, label] of [['pfat_guest', 'guest creator'], ['pfat_orphan', 'no creator'], ['pfat_gone', 'creator left']]) {
        const res = await api(token, 'GET', '/projects');
        check(`rejects token: ${label}`, res.status === 401, `status=${res.status} ${res.body?.error || ''}`);
    }

    // Role ceiling: member-created token cannot delete projects even with the scope
    const memberDelete = await api('pfat_member', 'DELETE', '/projects/p2');
    check('member token cannot delete a project (role ceiling)', memberDelete.status === 403, `status=${memberDelete.status}`);
    const p2 = await db.doc(`tenants/${T}/projects/p2`).get();
    check('project still exists', p2.exists);

    // Workspace AI policy
    const off = await api('pfat_off', 'GET', '/projects');
    check('policy enabled=false blocks /api', off.status === 403, `status=${off.status} ${off.body?.error || ''}`);
    const offMcp = await mcp('pfat_off', 'tools/list');
    check('policy enabled=false blocks /mcp', offMcp.status === 403, `status=${offMcp.status}`);

    // Audit log for writes
    const created = await api('pfat_owner', 'POST', '/projects/p1/tasks', { title: 'AI audit task' });
    check('owner token creates task', created.status < 300, `status=${created.status} ${created.body?.error || ''}`);
    const audit = await db.collection(`tenants/${T}/ai_audit`).get();
    const entry = audit.docs.map((d) => d.data()).find((e) => e.permission === 'tasks:write');
    check('write is audited', !!entry && entry.actorId === 'owner' && entry.status < 300 && !!entry.expireAt, JSON.stringify(entry || {}).slice(0, 120));
    check('reads are not audited', !audit.docs.some((d) => d.data().permission?.endsWith(':read')));

    // MCP: role in whoami, filtered + fully annotated tools
    const list = await mcp('pfat_owner', 'tools/list');
    const tools = list.body?.result?.tools || [];
    check('mcp tools/list', list.status === 200 && tools.length > 20, `status=${list.status} tools=${tools.length}`);
    check('all tools fully annotated', tools.every((t) => ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'].every((k) => typeof t.annotations?.[k] === 'boolean')));
    check('delete_task is destructive', tools.find((t) => t.name === 'delete_task')?.annotations?.destructiveHint === true);
    const who = await mcp('pfat_member', 'tools/call', { name: 'whoami', arguments: {} });
    const whoText = who.body?.result?.content?.[0]?.text || '';
    check('whoami reports role and drops projects:delete for members', /"role":\s*"Member"/.test(whoText) && !whoText.includes('projects:delete'), whoText.slice(0, 120));

    console.log(failures ? `${failures} AI access checks failed.` : 'All AI access checks passed.');
    process.exit(failures ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
