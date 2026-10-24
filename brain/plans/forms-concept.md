# Forms — konfigurierbare Formulare für ProjectFlow (Konzept)

Stand 2026-10-24 · Status: **Konzept, wartet auf Freigabe** (keine Umsetzung vor Owner-Go) ·
UI-Name **Formulare / Forms**, Code und Firestore `forms`.

## 0. Owner-Entscheidungen (Interview 2026-10-24)
| Thema | Entscheidung |
|---|---|
| Zielgruppe | Beides; **Kunden-Intake ist der Leitfall** (Antwort → Aufgabe/Flow), interne Umfragen (Retro, Team-Puls) mit demselben Baukasten |
| Bestand | **Komplett neues System.** Das Initiative-Feedback-Formular bleibt vorerst unverändert und wird später (v2) auf Forms umgezogen |
| Pläne | In allen Plänen, Limits als Upgrade-Hebel (§9) |
| Datenschutz | Datensparsam: keine Klartext-IP, Pflicht-Datenschutzhinweis, optionale Einwilligung, Aufbewahrung pro Formular (Default 12 Monate), Spam-Schutz ohne Drittanbieter |
| Branding | **Volles Theme** (Farben, Hintergründe, Schrift aus kuratierter Liste, Radius, Feldstil, Logo, Titelbild) |
| Darstellung | „Klassisch“ (Seite mit Abschnitten) im MVP, „Eine Frage pro Bildschirm“ in v2 |
| KI | Formular aus Prompt erzeugen, Antworten zusammenfassen **und** automatische Einordnung jeder Antwort beim Eingang (opt-in pro Formular) |
| iOS | Antworten ansehen, teilen, pausieren, Push **und natives Ausfüllen** von Workspace-Formularen |
| Eingang | Antwort immer als eigener Datensatz; optional eingebaute Aktion „Aufgabe anlegen“ mit Feld-Mapping; neuer Flow-Auslöser; Benachrichtigung an Mitglieder; optionale Bestätigungs-Mail an Respondenten |
| Rechte | Jedes Mitglied (keine Gäste) baut Formulare; Formular hat Eigentümer + Mitbearbeiter; Antworten sehen nur diese plus Owner/Admins |

**Korrektur zur Interview-Empfehlung:** Ich hatte „Firebase App Check“ als Spam-Schutz genannt. Auf
dem Web nutzt App Check reCAPTCHA (Google) — das ist genau der einwilligungspflichtige Drittanbieter,
den wir vermeiden wollen. Öffentliche Formulare im Browser laufen daher **ohne App Check**; Schutz über
signiertes Formular-Session-Token, Honeypot, Mindestzeit, Rate-Limits und Inhaltsheuristik (§8).
App Check (App Attest) nur für das native iOS-Ausfüllen.

