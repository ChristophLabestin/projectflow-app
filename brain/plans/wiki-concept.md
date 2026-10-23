# Wiki & Docs — Konzept (2026-10-23)

Workspace-Wiki und Projekt-Wikis mit einem Notion-artigen Editor, der sich ruhig anfühlt:
Seitenbaum links, Seite in Lesebreite mittig, Inhaltsverzeichnis/Backlinks rechts.

## Bereiche und Rechte
- `spaceType: 'workspace'` — Workspace-Wiki unter `/wiki`, `/wiki/:docId`. Nur volle Mitglieder
  (Owner/Admin/Member) lesen und schreiben; Gäste sehen es nicht.
- `spaceType: 'project'` + `projectId` — Projekt-Wiki als Projekt-Tab `/project/:id/wiki(/:docId)`.
  Zugriff wie Projekt-Aufgaben: volle Mitglieder + Gäste, die Projektmitglied sind (lesen + schreiben,
  wie bei Tasks). Endgültiges Löschen aus dem Papierkorb: Ersteller oder Owner/Admin.
- Vorlagen (`docTemplates`) verwalten nur volle Mitglieder; Gäste nutzen die eingebauten.

## Datenmodell (Firestore)
`tenants/{t}/docs/{docId}` — **nur Metadaten**, damit der Seitenbaum günstig als Live-Liste lädt:
`tenantId, spaceType, projectId|null, parentId|null, order (float), title, icon, coverColor?,
excerpt (≤200), searchText (lowercase, ≤6000 Zeichen), bodyChunks, bodyRev, bodySize,
linkedTaskIds[], linkedTaskRefs[] ("projectId/taskId"), outLinks[] (erwähnte docIds),
mentionedUserIds[], createdBy, updatedBy, createdAt, updatedAt, archivedAt|null, archivedBy`.

`docs/{docId}/body/{n}` — Editor-JSON als String in Stücken à ≤300k UTF-16-Zeichen (≤900 KB, `{ i, data }`).
Lange Seiten (Bilder sind Storage-URLs, nicht Base64) brauchen fast nie mehr als ein Stück; die
Strategie hält das 1-MiB-Limit trotzdem für jede Länge ein. Schreiben = ein Batch (Stücke + Meta +
`bodyRev+1`), überzählige Stücke werden im selben Batch gelöscht.

`docs/{docId}/versions/{v}` — Snapshot `{ data, title, size, createdBy, createdAt, reason }`
(`autosave` höchstens alle 10 Min. pro Seite, `manual` per ⌘/Strg+S, `restore`, `before-restore`, `conflict`). Über 300k Zeichen
wird nur Titel + Hinweis gesichert. Behalten werden die letzten 50 (Client räumt beim Anlegen auf).

`docs/{docId}/editors/{uid}` — Präsenz-Herzschlag `{ uid, name, photoURL, at }` alle 25 s.

`tenants/{t}/docTemplates/{id}` — eigene Vorlagen `{ name, description, icon, data, createdBy }`.
`tenants/{t}/users/{uid}/prefs/wiki` — `{ favorites: docId[], recent: [{docId, at}] }`.

## Gleichzeitiges Bearbeiten — Entscheidung
Kein Echtzeit-Co-Editing. Sauberes CRDT (Yjs + y-prosemirror) bräuchte einen Sync-Server
(Hocuspocus/WebSocket) oder ein selbstgebautes Firestore-Update-Log mit Kompaktierung — beides
weder günstig noch klein, und Firestore-Writes pro Tastendruck wären teuer. Stattdessen:
1. **Präsenz:** „X bearbeitet gerade" (Avatare im Kopf) aus `editors/*` mit Zeitstempel < 60 s.
2. **Konfliktschutz:** Speichern prüft per Transaktion `bodyRev`. Hat jemand anders inzwischen
   gespeichert, wird nichts überschrieben: Banner „Neuere Fassung von X" mit *Neu laden* oder
   *Meine behalten* (die fremde Fassung landet vorher als Version → nichts geht verloren).
Echtes Co-Editing bleibt ein späterer Schritt (Hocuspocus auf Cloud Run), falls Teams es brauchen.

