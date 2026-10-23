# Dateien & Dokumente — Konzept (2026-10-23)

Ziel: Dateien an Aufgaben, Projekten, Kommentaren und Wiki-Seiten anhängen; eine Übersicht
`/files` zeigt jedem Nutzer alle Dateien, auf deren Objekt er Zugriff hat. `/media` geht darin auf.

## Bestand (wird erweitert, nicht ersetzt)
- `tenants/{t}/files/{fileId}` + Callables in `functions/src/file-storage.ts`
  (`createTenantFileUploadSession` → signierter Upload → `finalizeTenantFileUpload`), Provider
  Firebase/S3/Google Drive pro Workspace. Genutzt von Medien (`module: 'media'`), Projekt-Cover/Icons,
  Avataren und Desktop-Anhängen (`entityType: 'task-attachment'`, Link landet im Kommentar).
- Lücken: `files` war für alle Mitglieder inkl. Gäste lesbar, Storage gab allen Nicht-Gästen alle
  Tenant-Pfade; keine Versionen, kein Papierkorb, kein Kontingent, keine Typ-Blockliste.

## Datenmodell (zusätzliche Felder am bestehenden Datei-Dokument)
- `listed: true` — Dokument erscheint in der Übersicht (System-Assets wie Avatare bleiben `false`).
- `parent: { type: task|initiative|project|comment|doc|workspace, id, projectId|null, rootType, rootId, title }`
  `rootType/rootId` = Objekt, an dem man landet (bei Kommentaren die Aufgabe). Eine Abfrage
  `projectId == p && parent.rootId == taskId` liefert Aufgaben- und Kommentardateien zusammen.
- `projectId` (top-level, wie bisher) trägt die Rechte. `null` = Workspace-Datei.
- `name` (anzeigbar, umbenennbar), `nameLower`, `folder` (Pfad, `''` = Wurzel), `tags[]`.
- `version` (n), `versions[]` (ältere Stände: `{ version, sizeBytes, mimeType, providerRef, createdBy, createdAt }`),
  `versionBytes` (Summe älterer Stände für das Kontingent).
- `status: ready | trashed`, `trashedAt`, `trashedBy`; endgültig gelöscht = Dokument + Objekte weg.
- `uploaderName` (denormalisiert für Liste/Filter).
- Storage-Pfad Firebase: `tenants/{t}/files/files/{projectId|global}/{parentType}/{parentId}/{ts}_{uuid}_{name}`.
- Legacy-Medien (`module: 'media'`) und Desktop-Anhänge werden in der Übersicht abgeleitet angezeigt
  (`parent` aus `entityType/entityId`). Migration (Felder `listed/parent` nachtragen) nur nach Rückfrage.

## Rechte
- Datei erbt die Rechte ihres Objekts: `projectId != null` → `canAccessProjectById` (Nicht-Gäste
  sehen wie bei Projekten alle Projekte, Gäste nur Projekte mit `memberIds`); `projectId == null`
  → nur Nicht-Gäste. Gleiche Regel in Firestore (`files`) und Storage (`tenants/{t}/files/{module}/{scope}/**`,
  `scope == 'global'` → Nicht-Gast, sonst Projektzugriff über `firestore.get`).
- Schreiben nur über Callables (Firestore `write: false`, Storage-Dateipfade `write: false`;
  Upload läuft über signierte URLs). Downloads: kurzlebige signierte URLs (15 min) nach Rechteprüfung.
- Hochladen: wer das Objekt sehen darf (auch Gäste in ihren Projekten). Umbenennen/Verschieben/
  Papierkorb/neue Version: Uploader, Projekt-Owner, Workspace Owner/Admin. Endgültig löschen:
  Uploader oder Owner/Admin.
- Gäste-Abfragen filtern immer `projectId ==` (Rules müssen die Query beweisen können).

## Limits (serverseitig in `createTenantFileUploadSession`/`finalize`)
- 50 MB pro Datei (wie bisher). Kontingent pro Workspace: `entitlements/plan.storageQuotaBytes`,
  Standard 5 GB; Verbrauch = Aggregat `sum(sizeBytes) + sum(versionBytes)` über `files`.
- Blockliste ausführbarer/aktiver Typen (Endung + MIME): exe, msi, bat, cmd, com, scr, ps1, sh,
  app, dmg, pkg, apk, jar, dll, js, html, svg, hta, lnk, reg … Prüfung beim Session-Start und
  beim Finalisieren gegen die echten Objekt-Metadaten.

## Callables (neu: `functions/src/files-manager.ts`)
- Upload: `createTenantFileUploadSession` nimmt `parent`, `replaceFileId` (neue Version).
- `getTenantFileUrls({ fileIds, download? })` (Batch, Rechte je Datei), `updateTenantFile`
  (name, folder, tags, Verschieben in anderes Projekt/Workspace), `trashTenantFile`,
  `restoreTenantFile`, `purgeTenantFile`, `getWorkspaceFileQuota`.

## Oberfläche (`web/components/files/`)
- `FileAttachments` — Panel für ein Objekt: Drop-Zone, Einfügen aus Zwischenablage, Dateiauswahl,
  Liste mit Vorschau/Aktionen. In Task-Detail, Kommentaren (Composer + Anzeige je Kommentar) und
  Projekt-Tab `/project/:id/files`.
- `FilePreviewModal` (Bild, PDF, Video, Audio, Text), `FileActionsMenu` (Vorschau, Download, Link
  kopieren = App-Deeplink `/files?file=<id>`, Umbenennen, Neue Version, Verschieben, Papierkorb).
- `/files` „Dokumente“: Liste/Raster, Suche, Filter (Projekt, Typ, Uploader, Zeitraum, Objekt),
  Sortierung, Papierkorb mit Wiederherstellen + endgültigem Löschen (geteilter Bestätigungsdialog),
  Kontingent-Anzeige, Sprung zum Ursprungsobjekt. `/media` → `/files?type=image`.
- Seitenleiste: Eintrag „Dokumente“ wird von „Aktivität & Insights“ per Feature-Flag angelegt;
  bis dahin ersetzt der bestehende Medien-Eintrag den Link auf `/files`.

## Schnittstelle für das Wiki
- Anhängen: `<FileAttachments tenantId parent={{ type: 'doc', id: docId, projectId }} />` — fertiges Panel.
- API (`web/services/filesService.ts`): `uploadFiles({ tenantId, parent, files })`,
  `subscribeParentFiles({ tenantId, projectId, rootId }, cb)`, `getFileUrls(tenantId, ids)`,
  `trashFile`, `FileItem`-Typ.
- Einbetten: Wiki speichert nur die `fileId` (z. B. Knoten `{ type: 'file', fileId }`), rendert mit
  `<FileEmbed tenantId fileId />` (Bild inline, sonst Karte mit Vorschau). Keine URLs speichern —
  signierte URLs laufen ab; Rechte bleiben am Wiki-Objekt (`parent.type = 'doc'`, `projectId` des Docs).

## Events (später)
`file.uploaded`, `file.version_added`, `file.renamed`, `file.moved`, `file.trashed`, `file.restored`,
`file.deleted` — aus den Callables, sobald `brain/plans/activity-events-contract.md` auf main ist.

## Offene Folgepunkte
- Waisen beim Löschen von Aufgabe/Projekt (Trigger → Papierkorb). Migration Legacy-Medien/Anhänge.
- iOS-Anbindung über die iOS-Session (gleiche Callables).