## 1. Bestand (Inventur, wiederverwenden statt duplizieren)
| Baustein | Wo | Verwendung in Forms |
|---|---|---|
| Initiative-Feedback | `functions/src/initiative-feedback.ts`, `web/screens/PublicInitiativeFeedbackPage.tsx`, Index `public_initiative_feedback/{token}` | **Muster** für öffentlichen Token-Index + HTTP-Funktionen. Schwächen nicht übernehmen: keine Antworten-Collection (jede Antwort = Aufgabe), Anhänge als Base64 im JSON, Signed-URLs bis 2500, nur Honeypot (Web sendet ihn nicht einmal) |
| Projekt-Intake | `functions/src/project-intake.ts` (Web entfernt in `4fe75c6b`, Functions noch exportiert, `/feedback/project/:token` → `/`) | Nicht reaktivieren. Folgeaufgabe: tote Functions entfernen (§12) |
| Flows | `functions/src/automation-logic.ts` (`TRIGGER_TYPES`, `EVENT_TO_TRIGGER`), `automations.ts` (`handleActivityEvent`), `activity-events.ts` (`emitActivityEvent`) | Neuer Auslöser `form.submitted` über ein Activity-Event; Loop-Schutz via `writeVia` |
| Dateien | `functions/src/file-storage.ts` (Upload-Sessions mit Signed-URLs, `getWorkspaceFileUsage`), `files-logic.ts` (`quotaAllows`, MIME-Blocklist) | Uploads in Formularen laufen über dieselben Upload-Sessions und **zählen auf die Workspace-Quota** |
| Rate-Limit | `functions/src/public-rate-limit.ts` (`consumeRateLimits`, `clientIp`), `platform-newsletter/logic.ts` (`looksLikeBot`) | Direkt wiederverwenden |
| Rechte | `web/types/permissions.ts`, `brain/reference/app/PERMISSIONS.md` | Neue Tenant-Rechte `tenant.forms.*` |
| Billing | `functions/src/billing-logic.ts` (`PLAN_LIMITS`, Pläne `free/personal/team/organization`), `web/utils/billingPlans.ts` (`canUse`), Doc `tenants/{t}/entitlements/plan` | Neue Limit-Felder, Fehlercodes `plan-form-*` |
| KI | `runAiCapability` + `BUILDERS` (`ai-capabilities.ts`), `aiGenerate`/`aiDecide` (`ai-decide.ts`), Provider OpenAI, Kontingent `consumeAiQuota` | Neue Capabilities `formDraft`, `formResponseSummary`; Server-intern `formTriage` |
| Charts | `recharts` im Web, Swift Charts auf iOS | Auswertung |
| E-Mail | `functions/src/email*.ts` (SES, Templates, Locales) | Bestätigungs-Mail, Benachrichtigung |
| Workspace-Bereiche | `web/config/features.ts` `WORKSPACE_AREAS`, `SidebarNavigator` | Neuer Bereich `forms` |

## 2. Produktbild
- **Workspace-Bereich „Formulare“** in der Seitennavigation (wie Wiki): Liste aller Formulare, die ich
  besitze/bearbeite (Admins: alle), mit Status, Antworten, letzter Eingang.
- **Builder** (Web/Desktop): Titel + Beschreibung zuerst, Fragen als dichte Zeilen mit Inline-Bearbeitung
  (Muster STYLING §6.2), Abschnitte, Bedingungen, Vorschau auf Abruf, Modi *Fragen · Design · Einstellungen ·
  Teilen*. Vorlagen-Galerie beim Anlegen (Kundenanfrage, Bug-Report, Briefing, Event-Anmeldung, Team-Puls,
  Retro, NPS) plus „Mit KI erstellen“.
- **Antworten**: *Zusammenfassung* (Diagramm pro Frage), *Tabelle* (Filter, Auswahl, Export, Aufgabe
  erzeugen), *Einzelansicht* (vor/zurück, verknüpfte Aufgabe, KI-Einordnung, Status neu/gesichtet/archiviert/Spam).
- **Öffentliches Formular** `/f/:token`: volles Theme, klassisches Layout, Fortschritt nach Abschnitten,
  Pflichtfeld-Validierung, Bestätigungsseite (Text oder Weiterleitung).
- **Zielgruppe pro Formular**: *Öffentlich* (jeder mit Link, anonym möglich) oder *Nur Workspace*
  (Login + Mitgliedschaft, Antwort ist dem Mitglied zugeordnet oder optional anonymisiert).

## 3. Feldtypen und Logik
| Typ | Optionen |
|---|---|
| `shortText` | Platzhalter, max. Länge (Default 500) |
| `longText` | max. Länge (Default 5.000) |
| `singleChoice` / `multipleChoice` / `dropdown` | Optionen (max. 50), „Sonstiges“ mit Freitext, Mischen, min/max Auswahl (multiple) |
| `rating` | 3–10 Sterne |
| `scale` | Linear (Start 0/1, Ende 2–10, Beschriftungen links/rechts) inkl. NPS-Vorlage 0–10 |
| `date` | Datum, optional mit Uhrzeit, min/max |
| `number` | min/max, Nachkommastellen, Einheit |
| `email` | Formatprüfung; kann als „Empfänger für Bestätigungs-Mail“ markiert werden |
| `phone` | Freiform mit leichter Prüfung |
| `fileUpload` | max. Dateien (1–10), max. Größe (≤ Plan-`maxFileBytes`), Typgruppen (Bilder, PDF, Office, Text) |
| `consent` | Pflicht-Checkbox mit Text + Link |
| `statement` | Textblock/Hinweis ohne Antwort |

