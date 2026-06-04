# Startup And Company Founding Project Expansion Plan

Date: 2026-05-27  
Status: Plan implemented through jurisdiction-aware templates, company grouping/linking, startup cockpit, restricted resource handling, and validation
Scope: Extend ProjectFlow projects beyond software delivery so a project can manage founding and launching a new company or startup.

## Goal

ProjectFlow should support a "company founding" project as a first-class project template, not as a hacked software project with renamed tasks.

The user should be able to create a project for founding a new business and then manage:

1. The company idea and validation work.
2. Founder, advisor, stakeholder, and decision ownership.
3. Formation, legal, compliance, and tax readiness.
4. Business model, offer, pricing, finance, funding, and runway.
5. Product, operations, go-to-market, launch, and post-launch execution.
6. Ongoing health against the actual founding stage, not only task deadlines.

This is not legal or tax advice. ProjectFlow should help users structure, track, and assign the work. Jurisdiction-specific steps must be configurable and should clearly direct users to qualified legal, tax, and regulatory advisors where needed.

## Current Repo Reality

ProjectFlow already has strong primitives for this expansion:

- `Project` supports `projectType`, `operatingMode`, `dateConfidence`, `brief`, `operatingModel`, `riskRegister`, `healthSnapshot`, `modules`, lifecycle states, members, and roles in `web/types.ts`.
- The current `ProjectType` union is `standard | software | creative`, so "startup/company founding" currently has no durable classification.
- `web/screens/CreateProjectWizard.tsx` already captures project type, objective, success criteria, modules, dates, priority, status, media, GitHub, and optional AI blueprint output.
- Existing modules include `tasks`, `initiatives`, `issues`, `ideas`/Flows, `milestones`, `activity`, `groups`, `social`, `marketing`, and `accounting`.
- `web/services/healthService.ts` already penalizes missing Project Brief fields and can be extended with founding-specific health factors.
- `brain/reference/app/APP_CONCEPT.md` still positions the product primarily around B2B software and digital-sector teams, so a broader company-building direction should be reflected there once accepted.

The correct product move is therefore:

- Broaden project taxonomy.
- Add a startup/company template.
- Seed the right lifecycle, modules, milestones, Flows, risks, and health rules.
- Avoid building a separate "startup app" inside ProjectFlow.

## Product Principle

A startup project is not a software project. It is a business formation and launch system.

For this template, ProjectFlow should optimize for:

> "What must become true before this company can legally, financially, operationally, and commercially launch?"

This changes the meaning of "project health":

- A software project can be healthy if work is moving and blockers are low.
- A founding project can still be unhealthy even with many completed tasks if company structure, compliance, financing, ownership, market validation, or launch readiness are unresolved.

## What Belongs To Startup And Company Founding

### 1. Idea, Problem, And Opportunity

Track whether the venture has a clear reason to exist:

- Problem statement.
- Target customer segment.
- Pain intensity and frequency.
- Existing alternatives and competitor map.
- Differentiation and unfair advantage.
- Market size and wedge.
- Initial assumptions and riskiest unknowns.
- Decision: pursue, pivot, pause, or kill.

ProjectFlow fit:

- Flows for problem discovery, assumption mapping, competitor notes, and pivot decisions.
- Initiatives for validation tracks.
- Tasks for interviews, surveys, landing pages, experiments, and synthesis.
- Health signal: validation evidence missing or stale.

### 2. Founders, Roles, Governance, And Advisors

Track who makes decisions and who owns the founding work:

- Founder list.
- Founder roles and responsibilities.
- Decision owner and tie-break rules.
- Advisor, mentor, lawyer, tax advisor, accountant, and agency contacts.
- Ownership/equity assumptions.
- Founder agreement status.
- IP assignment status.
- Confidentiality needs.
- Board or advisory cadence if relevant.

ProjectFlow fit:

- Project members and external collaborators.
- Role-specific permissions for founders, advisors, lawyers, accountants, and contractors.
- Open decisions register for equity, roles, legal form, and operating agreements.
- Health signal: no decision owner, unresolved founder agreement, missing IP assignment tracking.

### 3. Legal Formation And Registration

Track what must happen before the venture is a legally usable entity. Exact steps vary by jurisdiction.

Common categories:

- Jurisdiction/country/state.
- Legal structure or company form.
- Company name search and reservation.
- Domain and trademark screening.
- Articles, incorporation documents, operating agreement, bylaws, or local equivalents.
- Notary, registry, or formation authority steps.
- Business registration or trade registration where required.
- Tax registration.
- Employer registration where required.
- Licenses, permits, and regulated-industry approvals.
- Registered address and official contact details.
- Bank account readiness.
- Formation document storage.

ProjectFlow fit:

- Milestones for stage gates: "Formation decision made", "Documents prepared", "Entity registered", "Tax setup complete".
- Tasks for concrete filings and advisor handoffs.
- Resources for official portals, filings, certificates, and receipts.
- Health signal: jurisdiction unknown, legal structure undecided, regulatory status unknown, missing registration proof.

