# Flows — Automationen für ProjectFlow (Konzept, Phase 1)

Stand 2026-10-23 · Status: **umgesetzt und live** (Pakete 1–4, Freigabe „Alle 8 übernehmen“) · Owner-Entscheid: Regel-Baukasten
„Wenn → Falls → Dann“ mit Vorlagen, kein Power-Automate-Canvas. Der UI-Name ist **Flows**,
im Code und in Firestore heißt es `automations` (die Collection `flows` gehört zum abgeschafften
Ideen-Modul und bleibt unangetastet).

## 1. Was andere machen (Kurzrecherche, Stand Wissen 2026; Limits gerundet)
| Tool | Bausteine | UI | Limits / Schutz |
|---|---|---|---|
| Asana Rules | Trigger (+„und“-Trigger) → Aktionen; Bedingungen ab Business | Regel-Dialog pro Projekt, Galerie | Monatliches Kontingent je Tarif; Regeln lösen keine Regeln aus |
| Jira Automation | Trigger → Conditions (If/else) → Actions, Smart Values `{{issue.key}}` | vertikale Schrittliste, Audit-Log je Regel | Ausführungen/Monat je Tarif; „darf von anderen Regeln ausgelöst werden“ standardmäßig aus; Loop-Erkennung deaktiviert Regel |
| Linear | feste Workflow-Automationen (Git → Status, Auto-Close, Triage-Regeln) | Einstellungen statt Builder | keine freie Regel-Engine, dafür kaum Fehlerfälle |
| ClickUp | Trigger → Conditions → mehrere Actions, Vorlagen | Modal mit Galerie + „Custom“ | Aktionen/Monat je Tarif (Free ~100) |
| Monday | Satz-Rezepte „When X, then Y“ mit Lückenwörtern | Rezept-Galerie, Lückentext | Aktionen/Monat je Tarif; Aktivitätslog |

Übernommen: Satz-artige Lesbarkeit (Monday), vertikale Schrittliste + Run-Log (Jira), Galerie als
Einstieg (alle), „Flows lösen standardmäßig keine Flows aus“ (Asana/Jira), Kontingent pro Monat.

## 2. Bausteine
**Auslöser (genau einer pro Flow)** — Phase 1: Aufgabe erstellt · Status geändert (von/nach) ·
zugewiesen (an Person/beliebig) · Fälligkeit erreicht (am Tag, 08:00 Workspace-Zeit) · überfällig
(1 Tag danach) · Kommentar erstellt · Datei hochgeladen (`file.uploaded`, sobald „Dateien“ es emittiert) ·
Projekt-Mitglied hinzugefügt · Zeitplan (täglich / wöchentlich, Uhrzeit, Zeitzone) · manuell
(„Flow ausführen“, optional auf eine ausgewählte Aufgabe). Phase 2: eingehender Webhook.

**Bedingungen (optional, beliebig viele)** — Gruppen mit UND/ODER (eine Ebene: Gruppen intern
UND/ODER, zwischen Gruppen UND/ODER; keine Verschachtelung in Phase 1). Felder: Projekt, Status,
Priorität, Labels (enthält/enthält nicht), Zuständige (ist/enthält/leer), Ersteller, Auslösende
Person, Fälligkeit (vor/nach/in N Tagen/leer), Titel (enthält), ist Unteraufgabe. Operatoren:
`=`, `≠`, `in`, `enthält`, `leer`, `nicht leer`, `<`, `>`. Ausgewertet gegen den **aktuellen**
Dokumentstand (frisch gelesen), „von/nach“ gegen den Event-Diff.

**Aktionen (1–10, sequenziell)** — Feld setzen (Priorität, Fälligkeit relativ „+3 Tage“,
nächster Schritt) · zuweisen / Zuweisung entfernen (Person, Ersteller, Auslösender) · Status
ändern · Kommentar schreiben (Vorlagentext mit Variablen) · benachrichtigen (In-App/Push/E-Mail
über `notification-writer` + Prefs des Empfängers; nur Workspace-Mitglieder) · Aufgabe bzw.
Unteraufgabe erstellen · Label hinzufügen/entfernen · in anderes Projekt verschieben · KI-Schritt
(zusammenfassen → Kommentar; einordnen → Label/Priorität aus fester Liste) · Verzögerung (15 min
bis 30 Tage). Phase 2: Webhook aufrufen.

**Variablen** im Stil `{{task.title}}`, `{{task.url}}`, `{{task.assignees}}`, `{{actor.name}}`,
`{{project.title}}`, `{{ai.result}}`, `{{now.date}}`. Unbekannte Variablen → leerer String +
Warnung im Run.