Gemeinsam: Label, Hilfetext, Pflicht, stabile `fieldId` (nanoid, nie wiederverwendet).
**Abschnitte** (`sections[]`) mit Titel/Beschreibung; im klassischen Layout als Seiten mit Weiter/Zurück.

**Bedingte Logik (MVP):** Sichtbarkeitsregeln auf Feld und Abschnitt — `showIf: { mode: 'all'|'any',
rules: [{ fieldId, op, value }] }`, Operatoren `equals`, `notEquals`, `contains` (multiple), `gt`, `lt`,
`answered`, `notAnswered`. Regeln dürfen nur auf **frühere** Felder zeigen (keine Zyklen, im Builder
erzwungen). Verborgene Felder sind nie Pflicht, ihre Antworten werden **serverseitig verworfen**.
Abschnittssprünge/Verzweigung („Gehe zu Abschnitt“) erst v2.

Die Logik lebt in **einem** reinen Modul `forms-logic` (Validierung, Sichtbarkeit, Normalisierung,
CSV-Zeile), das Server und Web teilen (Kopie mit Sync-Test wie bei `automation-logic`), plus Swift-Port in
PFDomain mit **Golden Fixtures** aus dem Web (Muster der iOS-App).

## 4. Datenmodell (Firestore)
```
tenants/{t}/forms/{formId}
  title, description, status: 'draft'|'published'|'paused'|'closed'
  ownerId, editorIds[], createdAt, updatedAt
  audience: 'public'|'workspace', anonymous: bool       // workspace: Antwort ohne uid speichern
  layout: 'classic' (v2: 'oneByOne'), language: 'de'|'en'
  draft: { sections[], fields[] }                        // Builder-Stand
  publishedVersion: n | null, shareToken, embed: { allowedOrigins[] }
  theme: ThemeRef | ThemeInline                          // §7
  settings: { closesAt?, maxResponses?, onePerMember (workspace), confirmation: { text | redirectUrl },
              retentionMonths: 1|3|6|12|24|null(=unbegrenzt), consent?: { text, url },
              notifyMemberIds[], respondentCopy: { enabled, emailFieldId },
              aiTriage: { enabled, categories[] } }
  actions: { createTask?: { projectId, initiativeId?, mapping: { title, description[], priority?,
             dueDate?, assigneeIds? , labels? }, defaults: {...} } }
  counts: { responses, spam, lastResponseAt }

tenants/{t}/forms/{formId}/versions/{n}        // unveränderlicher Snapshot bei „Veröffentlichen“
tenants/{t}/forms/{formId}/responses/{rid}
  version, submittedAt, status: 'new'|'reviewed'|'archived'|'spam'
  answers: { [fieldId]: string | string[] | number | { other } | FileRef[] }
  respondent: { uid? , email? }                 // uid nur bei workspace + nicht anonym
  meta: { source: 'link'|'embed'|'app'|'ios', locale, durationMs }
  taskRef?: { projectId, taskId }, triage?: { category, priority, summary, spamScore, lang }
  expireAt                                      // aus retentionMonths, TTL-Policy
tenants/{t}/forms/{formId}/stats/summary       // inkrementelle Zähler pro Feld & Version
tenants/{t}/form_themes/{themeId}              // gespeicherte Workspace-Themes
tenants/{t}/forms_usage/{yyyy-mm}              // { responses } für Plan-Limit
public_forms/{token}                           // Admin-only Index: tenantId, formId, version-Snapshot,
                                               // Theme, Branding, Rechtstexte, status
tenants/{t}.legal: { controllerName, privacyPolicyUrl, imprintUrl }   // neu, Pflicht vor erstem öffentlichen Formular
```
- **Versionierung:** Bearbeiten nach Veröffentlichung ändert nur `draft`; „Änderungen veröffentlichen“
  schreibt `versions/{n+1}` + aktualisiert `public_forms/{token}`. Antworten referenzieren ihre Version;
  gelöschte Fragen erscheinen in der Auswertung unter „Archivierte Fragen“.
