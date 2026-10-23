# Pricing-Strategie ProjectFlow (Vorschlag)

Status: 2026-10-23, Entwurf zur Entscheidung durch den Owner. Nichts davon ist live: Bezahlpläne sind im Code noch
nicht umgesetzt (kein Stripe/Checkout, Plan-Limits aus `APP_CONCEPT.md §3` werden nicht erzwungen; einzig erzwungen
ist das KI-Kontingent pro Nutzer: 1 Mio. Tokens + 50 Bilder/Monat, `functions/src/ai-service.ts`).
Die Landing zeigt die Preise als „geplant“ (Preview-Channel), bis der Owner sie bestätigt.

## 1. Ausgangslage
- Zielgruppe: digitale Teams (Produkt, Entwicklung, Design, Marketing), Agenturen mit Kundenprojekten, Gründer:innen, Freelancer.
- Stärken, die Zahlungsbereitschaft tragen: Web + Desktop + iPhone aus einem Guss, Fokus/Heute, Externe pro Projekt,
  KI-Assistenz inklusive, MCP-Zugang für Claude/ChatGPT/Cursor & Co., Coding-Session-Tracking, EU-Hosting.
- Kosten pro aktivem Platz (Schätzung, prüfen): Firebase (Firestore/Functions/Storage) ≈ 0,3–1 €; KI bei voller
  Ausschöpfung des Kontingents (gpt-5-mini, 1 Mio. Tokens Mischverhältnis + 50 Bilder gpt-image-1-mini) ≈ 1,5–3 €.
  Real nutzen < 20 % der Plätze das volle Kontingent → erwartete KI-Kosten ≈ 0,5 €/Platz.

## 2. Markt (Listenpreise pro Nutzer/Monat bei Jahreszahlung, Stand Wissen 2025 – vor Veröffentlichung prüfen)
| Produkt | Einstieg | Team/Business |
|---|---|---|
| Linear | 0 (bis 250 Issues) | ~8–10 $ / ~14–16 $ |
| Asana | 0 (bis 10 Nutzer) | ~11 $ / ~25 $ |
| ClickUp | 0 | ~7 $ / ~12 $ |
| monday.com | 0 (2 Plätze) | ~9 € / ~12 € (min. 3 Plätze) |
| Notion | 0 | ~10 $ / ~15 $ (+ KI-Add-on) |
| Todoist | 0 | ~4 $ Pro / ~6 $ Business |
Fazit: Teamplätze liegen bei 8–12 €; KI ist oft ein Aufpreis (8–10 $). ProjectFlow kann mit „KI inklusive“ und
„Externe kostenlos“ bei ~10 € klar positioniert werden, ohne Billiganbieter zu sein.

## 3. Empfohlene Pläne (Netto-Preise, zzgl. USt.)
| | **Free** | **Team** (Professional) | **Organization** |
|---|---|---|---|
| Preis | 0 € | **10 €**/Platz/Monat jährlich · **12 €** monatlich | ab **18 €**/Platz/Monat jährlich, ab 10 Plätzen, Angebot |
| Für | Einzelpersonen | Teams bis 50 Mitglieder | Unternehmen mit Governance-Bedarf |
| Projekte | bis 3 | unbegrenzt | unbegrenzt |
| Mitglieder | 1 | bis 50 | unbegrenzt |
| Externe pro Projekt | – | unbegrenzt, kostenlos | unbegrenzt, kostenlos |
| Web, Desktop, iPhone | ✓ | ✓ | ✓ |
| Heute, Fokus, Inbox, Boards, Workbench | ✓ | ✓ | ✓ |
| Initiativen, Sprints, Module | Initiativen | ✓ | ✓ |
| KI-Assistenz | mit eigenem OpenAI-Schlüssel | inkl. 1 Mio. Tokens + 50 Bilder/Platz/Monat | individuelle Kontingente & Richtlinien |
| MCP (Claude, ChatGPT, Cursor …) | ✓ (eigener Zugriff) | ✓ + persönliche Tokens für CI | ✓ + zentrale Richtlinien |
| Sicherheit | Passkeys, 2FA | + Rollen, KI-Aktivitätsprotokoll (180 Tage) | + SSO, erweiterte Protokolle, AV-Vertrag, SLA |
| Support | Hilfe-Center | E-Mail | Priorisiert, fester Ansprechpartner |

Begründungen:
- **Free statt „Starter mit 1 Projekt“**: 3 Projekte senken die Einstiegshürde für Solo-Nutzer; Teamfunktionen
  (Einladen) bleiben der Upgrade-Grund. Abweichung von `APP_CONCEPT.md §3.1` (dort: max. 1 Projekt) → Entscheidung nötig.
- **Team-Limit 50 statt 20**: 20 ist zu knapp für wachsende Agenturen; Organization wird über Governance verkauft, nicht über Kopfzahl.
- **Externe kostenlos**: klares Unterscheidungsmerkmal für Agenturen (Kunden sehen genau ein Projekt) und viraler Kanal.
- **KI inklusive** statt Add-on: einfache Botschaft; Kosten pro Platz gedeckt. Fair-Use über die bestehende Server-Quote.
- **Jahresrabatt ~17 %** (10 statt 12 €) – üblicher Anker, verbessert Cashflow.

## 4. Zusätze
- **14 Tage Team-Test** ohne Kreditkarte für jeden neuen Workspace; danach automatisch Free (keine Datenverluste,
  Projekte über dem Limit werden schreibgeschützt).
- **Gründungspreis** für Beta-Workspaces: 40 % Rabatt im ersten Jahr (6 €/Platz), Preisgarantie 24 Monate.
- **KI-Zusatzpakete** (Team): +1 Mio. Tokens 4 € · +50 Bilder 4 €, monatlich kündbar.
- **Gemeinnützige Organisationen & Bildung**: 50 % auf Team.
- **Mindestabnahme**: keine im Team-Plan (auch 2 Plätze ok); Organization ab 10 Plätzen.

## 5. Kennzahlen & Ziele
- Konversion Test → Team ≥ 8 %; Free → Team (12 Monate) ≥ 3 %; Netto-Umsatzbindung ≥ 100 %.
- Bruttomarge Team ≥ 85 % bei Ø 0,5–1 € KI-Kosten/Platz. Durchschnittliche Teamgröße zum Start erwartet 4–8.

## 6. Umsetzung (Reihenfolge)
1. Entscheidungen des Owners (Preise, Free-Limit, Team-Limit, Gründungspreis).
2. Stripe Billing (Checkout, Customer Portal, Webhooks) in `functions/`; Entitlements am Tenant (`plan`, `seats`, `trialEndsAt`).
3. Durchsetzung der Limits in UI + Regeln (Projekte, Einladungen, KI-Kontingent pro Plan).
4. Steuern: USt./OSS klären – laut Rechtstexten derzeit keine USt-IdNr. (Kleinunternehmer?) → vor Bezahlstart klären.
5. Rechtstexte: AGB-Abschnitt Entgelte/Laufzeit, Datenschutz um Zahlungsdienstleister ergänzen (über `/admin/legal`).
6. Landing: Preise von „geplant“ auf live stellen; In-App-Billing-Seite (`settings → billing`).

## 7. Offene Entscheidungen für den Owner
- Preisniveau Team 10/12 € bestätigen (Alternative: 8/10 € für schnelleres Wachstum).
- Free: 3 Projekte vs. 1 Projekt (Konzept). Team-Limit 50 vs. 20.
- Gründungspreis ja/nein, Höhe und Dauer.
- Ab wann zahlen Beta-Workspaces (Stichtag + Vorlaufzeit von mind. 30 Tagen Ankündigung).
