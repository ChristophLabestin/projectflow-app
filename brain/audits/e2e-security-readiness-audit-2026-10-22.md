# E2E-, Security- und Production-Readiness-Audit — 2026-10-22

Stand: Commit `1842d63f` (lokales `main`). Methode: Builds/Tests/Audits, Code-Review,
Firestore/Storage-Rules-Tests im Emulator (`PROVED`), Live-Durchlauf gegen Emulatoren
via `scripts/dev-e2e.sh` (Demo-Workspace, Auto-Login). Nichts deployed, keine Prod-Zugriffe.
`CODE` = nur aus Code-Analyse.

## Build & Tests

| Check | Ergebnis |
| --- | --- |
| `web` build | OK — Warnung Circular chunk `app-i18n → firebase-auth → firebase-core → vendor → app-i18n` |
| Unit-Tests (`vitest`) | 50/50 grün |
| Functions build | OK |
| Theme-Lint | OK |
| `tsc --noEmit` (web) | **335 Fehler** (Top: `rolesService.ts`, `ProjectOverview.tsx`, `dataService.ts`); in CI `continue-on-error` |
| `npm audit --omit=dev` | functions: 2 critical / 5 high · web: 13 high (u. a. prosemirror-view XSS, @tiptap/core, markdown-it) |
| E2E (Playwright) | nur `e2e/finance.spec.ts` (2 Tests), keine Coverage für Auth/Tenancy/Tasks |

## Security

### High
1. **Jedes Vollmitglied kann jedes Projekt löschen/übernehmen** (`PROVED`). `firestore.rules:249` — `match /{document=**}` unter `/projects/{id}` matcht auch das Projekt-Doc selbst und hebelt die Delete-Regel (`:246`, nur Admin/Owner) aus. Gäste in `memberIds` ebenso. Außerdem dürfen Mitglieder `ownerId`/`memberIds` jedes Projekts ändern (`:247`). Fix: Wildcard auf Subcollections beschränken, Update-Feld-Allowlist.
2. **REST/MCP-Projekt-Delete umgeht Rollen** (`CODE`). `projectflow-api.ts:569, :1709`: mit Firebase-ID-Token hat jedes Nicht-Gast-Mitglied `projects:delete`. Fix: bei `authType === 'firebase'` Admin/Owner bzw. Projekt-Owner verlangen.
3. **Öffentliche, unauthentifizierte Debug-Functions** (`CODE`). `scheduler.ts:178` (`debugScheduler`, triggert Post-Publisher) und `:401` (`debugHealthSnapshots`, iteriert alle Tenants und schreibt). Fix: entfernen oder Auth.
4. **Stored XSS über `dangerouslySetInnerHTML` ohne Sanitizer** (`CODE`). `email-builder/BlockRenderer.tsx:56,110`, `PropertiesPanel.tsx:193`, `TaskStrategicContext.tsx:72`, `BlogPostTemplate.tsx:90`; kein DOMPurify im Projekt. Dazu unescaped `coverImage` in Meta-Tags (`blogMetaFunction.ts:76,79,159,162`) und HTML-Mail in `contact.ts:29-33`. Live-Test: normale Task-/Projekt-/Kommentarfelder escapen korrekt.
5. **OAuth-Callbacks ohne CSRF/State-Prüfung** (`CODE`). `facebook.ts:35-60`, `tiktok.ts:28-57`, `youtube.ts:37-75`: State ist unsigniertes Base64, `csrf` wird nie geprüft → fremder Social-Account in fremdes Projekt injizierbar; `?error=`/`e.message` reflektiert als HTML (auch `file-storage.ts:1482`); `postMessage(…, '*')`. Facebook-Access-Token liegt in `social_integrations`, für alle Mitglieder lesbar.

### Medium
6. **Self-Grant von Plan/Seats**: Tenant-Owner darf `entitlements/*` schreiben (`firestore.rules:236`, `PROVED`); jeder kann sich einen Workspace anlegen. Fix: `write: false`, Vergabe nur per Function.
7. **Storage**: keine Größen-/Content-Type-Limits (HTML-Upload möglich, `PROVED`); **Gäste haben Lese-/Schreibzugriff auf alle Workspace-Dateien** (`storage.rules:21`, `PROVED`).
8. **AI-Kosten ohne Quota**: `askCora`, `generateImage`, `editImage`, `callGemini` (`ai-service.ts:237-408`) für jeden eingeloggten User, Signup ist offen; kein App Check, kein Rate-Limit irgendwo.
9. **`testSMTPConnection`** (`email.ts:6-25`): SSRF/Port-Scan zu beliebigem Host, `rejectUnauthorized:false`, loggt das SMTP-Passwort.
10. **GitHub-Sync**: mitgliedsschreibbares `githubRepo` wird in die API-URL mit dem PAT des Owners interpoliert (`github-task-sync.ts:35,71,116-121`). Fix: Regex `^[\w.-]+/[\w.-]+$`.
11. **Passkeys**: `auth_challenges` ohne Ablauf/Cleanup (`passkeys.ts:211-300`); localhost-Origins in Prod akzeptiert (`:55`).
12. **Realtime-DB-Presence**: jeder Authentifizierte liest `status/{beliebigerTenant}` (`database.rules.json`).
13. **Security-Header fehlen**: `firebase.json` hat weder CSP, HSTS, X-Frame-Options, Referrer-Policy noch Cache-Control.
14. **Gemini-Key in Git-History** (Commit `1095e0bb`, `dist_backup_*`): rotieren, falls noch gültig.