## 3. Ausführung (serverseitig)
**Quelle:** der Ereignisstrom `tenants/{t}/activity/{eventId}` laut
`brain/plans/activity-events-contract.md` (v1, auf main seit 729bac1d). Genutzt werden `type`,
`actor {kind, automationId}`, `object {type,id,parentType,parentId}`, `projectId`, `changes`,
`meta`; Doc-IDs sind deterministisch. Trigger-Mapping: „Status geändert“ = `task.status_changed`
+ `task.completed`/`task.reopened`; „zugewiesen“ = `task.assigned` (`meta.assigneeIds`);
außerdem `task.created`, `comment.created`, `subtask.completed`, `project.member_added`,
`file.uploaded` (Files). Flows schreibt nur `automation.ran`/`automation.failed`.
**Kettenkontext:** `writeVia` trägt `runId` + `depth` (main 894164d1); jedes Event hat
`cause {kind, id, automationRunId?, depth}` (`causeOf(actor)`), Flows liest Tiefe und Herkunft
daraus. `meta.path` (optional) liefert die App-Route für Links in Benachrichtigungen.

**Ablauf:** `onAutomationEvent` (onCreate auf `activity/{eventId}`) → lädt aktive Flows des
Tenants mit passendem `trigger.type` (Query `enabled == true && trigger.type == X`, Projekt-Flows
gefiltert per `projectId`) → je Flow Run-Dokument mit **deterministischer ID**
`{automationId}_{eventId}` per `create()` (existiert es schon → Duplikat, Abbruch = Idempotenz
bei At-least-once-Triggern) → Bedingungen → Aktionen nacheinander. Zeit-Auslöser (fällig,
überfällig, Zeitplan) und Verzögerungen laufen über einen Scheduler `runAutomationSchedules`
(alle 15 min) mit Run-ID `{automationId}_{slot}`. Wartende Runs: `status: waiting`, `resumeAt`.

**Reihenfolge:** Innerhalb eines Runs strikt sequenziell; mehrere Flows auf dasselbe Event in
`order`-Reihenfolge, jeder in eigenem Run. Über Events hinweg keine Garantie (Firestore-Trigger
sind ungeordnet) — deshalb Bedingungen gegen den frischen Dokumentstand; eine Aktion, die nichts
ändern würde (Wert schon gesetzt), ist ein No-op und erzeugt kein Folge-Event.

**Schleifenschutz (vierfach):**
1. Jede Flow-Schreibaktion setzt `writeVia {kind:'automation', id, name, runId, depth, at}` im
   selben Write; der Trigger macht daraus `actor.kind = automation`. Ein Event mit
   `actor.automationId == X` löst X nie aus.
2. Andere Flows reagieren auf Flow-Events nur, wenn sie „durch Flows auslösbar“ aktiviert haben
   (Standard **aus**, wie Jira); dann gilt `depth ≤ 3`, darüber wird verworfen und protokolliert.
3. Drossel je Flow und Entität: höchstens 5 Runs pro Stunde pro Aufgabe.
4. Tenant-Burst (60 Runs/min) und Monatskontingent (unten). Treffer → Run `skipped_limit`.

**Rechte — Entscheidung: Workspace-Bot mit Ersteller-Obergrenze.** Ein Flow handelt als
Workspace-Bot (`actor.kind = automation`, angezeigt als „Flow: {Name}“), darf aber nur, was sein
**Verantwortlicher** (letzter Bearbeiter, `ownerId`) gerade darf; geprüft beim Speichern und bei
jedem Run (Rolle, Projektzugang via `canReachProject`). Verliert der Verantwortliche Zugriff oder
verlässt den Workspace, pausiert der Flow (`pausedReason: owner_lost_access`) und Admins werden
benachrichtigt. Begründung: Reine Ersteller-Identität lässt Aktionen wie Handlungen der Person
aussehen („Anna hat dir zugewiesen“ um 3 Uhr nachts), verschmutzt deren Aktivität und bricht beim
Austritt; ein reiner Bot ohne Obergrenze wäre Rechteausweitung (ein Member baut einen Flow, der in
Projekte schreibt, die er nicht sieht). Die Mischform ist Jiras „Actor + Rule owner“.

**Kontingente** (Konstante `AUTOMATION_LIMITS`, Override `tenants/{t}.limits.automations` durch
Plattform-Admin, bis es Tarife gibt): 50 aktive Flows/Workspace, 10 Aktionen/Flow,
2 000 Runs/Monat, 200 KI-Schritte/Monat (zählt zusätzlich gegen die KI-Policy, `enabled` muss
an sein). Zähler `automation_usage/{yyyy-mm}` per `FieldValue.increment`; ab 80 % Hinweis an
Admins, bei 100 % werden Runs `skipped_limit`.

