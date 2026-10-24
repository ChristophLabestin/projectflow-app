# Vertrag: Plan-Entitlements (Billing ↔ Web, iOS, Admin, KI)

Stand: 2026-10-23 · Owner: Billing-Session · Umsetzung: [billing-implementation.md](./billing-implementation.md).
Änderungen an Feldern oder Codes nur über dieses Dokument (und `functions/src/billing-logic.ts` + `web/utils/billingPlans.ts`).

## 1. Datenquelle
`tenants/{tenantId}/entitlements/plan` — alle Mitglieder lesen, nur Functions schreiben. **Fehlt das Dokument**, gilt
der Workspace als **Free ohne KI** (sicherer Standard seit 2026-10-24; jeder Workspace bekommt die Doc bei der Anlage).
Clients dürfen nichts davon schreiben. Neue Vollmitglieder entstehen nur serverseitig (Einladung annehmen,
`setWorkspaceMemberRole` für Gast→Mitglied) mit Seat-Prüfung in der Transaktion.

| Feld | Typ | Bedeutung |
|---|---|---|
| `plan` | `free \| team \| organization` | wirksamer Plan |
| `status` | `trialing \| active \| past_due \| grace \| free \| canceled \| exempt` | Abrechnungsstatus |
| `billingExempt` | bool | intern/kostenlos (nur Admin-Konsole): Team inkl. KI für alle, `status: exempt`, ohne Zahlung |
| `trialEndsAt` / `graceEndsAt` | Timestamp \| null | Ende Test (14 Tage) / Beta-Grace (Stichtag) |
| `currentPeriodEnd`, `cancelAtPeriodEnd` | Timestamp, bool | aktuelles Abo |
| `billingInterval` | `month \| year \| null` | |
| `seats` | number | bezahlte Plätze (= Vollmitglieder, Gäste frei) |
| `memberLimit` | number \| null | 1 (Free), 50 (Team), null (Org) |
| `projectLimit` / `projectCount` | number \| null / number | 3 auf Free, sonst null; Zähler per Trigger |
| `lockedProjectIds` | string[] | Projekte über dem Free-Limit: nur lesen (löschen erlaubt) |
| `invitesAllowed` | bool | Free: false |
| `aiIncluded` | bool | KI für alle Vollmitglieder (`trialing`, `grace`, `exempt`) |
| `aiAddonAvailable` | bool | KI-Paket buchbar (Team/Organization) |
| `aiAddonSeats` / `aiMemberIds` | number / string[] | gebuchte KI-Pakete und zugewiesene Nutzer (uids) |
| `stripeSubscriptionId` | string \| null | vorhanden = bezahltes Abo |
| `storageQuotaBytes` | number? | Dateispeicher (älteres Feld, unverändert) |

**KI pro Nutzer** (`aiEnabledFor(doc, uid)`): `aiIncluded` → ja; sonst nur wenn `aiAddonAvailable` und `uid ∈ aiMemberIds`.
Gäste zählen nie als Platz. Free: KI nur mit eigenem OpenAI-Schlüssel (serverseitig AES-GCM-verschlüsselt in
`ai_user_keys/{uid}`, Schlüssel im Secret `AI_KEY_ENCRYPTION_KEY`; der Client sendet ihn nur einmal an `personalAiKey`).
MCP/eigene KI-Clients sind in allen Plänen ohne KI-Paket nutzbar (sie verbrauchen keine Server-KI).

## 2. Web-Client
```ts
import { useEntitlements } from 'web/hooks/useEntitlements';
const plan = useEntitlements(tenantId); // null während des Ladens
plan.plan; plan.status; plan.limits; plan.usage;   // usage = { projects, seats, aiAddonSeats }
plan.can('createProject' | 'invite' | 'editProject' | 'aiAddon', projectId?)  // bool
plan.aiEnabledFor(uid)                            // bool (Server-KI für diesen Nutzer)
```
Checkout-Verfügbarkeit: `useCheckoutAvailable()` liest `billing_public/config.checkoutAvailable` (alle angemeldeten
Nutzer lesen, nur Server schreibt; fehlt das Dokument = `false`). Solange `false`: Upgrade/KI-Paket-Buttons deaktiviert
(„Bald verfügbar“). Gesetzt wird es mit `node functions/scripts/billing-config.mjs --checkout on`, sobald die Stripe-Functions laufen.
Fehler übersetzen: `planErrorMessage(error, t)` aus `web/services/billingService.ts` (kennt alle Codes unten);
Locale-Schlüssel `billing.errors.<code>`. Upgrade-Link: `?openSettings=billing`.

