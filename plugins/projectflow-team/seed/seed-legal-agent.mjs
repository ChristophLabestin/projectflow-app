#!/usr/bin/env node
/**
 * Legt den Legal/Datenschutz-Agenten "Lara Wolf" als Workspace-Mitglied an
 * (nicht projektgebunden – prüft Projekte/Repos auf Anfrage) und mergt ihn in tokens.json.
 * Idempotent: existiert in tokens.json bereits ein Token für 'legal', wird kein neues erstellt.
 *
 * DRY-RUN Standard. Schreiben mit --confirm-prod.
 *   node seed-legal-agent.mjs --service-account ./sa.json --tenant <TENANT_ID> [--confirm-prod]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let admin = null;
const __dirname = dirname(fileURLToPath(import.meta.url));
function parseArgs(a){const o={_:[]};for(let i=0;i<a.length;i++){const x=a[i];if(x.startsWith('--')){const k=x.slice(2);const n=a[i+1];if(n&&!n.startsWith('--')){o[k]=n;i++;}else o[k]=true;}else o._.push(x);}return o;}
const args = parseArgs(process.argv.slice(2));
const DRY = !args['confirm-prod'];
const tag = DRY ? '[DRY-RUN]' : '[WRITE]';
const tenantId = args.tenant || process.env.PF_TENANT_ID;
const saPath = args['service-account'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const tokensPath = resolve(__dirname, '../mcp/tokens.json');
const log = (...m) => console.log(...m);
if (!tenantId) { console.error('FEHLER: --tenant fehlt'); process.exit(1); }
if (!saPath && !DRY) { console.error('FEHLER: --service-account fehlt'); process.exit(1); }

const hashToken = (t) => createHash('sha256').update(t).digest('hex');
const genToken = () => `pfat_${randomBytes(32).toString('base64url')}`;
const avatar = (s) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(s)}`;

const AGENT = {
  key: 'legal',
  displayName: 'Lara Wolf',
  function: 'Legal & Data Protection',
  email: 'legal@agents.labestindigital.internal',
  customRole: { name: 'Legal', color: '#475569' },
  permissions: ['projects:read','projects:write','tasks:read','tasks:write','initiatives:read']
};

let tokenStore = { tenantId, agents: {} };
if (existsSync(tokensPath)) { try { tokenStore = JSON.parse(readFileSync(tokensPath, 'utf8')); } catch {} }
tokenStore.agents = tokenStore.agents || {};
const already = tokenStore.agents[AGENT.key]?.token && !String(tokenStore.agents[AGENT.key].token).startsWith('pfat_DRY');

log(`\n=== Legal-Agent ${tag} ===`);
log(`${AGENT.displayName} — ${AGENT.function}  <${AGENT.email}>`);
log(already ? 'Hinweis: Token existiert bereits in tokens.json → kein neues Token.' : '');

let db, auth, FieldValue, apiBase = args['api-base'] || tokenStore.apiBase || null;
if (!DRY) {
  admin = (await import('firebase-admin')).default;
  const sa = JSON.parse(readFileSync(resolve(process.cwd(), saPath), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  db = admin.firestore(); auth = admin.auth(); FieldValue = admin.firestore.FieldValue;
  if (!apiBase) apiBase = `https://europe-west3-${sa.project_id}.cloudfunctions.net/api`;
}

let uid = `dry-uid-legal`, token = tokenStore.agents[AGENT.key]?.token || `pfat_DRY_legal`, tokenId = 'dry-legal', photoURL = avatar(AGENT.displayName);

if (!DRY) {
  // auth user
  try { const u = await auth.getUserByEmail(AGENT.email); uid = u.uid; await auth.updateUser(uid, { displayName: AGENT.displayName, photoURL }); }
  catch { const u = await auth.createUser({ email: AGENT.email, emailVerified: true, displayName: AGENT.displayName, photoURL, password: randomBytes(24).toString('base64url') }); uid = u.uid; }
  // /users
  await db.collection('users').doc(uid).set({ uid, email: AGENT.email, displayName: AGENT.displayName, photoURL,
    aiUsage: { tokensUsed: 0, tokenLimit: 0 }, isAgent: true, agentKey: AGENT.key, agentFunction: AGENT.function,
    updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  // custom role
  let roleId = null;
  const rolesRef = db.collection('tenants').doc(tenantId).collection('roles');
  const ex = await rolesRef.where('name', '==', AGENT.customRole.name).limit(1).get();
  if (!ex.empty) roleId = ex.docs[0].id;
  else { const r = await rolesRef.add({ name: AGENT.customRole.name, color: AGENT.customRole.color, description: 'Legal (AI agent role)', position: 1, isSystem: false, systemKey: null, permissions: { allow: [], deny: [] }, createdBy: tenantId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); roleId = r.id; }
  // member
  await db.collection('tenants').doc(tenantId).collection('members').doc(uid).set({ uid, role: 'Member', roleIds: roleId ? [roleId] : [], groupIds: [], joinedAt: FieldValue.serverTimestamp() }, { merge: true });
  // token (nur wenn noch keins)
  if (!already) {
    token = genToken();
    const tref = await db.collection('tenants').doc(tenantId).collection('api_tokens').add({ tenantId, name: AGENT.displayName, tokenHash: hashToken(token), tokenPrefix: token.substring(0,12), projectScope: null, permissions: AGENT.permissions, createdAt: FieldValue.serverTimestamp(), lastUsedAt: null, expiresAt: null, createdBy: uid, agentKey: AGENT.key });
    tokenId = tref.id;
  } else { token = tokenStore.agents[AGENT.key].token; tokenId = tokenStore.agents[AGENT.key].tokenId; }
  log(`${tag} uid=${uid}  token=${token.substring(0,12)}…  perms=[${AGENT.permissions.join(', ')}]`);
} else {
  log(`${tag} wuerde anlegen: auth-user, /users, Rolle "Legal", member, api_token (createdBy=uid)`);
}

tokenStore.tenantId = tokenStore.tenantId || tenantId;
if (apiBase) tokenStore.apiBase = tokenStore.apiBase || apiBase;
tokenStore.agents[AGENT.key] = { uid, displayName: AGENT.displayName, shortName: 'Lara', function: AGENT.function, email: AGENT.email, token, tokenId, photoURL };

if (!DRY) { writeFileSync(tokensPath, JSON.stringify(tokenStore, null, 2)); log(`\ntokens.json gemergt -> ${tokensPath} (Agenten gesamt: ${Object.keys(tokenStore.agents).length})`); }
else log(`\n${tag} wuerde tokens.json mergen (Agenten gesamt danach: ${Object.keys(tokenStore.agents).length})`);
log(`\n=== Fertig ${tag} ===`);
process.exit(0);