**Fehler & Protokoll:** Runs speichern Status (`running|waiting|succeeded|failed|skipped_limit`),
je Schritt Ergebnis/Fehlertext, Dauer, auslösendes Event, `expireAt` (TTL 30 Tage). Runs, deren
Bedingungen nicht passen, werden nur gezählt (Kosten), nicht gespeichert — außer im Testlauf.
Transiente Fehler: 2 automatische Wiederholungen mit Backoff; danach `failed` und Button
„Erneut versuchen“ (Callable `retryAutomationRun`, setzt beim fehlgeschlagenen Schritt fort).
5 fehlgeschlagene Runs in Folge → Flow pausiert (`pausedReason: errors`), Verantwortlicher wird
benachrichtigt.

## 4. UI
- **Workspace:** Seitenleisten-Eintrag „Flows“ (legt „Aktivität & Insights“ per Feature-Flag an)
  → `/flows`: Liste mit Name, Auslöser-Satz, Projekt-Scope, Schalter aktiv, letzte Ausführung +
  Status, Fehler-Badge; Filter Workspace/Projekt; Leerzustand mit Vorlagen-Galerie.
- **Projekt:** Tab „Flows“ in den Projekteinstellungen (`/project/:id/flows`), gleiche Liste
  gefiltert, Anlegen vorbelegt mit dem Projekt.
- **Editor** `/flows/:id` (oder Vollbild-Modal): vertikale Karten **Wenn → Falls → Dann**, jede
  Karte liest sich als Satz („Wenn der Status sich zu *Review* ändert“), „+ Schritt“ zwischen
  Aktionen, Variablen-Picker in Textfeldern. Rechts/unten: **Vorschau** „Würde aktuell auf diese
  3 Aufgaben zutreffen“ (Bedingungen gegen Live-Daten, max. 20) und **Testlauf** (Trockenlauf
  mit gewählter Aufgabe: zeigt geplante Änderungen, schreibt nichts).
- **Protokoll** je Flow: Run-Liste mit Status, Dauer, Schritt-Details, „Erneut versuchen“.
- Vorlagen-Galerie (Phase 1, ≥ 8):
  1. Status „Erledigt“ → Ersteller benachrichtigen.
  2. Neue Aufgabe ohne Zuständige im Projekt X → Projekt-Owner zuweisen.
  3. Überfällig → Zuständige per Push + E-Mail erinnern.
  4. Priorität „Dringend“ gesetzt → Label `urgent` + Admins benachrichtigen.
  5. Status „Review“ → Reviewer zuweisen + Kommentar „Bitte prüfen“.
  6. Montags 09:00 → Aufgabe „Wochenplanung“ im Projekt erstellen.
  7. Neues Projekt-Mitglied → Willkommens-Aufgabe „Onboarding“ zuweisen.
  8. Neue Aufgabe → KI ordnet Label/Priorität ein.
  9. Kommentar mit „blockiert“ → Status „Blockiert“ + Projekt-Owner benachrichtigen.
  10. Fällig heute → Zuständige morgens benachrichtigen.
  11. Alle Unteraufgaben erledigt → Hauptaufgabe auf „Review“ (braucht Event `subtask.completed`).

**Rollen:** Workspace-Flows anlegen/bearbeiten: Owner/Admin. Projekt-Flows: Owner/Admin,
Projekt-Owner und — per Workspace-Schalter `automationPolicy.allowMemberFlows` (Standard an) —
Members mit Projektzugang. Guests sehen Flows gar nicht. Alle Mitglieder mit
Projektzugang sehen Projekt-Flows und deren Protokoll (lesend).

## 5. Daten
- `tenants/{t}/automations/{id}`: `name, description, scope: 'workspace'|'project', projectId?,
  enabled, trigger {type, config}, conditions {op: 'and'|'or', groups:[{op, rules:[{field, operator,
  value}]}]}, actions [{id, type, config}], allowAutomationTrigger, order, ownerId, createdBy,
  updatedBy, createdAt, updatedAt, templateId?, pausedReason?, stats {lastRunAt, lastStatus,
  consecutiveFailures, runsThisMonth}, schemaVersion: 1`.
- `tenants/{t}/automation_runs/{automationId}_{eventId|slot}`: `automationId, eventId?, trigger,
  entity, status, steps [{actionId, status, error?, output?}], depth, startedAt, finishedAt,
  resumeAt?, attempt, expireAt`.
- `tenants/{t}/automation_usage/{yyyy-mm}`: `runs, aiSteps, skipped`.
- Rules: Clients lesen `automations` gemäß Rollen; **Schreiben nur über Callables**
  (`saveAutomation`, `setAutomationEnabled`, `runAutomation`, `previewAutomation`,
  `retryAutomationRun`), weil Speichern die Rechte-Obergrenze validiert. Runs/Usage nur lesbar.
- Indexe: `automations (enabled, trigger.type)`, `automation_runs (automationId, startedAt desc)`,
  `automation_runs (status, resumeAt)`.

