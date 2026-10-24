# Legal documents — admin guide

Versioned privacy policy, terms of service and imprint with re-consent across web, desktop and
iOS. Client contract: [../plans/legal-consent-contract.md](../plans/legal-consent-contract.md).

## Access

Admin console → **Rechtsdokumente** (`https://admin.getprojectflow.com/legal`, fallback
`https://projectflow-admin.web.app/legal`), platform admins only (claim + allowlist + TOTP, grant with
`node functions/scripts/grant-platform-admin.mjs <email>`). The app route `/admin/legal` redirects there.

## Publish a new version

1. Console → Rechtsdokumente → document → **Neuen Entwurf beginnen** (prefilled with the
   current version; tab „Diff“ compares with it). Or import Markdown files: `node functions/scripts/import-legal-docs.mjs legal`
   (files `legal/<type>.<lang>.md`, optional `legal/<type>.summary.<lang>.md`; the first `# ` line
   is the title) — this only creates drafts.
2. Edit DE and EN (Markdown subset, see contract), check **Vorschau** and **Diff zur aktuellen**.
3. Write the change summary in DE and EN (shown in the gate, the notice and the email).
4. Choose the type:
   - **Zustimmung erforderlich** (`requiresAcceptance`): blocking gate on the next start of every
     app, email to every user who has not accepted yet. Default for terms changes.
   - **Nur informieren** (`notifyOnly`): non-blocking notice once per version; email optional.
     Typical for privacy policy updates (processing does not rely on consent).
   - Imprint: always "inform only", never mailed.
5. Optional **Gültig ab** (future date): the version is published (visible in the archive as
   "künftig") but gates/mails start only at that time (scheduler checks every 15 min).
6. For `requiresAcceptance`: **Übergangsfrist für API/MCP** (default 14 days) — after it, tokens of
   users who have not accepted get HTTP 403 until they accept in the app.
7. **Veröffentlichen** → confirmation dialog → the version is immutable. Retrying is safe
   (idempotent via `baseVersion`).

## Monitoring

- Version history in the console (Rechtsdokumente): acceptance rate per version (users whose accepted version
  ≥ n / all user profiles) and mail job status (`geplant` / `wird versendet` / `fertig`, sent /
  failed counts).
- Mail log per recipient: `legal_mail_jobs/{type}_v{n}/recipients/{uid}` (`sent` | `failed` +
  error). Failed recipients are not retried automatically (no double send); resend manually if needed.
- Function logs: `firebase functions:log --only onLegalMailJobCreated,processLegalMailJobs`.

## Mail delivery

Uses `sendEmail()` → Amazon SES (type `legal`, see [email-ses.md](./email-ses.md)), ~3 mails/s
(`LEGAL_MAIL_DELAY_MS`, default 300; SES pacing to the account's max send rate on top), batches of 100,
8-minute runs that resume via cursor. Suppressed addresses (bounce/complaint) are skipped.
`LEGAL_MAIL_DRY_RUN=true` (or the emulator) only logs. Check the SES daily quota (Account dashboard) before
publishing to a large user base; in the SES sandbox only verified recipients receive mail.

## Initial setup / seed

Version 1 = the former static texts (`legal/v1/*.md`, exported from the old `LegalPage`), seeded
without mail: `node functions/scripts/import-legal-docs.mjs legal/v1 --publish-initial` (skips
types that already have a version). Every user then accepts once on the next start
(initial consent; also how new registrations record consent).

## Local testing

`.claude/launch.json` → `web-e2e-legal` (app :3081, emulators 9841/8841/9842/5841, `E2E_LEGAL=1`
seeds v1 and makes the demo owner a platform admin). Mails appear as
`[legal-mail:dry-run]` lines in `.firebase-e2e.log`.
Tests: `npm --prefix functions run test:legal`, `node --test functions/scripts/unit/legal-logic.test.js`
(after build), `npm --prefix functions run test:rules`, `npx --prefix web vitest run utils/__tests__/legalConsent.test.ts`.
