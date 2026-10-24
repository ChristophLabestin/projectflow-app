# Waitlist & Plattform-Newsletter (Konzept)

Stand 2026-10-24. Vertrag für die Admin-Konsole: `newsletter-contract.md`. Rechtstexte (Entwurf): `legal/drafts/`.

## Abgrenzung
- **Plattform-Newsletter (dieses Konzept):** ProjectFlow (Labestin Digital) schreibt *eigene* Interessenten und Nutzer an.
  Daten in `platform_*`-Collections, Verwaltung nur über `adminApi` (Plattform-Admins), Versand über `sendEmail()`.
- **Marketing-Modul der Kunden** (`functions/src/newsletter.ts`, `tenants/*/projects/*/marketing_recipients`): Feature für
  Workspaces, die *ihre* Empfänger anschreiben. Wird hier nicht angefasst und teilt keine Daten.
- Altbestand: `waitlist`, `waitlist_pending`, `newsletter_subscribers`, `newsletter_pending`, `newsletter` (alte
  Landingpage). Bleibt lesbar in „Leads“ (`leads.list`); `newsletter.migrateLegacy` übernimmt bestätigte Einträge
  einmalig mit `source: 'legacy'` (ohne IP-Nachweis, so markiert).

## Grundsätze (DSGVO)
- **Double-Opt-in für jede Liste getrennt**: Eintrag `pending` → Mail mit Link → Klick auf „Bestätigen“ (Button auf der
  Landing, nicht schon der GET: Link-Scanner bestätigen sonst) → `confirmed`. Unbestätigte Einträge werden nach 30 Tagen
  gelöscht, Links laufen nach 48 h ab.
- **Nachweis**: pro Ereignis ein Eintrag in `consent_log` (Liste, Aktion, Zeit, IP, User-Agent, Quelle, Version und
  Hash des Einwilligungstexts). Aufbewahrung des Nachweises bis 3 Jahre nach Widerruf (offene Prüfung, s. u.).
- **Waitlist ≠ Newsletter**: zwei Einwilligungen. Nach der Waitlist-Bestätigung fragt die Seite „Auch den Newsletter
  abonnieren?“. Ein Klick dort ist eine eigene Einwilligung; die Adresse ist durch den Bestätigungsklick verifiziert, daher
  ohne zweite Mail (Log-Aktion `confirmed`, `via: 'waitlist-confirm'`).
- **Widerruf** jederzeit: Abmeldelink + `List-Unsubscribe`/One-Click (RFC 8058) in jeder Kampagnenmail
  (`emailUnsubscribe`, Scope `newsletter:<list>:<campaignId>`), App-Einstellungen, Admin.
- **Suppression-Liste** (`email_suppressions`) gilt immer; Bounce/Beschwerde setzt Abonnent auf `bounced`.
- **Kein Öffnungs-/Klicktracking** (kein Pixel, keine Redirect-Links). Offene Entscheidung des Users, s. u.
- Bot-Schutz: Honeypot-Feld `website`, Mindestzeit 2 s zwischen Seitenaufruf und Absenden, Rate-Limit pro IP 10/h und
  Adresse 3/h (M10). Kein Captcha; Turnstile/App Check erst, wenn Missbrauch auftritt.

## Bausteine
| Teil | Ort |
|---|---|
| Reine Logik (Validierung, Markdown→HTML, Template, Zielgruppe, Tokens) | `functions/src/platform-newsletter/logic.ts` |
| Firestore (Abonnent, Opt-in, Bestätigen, Abmelden, Löschen) | `functions/src/platform-newsletter/store.ts` |
| Öffentliche Endpunkte `requestWaitlist`, `requestNewsletterSignup`, `confirmOptin` | `functions/src/platform-newsletter/public.ts` |
| App-Callable `platformNewsletterPreference` | `functions/src/platform-newsletter/app.ts` |
| Versand `platformNewsletterDispatch` (alle 5 min) + Cleanup | `functions/src/platform-newsletter/dispatch.ts` |
| Admin-Aktionen `newsletter.*` | `functions/src/admin-console/modules/newsletter.ts` |
| Landing: `/warteliste`, `/en/waitlist`, `/bestaetigen`, `/en/confirm` | `landing/src/templates/waitlist.ts`, `landing/src/js/optin.ts` |
| App: Schalter „ProjectFlow-Newsletter“ | `web/components/settings/NotificationSettingsPanel.tsx` |
| Tests | `functions/scripts/unit/platform-newsletter.test.js`, `functions/scripts/newsletter-e2e.mjs`, Rules-Test |

## Datenfluss
```
Landing-Formular ─POST→ requestWaitlist / requestNewsletterSignup ─→ platform_subscribers/{sha256(email)} lists.<l>=pending
                                                                  └→ platform_optin_tokens/{sha256(token)} + Mail (type waitlist|newsletter-optin)
Mail-Link /bestaetigen?t=… ─Klick→ confirmOptin {action:'confirm'} → lists.<l>=confirmed, consent_log
                           (Waitlist) → confirmOptin {action:'addNewsletter'} → lists.newsletter=confirmed
Admin: campaigns.save → schedule (jetzt/geplant) → Dispatcher materialisiert sends/{subscriberId} → sendEmail(type newsletter,
       unsubscribeUrl, tags.campaign) gedrosselt (SES-Rate + Tageslimit NEWSLETTER_DAILY_CAP) → sesEvents zählt auf campaign.stats
```

## Kampagnen
- Entwurf: interner Titel, je Sprache (de/en) Betreff, Vorschautext, Inhalt in Markdown (Überschriften, Absätze, fett,
  kursiv, Links, Listen, Trenner, Button `[[Text]](https://…)`, Platzhalter `{{name}}`). Empfänger ohne passende
  Variante bekommen die Standardsprache.
- Zielgruppe: Liste `waitlist` oder `newsletter`, optional Sprache, nur App-Nutzer, Quelle. Testversand an ≤ 5 Adressen
  (Betreff mit „[Test]“).
- Zustände: `draft → scheduled → sending → sent`, `canceled` (aus scheduled/sending), `failed`.
- Versand gedrosselt: SES-MaxSendRate (Sandbox 1/s) über `sendEmail()`, pro Lauf max. 150, Tageslimit
  `NEWSLETTER_DAILY_CAP` (Standard 150, SES-Sandbox hat 200/24 h für alle Mails). „Jetzt senden“ verarbeitet die erste
  Tranche sofort im Admin-Aufruf, den Rest der Dispatcher.

## Offene Entscheidungen / Prüfpunkte für den User
1. Öffnungs-/Klicktracking: standardmäßig aus. Einschalten bräuchte eine eigene Einwilligung im Opt-in-Text.
2. Speicherdauer Nachweis nach Widerruf (Vorschlag 3 Jahre, § 195 BGB) und IP-Speicherung im Klartext (Vorschlag ja,
   nur im Consent-Log, Rechtsgrundlage Art. 6 Abs. 1 lit. c/f).
3. Rechtstext-Entwürfe in `legal/drafts/` prüfen und als nächste Version veröffentlichen.
4. Captcha (Turnstile) nur bei Missbrauch.
5. Onboarding-Abfrage (optional, noch nicht gebaut).
