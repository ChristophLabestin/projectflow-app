#!/usr/bin/env node
/**
 * Per-Projekt-Agenten seeden.
 * - Je Projekt ein Product Manager; bei customer=true zusaetzlich Customer Service.
 * - Echte Accounts + Tokens (createdBy=uid => Urheberschaft), Custom-Rollen, Avatare.
 * - Feuerwehr-Projekt (projectFlowId 'CREATE') wird per Admin-SDK angelegt (Owner=Mensch).
 * - Agenten werden ihrem Projekt zugeordnet (members + memberIds).
 * - Neue Agenten werden in ../mcp/tokens.json gemergt (Bestand bleibt erhalten).
 *
 * DRY-RUN ist Standard. Schreiben nur mit --confirm-prod.
 *   node seed-project-agents.mjs --service-account ./sa.json --tenant <TENANT_ID> [--confirm-prod]
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
const die = (m) => { console.error('FEHLER:', m); process.exit(1); };
if (!tenantId) die('--tenant fehlt');
if (!saPath && !DRY) die('--service-account fehlt');

const hashToken = (t) => createHash('sha256').update(t).digest('hex');
const genToken = () => `pfat_${randomBytes(32).toString('base64url')}`;
const avatar = (seed) => `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(seed)}`;

const cfg = JSON.parse(readFileSync(resolve(__dirname, 'project-agents.config.json'), 'utf8'));

// Agentenliste aus Projekten ableiten
const agents = [];
for (const p of cfg.projects) {
  agents.push({ ...p.pm, type: 'pm', function: `Product Manager · ${p.name}`, projectKey: p.key,
    projectFlowId: p.projectFlowId, projectName: p.name, permissions: cfg.permissions.pm, customRole: cfg.customRoles.pm });
  if (p.customer && p.cs) {
    agents.push({ ...p.cs, type: 'cs', function: `Customer Service · ${p.name}`, projectKey: p.key,
      projectFlowId: p.projectFlowId, projectName: p.name, permissions: cfg.permissions.cs, customRole: cfg.customRoles.cs });
  }
}

let db = null, auth = null, FieldValue = null, ownerUid = tenantId, apiBase = args['api-base'] || null;

log(`\n=== Per-Projekt-Agenten ${tag} ===`);
log(`Tenant: ${tenantId}  |  Agenten: ${agents.length} (${agents.filter(a=>a.type==='pm').length} PM, ${agents.filter(a=>a.type==='cs').length} CS)\n`);

if (!DRY) {
  admin = (await import('firebase-admin')).default;
  const sa = JSON.parse(readFileSync(resolve(process.cwd(), saPath), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  db = admin.firestore(); auth = admin.auth(); FieldValue = admin.firestore.FieldValue;
  if (!apiBase) apiBase = `https://europe-west3-${sa.project_id}.cloudfunctions.net/api`;
  // Owner bestaetigen
  const ownerSnap = await db.collection('users').doc(tenantId).get();
  log(`Owner: ${tenantId}  (${ownerSnap.exists ? ownerSnap.data().email : 'kein /users-Doc – nutze tenantId als ownerId'})\n`);
}

// Custom-Rollen sicherstellen
const roleCache = {};
async function ensureRole(role) {
  if (DRY) return `dry-role-${role.name}`;
  if (roleCache[role.name]) return roleCache[role.name];
  const ref = db.collection('tenants').doc(tenantId).collection('roles');
  const ex = await ref.where('name', '==', role.name).limit(1).get();
  if (!ex.empty) { roleCache[role.name] = ex.docs[0].id; return ex.docs[0].id; }
  const created = await ref.add({ name: role.name, color: role.color, description: `${role.name} (AI agent role)`,
    position: 1, isSystem: false, systemKey: null, permissions: { allow: [], deny: [] },
    createdBy: tenantId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  roleCache[role.name] = created.id; return created.id;
}

// Feuerwehr-Projekt anlegen (falls CREATE) und projectFlowId aufloesen
const resolvedProjectId = {};
for (const p of cfg.projects) {
  if (p.projectFlowId !== 'CREATE') {
    if (!DRY) {
      const snap = await db.collection('tenants').doc(tenantId).collection('projects').doc(p.projectFlowId).get();
      log(`Projekt ${p.name}: ${snap.exists ? 'gefunden ("' + (snap.data().title||'') + '")' : '!! NICHT GEFUNDEN ' + p.projectFlowId}`);
    } else log(`${tag} Projekt ${p.name}: ${p.projectFlowId}`);
    resolvedProjectId[p.key] = p.projectFlowId;
    continue;
  }
  // CREATE
  if (DRY) { log(`${tag} wuerde Projekt anlegen: "${p.name}" (Owner=${ownerUid})`); resolvedProjectId[p.key] = `dry-project-${p.key}`; continue; }
  const existing = await db.collection('tenants').doc(tenantId).collection('projects').where('title', '==', p.name).limit(1).get();
  if (!existing.empty) { resolvedProjectId[p.key] = existing.docs[0].id; log(`Projekt "${p.name}" existiert bereits: ${existing.docs[0].id}`); continue; }
  const ref = await db.collection('tenants').doc(tenantId).collection('projects').add({
    title: p.name, description: `Verwaltungs-App fuer ${p.name} (Kundenprojekt).`,
    status: 'Planning', projectState: 'not specified', priority: 'Medium',
    ownerId: ownerUid, tenantId, progress: 0, members: [ownerUid], memberIds: [ownerUid],
    modules: [], riskRegister: [], links: [], externalResources: [], isPrivate: false,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  });
  resolvedProjectId[p.key] = ref.id;
  log(`Projekt angelegt: "${p.name}" -> ${ref.id}`);
}

// tokens.json laden (merge)
let tokenStore = { apiBase, tenantId, projectId: 'ogZ8Pyz8pwEQtv8I64nu', agents: {} };
if (existsSync(tokensPath)) { try { tokenStore = JSON.parse(readFileSync(tokensPath, 'utf8')); } catch {} }
tokenStore.agents = tokenStore.agents || {};
if (apiBase) tokenStore.apiBase = tokenStore.apiBase || apiBase;

// Agenten anlegen
log('');
for (const a of agents) {
  const email = `${a.key}@${cfg.emailDomain}`;
  const photoURL = avatar(a.displayName);
  const pid = resolvedProjectId[a.projectKey];
  log(`${a.type.toUpperCase()} ${a.displayName} — ${a.function}  <${email}>  -> Projekt ${a.projectName} (${pid})`);
  let uid = `dry-uid-${a.key}`, token = `pfat_DRY_${a.key}`, tokenId = `dry-${a.key}`;
  if (!DRY) {
    try { const u = await auth.getUserByEmail(email); uid = u.uid; await auth.updateUser(uid, { displayName: a.displayName, photoURL }); }
    catch { const u = await auth.createUser({ email, emailVerified: true, displayName: a.displayName, photoURL, password: randomBytes(24).toString('base64url') }); uid = u.uid; }
    await db.collection('users').doc(uid).set({ uid, email, displayName: a.displayName, photoURL,
      aiUsage: { tokensUsed: 0, tokenLimit: 0 }, isAgent: true, agentKey: a.key, agentFunction: a.function,
      agentProject: a.projectName, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
    const roleId = await ensureRole(a.customRole);
    await db.collection('tenants').doc(tenantId).collection('members').doc(uid).set({
      uid, role: 'Member', roleIds: roleId ? [roleId] : [], groupIds: [], joinedAt: FieldValue.serverTimestamp() }, { merge: true });
    token = genToken();
    const tref = await db.collection('tenants').doc(tenantId).collection('api_tokens').add({
      tenantId, name: a.displayName, tokenHash: hashToken(token), tokenPrefix: token.substring(0,12),
      projectScope: null, permissions: a.permissions, createdAt: FieldValue.serverTimestamp(),
      lastUsedAt: null, expiresAt: null, createdBy: uid, agentKey: a.key });
    tokenId = tref.id;
    // Projekt-Zuordnung
    if (pid && !String(pid).startsWith('dry-')) {
      await db.collection('tenants').doc(tenantId).collection('projects').doc(pid).update({
        members: FieldValue.arrayUnion(uid), memberIds: FieldValue.arrayUnion(uid) });
    }
    log(`  ${tag} uid=${uid}  token=${token.substring(0,12)}…  zugeordnet -> ${a.projectName}`);
  } else {
    log(`  ${tag} wuerde anlegen + Projekt ${a.projectName} zuordnen`);
  }
  tokenStore.agents[a.key] = { uid, displayName: a.displayName, shortName: a.displayName.split(' ')[0],
    function: a.function, email, token, tokenId, photoURL, projectId: pid, projectName: a.projectName };
}

if (!DRY) { writeFileSync(tokensPath, JSON.stringify(tokenStore, null, 2)); log(`\ntokens.json gemergt -> ${tokensPath}  (Agenten gesamt: ${Object.keys(tokenStore.agents).length})`); }
else log(`\n${tag} wuerde tokens.json mergen (Agenten gesamt danach: ${Object.keys(tokenStore.agents).length})`);

log(`\n=== Fertig ${tag} ===`);
if (DRY) log('Nichts geschrieben. Mit --confirm-prod erneut ausfuehren.');
process.exit(0);
