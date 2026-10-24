# Launch-Checkliste (Bezahlpläne)

Stand: 2026-10-24 · Billing läuft im Stripe-**Testmodus** (`acct_1UFlnkFinDXDjLDV`, Sandbox), `billing_public/config.checkoutAvailable = true`.
Details: [plans/billing-implementation.md](../plans/billing-implementation.md), Vertrag [plans/billing-entitlements-contract.md](../plans/billing-entitlements-contract.md).

## Stripe
- [ ] Konto aktivieren („Activate products“, KYC durch den Owner) und Public Details eintragen: Name „ProjectFlow“,
      Support hello@getprojectflow.com, https://getprojectflow.com, Adresse, Statement Descriptor PROJECTFLOW / PFLOW.
- [ ] Billing → Revenue recovery: Smart Retries, E-Mails bei fehlgeschlagenen Zahlungen und ablaufenden Karten; Belege und Rechnungs-E-Mails an.
- [ ] Live-Keys: `firebase functions:secrets:set STRIPE_SECRET_KEY` (sk_live, interaktiv) und `BILLING_ALLOW_LIVE=true` für die
      Billing-Functions; `stripe-setup.mjs` live ausführen (verweigert derzeit Nicht-Test-Keys → bewusst anpassen),
      Live-Webhook + `STRIPE_WEBHOOK_SECRET` (live), Publishable Key `pk_live_…` per `billing-config.mjs --publishable-key`.
- [ ] Test-Abo „Labestin Digital“ (`0Kbs579DnwflExGeLgx8`) gehört zum Testkonto; nach dem Umstieg auf Live dort aufräumen.

## Steuern und Recht
- [ ] USt/OSS klären (Kleinunternehmer?), danach Stripe Tax aktivieren und `automatic_tax` in Checkout/Subscriptions einbauen;
      Steuer-Platzhalter (`tax: 0`) in Vorschau und Kaufseite ersetzen, Rechnungs-Fußzeile ggf. um USt-Hinweis ergänzen.
- [ ] Widerrufsbelehrung (digitale Dienstleistung, Zustimmung zum vorzeitigen Beginn) und AGB-Abschnitt Entgelte/Laufzeit/Kündigung,
      Kaufformulierungen auf `/checkout` („zahlungspflichtig bestellen“), Datenschutz um Stripe ergänzen (`/admin/legal`).

## Technik
- [ ] `minInstances: 1` für `listBillingWorkspaces` und `createSubscriptionIntent` (Kaltstart heute 3–7 s), ggf. `getSubscriptionStatus`.
- [ ] Domain getprojectflow.com → Landing-Site (inkl. `/checkout`), Firebase Auth → Authorized domains prüfen.
- [ ] Organization-Preis/SSO (Produkt existiert nur als inaktiver Entwurf).