### Low
Admin kann Member-Doc für beliebige UID anlegen; `uid === tenantId`-Owner-Shortcut in `workspace-admin.ts:44,63`, `file-storage.ts:122`, `notifications.ts:86`; `verifyIdToken` ohne `checkRevoked`; Profile (inkl. E-Mail) per UID für alle lesbar; Invite-Links standardmäßig unbegrenzt nutzbar; rohe `error.message` in Responses.

### Behoben seit dem Vor-Stand (verifiziert)
Self-Join in fremde Tenants (`PROVED` geschlossen), Storage-Zugriff durch Fremde, ID-Token als Master-API-Token, GitHub-Token im lesbaren Profil, Invite-Links öffentlich lesbar, `sendInvitation` ohne Autorisierung, CORS reflect-any-origin. Tenant-Isolation und Rollen-Eskalation auf Workspace-Ebene sind sauber; MCP-Server nutzt nur gehashte API-Tokens mit Tenant aus dem Token.

## Funktionale & UI-Bugs (Live-Durchlauf)

### High
- **Finance: Endlosschleife ~400 Fehler/s**, wenn die Finance-Callables fehlschlagen — Effect in `FinanceTracking.tsx` ~L735-767 hängt an `showError`/`t`, Catch triggert Re-Run. Hämmert in Prod bei jedem Backend-Fehler die Function.
- **Projekt löschen ist in der UI nicht erreichbar**: `handleDeleteProject` + Modal in `ProjectOverview.tsx` (~L1384, ~L4926) existieren, `setShowDeleteModal(true)` wird nie aufgerufen. (Zusätzlich: Delete wäre nicht kaskadierend, `projectAdminService.ts:199`.)
- **Doppelklick auf „Projekt erstellen“ erzeugt Duplikate** — Button wird während des Requests nicht gesperrt.

### Medium
- Fehlende i18n-Keys werden roh angezeigt: `projectOverview.error.load` / `.error.delete` (z. B. `/project/doesnotexist`), außerdem ~12 weitere (`finance.calc.section.*`, `invoice.preview.zoom*`, `common.remove`, `sprints.status.active`, `aiStudio.*`, `projectOverview.execution.subtasksLabel`).
- Keine 404-Seite: unbekannte Routen und alte Unterrouten (`/project/:id/team|roadmap|settings|timeline|board`) leiten stumm aufs Dashboard; tote Links auf `/flows`/`/issues` in `ProjectOverview.tsx:1983,2447,2458,2514,2549`, `Calendar.tsx:251`.
- Deep-Link mit `?tenant=` wechselt den Workspace nicht → geteilte Links über Workspaces hinweg brechen.
- `/profile` ist halb Mock: Follow/Message-Buttons am eigenen Profil, Fantasie-Stats (Tasks done 142, Karma 940 …), Fehler `Unknown FieldFilter operator` + Rules-Deny bei globalen Aktivitäten.
- Emoji-Projektnamen zerschießen das Avatar-Initial (lone surrogate) — `Array.from(name)[0]` nutzen.
- Mobile: Nav-Drawer bleibt nach Navigation offen; abgeschnittene Texte in der Initiativen-Karte.

### Low
Lange Wörter überlaufen Task-/Projekt-Header; Task-Titel ohne Längenlimit; Pinned-Tasks-Modal schließt nicht mit Esc; Mischsprache in DE („Send“, „ACTIVE“, „Media Library“, Aktivitätstexte, US-Datumsformat); widersprüchliche Member-Zähler in Workspace-Settings, Owner als „VIEW“ im Team-Tab; Icon-Buttons ohne `aria-label`, ~41 `<img>` ohne `alt`, Modal ohne Focus-Trap; „⌘K“-Hinweis auf Mobile.

## Production Readiness

**Blocker**
- Deploy-Workflow deployt jeden Push auf `main` direkt live, unabhängig von `ci.yml`; Typecheck nicht blockierend; keine Rules-/Functions-Tests in CI; kein Staging-Projekt.
- Sentry ist eingebaut (`errorReporting.ts`, `ErrorBoundary`), aber `VITE_SENTRY_DSN` wird im Deploy nicht gesetzt → in Prod inaktiv; kein `unhandledrejection`-Handler.
- DSGVO: keine Account-Löschung, kein Datenexport (Art. 17/20); Projekt-Delete hinterlässt Subcollections.

