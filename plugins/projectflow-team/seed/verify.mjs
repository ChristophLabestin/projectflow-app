#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const sa = JSON.parse(readFileSync(resolve(process.cwd(), './sa.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const tenantId = process.argv[2];
const cfg = JSON.parse(readFileSync(resolve(process.cwd(), '../mcp/tokens.json'), 'utf8'));
const projectId = cfg.projectId;
const uidToName = {};
for (const [k, a] of Object.entries(cfg.agents)) uidToName[a.uid] = a.displayName;

// 1) Agent-Mitglieder
const members = await db.collection('tenants').doc(tenantId).collection('members').get();
const agentMembers = members.docs.filter(d => uidToName[d.id]);
console.log(`Mitglieder gesamt im Workspace: ${members.size}`);
console.log(`Davon AI-Agenten: ${agentMembers.length}/9`);
for (const m of agentMembers) console.log(`  - ${uidToName[m.id]}  (role=${m.data().role}, roleIds=${(m.data().roleIds||[]).length})`);

// 2) Geseedete Tasks: Urheber + Assignees
console.log('\nGeseedete Tasks (Urheber -> Assignees):');
const tasksRef = db.collection('tenants').doc(tenantId).collection('projects').doc(projectId).collection('tasks');
const seeded = await tasksRef.where('source', '==', 'team_seed').get();
console.log(`Tasks mit source=team_seed: ${seeded.size}`);
for (const t of seeded.docs) {
  const d = t.data();
  const author = uidToName[d.createdBy] || d.createdBy;
  const assignees = (d.assigneeIds||[]).map(u => uidToName[u] || u).join(', ') || '–';
  console.log(`  • "${(d.title||'').slice(0,46)}"  [${d.status}]  von ${author} -> ${assignees}`);
}

// 3) Kommentare gesamt am Projekt von Agenten
const comments = await db.collection('tenants').doc(tenantId).collection('projects').doc(projectId).collection('comments').get();
const agentComments = comments.docs.filter(c => uidToName[c.data().userId || c.data().createdBy]);
console.log(`\nKommentare von Agenten im Projekt: ${agentComments.length}`);
process.exit(0);