- **Statistik:** `stats/summary` wird im Trigger per Transaktion fortgeschrieben (Optionszähler,
  Rating-Histogramm, Summe/Min/Max für Zahlen, Anzahl Antworten pro Feld) — die Zusammenfassung lädt
  dadurch nicht alle Antworten. Bei Löschungen/Retention zieht der Trigger ab; ein Callable
  `rebuildFormStats` repariert.
- **Indizes:** `responses` nach `submittedAt desc`, `status + submittedAt`; Collection-Group-TTL auf `expireAt`.

## 5. Routen
| Route | Zweck |
|---|---|
| `/forms` | Liste + „Neues Formular“ (Vorlagen, KI) |
| `/forms/:formId/edit` | Builder (Modi Fragen · Design · Einstellungen · Teilen) |
| `/forms/:formId/responses` | Zusammenfassung · Tabelle · Einzelansicht (`?r=<rid>`) |
| `/f/:token` | Öffentliches Formular (auch Workspace-Formulare; dann Login-Gate) |
| `/f/:token?embed=1` | Einbettung im iframe (ohne Seitenrahmen, Auto-Höhe per `postMessage`) |
| `projectflow://forms/:formId[/fill]` | Deep Link iOS/Desktop |

`/f/*` bekommt einen **eigenen schlanken Vite-Einstieg** (`web/form.html` + `web/form/main.tsx`,
Hosting-Rewrite `/f/**`), ohne App-Shell, Help-Center-Button und Sprachumschalter (Sprache kommt vom
Formular). Grund: Respondenten sollen nicht das ganze App-Bundle laden; Lighthouse-Ziel < 150 kB JS gz.
Hosting-Header nur für `/f/**`: `frame-ancestors *` (Einbettung); restliche App bleibt `DENY`. Die
Domain-Freigabe `embed.allowedOrigins` ist weich (Prüfung über `location.ancestorOrigins`/Referrer) —
dokumentierte Grenze. `SITEMAP.md` aktualisieren.

## 6. Komponenten (Web)
- `screens/forms/FormsScreen` (Liste), `FormBuilderScreen`, `FormResponsesScreen`.
- `components/forms/`: `FormFieldRow` (Zeile + Inline-Editor), `FieldTypePicker`, `ConditionEditor`,
  `SectionHeader`, `FormThemeEditor` (+ `ThemePresetGallery`, Kontrast-Check WCAG AA mit Warnung),
  `FormSharePanel` (Link, QR-Code, iframe-/Script-Snippet, Zielgruppe), `FormTaskMappingEditor`,
  `ResponseSummaryCard` (je Feldtyp: Balken, Histogramm, NPS-Wert, Mittelwert, Textliste),
  `ResponsesTable` (virtualisiert), `ResponseDetail`, `FormAiSummaryPanel`.
- **Renderer** `components/forms/renderer/` (`FormRenderer`, ein Input je Feldtyp) wird von Builder-Vorschau,
  `/f/:token` und dem In-App-Ausfüllen gemeinsam genutzt. Er nutzt nur Theme-CSS-Variablen
  (`--form-*`), keine App-Tokens, damit das volle Theme greift; App-Seiten selbst folgen dem
  Sunken-Stil (STYLING §1.10).