**Should-fix**
- `web/index.html`: esm.sh-Importmap (React 18/19, Firebase 10/12 gemischt) und `window.process`-Shim entfernen; `<title>` „ProjectFlow AI“, `lang="en"` fest.
- Functions: keine `setGlobalOptions` (Memory/Timeout), v1/v2 gemischt, `checkScheduledPosts` jede Minute; viele `getDocs` ohne `limit`; Restlesezugriffe auf entfernte `ideas`/`issues` (`ProjectMilestones.tsx:69`, `MilestoneModal.tsx:70`).
- `/ui` (StyleGuide) in Prod erreichbar und eager importiert.
- Hygiene: getrackte Altlasten (`web/.vite/`, `web/test.html`, `web/tmp/`, `Modal.v3_glass.bak`, `functions/lib/` inkl. alter Projekt-ID `project-manager-9d0ad` in `lib/vertexAI.js`), ~51 `console.log`, `utils/debugUserQuery.ts`; ~470 Hex-Farben in TSX, ~382 in SCSS, doppelte Token-Bäume, Tailwind weiter kompiliert.

## Lokales E2E-Setup

`npm --prefix web run dev:e2e` (bzw. Launch-Config `web-e2e`) startet Emulatoren auf eigenen Ports
(9631/8631/9632), seedet den Demo-Workspace, legt `outsider@projectflow.test` (ohne Workspace) an und
startet die App eingeloggt als `demo@projectflow.test`; `E2E_LOGIN=outsider` für Rechte-Tests.

## Remediation status (same day, branch `claude/projectflow-e2e-testing-e14fee`)

Verified after all fixes were merged: `tsc --noEmit` 0 errors (was 335, CI typecheck now blocking), web build without warnings, 53/53 unit tests, theme lint, functions build, Firestore rules 33/33 (the same suite fails 5 checks against the old rules), Storage rules 23/23, GDPR export/erasure emulator test, live smoke test against emulators incl. Functions (project delete, 404, finance, profile).

**Fixed**
- Security High: project wildcard rule (delete/hijack), REST/MCP delete role check, public debug functions removed, DOMPurify `sanitizeHtml` on all HTML sinks + escaped blog meta, server-side single-use OAuth state for Facebook/TikTok/YouTube, no reflected provider errors.
- Security Medium: entitlements server-only; Storage requires non-guest membership, 25 MB + content-type allowlist, avatars 5 MB images; AI daily quota per user; `testSMTPConnection` Owner/Admin-only with private-IP/port guard and no password logging; GitHub repo validation; passkey challenge TTL + single use, localhost origins only in the emulator; `verifyIdToken(…, true)`; `uid === tenantId` owner shortcut removed; contact form escaping, honeypot, per-IP rate limit; generic error messages; hosting security headers (HSTS, nosniff, X-Frame-Options, Referrer/Permissions-Policy, cache headers); writes below deleted projects blocked.
- App: finance request loop, project delete UI + cascading `deleteProject` callable, double-submit guards, missing i18n keys, 404 page and legacy route redirects, Flows/Issues leftovers, `?tenant=` deep links, profile mock data, emoji initials, mobile drawer, overflow + title cap, modal focus trap/Esc, a11y labels/alt, German mixed-language strings and date format, settings counters, dock refresh after delete, invoice logo upload path, SMTP test payload.
- Readiness: deploy only after green CI (+ rules tests job, Sentry DSN, no client Gemini key), global error handlers, esm.sh importmap removed, circular chunks fixed, `setGlobalOptions`, bounded 5-minute scheduler, dead ideas/issues reads, leftovers + `functions/lib` untracked, unused deps removed, `npm audit fix`; GDPR `exportMyData` / `deleteMyAccount` with UI.
- ~20 additional real bugs surfaced by the type cleanup (e.g. GitHub disconnect skipped its confirmation, settings checkboxes stored the event object, sprint titles read the wrong field, social approvals wrote invalid statuses).

**Still open**
- CSP ships as `Content-Security-Policy-Report-Only`; enforce after watching violations in production.
- Social access tokens in `social_integrations` stay readable by workspace members because the client posts to the Graph API directly; needs server-side publishing.
- Realtime DB presence reads are not membership-checked (RTDB cannot read Firestore); needs a function-maintained member mirror or custom claims.
- `npm audit --omit=dev`: web 6 (4 high, `@grpc/grpc-js` via firebase), functions 9 (1 high, `nodemailer` ≤10.0.5 needs a major bump).
- No staging Firebase project yet; Tailwind utilities still compiled alongside SCSS; remaining hardcoded English strings outside the reported screens; Gemini key in git history (`1095e0bb`) should be rotated if still valid.
- GitHub hosting deploy is broken since the move to `projectflow-labestin`: the repo lacks the `FIREBASE_SERVICE_ACCOUNT_PROJECTFLOW_LABESTIN` secret and the `VITE_FIREBASE_*` secrets still date from the old project. Until fixed, deploy hosting locally (`cd web && npm run build && firebase deploy --only hosting`).

**Deployed 2026-10-22** (commit `8217efc6`, project `projectflow-labestin`): Firestore, Storage and RTDB rules; all functions (112 updated, `deleteProject`/`exportMyData`/`deleteMyAccount` created, `debugScheduler`/`debugHealthSnapshots` deleted); hosting built locally from `main`. Verified: debug endpoint 404, unauthenticated `deleteProject` 401, security headers served, login page loads without console errors.
