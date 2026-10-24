# Admin-MCP — verbinden und betreiben

Konzept: `brain/plans/admin-console-concept.md` → „Admin-MCP“. Code: `functions/src/admin-console/mcp/`, Konsole `/mcp-access`, Consent `/oauth/consent`.

## URL
`https://admin.getprojectflow.com/mcp` (solange die Domain nicht verbunden ist: `https://projectflow-admin.web.app/mcp`).
Die Resource hängt am Host: Eine Verbindung über die web.app-URL muss nach dem Domain-Umzug neu angelegt werden.

## Einmalig
1. Konsole → **Admin-MCP** → **Einschalten** (Kill-Switch, Default aus).

## Claude Code
```bash
claude mcp add --transport http projectflow-admin https://admin.getprojectflow.com/mcp
```
Dann in Claude Code `/mcp` → `projectflow-admin` → **Authenticate**. Der Browser öffnet die Konsole: anmelden, „Diesen Client dauerhaft freigeben“
(nur beim ersten Mal), optional „Schreiben“, **Mit TOTP bestätigen und verbinden** (frische Anmeldung inkl. TOTP).

## claude.ai / Claude Desktop
Einstellungen → **Connectors** → **Add custom connector** → URL oben → Connect → wie oben in der Konsole bestätigen.

## Laufzeit und Widerruf
Access-Token 15 min, Verbindung max. 7 Tage (danach neu verbinden). Widerruf: Konsole → Admin-MCP → Verbindungen/Clients;
alles sofort aus: **Ausschalten**. „Sitzungen widerrufen“ am eigenen Konto beendet ebenfalls alle Verbindungen.

## Schreibaktionen
Der erste Aufruf liefert `confirmation_required` + `pendingId`; der 6-stellige Code steht nur in der Konsole (Admin-MCP → Ausstehend,
10 min, 3 Versuche). Den Code nennst du Claude, der zweite Aufruf führt aus. E-Mail an dich bei neuer Verbindung und jeder Schreibaktion.

## Tests
`node functions/scripts/admin-mcp-e2e.mjs` gegen `ADMIN_DEV_SERVER=0 bash scripts/dev-admin.sh` (24 Checks inkl. aller Negativfälle),
Unit `functions/scripts/unit/admin-mcp.test.js`.