- Services `services/formsService.ts` (Callables, Firestore-Reads), Hook `useFormEntitlements`.
- Alle Texte in `web/locales/en.ts` + `de.ts`; Respondenten-Chrome-Texte (Absenden, Pflichtfeld …) in einem
  kleinen eigenen Locale-Block, den der Form-Einstieg lädt. `COMPONENTS.md`/`STYLING.md` ergänzen.

## 7. Theme
`theme = { preset?, background: { type: 'color'|'gradient'|'image', … }, surface, text, accent,
accentText, font: <id aus kuratierter Liste>, radius: 0|8|16|24, fieldStyle: 'sunken'|'filled'|'underline',
density: 'comfortable'|'compact', logo?, cover? }`.
- **Schriften** nur aus einer kuratierten, **selbst gehosteten** Liste (≈ 10: Inter, Manrope, DM Sans,
  Source Serif, Fraunces, Space Grotesk, IBM Plex Sans/Mono, Nunito, Playfair). Kein Google-Fonts-CDN (DSGVO).
- Presets: „ProjectFlow Hell/Dunkel“ (Sunken-Stil), plus 6–8 kuratierte. Themes als Workspace-Theme speicherbar.
- **Assets** (Logo, Titelbild, Hintergrundbild) liegen unter `public/forms/{t}/{formId}/assets/**` mit
  Storage-Regel *öffentlich lesbar, Schreiben nur über Upload-Session* — keine Jahr-2500-Signed-URLs.
- Footer: Verantwortlicher, Datenschutz, Impressum (Pflicht, nicht ausblendbar) und „Erstellt mit
  ProjectFlow“ (ausblendbar je Plan).

## 8. Functions (europe-west3, `FUNCTION_MODULES`, `runWith(FAST_START)` für Callables)
**Callables (auth):** `saveFormDraft`, `publishForm`, `setFormStatus`, `duplicateForm`, `deleteForm`,
`setFormEditors`, `saveFormTheme`, `deleteFormResponses`, `setFormResponseStatus`,
`createTaskFromFormResponse`, `exportFormResponses` (CSV, UTF-8 mit BOM, Trennzeichen wählbar `,`/`;`,
Mehrfachauswahl mit `; `, Datei-Spalten als App-Links, Ergebnis als kurzlebige Signed-URL 15 min),
`rebuildFormStats`, `getFormForMember` (Workspace-Ausfüllen in App/iOS), `submitFormAsMember`.
KI über `runAiCapability` mit neuen Builders `formDraft` (Prompt → Schema per Structured Outputs,
validiert durch `forms-logic`) und `formResponseSummary` (Themen, Stimmung, repräsentative Zitate;
Server liest max. 500 neueste Antworten bzw. Token-Budget, nur Felder vom Typ Text/Wahl).

**HTTP (öffentlich, CORS):** `getPublicForm` (GET `?token=`) liefert Snapshot + Theme + Rechtstexte +
**Formular-Session-Token** `fst = HMAC(secret, token|issuedAt|nonce)`; `createPublicFormUpload` (POST,
braucht `fst`, gibt Signed-PUT-URL je Datei, Pending-Eintrag); `submitPublicForm` (POST).

**Trigger/Jobs:** `onFormResponseCreated` → Stats, `forms_usage`, Aufgabe anlegen (`writeVia {kind:'form'}`),
Benachrichtigungen (`notification-writer`, neuer Typ `form_response`), Push, Activity-Event
`form.response_submitted` → Flows, KI-Einordnung (`aiDecide`), Bestätigungs-Mail. Idempotent über
deterministische IDs (`responseId`-basiert). `cleanupFormUploads` (stündlich: Pending-Uploads > 24 h löschen),
`purgeExpiredFormResponses` (täglich: Dateien abgelaufener Antworten; Docs per TTL).

**Absenden — Prüfkette in `submitPublicForm`:**
1. Payload ≤ 256 kB, `token` → `public_forms` (status `published`, nicht `closesAt` überschritten,
   `maxResponses` nicht erreicht, Plan-Limit nicht erreicht → sonst 409 mit Grund).
