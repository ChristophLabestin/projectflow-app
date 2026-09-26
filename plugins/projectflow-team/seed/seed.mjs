#!/usr/bin/env node
/**
 * ProjectFlow Team Seed
 * ---------------------
 * Legt 9 AI-Mitarbeiter als echte Workspace-Mitglieder an und bespielt einen
 * gelebten Backlog. Idempotent: Re-Runs aktualisieren statt zu duplizieren.
 *
 * Schritte pro Agent:
 *   1) Firebase-Auth-User (per E-Mail) sicherstellen
 *   2) /users/{uid} Profil (displayName, Avatar)
 *   3) (optional) Custom-Rolle in /tenants/{t}/roles
 *   4) /tenants/{t}/members/{uid} Mitgliedschaft (+ roleIds)
 *   5) /tenants/{t}/api_tokens Token mit createdBy=<agent uid>  -> echte Urheberschaft
 * Danach: Backlog via HTTP-API mit dem jeweiligen Agenten-Token (Tasks + Kommentare).
 *
 * Sicherheit: Standardmaessig DRY-RUN. Schreiben nur mit --confirm-prod.
 *
 * Aufruf:
 *   node seed.mjs --service-account ./sa.json --tenant <TENANT_ID> --project <PROJECT_ID> [--confirm-prod]
 *   (oder GOOGLE_APPLICATION_CREDENTIALS statt --service-account)
 *
 * Flags:
 *   --confirm-prod      tatsaechlich schreiben (sonst Dry-Run)
 *   --service-account   Pfad zur Service-Account-JSON
 *   --tenant            Tenant-/Workspace-ID (Pflicht)
 *   --project           Ziel-Projekt-ID fuer den Backlog (Pflicht, ausser --skip-backlog)
 *   --api-base          Default: https://europe-west3-<projectId>.cloudfunctions.net/api
 *   --skip-backlog      nur Accounts/Tokens, keine Tasks
 *   --no-roles          keine Custom-Rollen anlegen
 *   --out               Pfad fuer tokens.json (Default: ../mcp/tokens.json)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

// firebase-admin wird nur im Schreibmodus (lazy) geladen, damit der Dry-Run
// ganz ohne installierte Dependencies laeuft.
let admin = null;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- arg parsing ----------
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { args[key] = next; i++; }
      else args[key] = true;
    } else args._.push(a);
  }
  return args;
}
const args = parseArgs(process.argv.slice(2));
const DRY = !args['confirm-prod'];
const WITH_ROLES = !args['no-roles'];
const SKIP_BACKLOG = !!args['skip-backlog'];

const tenantId = args.tenant || process.env.PF_TENANT_ID;
const projectId = args.project || process.env.PF_PROJECT_ID;
const saPath = args['service-account'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const outPath = resolve(__dirname, args.out || '../mcp/tokens.json');

// ---------- helpers ----------
const log = (...m) => console.log(...m);
const tag = DRY ? '[DRY-RUN]' : '[WRITE]';
function die(msg) { console.error('FEHLER:', msg); process.exit(1); }

const hashToken = (t) => createHash('sha256').update(t).digest('hex');
const generatePlainApiToken = () => `pfat_${randomBytes(32).toString('base64url')}`;
const avatarUrl = (style, seed) =>
  `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

// ---------- preflight ----------
if (!tenantId) die('--tenant <TENANT_ID> fehlt.');
if (!SKIP_BACKLOG && !projectId) die('--project <PROJECT_ID> fehlt (oder --skip-backlog).');
if (!saPath && !DRY) die('--service-account <pfad.json> fehlt (oder GOOGLE_APPLICATION_CREDENTIALS).');

const cfg = JSON.parse(readFileSync(resolve(__dirname, '../agents.config.json'), 'utf8'));
const backlog = SKIP_BACKLOG ? { tasks: [] }
  : JSON.parse(readFileSync(resolve(__dirname, 'backlog.seed.json'), 'utf8'));

let resolvedProjectId = null;
let apiBase = args['api-base'] || null;

// ---------- admin init ----------
let db = null, auth = null;
if (!DRY) {
  admin = (await import('firebase-admin')).default;
  const sa = JSON.parse(readFileSync(resolve(process.cwd(), saPath), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  db = admin.firestore();
  auth = admin.auth();
  resolvedProjectId = sa.project_id;
  if (!apiBase) apiBase = `https://europe-west3-${sa.project_id}.cloudfunctions.net/api`;
} else {
  if (!apiBase) apiBase = `https://europe-west3-<projectId>.cloudfunctions.net/api`;
}

log(`\n=== ProjectFlow Team Seed ${tag} ===`);
log(`Tenant:   ${tenantId}`);
log(`Projekt:  ${projectId || '(uebersprungen)'}`);
log(`API-Base: ${apiBase}`);
log(`Rollen:   ${WITH_ROLES ? 'ja' : 'nein'}  |  Backlog: ${SKIP_BACKLOG ? 'nein' : backlog.tasks.length + ' Tasks'}`);
log('');

// ---------- 1) accounts, profiles, roles, members, tokens ----------
const out = { apiBase, tenantId, projectId: projectId || null, generatedAt: new Date().toISOString(), agents: {} };

async function ensureCustomRole(role) {
  if (!WITH_ROLES) return null;
  if (DRY) { log(`  ${tag} Rolle "${role.name}" sicherstellen`); return `dry-role-${role.name}`; }
  const rolesRef = db.collection('tenants').doc(tenantId).collection('roles');
  const existing = await rolesRef.where('name', '==', role.name).limit(1).get();
  if (!existing.empty) return existing.docs[0].id;
  const ref = await rolesRef.add({
    name: role.name, color: role.color || '#888888', description: `${role.name} (AI agent role)`,
    position: 1, isSystem: false, systemKey: null,
    permissions: { allow: [], deny: [] },
    createdBy: tenantId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return ref.id;
}

for (const agent of cfg.agents) {
  const email = `${agent.key}@${cfg.emailDomain}`;
  const photoURL = avatarUrl(agent.avatarStyle || 'thumbs', agent.displayName);
  log(`Agent: ${agent.displayName} (${agent.function})  <${email}>`);

  let uid = `dry-uid-${agent.key}`;
  let plainToken = `pfat_DRYRUN_${agent.key}`;
  let tokenId = `dry-token-${agent.key}`;

  if (!DRY) {
    // 1) auth user
    try {
      const u = await auth.getUserByEmail(email);
      uid = u.uid;
      await auth.updateUser(uid, { displayName: agent.displayName, photoURL });
    } catch (e) {
      const u = await auth.createUser({
        email, emailVerified: true, displayName: agent.displayName, photoURL,
        password: randomBytes(24).toString('base64url'), disabled: false
      });
      uid = u.uid;
    }
    // 2) /users/{uid}
    await db.collection('users').doc(uid).set({
      uid, email, displayName: agent.displayName, photoURL,
      aiUsage: { tokensUsed: 0, tokenLimit: 0 },
      isAgent: true, agentKey: agent.key, agentFunction: agent.function,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 3) role + 4) membership
    const roleId = await ensureCustomRole(agent.customRole);
    await db.collection('tenants').doc(tenantId).collection('members').doc(uid).set({
      uid, role: agent.role || 'Member',
      roleIds: roleId ? [roleId] : [],
      groupIds: [],
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 5) api token (createdBy = agent uid => echte Urheberschaft; name = displayName => Label)
    plainToken = generatePlainApiToken();
    const tokenRef = await db.collection('tenants').doc(tenantId).collection('api_tokens').add({
      tenantId, name: agent.displayName, tokenHash: hashToken(plainToken),
      tokenPrefix: plainToken.substring(0, 12),
      projectScope: null, permissions: agent.permissions,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsedAt: null, expiresAt: null,
      createdBy: uid, agentKey: agent.key
    });
    tokenId = tokenRef.id;
    log(`  ${tag} uid=${uid}  token=${plainToken.substring(0, 12)}…  perms=[${agent.permissions.join(', ')}]`);
  } else {
    log(`  ${tag} wuerde anlegen: auth-user, /users/${uid}, member, api_token (createdBy=uid, name="${agent.displayName}")`);
  }

  out.agents[agent.key] = {
    uid, displayName: agent.displayName, shortName: agent.shortName,
    function: agent.function, email, token: plainToken, tokenId, photoURL
  };
}

// ---------- write tokens.json (MCP config) ----------
if (DRY) {
  log(`\n${tag} wuerde tokens.json schreiben -> ${outPath}`);
} else {
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  log(`\ntokens.json geschrieben -> ${outPath}`);
}

// ---------- 2) backlog via HTTP API (per-agent token) ----------
async function apiFetch(token, method, path, body) {
  const url = `${apiBase}/projectflow${path}`;
  if (DRY) { log(`  ${tag} ${method} ${url}  ${body ? JSON.stringify(body) : ''}`); return { dry: true }; }
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

if (!SKIP_BACKLOG) {
  log(`\n=== Backlog (${backlog.tasks.length} Tasks) ${tag} ===`);
  const today = new Date();
  const isoFromOffset = (days) => {
    if (days === undefined || days === null) return '';
    const d = new Date(today); d.setDate(d.getDate() + Number(days));
    return d.toISOString().slice(0, 10);
  };
  const uidOf = (key) => out.agents[key]?.uid;
  const tokenOf = (key) => out.agents[key]?.token;

  for (const t of backlog.tasks) {
    const authorToken = tokenOf(t.by);
    if (!authorToken) { log(`  ! Ueberspringe "${t.title}" – unbekannter Autor ${t.by}`); continue; }
    const assigneeIds = (t.assignTo || []).map(uidOf).filter(Boolean);
    const taskBody = {
      externalKey: t.externalKey,
      title: t.title,
      description: t.description || '',
      status: t.status || 'Open',
      priority: t.priority || 'Medium',
      dueDate: isoFromOffset(t.dueInDays),
      assigneeIds,
      assigneeId: assigneeIds[0] || null,
      source: 'team_seed'
    };
    log(`- "${t.title}"  von ${t.by} -> [${(t.assignTo || []).join(', ') || '–'}] (${t.status})`);
    let taskId = `dry-task-${t.externalKey}`;
    try {
      const r = await apiFetch(authorToken, 'POST', `/projects/${projectId}/tasks/upsert-by-external-key`, taskBody);
      if (!DRY) taskId = r?.task?.id || taskId;
    } catch (e) { log(`  ! Task-Fehler: ${e.message}`); continue; }

    for (const c of (t.comments || [])) {
      const ctoken = tokenOf(c.by);
      if (!ctoken) { log(`    ! Kommentar uebersprungen – unbekannt ${c.by}`); continue; }
      const body = { content: c.content, targetId: taskId, targetType: 'task' };
      try { await apiFetch(ctoken, 'POST', `/projects/${projectId}/comments`, body); log(`    • Kommentar von ${c.by}`); }
      catch (e) { log(`    ! Kommentar-Fehler (${c.by}): ${e.message}`); }
    }
  }
}

log(`\n=== Fertig ${tag} ===`);
if (DRY) log('Nichts geschrieben. Mit --confirm-prod erneut ausfuehren, um die Aktionen wirklich auszufuehren.');
process.exit(0);