### 4. Compliance, Privacy, And Risk

Track whether the company can operate responsibly:

- Privacy requirements and data processing roles.
- Terms, privacy policy, imprint/legal notice, and customer contracts.
- Industry-specific obligations.
- Employment and contractor compliance.
- Insurance needs.
- Security baseline.
- Financial record retention.
- Export/sanctions checks where relevant.
- Data processing agreements for vendors.
- Risk register with severity, mitigation owner, and review cadence.

ProjectFlow fit:

- Risk register extension.
- Compliance checklist module or template-backed task group.
- Document/resource vault.
- Permissions for sensitive legal and finance records.
- Health signal: regulated venture with no compliance owner, missing privacy/legal docs before launch.

### 5. Business Model, Offer, And Pricing

Track whether the venture can make money:

- Revenue model.
- Target customer and buyer persona.
- Offer definition.
- Pricing hypothesis.
- Unit economics assumptions.
- Sales motion: self-serve, founder-led sales, enterprise, marketplace, agency, retail, etc.
- Packaging and tiers.
- Payment flow requirements.
- Refund, support, and cancellation rules.

ProjectFlow fit:

- Flows for pricing and positioning exploration.
- Initiatives for offer validation.
- Tasks for pricing interviews, checkout setup, terms, and payment provider work.
- Health signal: launch planned with no pricing or revenue model.

### 6. Finance, Funding, And Runway

Track whether the company has enough money and financial controls:

- Startup cost estimate.
- Monthly burn or operating cost forecast.
- Runway.
- Funding route: bootstrapped, grants, loan, angel, VC, revenue-funded, crowdfunding.
- Capital requirements.
- Bank account.
- Accounting setup.
- Chart of accounts and bookkeeping cadence.
- Tax calendar.
- Payroll readiness if hiring.
- Investor materials if fundraising.
- Grant or loan deadlines.

ProjectFlow fit:

- Existing `accounting` module should become central for startup projects.
- Finance milestones for budget baseline, bank account, bookkeeping, tax registration, and runway review.
- Tasks for invoices, subscriptions, payroll, tax advisor handoffs, investor deck, and reporting.
- Health signal: runway unknown, no budget, no bookkeeping owner, missing tax/accounting setup.

### 7. Product, Service, Or Operational Delivery

Track what the company will actually sell or operate:

- MVP or first service package.
- Product requirements or service delivery SOPs.
- Supplier, vendor, or partner dependencies.
- Quality requirements.
- Support and fulfillment workflow.
- Internal tooling.
- Customer onboarding and offboarding.
- Launch readiness checklist.

ProjectFlow fit:

- Existing software template can still be used as a child track if the startup sells software.
- Non-software ventures should use tasks, milestones, SOP resources, operations checklists, and vendor dependencies.
- Health signal: company launch planned without offer delivery workflow.

### 8. Brand, Marketing, Sales, And Launch

Track how the company reaches customers:

- Name, brand, positioning, messaging.
- Domain, email, social handles.
- Landing page or website.
- Waitlist or CRM.
- Launch audience.
- Sales pipeline.
- Content calendar.
- Campaigns.
- Partnerships.
- Press/community channels.
- Launch date and launch criteria.

ProjectFlow fit:

- Existing `marketing` and `social` modules should be default-enabled or suggested.
- Milestones for brand ready, website ready, CRM ready, launch campaign ready, first customer.
- Tasks for domains, assets, website copy, campaigns, outreach, and launch day operations.
- Health signal: launch planned with no channel, no landing page, or no customer pipeline.

### 9. Hiring, Team, And Operating Rhythm

Track how the company will run after launch:

- Hiring plan.
- Contractors and agencies.
- Internal meeting cadence.
- Weekly founder review.
- Monthly finance review.
- KPI review.
- Decision log.
- Vendor management.
- Customer feedback loop.

ProjectFlow fit:

- Operating model cadence.
- Groups and roles.
- Recurring tasks or future scheduler support.
- Dashboard "founder review" command.
- Health signal: no review cadence, stale decisions, no owner for critical functions.

### 10. Post-Launch Operations

Track what happens after the company exists:

- First revenue.
- Customer support.
- Bookkeeping close.
- Tax and compliance calendar.
- Customer feedback and roadmap.
- Retention metrics.
- Growth experiments.
- Funding updates.
- Board/advisor updates.

ProjectFlow fit:

- Lifecycle transitions from `formation` to `operating` or `growth`.
- Recurring milestones and recurring task templates.
- Finance and marketing dashboards.
- Health signal: launch completed but no operating cadence or post-launch owner.

## Target Project Taxonomy

Do not keep overloading `projectType` with a tiny set of labels. The current union can be expanded, but the cleaner long-term model is:

