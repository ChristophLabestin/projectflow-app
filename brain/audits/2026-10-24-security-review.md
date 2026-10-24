# Security-Review 2026-10-24: neue Bereiche (23./24.10.)

Scope: Dateien, Wiki, Flows, Aktivität & Insights, Billing, In-App-KI, Admin-Konsole/Admin-MCP,
E-Mail, Rechtsdokumente. Methode: Code- und Regel-Review entlang konkreter Angriffe (fremder
Tenant, Gast, entferntes Mitglied, gesperrter Workspace, Free-Plan, abgelaufenes Token).
Kritisch/hoch sind gefixt (Commit `51c30be9`, deployt: `firestore:rules` + betroffene Functions).

## Kritisch (gefixt)

**C1 – tenantId-Pfad-Injection (systemisch).** Callables setzten die Client-`tenantId` ungeprüft in
Pfade ein (`tenants/${tenantId}/members/${uid}`). Jeder Nutzer darf unter
`tenants/OWN/users/<uid>/**` (eigener Workspace) bzw. `projects/{p}/{sub}/**` (Gäste) beliebig
schreiben. Mit `tenantId = "OWN/users/<uid>"` ließen sich Mitgliedschaft (Owner), KI-Policy
(`inAppAi: true`) usw. fälschen; fehlende Entitlement-Doc = Legacy-Grace (Team, KI für alle).
Folge u. a.: `aiAssist` mit Plattform-OpenAI-Key ohne Kontingent/Credits (mit BYOK-Key sogar ohne
Tageslimit). Fix: `functions/src/tenant-id.ts` (`isValidTenantId`, `memberRef`) für alle
Mitgliedschafts-Lookups, `aiAssist` und REST-API lehnen ungültige IDs ab, `isTenantSuspended`
behandelt ungültige IDs als gesperrt (deckt alle `assertTenantActive`-Pfade ab).
Test: `functions/scripts/unit/tenant-id.test.js`.

## Hoch (gefixt)

- **H1 – `listTenantFiles` ohne Scope.** Ohne `module` reichte jede Mitgliedschaft (auch Gast):
  alle Dateien des Workspaces inkl. Finanz-Belege, mit dauerhaften Download-Token-URLs. Fix: jede
  Zeile wie ein Einzel-Read prüfen (Managed: `canReadScope`, Legacy: Modulrecht), Managed-Dateien
  bekommen die 15-min-Signed-URL.
- **H2 – `getTenantFirebaseStorageDownloadUrl`** prägte für jeden Pfad im Tenant dauerhafte
  Tokens (Gäste inklusive, nicht widerrufbar). Fix: `files/`-Pfade nur über den Datei-Datensatz
  mit Scope-/Modulprüfung (Managed → Signed URL), sonst `tenant.media.view` (keine Gäste).
- **H3 – Unendliche Team-Testphase.** `createdAt` am Tenant ist client-geschrieben; ein Datum in
  der Zukunft verlängerte den 14-Tage-Trial beliebig. Fix: `trialStartMs` (nie später als
  Server-Create-Time), Test in `tenant-id.test.js`.
- **H4 – Flow-Kontingente selbst erhöhbar.** Workspace-Admins durften `tenants/{t}.limits`
  (Plattform-Override für Flows) schreiben. Fix: `limits` und `isReviewAccount` in der
  Tenant-Regel gesperrt; Regeltests ergänzt (247/247 grün).

## Mittel (offen, gemeldet)

| # | Bereich | Befund | Ort | Vorschlag |
|---|---|---|---|---|
| M1 | Dateien | Legacy-Upload (`module != 'files'`) ohne Quota, Typ-Blockliste, Plan-Maximalgröße; `projectId` ohne Projektprüfung | `file-storage.ts` (Upload-Session/Finalize Legacy-Pfad) | Checks des Managed-Pfads für alle Module |
| M2 | Dateien | Signed PUT-URL ohne `x-goog-content-length-range`; Quota nur bei Session, nicht bei Finalize (parallele Sessions) | `file-storage.ts` (Upload-Target, Finalize) | Längenbereich signieren, Quota im Finalize transaktional |
| M3 | Storage | `tenants/{t}/{segment}/**` für jedes Vollmitglied les-/schreibbar, ohne Quota und ohne Sperr-Check | `storage.rules` | Segmente allowlisten, `suspendedAt` prüfen |
| M4 | Billing | Admin/Owner kann `members/{uid}` direkt anlegen bzw. Gast→Member hochstufen → Plätze/Member-Limit umgangen; Seat-Check im Invite außerhalb der Transaktion | `firestore.rules` members, `invitations.ts` | Member-Create nur serverseitig, Seat-Check in der Transaktion |
| M5 | Flows | ✅ **Behoben 2026-10-24:** Flows ignorierten gesperrte Projekte (Free über Limit) | `automations.ts` (Task-Patch/Create/Move/Comment) | Fix: `assertWritable` gegen `entitlements/plan.lockedProjectIds` vor jedem Schreiben (Patch, Kommentar, Aufgabe/Unteraufgabe, Verschieben Quelle+Ziel, auch im Testlauf) → Schritt `failed` mit `plan-project-locked`; Emulator-Test |
| M6 | Flows | ✅ **Behoben 2026-10-24:** Rechte des Flow-Owners wurden zur Laufzeit nicht neu bewertet (Herabstufung, `allowMemberFlows` aus); `ownerCanReachProject` toter Code | `automations.ts` `executeRun` | Fix: `ownerMayRun` (= `canManageAutomation` + Projekt existiert) bei jedem Lauf; sonst Lauf `failed`, Flow pausiert (`owner_lost_access`), Admins benachrichtigt; toter Code entfernt; Unit- + Emulator-Test |
| M7 | KI | Aktionskarte zeigt 400 Zeichen, angewendet wird der volle Text (bis 8000) | `ai-actions.ts` `clipValue` | Volltext zeigen oder ablehnen |
| M8 | KI | `consumeAiQuota` überspringt Tageslimit für BYOK-Nutzer auch bei Server-KI | `ai-service.ts` | Modus aus Tenant-Gate übergeben |
| M9 | E-Mail | Workspace-SMTP: Host/Port beim Senden ungeprüft (SSRF ins interne Netz); IPv4-mapped-IPv6-Hex nicht geblockt | `email.ts` `sendViaSmtp`, `workspace-admin.ts` | Public-IP- und Port-Check beim Speichern und Senden |
| M10 | E-Mail | Waitlist/Newsletter ohne Rate-Limit (Mail-Bombing über SES), Codes per `Math.random` | `waitlist.ts`, `newsletter-public.ts` | Cooldown pro E-Mail/IP, `crypto.randomBytes` |
| M11 | Admin-MCP | DCR offen, Rate-Limit per XFF spoofbar und nur im Speicher → Clients/Audit fluten | `admin-console/mcp/oauth.ts` | Firestore-Zähler, echte Peer-IP, Pending-Cap |