## 3. Fehlercodes (einheitlich)
| Code | Wo | Bedeutung |
|---|---|---|
| `plan-project-limit` | Rules (permission-denied), REST/MCP 403 `code`, Web-Vorprüfung | Free: 4. Projekt |
| `plan-project-locked` | Rules, REST/MCP 403 | Projekt ist schreibgeschützt |
| `plan-invites-disabled` | Rules, `sendInvitation`, `acceptWorkspaceInvite` | Free: keine Einladungen |
| `plan-member-limit` | `acceptWorkspaceInvite` | Mitgliederlimit erreicht |
| `ai-not-enabled` | KI-Callables (`askCora`, `runAiCapability`, `generateImage`, `editImage`, Server-Text) | weder KI-Paket/Test noch eigener Schlüssel |
| `ai-addon-required` | `aiAssist` (HTTP 402 `code`) | Team: Nutzer hat kein KI-Paket |
| `ai-plan-required` | `aiAssist` (HTTP 402 `code`) | Free-Workspace |
| `ai-addon-unavailable`, `ai-addon-needs-subscription`, `ai-addon-invalid-member` | `setAiAddonMembers` | |
| `billing-not-configured`, `billing-already-subscribed`, `billing-price-missing`, `billing-no-customer` | Checkout/Portal | |
| `invalid-openai-key`, `ai-key-storage-unavailable` | `personalAiKey` | |
| `plan-flow-limit` | `saveAutomation`, `setAutomationEnabled` | Limit aktiver Flows des Plans erreicht (nichts wird abgeschaltet) |
| `plan-flow-runs-limit` | `runAutomation`; automatische Läufe enden als `skipped_limit` (Protokoll: „Kontingent erreicht“) | Flow-Läufe des Monats aufgebraucht |
| `plan-flow-ai-limit` | Flow-KI-Schritte (Lauf `failed`) | KI-Schritte des Monats aufgebraucht |
| `plan-form-limit` | `publishForm`, `setFormStatus` (Forms, geplant) | Limit aktiver Formulare erreicht |
| `plan-form-responses` | `submitPublicForm`, `submitFormAsMember` (geplant) | Antworten des Monats aufgebraucht; Formular zeigt „nimmt derzeit keine Antworten an“ |
| `plan-form-feature` | `publishForm`, `saveFormTheme` (geplant) | Upload-Feld, Logik, volles Theme, Branding ausblenden oder Zielgruppe „Nur Workspace“ nicht im Plan |

**Flow-Kontingent (`flowsQuota`, umgesetzt von Flows, `flowQuotaFor` in `functions/src/automation-logic.ts`):** `free` = 3 aktive Flows,
200 Läufe/Monat, KI-Schritte nur mit eigenem OpenAI-Schlüssel des Flow-Verantwortlichen; `seat` = je bezahltem Platz 2.000 Läufe und
200 KI-Schritte pro Monat, 50 aktive Flows + 10 je weiterem Platz (max. 200); Server-KI nur, wenn `aiEnabledFor(doc, flowOwner)`,
sonst eigener Schlüssel, sonst `ai-not-enabled`. Ohne Entitlements-Dokument (Grace) = Ein-Platz-Kontingent. Override pro Workspace:
`tenants/{t}.limits.automations`. Zählerstand und aktuelles Limit stehen in `tenants/{t}/automation_usage/{yyyy-mm}`.

