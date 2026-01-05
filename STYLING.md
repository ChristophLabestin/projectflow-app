# STYLING.md — ProjectFlow Design System (SCSS Tokens)

This document defines the **design tokens** that must be used throughout the application to ensure a consistent, professional, monochrome UI.

**Source of truth:** `styles/_tokens.scss`  
All UI components and pages must reference these tokens instead of hardcoding values.

---

## 1) Colors

### 1.1 Core Palette (Monochrome)

| Token | Value | Description |
|------|-------|-------------|
| `--color-primary` | `#171717` | Primary brand color used for primary actions and key UI elements |
| `--color-primary-dark` | `#000000` | Darker primary shade for hover/active states |
| `--color-primary-light` | `#404040` | Lighter primary shade for subtle emphasis |
| `--color-primary-fade` | `#f5f5f5` | Soft faded background used for subtle panels or highlight areas |
| `--color-primary-hover` | `#000000` | Hover color for primary surfaces (maps to primary dark by default) |
| `--color-primary-text` | `#ffffff` | Text color on primary surfaces (flips in dark mode) |
| `--color-absolute-black` | `#000000` | Theme-invariant black for fixed-contrast surfaces |
| `--color-absolute-white` | `#ffffff` | Theme-invariant white for fixed-contrast surfaces |

### 1.2 Surfaces

| Token | Value | Description |
|------|-------|-------------|
| `--color-surface-bg` | `#fafafa` | Main application background |
| `--color-surface-card` | `#ffffff` | Card, modal, and elevated surface background |
| `--color-surface-paper` | `#ffffff` | Paper surface for nested panels and inset areas |
| `--color-surface-hover` | `#f5f5f5` | Hover surface background for rows, list items, and interactive containers |
| `--color-surface-border` | `#e5e7eb` | Default border color for separators, outlines, and dividers |
| `--color-surface-border-hover` | `#d1d5db` | Hover border color for interactive containers |

### 1.3 Text

| Token | Value | Description |
|------|-------|-------------|
| `--color-text-main` | `#171717` | Primary text color for headlines and body text |
| `--color-text-muted` | `#737373` | Secondary text for supporting information and metadata |
| `--color-text-subtle` | `#a3a3a3` | Subtle text for placeholders, hints, and low-emphasis UI |
| `--color-text-ondark` | `#ffffff` | Text color on dark backgrounds (e.g., primary buttons) |

### 1.4 Status Colors

Use status colors for feedback states only (alerts, badges, validation states). Do not use them as general accents.

| Token | Value | Description |
|------|-------|-------------|
| `--color-success` | `#10b981` | Success state |
| `--color-warning` | `#f59e0b` | Warning state |
| `--color-error` | `#ef4444` | Error state |

### 1.5 Blue Palette (Pre-Beta / Limited Use)

These colors are reserved for specific pre-beta settings. Do not introduce them broadly without a clear reason.

| Token | Value |
|------|-------|
| `--color-blue-100` | `#dbeafe` |
| `--color-blue-500` | `#3b82f6` |
| `--color-blue-600` | `#2563eb` |
| `--color-blue-900` | `#1e3a8a` |

### 1.6 Legacy Alias Tokens (Migration)

These aliases exist for legacy styles during the Tailwind → SCSS migration. Prefer the canonical tokens above for new UI work.

| Token | Alias Of |
|------|----------|
| `--color-text` | `--color-text-main` |
| `--color-text-secondary` | `--color-text-muted` |
| `--color-text-paragraph` | `--color-text-muted` |
| `--color-background` | `--color-surface-bg` |
| `--color-bg-base` | `--color-surface-bg` |
| `--color-border` | `--color-surface-border` |
| `--color-accent` | `--color-primary` |
| `--color-primary-active` | `--color-primary-dark` |
| `--color-primary-rgb` | RGB values of `--color-primary` |
| `--color-surface-active` | `--color-surface-hover` |
| `--color-surface-bg-offset` | `--color-surface-hover` |
| `--color-surface-highlight` | `--color-surface-hover` |
| `--color-surface-input` | `--color-surface-bg` |
| `--color-surface-order` | `--color-surface-border` |
| `--color-surface-pressed` | `--color-surface-hover` |
| `--color-surface-sunken` | `--color-surface-bg` |

