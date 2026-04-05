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
- `2026-03-06 | Workspace Storage | Fallback only covers unconfigured providers` - Automatic fallback to Firebase is applied only when S3/Google Drive is not connected/configured; runtime provider errors are surfaced to the user and should be retried after fixing provider health.
- `2026-03-06 | Finance V2 AI Extraction | Responses API model options differ` - Some OpenAI models reject `temperature`; keep extraction calls model-compatible and avoid unsupported parameters to prevent 400 errors in production.
- `2026-03-06 | Finance V2 Confirm Draft | Undefined optional fields break Firestore writes` - Never pass `undefined` for optional fields like `projectId` into `addDoc`; strip undefined values before persisting transaction/bill payloads.
- `2026-03-06 | Finance V2 HTTP Access | Browser CORS fails on raw HTTP callable usage` - Prefer Firebase callable SDK invocation for finance mutation endpoints; direct browser fetch to Cloud Function URLs can fail preflight without explicit CORS handling.
- `2026-03-06 | Finance V2 Tests | React act warnings remain as follow-up (task w5Jz5gRPDxk5A34uq1Id)` - The suite can pass while still emitting `act(...)` warnings in FinanceTracking tests; treat as technical debt and resolve to reduce flaky async behavior.
- `2026-03-06 | Finance Functions Workspace | Period keys must stay YYYY-MM across wizard + payload` - Mixing freeform payload dates with invalid period formats breaks preview validation; keep canonical `YYYY-MM` values in both scope fields and advanced payload overrides.
- `2026-04-04 | Initiatives | Legacy milestone links may still point at idea ids` - Initiative rollout must resolve both first-class initiative ids and old `linkedInitiativeId` idea references until migration has rewritten existing milestone records.
- `2026-04-04 | ProjectFlow Deployment | Live initiative endpoints require deploy (task 07WnG8iY5oyM4KEEFkBi)` - Local Initiative V2 code adds initiative CRUD/upsert routes, but the hosted ProjectFlow API returns HTTP 404 for them until functions, rules, and any required indexes are deployed.
- `2026-04-05 | Initiative Feedback | Public screenshot uploads use base64 JSON` - The public initiative feedback endpoint accepts image attachments as data URLs instead of multipart uploads, so keep attachment count small and enforce strict size limits to avoid HTTP payload failures.
- `2026-04-05 | Initiative Feedback | Dynamic field roles drive task creation` - Public feedback fields are schema-driven, but only mapped roles like `title`, `description`, `customerName`, `customerEmail`, `company`, and `sourceUrl` populate first-class task metadata; all other custom fields are persisted as general feedback responses and appended to the task description.
