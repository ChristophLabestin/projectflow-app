# Billing-Umsetzung (Stripe, Test-Modus)

Stand: 2026-10-23 · Quelle der Preise: [pricing-strategy.md](./pricing-strategy.md), Regeln: `reference/app/APP_CONCEPT.md §3`.
Feld- und Fehlercode-Vertrag für Web/iOS/Admin: [billing-entitlements-contract.md](./billing-entitlements-contract.md).
Nicht enthalten (Owner-Follow-ups): USt./OSS, Live-Schlüssel, AGB/Datenschutz, Gründungspreis, Organization/SSO.

## Datenmodell
- **Entitlements** (autoritativ, nur Server schreibt): `tenants/{tenantId}/entitlements/plan`
  (dasselbe Dokument trägt schon `storageQuotaBytes` für den Dateispeicher; Schreiben immer mit `merge`).
  Felder: `plan` (`free|team|organization`, der *wirksame* Plan), `status` (`trialing|active|past_due|grace|free|canceled`),
  `seats`, `billingInterval` (`month|year|null`), `trialEndsAt`, `graceEndsAt`, `memberLimit` (1 | 50 | null),
  `projectLimit` (3 | null), `invitesAllowed`, `aiIncluded`, `projectCount`, `lockedProjectIds`, `updatedAt`.
  Liegt bewusst nicht auf dem Tenant-Dokument selbst, weil Admins das Tenant-Dokument per Client schreiben dürfen.
- **Stripe-Zuordnung** (nur Server): `billing_customers/{tenantId}` mit `customerId`, `subscriptionId`, `priceId`.
- **Eigener OpenAI-Schlüssel** (Free-KI, nur Server): `ai_user_keys/{uid}`.
- **Stichtag Bestandsworkspaces**: `admin_config/billing.cutoverAt` (Owner setzt ihn; leer = Grace läuft weiter).

## Planregeln (`functions/src/billing-logic.ts`, gespiegelt in `web/utils/billingPlans.ts`)
| | Free | Team (Test/Grace/aktiv) |
|---|---|---|
| Vollmitglieder | 1 | bis 50 (Gäste/Externe zählen nicht) |
| Projekte | 3 (darüber schreibgeschützt) | unbegrenzt |
| Einladungen | nein | ja |
| KI | nur eigener OpenAI-Schlüssel | Test/Grace: alle Mitglieder; danach **KI-Paket 10 €/Nutzer/Monat** pro zugewiesenem Nutzer (1 Mio. Tokens + 50 Bilder, bestehende Server-Quote) |

## Abläufe
1. **Neuer Workspace** → Trigger `onTenantCreatedBilling`: 14 Tage Team-Test (`status: trialing`, ohne Karte).
2. **Bestandsworkspace** (vor `BILLING_LAUNCH_AT`) → Backfill im Sweep: `status: grace`, Team bis `cutoverAt`.
   Fehlt das Entitlement-Dokument ganz, gilt in Regeln und Functions ebenfalls Team (nichts bricht beim Deploy).
3. **Upgrade** → Callable `createBillingCheckout` (Owner): Stripe Checkout (Abo, Menge = Vollmitglieder, Preis per
   Lookup-Key `team_monthly`/`team_yearly`); läuft noch ein Test, startet die Abrechnung erst an dessen Ende.
4. **Verwalten** → Callable `createBillingPortal` (Owner): Stripe Customer Portal (Zahlart, Intervall, Kündigung, Rechnungen).
5. **Webhook** `stripeWebhook`: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` →
   Entitlements neu berechnen. `past_due` bleibt Team (Stripe-Mahnlauf), `canceled/unpaid` → Free.
6. **Sweep** `billingSweep` (stündlich): abgelaufene Tests/Grace → Free; Backfill; Projektzähler nachziehen.
7. **Downgrade auf Free**: nichts wird gelöscht. Die 3 zuletzt aktualisierten Projekte bleiben schreibbar, der Rest kommt
   in `lockedProjectIds` (Regeln: nur lesen). Zusätzliche Mitglieder bleiben, neue Einladungen sind gesperrt.
8. **Plätze**: Trigger auf `members` passt die Abo-Menge an (Proration), Gäste zählen nicht.
9. **KI-Paket**: zweites Abo-Item (Lookup-Keys `ai_addon_monthly`/`ai_addon_yearly`, Intervall wie Team). Callable
   `setAiAddonMembers` (Owner) setzt `aiMemberIds`, die Item-Menge folgt der Liste; verlässt ein Mitglied den Workspace,
   verliert es das Paket. Wird die Menge im Portal verkleinert, bleiben die ersten N Zuweisungen.
10. **Eigener OpenAI-Schlüssel**: `ai_user_keys/{uid}.secret` = AES-256-GCM mit Secret `AI_KEY_ENCRYPTION_KEY`; nur
   `personalAiKey` schreibt, nur die KI-Callables entschlüsseln. Gilt für jeden Nutzer ohne Server-KI (Free und Team ohne Paket).

## Durchsetzung
- Firestore-Regeln: Projekt anlegen nur unter `projectLimit` (Zähler `projectCount`, per Trigger gepflegt),
  Schreiben in gesperrten Projekten verboten, Einladungen/Mitglieder anlegen nur mit `invitesAllowed`.
- REST-API/MCP/KI-Tools (`projectflow-api.ts` → `authRequest`): Projektlimit und gesperrte Projekte (403 mit `code`).
- Functions: `sendInvitation`/`acceptWorkspaceInvite` prüfen `invitesAllowed` und `memberLimit`;
  `consumeAiQuota` prüft KI-Berechtigung (Team-Mitgliedschaft *oder* eigener Schlüssel); In-App-Assistent prüft den Workspace.
- Web: `useEntitlements` + Billing-Tab (`settings → billing`), Hinweise bei Projektanlage, Einladung, gesperrtem Projekt.

## Einrichtung (Test-Modus)
1. `firebase functions:secrets:set STRIPE_SECRET_KEY` (nur `sk_test_…`).
2. `STRIPE_SECRET_KEY=sk_test_… node functions/scripts/stripe-setup.mjs` legt Produkt, Preise, Portal-Konfiguration und
   den Webhook-Endpunkt an und gibt das Webhook-Secret aus → `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`.
3. Functions deployen (`billing*`, `stripeWebhook`, `sendInvitation`, `acceptWorkspaceInvite`, KI-Callables), Regeln deployen.

## Owner-Follow-ups
USt./OSS-Klärung und Stripe Tax · Live-Schlüssel + Live-Webhook · AGB „Entgelte/Laufzeit“ und Datenschutz (Stripe) ·
Stichtag `cutoverAt` für Bestandsworkspaces (mind. 30 Tage Ankündigung) · Gründungspreis · Organization/SSO ·
Verhalten für Zusatzmitglieder nach Downgrade (derzeit: bleiben, ohne KI).
