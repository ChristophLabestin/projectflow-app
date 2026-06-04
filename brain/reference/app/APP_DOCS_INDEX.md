# AI_DOCS_INDEX.md — ProjectFlow Documentation Index (Authoritative)

This file is the entry point for all AI code assistants working on this repository.  
Before making architectural decisions or implementing features, read the documents listed below and follow them strictly.

---

## 1) Core AI Working Rules

### 1.1 Global instructions for AI assistants
- **File:** `brain/reference/app/AI_AGENT_INSTRUCTIONS.md`
- **Purpose:** Non-negotiable implementation rules (routing approach, SCSS usage, reusable components, documentation updates, etc.)
- **Must-do:** Follow these rules for every change. If a rule conflicts with another doc, escalate by documenting the conflict and choosing the safest interpretation.

---

## 2) Product Concept & Architecture

### 2.1 Product scope, tiers, data model, modules, flows
- **File:** `brain/reference/app/APP_CONCEPT.md`
- **Purpose:** Defines the product positioning, subscription tiers (Starter/Professional/Organization), module system, Flows concept, Firestore structure, and key constraints.
- **Must-do:** Ensure all features align with tier restrictions and module visibility rules.

### 2.2 Permissions and role system (Discord-style)
- **File:** `brain/reference/app/PERMISSIONS.md`
- **Purpose:** Defines the complete role hierarchy, system roles (Owner/Member/Guest), project role (Project Owner), role stacking, deny-overrides, and ownership transfer rules.
- **Must-do:** All feature actions must be guarded by permissions. Respect role hierarchy rules in UI and backend.

### 2.3 Retention and Codex integration planning
- **File:** `brain/plans/projectflow-retention-and-codex-integration-report.md`
- **Purpose:** Product analysis for improving daily ProjectFlow usage, notification reliability, mobile ambient surfaces, and Codex/project context integration.
- **File:** `brain/plans/projectflow-retention-implementation-plan.md`
- **Purpose:** Executable implementation plan derived from the retention report.
- **File:** `brain/operations/projectflow-codex-api.md`
- **Purpose:** Codex session API, Firestore model, and repo-local plugin usage.
- **File:** `brain/operations/projectflow-production-provisioning.md`
- **Purpose:** Production push provisioning checklist for web VAPID, iOS App Group, APNs, and signed-release verification.

### 2.4 Startup and company founding project planning
- **File:** `brain/plans/startup-company-project-expansion-plan.md`
- **Purpose:** Product and implementation plan for broadening ProjectFlow projects beyond software delivery into startup/company founding, including templates, startup lifecycle tracks, data model additions, overview/health behavior, permissions, AI guardrails, and phased delivery.

---

## 3) Routing & Navigation

### 3.1 Sitemap and page status tracking
- **File:** `brain/reference/app/SITEMAP.md`
- **Purpose:** Authoritative route list for all pages, including public/auth routes and project module routes.
- **Must-do:** When implementing or modifying routes/pages:
  - keep the router in `Router.tsx` per `brain/reference/app/AI_AGENT_INSTRUCTIONS.md`
  - update `brain/reference/app/SITEMAP.md` page status after completion

---

## 4) UI System & Styling

### 4.1 Design tokens and styling rules
- **File:** `brain/reference/app/STYLING.md`
- **Purpose:** Defines the design tokens (colors, radii, shadows, transitions, layout metrics) and styling rules.
- **Must-do:** Do not hardcode UI values when a token exists. Use SCSS and reusable classes.

### 4.2 Reusable UI components catalog
- **File:** `brain/reference/app/COMPONENTS.md`
- **Purpose:** Lists all reusable UI components (e.g., Button, Card, Input, Modal) and their intended usage.
- **Must-do:** When creating a new reusable component:
  - add it to `brain/reference/app/COMPONENTS.md`
  - ensure it uses tokens from `brain/reference/app/STYLING.md`

### 4.3 Project overview layout restructure
- **File:** `brain/plans/project-overview-layout-restructure-plan.md`
- **Purpose:** Implementation-ready plan for turning `/project/:id` into a command-first project overview with a compact header, command strip, attention queue, execution-first body, and demoted reference modules.
- **Must-do:** Use this plan before large Project Overview layout changes so lifecycle controls, health/work signals, Project Contract, and empty-state behavior remain intentionally ordered.

---

## 5) Internationalization

### 5.1 Language dictionaries
- **Files:** `web/locales/en.ts`, `web/locales/de.ts` (and future languages)
- **Purpose:** All user-facing text must come from translation dictionaries.
- **Must-do:** Do not hardcode UI strings. Add new keys responsibly and keep naming consistent.

---

## 6) Change Management Requirements

Whenever implementing new pages, features, or components:
1) Read the relevant docs above.
2) Implement with the repo conventions (routing, SCSS, components).
3) If new follow-up work is discovered, create a ProjectFlow task in the linked project and document it in the appropriate repo docs.
4) Update documentation:
   - `brain/reference/app/SITEMAP.md` for pages/routes
   - `brain/reference/app/COMPONENTS.md` for new reusable components
   - `brain/reference/app/STYLING.md` if tokens/rules change
   - `brain/reference/app/APP_CONCEPT.md` / `brain/reference/app/PERMISSIONS.md` if product rules change

---

## 7) Quick Links (Recommended Root Layout)

Recommended files at repository root:
- `AI_DOCS_INDEX.md` (this file)
- `brain/reference/app/AI_AGENT_INSTRUCTIONS.md`
- `brain/reference/app/APP_CONCEPT.md`
- `brain/reference/app/PERMISSIONS.md`
- `brain/reference/app/SITEMAP.md`
- `brain/reference/app/STYLING.md`
- `brain/reference/app/COMPONENTS.md`

These must remain easy to find and up to date.
