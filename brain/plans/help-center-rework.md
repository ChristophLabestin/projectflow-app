# Help Center Rework (2026-10-23)

Status: implemented in the web app on 2026-10-23 (see "Done" below). Owner: web.

## Why
The help center (`web/components/help/`) dated from before PM-core simplification:
- Content described retired concepts (Flows, Issues, Social), wrong roles (project roles are Owner/Editor/Viewer,
  workspace roles Owner/Admin/Member/Guest + custom roles), wrong project statuses/priorities, an outdated health
  formula and 14 keyboard shortcuts that never existed.
- No coverage for Initiatives, My Tasks, Calendar, Finance, Notifications, Milestones, Desktop app, API & MCP, security.
- 7 hand-built page components (~2,100 lines) with mock UIs that drift from the real app, Tailwind utilities and
  borders everywhere (violates the borderless rule and the SCSS-only rule), 75 vw drawer with a second nav column.

## Decisions
1. **Content = typed data per language**, not components and not i18n keys:
   `web/locales/help/articles/<id>-en.ts|-de.ts` export one `HelpArticle` each; `articles-en.ts|-de.ts` order them and
   name the categories. Rationale: the new content is prose plus a few structured block types, where one file per
   article/language reads and reviews like a document, while keys only paid off for the old component-heavy pages.
   Typed TS (not MDX) needs no new build tooling, is type-checked, and is plain JSON-like data that the iOS app or the
   landing page could consume later. A parity test guarantees identical ids/structure in EN and DE.
2. **Block types only**: `text`, `steps`, `list`, `callout` (tip/note/warning), `terms`, `shortcuts`. Inline:
   `**bold**`, `` `code` ``, `[label](/route)` (in-app link: navigate + close). No mock UIs, no screenshots — they
   drift; links into the real screen replace them.
3. **One-column sheet** instead of a two-column 75 vw drawer: floating panel (`--help-center-width` 680 px, inset 12 px,
   `--radius-surface`, `--shadow-lg`, full screen below 720 px), views stacked: Home → Article / Search, back arrow.
   Borderless; depth via surface contrast (card → hover). Reading width ≤ 720 px per STYLING 5.1.
4. **Home view**: "For this page" (route → article/section via `helpRouting.ts`), then articles grouped by category.
5. **Search**: ranked term search over titles, keywords and block text (all terms must match; DE keywords include
   English synonyms), Ask CORA below the results. ⌘K global search indexes the same articles.
6. **Lazy per language**: `useHelpContent()` imports only the active language (`help-content-en|de` chunks).
7. **Out of scope (follow-ups)**: iOS consuming the same content; per-screen "?" buttons deep-linking into sections;
   "What's new" article fed from release notes.

## Articles (ids are stable — used by routing, search and deep links)
| Category | Articles |
|---|---|
| basics | `getting-started`, `dashboard`, `search-shortcuts` |
| work | `tasks`, `projects`, `initiatives` |
| planning | `milestones`, `sprints`, `calendar` |
| collaboration | `team`, `notifications` |
| cora | `cora`, `media`, `marketing` |
| workspace | `finance`, `settings`, `desktop` |

## Done
- Model/renderer: `helpTypes.ts`, `HelpInline.tsx`, `HelpArticleView.tsx`, `helpSearch.ts`, `helpRouting.ts`,
  `useHelpContent.ts`, `help-center.scss`; drawer and floating button rebuilt; old `pages/*`, `helpCenterContent.ts`
  and the key-based `locales/help-*.ts` removed.
