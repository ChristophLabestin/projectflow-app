// Zentrale Wahrheit für den Kill-Switch der Agenten-Autonomie.
// Wird von report.mjs, server.mjs und hire-agent.mjs gelesen.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'AUTONOMY_STATE.json');

export function getState() {
  try { return JSON.parse(readFileSync(STATE_PATH, 'utf8')); }
  catch { return { enabled: true, reason: 'kein State-File – Standard aktiv' }; }
}
export function isEnabled() { return getState().enabled !== false; }
export function setState(enabled, reason = '', by = 'cli') {
  const s = { enabled: !!enabled, reason, updatedAt: new Date().toISOString(), updatedBy: by };
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
  return s;
}
