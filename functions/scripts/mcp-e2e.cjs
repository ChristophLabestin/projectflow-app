/**
 * End-to-end check of the ProjectFlow MCP server with the official MCP client.
 *
 *   MCP_URL=http://127.0.0.1:5001/demo-projectflow/europe-west3/mcp \
 *   PROJECTFLOW_API_TOKEN=pfat_... node functions/scripts/mcp-e2e.cjs
 *
 * Use a token with the "Codex full access" profile. The script creates, updates
 * and finally deletes its own tasks in the first project of the workspace.
 */
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');

const URL_ = process.env.MCP_URL || 'http://127.0.0.1:5001/demo-projectflow/europe-west3/mcp';
const TOKEN = (process.env.PROJECTFLOW_API_TOKEN || '').trim();
if (!TOKEN) { console.error('Set PROJECTFLOW_API_TOKEN'); process.exit(2); }
const parse = (r) => { const t = r.content?.[0]?.text || ''; try { return JSON.parse(t); } catch { return t; } };
let failures = 0;
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  — ' + extra : ''}`); if (!ok) failures++; };

(async () => {
  // Unauthorized client
  try {
    const bad = new Client({ name: 'e2e-bad', version: '1' });
    await bad.connect(new StreamableHTTPClientTransport(new URL(URL_), { requestInit: { headers: { Authorization: 'Bearer pfat_wrong' } } }));
    check('rejects invalid token', false);
  } catch (e) { check('rejects invalid token', /401|Invalid API token|Unauthorized/i.test(String(e)), String(e).slice(0, 80)); }

  const client = new Client({ name: 'e2e', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(URL_), { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }));
  check('initialize', true, `server=${client.getServerVersion()?.name} ${client.getServerVersion()?.version}`);
  check('instructions sent', (client.getInstructions() || '').includes('whoami'));

  const { tools } = await client.listTools();
  console.log('      tools:', tools.map(t => t.name).join(', '));
  check('tools listed', tools.length >= 20, `${tools.length} tools`);

  const who = parse(await client.callTool({ name: 'whoami', arguments: {} }));
  check('whoami', !!who.workspaceId, `${who.workspaceName} / ${who.permissions?.length} perms`);

  const projects = parse(await client.callTool({ name: 'list_projects', arguments: {} }));
  check('list_projects', projects.count > 0, `${projects.count} projects`);
  const projectId = projects.projects[0].id;

  const created = parse(await client.callTool({ name: 'create_task', arguments: { projectId, title: 'MCP e2e task', priority: 'High', dueDate: '2026-10-01' } }));
  const taskId = created.task?.id;
  check('create_task', !!taskId, taskId);

  const up1 = parse(await client.callTool({ name: 'upsert_task', arguments: { projectId, externalKey: 'e2e:mcp/upsert', title: 'Upserted once' } }));
  const up2 = parse(await client.callTool({ name: 'upsert_task', arguments: { projectId, externalKey: 'e2e:mcp/upsert', title: 'Upserted twice', status: 'In Progress' } }));
  check('upsert_task idempotent', up1.task?.id && up1.task.id === up2.task?.id && up2.task?.title === 'Upserted twice', `${up1.task?.id} / ${up2.task?.id}`);

  const upd = parse(await client.callTool({ name: 'update_task', arguments: { projectId, taskId, status: 'Review', description: 'Updated via MCP' } }));
  check('update_task', upd.task?.status === 'Review', upd.task?.status);

  const sub = parse(await client.callTool({ name: 'add_subtask', arguments: { projectId, taskId, title: 'Check the thing' } }));
  const subId = sub.subtask?.id;
  check('add_subtask', !!subId);
  const subDone = parse(await client.callTool({ name: 'update_subtask', arguments: { projectId, taskId, subtaskId: subId, isCompleted: true } }));
  check('update_subtask', subDone.subtask?.isCompleted === true);

  const full = parse(await client.callTool({ name: 'get_task', arguments: { projectId, taskId } }));
  check('get_task incl. subtasks', full.title === 'MCP e2e task' && full.subtasks?.length === 1);

  const listed = parse(await client.callTool({ name: 'list_tasks', arguments: { projectId, search: 'mcp e2e' } }));
  check('list_tasks search', listed.tasks?.some(t => t.id === taskId), `${listed.count} match`);

  const comment = parse(await client.callTool({ name: 'add_comment', arguments: { projectId, targetId: taskId, targetType: 'task', content: 'Comment from MCP' } }));
  check('add_comment', comment.success === true || !!comment.comment);
  const comments = parse(await client.callTool({ name: 'list_comments', arguments: { projectId, targetId: taskId } }));
  check('list_comments filtered', comments.count >= 1);

  const done = parse(await client.callTool({ name: 'complete_task', arguments: { projectId, taskId } }));
  check('complete_task', done.task?.status === 'Done' && done.task?.isCompleted === true);

  const initiative = parse(await client.callTool({ name: 'create_initiative', arguments: { projectId, title: 'MCP e2e initiative', status: 'Planning' } }));
  const initiativeId = initiative.initiative?.id;
  check('create_initiative', !!initiativeId);
  const initUpd = parse(await client.callTool({ name: 'update_initiative', arguments: { projectId, initiativeId, health: 'At Risk' } }));
  check('update_initiative', initUpd.initiative?.health === 'At Risk');
  const inits = parse(await client.callTool({ name: 'list_initiatives', arguments: { projectId } }));
  check('list_initiatives', inits.initiatives?.some(i => i.id === initiativeId));

  const ms = parse(await client.callTool({ name: 'create_milestone', arguments: { projectId, title: 'MCP milestone', dueDate: '2026-11-01' } }));
  check('create_milestone', !!(ms.milestone?.id || ms.success));

  const start = parse(await client.callTool({ name: 'codex_start_session', arguments: { projectId, title: 'MCP e2e coding session', repoName: 'projectflow-app', branch: 'feat/mcp', externalKey: 'e2e:mcp/session' } }));
  const sessionId = start.session?.id || start.sessionId;
  check('codex_start_session', !!sessionId, sessionId);
  const cp = parse(await client.callTool({ name: 'codex_checkpoint', arguments: { projectId, sessionId, phase: 'testing', summary: 'Running e2e', validationStatus: 'tests passed' } }));
  check('codex_checkpoint', cp.success !== false && !cp.error);
  const fin = parse(await client.callTool({ name: 'codex_finish_session', arguments: { projectId, sessionId, status: 'completed', summary: 'MCP server e2e done' } }));
  check('codex_finish_session', fin.success !== false && !fin.error);
  const fu = parse(await client.callTool({ name: 'create_followups', arguments: { projectId, sessionId, followUps: [{ title: 'MCP follow-up', priority: 'Low' }] } }));
  check('create_followups', (fu.followups || []).length === 1, JSON.stringify(fu).slice(0, 80));
  const sessions = parse(await client.callTool({ name: 'list_codex_sessions', arguments: { projectId } }));
  check('list_codex_sessions', JSON.stringify(sessions).includes(sessionId));

  const act = parse(await client.callTool({ name: 'list_activity', arguments: { projectId, limit: 5 } }));
  check('list_activity', act.count > 0);

  const badProject = await client.callTool({ name: 'get_project', arguments: { projectId: 'does-not-exist' } });
  check('error surfaces as isError', badProject.isError === true, badProject.content?.[0]?.text);

  // cleanup
  for (const id of [taskId, up1.task?.id, ...(fu.followups || []).map(f => f.taskId || f.id)].filter(Boolean)) {
    const del = await client.callTool({ name: 'delete_task', arguments: { projectId, taskId: id } });
    if (del.isError) console.log('      cleanup failed for', id, del.content?.[0]?.text);
  }
  check('delete_task cleanup', true);

  await client.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e); process.exit(2); });
