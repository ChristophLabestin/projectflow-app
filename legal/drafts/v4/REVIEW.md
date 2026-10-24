# AGB v4 – Freigabe-Unterlage (Entwurf, nicht veröffentlicht)

Stand 2026-10-24. Dateien in diesem Ordner: `terms.de.md`, `terms.en.md` (vollständige AGB v4 inkl. Anlage 1
Widerrufsbelehrung und Anlage 2 Muster-Widerrufsformular), `terms.summary.de|en.md` (Änderungshinweis für die
Zustimmungs-/Hinweisanzeige). Keine Rechtsberatung – rechtlich bindend erst nach Prüfung und Freigabe durch den Owner.

## Was sich gegenüber v3 ändert
- Geltungsbereich B2B **und B2C** (v3: „nur B2B“, Widerrufsrecht ausgeschlossen).
- Abschnitt 7 neu: 7.1 Pläne/Preise · 7.2 Zahlung/Rechnungen · 7.3 Laufzeit/Verlängerung · 7.4 Kündigung (inkl. Button) ·
  7.5 Plätze/KI-Paket/Planwechsel · 7.6 Preisänderungen · 7.7 Zahlungsverzug/Sperre · 7.8 Daten nach Ende/Datenexport.
- Abschnitt 8 neu: Widerrufsrecht für Verbraucher (ersetzt v3 § 8 Laufzeit/Kündigung, jetzt in 7.3/7.4).
- Abschnitte 1, 2, 3, 15, 16, 17, 19 um Verbraucher-Regeln ergänzt; § 4 „eigene geschäftliche Zwecke“ → „eigene Zwecke“.
- Fehler in v3 § 1 behoben: Verweis auf die AVV zeigte auf Abschnitt 11 statt 12.
- v3-Regeln, die nicht zum Code passten und ersetzt wurden: Kündigungsfrist 30/5 Tage vor Ablauf (Code: jederzeit zum
  Periodenende, Stripe `at_period_end`), „zuzüglich Steuern“ (Kleinunternehmer § 19 UStG), „30 Tage Export, danach
  Löschung“ (Code: Workspace läuft im Free-Plan weiter, nichts wird gelöscht), Planbeispiele „Starter/Professional“.

## Gegen den Code geprüfte Fakten
| Aussage | Quelle |
|---|---|
| Personal 5 €/Monat, 48 €/Jahr; Team 12 €/Platz/Monat, 120 €/Platz/Jahr; KI-Paket 10 €/Monat, 120 €/Jahr | `functions/scripts/stripe-setup.mjs` (Lookup-Keys, `unit_amount`) |
| Personal nur persönlicher Workspace, Team nur Team-Workspace, eigenes Abo je Workspace | `billing-logic.ts` `paidPlanFor`, Vertrag §7 |
| 14 Tage Test nur für neue Team-Workspaces, persönliche starten Free; Test ohne Karte endet → Free | `TRIAL_DAYS`, `initialEntitlement`, `missing_payment_method: 'cancel'`, `billingSweep` |
| Abrechnung im Voraus, Anker = Kaufdatum; im Test erste Abbuchung am Testende | Vertrag §9, `createSubscriptionIntent` (`trial_end`) |
| Mehr Plätze/KI: sofort anteilig berechnet, erst nach Zahlung aktiv; weniger: zum Periodenende, ohne Erstattung, nie unter Mitglieder | `always_invoice` + `pending_if_incomplete`, Subscription Schedule (`billing-seats.ts`) |
| Kündigung jederzeit zum Periodenende im Portal | `stripe-setup.mjs` `subscription_cancel: at_period_end` |
| Zahlungsausfall: Zugang bleibt während Stripe-Retries (`past_due`), danach `canceled/unpaid` → Free | `mapStripeStatus` |
| Free: Projekte über 3 (zuletzt bearbeitete bleiben) schreibgeschützt, nichts gelöscht | `projectsToLock`, `plan-project-locked` |
| Datenexport JSON unter Einstellungen → Konto | `exportMyData` (`account-data.ts`) |
| Keine USt, Hinweis § 19 UStG | Launch-Checkliste, Rechnungs-Fußzeile |

