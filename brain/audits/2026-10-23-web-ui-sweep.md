# Web UI Sweep — 2026-10-23

Scope: every authenticated view of `web/` against the seeded emulator (`demo@projectflow.test`),
light + dark, EN + DE, 1024 px and ~390 px for the main screens.

Method: a small DOM audit snippet (wrapping button labels, clipped text, horizontal overflow,
raw i18n keys, collapsed text boxes) per view, plus `get_page_text` and few half-scale screenshots.
Static checks: EN/DE key parity of all locale pairs (clean), Tailwind palette classes in TSX.

Severity: **S** small (cosmetic), **M** medium (visibly broken/unusable in a state),
**L** large (redesign topic, proposal only).

## Findings

| # | View | Problem | Sev | Status |
|---|------|---------|-----|--------|
| 1 | Team | Card grid used viewport breakpoints; with the detail panel open, cards collapsed to ~40 px (names gone), segment tabs wrapped | M | fixed (auto-fill grid, nowrap tabs) |
| 2 | Team | Detail panel was `hidden` below 1024 px, so clicking a member did nothing on tablet/phone | M | fixed (overlay panel below `lg`) |
| 3 | Team | Header showed "0 AI agents" when the workspace has none | S | fixed (`team.v2.statsNoAgents`) |
| 4 | Settings → Account | "Export my data" button squeezed to 112 px, label wrapped inside the fixed 40 px height | M | fixed (`.btn` nowrap + no flex-shrink globally; rows wrap) |
| 5 | Settings → Account | Danger zone / blocker boxes used `rose-*`/`amber-*` palette classes | S | fixed (error/warning tokens) |
| 6 | Settings → Account | GitHub icon used `devicon-*` font that is not loaded → empty circle | S | fixed (inline SVG, currentColor) |
| 7 | Settings nav | Long tab labels ("Pre-Alpha-Konfiguration") wrapped centered | S | fixed (`text-left`, icon `shrink-0`) |
