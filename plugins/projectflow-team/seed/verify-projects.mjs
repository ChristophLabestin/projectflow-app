#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';
const sa = JSON.parse(readFileSync(resolve(process.cwd(), './sa.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();
const tenantId = process.argv[2];
const store = JSON.parse(readFileSync(resolve(process.cwd(), '../mcp/tokens.json'), 'utf8'));
const cfg = JSON.parse(readFileSync(resolve(process.cwd(), 'project-agents.config.json'), 'utf8'));

const uidName = {}; for (const a of Object.values(store.agents)) uidName[a.uid] = a.displayName;

console.log('Projekt-Zuordnung der Per-Projekt-Agenten:\n');
for (const a of Object.values(store.agents)) {
  if (!a.projectId) continue; // nur Per-Projekt-Agenten haben projectId
}
// Pro Projekt prüfen
const checked = new Set();
for (const p of cfg.projects) {
  const pid = (p.projectFlowId === 'CREATE')
    ? (Object.values(store.agents).find(a => a.projectName === p.name)?.projectId)
    : p.projectFlowId;
  if (!pid || checked.has(pid)) continue; checked.add(pid);
  const snap = await db.collection('tenants').doc(tenantId).collection('projects').doc(pid).get();
  if (!snap.exists) { console.log(`! Projekt ${p.name} (${pid}) fehlt`); continue; }
  const d = snap.data();
  const mids = d.memberIds || [];
  const agentsHere = Object.values(store.agents).filter(a => a.projectName === p.name);
  const present = agentsHere.filter(a => mids.includes(a.uid));
  console.log(`• ${d.title}  [${pid}]  owner=${uidName[d.ownerId] || (d.ownerId===tenantId?'Christoph (Owner)':d.ownerId)}`);
  for (const a of agentsHere) {
    console.log(`    ${mids.includes(a.uid) ? '✓' : '✗'} ${a.function}  (${a.displayName})`);
  }
}

// Mitgliederzahl gesamt
const members = await db.collection('tenants').doc(tenantId).collection('members').get();
const agentMembers = members.docs.filter(m => uidName[m.id]).length;
console.log(`\nWorkspace-Mitglieder gesamt: ${members.size}  |  davon AI-Agenten: ${agentMembers}`);
process.exit(0);
