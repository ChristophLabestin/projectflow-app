#!/usr/bin/env node
// Findet den Tenant, der ein bestimmtes Projekt enthaelt, und listet Workspaces/Projekte.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import admin from 'firebase-admin';

const targetProject = process.argv[2] || null;
const sa = JSON.parse(readFileSync(resolve(process.cwd(), './sa.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
const db = admin.firestore();

const tenants = await db.collection('tenants').get();
console.log(`Tenants gesamt: ${tenants.size}\n`);
const rows = [];
for (const t of tenants.docs) {
  const data = t.data() || {};
  const members = await db.collection('tenants').doc(t.id).collection('members').get();
  const projects = await db.collection('tenants').doc(t.id).collection('projects').get();
  const hasTarget = targetProject ? projects.docs.some(p => p.id === targetProject) : false;
  rows.push({ tenantId: t.id, name: data.name || '(ohne Name)', members: members.size, projects: projects.size, hasTarget });
  if (hasTarget) {
    console.log(`>>> ZIEL-TENANT: ${t.id}  name="${data.name || ''}"  members=${members.size}  projects=${projects.size}`);
    console.log('    Projekte:');
    for (const p of projects.docs) {
      const pd = p.data() || {};
      console.log(`      - ${p.id}  "${pd.title || pd.name || ''}"${p.id === targetProject ? '  <== Ziel' : ''}`);
    }
  }
}
console.log('\nAlle Tenants:');
for (const r of rows) console.log(`  ${r.hasTarget ? '*' : ' '} ${r.tenantId}  name="${r.name}"  members=${r.members}  projects=${r.projects}`);
process.exit(0);
