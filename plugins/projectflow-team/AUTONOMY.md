# Autonomie-Playbook — ProjectFlow-Team

Wie die Agenten teil-selbstständig arbeiten, regelmäßig in ProjectFlow aktiv sind, Reports erstellen
und bei Bedarf neue Mitarbeiter einstellen. Gewählter Modus: **voll autonom mit Eskalation** —
Agenten handeln eigenständig im Rahmen ihrer Rechte und fragen Christoph **nur**, wenn sie unsicher sind
oder eine Entscheidung beim Menschen liegt.

## Takt
- **Täglich (Standup):** kurzer deterministischer Report (`agent-runner/report.mjs --mode daily`) +
  optionaler LLM-Arbeitszyklus (Carla sichtet, Agenten bewegen je 1–2 Tasks voran).
- **Wöchentlich (Freitag):** Wochenreport je Projekt (`report.mjs --mode weekly`).

Geplant über macOS `launchd` (deterministische Reports) und/oder einen Cowork-Trigger (LLM-Zyklus).

## Der tägliche Arbeitszyklus (LLM, als Agenten)
1. **Carla (Chief of Staff)** liest Stand: `list_tasks` / `list_activity` je aktivem Projekt.
2. Carla verteilt/aktualisiert: offene, überfällige oder unzugewiesene Tasks → `assign_task` / `create_task`.
3. **Fachagenten** bewegen ihre Tasks voran: `update_task` (Status/Fortschritt), `comment` (Notiz),
   neue Folgeaufgaben via `create_task`. Jede Aktion läuft unter der echten Identität des Agenten.
4. **Reports**: `post_report` (oder der deterministische Runner) → ProjectFlow-Task + Outbox.
5. **Eskalation** bei Unsicherheit: `raise_decision` → Eintrag in `00_Control_Tower/open_decisions.md`
   **und** ein Task, der Christoph zugewiesen wird. Agent macht solange an anderem weiter.

## Leitplanken (verbindlich)
- **Eskalieren statt raten:** Unklarheit, Risiko, kundenseitige Außenwirkung, Geld/Recht → `raise_decision`.
- **Kundenprojekte (VfR Skiclub, Feuerwehr):** kundensichtbare Inhalte/Antworten nie ohne Eskalation final machen.
- **Idempotenz:** wiederkehrende Tasks/Reports immer mit `external_key` (kein Duplizieren bei Re-Runs).
- **Keine Endlosschleifen:** pro Zyklus eine begrenzte Zahl Aktionen je Agent; sich nicht endlos selbst zuweisen.
- **Löschen ist tabu** ohne Eskalation (CS-Agenten haben ohnehin kein `tasks:delete`).
- **Audit:** jede Aktion ist über Urheber + ProjectFlow-Activity nachvollziehbar.

## Neue Mitarbeiter einstellen (Carla, autonom)
Carla darf bei echtem Bedarf `create_agent` aufrufen (z. B. neues Projekt → neuer PM).
- Legt echten Account + Token + Rolle an, optional Projektzuordnung.
- Nutzt intern einen **kurzlebigen** Admin-Key (wird sofort wieder entfernt).
- Carla dokumentiert jede Einstellung als Notiz/Report (wer, warum, welche Rechte).
- Empfohlene Rechte: PM = `tasks:*, projects:read/write, initiatives:read/write`; CS = ohne `tasks:delete`.

## Reports — wohin
- **ProjectFlow:** als Task (idempotent) im jeweiligen Projekt bzw. im ProjectFlow-Hauptprojekt.
- **Workspace-Outbox:** `04_Outbox/Reports/` als Markdown.

## Bausteine
- `agent-runner/report.mjs` — deterministischer Standup/Wochenreport (kein LLM-Risiko).
- `agent-runner/hire-agent.mjs` — autonome Provisionierung (kurzlebiger Key).
- `mcp/server.mjs` — Tools: list_*/create_task/assign_task/comment/get_task/update_task/list_activity/post_report/raise_decision/create_agent.
- `agent-runner/com.labestin.projectflow.*.plist` — launchd-Zeitpläne (siehe README).

## Orchestrierung, Subagenten & Code-Review
- **Carla entscheidet, wer ran muss:** feste Regeln in `orchestration/dispatch-matrix.md`.
  Sag „Neues Kundenprojekt X" → Carla klassifiziert, stellt fehlende Agenten via `create_agent` ein,
  legt Projekt + Tasks an und verteilt (`orchestration/new-project.md`).
- **Subagenten sparen Tokens:** sie lesen zuerst den kompakten Projekt-Kontext (`brain/`/`Brain/`,
  `AGENTS.md` oder falls vorhanden `<repo>/.team/CONTEXT.md`), nicht das ganze Repo,
  und liefern knappe Ergebnisse (`orchestration/subagent-guide.md`).
- **Doku bleibt aktuell:** `CONTEXT.md` (Wissen), `STATE.md` (Stand), `HANDOFF.md` (Übergabe) je Projekt +
  `00_Control_Tower/TEAM_STATE.md` (Überblick). Update-Pflichten in `orchestration/docs-and-handoff-rules.md`.
- **Kunden-Änderungen sicher:** Wunsch → CS → PM → Dev **auf Branch** → **Kai (Code Review)** → **du** (Merge/Deploy).
  Agenten fassen nie `main`/Prod an (`orchestration/customer-change-request.md`).

## Gezielt mit einem Mitarbeiter chatten (Briefing-Fäden)
Jeder Agent hat einen persistenten **Briefing-Faden** in ProjectFlow (Task „📥 Briefing: <Agent>").
- Du gibst Infos: im ProjectFlow-Task kommentieren (auch mobil) **oder** `brief_agent(agent, message)`.
- Der Agent liest (`read_briefing`), handelt, **sichert Dauerwissen im Repo-`brain/`** (sonst `.team/CONTEXT.md`) und meldet zurück (`reply_briefing`).
- Trennung: **Faden = Gespräch, `brain/` = Gedächtnis.** Details: `orchestration/brain-and-briefings.md`.

## Kill-Switch (Not-Aus)
Eine zentrale Datei steuert alles: `AUTONOMY_STATE.json` (`enabled: true|false`).
Wenn deaktiviert, passiert **nichts** automatisch:
- geplante Reports (`report.mjs`) brechen sofort ab,
- alle **schreibenden** MCP-Tools (create/assign/comment/update/post_report/raise_decision/create_agent) werden blockiert,
- das Einstellen neuer Agenten (`hire-agent.mjs`) wird verweigert.
Lesende Tools (Listen/Status) bleiben erlaubt. **Aktuell: DEAKTIVIERT.**

Umschalten (im Plugin-Ordner):
- Status: `node killswitch.mjs status`
- Pausieren: `node killswitch.mjs off "Grund"`
- Aktivieren: `node killswitch.mjs on`
In Claude prüfbar über das read-only Tool `autonomy_status`. (Agenten können sich NICHT selbst wieder aktivieren — das geht nur per CLI durch dich.)

## Manuell auslösen
- Standup jetzt: `node agent-runner/report.mjs --mode daily`
- Wochenreport: `node agent-runner/report.mjs --mode weekly`
- In Claude: „Carla, fahr den täglichen Arbeitszyklus" (nutzt die MCP-Tools nach diesem Playbook).