```ts
type ProjectCategory =
    | 'general'
    | 'software'
    | 'creative'
    | 'client_delivery'
    | 'operations'
    | 'marketing'
    | 'finance'
    | 'startup_company'
    | 'personal';

type ProjectTemplateId =
    | 'blank'
    | 'software_release'
    | 'client_delivery'
    | 'startup_company_formation'
    | 'marketing_campaign'
    | 'internal_operations'
    | 'finance_setup';
```

Recommended migration:

1. Keep `projectType` for backward compatibility.
2. Add optional `projectCategory` and `templateId`.
3. Add optional company-project relationship fields so normal projects can be assigned to a startup/company project.
4. Map existing `standard` to `general`, `software` to `software`, and `creative` to `creative`.
5. Let `templateId` drive default modules, stage gates, health weights, seeded milestones, and wizard questions.
6. Eventually deprecate `projectType` in UI copy while keeping it readable for old records.

## Company Project Grouping And Linked Projects

Startup/company projects are broader than normal projects. They should be treated as a separate project class across navigation and overview surfaces.

A company project acts as an umbrella/portfolio project for the company-building effort. Normal projects can then be linked to it as concrete workstreams, for example:

- "MVP app build" linked to "Acme GmbH formation".
- "Brand and website launch" linked to "Acme GmbH formation".
- "Investor deck" linked to "Acme GmbH formation".
- "Accounting setup" linked to "Acme GmbH formation".
- "Customer validation sprint" linked to "Acme GmbH formation".

This keeps the company project focused on formation, business readiness, governance, launch gates, and operating health while still letting specialized work use normal ProjectFlow project behavior.

### Projects List Grouping

`ProjectsList.tsx` should stop presenting startup/company projects as just another project card in the same flat list.

Target grouping:

```text
Company / Startup Projects
  Acme GmbH formation
    Linked projects: MVP app build, Brand launch, Investor deck
  Second Venture
    Linked projects: none

Active Projects
  Standalone active projects not linked to a company project

Paused / Completed / Canceled / Backlog
  Preserve existing lifecycle grouping, but keep linked projects visibly associated with their company when possible.
```

Recommended behavior:

- Company projects get their own top-level section before ordinary active projects.
- Linked normal projects appear under their company project as compact child rows or grouped cards.
- Linked projects should still be searchable, openable, filterable, and lifecycle-aware as normal projects.
- A linked project should not disappear from lifecycle views; if it appears elsewhere, show a compact "Part of {company project}" label.
- Standalone normal projects remain in the normal project sections.
- Completed/canceled company projects keep their linked project history readable but should not pressure active dashboards unless a linked project is still active.

### Other Surfaces That Need Group Awareness

Company-project grouping should appear anywhere the user chooses, filters, or understands projects:

- Project switcher/sidebar: show company projects as a separate group and indent linked projects.
- Dashboard: allow company projects to surface as strategic containers, but route the next action to the linked project or task that actually needs work.
- Project overview: company projects should show a "Linked Projects" section with health, lifecycle, and next action summaries for each linked project.
- Normal project overview: show a compact "Part of {company project}" relationship with a direct navigation link.
- Create project wizard: allow linking a new normal project to an existing company project during creation.
- Project settings/edit modal: allow adding, changing, or removing the company-project relationship.
- Search and breadcrumbs: show the parent company context so similarly named projects remain understandable.
- Health and reporting: company project health should include linked-project signals without double-counting the same overdue work in global dashboards.

### Relationship Rules

Use assignment rather than strict nesting:

- A normal project can link to at most one company project initially.
- A company project can have many linked normal projects.
- Company projects should not be linked under another company project in the first version.
- A linked project keeps its own members, modules, permissions, lifecycle, tasks, issues, milestones, and health.
- Linking does not automatically grant access to the linked project. Permissions must remain project-specific unless explicitly changed.
- Removing a link should not delete either project.
- The company project should summarize linked projects, not own all their work records.

This avoids turning ProjectFlow into a brittle tree while still giving the user a clear company-level map.

## Startup Project Template

### Template Identity

```ts
templateId: 'startup_company_formation'
projectCategory: 'startup_company'
defaultOperatingMode: 'explore'
defaultCadence: 'weekly'
defaultDateConfidence: 'target'
```

### Default Modules

Enable by default:

- `tasks`
- `initiatives`
- `ideas`
- `milestones`
- `activity`
- `groups`
- `accounting`
- `marketing`

Suggest when relevant:

- `social` for public launch and brand-building.
- `issues` only when the venture has product/technical defect tracking.
- `sprints` only if the venture includes software/product delivery.

Do not make GitHub a startup template default. It should only appear if the startup has a software product track.

### Default Initiatives

Seed these initiatives as optional selectable groups:

