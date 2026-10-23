# Vertrag: Plan-Entitlements (Billing ↔ Web, iOS, Admin, KI)

Stand: 2026-10-23 · Owner: Billing-Session · Umsetzung: [billing-implementation.md](./billing-implementation.md).
Änderungen an Feldern oder Codes nur über dieses Dokument (und `functions/src/billing-logic.ts` + `web/utils/billingPlans.ts`).

## 1. Datenquelle
`tenants/{tenantId}/entitlements/plan` — alle Mitglieder lesen, nur Functions schreiben. **Fehlt das Dokument**, gilt
ein Bestandsworkspace in Grace (= Team, KI für alle, keine Limits). Clients dürfen nichts davon schreiben.

| Feld | Typ | Bedeutung |
|---|---|---|
| `plan` | `free \| team \| organization` | wirksamer Plan |
| `status` | `trialing \| active \| past_due \| grace \| free \| canceled` | Abrechnungsstatus |
| `trialEndsAt` / `graceEndsAt` | Timestamp \| null | Ende Test (14 Tage) / Beta-Grace (Stichtag) |
| `currentPeriodEnd`, `cancelAtPeriodEnd` | Timestamp, bool | aktuelles Abo |
| `billingInterval` | `month \| year \| null` | |
| `seats` | number | bezahlte Plätze (= Vollmitglieder, Gäste frei) |
| `memberLimit` | number \| null | 1 (Free), 50 (Team), null (Org) |
| `projectLimit` / `projectCount` | number \| null / number | 3 auf Free, sonst null; Zähler per Trigger |
| `lockedProjectIds` | string[] | Projekte über dem Free-Limit: nur lesen (löschen erlaubt) |
| `invitesAllowed` | bool | Free: false |
| `aiIncluded` | bool | KI für alle Vollmitglieder (nur `trialing`/`grace`) |
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