**Forms-Kontingent (`formQuotaFor` in `web/utils/formsLogic.ts` = `functions/src/forms-logic.ts`, Konzept
[forms-concept.md](./forms-concept.md) §9):** abgeleitet aus `entitlements/plan.plan`, kein eigenes Entitlement-Feld.
Free 3 aktive Formulare / 100 Antworten pro Monat, nur Theme-Presets; Personal 20 / 1.000, Uploads, volles Theme;
Team unbegrenzt / 10.000, zusätzlich Logik, Branding ausblendbar, Zielgruppe „Nur Workspace“; Organization unbegrenzt /
50.000. Ohne Entitlements-Dokument (Grace) = Team. Override pro Workspace (Plattform-Admin, Feld für Feld):
`tenants/{t}.limits.forms` (`activeForms` darf `null` = unbegrenzt sein). Zähler: `tenants/{t}/forms_usage/{yyyy-mm}`.

Callable-Fehler kommen als `HttpsError('failed-precondition' | 'invalid-argument', <code>)` — der Code steht in `message`.

## 4. Callables (europe-west3)
`createBillingCheckout({tenantId, interval, origin, language})` → `{url}` (Owner) ·
`createBillingPortal({tenantId, origin, language})` → `{url}` (Owner) ·
`setAiAddonMembers({tenantId, memberIds})` → `{aiMemberIds}` (Owner, braucht Abo) ·
`personalAiKey({action: 'get'|'set'|'clear', key?})` → `{hasKey, last4}` (jeder Nutzer).

## 5. iOS
Kein Kauf und kein Link auf externe Käufe (App-Store-Regeln). Die App liest nur `entitlements/plan` und zeigt Plan,
Status, Testende und Limits; bei Limit-Fehlern neutraler Hinweis ohne Kauf-Link. Fehlercodes wie oben.

## 6. Admin-Konsole
Pro Workspace anzeigen: `plan`, `status`, `trialEndsAt`/`graceEndsAt`, `seats`, `aiAddonSeats`, `billingInterval`,
`cancelAtPeriodEnd`; MRR (netto) = `seats × (12 | 10) + aiAddonSeats × 10` je nach `billingInterval` (month | year),
nur für `active`/`past_due`. Stripe-Kunde: `billing_customers/{tenantId}.customerId` (server-only).
Stichtag Grace: `admin_config/billing.cutoverAt` (Timestamp).
`billingExempt` setzen/entfernen: `setBillingExempt(tenantId, exempt, actorUid)` aus `functions/src/billing.ts` im
`adminApi` aufrufen (mit Audit-Eintrag), **nicht** das Feld direkt schreiben — Limits/Sperren werden dabei neu berechnet.
Entfernen → Stripe-Stand, falls Abo vorhanden, sonst Free (Projekte über 3 schreibgeschützt).
`grace`/`cutoverAt`: kein Bestandskundenfall (Owner 2026-10-23, „noch keine Kunden“). Neue Workspaces starten immer mit Test;
`grace` steht nur noch auf zwei Alt-Workspaces bis zur Owner-Entscheidung. `cutoverAt` bleibt ungesetzt.

## 7. Persönliche Workspaces und Plan „Personal“ (Owner 2026-10-23)
Jeder Nutzer hat genau **einen persönlichen Workspace**, auch wer nur in ein Team eingeladen wurde.
- **Id** `personal_{uid}`, Tenant-Feld `workspaceType: 'personal'` (Team-Workspaces: `'team'` oder fehlt). Das autoritative
  Feld steht in `entitlements/plan.workspaceType`; Clients dürfen `workspaceType` am Tenant weder setzen noch ändern.
- **Anlage** ausschließlich serverseitig: Callable `ensurePersonalWorkspace({language})` → `{tenantId, created}` (idempotent;
  der Web-Client ruft es bei der Anmeldung auf, wenn der Nutzer noch keinen eigenen Workspace besitzt, statt selbst einen
  ersten Workspace anzulegen; Bestandskonten wurden am 2026-10-23 per Backfill versorgt). Name „Mein Workspace“ / „My workspace“
  (umbenennbar). Bestandsnutzer per Backfill-Skript (`functions/scripts/personal-workspaces.mjs`, erst Emulator, Prod-Lauf nur nach Freigabe).