- Venture definition and validation.
- Founder agreement and governance.
- Legal formation and registration.
- Tax, accounting, banking, and finance setup.
- Compliance and risk readiness.
- Offer, pricing, and business model.
- Product/service launch readiness.
- Brand, website, marketing, and sales pipeline.
- Funding and investor readiness.
- Post-launch operating cadence.

### Default Milestones

Seed these milestones:

- Problem and target customer validated.
- Founding team and decision ownership confirmed.
- Legal structure selected.
- Formation documents ready.
- Company registered or formation completed.
- Tax/accounting setup ready.
- Bank/payment setup ready.
- Compliance launch gate approved.
- First offer ready.
- Brand and website ready.
- Sales/marketing launch ready.
- First customer or first revenue.
- First monthly finance and operations review completed.

### Default Flows

Seed Flow prompts or templates:

- Problem discovery.
- Customer interview synthesis.
- Competitor and alternatives map.
- Business model options.
- Legal structure decision log.
- Founder equity and role decision log.
- Pricing hypothesis.
- Launch positioning.
- Risk and compliance assumptions.
- Funding path decision.

### Default Risk Register Items

Seed as draft risks, not warnings:

- Legal form or jurisdiction decision not finalized.
- Founder agreement or ownership terms unresolved.
- Tax/accounting setup incomplete.
- Regulatory or permit requirements unknown.
- Runway or startup budget unknown.
- Customer demand not validated.
- Launch depends on external vendor/advisor.
- Sensitive founder, finance, or legal docs need restricted access.

## Startup-Specific Project Brief

The generic Project Brief should stay. Add optional startup extension fields.

```ts
interface StartupProfile {
    ventureName?: string;
    workingName?: string;
    jurisdictionCountry?: string;
    jurisdictionRegion?: string;
    plannedLegalStructure?: string;
    formationStatus?: 'idea' | 'validating' | 'preparing' | 'filed' | 'registered' | 'operating';
    businessModel?: 'saas' | 'service' | 'marketplace' | 'commerce' | 'content' | 'hardware' | 'agency' | 'other';
    fundingRoute?: 'bootstrapped' | 'grant' | 'loan' | 'angel' | 'vc' | 'crowdfunding' | 'revenue_funded' | 'undecided';
    regulatedIndustry?: boolean;
    hasEmployeesPlanned?: boolean;
    hasCoFounders?: boolean;
    targetLaunchDate?: string;
}

interface StartupReadiness {
    legalStructureDecided?: boolean;
    founderAgreementReady?: boolean;
    ipAssignmentReady?: boolean;
    registrationSubmitted?: boolean;
    registrationConfirmed?: boolean;
    taxSetupReady?: boolean;
    bankAccountReady?: boolean;
    bookkeepingReady?: boolean;
    privacyDocsReady?: boolean;
    requiredPermitsKnown?: boolean;
    launchOfferReady?: boolean;
    firstChannelReady?: boolean;
}
```

Keep sensitive details out of broad project fields where possible. Detailed finance/legal docs should live in restricted resources or module records with permission checks.

## Create Project Wizard Changes

### Step 1: Project Type

Replace the current "standard/software/creative" framing with template cards:

- General project.
- Software release.
- Client delivery.
- Startup/company founding.
- Marketing campaign.
- Internal operations.
- Personal focus project.

For `startup_company_formation`, the card should communicate:

- Manages formation, validation, legal/tax readiness, finance, launch, and operations.
- Enables tasks, initiatives, milestones, Flows, accounting, marketing, activity, and groups.
- Keeps legal/tax steps configurable by jurisdiction.

### Step 2: Founding Brief

Ask only enough to create a useful starting point:

- Venture name or working name.
- One-sentence objective.
- Target customer.
- Business model or "not sure yet".
- Current stage.
- Target launch date and confidence.
- Founder/decision owner.
- Jurisdiction country/region.
- Known regulated-industry risk: yes/no/unknown.
- Funding route: bootstrapped/fundraising/grant/loan/undecided.

### Step 3: Template Scope

Let the user choose which tracks to seed:

- Validation.
- Legal formation.
- Finance/accounting.
- Compliance.
- Product/service delivery.
- Marketing/sales.
- Funding.
- Post-launch operations.

This prevents a solo founder from receiving 120 tasks they do not want.

### Step 4: Team And Advisors

Reuse existing member/group selection and add suggested roles:

- Founder.
- Co-founder.
- Advisor.
- Lawyer.
- Tax advisor/accountant.
- Contractor.
- Investor observer.
- Viewer.

External collaborators should be project-scoped by default. A lawyer or accountant should not become a full workspace member unless explicitly invited as one.

### Step 5: Review And Seed

Before creation, show:

- Selected tracks.
- Default modules.
- Seeded milestones count.
- Seeded tasks count.
- Sensitive fields reminder.
- "You can remove or edit everything after creation."

## Project Overview Changes

The existing command-first Project Overview should get a startup variant. The first viewport should answer:

