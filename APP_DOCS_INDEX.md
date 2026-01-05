# AI_DOCS_INDEX.md — ProjectFlow Documentation Index (Authoritative)

This file is the entry point for all AI code assistants working on this repository.  
Before making architectural decisions or implementing features, read the documents listed below and follow them strictly.

---

## 1) Core AI Working Rules

### 1.1 Global instructions for AI assistants
- **File:** `AI_AGENT_INSTRUCTIONS.md`
- **Purpose:** Non-negotiable implementation rules (routing approach, SCSS usage, reusable components, documentation updates, etc.)
- **Must-do:** Follow these rules for every change. If a rule conflicts with another doc, escalate by documenting the conflict and choosing the safest interpretation.

---

## 2) Product Concept & Architecture

### 2.1 Product scope, tiers, data model, modules, flows
- **File:** `APP_CONCEPT.md`
- **Purpose:** Defines the product positioning, subscription tiers (Starter/Professional/Organization), module system, Flows concept, Firestore structure, and key constraints.
- **Must-do:** Ensure all features align with tier restrictions and module visibility rules.

### 2.2 Permissions and role system (Discord-style)
- **File:** `PERMISSIONS.md`
- **Purpose:** Defines the complete role hierarchy, system roles (Owner/Member/Guest), project role (Project Owner), role stacking, deny-overrides, and ownership transfer rules.
- **Must-do:** All feature actions must be guarded by permissions. Respect role hierarchy rules in UI and backend.

---

## 3) Routing & Navigation

### 3.1 Sitemap and page status tracking
- **File:** `SITEMAP.md`
- **Purpose:** Authoritative route list for all pages, including public/auth routes and project module routes.
- **Must-do:** When implementing or modifying routes/pages:
  - keep the router in `Router.tsx` per `AI_AGENT_INSTRUCTIONS.md`
  - update `SITEMAP.md` page status after completion

---

## 4) UI System & Styling

### 4.1 Design tokens and styling rules
- **File:** `STYLING.md`
- **Purpose:** Defines the design tokens (colors, radii, shadows, transitions, layout metrics) and styling rules.
- **Must-do:** Do not hardcode UI values when a token exists. Use SCSS and reusable classes.

### 4.2 Reusable UI components catalog
- **File:** `COMPONENTS.md`
- **Purpose:** Lists all reusable UI components (e.g., Button, Card, Input, Modal) and their intended usage.
- **Must-do:** When creating a new reusable component:
  - add it to `COMPONENTS.md`
  - ensure it uses tokens from `STYLING.md`

---

## 5) Internationalization

### 5.1 Language dictionaries
- **Files:** `src/i18n/en.ts`, `src/i18n/de.ts` (and future languages)
- **Purpose:** All user-facing text must come from translation dictionaries.
- **Must-do:** Do not hardcode UI strings. Add new keys responsibly and keep naming consistent.

---

## 6) Change Management Requirements

Whenever implementing new pages, features, or components:
1) Read the relevant docs above.
2) Implement with the repo conventions (routing, SCSS, components).
3) Update documentation:
   - `SITEMAP.md` for pages/routes
   - `COMPONENTS.md` for new reusable components
   - `STYLING.md` if tokens/rules change
   - `APP_CONCEPT.md` / `PERMISSIONS.md` if product rules change

---

## 7) Quick Links (Recommended Root Layout)

Recommended files at repository root:
- `AI_DOCS_INDEX.md` (this file)
- `AI_AGENT_INSTRUCTIONS.md`
- `APP_CONCEPT.md`
- `PERMISSIONS.md`
- `SITEMAP.md`
- `STYLING.md`
- `COMPONENTS.md`

These must remain easy to find and up to date.