2. `fst` gültig, älter als 3 s, jünger als 24 h; Honeypot-Feld `website` leer (Renderer sendet es wirklich).
3. `consumeRateLimits`: pro `token+ipHash` 5/min, 30/h; pro Formular 600/h; pro Tenant 3.000/h.
   `ipHash = HMAC(tagesrotierendes Salt, ip)` nur im Rate-Limit-Doc, TTL 24 h — nie in der Antwort.
4. `forms-logic`: Sichtbarkeit auswerten, verborgene Antworten verwerfen, Pflicht/Typ/Längen prüfen,
   Uploads gegen Pending-Einträge dieses `fst` abgleichen, Quota prüfen.
5. Heuristik: > 3 Links in Freitext, identischer Inhalts-Hash im selben Formular binnen 10 min,
   KI-`spamScore` (falls Einordnung an) → `status: 'spam'` statt verwerfen (Ordner „Spam“, kein Task, keine
   Mail, kein Flow). Antworten gehen nie stillschweigend verloren.

## 9. Pläne und Limits
Neue Felder in `PlanLimits` + Entitlements-Doc; Web-Spiegel in `billingPlans.ts` (`canUse(ent, 'formLogic')` …).
| | Free | Personal | Team | Organization |
|---|---|---|---|---|
| Aktive Formulare (published/paused) | 3 | 20 | unbegrenzt (fair use) | unbegrenzt |
| Antworten/Monat (Workspace) | 100 | 1.000 | 10.000 | 50.000 |
| Datei-Upload-Felder | – | ✓ | ✓ | ✓ |
| Bedingte Logik | – | – | ✓ | ✓ |
| Theme | Presets | voll | voll | voll |
| „Erstellt mit ProjectFlow“ ausblenden | – | – | ✓ | ✓ |
| Zielgruppe „Nur Workspace“ | – (1 Mitglied) | – | ✓ | ✓ |
| Aufgabe anlegen / Benachrichtigung | ✓ | ✓ | ✓ | ✓ |
| Flow-Auslöser | wo Flows verfügbar (eigenes Flow-Kontingent) ||||
| KI (Entwurf, Zusammenfassung, Einordnung) | über KI-Add-on des auslösenden Mitglieds; Einordnung zählt auf das Kontingent des **Formular-Eigentümers** ||||

Fehlercodes `plan-form-limit`, `plan-form-responses`, `plan-form-feature`. Limit erreicht → Formular zeigt
„nimmt derzeit keine Antworten an“, Eigentümer bekommt Hinweis bei 80 % und 100 %. Downgrade: über dem Limit
liegende Formulare werden pausiert (älteste zuerst), nie gelöscht. Pro-Tenant-Override `tenants/{t}.limits.forms`
wie bei Flows. Kontrakt in `billing-entitlements-contract.md` ergänzen.

## 10. Rechte, Regeln, Datenschutz
**Rechte:** neue Tenant-Knoten `tenant.forms.create` (Default Mitglied ✓, Gast ✗) und
`tenant.forms.manageAll` (Owner/Admin). Formular-Ebene: `ownerId` (übertragbar), `editorIds` (bearbeiten,
Antworten sehen, exportieren). Ausfüllen „Nur Workspace“: alle Mitglieder, Gäste nur wenn Schalter an.
`PERMISSIONS.md` ergänzen.

**Firestore-Regeln:** `forms/{id}` + `versions` + `stats` lesbar für Eigentümer, Mitbearbeiter, Owner/Admin
(`manageAll`); `responses` ebenso; **alle Schreibzugriffe nur über Functions** (`allow write: if false`).
`public_forms`, `forms_usage`, `form` Rate-Limits: kein Client-Zugriff. `form_themes`: Mitglieder lesen, schreiben via Callable.
Storage: `tenants/{t}/files/forms/**` lesen wie andere Files (zusätzlich Formular-Zugriff serverseitig über
Signed-GET); `public/forms/**/assets/**` öffentlich lesbar.