1. What founding stage are we in?
2. What blocks legal, financial, or launch readiness?
3. What is the next founder action?
4. Is the company safe to launch or operate?

Recommended layout:

```text
Compact Header
Startup Command Strip
  Stage | Formation Readiness | Runway/Budget | Launch Gate | Next Founder Action

Attention Queue
  Legal/tax blockers
  Open founder decisions
  High-risk compliance items
  Launch-critical tasks

Execution
  Founding initiatives
  Milestones
  Tasks
  Flows / decisions

Business Context
  Project Brief
  Startup Profile
  Risk Register
  Finance snapshot
  Go-to-market snapshot

Reference
  Legal docs/resources
  Team/advisors
  Activity
  Marketing/accounting links
```

Do not put a large educational explanation in the UI. Users should experience the startup project as an operational cockpit.

## Health Scoring Changes

Add startup-aware health factors in `web/services/healthService.ts`.

### Positive Factors

- Founding brief ready.
- Decision owner set.
- Legal structure decision recorded.
- Formation stage has current milestone.
- Accounting/banking setup tracked.
- Risk register reviewed recently.
- Launch gate has clear owner.
- Success criteria linked to initiatives or milestones.
- Validation evidence exists.
- Post-launch cadence exists after launch.

### Negative Or Neutral Factors

- Startup project has no jurisdiction.
- Legal structure undecided close to registration target.
- Regulated-industry status unknown.
- No founder agreement/IP assignment tracking when co-founders exist.
- No budget/runway estimate.
- No accounting or tax setup track.
- Launch milestone exists but no compliance/privacy/legal readiness tasks.
- No customer validation evidence.
- No go-to-market channel before launch.
- Stale founder review cadence.
- Sensitive advisor work assigned without role/permission review.

### Health Labels

For startup projects, generic labels like "At Risk" are not enough. Add contextual reason strings:

- "Formation incomplete."
- "Launch gate blocked."
- "Compliance unknown."
- "Finance setup missing."
- "Validation evidence stale."
- "Founder decision needed."
- "Operating cadence missing."

## Data Model Plan

### Minimal Web Types

```ts
export type ProjectCategory =
    | 'general'
    | 'software'
    | 'creative'
    | 'client_delivery'
    | 'operations'
    | 'marketing'
    | 'finance'
    | 'startup_company'
    | 'personal';

export type ProjectTemplateId =
    | 'blank'
    | 'software_release'
    | 'client_delivery'
    | 'startup_company_formation'
    | 'marketing_campaign'
    | 'internal_operations'
    | 'finance_setup';

export interface Project {
    projectCategory?: ProjectCategory;
    templateId?: ProjectTemplateId;
    companyProjectId?: string;
    companyProjectRole?: 'product' | 'marketing' | 'finance' | 'legal' | 'operations' | 'funding' | 'research' | 'other';
    startupProfile?: StartupProfile;
    startupReadiness?: StartupReadiness;
}
```

`companyProjectId` should be the source of truth for the relationship on linked normal projects. The company project can show derived linked-project lists from tenant projects where `companyProjectId === companyProject.id`.

Avoid storing duplicated `linkedProjectIds` on the company project unless performance requires a cached summary. If a cache is added later, it must be treated as derived and repairable.

### Template Registry

Add a frontend template registry first:

- `web/config/projectTemplates.ts`
- Template label and description keys.
- Default modules.
- Default operating mode/cadence/date confidence.
- Suggested tracks.
- Seed milestone/task/Flow definitions.
- Health factor profile.

Later, move tenant-customizable templates to Firestore:

```text
/tenants/{tenantId}/project_templates/{templateId}
```

### Seeded Work Records

Seeded records should be normal ProjectFlow records with metadata:

```ts
source: 'template'
templateId: 'startup_company_formation'
templateTrack: 'legal_formation'
```

This makes seeded work editable, removable, and filterable without special-case UI.

### Company Relationship Querying

Linked-project surfaces need a tenant-scoped query for:

```text
/tenants/{tenantId}/projects where companyProjectId == {companyProjectId}
```

If Firestore index requirements appear, add them explicitly to `firestore.indexes.json`. Do not rely on collection-group lookup for the first implementation unless cross-tenant reporting is intentionally added.

## Permissions And Privacy

Startup projects can contain more sensitive information than a normal software task board.

Required permission rules:

- Founder/owner can manage startup profile, legal, finance, and advisor access.
- External advisors default to project-only access.
- Sensitive finance/legal resources should support restricted visibility.
- Accounting module access should remain separately permissioned.
- Tasks can mention legal/tax work, but document contents should stay in resources with access control.
- Activity logs should avoid exposing secret document contents.

This may require either:

- Resource-level visibility metadata, or
- A dedicated restricted project resource subcollection.

## AI And Automation

AI should help structure founder work, but should not pretend to be a lawyer, accountant, or investment advisor.

Recommended AI features:

