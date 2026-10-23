# Legal consent — client contract (web, desktop, iOS)

Status: live since 2026-10-23. Source of truth: `functions/src/legal.ts` + `functions/src/legal-logic.ts`
(web mirror `web/utils/legalConsent.ts`). iOS builds strictly against this file.

## Data (Firestore, region eur3)

| Path | Read | Content |
|---|---|---|
| `legal_documents/{type}` | public | index: `type`, `acceptanceRequired` (bool), `currentVersion` (int), `title {de,en}`, `versions[]` = `{version, changeType, effectiveAt (Timestamp), publishedAt, summary {de,en}}` |
| `legal_documents/{type}/versions/{n}` | public | immutable: `version`, `title`, `content {de,en}` (Markdown), `summary`, `changeType`, `effectiveAt`, `publishedAt`, `notifyByEmail` |
| `legal_documents/{type}/drafts/current` | platform admin | draft (never shown to users) |
| `legal_acceptances/{uid}` | owner (`get` only) | `docs.{type} = {version, acceptedAt, platform, appVersion, decision}` |
| `legal_acceptances/{uid}/events/{id}` | owner | audit trail: `{type, version, decision: accepted|acknowledged|declined, platform, appVersion, at}` |

- `type`: `privacy` | `terms` | `imprint` (extensible). Only `privacy` and `terms` need acceptance;
  the imprint never gates and never mails.
- `changeType`: `requiresAcceptance` | `notifyOnly`. Clients never write any of these docs.
- A missing `legal_acceptances/{uid}` doc means "never accepted".

## Gate logic (run after sign-in, on every app start and on snapshot changes)

For each type in `[privacy, terms]`:
1. `current` = version with the highest `version` whose `effectiveAt <= now` (from the index `versions[]`). None → skip.
2. `accepted` = `legal_acceptances/{uid}.docs[type].version ?? 0`.
3. `accepted >= current.version` → ok.
4. `accepted == 0` (initial consent, also new registrations) **or** any version in
   `(accepted, current.version]` has `changeType == requiresAcceptance` → **blocking** item.
5. Otherwise → **notice** item (non-blocking, shown once per version).

Item = `{type, version: current.version, acceptedVersion (null if 0), changes: versions in (accepted, current], newest first}`.
Re-evaluate when the next future `effectiveAt` passes. If index or acceptance cannot be loaded
within ~5 s or errors → fail open (no gate), log it.

## States / UI

1. **loading** — show nothing of the app (neutral background).
2. **blocking** — full-screen blocking modal *instead of* the app (no other prompts underneath).
   Title `legalConsent.gate.titleInitial` (all items initial) / `.titleUpdate`; intro
   `.introInitial` / `.introUpdate`; per item: `legal.nav.{type}`, `legalConsent.versionLabel`
   (`Version {version}`), `legalConsent.effectiveFrom` (`effective from {date}`), change summaries
   (only for updates, current language, fall back to other language), links
   `legalConsent.gate.readFull` (in-app viewer of `versions/{version}`) and
   `legalConsent.gate.showChanges` (diff against `acceptedVersion`, or `version-1`);
   `legalConsent.gate.consentText`; buttons `legalConsent.gate.decline` / `legalConsent.gate.accept`.
   Accept → `acceptLegalDocuments` with **all** blocking + notice items.
3. **declined** — locked page: `legalConsent.declined.title`, `.text`, buttons `.review`
   (back to 2), `.signOut`; section `.dataTitle` with data export (`exportMyData`) and
   account deletion (`deleteMyAccount`) using the existing GDPR flows. App stays locked;
   next start shows 2 again. Call `declineLegalDocuments` (fire and forget).
4. **notice** — non-blocking banner: `legalConsent.notice.title`, doc names + versions, first
   summary, buttons `.view` / `.dismiss`. Dismiss → `acceptLegalDocuments` with the notice items
   (stored as `decision: acknowledged`).
5. **ok** — app.

Error copy: `legalConsent.error.accept`; viewer `legalConsent.viewer.error`, `.showDiff`
(`Changes since version {version}`), `.showDocument`; diff labels `legalConsent.diff.added|removed|unchanged`.
All strings exist in `web/locales/en.ts` / `de.ts` (iOS: same keys in its String Catalog).

## Callables (`europe-west3`, Firebase callable protocol)

| Name | Auth | Payload | Result / errors |
|---|---|---|---|
| `acceptLegalDocuments` | user | `{items: [{type, version}], platform: 'web'|'desktop'|'ios', appVersion: string}` | `{ok, accepted: {privacy: n, terms: n}}`; `failed-precondition` if `version` is not the current effective version (reload index and re-gate), `invalid-argument` for bad payload, `unauthenticated` |
| `declineLegalDocuments` | user | same payload | `{ok}` (audit only) |
| `saveLegalDraft`, `deleteLegalDraft`, `publishLegalDraft {type, baseVersion}`, `getLegalAdminOverview` | `platformAdmin` claim | admin only (web `/admin/legal`) | `aborted` when `baseVersion` is stale |

iOS: `platform: 'ios'`, `appVersion` = `CFBundleShortVersionString (CFBundleVersion)`.

## Public HTTP (no auth, cached 5 min / CDN 10 min, CORS `*`)

- `GET https://app.getprojectflow.com/api/legal` → `{documents: [{type, version, effectiveAt}]}`
- `GET https://app.getprojectflow.com/api/legal/{type}?lang=de|en[&version=n]` →
  `{type, version, lang, changeType, effectiveAt, publishedAt, title, summary, markdown, versions: [{version, effectiveAt, changeType}]}`; 404 `{error:'not-found'}`.
- Web page: `https://app.getprojectflow.com/legal/{type}[?v=n][&diff=1]` (`impressum` → `imprint`).

## Markdown subset

`#`–`######` headings, paragraphs, `-`/`*` and `1.` lists, `**bold**`, `*italic*`,
`[text](https://…|mailto:|/path)`, hard line break = two trailing spaces, `---`. No HTML, no
tables, no images. iOS may render with `AttributedString(markdown:)` per block.

## Mail (server only)

On publish with `requiresAcceptance` (always) or `notifyOnly` + `notifyByEmail`, never for the
imprint: job `legal_mail_jobs/{type}_v{n}` starts at `effectiveAt`; every user with an email who
has not accepted that version gets one mail (DE/EN by `users/{uid}.language`) with summary, link
to `/legal/{type}?v=n` and to the app. Log + dedupe in `recipients/{uid}`.
