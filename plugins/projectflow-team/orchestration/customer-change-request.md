# Workflow: Kunden-Änderungswunsch → Umsetzung → Review

**Auslöser:** eine Nachricht/Anforderung von einem Kunden (z. B. VfR Skiclub).
**Intake (v1):** Der Wunsch landet als **ProjectFlow-Task** im Kundenprojekt (oder als Datei in `03_Inbox/`).
Du kannst ihn auch einfach in den Chat geben: „Vom VfR Skiclub kam: …".

## Ablauf
1. **Customer Service** nimmt an: Task anlegen/aktualisieren, Anforderung in klare Punkte fassen, Rückfragen sammeln.
2. **PM** scopet: Was genau, Akzeptanzkriterien, Aufwand grob, Non-Goals. Bei Unklarheit → `raise_decision`.
3. **Theo/Dev** setzt um — **NUR auf einem Branch**:
   - Branch `agent/<kurz-beschreibung>` vom aktuellen Stand.
   - Änderungen umsetzen; Repo-Konventionen aus `<repo>/AGENTS.md`/`brain`/`.team/CONTEXT.md` beachten.
   - Tests/Build lokal laufen lassen.
   - **Niemals** nach `main` committen, **niemals** deployen, keine Secrets/Produktivdaten anfassen.
4. **Kai / Code Review** prüft den Diff (Checkliste in `01_Agents/Kai_Code_Reviewer/`): erfüllt die Änderung den Wunsch? Tests grün? Konventionen? Sicherheit? Scope? → Verdict **approve / needs-changes**.
   - Bei needs-changes zurück an Dev (max. 1–2 Runden), sonst eskalieren.
   - Datenschutz/rechtlich relevant? → **Lara** zusätzlich.
5. **Handoff an Christoph:** Zusammenfassung (was geändert, welche Dateien, Tests, offene Punkte, Branch-Name) als
   `raise_decision` → dir zugewiesener ProjectFlow-Task + Eintrag in `04_Outbox/Decisions/`. Status: „bereit zum Review".
6. **Du** reviewst, mergst und deployst (oder gibst frei, dass ein Agent den Merge vorbereitet — nie automatisch).

## Antwort auf deine Frage
Ja: Ein Agent kann auf einen Kundenwunsch reagieren und die Änderung **selbstständig auf einem Branch** umsetzen,
sie wird von **Kai** vorab verifiziert, und du bekommst nur noch ein sauberes „bitte reviewen" mit Branch + Diff-Summary.
Der Agent merged/deployt nicht — die letzte Kontrolle bleibt bei dir.