- Draft a startup project brief from one paragraph.
- Suggest tracks based on country, business model, regulated status, co-founder status, and launch target.
- Generate customer interview tasks and validation Flows.
- Turn official checklist links into project tasks only with source attribution.
- Summarize open founder decisions.
- Detect missing launch gates.
- Draft investor/customer messaging.
- Ask for confirmation before seeding legal/tax/compliance tasks.

Guardrails:

- Always label jurisdiction templates as checklists, not legal conclusions.
- Require user confirmation before marking legal/tax/compliance items "done".
- Encourage advisor review on legal form, permits, taxes, employment, privacy, regulated industries, and fundraising documents.
- Store source links and "last reviewed" dates for jurisdiction templates.

## Implementation Phases

### Phase 0: Product Documentation

Outcome: the startup expansion is described clearly before code changes.

Tasks:

- Add this plan.
- Link it from `brain/reference/app/APP_DOCS_INDEX.md`.
- Once approved, update `brain/reference/app/APP_CONCEPT.md` to broaden the product audience beyond software/digital delivery.
- Create ProjectFlow initiative when API permissions allow it; current initiative checkpoint returned `HTTP 403`, so task `LiWcc33tYMWtTuiWh2iR` tracks this planning pass.

Acceptance:

- Future work has a durable plan and file references.
- The scope is clear enough to implement without re-litigating the product direction.

### Phase 1: Project Taxonomy And Template Registry

Outcome: ProjectFlow can represent a startup project without changing every screen.

Tasks:

- Add `ProjectCategory`, `ProjectTemplateId`, `StartupProfile`, and `StartupReadiness` to `web/types.ts`.
- Add `web/config/projectTemplates.ts`.
- Add startup/company template i18n keys to `web/locales/en.ts` and `web/locales/de.ts`.
- Update create wizard type cards to use templates.
- Preserve existing records with compatibility mapping.
- Update `brain/reference/app/FIRESTORE_STRUCTURE.md`.

Acceptance:

- Existing projects still render.
- New startup template appears in create flow.
- The selected template persists on the project.

### Phase 2: Startup Create Flow

Outcome: a founder can create a useful company-founding project in under two minutes.

Tasks:

- Add startup-specific wizard fields only when the template is selected.
- Add track selection.
- Seed default modules.
- Generate selected milestones, initiatives, and tasks after creation.
- Keep AI blueprint generation compatible with startup template selection.
- Add tests around template defaults and payload creation if a nearby test pattern exists.

Acceptance:

- Creating a startup project saves startup profile fields.
- Selected tracks seed normal editable ProjectFlow records.
- GitHub setup is not shown as mandatory for startup projects.

### Phase 3: Company Project Grouping And Linking

Outcome: company projects are visibly separated from normal projects, and normal projects can be assigned to a company project.

Tasks:

- Add `companyProjectId` and `companyProjectRole` to the project model and create/update allowlists.
- Update `ProjectsList.tsx` to render a dedicated company/startup projects section.
- Render linked normal projects under their company project while keeping standalone projects in the normal sections.
- Add "Part of {company project}" labels to linked project cards and normal project overview.
- Add a linked-project summary section to company project overview.
- Add link/unlink controls to create project and project settings.
- Ensure linked projects keep independent lifecycle, permissions, health, and modules.
- Add i18n for grouping labels, relationship labels, and empty states.

Acceptance:

- A startup/company project appears in a separate project-list group.
- A normal project can be linked to a company project and later unlinked.
- Linked projects remain normal projects but show their company context.
- Company project overview summarizes linked project health and next actions.

### Phase 4: Startup Project Overview Variant

Outcome: the project overview becomes a founder command center.

Tasks:

- Extend `ProjectOverview.tsx` or its extracted helpers to detect `startup_company`.
- Add startup command strip cells.
- Add founding attention queue prioritization.
- Show stage, formation readiness, launch gate, finance setup, and next founder action.
- Keep layout consistent with the existing command-first overview plan.
- Add localized strings and SCSS token-based styling.

Acceptance:

- First viewport shows startup-specific readiness, not generic software status.
- Empty startup sections collapse into compact setup rows.

### Phase 5: Startup Health Model

Outcome: project health reflects founder risks.

Tasks:

- Add startup health factors to `web/services/healthService.ts`.
- Add company-project rollup factors that summarize linked-project blockers without double-counting them as separate company tasks.
- Use startup profile, readiness fields, modules, milestones, risks, and cadence.
- Add localized factor and recommendation strings.
- Ensure paused/canceled/completed lifecycle rules still suppress inappropriate pressure.
- Add sample calculations for idea, pre-formation, launch, and post-launch states.

Acceptance:

- A startup with no jurisdiction, finance setup, or validation evidence receives specific setup gaps.
- A post-launch startup with no operating cadence receives an operating gap, not a formation gap.
- A company project with blocked linked projects shows a rollup recommendation that points to the linked project.