## Editor (Tiptap 3, schon im Bundle durch den Blog-Editor)
Kein zweiter Editor. Der Blog-`AdvancedEditor` ist auf E-Mail/Blog-Blöcke zugeschnitten, daher ein
eigener `WikiEditor` auf derselben Tiptap-Basis, ergänzt um die offiziellen Pakete
`extension-table`, `extension-mention`, `extension-details` (gleiche Version 3.14).
- Slash-Menü (`/`), Markdown-Shortcuts (StarterKit-Inputrules: `#`, `-`, `1.`, `[]`, `>`, ```` ``` ````),
  H1–H3, Listen, Checklisten, Tabellen, Code, Callout (info/erfolg/warnung/gefahr), Toggle, Trenner,
  Bild (Upload über `fileStorageService`), Datei-Block, Aufgabenliste (Filter), Inhaltsverzeichnis.
- `@`-Erwähnungen: Personen, Aufgaben, Projekte, Seiten → Chips, die live Titel/Status auflösen.
- Datei-Block `fileEmbed` mit Attributen `{ fileId, name, size, mimeType, url }` und der
  Schnittstelle `WikiFileProvider` (`pick() → WikiFileRef`, `resolve(fileId) → url`). Bis die
  Session „Dateien" liefert, lädt der Platzhalter-Provider über den bestehenden Upload-Service.
- Autosave 1,2 s nach der letzten Änderung, Statusanzeige „Gespeichert".

## Verknüpfung
- Seite ↔ Aufgabe: `linkedTaskRefs` (explizit über „Mit Aufgabe verknüpfen" und automatisch aus
  Aufgaben-Erwähnungen). Task-Detail zeigt „Verknüpfte Docs" per `array-contains`.
- Backlinks: Seiten, deren `outLinks` die aktuelle Seite enthalten.

## Vorlagen
Eingebaut (lokalisiert): Meeting-Notiz, Projekt-Brief/Spezifikation, Retro, Entscheidungs-Log,
Onboarding. Eigene: „Als Vorlage speichern" aus jeder Seite.

## KI (`runAiCapability` → OpenAI; Fähigkeiten `wikiSummarize`, `wikiImprove`, `wikiExtractTasks` in `functions/src/ai-capabilities.ts`)
Zusammenfassen, Text verbessern (Auswahl oder Seite), Aufgaben aus Text. Ergebnis immer erst in
einem Vorschau-Dialog; Einfügen/Anlegen erst nach Bestätigung, Aufgaben einzeln abwählbar.

## Suche
Globale Suche (`GlobalSearch`) lädt bereits einen Client-Index (Projekte/Aufgaben/Initiativen);
Docs kommen als eigener Abschnitt dazu (Titel + `searchText`). Im Wiki zusätzlich Schnellsuche.

## Events (umgesetzt)
Trigger `onWikiDocWritten` (`functions/src/wiki-triggers.ts`, Logik `wiki-logic.ts`): `doc.created`, `doc.updated`
(gedrosselt über den Idempotenz-Schlüssel: 1 pro Seite+Person je 10-Min.-Fenster), `doc.archived`, `doc.restored`,
`doc.deleted`; `meta.path` öffnet die Seite. Projektseiten setzen `projectId` (Gäste sehen sie).

## Schnittstelle für andere Features
`createWikiPageFromMarkdown(tenantId, { space, title, markdown, parentId?, icon?, linkedTaskRefs? })` in
`web/services/wiki/wikiService.ts` (Markdown → Tiptap über `wikiMarkdown.ts`: Überschriften, Listen, Checklisten,
Zitate, Code, Trenner, **fett**, *kursiv*, `code`, Links). Gibt die docId zurück.

## MCP-Tools (Vorschlag, Umsetzung durch KI-Session)
`search_docs(query, space?)`, `get_doc(docId)` (Markdown-Export), `list_docs(space, parentId?)`,
`create_doc(title, markdown, space, parentId?, templateId?)`, `update_doc(docId, markdown|append)`,
`link_doc_to_task(docId, taskId)`, `get_task_docs(taskId)`.

## Offene Folgepunkte
Echtzeit-Co-Editing; Volltext über Server-Index (Typesense/Algolia) ab vielen Seiten; Export
(Markdown/PDF); Seitenrechte feiner als der Bereich; iOS-Leseansicht.
