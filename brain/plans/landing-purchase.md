# Landing: eigene Kaufseite (`/kaufen`, `/en/buy`)

Stand 2026-10-24. Owner-Wunsch: eigene Kaufseite statt Stripe Checkout. Backend-Vertrag:
`brain/plans/billing-entitlements-contract.md` §8 (Callables in europe-west3).

## Ablauf
`?plan=personal|team&interval=month|year&ai=1` (`?mock=1` = Demo ohne Netz/Konto/Zahlung, mit Banner).
1. Plan + Intervall + KI-Paket (1 Platz für den Owner; weitere KI-Plätze später im Billing-Tab).
2. Konto: Firebase Auth desselben Projekts inline (E-Mail/Passwort, Registrierung, Google-Popup, Passwort-Reset).
   Passkeys nicht: rpId ist die App-Domain.
3. Workspace: Personal → eigener persönlicher Workspace (`personal: true`); Team → eigene Team-Workspaces
   (`listBillingWorkspaces`, mit Abo/exempt deaktiviert) oder neuer (`createTeamWorkspace`, Test startet per Trigger).
   Persönlicher Workspace mit Abo → Hinweis + Link in die App (Änderungen laufen nie implizit über die Kaufseite).
4. Zahlung: `createSubscriptionIntent` → Stripe Payment Element (`js.stripe.com/v3`, Key aus `getBillingConfig`),
   `confirmPayment` bzw. `confirmSetup` (Team-Test) mit `redirect: 'if_required'`, `return_url=/kaufen?step=done&tenant=&plan=`.
5. Fertig: pollt `getSubscriptionStatus` (`active`), Link `app.getprojectflow.com/?tenant=…&openSettings=billing`.

Code: `landing/src/templates/buy.ts`, `landing/src/content/buy.ts`, `landing/src/js/buy.ts` (Schritte),
`landing/src/js/buy-api.ts` (Firebase + Mock), `landing/src/styles/buy.scss`. Preis-CTAs Personal/Team der Startseite
zeigen auf `/kaufen?plan=…&interval=…` (folgt dem Monat/Jahr-Schalter); Free → App-Registrierung.

## Rechtliches (Platzhalter, Owner)
- „Zahlungspflichtig bestellen“ (§ 312j BGB), Pflicht-Checkbox AGB + Datenschutz, Laufzeit-/Kündigungshinweis, Testhinweis.
- Offen: Widerrufsbelehrung für Verbraucher (Personal), Laufzeittexte mit AGB abgleichen, USt/OSS (Summen sind netto, `tax` = 0).

## Owner-Setup
- Firebase Auth → Authorized domains: `getprojectflow.com`, `www.getprojectflow.com`, Preview-Domain `getprojectflow--*.web.app`.
- Firebase-API-Key-Referrer-Beschränkung (falls aktiv) um die Landing-Domains erweitern.
- Publishable Key: `node functions/scripts/billing-config.mjs --publishable-key pk_test_…`.
- CSP in `landing/firebase.json` erlaubt Stripe (`js.stripe.com`, `api.stripe.com`, `hooks.stripe.com`), Google-Popup
  (`apis.google.com`, `projectflow-labestin.firebaseapp.com`), Identity Toolkit und die Functions-Domain.

## Bekannte Grenzen
- Wer sich auf der Landing registriert, ist in der App (andere Origin) nicht automatisch angemeldet und durchläuft dort
  das Onboarding beim ersten Login.