### Phase 6: Startup Documents And Sensitive Resources

Outcome: founders can store and reference formation artifacts without leaking them broadly.

Tasks:

- Audit current project resource visibility.
- Add restricted legal/finance resource handling if missing.
- Add resource categories for legal, tax, finance, brand, sales, compliance, and operating docs.
- Update permissions docs.
- Update activity logging to avoid sensitive content leaks.

Acceptance:

- Legal/tax/advisor records can be referenced safely.
- External collaborators only see what they are permitted to see.

### Phase 7: Finance, Marketing, And Operating Cadence Integration

Outcome: startup projects use existing modules as real operating functions.

Tasks:

- Add startup-specific accounting setup checklist.
- Add budget/runway summary if finance data is available.
- Add marketing launch checklist and channel readiness.
- Add recurring founder review tasks or scheduler support.
- Add post-launch monthly close and KPI review templates.

Acceptance:

- Startup finance and marketing are not separate to-do lists; they feed overview and health.

### Phase 8: Jurisdiction Template Library

Outcome: ProjectFlow can offer useful default checklists by region without pretending to be a legal authority.

Tasks:

- Add a source-backed template format:

```ts
interface JurisdictionTemplate {
    id: string;
    countryCode: string;
    regionCode?: string;
    sourceUrls: string[];
    lastReviewedAt: string;
    tracks: TemplateTrack[];
    disclaimerKey: string;
}
```

- Start with generic international, US, and Germany/EU-oriented templates.
- Store source links and review dates.
- Let users duplicate/customize templates inside a tenant.
- Add maintenance task for source review cadence.

Acceptance:

- The app can seed region-aware checklists.
- The UI never claims that completing ProjectFlow tasks guarantees legal compliance.

## Concrete File Touchpoints

Likely implementation files:

- `web/types.ts` - project category, template, startup profile, readiness fields.
- `web/screens/CreateProjectWizard.tsx` - template selection, startup brief, seeded tracks.
- `web/config/projectTemplates.ts` - template registry.
- `web/services/healthService.ts` - startup health factors and recommendations.
- `web/screens/ProjectsList.tsx` - separate company/startup grouping and linked-project rendering.
- `web/screens/ProjectOverview.tsx` - startup command strip and attention queue.
- `web/components/project/ProjectEditModal.tsx` - company-project link/unlink controls in project settings.
- `web/locales/en.ts` and `web/locales/de.ts` - all visible strings.
- `web/services/domain/projectAdminService.ts` - allow startup fields through create/update.
- `functions/src/projectflow-api.ts` - allow startup fields through API field allowlist if API create/update supports project payloads.
- `firestore.indexes.json` - add a `companyProjectId` query index if Firestore requires it.
- `brain/reference/app/FIRESTORE_STRUCTURE.md` - data model docs.
- `brain/reference/app/APP_CONCEPT.md` - product positioning update after approval.
- `brain/reference/app/SITEMAP.md`, `brain/reference/app/COMPONENTS.md`, `brain/reference/app/STYLING.md` - update only when routes/components/styles change.
- `brain/reference/app/PERMISSIONS.md` - update when restricted resources/advisor permissions are implemented.

## UX Details

### Startup Template Card

Should be direct and operational:

- Title: "Company / Startup"
- Subtitle: "Formation, validation, finance, launch, and operations"
- Default modules shown as chips.
- No hero-style marketing copy.

### Startup Command Strip Cells

Use compact cells:

- Stage: `Idea`, `Validation`, `Formation`, `Pre-launch`, `Launch`, `Operating`.
- Formation readiness: percentage or checklist count.
- Finance: budget/runway known or missing.
- Launch gate: blocked/partial/ready.
- Next action: one founder action from attention queue.

### Attention Ranking

Rank startup attention queue by:

1. Legal/compliance blockers that affect launch or operation.
2. Founder/open decision blockers.
3. Finance/runway/tax/banking blockers.
4. Launch-critical marketing/sales/product tasks.
5. Stale validation or customer evidence.
6. Normal overdue tasks.

This differs from software projects, where urgent tasks/issues may dominate.

## Validation Plan

### Static Checks

- `cd web && npm run build` after implementation.
- `cd web && npm run lint:theme` after styling changes.
- TypeScript should catch template and project payload drift.

### Manual QA

Create test projects:

1. Startup idea with no jurisdiction and no finance setup.
2. Startup with co-founders, formation prep, and legal tasks.
3. Bootstrapped service business with no software module.
4. SaaS startup with GitHub/software track enabled.
5. Completed or canceled startup project.
6. Normal project linked to a startup/company project.
7. Normal project unlinked from a startup/company project.

Verify:

- Existing software projects still work.
- Startup projects appear in a separate project-list group and in overview.
- Linked normal projects show company context without losing normal project behavior.
- Seeded tasks are editable normal tasks.
- Health recommendations match startup stage.
- Company project health can point to linked-project blockers without double-counting them.
- External advisor permissions do not expose unrelated workspace data.
- German and English locale strings render without raw keys.

