# AI Agent Instructions (Project Rules)

This document defines mandatory rules for any AI coding assistant working on this project.  
Follow these rules consistently. If any requested change conflicts with these rules, propose an alternative approach that still complies.

---

## 1) Routing (Mandatory)

- **Always implement routing inside `Router.tsx`.**
- Do **not** introduce external routing frameworks unless explicitly instructed (e.g., `react-router-dom`).
- Keep routing logic centralized and readable:
  - A single source of truth for route definitions
  - Clear mapping between routes and pages
  - Support for future route guards (e.g., auth-protected routes)

---

## 2) Styling System (SCSS Only)

- **Use SCSS for styling.**
- Create and use **reusable, generic CSS classes** whenever possible.
  - Avoid overly specific or page-specific class names unless the element is truly unique.
  - Prefer utility-like project classes (e.g., layout containers, spacing patterns, typography patterns) implemented in SCSS.
- Do not introduce Tailwind or other styling frameworks unless explicitly instructed.

---

## 3) Reusable UI Components (Consistency First)

- Always prefer building/using **reusable UI components** so the UI remains consistent across the app.
- Examples include (but are not limited to):
  - `Button`
  - `Card`
  - `Input`
  - `Modal`
  - `Badge`
  - `Dropdown`
- Do not duplicate UI patterns inside pages. If a UI pattern repeats, refactor it into a reusable component.

---

## 4) Styling Rules Source of Truth

- There must be a dedicated Markdown file that defines the styling rules (colors, spacing, typography, component variants, etc.).
- **Always follow the styling rules described in that styling Markdown file.**
- If a new styling rule or design decision is introduced, update the styling Markdown file accordingly to keep it authoritative.

---

## 5) Internationalization (i18n) Built-In

- The app must be built so it can support multiple languages.
- Use language dictionaries such as:
  - `en.ts`
  - `de.ts`
- The implementation must allow switching languages without rewriting UI code.
- Do not hardcode user-facing strings in components/pages:
  - All visible text should come from the language files.

---

## 6) Components Registry (Documentation Required)

- Maintain a Markdown file that documents all available reusable components.
- **Whenever you create a new reusable component, you must update the components Markdown file** with:
  - Component name
  - Purpose / usage
  - Props (high-level)
  - Variants (if any)
  - Example usage snippet (short)

This ensures future AI assistants and developers know what components exist and how to use them.

---

## 7) Sitemap Compliance (Progress Tracking)

- Maintain a Sitemap Markdown file listing all pages/routes in the application.
- **You must follow the sitemap** when adding or modifying pages.
- When you complete a page (or a significant section of it), update the sitemap file to reflect progress, e.g.:
  - Mark the page as completed
  - Add notes about what was implemented
  - Add TODOs if something remains unfinished

---

## Required Project Docs (Minimum Set)

The project must include at least these documentation files:

1. **Styling Rules डॉक**: `STYLING.md`  
2. **Components Registry**: `COMPONENTS.md`  
3. **Sitemap / Pages List**: `SITEMAP.md`  
4. **This file**: `AI_AGENT_INSTRUCTIONS.md`

All AI-driven changes should keep these documents up to date.

---

## General Behavior Expectations

- Prefer maintainable, consistent solutions over quick hacks.
- If you are unsure, search the existing codebase for established patterns and follow them.
- Every change should keep the UI consistent with the reusable component system and styling rules.
- **Never use browser native alerts** (`window.alert`, `window.confirm`, `window.prompt`).
  - Always use the custom `Modal` or `ConfirmDialog` components for user interaction and feedback.
  - Native alerts disrupt the user experience and break the branding.
