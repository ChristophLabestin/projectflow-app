#!/usr/bin/env node
/**
 * ProjectFlow Team MCP Server
 * ---------------------------
 * Duenner Wrapper ueber die ProjectFlow-HTTP-API. Erlaubt es einem AI-Client
 * (Claude/Codex), "als" einem der 9 Agenten zu handeln: Tasks anlegen, zuweisen,
 * kommentieren. Authentifizierung laeuft ueber das jeweilige Per-Agent-API-Token
 * aus tokens.json (vom Seed-Skript erzeugt) -> echte Urheberschaft im Board.
 *
 * Start (stdio):
 *   PF_TOKENS=./tokens.json node server.mjs
 *
 * tokens.json-Format (vom Seed erzeugt):
 *   { "apiBase": "...", "tenantId": "...", "projectId": "...",
 *     "agents": { "mara": { "uid": "...", "displayName": "Mara Keller", "token": "pfat_..." }, ... } }
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isEnabled, getState } from '../autonomy-state.mjs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// ---------- config ----------
const TOKENS_PATH = resolve(process.cwd(), process.env.PF_TOKENS || './tokens.json');
let CFG;
try {
  CFG = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));
} catch (e) {
  console.error(`[projectflow-team] tokens.json nicht gefunden unter ${TOKENS_PATH}. ` +
    `Erst das Seed-Skript ausfuehren (erzeugt tokens.json) oder PF_TOKENS setzen.`);
  process.exit(1);
}
const API_BASE = process.env.PF_API_BASE || CFG.apiBase;
const DEFAULT_PROJECT = process.env.PF_PROJECT_ID || CFG.projectId || null;
let AGENTS = CFG.agents || {};
const OWNER_UID = CFG.tenantId; // persoenlicher Tenant => Owner-UID
const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNNER = resolve(__dirname, '../agent-runner');
const OUTBOX = process.env.PF_OUTBOX || '/Users/christophlabestin/Documents/LabestinDigital/04_Outbox';

function reloadTokens() {
  try { const c = JSON.parse(readFileSync(TOKENS_PATH, 'utf8')); AGENTS = c.agents || AGENTS; } catch {}
}
function outboxWrite(subdir, file, content, append = false) {
  const dir = resolve(OUTBOX, subdir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const f = resolve(dir, file);
  if (append) appendFileSync(f, content); else writeFileSync(f, content);
  return f;
}

// ---------- agent resolution ----------
function resolveAgent(idOrName) {
  if (!idOrName) return null;
  const k = String(idOrName).toLowerCase().trim();
  if (AGENTS[k]) return { key: k, ...AGENTS[k] };
  for (const [key, a] of Object.entries(AGENTS)) {
    if ((a.shortName || '').toLowerCase() === k) return { key, ...a };
    if ((a.displayName || '').toLowerCase() === k) return { key, ...a };
    if ((a.displayName || '').toLowerCase().split(' ')[0] === k) return { key, ...a };
  }
  return null;
}
// assign_to entries may be agent keys/names or raw uids
function resolveAssignee(entry) {
  const a = resolveAgent(entry);
  if (a) return a.uid;
  return String(entry); // assume raw uid
}

// ---------- API helper ----------
async function api(token, method, path, body) {
  const url = `${API_BASE}/projectflow${path}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return json;
}
function projectOf(args) {
  const p = args.project_id || DEFAULT_PROJECT;
  if (!p) throw new Error('project_id fehlt und kein Default in tokens.json.');
  return p;
}
function requireAgent(args) {
  const a = resolveAgent(args.as_agent);
  if (!a) throw new Error(`Unbekannter Agent "${args.as_agent}". Verfuegbar: ${Object.keys(AGENTS).join(', ')}`);
  if (!a.token) throw new Error(`Kein Token fuer Agent "${a.key}" in tokens.json.`);
  return a;
}
const ok = (obj) => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const err = (msg) => ({ content: [{ type: 'text', text: `Fehler: ${msg}` }], isError: true });

// --- Briefing-Fäden (persistenter Eingang je Agent) ---
function coordinatorAgent() { return resolveAgent('carla') || resolveAgent(Object.keys(AGENTS)[0]); }
const briefingKeyFor = (a) => `briefing-${a.key}`;
const briefingProjectFor = (a) => a.projectId || DEFAULT_PROJECT;
function authorName(uid) {
  const hit = Object.values(AGENTS).find(a => a.uid === uid);
  if (hit) return hit.displayName;
  if (uid && OWNER_UID && uid === OWNER_UID) return 'Christoph';
  return uid || 'unbekannt';
}
async function findBriefingTask(token, pid, key) {
  const r = await api(token, 'GET', `/projects/${pid}/tasks`);
  const ts = r.tasks || r.items || r || [];
  return ts.find(t => t.externalKey === key) || null;
}
async function ensureBriefingTask(token, pid, agent) {
  const r = await api(token, 'POST', `/projects/${pid}/tasks/upsert-by-external-key`, {
    externalKey: briefingKeyFor(agent),
    title: `📥 Briefing: ${agent.displayName}`,
    description: `Persistenter Briefing-Faden für ${agent.displayName} (${agent.function || agent.key}). Christoph schreibt hier Infos rein; der Agent liest und antwortet.`,
    status: 'Open', priority: 'Medium', assigneeIds: [agent.uid], assigneeId: agent.uid, source: 'briefing'
  });
  return r?.task?.id;
}
async function briefingThread(token, pid, taskId) {
  const r = await api(token, 'GET', `/projects/${pid}/comments?targetId=${taskId}&targetType=task`);
  const arr = r.comments || r.items || r || [];
  return arr.map(c => ({ from: authorName(c.userId || c.createdBy), content: c.content, at: c.createdAt }));
}

// ---------- tools ----------
const TOOLS = [
  {
    name: 'list_agents',
    description: 'Listet die verfuegbaren AI-Mitarbeiter (Key, Name, Funktion). Nutze einen Key/Namen als as_agent.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_projects',
    description: 'Listet Projekte, die der Agent sehen darf.',
    inputSchema: { type: 'object', properties: { as_agent: { type: 'string', description: 'Agent-Key oder Name' } }, required: ['as_agent'] }
  },
  {
    name: 'list_tasks',
    description: 'Listet alle Tasks eines Projekts.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string' }, project_id: { type: 'string', description: 'optional, sonst Default aus tokens.json' }
    }, required: ['as_agent'] }
  },
  {
    name: 'list_my_tasks',
    description: 'Listet Tasks, die dem angegebenen Agenten zugewiesen sind.',
    inputSchema: { type: 'object', properties: { as_agent: { type: 'string' }, project_id: { type: 'string' } }, required: ['as_agent'] }
  },
  {
    name: 'create_task',
    description: 'Legt einen Task an – als der angegebene Agent (erscheint als dessen Urheber). Optional direkt zuweisen.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string', description: 'wer den Task anlegt' },
      title: { type: 'string' },
      description: { type: 'string' },
      assign_to: { type: 'array', items: { type: 'string' }, description: 'Agent-Keys/Namen oder UIDs' },
      priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
      status: { type: 'string', description: 'z.B. Open, In Progress, Done, Blocked' },
      due_date: { type: 'string', description: 'YYYY-MM-DD' },
      project_id: { type: 'string' },
      external_key: { type: 'string', description: 'optional, fuer Idempotenz' }
    }, required: ['as_agent', 'title'] }
  },
  {
    name: 'assign_task',
    description: 'Weist einen bestehenden Task einem oder mehreren Agenten zu (ersetzt die Zuweisung).',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string', description: 'wer die Zuweisung vornimmt' },
      task_id: { type: 'string' },
      assign_to: { type: 'array', items: { type: 'string' }, description: 'Agent-Keys/Namen oder UIDs' },
      project_id: { type: 'string' }
    }, required: ['as_agent', 'task_id', 'assign_to'] }
  },
  {
    name: 'comment',
    description: 'Schreibt einen Kommentar als der angegebene Agent.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string' }, task_id: { type: 'string' }, content: { type: 'string' }, project_id: { type: 'string' }
    }, required: ['as_agent', 'content'] }
  },
  {
    name: 'get_task',
    description: 'Liest einen einzelnen Task.',
    inputSchema: { type: 'object', properties: { as_agent: { type: 'string' }, task_id: { type: 'string' }, project_id: { type: 'string' } }, required: ['as_agent', 'task_id'] }
  },
  {
    name: 'update_task',
    description: 'Aktualisiert Felder eines Tasks (Status, Fortschritt, Beschreibung, Priorität, Fälligkeit, isCompleted) – als der angegebene Agent. So bewegen Agenten ihre Arbeit voran.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string' }, task_id: { type: 'string' },
      status: { type: 'string' }, isCompleted: { type: 'boolean' }, priority: { type: 'string' },
      description: { type: 'string' }, dueDate: { type: 'string' }, project_id: { type: 'string' }
    }, required: ['as_agent', 'task_id'] }
  },
  {
    name: 'list_activity',
    description: 'Liest den Aktivitäts-Verlauf eines Projekts (was zuletzt passiert ist).',
    inputSchema: { type: 'object', properties: { as_agent: { type: 'string' }, project_id: { type: 'string' } }, required: ['as_agent'] }
  },
  {
    name: 'post_report',
    description: 'Legt einen Report ab: als ProjectFlow-Task (idempotent) und/oder als Markdown in der Workspace-Outbox.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' },
      external_key: { type: 'string', description: 'für Idempotenz, z.B. weekly-2026-w27' },
      project_id: { type: 'string' }, to: { type: 'string', enum: ['projectflow', 'outbox', 'both'], description: 'Default both' }
    }, required: ['as_agent', 'title', 'content'] }
  },
  {
    name: 'raise_decision',
    description: 'Eskaliert eine Frage/Entscheidung an Christoph (Mensch), wenn ein Agent unsicher ist oder eine Meinung braucht. Schreibt nach 04_Outbox/Decisions/ und legt einen Task an, der Christoph zugewiesen ist.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string' }, question: { type: 'string' }, context: { type: 'string' },
      options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, project_id: { type: 'string' }
    }, required: ['as_agent', 'question'] }
  },
  {
    name: 'autonomy_status',
    description: 'Zeigt, ob die Agenten-Autonomie aktiv oder per Kill-Switch deaktiviert ist (read-only).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'create_agent',
    description: 'Stellt autonom einen neuen Agenten/Mitarbeiter ein (z.B. durch Carla bei Bedarf). Legt echten Account + Token an und ordnet optional einem Projekt zu. Nutzt einen kurzlebigen Admin-Key, der danach wieder entfernt wird.',
    inputSchema: { type: 'object', properties: {
      key: { type: 'string', description: 'eindeutiger Agent-Key, z.B. pm-newapp' },
      name: { type: 'string', description: 'Anzeigename, z.B. "Jonas Vogt"' },
      function: { type: 'string', description: 'Jobtitel/Funktion, z.B. "Product Manager · NeueApp"' },
      role_name: { type: 'string', description: 'Rollen-Label (Department), z.B. "Product Manager"' },
      role_color: { type: 'string' },
      permissions: { type: 'array', items: { type: 'string' }, description: 'API-Scopes; Default sinnvoll für Mitarbeiter' },
      project_id: { type: 'string', description: 'optional: Projekt, dem der Agent zugeordnet wird' }
    }, required: ['key', 'name', 'function'] }
  },
  {
    name: 'read_briefing',
    description: 'Liest den persistenten Briefing-Faden eines Agenten (der „Posteingang", in dem Christoph Infos hinterlegt). Der Agent nutzt das als Kontext, bevor er arbeitet.',
    inputSchema: { type: 'object', properties: { as_agent: { type: 'string', description: 'wessen Briefing gelesen wird' } }, required: ['as_agent'] }
  },
  {
    name: 'brief_agent',
    description: 'Hinterlegt eine Nachricht/Info von Christoph im Briefing-Faden eines Agenten (Christoph → Agent). Persistiert in ProjectFlow, auch mobil sichtbar.',
    inputSchema: { type: 'object', properties: {
      agent: { type: 'string', description: 'Ziel-Agent (Key oder Name)' }, message: { type: 'string' }
    }, required: ['agent', 'message'] }
  },
  {
    name: 'reply_briefing',
    description: 'Der Agent antwortet in seinem Briefing-Faden (Agent → Christoph): was er verstanden/getan hat, Rückfragen. Persistenter Verlauf.',
    inputSchema: { type: 'object', properties: {
      as_agent: { type: 'string' }, message: { type: 'string' }
    }, required: ['as_agent', 'message'] }
  }
];

// ---------- server ----------
const server = new Server(
  { name: 'projectflow-team', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  // Kill-Switch: schreibende/handelnde Tools sind blockiert, wenn Autonomie deaktiviert ist.
  const WRITE_TOOLS = new Set(['create_task', 'assign_task', 'comment', 'update_task', 'post_report', 'raise_decision', 'create_agent', 'reply_briefing']);
  if (WRITE_TOOLS.has(name) && !isEnabled()) {
    return err(`⛔ Autonomie ist per Kill-Switch deaktiviert (${getState().reason || ''}). Es wird nichts geschrieben. Aktivieren mit: node killswitch.mjs on`);
  }
  try {
    switch (name) {
      case 'autonomy_status': {
        const s = getState();
        return ok({ enabled: s.enabled !== false, reason: s.reason, updatedAt: s.updatedAt, updatedBy: s.updatedBy });
      }
      case 'list_agents':
        return ok(Object.entries(AGENTS).map(([key, a]) =>
          ({ key, name: a.displayName, function: a.function, uid: a.uid })));

      case 'list_projects': {
        const a = requireAgent(args);
        return ok(await api(a.token, 'GET', '/projects'));
      }
      case 'list_tasks': {
        const a = requireAgent(args);
        return ok(await api(a.token, 'GET', `/projects/${projectOf(args)}/tasks`));
      }
      case 'list_my_tasks': {
        const a = requireAgent(args);
        const r = await api(a.token, 'GET', `/projects/${projectOf(args)}/tasks`);
        const tasks = (r.tasks || r.items || r || []);
        const mine = tasks.filter(t =>
          (t.assigneeIds || []).includes(a.uid) || t.assigneeId === a.uid);
        return ok({ count: mine.length, tasks: mine });
      }
      case 'create_task': {
        const a = requireAgent(args);
        const ids = (args.assign_to || []).map(resolveAssignee);
        const body = {
          title: args.title,
          description: args.description || '',
          status: args.status || 'Open',
          priority: args.priority || 'Medium',
          dueDate: args.due_date || '',
          assigneeIds: ids,
          assigneeId: ids[0] || null,
          source: 'mcp'
        };
        const path = args.external_key
          ? `/projects/${projectOf(args)}/tasks/upsert-by-external-key`
          : `/projects/${projectOf(args)}/tasks`;
        if (args.external_key) body.externalKey = args.external_key;
        return ok(await api(a.token, 'POST', path, body));
      }
      case 'assign_task': {
        const a = requireAgent(args);
        const ids = (args.assign_to || []).map(resolveAssignee);
        const body = { assigneeIds: ids, assigneeId: ids[0] || null };
        return ok(await api(a.token, 'PATCH', `/projects/${projectOf(args)}/tasks/${args.task_id}`, body));
      }
      case 'comment': {
        const a = requireAgent(args);
        const body = { content: args.content };
        if (args.task_id) { body.targetId = args.task_id; body.targetType = 'task'; }
        return ok(await api(a.token, 'POST', `/projects/${projectOf(args)}/comments`, body));
      }
      case 'get_task': {
        const a = requireAgent(args);
        return ok(await api(a.token, 'GET', `/projects/${projectOf(args)}/tasks/${args.task_id}`));
      }
      case 'update_task': {
        const a = requireAgent(args);
        const body = {};
        for (const k of ['status', 'priority', 'description', 'dueDate']) if (args[k] !== undefined) body[k] = args[k];
        if (args.isCompleted !== undefined) body.isCompleted = args.isCompleted;
        return ok(await api(a.token, 'PATCH', `/projects/${projectOf(args)}/tasks/${args.task_id}`, body));
      }
      case 'list_activity': {
        const a = requireAgent(args);
        return ok(await api(a.token, 'GET', `/projects/${projectOf(args)}/activities`));
      }
      case 'post_report': {
        const a = requireAgent(args);
        const to = args.to || 'both';
        const out = {};
        if (to === 'outbox' || to === 'both') {
          const fname = `${(args.external_key || args.title).replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.md`;
          out.outbox = outboxWrite('Reports', fname, `# ${args.title}\n\n${args.content}\n`);
        }
        if (to === 'projectflow' || to === 'both') {
          const pid = projectOf(args);
          const body = { title: args.title, description: args.content, status: 'Done', priority: 'Low',
            assigneeIds: [a.uid], source: 'report' };
          const path = args.external_key
            ? `/projects/${pid}/tasks/upsert-by-external-key` : `/projects/${pid}/tasks`;
          if (args.external_key) body.externalKey = args.external_key;
          out.projectflow = await api(a.token, 'POST', path, body);
        }
        return ok(out);
      }
      case 'raise_decision': {
        const a = requireAgent(args);
        const stamp = new Date().toISOString();
        const block = `\n## ❓ ${args.question}\n- Von: ${a.displayName} (${a.function || a.key})\n- Zeit: ${stamp}\n- Kontext: ${args.context || '—'}\n- Optionen: ${(args.options || []).join(' | ') || '—'}\n- Empfehlung: ${args.recommendation || '—'}\n- Status: offen\n`;
        const file = outboxWrite('Decisions', 'open_decisions.md', block, true);
        let task = null;
        try {
          const pid = projectOf(args);
          const desc = `Frage von ${a.displayName}:\n${args.question}\n\nKontext: ${args.context || '—'}\nOptionen: ${(args.options || []).join(' | ') || '—'}\nEmpfehlung: ${args.recommendation || '—'}`;
          task = await api(a.token, 'POST', `/projects/${pid}/tasks`, {
            title: `❓ Entscheidung: ${String(args.question).slice(0, 80)}`, description: desc,
            status: 'Open', priority: 'High', assigneeId: OWNER_UID, assigneeIds: OWNER_UID ? [OWNER_UID] : [], source: 'escalation' });
        } catch (e) { task = { error: e.message }; }
        return ok({ escalated: true, outbox: file, projectflowTask: task });
      }
      case 'create_agent': {
        const cliArgs = ['hire-agent.mjs', '--key', args.key, '--name', args.name, '--function', args.function,
          '--tenant', CFG.tenantId, '--confirm'];
        if (args.role_name) cliArgs.push('--role-name', args.role_name);
        if (args.role_color) cliArgs.push('--role-color', args.role_color);
        if (Array.isArray(args.permissions) && args.permissions.length) cliArgs.push('--perms', args.permissions.join(','));
        if (args.project_id) cliArgs.push('--project', args.project_id);
        const r = spawnSync('node', cliArgs, { cwd: RUNNER, encoding: 'utf8', timeout: 120000 });
        const outText = `${r.stdout || ''}${r.stderr || ''}`.trim();
        reloadTokens();
        if (r.status !== 0) return err(`create_agent fehlgeschlagen:\n${outText}`);
        return ok(`Neuer Agent angelegt.\n${outText}`);
      }
      case 'read_briefing': {
        const a = requireAgent(args);
        const pid = briefingProjectFor(a);
        if (!pid) return err('Kein Projekt für den Briefing-Faden gefunden.');
        const task = await findBriefingTask(a.token, pid, briefingKeyFor(a));
        if (!task) return ok({ agent: a.displayName, thread: [], note: 'Noch kein Briefing-Faden. Er entsteht, sobald Christoph (brief_agent / in der App) oder der Agent (reply_briefing) etwas schreibt.' });
        const thread = await briefingThread(a.token, pid, task.id);
        return ok({ agent: a.displayName, taskId: task.id, count: thread.length, thread });
      }
      case 'brief_agent': {
        const a = resolveAgent(args.agent);
        if (!a) return err(`Unbekannter Agent "${args.agent}". Verfügbar: ${Object.keys(AGENTS).join(', ')}`);
        const pid = briefingProjectFor(a);
        if (!pid) return err('Kein Projekt für den Briefing-Faden gefunden.');
        const coord = coordinatorAgent();
        const taskId = await ensureBriefingTask(coord.token, pid, a);
        await api(coord.token, 'POST', `/projects/${pid}/comments`, { content: `[Briefing von Christoph] ${args.message}`, targetId: taskId, targetType: 'task' });
        return ok({ posted: true, to: a.displayName, taskId });
      }
      case 'reply_briefing': {
        const a = requireAgent(args);
        const pid = briefingProjectFor(a);
        if (!pid) return err('Kein Projekt für den Briefing-Faden gefunden.');
        const taskId = await ensureBriefingTask(a.token, pid, a);
        await api(a.token, 'POST', `/projects/${pid}/comments`, { content: args.message, targetId: taskId, targetType: 'task' });
        return ok({ replied: true, agent: a.displayName, taskId });
      }
      default:
        return err(`Unbekanntes Tool: ${name}`);
    }
  } catch (e) {
    return err(e.message);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[projectflow-team] MCP-Server laeuft (stdio). Agenten:', Object.keys(AGENTS).join(', '));
