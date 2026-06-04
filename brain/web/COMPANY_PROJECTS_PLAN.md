# Company Projects ("Unternehmensprojekte") — Implementation Plan

Goal: let a founder manage a startup **at any stage of its life** — from before the
company exists, through formation, launch, and into full operation — inside a single
ProjectFlow "company project" (`projectCategory: 'startup_company'` /
`templateId: 'startup_company_formation'`).

This document captures the review findings, the concrete work items, and the longer
follow-ups. It is the source of truth for this initiative; keep it updated as work lands.

## Where the feature lives

- Data model: `web/types.ts` (`StartupProfile`, `StartupReadiness`, `CompanyProjectRole`).
- Config & seeds: `web/config/projectTemplates.ts` (tracks, jurisdiction templates, seed
  tasks/milestones/initiatives).
- Calculations: `web/utils/startupProjects.ts` (readiness snapshot, linked-project rollup).
- Creation & seeding: `web/screens/CreateProjectWizard.tsx`.
- Command center UI + modals: `web/screens/ProjectOverview.tsx`.

## Review findings (why this work is needed)

1. **Readiness checklist was dead data.** The 12 `startupReadiness` booleans were written
   `false` once at creation and never editable, so `formationPercent`/`financePercent`
   were permanently 0% and `launchGate` could never reach `ready`.
2. **Jurisdiction was never captured at creation.** The wizard hardcoded the
   `global_generic` template, so the valuable DE/US jurisdiction seed tasks never fired.
3. **Changing jurisdiction later did not backfill tasks.** The briefing modal updated the
   template id + sources but seeded no country-specific tasks.
4. **No stage-awareness.** The command center rendered identically for an idea-stage and a
   fully operating company; the "Go to launch" framing is meaningless once operating.
5. **Readiness and tasks were disconnected** — completing the seeded "legal structure"
   task did not advance `legalStructureDecided`.

## Work items

### 1. Manual stage selection at creation (explicit requirement)
A founder can register a company **at whatever stage it is really in**:
- Add the founding brief to the wizard's startup step: **stage** (`idea → validating →
  preparing → filed → registered → operating`), business model, jurisdiction
  country/region, funding route, regulated-industry status, target customer, co-founder /
  employee flags.
- The selected stage drives sensible **readiness defaults** (e.g. an `operating` company
  starts with formation/finance/compliance readiness pre-marked), so adding an already
  operational company does not show 0% readiness.

### 2. Jurisdiction capture + country-specific seeding at creation
- Resolve the jurisdiction template from the entered country/region and pass it into
  `seedStartupProject`, so DE/US legal/tax/compliance tasks seed at creation.

### 3. Re-seed jurisdiction tasks when jurisdiction changes
- When the founding-briefing modal changes the jurisdiction, idempotently seed any missing
  jurisdiction tasks (deduped via the existing `externalKey`
  `startup_company_formation:<id>`).

### 4. Derive readiness from task completion
- `web/utils/startupProjects.ts`: map each readiness key to its seed task(s) via
  `templateSeedId`. Effective readiness = stored boolean `OR` mapped task complete. This
  makes the formation/finance/compliance meters move as real work is completed and keeps a
  single, trustworthy source of truth (manual override still possible).

### 5. Editable readiness + manual stage change from the overview
- Founding-briefing modal gets an editable readiness checklist and the existing stage
  selector, so founders can correct stage/readiness any time.

### 6. Stage-aware command center
- A stage stepper shows the 6 stages with the current one highlighted.
- The readiness headline / launch meter relabels by phase:
  - `idea`/`validating` → "Validation & setup" focus.
  - `preparing`/`filed`/`registered` → "Formation & launch readiness" focus.
  - `operating` → "Operating readiness" focus; de-emphasize the launch gate and surface the
    linked-project rollup + operating cadence instead.

## Follow-ups (tracked, not in the first pass)

- Operating-stage financial KPIs (runway, MRR/revenue, active customers) sourced from the
  `accounting` module / `FinanceTracking`.
- Funding/runway readiness slice driven by `fundingRoute`.
- "Add linked project" CTA in the linked-projects empty state, pre-linked to the company.
- Collapse the dual `regulatedIndustryStatus` + legacy `regulatedIndustry` fields.
- Memoize the heavy company-section derivations in `ProjectOverview.tsx`.