---

## 2) Border Radius

Border radius tokens define the rounding used across components. Use them consistently (cards, buttons, inputs, modals).

| Token | Value | Intended Use |
|------|-------|--------------|
| `--radius-sm` | `6px` | Small rounding for compact UI elements |
| `--radius-md` | `10px` | Default rounding for inputs and small containers |
| `--radius-lg` | `16px` | Cards and larger containers |
| `--radius-xl` | `24px` | Large feature panels and prominent surfaces |
| `--radius-2xl` | `32px` | Hero cards and oversized panels |
| `--radius-3xl` | `40px` | Extra-large containers and modals |
| `--radius-full` | `999px` | Pills, circular buttons, avatars |

---

## 3) Shadows

Shadows define elevation and depth. Use them sparingly to keep the monochrome design clean.

| Token | Value |
|------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` |
| `--shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1), ...` |
| `--shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.08), ...` |
| `--shadow-soft` | `0 20px 40px rgba(0, 0, 0, 0.04)` |
| `--shadow-inner` | `inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)` |

**Guideline:**
- Use `--shadow-sm` for subtle elevation (small cards, compact menus).
- Use `--shadow-md` for standard elevated surfaces (cards, dropdowns).
- Use `--shadow-lg` or `--shadow-soft` only for prominent overlays (modals, drawers).
- Use `--shadow-inner` for inset effects (pressed states, recessed panels).

---

## 4) Transitions

Transitions should feel responsive but not abrupt. Use the tokens below consistently for interactive elements.

| Token | Value |
|------|-------|
| `--transition-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--transition-normal` | `250ms cubic-bezier(0.4, 0, 0.2, 1)` |

**Guideline:**
- Use `--transition-fast` for hover/focus states.
- Use `--transition-normal` for component open/close animations (dropdowns, modals).

---

## 5) Layout Metrics

These tokens define key layout constants used across the app shell.

| Token | Value | Description |
|------|-------|-------------|
| `--app-sidebar-width` | `0px (Mobile) / 280px (Desktop)` | Width of the main navigation sidebar |
| `--help-center-width-collapsed` | `calc((100vw - sidebar) * 0.75)` | Default width of the help center drawer |
| `--help-center-width-expanded` | `calc(100vw - sidebar)` | Expanded width of the help center drawer |

**Guideline:**
- Mobile layout: sidebar is collapsed/hidden (`0px`).
- Desktop layout: sidebar uses `280px` width.

---

## 6) Interaction Guidelines (UX Patterns)

- **No Native Browser Dialogs:** never use `window.alert()`, `confirm()`, or `prompt()`.
  - These are blocking, non-styled, and break the immersive experience.
  - **Use Custom Modals:** Always use the `Modal` or `ConfirmDialog` components for critical feedback, confirmations, or input requests.
  - For non-critical feedback (success/info), use `Toast` notifications (once implemented).

---

## 7) Implementation Rules (Mandatory)

- Do not hardcode colors, radii, shadows, transitions, or layout constants when a token exists.
- New UI components must reference tokens from `styles/_tokens.scss`.
- If a new token is introduced, it must be documented here and added to `_tokens.scss`.
- **Borderless Design:** Avoid using borders for component separation. Use **depth (shadows)** and **background differentiation** (`surface-card` vs `surface-hover`) to distinguish elements.

---

## 7) Quick Usage Notes (SCSS)

- Tokens should be defined in `styles/_tokens.scss`.
- Components should consume tokens via CSS variables (recommended) or SCSS variables mapped to them.
- Keep styles reusable and consistent across the UI.
- Migration utilities live in `styles/_utilities.scss`; use them sparingly and prefer component SCSS + tokens for new work.