- **Regeln**: genau 1 Mitglied (Owner), keine Einladungen/Gäste (`invitesAllowed: false`, `memberLimit: 1` in jedem Plan),
  nicht übertragbar (`transferWorkspaceOwnership` lehnt ab: `personal-not-transferable`), nicht löschbar, solange das Konto besteht.
- **Startet als Free** (kein Test). Team-Workspaces (neu angelegt über „Workspace erstellen“) starten mit 14 Tagen Team-Test.

| Plan | `plan` | Preis netto | Projekte | Mitglieder | Flows | Dateispeicher | KI |
|---|---|---|---|---|---|---|---|
| Free (persönlich) | `free` | 0 € | 3 | 1 | Free-Kontingent | 1 GB | eigener OpenAI-Schlüssel |
| Personal | `personal` | **5 €**/Monat · **4 €**/Monat jährlich | unbegrenzt | 1 | wie 1 Team-Platz | **25 GB** | KI-Paket zubuchbar (10 €, Menge 1) oder eigener Schlüssel |

- `personal` ist nur für `workspaceType: 'personal'` buchbar; `team`/`organization` nur für Team-Workspaces. Ein persönlicher
  Workspace wechselt nie auf Team, wer ein Team will, legt einen neuen Workspace an. Fehlercode `plan-workspace-type-mismatch`.
- Eigene **Stripe-Subscription** je Workspace (persönlich und Team sind getrennte Abos, auch beim selben Nutzer). Lookup-Keys
  `personal_monthly` (500), `personal_yearly` (4800); KI-Paket wie Team (`ai_addon_*`, Menge 1, nur der Owner).
- `entitlements/plan` zusätzlich: `workspaceType`, `storageQuotaBytes`, `maxFileBytes`, `flowsQuota: 'seat' | 'free'`.
- **Dateispeicher (Entscheidung 2026-10-23, vor Live änderbar):** Free 1 GB · Personal 25 GB · Team 10 GB pro Vollmitglied,
  gepoolt, mindestens 25 GB · Organization 50 GB pro Vollmitglied · `exempt` wie der bezahlte Plan des Typs. Max. pro Datei
  50 MB (Free/Personal), 250 MB (Team/Organization). Berechnet in `storageFor` und bei jedem Planwechsel/Mitgliederwechsel neu
  geschrieben; `storageQuotaOverrideBytes` (Plattform-Admin) hat Vorrang. Über dem Limit wird nichts gelöscht, nur neue
  Uploads abgelehnt: `HttpsError` mit `details.code` = `plan-storage-limit` bzw. `plan-file-too-large` (`details.reason`
  bleibt `quota`/`too-large`).
- `can('invite')` ist auf persönlichen Workspaces immer `false`; `can('upgradeToTeam')` gibt es nicht. UI: Workspace-Umschalter zeigt
  den persönlichen Workspace als „Persönlich“, Upgrade-Weg im Billing-Tab („Personal buchen“).
- Admin-MRR: `personal` = 5 € (Monat) bzw. 4 € (Jahr) + `aiAddonSeats × 10`.

## 8. Eigene Kaufseite (Stripe Payment Element, Owner 2026-10-24)
Kein Redirect zu Stripe Checkout: die Landing baut eine eigene Kaufseite mit dem **Payment Element** (PCI SAQ A).
Route (Entscheidung User 2026-10-24): **`https://getprojectflow.com/checkout`** bzw. **`/en/checkout`**. Die App verlinkt dorthin mit
`?tenant=<tenantId>&plan=team|personal&interval=month|year[&ai=1]` (`checkoutPageUrl` in `web/services/billingService.ts`);
der gehostete Stripe Checkout (`createBillingCheckout`) bleibt nur als Fallback im Code.
Backend-Callables (europe-west3, Firebase-Auth nötig → Landing nutzt Firebase Auth desselben Projekts; Domain
`getprojectflow.com` muss in Firebase Auth → Authorized domains stehen):

