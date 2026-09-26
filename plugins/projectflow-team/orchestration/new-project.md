# Workflow: Neues (Kunden-)Projekt aufsetzen

**Auslöser:** „Neues Kundenprojekt <Name>: <kurz worum es geht>."
**Orchestrator:** Carla.

## Schritte
1. **Klassifizieren:** Kundenprojekt oder eigenes Produkt? (→ `dispatch-matrix.md`)
2. **Projekt anlegen** in ProjectFlow (falls nicht vorhanden): `create_agent`/`create_task` bzw. Projekt-Setup.
3. **Team zusammenstellen** (Regeln aus der Matrix). Fehlende Rollen **einstellen** via `create_agent`:
   - immer: dedizierter **Product Manager** für das Projekt,
   - Kundenprojekt: zusätzlich **Customer Service** + **Lara** (Datenschutz), 
   - je nach Bedarf Theo (Architektur), Uma (UX), Quinn (QA).
4. **Context-Pack anlegen:** `<repo>/.team/CONTEXT.md` (Template) — kompakt, damit Subagenten billig arbeiten.
5. **Erste Tasks** anlegen und den Agenten zuweisen (PM: Discovery/Scope; CS: Kundenkanal; Lara: Datenschutz-Erst-Check).
6. **State/Handoff initialisieren:** `<repo>/.team/STATE.md` + `HANDOFF.md` (Templates).
7. **Kurz-Report** an Christoph (ProjectFlow + Outbox), was aufgesetzt wurde und wer dran ist.

## Leitplanken
- Unsicher, ob Kundenprojekt / welcher Umfang? → `raise_decision` an Christoph.
- Keine kundensichtbaren Zusagen ohne Freigabe.