## Niedrig (offen, gemeldet)

- Flows: `writeVia` auf Tasks/Kommentaren client-fälschbar (Attribution, Ketten-Tiefe überspringen).
- Flows: `previewAutomation`/`runAutomation` nehmen `projectId`/`taskId` ungeprüft in Pfade (gleicher Tenant).
- Allgemein: `projectId`-Pfad-Injection in Callables mit Projekt-Check über das Doc (`project-intake`, `initiative-feedback`), nur innerhalb des eigenen Tenants.
- Aktivität: `automation.failed`-Events tragen `projectId` → Flow-Name/Fehler für Gäste lesbar.
- Insights: Cooldown nicht transaktional; `generateWeeklyInsightsReport` ohne Drossel (KI-Credits).
- Dateien: `getTenantFileUrls` für Legacy-Zeilen nur Scope- statt Modulprüfung; Parent-Titel vom Client.
- Wiki: Versionen von jedem Leser löschbar; Body-Chunks in gesperrten Projekten schreibbar; `bodyRev` nur clientseitig.
- KI: Abbruch erstattet Credits nach Modelllauf; Refund über Monatsgrenze; `inAppAi` von Workspace-Admins schaltbar; Provider-Fehltext an Client.
- Rechtsdokumente: `/desktop/palette` ohne `LegalConsentGate`; `declineLegalDocuments` ohne Versions-/Rate-Prüfung; Machine-Consent-Check fail-open bei Lesefehler.
- Kontaktformular: Rate-Limit per gespooftem `X-Forwarded-For` umgehbar.
- `adminApi`: Audit nach der Mutation (fehlgeschlagener Audit-Write = unauditierte Änderung).
- `sesEvents`: kein Timestamp-Frische-Check (Replay alter Notifications).
- Viele Trials: unbegrenzt neue Workspaces mit je 14 Tagen Team-Test.

## Geprüft und in Ordnung (Auszug)

Firestore `files`/`activity`/`insights_*`/`automation*`-Regeln (nur Server-Writes, Gäste nur eigene
Projekte); Managed-File-Callables (Mitgliedschaft inkl. Sperre, Scope, Pfad-Sanitizing, Typ/Größe
am echten Objekt); Wiki-Rechte pro Bereich, Tiptap-JSON ohne HTML-Rendering, Erwähnungen lösen
Titel mit den Rechten des Lesers auf; Flows ohne Webhook-/Mail-Aktionen, Empfänger nur Mitglieder,
Schleifenschutz serverseitig; Billing-Callables nur Owner, Stripe-Webhook mit Signatur + Dedupe +
Re-Fetch, Entitlements nicht client-schreibbar, `billingExempt` nur Admin-Konsole, BYOK AES-256-GCM;
KI: keine freien Modell-/System-Parameter, Kontext über die REST-API mit Nutzer-Token, Vorschläge
nur mit Nutzerrechten anwendbar; Admin-Gate (Claim + Allowlist + 2FA + Session), Admin-MCP
(Audience-Trennung, Kill-Switch, PKCE, Code-/Refresh-Rotation, Bestätigungscode für Writes);
`emailUnsubscribe` (HMAC, timing-safe), `sesEvents` (Zertifikat-Host, TopicArn, Signatur vor
SubscribeURL); Legal: Zustimmung nur serverseitig schreibbar, Token-Nutzung prüft Consent.

By design: Das Consent-Gate ist UI-seitig (Regeln/Callables prüfen keine Zustimmung), maschinelle
Zugriffe (`/api`, `/mcp`, PAT/OAuth) prüfen sie mit 14 Tagen Grace.
