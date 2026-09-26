# ProjectFlow Team — AI-Mitarbeiter als echte Workspace-Mitglieder

Macht aus den 9 AI-Rollen (Carla, Mara, Paul, Theo, Uma, Quinn, Felix, Rosa, Nina)
**echte Mitglieder** deines ProjectFlow-Workspaces: eigene Accounts, Avatare, Rollen –
und sie legen sich gegenseitig Tasks an und weisen sie zu. Es soll sich anfühlen, als
arbeite ein Team im Projekt.

Zwei Teile, die ineinandergreifen:

1. **Seed** (`seed/`) – einmaliger Lauf. Legt Accounts, Mitgliedschaften, Per-Agent-API-Tokens
   und einen gelebten Backlog an.
2. **MCP-Server** (`mcp/`) – Dauerbetrieb. Lässt Claude/Codex „als Mara einen Task anlegen und
   an Theo zuweisen" als echten Tool-Call ausführen.

> **Warum kein App-Umbau?** ProjectFlow ist bereits multi-member-fähig
> (`assigneeId`/`assigneeIds`) und hat eine HTTP-API mit `tasks:write`. Verifiziert: Ein per
> API-Token erstellter Task wird dem `createdBy` des Tokens zugeschrieben
> (`functions/src/authUtils.ts` → `actorId`). Setzt man `createdBy = <Agenten-UID>`, erscheinen
> Tasks **wirklich als von diesem Agenten** erstellt. Deshalb: ein Token pro Agent, korrekt attribuiert.

---

## Was du brauchst

- **Node.js ≥ 18**
- **Firebase Service-Account-JSON** für Projekt `projectflow-labestin`
  (Firebase Console → Projekteinstellungen → Dienstkonten → „Neuen privaten Schlüssel generieren").
  Rolle: Firebase Admin / Editor.
- **Tenant-ID** (Workspace) – i. d. R. deine Owner-UID des Workspaces.
- **Projekt-ID** für den Backlog (z. B. das Tracking-Projekt `ogZ8Pyz8pwEQtv8I64nu`
  oder ein eigenes „Team"-Projekt).

Service-Account-JSON **niemals committen** – `.gitignore` schützt `sa.json`/`service-account*.json` bereits.

---

## Schritt 1 – Seed (Accounts, Tokens, Backlog)

```bash
cd plugins/projectflow-team/seed
npm install                      # firebase-admin

# 1) Trockenlauf – zeigt ALLES, schreibt NICHTS (braucht nicht mal Credentials):
node seed.mjs --tenant <TENANT_ID> --project <PROJECT_ID>

# 2) Echt schreiben (Produktiv):
node seed.mjs \
  --service-account ./sa.json \
  --tenant <TENANT_ID> \
  --project <PROJECT_ID> \
  --confirm-prod
```

Ergebnis: 9 Accounts + Profile/Avatare + Mitgliedschaften + Custom-Rollen + 9 API-Tokens, dazu
12 cross-zugewiesene Tasks mit Kommentaren. Die Tokens landen in **`mcp/tokens.json`**
(geheim, .gitignore-t). Der Lauf ist **idempotent** – erneutes Ausführen aktualisiert statt zu duplizieren.

Nützliche Flags: `--skip-backlog` (nur Accounts), `--no-roles` (keine Custom-Rollen),
`--api-base <url>` (falls Custom-Domain statt Functions-URL).

### Rückgängig machen

```bash
node teardown.mjs --service-account ./sa.json --tenant <TENANT_ID> --confirm-prod
# zusätzlich Auth-User löschen: --delete-auth
```

---

## Schritt 2 – MCP-Server (laufender Betrieb)

```bash
cd plugins/projectflow-team/mcp
npm install                      # @modelcontextprotocol/sdk
PF_TOKENS=./tokens.json node server.mjs   # Schnelltest (stdio)
```

### In Claude / Cowork registrieren

MCP-Config-Eintrag (Pfade anpassen):

```json
{
  "mcpServers": {
    "projectflow-team": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/plugins/projectflow-team/mcp/server.mjs"],
      "env": {
        "PF_TOKENS": "/ABSOLUTER/PFAD/plugins/projectflow-team/mcp/tokens.json"
      }
    }
  }
}
```

### Verfügbare Tools

| Tool | Zweck |
|---|---|
| `list_agents` | Wer ist verfügbar (Keys/Namen für `as_agent`) |
| `list_projects(as_agent)` | Projekte des Agenten |
| `list_tasks(as_agent, project_id?)` | Alle Tasks eines Projekts |
| `list_my_tasks(as_agent, project_id?)` | Tasks, die dem Agenten zugewiesen sind |
| `create_task(as_agent, title, …)` | Task anlegen – als dieser Agent |
| `assign_task(as_agent, task_id, assign_to[])` | Task (neu) zuweisen |
| `comment(as_agent, content, task_id?)` | Kommentar als Agent |

`as_agent` und `assign_to` akzeptieren Key (`mara`), Vorname (`Mara`) oder UID.
`project_id` ist optional, wenn in `tokens.json` ein Default-Projekt steht.

**Beispiel-Aufrufe (natürliche Sprache an Claude):**
- „Lass **Paul** einen Task ‚Login-Bug fixen' anlegen und an **Theo** zuweisen."
- „**Carla**, zeig mir alle offenen Tasks im Projekt."
- „**Uma**, kommentiere Task X mit ihrer UX-Einschätzung."

---

## Sicherheit & Grenzen

- Tokens sind **tenant-scoped** und nur so mächtig wie die `permissions` in `agents.config.json`.
- `tokens.json` und Service-Account-JSON sind geheim → `.gitignore` aktiv.
- Der MCP-Server geht bewusst über die **HTTP-API** (nicht Admin-SDK), damit echte
  Seiteneffekte (Benachrichtigungen, Activity-Feed, Permission-Checks) greifen.

## Offene Verifikationspunkte (`Needs verification:`)

- **Comments-Body:** Server erwartet Feld `content` (verifiziert). Ob `taskId`/`entityId` als
  Task-Verknüpfung gespeichert wird, hängt von `extractMutableFields` ab – im Zweifel erscheint der
  Kommentar projektweit statt am Task. Nach dem ersten echten Lauf am Board prüfen.
- **Status-Werte:** `Open/In Progress/Done/Blocked` angenommen. Falls die App andere Labels nutzt,
  in `backlog.seed.json` anpassen.
- **Custom-Rollen-Anzeige:** Rollen werden in `/tenants/{t}/roles` angelegt und via `roleIds`
  referenziert; visuelle Darstellung im UI nach erstem Lauf gegenprüfen.

## Dateien

```
plugins/projectflow-team/
├── agents.config.json        # 9 Agenten: Name, Funktion, Rolle, Permissions
├── README.md
├── .gitignore
├── seed/
│   ├── seed.mjs              # Accounts + Tokens + Backlog (Dry-Run default)
│   ├── teardown.mjs          # Rückbau
│   ├── backlog.seed.json     # gelebter Backlog (Tasks, Zuweisungen, Kommentare)
│   └── package.json
└── mcp/
    ├── server.mjs            # MCP-Server (stdio) über die HTTP-API
    ├── tokens.example.json   # Beispiel; echte tokens.json erzeugt der Seed
    └── package.json
```
