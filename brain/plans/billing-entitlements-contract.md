# Vertrag: Plan-Entitlements (Billing ↔ Web, iOS, Admin, KI)

Stand: 2026-10-23 · Owner: Billing-Session · Umsetzung: [billing-implementation.md](./billing-implementation.md).
Änderungen an Feldern oder Codes nur über dieses Dokument (und `functions/src/billing-logic.ts` + `web/utils/billingPlans.ts`).

## 1. Datenquelle
`tenants/{tenantId}/entitlements/plan` — alle Mitglieder lesen, nur Functions schreiben. **Fehlt das Dokument**, gilt
ein Bestandsworkspace in Grace (= Team, KI für alle, keine Limits). Clients dürfen nichts davon schreiben.

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

**Flow-Kontingent (`flowsQuota`, umgesetzt von Flows, `flowQuotaFor` in `functions/src/automation-logic.ts`):** `free` = 3 aktive Flows,
200 Läufe/Monat, KI-Schritte nur mit eigenem OpenAI-Schlüssel des Flow-Verantwortlichen; `seat` = je bezahltem Platz 2.000 Läufe und
200 KI-Schritte pro Monat, 50 aktive Flows + 10 je weiterem Platz (max. 200); Server-KI nur, wenn `aiEnabledFor(doc, flowOwner)`,
sonst eigener Schlüssel, sonst `ai-not-enabled`. Ohne Entitlements-Dokument (Grace) = Ein-Platz-Kontingent. Override pro Workspace:
`tenants/{t}.limits.automations`. Zählerstand und aktuelles Limit stehen in `tenants/{t}/automation_usage/{yyyy-mm}`.

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

