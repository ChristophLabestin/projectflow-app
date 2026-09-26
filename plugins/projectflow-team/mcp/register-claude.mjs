#!/usr/bin/env node
// Traegt den projectflow-team MCP-Server in die Claude-Desktop-Konfig ein (mit Backup).
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const cfgPath = join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
const serverPath = '/Users/christophlabestin/Documents/LabestinDigital/02_Projects/projectflow-app/plugins/projectflow-team/mcp/server.mjs';
const tokensPath = '/Users/christophlabestin/Documents/LabestinDigital/02_Projects/projectflow-app/plugins/projectflow-team/mcp/tokens.json';

let cfg = {};
if (existsSync(cfgPath)) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${cfgPath}.backup-${ts}.json`;
  copyFileSync(cfgPath, backup);
  console.log('Backup:', backup);
  try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); }
  catch (e) { console.error('Konnte bestehende Konfig nicht parsen, breche ab:', e.message); process.exit(1); }
} else {
  mkdirSync(dirname(cfgPath), { recursive: true });
  console.log('Keine bestehende Konfig – lege neue an.');
}

cfg.mcpServers = cfg.mcpServers || {};
const existed = !!cfg.mcpServers['projectflow-team'];
cfg.mcpServers['projectflow-team'] = {
  command: 'node',
  args: [serverPath],
  env: { PF_TOKENS: tokensPath }
};
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log(`${existed ? 'Aktualisiert' : 'Hinzugefuegt'}: mcpServers.projectflow-team`);
console.log('Konfig:', cfgPath);
console.log('MCP-Server insgesamt:', Object.keys(cfg.mcpServers).join(', '));