| Callable | Eingabe | Ausgabe |
|---|---|---|
| `previewSubscription` | `{tenantId \| personal: true, plan?, interval: 'month'\|'year', aiAddonSeats?, promotionCode?}` | `{plan, interval, aiAddonSeats, trialEnd, invoice}` |
| `createSubscriptionIntent` | wie oben (`aiAddon: boolean` = 1 KI-Platz für den Owner, alternativ `aiAddonSeats`) | `{subscriptionId, intentType: 'payment'\|'setup'\|'none', clientSecret, change, trialEnd, summary}` |
| `getBillingConfig` | – (ohne Auth) | `{publishableKey, checkoutAvailable, mode}` |
| `listBillingWorkspaces` | `{language?}` | eigene Workspaces (Owner, persönlicher wird bei Bedarf angelegt): `[{tenantId, name, workspaceType, plan, status, billingInterval, memberCount, aiAddonSeats, trialEndsAt, billingExempt, hasSubscription}]` |
| `createTeamWorkspace` | `{name, language?}` | `{tenantId}` (Team-Test startet per Trigger) |
| `getSubscriptionStatus` | `{tenantId \| personal: true}` | `{status, plan, interval, aiAddonSeats, active}` (Erfolgsseite pollt) |
| `recordCheckoutConsent` | `{subscriptionId, terms: true, earlyStart: true, lang}` | `{ok, textVersion}`; Pflicht vor `confirmPayment`/`confirmSetup` (Zustimmung sofortiger Beginn, § 356 Abs. 4 BGB) → Stripe-Metadaten `consent*` + `billing_consents` (server-only); sonst `checkout-consent-required` |

- `summary` (= `invoice`) = `{currency, subtotal, discount, tax, total, amountDue, trialEnd, lines: [{label, quantity, unitAmount, amount}]}` in Cent, netto; `tax` ist 0
  (Kleinunternehmerregelung § 19 UStG; Hinweis steht auf jeder Rechnung).
- Nur der Owner. `personal: true` = eigener persönlicher Workspace. `plan` optional; passt er nicht zum Workspace-Typ →
  `plan-workspace-type-mismatch`. Plätze wählt niemand: Team = Zahl der Vollmitglieder (Gäste frei), Personal = 1.
  `aiAddonSeats`: 0 … Mitglieder (Personal 0 … 1); gekaufte KI-Plätze gehen zuerst an den Owner, den Rest weist der Owner im
  Billing-Tab zu (`setAiAddonMembers`; die Menge folgt dort der Zuweisung).
- Ablauf: Seite ruft `createSubscriptionIntent` → `stripe.confirmPayment` (bzw. `confirmSetup` bei `intentType: 'setup'`, wenn ein
  Team-Test noch > 48 h läuft: Abrechnung erst ab Testende) mit `return_url` → Webhook aktiviert den Plan (`entitlements/plan`
  live beobachten oder `?openSettings=billing` in der App). Erneuter Aufruf mit gleichen Werten liefert dieselbe offene
  Subscription (idempotent); geänderte Werte stornieren die offene. Unbezahlte Subscriptions verfallen nach 23 h bei Stripe und
  ändern am Workspace nichts.
- **Neuer Team-Workspace beim Kauf** (2026-10-24): `createSubscriptionIntent({newWorkspace: {name, language?}, plan: 'team', interval, seats})`
  reserviert eine Tenant-ID, startet ein 14-Tage-Test-Abo (Karte per SetupIntent, `intentType: 'setup'`) und liefert zusätzlich
  `tenantId`. Der Workspace (Tenant, Owner, Entitlement) entsteht **erst im Webhook, sobald die Karte gespeichert** bzw. bezahlt ist;
  vorher existiert nichts in ProjectFlow. Gleiche Werte erneut = dieselbe offene Subscription und Tenant-ID, andere Werte = alte
  stornieren, neue reservieren (`billing_pending_workspaces/{uid}`, server-only). Abgebrochene Test-Abos storniert Stripe am Testende
  (`missing_payment_method: cancel`). `getSubscriptionStatus({tenantId})` liefert bis dahin `{status: 'pending', active: false}`.
  `createTeamWorkspace` bleibt für die App.