**DSGVO:**
- Rollen: Workspace = Verantwortlicher, ProjectFlow = Auftragsverarbeiter (AVV deckt Formulardaten ab —
  rechtlich prüfen, `legal-consent-contract.md`/Landing-Legal ergänzen; OpenAI als Unterauftragsverarbeiter
  für die KI-Einordnung muss gelistet sein).
- Veröffentlichen eines öffentlichen Formulars verlangt `tenants/{t}.legal` (Verantwortlicher,
  Datenschutz-URL, Impressum-URL). Hinweistext über dem Absenden-Button, nicht abschaltbar.
- Keine Cookies, kein Tracking, kein localStorage auf `/f/*` (Entwurfs-Autosave erst v2 und nur
  sessionStorage). Fonts/Assets von eigener Domain.
- Keine IP, kein User-Agent in Antworten. Anonyme Workspace-Formulare speichern keine `uid`
  (Einmal-Sperre `onePerMember` dann über `HMAC(formId|uid)` in separatem Doc).
- KI-Einordnung nur mit Formular-Schalter; der Datenschutzhinweis des Formulars ergänzt dann automatisch
  „Antworten werden automatisiert mit KI ausgewertet“. Zusammenfassen läuft nur auf Knopfdruck.
- Aufbewahrung pro Formular (Default 12 Monate); Builder warnt, dass per Mapping erzeugte **Aufgaben**
  Projektdaten sind und nicht mit der Antwort verfallen.
- Betroffenenrechte: Einzelantwort löschen (MVP); Suche nach E-Mail über alle Formulare für Auskunft/Löschung (v2).

**Bestätigungs-Mail (Spam-Relay-Schutz):** nur wenn ein `email`-Feld als Empfänger markiert ist; festes
Template, Antworten als reiner Text ohne klickbare Links, max. 1 Mail pro Empfänger und Formular pro 24 h und
3 pro Empfänger und Tenant pro 24 h, keine Mail bei `spam`; Absender = ProjectFlow mit Reply-To des
Formular-Eigentümers (opt-in).

## 11. iOS (und Desktop)
- **Ansehen:** Formulare-Liste (unter Account/Mehr bzw. als Arbeitsbereich), Zusammenfassung mit Swift
  Charts aus `stats/summary`, Antwortliste + Detail, Status setzen, „Aufgabe erzeugen“.
- **Teilen/Steuern:** Share-Sheet mit Link/QR, Pausieren/Fortsetzen (`setFormStatus`).
- **Push** bei neuer Antwort (Typ `form_response`, respektiert Notification-Prefs) mit Deep Link.
- **Natives Ausfüllen** von Workspace-Formularen: Renderer in PFDesign (eigene Controls, Theme nur
  Akzentfarbe/Logo — volles Theme ist Web-only), Logik aus PFDomain mit Golden Fixtures, `getFormForMember`
  / `submitFormAsMember`, Upload über Upload-Session. Einstieg: Benachrichtigung „Bitte ausfüllen“ beim
  Veröffentlichen (optional an ausgewählte Mitglieder) + Karte „Offene Formulare“ in Inbox.
  Öffentliche Formulare öffnen im In-App-Browser.
- Desktop (Electron) zeigt die Web-App; nur Deep Link `projectflow://forms/...` ergänzen.

## 12. Phasenplan
**MVP** wird in vier Paketen gebaut, Release öffentlich erst nach Paket 3:
1. **Fundament** — `forms-logic` (+ Tests, Golden Fixtures), Datenmodell, Regeln/Indizes/TTL,
   Entitlements-Felder, `tenants/{t}.legal`-Einstellungen, Tenant-Rechte, Workspace-Bereich `forms`.
