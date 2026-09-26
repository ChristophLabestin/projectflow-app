#!/usr/bin/env node
/**
 * ProjectFlow Team Teardown
 * -------------------------
 * Entfernt die geseedeten Agenten wieder: api_tokens (agentKey gesetzt),
 * Mitgliedschaften, /users-Docs und optional die Auth-User. Optional auch die
 * geseedeten Backlog-Tasks (per externalKey via API).
 *
 * Standard: DRY-RUN. Schreiben/Loeschen nur mit --confirm-prod.
 *
 * Aufruf:
 *   node teardown.mjs --service-account ./sa.json --tenant <TENANT_ID> [--project <PID>] [--confirm-prod]
 *
 * Flags:
 *   --confirm-prod     wirklich loeschen
 *   --delete-auth      auch die Firebase-Auth-User loeschen (sonst nur Firestore-Spuren)
 *   --delete-tasks     geseedete Tasks (externalKey aus backlog.seed.json) via API loeschen
 *   --api-base         Default aus Service-Account-Projekt abgeleitet
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

let admin = null; // lazy: nur im Loeschmodus geladen

const __dirname = dirname(fileURLToPath(import.meta.url));
function parseArgs(argv){const a={_:[]};for(let i=0;i<argv.length;i++){const x=argv[i];if(x.startsWith('--')){const k=x.slice(2);const n=argv[i+1];if(n&&!n.startsWith('--')){a[k]=n;i++;}else a[k]=true;}else a._.push(x);}return a;}
const args = parseArgs(process.argv.slice(2));
const DRY = !args['confirm-prod'];
const tag = DRY ? '[DRY-RUN]' : '[DELETE]';
const tenantId = args.tenant || process.env.PF_TENANT_ID;
const projectId = args.project || process.env.PF_PROJECT_ID;
const saPath = args['service-account'] || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const log = (...m) => console.log(...m);
if (!tenantId) { console.error('FEHLER: --tenant fehlt'); process.exit(1); }
if (!saPath && !DRY) { console.error('FEHLER: --service-account fehlt'); process.exit(1); }

const cfg = JSON.parse(readFileSync(resolve(__dirname, '../agents.config.json'), 'utf8'));
const backlog = JSON.parse(readFileSync(resolve(__dirname, 'backlog.seed.json'), 'utf8'));
const agentKeys = cfg.agents.map(a => a.key);
const agentEmails = cfg.agents.map(a => `${a.key}@${cfg.emailDomain}`);

let db=null, auth=null, apiBase=args['api-base']||null;
if (!DRY) {
  admin = (await import('firebase-admin')).default;
  const sa = JSON.parse(readFileSync(resolve(process.cwd(), saPath), 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  db = admin.firestore(); auth = admin.auth();
  if (!apiBase) apiBase = `https://europe-west3-${sa.project_id}.cloudfunctions.net/api`;
}

log(`\n=== Teardown ${tag} (Tenant ${tenantId}) ===\n`);

async function run() {
  // 1) api_tokens mit agentKey
  if (!DRY) {
    const toks = await db.collection('tenants').doc(tenantId).collection('api_tokens')
      .where('agentKey', 'in', agentKeys.slice(0, 10)).get();
    for (const d of toks.docs) { await d.ref.delete(); log(`  geloescht: api_token ${d.id} (${d.data().name})`); }
  } else log(`  ${tag} wuerde api_tokens mit agentKey löschen`);

  // 2) members + 3) /users + optional auth user
  for (const email of agentEmails) {
    if (DRY) { log(`  ${tag} wuerde member/users für ${email} entfernen${args['delete-auth']?' + auth-user':''}`); continue; }
    try {
      const u = await auth.getUserByEmail(email);
      await db.collection('tenants').doc(tenantId).collection('members').doc(u.uid).delete().catch(()=>{});
      await db.collection('users').doc(u.uid).delete().catch(()=>{});
      log(`  entfernt: member + /users/${u.uid} (${email})`);
      if (args['delete-auth']) { await auth.deleteUser(u.uid); log(`  geloescht: auth-user ${email}`); }
    } catch { log(`  (kein auth-user fuer ${email})`); }
  }

  // 4) optional seeded tasks via API
  if (args['delete-tasks']) {
    if (!projectId) { log('  ! --delete-tasks braucht --project'); }
    else {
      log(`  ${tag} Tasks loeschen ist nur mit gueltigem Token moeglich – nutze die App oder das Seed-Owner-Token.`);
      log('  Hinweis: externalKeys: ' + backlog.tasks.map(t=>t.externalKey).join(', '));
    }
  }
}
run().then(()=>{ log(`\n=== Teardown fertig ${tag} ===`); if(DRY) log('Nichts geloescht. Mit --confirm-prod erneut ausfuehren.'); process.exit(0); })
     .catch(e=>{ console.error(e); process.exit(1); });
