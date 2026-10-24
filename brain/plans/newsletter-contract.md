# Plattform-Newsletter & Waitlist → Admin-Konsole: Backend-Vertrag

Konzept: `newsletter-concept.md`. Backend: `functions/src/admin-console/modules/newsletter.ts` (über `adminApi`, gleiche
Gate-/Session-/Audit-Kette wie alle Module). Alle Zeiten in ms. Texte der UI deutsch.

## Datenmodell (nur Server, Rules `allow false`)
```
platform_subscribers/{id = sha256(email)[0..40]}   (gleiche ID wie email_suppressions)
  email, name, lang 'de'|'en', source, interest, uid|null (App-Nutzer), status (Aggregat), createdAt, updatedAt
  lists.waitlist | lists.newsletter = { status, source, requestedAt, confirmedAt, unsubscribedAt, bouncedAt, consentVersion }
  /consent_log/{auto} = { list, action requested|confirmed|unsubscribed|bounced|imported, at, ip, userAgent, by,
                          consentVersion, consentHash, consentText, source?, via?, campaignId?, reason? }
platform_optin_tokens/{sha256(token)} = { subscriberId, list, lang, purpose confirm|addNewsletter, expiresAt, usedAt? }
platform_campaigns/{id} = { title, status, defaultLang, variants.{de,en} = { subject, preheader, markdown }, audience,
                            scheduledAt, startedAt, finishedAt, createdBy, stats, lastTest }
  /sends/{subscriberId} = { status queued|sending|sent|suppressed|skipped|failed, lang, messageId, transport, error }
admin_config/newsletter = { daily: { day, count }, leaseUntil, lastCleanupAt }
```
- `ListStatus = 'pending' | 'confirmed' | 'unsubscribed' | 'bounced'`, Listen `'waitlist' | 'newsletter'`.
- `Source = 'landing' | 'app' | 'onboarding' | 'admin' | 'legacy'`.
- `CampaignStatus = 'draft' → 'scheduled' → 'sending' → 'sent'`, plus `'canceled'` (aus scheduled/sending), `'failed'`.
- `Audience = { list, lang: 'de'|'en'|null, appUsersOnly: boolean, source: Source|null }`.

## Typen der Rückgaben
```
Membership = { status, source, requestedAt, confirmedAt, unsubscribedAt, bouncedAt, consentVersion } | null
Subscriber = { id, email, name, lang, source, interest, uid, status, lists: { waitlist: Membership, newsletter: Membership }, createdAt, updatedAt }
Campaign   = { id, title, status, defaultLang, variants, audience, scheduledAt, startedAt, finishedAt, createdAt, updatedAt, createdBy,
               stats: { recipients, sent, failed, skipped, suppressed, unsubscribed, ses: { delivery, bounce, complaint, reject, … } },
               lastTest: { at, emails[] } | null }
```