## ⚠ Prüfen – offene Punkte (auch im Text markiert; Markierungen vor Veröffentlichung entfernen)
1. **Verbraucheröffnung** als wesentliche Änderung → `requiresAcceptance` (neue Zustimmung aller Nutzer, Mail).
2. **Vertragsbestätigung auf dauerhaftem Datenträger** (§ 312f Abs. 2 BGB): E-Mail mit AGB + Widerrufsbelehrung nach dem Kauf fehlt.
3. **Leistungsumfang der Pläne** (Projekte, Speicher, KI-Kontingente) ist nur in der Planübersicht beschrieben und „vor Live änderbar“.
4. **Jahresabo für Verbraucher** (§ 309 Nr. 9 BGB): nach 12 Monaten unbefristet mit Monatsfrist + anteilige Erstattung – Stripe verlängert technisch um 12 Monate; bis zur Lösung manuell.
5. **Kündigungsbutton § 312k BGB**: gebaut ist „Verträge hier kündigen“ in Einstellungen → Abrechnung (nur angemeldet, Owner) → Stripe-Kündigungsablauf. Offen: öffentlich erreichbare Kündigungsseite ohne Login, Bestätigungsknopf „jetzt kündigen“ (Stripe: „Abo kündigen“), Bestätigungs-E-Mail mit Eingangszeitpunkt.
6. **Intervallwechsel** wird auf der Bestellseite sofort, im Portal per Gutschrift verrechnet.
7. **Preisänderungsklausel** (B2B § 307 BGB; B2C nur mit Zustimmung).
8. **Zahlungsverzug**: Retry-Dauer in Stripe noch nicht konfiguriert; konkrete Frist nennen? Mahnung vor Herabstufung.
9. **Löschfrist** nach Vertragsende (`[⚠ Frist]` im Text) und Vollständigkeit des Exports (Limits 100 Workspaces / 300 Projekte / 500 Einträge je Sammlung).
10. **Einordnung digitale Dienstleistung** (§ 327 Abs. 2, § 356 Abs. 4, § 357a Abs. 2 BGB); Checkbox wird auch Unternehmern angezeigt (keine Abfrage Verbraucher/Unternehmer).
11. **Gewährleistung** für Verbraucher (§§ 327 ff., Aktualisierungspflicht § 327f).
12. **Haftung**: grobe Fahrlässigkeit B2B, 12-Monats-Deckel nur B2B.
13. **Änderungsklausel**: Zustimmungsfiktion B2B, Zustimmung B2C.
14. **Gerichtsstand** nur für Kaufleute; VSBG-Hinweis (freiwillig).
15. **Widerrufsbelehrung**: Abweichungen vom gesetzlichen Muster (Testsatz, „Besondere Hinweise“) kosten die Musterschutzwirkung; ggf. streichen. Telefon nicht angegeben (optional). Englische Fassung = Übersetzung, deutsche maßgeblich (in § 20 ergänzen?).
16. **Datenschutzerklärung**: Stripe als Empfänger und `billing_consents` (Nachweis der Checkout-Zustimmung) ergänzen – nicht Teil dieses Entwurfs.

## Technik zum Entwurf (gebaut, nicht deployt)
- **Checkout-Zustimmung** (`/checkout`): zweite Pflicht-Checkbox „Ich verlange ausdrücklich … sofort … Wertersatz … erlischt“
  (DE/EN, `landing/src/content/buy.ts` `payment.earlyStart`, Link auf Anlage 1). Vorher gab es nur die AGB/Datenschutz-Checkbox
  ohne serverseitige Speicherung. Vor `confirmPayment`/`confirmSetup` ruft die Seite die neue Callable
  **`recordCheckoutConsent`** auf; ohne Erfolg wird nichts bestätigt. Gespeichert: Stripe-Subscription-Metadaten
  (`consentTextVersion`, `consentTermsVersion`, `consentEarlyStart`, `consentAt`) und `billing_consents/{autoId}`
  (uid, tenantId, subscriptionId, termsVersion, textVersion, lang, acceptedAt; nur Server). Wortlaut ändern →
  `CHECKOUT_CONSENT_VERSION` in `functions/src/billing-logic.ts` erhöhen.
- **Kündigungsbutton**: „Verträge hier kündigen“ / „Cancel contracts here“ im Billing-Tab (Owner, Abo aktiv, nicht bereits
  gekündigt) → `createBillingPortal({flow: 'cancel'})` öffnet das Stripe-Portal direkt im Kündigungsablauf.

## Veröffentlichen (nur nach Freigabe durch den Owner)
1. ⚠-Blöcke entfernen, `[Datum der Veröffentlichung]`/`[⚠ Frist]` füllen.
2. `cd functions && npm run build && node scripts/import-legal-docs.mjs ../legal/drafts/v4` → Entwurf in der Admin-Konsole (Rechtstexte → AGB).
3. In der Admin-Konsole Änderungsart `requiresAcceptance`, Gültig-ab-Datum setzen, veröffentlichen (nicht `publish-legal-drafts.mjs`, das erzwingt `notifyOnly`).
4. Danach `legal/terms.*.md` mit dem veröffentlichten Text ersetzen.
5. Deploy: Functions `recordCheckoutConsent`, `createBillingPortal`; Hosting Landing (Checkbox) und Web-App (Button) – erst nach Functions.
