#!/usr/bin/env node
// Live-Smoketest: spawnt server.mjs (stdio) und ruft list_agents + list_my_tasks(theo).
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const server = spawn('node', ['server.mjs'], {
  cwd: resolve(process.cwd()),
  env: { ...process.env, PF_TOKENS: './tokens.json' },
  stdio: ['pipe', 'pipe', 'inherit']
});

let buf = '';
const pending = new Map();
server.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
const send = (obj) => server.stdin.write(JSON.stringify(obj) + '\n');
const call = (id, method, params) => new Promise((res) => { pending.set(id, res); send({ jsonrpc: '2.0', id, method, params }); });

await call(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
send({ jsonrpc: '2.0', method: 'notifications/initialized' });

const tools = await call(2, 'tools/list', {});
console.log('Tools:', tools.result.tools.map(t => t.name).join(', '));

const agents = await call(3, 'tools/call', { name: 'list_agents', arguments: {} });
console.log('\nlist_agents ->'); console.log(agents.result.content[0].text);

const mine = await call(4, 'tools/call', { name: 'list_my_tasks', arguments: { as_agent: 'theo' } });
const parsed = JSON.parse(mine.result.content[0].text);
console.log(`\nlist_my_tasks(theo) -> count=${parsed.count}`);
for (const t of (parsed.tasks || []).slice(0, 8)) console.log(`  • ${t.title} [${t.status}]`);

server.kill();
process.exit(0);
