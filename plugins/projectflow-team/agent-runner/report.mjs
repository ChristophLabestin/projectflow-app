#!/usr/bin/env node
/**
 * Deterministischer Report-Runner (kein LLM).
 * Liest ProjectFlow-Daten via Agenten-Token und erzeugt:
 *   --mode daily   : projektuebergreifender Standup (Zahlen, Faelligkeiten, frische Tasks)
 *   --mode weekly  : pro Projekt einen Wochenreport
 * Ausgabe: (1) Markdown in 04_Outbox/Reports/, (2) ein ProjectFlow-Task (idempotent via externalKey).
 *
 *   node report.mjs --mode daily|weekly [--outbox <pfad>] [--dry]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEnabled, getState } from '../autonomy-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Kill-Switch: bei deaktivierter Autonomie nichts tun.
if (!isEnabled()) {
  console.log(`⛔ Autonomie deaktiviert (${getState().reason || ''}) – Report-Runner macht nichts.`);
  process.exit(0);
}
const args = Object.fromEntries(process.argv.slice(2).reduce((a,x,i,arr)=>{ if(x.startsWith('--')){const k=x.slice(2);const n=arr[i+1];a.push([k,(n&&!n.startsWith('--'))?n:true]);}return a;},[]));
const MODE = args.mode === 'weekly' ? 'weekly' : 'daily';
const DRY = !!args.dry;
const OUTBOX = args.outbox || '/Users/christophlabestin/Documents/LabestinDigital/04_Outbox/Reports';

const tokens = JSON.parse(readFileSync(resolve(__dirname, '../mcp/tokens.json'), 'utf8'));
const apiBase = tokens.apiBase;
const A = tokens.agents;
// Koordinator-Token (breite Rechte) zum Lesen/Schreiben
const coordinator = A.carla || Object.values(A)[0];

// Projektliste aus den Agenten ableiten (+ Haupt-Projekt)
const projMap = new Map();
for (const a of Object.values(A)) if (a.projectId && a.projectName && !String(a.projectId).startsWith('dry')) projMap.set(a.projectId, a.projectName);
if (tokens.projectId) projMap.set(tokens.projectId, projMap.get(tokens.projectId) || 'ProjectFlow');
const projects = [...projMap.entries()].map(([id, name]) => ({ id, name }));

const uidName = {}; for (const a of Object.values(A)) uidName[a.uid] = a.displayName;

async function api(token, method, path, body) {
  const res = await fetch(`${apiBase}/projectflow${path}`, { method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const text = await res.text(); let j; try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0,200)}`);
  return j;
}
const today = new Date();
const ymd = (d) => d.toISOString().slice(0,10);
const isoWeek = (d)=>{const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil((((t-ys)/86400000)+1)/7);};
const daysAgo = (n)=>{const d=new Date(today);d.setDate(d.getDate()-n);return d;};
function tDate(v){ if(!v) return null; if(typeof v==='string'){const d=new Date(v);return isNaN(d)?null:d;} if(v._seconds) return new Date(v._seconds*1000); if(v.seconds) return new Date(v.seconds*1000); return null; }
const isDone = (t)=> t.isCompleted || /done|completed|erledigt/i.test(t.status||'');

async function tasksOf(pid){ const r = await api(coordinator.token,'GET',`/projects/${pid}/tasks`); return r.tasks||r.items||r||[]; }

function statsFor(tasks){
  const open = tasks.filter(t=>!isDone(t));
  const overdue = open.filter(t=>{const d=tDate(t.dueDate);return d && d<today;});
  const since = MODE==='weekly'?daysAgo(7):daysAgo(1);
  const created = tasks.filter(t=>{const d=tDate(t.createdAt);return d&&d>=since;});
  const completed = tasks.filter(t=>{const d=tDate(t.completedAt||t.updatedAt);return isDone(t)&&d&&d>=since;});
  const byStatus = {}; for(const t of tasks){const s=t.status||(isDone(t)?'Done':'Open');byStatus[s]=(byStatus[s]||0)+1;}
  return { total:tasks.length, open:open.length, overdue, created, completed, byStatus };
}

let md = '', taskTitle = '', externalKey = '';
if (MODE==='daily') {
  taskTitle = `📊 Standup ${ymd(today)}`;
  externalKey = `report-standup-${ymd(today)}`;
  md = `# Team-Standup ${ymd(today)}\n\n_Automatisch erstellt vom Report-Runner (deterministisch)._\n\n`;
  let totO=0, totOv=0, totNew=0;
  const lines=[];
  for (const p of projects) {
    let tasks=[]; try{ tasks=await tasksOf(p.id);}catch(e){ lines.push(`- **${p.name}**: Fehler (${e.message})`); continue; }
    const s=statsFor(tasks); totO+=s.open; totOv+=s.overdue.length; totNew+=s.created.length;
    lines.push(`- **${p.name}** — offen ${s.open}, überfällig ${s.overdue.length}, neu (24h) ${s.created.length}`);
  }
  md += `**Gesamt:** offen ${totO} · überfällig ${totOv} · neu (24h) ${totNew}\n\n## Pro Projekt\n${lines.join('\n')}\n`;
  // Überfällige hervorheben
  const od=[];
  for (const p of projects){ let tasks=[]; try{tasks=await tasksOf(p.id);}catch{continue;} for(const t of statsFor(tasks).overdue.slice(0,5)){ od.push(`- [${p.name}] ${t.title} (fällig ${ymd(tDate(t.dueDate))}, ${ (t.assigneeIds||[]).map(u=>uidName[u]||'?').join(', ')||'—'})`);} }
  if (od.length) md += `\n## ⚠️ Überfällig\n${od.join('\n')}\n`;
  md += `\n> Eskalationen/Fragen an Christoph: siehe 04_Outbox/Decisions/.\n`;
} else {
  const wk = isoWeek(today);
  taskTitle = `🗓️ Wochenreport KW${wk}`;
  externalKey = `report-weekly-${today.getFullYear()}-w${wk}`;
  md = `# Wochenreport KW${wk} / ${today.getFullYear()}\n\n_Automatisch erstellt vom Report-Runner._\n\n`;
  for (const p of projects) {
    let tasks=[]; try{tasks=await tasksOf(p.id);}catch(e){ md+=`## ${p.name}\nFehler: ${e.message}\n\n`; continue; }
    const s=statsFor(tasks);
    md += `## ${p.name}\n`;
    md += `- Offen: ${s.open} · Überfällig: ${s.overdue.length}\n`;
    md += `- Diese Woche neu: ${s.created.length} · erledigt: ${s.completed.length}\n`;
    md += `- Status: ${Object.entries(s.byStatus).map(([k,v])=>`${k} ${v}`).join(' · ')||'—'}\n`;
    if (s.completed.length) md += `- ✅ Erledigt: ${s.completed.slice(0,6).map(t=>t.title).join('; ')}\n`;
    if (s.overdue.length) md += `- ⚠️ Überfällig: ${s.overdue.slice(0,6).map(t=>t.title).join('; ')}\n`;
    md += `\n`;
  }
  md += `> Bei offenen Entscheidungen: 04_Outbox/Decisions/.\n`;
}

// 1) Outbox
if (!DRY) { if(!existsSync(OUTBOX)) mkdirSync(OUTBOX,{recursive:true}); const f=resolve(OUTBOX, `${externalKey}.md`); writeFileSync(f, md); console.log('Outbox:', f); }
else console.log('--- DRY Outbox-Inhalt ---\n'+md);

// 2) ProjectFlow-Task (im Haupt-Projekt) als Carla
const mainPid = tokens.projectId || projects[0]?.id;
if (!DRY && mainPid) {
  try {
    const r = await api(coordinator.token,'POST',`/projects/${mainPid}/tasks/upsert-by-external-key`, {
      externalKey, title: taskTitle, description: md, status: 'Done', priority: 'Low',
      assigneeIds: [coordinator.uid], source: 'report_runner' });
    console.log('ProjectFlow-Task:', r?.operation || 'ok', r?.task?.id || '');
  } catch(e){ console.log('ProjectFlow-Fehler:', e.message); }
}
console.log(`Report ${MODE} fertig${DRY?' (dry)':''}.`);
