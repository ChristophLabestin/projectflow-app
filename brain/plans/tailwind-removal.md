# Tailwind → SCSS Removal (SCSS-only migration)

Status: **in progress** (started 2026-06-13). Decision: remove Tailwind entirely,
move all styling to BEM-style SCSS partials using design tokens. The brain rule
already mandates "SCSS only, no Tailwind"; this migration makes the code match it.

## Why this is staged, not a bulk rewrite

- ~165 `.tsx` files under `screens/` + `components/` use Tailwind utilities,
  the densest (`social/`, `marketing/`, `help/`, `SettingsModal`, `Team`,
  `Profile`) carrying 100–330 utility usages each.
- Authenticated screens can't be visually QA'd in the local/preview shell
  (routes redirect to `/login`). Dense screens MUST get authenticated visual QA
  after conversion.
- Tailwind stays active during migration so unconverted files keep rendering.
  Only after ALL files are migrated do we remove `@tailwind utilities`
  (`web/styles/index.scss`), `tailwind.config.cjs`, `postcss` tailwind plugin,
  and the tailwind devDependencies.

## Process per file

1. Replace Tailwind `className` utilities with a BEM block class
   (`.component-name__element--modifier`).
2. Author a partial `web/src/styles/components/_<name>.scss`.
3. Register it in `web/styles/index.scss` (the ACTIVE entry, `@use '../src/styles/components/<name>'`).
   NOTE: `web/src/styles/main.scss` is a legacy aggregator and is NOT the active build entry.
4. Reproduce styling **pixel-faithfully** (goal = zero visual regression), then
   improve only obvious token violations.
5. `cd web && npm run build && npm run lint:theme` after each file/batch.

## Config → token mapping table (from `web/tailwind.config.cjs`)

Custom theme colors map to CSS vars — translate utilities to these tokens:

| Tailwind utility | SCSS / token |
| --- | --- |
| `text-primary` / `bg-primary` | `var(--color-primary)` (rgb: `rgba(var(--color-primary-rgb), a)`) |
| `text-on-primary` / `text-primary-text` | `var(--color-primary-text)` |
| `bg-primary-hover` | `var(--color-primary-hover)` |
| `text-main` / `text-ink` | `var(--color-text-main)` |
| `text-muted` | `var(--color-text-muted)` |
| `text-subtle` | `var(--color-text-subtle)` |
| `text-ondark` | `var(--color-text-ondark)` |
| `bg-canvas` | `var(--color-surface-bg)` |
| `bg-paper` | `var(--color-surface-paper)` |
| `bg-card` / `bg-surface` (DEFAULT) | `var(--color-surface-card)` (rgb: `--color-surface-card-rgb`) |
| `bg-surface-bg` | `var(--color-surface-bg)` |
| `bg-surface-hover` | `var(--color-surface-hover)` |
| `border-surface` / `border-line` / `border` | `var(--color-surface-border)` |
| `text-success` / `bg-success` | `var(--color-success)` (rgb `--color-success-rgb`) |
| `text-warning` / `bg-warning` | `var(--color-warning)` (rgb `--color-warning-rgb`) |
| `text-error` / `bg-error` | `var(--color-error)` (rgb `--color-error-rgb`) |
| `rounded-sm/md/lg/xl/2xl/3xl` | `var(--radius-sm/md/lg/xl/2xl/3xl)` (xl=24px) |
| `rounded-full` | `9999px` |
| `shadow-soft` | `var(--shadow-soft)` |
| `shadow-lift` | `var(--shadow-lg)` |
| `font-display` / `font-body` | `font-family: 'Plus Jakarta Sans', sans-serif` |

Raw Tailwind palette still appears in places — translate to the nearest token:
`red-500` → `--color-error` (#ef4444 matches), `green-500/600` → `--color-success`,
`blue-600` → `--color-blue-600`. Alpha variants (`bg-red-500/10`) →
`rgba(var(--color-error-rgb), 0.1)`. Dark-mode `dark:` variants usually collapse
because tokens already theme-switch — drop the `dark:` class and rely on the token.

## Spacing / layout utilities

`flex`, `grid`, `gap-N`, `p-N`, `px-N`, `items-center`, etc. become plain CSS in
the partial. Tailwind spacing scale: `N * 4px` (e.g. `p-6` = 24px, `gap-3` = 12px,
`mb-4` = 16px, `p-1.5` = 6px). `text-xs`=0.75rem, `text-sm`=0.875rem,
`text-lg`=1.125rem. `size-8` = 32px square.

## Progress

- [x] `components/ui/GlobalToast.tsx` → `_global-toast.scss`
- [x] `components/Milestones/MilestoneCard.tsx` → `_milestone-card.scss`
- [ ] ~163 files remaining.

### Remaining hot spots (convert with authenticated QA)
`screens/social/**` (densest), `screens/marketing/**`,
`components/SettingsModal.tsx`, `screens/Team.tsx`, `screens/Profile.tsx`,
`components/settings/RoleManagement.tsx`.

### Lower-risk next batch (small, self-contained)
`components/settings/WorkspaceRolesTab.tsx` (22), `components/editor/menus/TextMenu.tsx` (20),
`components/ui/DatePicker.tsx` (19), `components/project/ProjectReportModal.tsx` (19),
`components/editor/menus/SlashCommandDrawer.tsx` (19), `components/ui/TimePicker.tsx` (15),
`components/tasks/TaskStrategicContext.tsx` (12).

## Final teardown (only after all files migrated)

1. Remove `@tailwind utilities;` from `web/styles/index.scss`.
2. Delete `web/tailwind.config.cjs`; remove tailwind from `web/postcss.config.cjs`.
3. Drop devDeps: `tailwindcss`, `@tailwindcss/forms`, `@tailwindcss/typography`,
   `@tailwindcss/container-queries`, `autoprefixer` (if only used for tailwind).
4. Full `npm run build`, `lint:theme`, and authenticated visual QA sweep.
