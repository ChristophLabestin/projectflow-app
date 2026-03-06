# Gotchas Log

Living log of pitfalls, edge cases, and workflow surprises discovered while working in this repo. Add a new entry whenever you hit or learn something worth remembering.

## Format
- `YYYY-MM-DD | Area | Short title` - One sentence describing the gotcha and how to avoid it.

## Log
- `YYYY-MM-DD | Area | Short title` - Description.
- `2026-01-13 | Swift | Task name collision` - Use `Swift.Task {}` to avoid confusion with the `Task` model; `_Concurrency.Task` can produce misleading DocumentSnapshot errors.
- `2026-01-13 | Web | Missing canvas-confetti dependency` - `npm run build` fails unless `canvas-confetti` is installed or externalized in Vite.
- `2026-01-13 | iOS Build | DerivedData nanodp build path` - `xcodebuild` can fail if a file exists at `DerivedData/.../nanopb/build`; remove the file so the directory can be created.
- `2026-01-13 | SwiftUI | onChange needs Equatable inputs` - Use `.map(\.id)` or another Equatable projection when observing arrays in `onChange`.
- `2026-01-13 | SwiftUI | Type-check timeouts on large views` - Break large SwiftUI bodies into smaller subviews or use `AnyView` to reduce compiler load.
- `2026-01-13 | Xcode | DerivedData nanonpb build path collision` - If the default `xcodebuild` target command fails with \"File exists but is not a directory\" under DerivedData, build with an explicit `-derivedDataPath` and `-scheme` instead.
- `2026-01-13 | Functions | AI model consistency` - Force text generation to use `gemini-3-flash-preview` in Cloud Functions to avoid client-provided model drift.
- `2026-01-13 | Functions | Deployed model mismatch` - If Cloud Functions aren’t deployed after model updates, production can still call deprecated models like `gemini-1.5-pro` and return 404s.
- `2026-01-13 | Functions | Deploy lockfile sync` - `firebase deploy` runs `npm ci`, so `functions/package-lock.json` must be in sync with `functions/package.json` or deployment fails.
- `2026-03-04 | Web Finance | Break-even edge case` - If contribution per unit is `<= 0`, there is no finite break-even point; always display an explicit \"not reachable\" state instead of a numeric threshold.
- `2026-03-04 | Web i18n | Mojibake in German locale files` - Some `web/locales/*-de.ts` entries can contain misencoded UTF-8 sequences (for example `Ã¼`, `â€“`); normalize to real Unicode characters and run a grep check before shipping.
- `2026-03-04 | Integrations | ProjectFlow token date shape` - Callable responses can return Firestore timestamps as objects (`seconds`/`_seconds`) instead of JS Dates, so settings UI should parse both shapes before formatting.
- `2026-03-05 | Quick Access | Compact clipboard can disappear with stale selection` - If `selectedItemId` points to a removed pin, compact-mode controls may vanish; always resolve an active fallback item (focus or first pinned) before rendering compact/full actions.
- `2026-03-05 | Finance Integrations | Endpoint tokens must stay in tenant secrets` - Store external financial tokens under `tenants/{tenantId}/secrets/*` and fetch telemetry through callable proxies; exposing tokens via normal tenant docs leaks credentials to all tenant members.
- `2026-03-05 | Finance V2 | Closed periods block posting` - Posting into a `finance_periods/{YYYY-MM}` document with `status=closed` must fail in functions and never be bypassed by client writes, otherwise monthly close reproducibility breaks.
