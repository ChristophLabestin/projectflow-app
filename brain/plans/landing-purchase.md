# Landing: eigene Kaufseite (`/checkout`, `/en/checkout`)

Stand 2026-10-24. Owner-Wunsch: eigene Kaufseite statt Stripe Checkout. Backend-Vertrag:
`brain/plans/billing-entitlements-contract.md` §8 (Callables in europe-west3).

## Ablauf
Layout (Owner-Vorlage 2026-10-24): schlanke Kopfzeile (Logo, „Zurück zu den Preisen“, keine Site-Navigation), Schrittleiste
Plan → Konto → Workspace → Zahlung, links Eyebrow + große Headline + Rückblick der bisherigen Wahl mit „Ändern“, rechts die
Frage des Schritts. Jeder Schritt ist ein History-Eintrag (Browser-Zurück geht einen Schritt zurück). Von einem Preis-CTA
(`?plan=&interval=&seats=`) ist der Plan nur vorausgewählt; die Seite startet immer beim Plan-Schritt (Auswahl sichtbar). Team: Plätze-Zähler 1–50, wird als `seats` an `createSubscriptionIntent` geschickt (Backend: Menge = max(seats, Vollmitglieder) – mit der Billing-Session abzustimmen). Das KI-Paket ist seit 2026-10-24 nicht mehr auf der Landing (Preise + Checkout); es wird später in der Web-App zubuchbar. Anmeldung: Google, Apple, GitHub (Popup, dieselben Provider wie die App) oder
E-Mail/Passwort. Zahlung: Express Checkout (Apple/Google Pay; AGB-Haken wird vor dem Wallet-Sheet geprüft) über dem
Payment Element (Karte, SEPA). MwSt.-Zeile erscheint erst, wenn der Server `tax > 0` liefert; bis dahin „Gesamtbetrag (netto)“.

`?plan=personal|team&interval=month|year&ai=1` (`?mock=1` = Demo ohne Netz/Konto/Zahlung, mit Banner).
1. Plan + Intervall + KI-Paket (1 Platz für den Owner; weitere KI-Plätze später im Billing-Tab).
2. Konto: Firebase Auth desselben Projekts inline (E-Mail/Passwort, Registrierung, Google-Popup, Passwort-Reset).
   Passkeys nicht: rpId ist die App-Domain.
3. Workspace: Personal → eigener persönlicher Workspace (`personal: true`); Team → eigene Team-Workspaces
   (`listBillingWorkspaces`, mit Abo/exempt deaktiviert) oder neuer (`createTeamWorkspace`, Test startet per Trigger).
   Persönlicher Workspace mit Abo → Hinweis + Link in die App (Änderungen laufen nie implizit über die Kaufseite).
4. Zahlung: `createSubscriptionIntent` → Stripe Payment Element (`js.stripe.com/v3`, Key aus `getBillingConfig`),
   `confirmPayment` bzw. `confirmSetup` (Team-Test) mit `redirect: 'if_required'`, `return_url=/checkout?step=done&tenant=&plan=`.
5. Fertig: pollt `getSubscriptionStatus` (`active`), Link `app.getprojectflow.com/?tenant=…&openSettings=billing`.

Code: `landing/src/templates/buy.ts`, `landing/src/content/buy.ts`, `landing/src/js/buy.ts` (Schritte),
`landing/src/js/buy-api.ts` (Firebase + Mock), `landing/src/styles/buy.scss`. Preis-CTAs Personal/Team der Startseite
zeigen auf `/checkout?plan=…&interval=…` (folgt dem Monat/Jahr-Schalter); Free → App-Registrierung.

## Rechtliches (Platzhalter, Owner)
- „Zahlungspflichtig bestellen“ (§ 312j BGB), Pflicht-Checkbox AGB + Datenschutz, Laufzeit-/Kündigungshinweis, Testhinweis.
- Offen: Widerrufsbelehrung für Verbraucher (Personal), Laufzeittexte mit AGB abgleichen, USt/OSS (Summen sind netto, `tax` = 0).

## Owner-Setup
- Firebase Auth → Authorized domains: `getprojectflow.com`, `www.getprojectflow.com`, Preview-Domain `getprojectflow--preview-bi8zmvui.web.app` (keine Wildcards). Google-Login nutzt `signInWithPopup` über `projectflow-labestin.firebaseapp.com/__/auth/handler`; im OAuth-Client ist dafür nichts zusätzlich einzutragen.
- Firebase-API-Key-Referrer-Beschränkung (falls aktiv) um die Landing-Domains erweitern.
- Publishable Key: `node functions/scripts/billing-config.mjs --publishable-key pk_test_…`.
- CSP in `landing/firebase.json` erlaubt Stripe (`js.stripe.com`, `api.stripe.com`, `hooks.stripe.com`), Google-Popup
  (`apis.google.com`, `projectflow-labestin.firebaseapp.com`), Identity Toolkit und die Functions-Domain.

## Bekannte Grenzen
- Wer sich auf der Landing registriert, ist in der App (andere Origin) nicht automatisch angemeldet und durchläuft dort
  das Onboarding beim ersten Login.
