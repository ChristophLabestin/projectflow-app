#!/usr/bin/env node
// Spielt die Backlog-Kommentare nach (korrektes Feld targetId/targetType).
// Nutzt vorhandene tokens.json (keine neuen Tokens). Idempotenz: ueberspringt,
// wenn fuer (targetId, content) schon ein Kommentar existiert.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cfg = JSON.parse(readFileSync(resolve(process.cwd(), '../mcp/tokens.json'), 'utf8'));
const backlog = JSON.parse(readFileSync(resolve(process.cwd(), './backlog.seed.json'), 'utf8'));
const apiBase = cfg.apiBase;
const projectId = cfg.projectId;
const A = cfg.agents;
const tokenOf = (k) => A[k]?.token;

async function api(token, method, path, body) {
  const res = await fetch(`${apiBase}/projectflow${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0,300)}`);
  return json;
}

// 1) Tasks holen, externalKey -> id
const anyToken = tokenOf('carla') || Object.values(A)[0].token;
const tlist = await api(anyToken, 'GET', `/projects/${projectId}/tasks`);
const tasks = tlist.tasks || tlist.items || tlist || [];
const byKey = {};
for (const t of tasks) if (t.externalKey) byKey[t.externalKey] = t.id;
console.log(`Tasks gefunden: ${tasks.length}`);

let okc = 0, skip = 0, errc = 0;
for (const t of backlog.tasks) {
  const taskId = byKey[t.externalKey];
  if (!taskId) { console.log(`! kein Task fuer ${t.externalKey}`); continue; }
  // vorhandene Kommentare am Task lesen (Idempotenz)
  let existing = [];
  try {
    const r = await api(anyToken, 'GET', `/projects/${projectId}/comments?targetId=${taskId}&targetType=task`);
    existing = (r.comments || r.items || r || []).map(c => c.content);
  } catch {}
  for (const c of (t.comments || [])) {
    if (existing.includes(c.content)) { skip++; continue; }
    const token = tokenOf(c.by);
    if (!token) { console.log(`  ! unbekannter Kommentator ${c.by}`); continue; }
    try {
      await api(token, 'POST', `/projects/${projectId}/comments`, { content: c.content, targetId: taskId, targetType: 'task' });
      console.log(`  • Kommentar von ${c.by} an "${t.title.slice(0,40)}…"`);
      okc++;
    } catch (e) { console.log(`  ! Fehler (${c.by}): ${e.message}`); errc++; }
  }
}
console.log(`\nFertig. Neu: ${okc}, uebersprungen: ${skip}, Fehler: ${errc}`);
process.exit(0);