## Risks And Tradeoffs

- Too many seeded tasks can overwhelm founders. Mitigation: selectable tracks and compact setup rows.
- Legal/tax checklists can become stale. Mitigation: source URLs, last-reviewed dates, and disclaimers.
- Sensitive documents can leak through generic resources. Mitigation: restricted resource permissions before encouraging legal/finance uploads.
- `projectType` expansion can cause type drift. Mitigation: introduce `projectCategory` and `templateId` while preserving old `projectType`.
- Linked-project duplication can make normal projects appear lost or counted twice. Mitigation: keep `companyProjectId` as assignment metadata, preserve lifecycle sections, and show "Part of" labels wherever linked projects appear.
- Existing Accounting and Marketing modules may assume software/digital context. Mitigation: startup template should reuse modules but not depend on software-specific flows.
- AI-generated legal/compliance tasks can overstate certainty. Mitigation: source attribution, confirmation steps, and advisor-review language.

## Open Product Questions

- Should startup/company projects be available on Starter, or only Professional because they often need advisors and multiple modules?
- Should legal/finance resources require a new permission model before the template ships?
- Should `accounting` become a default module for startup projects even if the tenant has not configured finance settings?
- Should ProjectFlow include a built-in "official source review" maintenance task for jurisdiction templates?
- Should startup projects support child projects, for example "Company founding" as parent and "MVP build" as a software child project?
- Should a normal project be allowed to link to multiple company projects later, or is one company context enough for the first version?
- Should linked projects inherit company-level reporting cadence as a default, or should they keep a fully independent cadence?
- Should founder equity/cap table details be tracked in ProjectFlow at all, or only linked as restricted external resources?

## Recommended First Implementation Slice

Do not start with jurisdiction automation. Start with a product-safe, high-signal slice:

1. Add project taxonomy and `startup_company_formation` template.
2. Add startup-specific create wizard fields and selectable tracks.
3. Add `companyProjectId` linking so normal projects can be assigned to a company project.
4. Separate company/startup projects in `ProjectsList.tsx` and show linked projects under them.
5. Seed milestones/initiatives/tasks from generic startup tracks.
6. Add startup overview command strip, including linked-project summaries.
7. Add startup health setup gaps and linked-project rollup factors.
8. Update docs and i18n.

This gives ProjectFlow a real startup founding workflow without creating legal-risk-heavy country-specific automation too early.

## Implementation Tracking

- Completed first foundation slice in ProjectFlow task `EKUXkKCMlRlKxySGTeq8`: taxonomy fields, startup/company template, company-project grouping, normal-project linking, overview context, API allowlist, docs, and locales.
- Completed second workflow slice in ProjectFlow task `IuT5nkx8uP9HZCshPAEp`: startup brief fields, selectable tracks, sensitive-track confirmation, seeded milestones/initiatives/tasks, startup overview cockpit, editable readiness settings, startup-aware health factors, docs, and locales.
- Completed full-plan follow-up in ProjectFlow task `EpGbJtroS0WsNYNpM12G`: Germany/US/global jurisdiction templates with official source metadata, source-backed jurisdiction seed tasks, restricted/advisor-reviewed sidebar resource metadata with role filtering, company context in switcher/search/breadcrumbs, finance/marketing/readiness actions, linked-project rollups without duplicating company-owned tasks, API/type/doc/i18n updates, and validation.

## Official Reference Inputs

These sources should guide generic checklist categories and jurisdiction template design, but they should not be copied verbatim into legal advice:

- U.S. Small Business Administration launch guide: https://www.sba.gov/business-guide/launch-your-business
- U.S. Small Business Administration business registration guide: https://www.sba.gov/business-guide/launch-your-business/register-your-business
- U.S. Small Business Administration federal/state tax ID guide: https://www.sba.gov/business-guide/launch-your-business/get-federal-state-tax-id-numbers
- IRS starting-a-business resource: https://www.irs.gov/businesses/small-businesses-self-employed/starting-a-business
- Germany federal startup portal / Existenzgruendungsportal legal forms: https://www.existenzgruendungsportal.de/Navigation/DE/Gruendungswissen/Rechtsformen/rechtsformen
- BMWK GruenderZeiten registration and law PDF: https://www.existenzgruendungsportal.de/Redaktion/DE/Downloads/DE/GruenderZeiten/GruenderZeiten-24.pdf
- IHK Region Stuttgart formation formalities: https://www.ihk.de/stuttgart/gruendung/orientierungsphase/anmeldung-eines-unternehmens/formerfordernisse-einer-gruendung-685190
- IHK Darmstadt business and tax registration: https://www.ihk.de/darmstadt/produktmarken/gruendung/existenzgruendung-und-steuern/aufnahme-einer-gewerblichen-taetigkeit-2538356
