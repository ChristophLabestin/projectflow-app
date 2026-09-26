#!/usr/bin/env node
/**
 * Kill-Switch für die Agenten-Autonomie.
 *   node killswitch.mjs status        -> aktuellen Stand zeigen
 *   node killswitch.mjs off [grund]   -> ALLES pausieren (kein Agent arbeitet)
 *   node killswitch.mjs on  [grund]   -> wieder aktivieren
 *
 * Wirkt auf: geplante Reports (report.mjs), alle schreibenden MCP-Tools (server.mjs)
 * und das Einstellen neuer Agenten (hire-agent.mjs).
 */
import { getState, setState } from './autonomy-state.mjs';

const cmd = (process.argv[2] || 'status').toLowerCase();
const reason = process.argv.slice(3).join(' ');

if (['off', 'disable', 'pause', 'stop'].includes(cmd)) {
  const s = setState(false, reason || 'manuell pausiert', 'killswitch');
  console.log('⛔ Autonomie DEAKTIVIERT — kein Agent arbeitet, bis wieder aktiviert.');
  console.log(s);
} else if (['on', 'enable', 'resume', 'start'].includes(cmd)) {
  const s = setState(true, reason || 'manuell aktiviert', 'killswitch');
  console.log('✅ Autonomie AKTIV — Agenten und geplante Läufe arbeiten wieder.');
  console.log(s);
} else {
  const s = getState();
  console.log(`Autonomie: ${s.enabled === false ? '⛔ DEAKTIVIERT' : '✅ aktiv'}`);
  console.log(`Grund: ${s.reason || '—'}`);
  console.log(`Stand: ${s.updatedAt || '—'} (${s.updatedBy || '—'})`);
  console.log('\nUmschalten: node killswitch.mjs off|on [grund]');
}