**Gesperrte Workspaces** (`tenants/{t}.suspendedAt`, Admin-Konsole, Helper `tenant-status.ts`): keine Event-Runs, Zeitpläne verbrauchen den Slot ohne Lauf, laufende/wartende Runs enden als `skipped_suspended`, alle Flow-Callables antworten `failed-precondition`.

## 5a. KI in Flows (Paket 5, 2026-10-23, User-Vorgabe „Decisions API + Structured Outputs als Standard“)
- **Bausteine** `functions/src/ai-decide.ts`: `aiDecide` (Decisions API `POST /v1/decisions`, `gpt-6-luna`, per
  `client.post`, weil das SDK `decisions` noch nicht kennt) und `aiGenerate` (Responses, `text.format` json_schema
  `strict: true`, geparstes JSON). Flows nutzt sie über die schmale Schnittstelle `flowAi` in `automations.ts`
  (im Emulator antwortet `_test/flowsAi`). Kontingent bleibt bei Flows: jeder KI-Aufruf = 1 von 200 KI-Schritten/Monat,
  KI-Policy des Workspaces muss an sein.
- **KI-Bedingung** (`rule.field = 'ai'`, max. 3 je Flow): `predicate` (Wahrscheinlichkeit ≥ Schwelle, Standard 80 %),
  `choice` (Antwort aus 2–10 Werten ∈ „weiter bei“, optional Mindest-Konfidenz), `score` (Skala 1–N, gewichteter Wert
  ≥ Schwelle; API liefert 0-basiert, wir zeigen 1-basiert). Dreiwertige Auswertung: Die KI wird nur gefragt, wenn
  die übrigen Regeln das Ergebnis offen lassen; alle KI-Fragen eines Flows gehen in **einen** Request. Ergebnis
  steht als `run.decisions` im Protokoll. Fehlt KI (Policy, Kontingent, Provider) → Lauf `failed` mit Grund.
  Vorschau listet solche Aufgaben mit „KI prüft im Testlauf“; der Testlauf je Aufgabe fragt die KI wirklich.
- **KI-Aktionen**: `summarize`, `draft_comment`, `draft_task` (Structured Outputs, festes Schema);
  `classify_priority`, `classify_label` (Decisions API `choice`, Anwenden ab Konfidenz, Standard 50 %).
- **Flow aus Satz**: Callable `draftAutomationFromText` → Structured Outputs im Schema `FLOW_DRAFT_SCHEMA`
  (`automation-draft.ts`, spiegelt die Engine; Mitglieder/Projekte als Id-Listen im Prompt) → `draftFromModel`
  validiert Teil für Teil (unbekannte Personen/Projekte, kaputte Aktionen fliegen mit Hinweis raus) → Entwurf
  ist immer **aus** und wird nur im Editor gezeigt, nie gespeichert.

## 6. Später (Phase 2+)
Visueller Canvas; Webhooks ein/aus (signiert, Secret pro Flow); Verzweigungen (If/Else);
Schleifen über Listen; MCP-Tools `list_flows`, `run_flow` (Audit + Rate-Limits des MCP-Servers);
Flow-Versionierung; Tarif-gebundene Kontingente; Initiativen/Meilensteine als Entitäten.

## 7. Umsetzungspakete (nach Freigabe)
1. Engine (`functions/src/automation-*.ts`: Matcher, Bedingungen, Aktionen, Schleifenschutz,
   Limits) + Callables + Rules + Unit- und Emulator-Tests (inkl. Schleife A→B→A, Duplikat-Event).
2. Editor-UI + Vorlagen + Vorschau/Testlauf.
3. Protokoll, Retry, Auto-Pause, Benachrichtigungen.
4. Seitenleiste freischalten, Doku (SITEMAP, COMPONENTS, PERMISSIONS, FIRESTORE_STRUCTURE).

## 8. Offene Entscheidungen (mit Empfehlung)
1. **Wer darf Projekt-Flows anlegen?** Empfehlung: Admins + Projekt-Owner + Members (abschaltbar).
2. **Rechte-Modell** Bot mit Ersteller-Obergrenze (oben). Alternative: nur Ersteller-Identität.
3. **Kontingent** 2 000 Runs / 200 KI-Schritte pro Monat und Workspace, bis Tarife existieren.
4. **E-Mail-Aktion nur an Workspace-Mitglieder** (keine freien Adressen, Spam-/Haftungsschutz).
5. **Verzögerungen in 15-min-Raster** (Scheduler statt Cloud Tasks) — genügt für PM-Fälle.
6. **Flow-Ketten standardmäßig aus**, pro Flow aktivierbar, Tiefe max. 3.
7. **Route `/flows`** neu belegen (alte Ideen-Route ist entfernt).
8. **Abhängigkeit:** erledigt — `cause` mit Tiefe ist im Vertrag (main 894164d1).