## Aktionen (`adminApi({ action, params, sessionId })`)
| action | params | Rückgabe | Audit |
|---|---|---|---|
| `newsletter.overview` | – | `{ counts: {waitlist:{pending,confirmed,unsubscribed,bounced}, newsletter:{…}}, appUsers, total, daily:{cap,day,sent}, recentCampaigns: Campaign[] }` | none |
| `newsletter.subscribers.list` | `{ list?, status?, query?, limit? (500, ≤5000) }` | `{ items: Subscriber[], total }` neueste zuerst | read |
| `newsletter.subscribers.get` | `{ id }` | `{ subscriber, consentLog: [{ id, list, action, at, ip, userAgent, by, consentVersion, consentText, via, … }] }` | read |
| `newsletter.subscribers.add` | `{ email, list, lang?, name? }` | `{ id, status: 'pending'\|'confirmed', mailSent }` – nur DOI-Mail, nie direkt bestätigt | mutation |
| `newsletter.subscribers.resendOptin` | `{ id, list }` | `{ status, mailSent }` | mutation |
| `newsletter.subscribers.unsubscribe` | `{ id, list, note? }` | `{ ok }` | mutation |
| `newsletter.subscribers.delete` | `{ id, suppress?: boolean }` | `{ ok }` DSGVO-Löschung inkl. Log; `suppress` sperrt die Adresse zusätzlich | mutation |
| `newsletter.subscribers.export` | `{ list, status? ('confirmed') }` | `{ rows: [{ email, name, lang, source, status, confirmedAt, appUser }] }` | read |
| `newsletter.audience.count` | `{ audience }` | `{ audience, total, byLang: { de, en } }` | none |
| `newsletter.campaigns.list` | `{ limit? }` | `{ items: Campaign[] }` | none |
| `newsletter.campaigns.get` | `{ id }` | `{ campaign, problems: [{ subscriberId, status, error }] }` | none |
| `newsletter.campaigns.save` | `{ id?, title, defaultLang, variants: { de?: {subject, preheader, markdown}, en?: … }, audience }` | `{ id }` – nur Entwürfe | mutation |
| `newsletter.campaigns.delete` | `{ id }` | `{ ok }` – nur draft/canceled | mutation |
| `newsletter.campaigns.preview` | `{ id \| campaign, lang?, sampleName? }` | `{ lang, subject, html }` (Platzhalter ersetzt: `sampleName`, sonst Fallback) (für iframe `srcdoc`, sandbox) | none |
| `newsletter.campaigns.test` | `{ id, emails: string[1..5], lang? }` | `{ results: [{ email, lang, transport, messageId }] }` Betreff „[Test] …“, ohne Listenpflicht | mutation |
| `newsletter.campaigns.schedule` | `{ id, at?: ms }` | ohne `at`/≤ 5 s: sofort, erste Tranche inline → `{ status, recipients, run }`; sonst `{ status: 'scheduled', recipients }` | mutation |
| `newsletter.campaigns.unschedule` | `{ id }` | `{ ok }` scheduled → draft | mutation |
| `newsletter.campaigns.cancel` | `{ id }` | `{ ok }` scheduled/sending → canceled | mutation |
| `newsletter.dispatch.run` | – | `{ started, sent, failed, skipped, suppressed, finished, quotaLeft, busy? }` | mutation |
| `newsletter.migrateLegacy` | `{ dryRun?: boolean (true) }` | `{ dryRun, result: { <collection>: { found, imported, skipped } } }` | mutation |

Fehler: `AdminInputError` → `invalid-argument` mit deutscher Meldung (z. B. „Nur Entwürfe können bearbeitet werden“,
„Zielgruppe ist leer“, „Nicht versandbereit: en: subject missing“).

## Markdown-Umfang (Editor-Hilfe)
`#`/`##`/`###`, Absätze (Zeilenumbruch = `<br>`), `**fett**`, `*kursiv*`, `[Text](https://…)`, `- Liste`, `1. Liste`,
`---`, Button-Zeile `[[Text]](https://…)`, Platzhalter `{{name}}` bzw. `{{name|Fallback}}`. Kein HTML (wird escaped).

## UI-Vorschlag
Seite „Newsletter“ (neben „Leads“): Tabs **Übersicht** (Kennzahlen je Liste/Status, Tageslimit, letzte Kampagnen),
**Abonnenten** (Filter Liste/Status, Suche, Drawer mit Mitgliedschaften + Consent-Log, Aktionen Opt-in erneut senden /
abmelden / löschen (+ sperren), Hinzufügen per DOI, CSV-Export), **Kampagnen** (Liste mit Status/Stats; Editor mit DE/EN-Tabs,
Betreff, Vorschautext, Markdown + Live-Vorschau über `preview`, Zielgruppe mit `audience.count`, Testversand,
„Jetzt senden“ / „Planen“ mit Bestätigungsdialog inkl. Empfängerzahl, Abbrechen). Statistik je Kampagne: Empfänger,
gesendet, zugestellt (`ses.delivery`), Bounces, Beschwerden, Abmeldungen, Fehler. Kein Öffnungs-/Klicktracking.
„Leads“ bleibt für Altbestand + Kontaktformular; dort Hinweis + Button `newsletter.migrateLegacy`.