- **Änderungen am bestehenden Abo laufen über dieselben Callables** (`change: true`): Intervallwechsel und KI-Plätze, anteilig und
  sofort abgerechnet (`proration_behavior: always_invoice`); Upgrades greifen erst nach Zahlung (`pending_if_incomplete`). Wird die
  hinterlegte Karte belastet, kommt `intentType: 'none'`; braucht es 3-D-Secure, `intentType: 'payment'` mit `clientSecret`.
  Plätze folgen weiter den Mitgliedern; Kündigen, Zahlungsmethode und Rechnungen bleiben im Portal.
- Kündigungsbutton (§ 312k BGB): `createBillingPortal({tenantId, flow: 'cancel'})` öffnet das Portal direkt im Kündigungsablauf
  (`flow_data.subscription_cancel`), Web: „Verträge hier kündigen“ im Billing-Tab.
- Fehlercodes zusätzlich: `billing-exempt`, `billing-promotion-invalid`. `publishableKey` setzt
  `node functions/scripts/billing-config.mjs --publishable-key pk_test_…`.
- Rechnungen: Präfix `PF` + 6 Zeichen je Kunde, Fußzeile mit Anschrift (per API gesetzt).

## 9. Plätze verwalten (Owner 2026-10-24)
- **Plätze sind gekaufte Kapazität** (`entitlements/plan.seats` = Stripe-Menge). Mitglieder kommen und gehen, ohne die Menge zu
  ändern; **nie automatische Erhöhung**. Bei laufendem Abo dürfen Vollmitglieder ≤ `seats` sein (Gäste frei) →
  `acceptWorkspaceInvite` lehnt mit `plan-seat-limit` ab. Ohne Abo (Test, Grace, exempt) gibt es keine Platzgrenze außer `memberLimit`.
- `memberCount` (Vollmitglieder) pflegt `onMemberWrittenBilling`; Team-Speicher = 10 GB × max(Mitglieder, Plätze), mind. 25 GB.
- **Abrechnungsanker = Kaufdatum** (Stripe-Standard). **Mehr** Plätze/KI-Plätze: sofort anteilig berechnet und abgebucht
  (`always_invoice`, `pending_if_incomplete`), erst nach Zahlung aktiv; schlägt sie fehl → `status: 'payment-required'` mit
  `hostedInvoiceUrl`, Plätze bleiben unverändert. **Weniger**: zum Periodenende per Subscription Schedule, ohne Rückerstattung,
  bis dahin nutzbar; nie unter Mitglieder (`plan-seats-below-members`) bzw. zugewiesene KI-Plätze (`ai-addon-seats-below-assigned`).
  Dieselbe Menge wie heute bei geplanter Reduzierung = Reduzierung aufheben. Gemischte Änderungen → `billing-mixed-seat-change`.
- `entitlements/plan.scheduledChange` = `{seats, aiAddonSeats, effectiveAt}` oder `null`.
- KI-Zuweisung (`setAiAddonMembers`) nur innerhalb gekaufter KI-Plätze (`ai-addon-no-free-seat`); sie ändert die Stripe-Menge nicht mehr.

| Callable (Owner) | Eingabe | Ausgabe |
|---|---|---|
| `previewSeatChange` | `{tenantId, seats?, aiAddonSeats?}` | `{kind, seats{from,to}, aiAddonSeats{from,to}, currency, interval, amountToday, nextAmount, currentAmount, nextBillingDate, effectiveAt, hasScheduledChange}` |
| `changeSeats` | wie oben | `{status: 'applied', amountPaid}` · `{status: 'scheduled', effectiveAt}` · `{status: 'payment-required', hostedInvoiceUrl, amountDue}` · `{status: 'scheduled-change-cancelled' \| 'unchanged'}` |
| `getBillingOverview` | `{tenantId}` | `{seats, memberCount, aiAddonSeats, aiAssigned, scheduledChange, currency, nextBillingDate, nextAmount, invoices[]}` |

UI: Billing-Tab → „Plätze“ (`BillingSeats`), Einladen-Dialog → `SeatUpsell` („1 Platz dazubuchen – heute anteilig X €“ bzw. „Owner fragen“).
Getestet mit Stripe Test-Clocks: `node functions/scripts/seat-test-clock.mjs` (11/11).

