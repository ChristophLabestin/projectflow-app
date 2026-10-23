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

    // ---------------------------------------------------------------------
    // OAuth 2.1 (DCR + PKCE + consent) and personal access tokens
    // ---------------------------------------------------------------------
    const AUTH = 'http://127.0.0.1:9951';
    const signUp = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'oauth-user@example.com', password: 'test-password-1', returnSecureToken: true })
    }).then((r) => r.json());
    const uid = signUp.localId;
    const idToken = signUp.idToken;
    await db.doc(`tenants/${T}/members/${uid}`).set({ uid, role: 'Member' });
    await db.doc(`tenants/${OFF}/members/${uid}`).set({ uid, role: 'Member' });
    const callable = async (name, data) => {
        const res = await fetch(`${BASE}/${name}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ data })
        });
        const body = await res.json().catch(() => null);
        return { status: res.status, result: body?.result, error: body?.error };
    };

    const unauth = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const challenge = unauth.headers.get('www-authenticate') || '';
    check('401 without token carries resource_metadata', unauth.status === 401 && /resource_metadata="[^"]+oauth-protected-resource"/.test(challenge), challenge.slice(0, 120));
    const prm = await fetch(`${BASE}/mcp/.well-known/oauth-protected-resource`).then((r) => r.json());
    check('protected resource metadata', prm.resource === `${BASE}/mcp` && prm.authorization_servers?.[0] === `${BASE}/oauth`, JSON.stringify(prm).slice(0, 120));
    const asMeta = await fetch(`${BASE}/oauth/.well-known/oauth-authorization-server`).then((r) => r.json());
    check('authorization server metadata (S256, CIMD, DCR)', asMeta.issuer === `${BASE}/oauth` && asMeta.code_challenge_methods_supported?.includes('S256') &&
        asMeta.client_id_metadata_document_supported === true && !!asMeta.registration_endpoint);

    const REDIRECT = 'http://127.0.0.1:43123/callback';
    const reg = await fetch(`${BASE}/oauth/oauth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'Test CLI', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' })
    });
    const client = await reg.json();
    check('dynamic client registration', reg.status === 201 && /^pfc_/.test(client.client_id || ''), `status=${reg.status}`);
    const badReg = await fetch(`${BASE}/oauth/oauth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['javascript:alert(1)'] })
    });
    check('registration rejects script redirect', badReg.status === 400);

    const verifier = crypto.randomBytes(32).toString('base64url');
    const challengeS256 = crypto.createHash('sha256').update(verifier).digest('base64url');
    const authorizeUrl = (extra = {}) => `${BASE}/oauth/oauth/authorize?${new URLSearchParams({
        response_type: 'code', client_id: client.client_id, redirect_uri: 'http://127.0.0.1:50000/callback',
        code_challenge: challengeS256, code_challenge_method: 'S256', state: 'xyz',
        scope: 'projects:read tasks:read tasks:write tasks:delete', resource: `${BASE}/mcp`, ...extra
    })}`;
    const noPkce = await fetch(authorizeUrl({ code_challenge_method: 'plain' }), { redirect: 'manual' });
    check('authorize without S256 is refused', noPkce.status === 302 && /error=invalid_request/.test(noPkce.headers.get('location') || ''));
    const badRedirect = await fetch(authorizeUrl({ redirect_uri: 'https://evil.example/cb' }), { redirect: 'manual' });
    check('authorize with unregistered redirect shows an error page (no redirect)', badRedirect.status === 400);
    const authorize = await fetch(authorizeUrl(), { redirect: 'manual' });
    const consentLocation = authorize.headers.get('location') || '';
    const requestId = new URL(consentLocation, 'http://x').searchParams.get('request');
    check('authorize redirects to consent (loopback port may differ)', authorize.status === 302 && consentLocation.includes('/oauth/consent?request=') && !!requestId, consentLocation);

    const consent = await callable('getOAuthConsentRequest', { requestId });
    const wsOn = consent.result?.workspaces?.find((w) => w.tenantId === T);
    const wsOff = consent.result?.workspaces?.find((w) => w.tenantId === OFF);
    check('consent lists workspaces with policy state', wsOn?.allowed === true && wsOff?.allowed === false && wsOff?.reason === 'disabled' && consent.result?.client?.verified === false,
        JSON.stringify(consent.result || consent.error).slice(0, 160));
    const approveOff = await callable('approveOAuthConsent', { requestId, tenantId: OFF, scopes: ['tasks:read'] });
    check('consent refuses a workspace with AI off', approveOff.status !== 200);
    const approve = await callable('approveOAuthConsent', { requestId, tenantId: T, scopes: ['projects:read', 'tasks:read', 'tasks:write', 'tasks:delete'] });
    const back = new URL(approve.result?.redirectUrl || 'http://x/');
    const code = back.searchParams.get('code');
    check('consent returns code + state + iss to the client', !!code && back.searchParams.get('state') === 'xyz' && back.searchParams.get('iss') === `${BASE}/oauth`, back.toString().slice(0, 100));

    const tokenRequest = (params) => fetch(`${BASE}/oauth/oauth/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString()
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
    const badVerifier = await tokenRequest({ grant_type: 'authorization_code', code, client_id: client.client_id, redirect_uri: 'http://127.0.0.1:50000/callback', code_verifier: 'x'.repeat(43) });
    check('token: wrong PKCE verifier fails', badVerifier.status === 400 && badVerifier.body.error === 'invalid_grant');
    // The failed attempt consumed the code (single use): run the flow again for a fresh one.
    const authorize2 = await fetch(authorizeUrl(), { redirect: 'manual' });
    const requestId2 = new URL(authorize2.headers.get('location') || '', 'http://x').searchParams.get('request');
    const approve2 = await callable('approveOAuthConsent', { requestId: requestId2, tenantId: T, scopes: ['projects:read', 'tasks:read', 'tasks:write', 'tasks:delete'] });
    const code2 = new URL(approve2.result?.redirectUrl || 'http://x/').searchParams.get('code');
    const issued = await tokenRequest({ grant_type: 'authorization_code', code: code2, client_id: client.client_id, redirect_uri: 'http://127.0.0.1:50000/callback', code_verifier: verifier, resource: `${BASE}/mcp` });
    check('token: code + PKCE → access + refresh', issued.status === 200 && /^pfo_/.test(issued.body.access_token || '') && /^pfr_/.test(issued.body.refresh_token || '') &&
        !issued.body.scope.includes('tasks:delete'), JSON.stringify(issued.body).slice(0, 140));
    const access = issued.body.access_token;

    const oauthTools = await mcp(access, 'tools/list');
    const oauthToolNames = (oauthTools.body?.result?.tools || []).map((t) => t.name);
    check('mcp accepts OAuth token; delete tools hidden (policy)', oauthTools.status === 200 && oauthToolNames.includes('create_task') && !oauthToolNames.includes('delete_task'), `status=${oauthTools.status}`);
    const oauthWrite = await api(access, 'POST', '/projects/p1/tasks', { title: 'Created via OAuth' });
    check('OAuth token writes as the user', oauthWrite.status < 300, `status=${oauthWrite.status}`);
    const oauthAudit = (await db.collection(`tenants/${T}/ai_audit`).where('kind', '==', 'oauth').get()).docs[0]?.data();
    check('OAuth write audited with user + client', oauthAudit?.actorId === uid && oauthAudit?.clientName === 'Test CLI', JSON.stringify(oauthAudit || {}).slice(0, 120));
    const connections = await callable('listAiConnections', { tenantId: T });
    check('connection is listed for the user', connections.result?.connections?.some((c) => c.kind === 'oauth' && c.clientName === 'Test CLI'));

    const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: issued.body.refresh_token, client_id: client.client_id });
    check('refresh rotates tokens', refreshed.status === 200 && refreshed.body.refresh_token !== issued.body.refresh_token);
    const reuse = await tokenRequest({ grant_type: 'refresh_token', refresh_token: issued.body.refresh_token, client_id: client.client_id });
    check('refresh token reuse is rejected', reuse.status === 400 && reuse.body.error === 'invalid_grant');
    const afterReuse = await mcp(refreshed.body.access_token, 'tools/list');
    check('reuse revokes the whole connection', afterReuse.status === 401, `status=${afterReuse.status}`);

    const pat = await callable('createPersonalAccessToken', { tenantId: T, name: 'CI', scopes: ['projects:read', 'tasks:read'], expiresInDays: 30 });
    check('personal access token created', /^pfp_/.test(pat.result?.token || ''), JSON.stringify(pat.error || {}).slice(0, 100));
    const patRead = await api(pat.result.token, 'GET', '/projects');
    const patWrite = await api(pat.result.token, 'POST', '/projects/p1/tasks', { title: 'nope' });
    check('PAT reads, cannot write beyond its scopes', patRead.status === 200 && patWrite.status === 403, `read=${patRead.status} write=${patWrite.status}`);
    const revoke = await callable('revokeAiConnection', { grantId: pat.result.id });
    const patAfter = await api(pat.result.token, 'GET', '/projects');
    check('revoking a connection kills its token', revoke.result?.success === true && patAfter.status === 401, `status=${patAfter.status}`);

    await db.doc(`tenants/${T}/members/${uid}`).delete();
    const pat2 = await callable('createPersonalAccessToken', { tenantId: T, name: 'x', scopes: ['tasks:read'], expiresInDays: 1 });
    check('non-member cannot create a token', pat2.status !== 200);

    console.log(failures ? `${failures} AI access checks failed.` : 'All AI access checks passed.');
    process.exit(failures ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