2. **Builder + öffentliches Formular** — Liste, Vorlagen, Builder (alle Feldtypen, Abschnitte,
   Sichtbarkeitslogik, Theme-Editor + Presets + selbst gehostete Fonts), Teilen (Link, QR, iframe),
   eigener Vite-Einstieg `/f/*`, `getPublicForm`/`createPublicFormUpload`/`submitPublicForm` mit
   voller Prüfkette, Uploads auf Workspace-Quota, Zielgruppe „Nur Workspace“ + In-App-Ausfüllen.
3. **Auswertung + Eingang** — Stats-Trigger, Zusammenfassung/Tabelle/Detail, CSV-Export, Status/Spam,
   Aufgabe-Mapping, Benachrichtigungen + E-Mail, Bestätigungs-Mail, Flow-Auslöser `form.submitted`
   (Bedingungen auf Antwortwerte, Vorlage „Antwort → Aufgabe mit Zuweisung“), Retention-Jobs.
4. **KI + iOS** — `formDraft`, `formResponseSummary`, KI-Einordnung beim Eingang; iOS ansehen/teilen/
   pausieren/Push/natives Ausfüllen.

**v2:** „Eine Frage pro Bildschirm“, Abschnittssprünge/Verzweigung, Vorbelegung per URL-Parameter
(versteckte Felder, z. B. `?kunde=`), Umzug des Initiative-Feedbacks auf Forms (Weiterleitung alter
`/feedback/initiative/:token`-Links), Antworten nachträglich bearbeiten (Workspace), Teilantworten/
Autosave, mehrsprachige Formulare, Quiz/Punkte, ausgehender Webhook, XLSX-Export, Betroffenen-Suche,
Custom-Domain für Formulare, Zeitplan (öffnen/schließen). **Aufräumen:** `project-intake.ts` samt
`public_project_intake` und Exports entfernen.

## 13. Abnahme je Paket
Build der berührten Surfaces (`web` build + `lint:theme`, `functions` build, iOS xcodebuild), Vitest für
`forms-logic` und Renderer, Emulator-E2E: veröffentlichen → öffentlich ausfüllen (inkl. Upload, Logik,
Honeypot, Rate-Limit) → Antwort in Auswertung → Aufgabe + Flow-Lauf → CSV; visuelle Prüfung (Skill
`pf-ui-check`) für Builder, `/f/*` hell/dunkel/mobil/eingebettet. Deploy nur berührter Functions, Regeln, Indizes.

## 14. Offene Punkte für die Freigabe
- Rechtsprüfung AVV/Datenschutzhinweis-Text und Unterauftragsverarbeiter (KI) vor öffentlichem Release.
- Limits in §9 sind Startwerte; Abgleich mit `pricing-strategy.md` beim Billing-Paket.
- Tracking: ProjectFlow-Initiative + Tasks konnten nicht angelegt werden (`PROJECTFLOW_API_TOKEN` fehlt);
  Task-Liste zum Anlegen siehe §15.

## 15. Tracking-Vorlage (Initiative „Forms“, Projekt `ogZ8Pyz8pwEQtv8I64nu`)
1. Forms-Konzept freigeben (dieses Dokument)
2. Fundament: forms-logic, Datenmodell, Regeln, Entitlements, Legal-Einstellungen, Rechte
3. Builder + Theme-Editor + Vorlagen
4. Öffentliches Formular `/f/*` + Submit-Prüfkette + Uploads
5. Auswertung (Zusammenfassung, Tabelle, Detail, CSV)
6. Eingang: Aufgabe-Mapping, Benachrichtigungen, Bestätigungs-Mail, Flow-Auslöser, Retention
7. KI: Entwurf, Zusammenfassung, Einordnung
8. iOS: ansehen, teilen, Push, natives Ausfüllen
9. Rechtsprüfung AVV/Datenschutztext/Unterauftragsverarbeiter
10. Aufräumen: Projekt-Intake-Functions entfernen
11. v2: Initiative-Feedback auf Forms umziehen
