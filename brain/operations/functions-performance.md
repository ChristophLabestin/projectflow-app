# Cloud Functions performance (cold start)

Status 2026-10-24. Project `projectflow-labestin`, region `europe-west3`.

## Why cold starts were slow
- 132 functions; 121 are gen 1, of which 112 ran at 256 MB. Gen 1 CPU scales with memory
  (256 MB ≈ 400 MHz, 512 MB ≈ 800 MHz, 1 GB ≈ 1.4 GHz). Module loading is CPU-bound.
- `functions/src/index.ts` imported every module, so every instance loaded every SDK
  (firebase-admin, simplewebauthn, aws-sdk, mcp-sdk, stripe, openai, nodemailer …):
  ~290 ms on a fast laptop, several seconds at 400 MHz. No single SDK dominates.

## What changed
1. **Lazy export map** (`FUNCTION_MODULES` in `functions/src/index.ts`): each function is a getter
   that `require`s its module on first access. The runtime reads only `exports[FUNCTION_TARGET]`,
   so an instance loads one module (locally ~100 ms instead of ~290 ms). Deploy discovery and the
   emulator enumerate the getters, so names, triggers and regions are unchanged.
   Guard: `functions/scripts/unit/index-exports.test.js` (part of `npm run test:unit`).
2. **`FAST_START` (1 GB) for user-facing gen 1 functions** (`functions/src/runtime-options.ts`):
   passkeys (4), desktop auth (2), billing callables (9), seats (3), invitations (2),
   legal accept + document (2), `mcp`, `oauth`, OAuth consent (2), AI proposals (2). In-place memory
   update, no delete. Billed only while running.

## Measurement
Method: `POST {"data":{}}` without auth to the callable URL (read-only, rejected after the module
loaded), first call after the instance has gone idle vs. immediate second call. Script idea:
`curl -s -o /dev/null -w '%{time_total}'` twice per function.

### Cold start, client side (seconds, cold first call; warm 0.09–0.3 s throughout)
| Function | Before (256 MB, full bundle) | After (1 GB, lazy map) |
|---|---|---|
| getBillingConfig | 6.09 | 1.6–2.9 |
| listBillingWorkspaces | 4.90 | 2.2–2.7 |
| getSubscriptionStatus | 4.50 | 1.7–3.0 |
| createSubscriptionIntent | 3.84 | 2.3 |
| generatePasskeyAuthenticationOptions | 4.98 | 1.5–2.6 |
| verifyPasskeyAuthentication | 4.22 | 1.9–3.4 |
| acceptWorkspaceInvite | 4.79 | 2.9–3.1 |
| acceptLegalDocuments | 2.74 | 1.5 |
Same-moment comparison (6 parallel requests, gen 1 starts new instances): optimized 2.7–3.4 s,
untouched 256 MB functions (getCategories, exportMyData, getWorkspaceAiPolicy, listWorkspaceAiAudit) 4.2–5.3 s.

### Where the rest goes (`coldStart` log line, ms, prod)
Every instance logs one `{"message":"coldStart","target",nodeBootMs,initMs,moduleLoadMs}` line
(`functions/src/index.ts`). Query: `gcloud logging read 'jsonPayload.message="coldStart"' --project projectflow-labestin --freshness=1h`.
| Function (memory) | nodeBootMs | initMs | moduleLoadMs |
|---|---|---|---|
| billing callables (gen 1, 1 GB) | 400–800 | 470–660 | 280–490 |
| passkeys (gen 1, 1 GB) | 600–910 | 520–690 | 460–1150 |
| invitations (gen 1, 1 GB) | 310–940 | 460–700 | 370–660 |
| aiAssist (gen 2, 512 MiB, 1 vCPU) | 790 | 690 | 1740 |
| mcpServer (gen 2, 512 MiB, 1 vCPU) | 890 | 760 | 1680 |
Plus ~0.5–1 s platform time before node starts. Prod is ~10× slower than a laptop for the same
module graph (sandboxed file system: many small `require` file reads), so fewer files matters as much as fewer SDKs.

## Rules for new functions
- Add the export name to `FUNCTION_MODULES` under its module (the unit test fails otherwise; a
  missing name is not deployed and `firebase deploy` would offer to delete the live function).
- User-facing gen 1 callables/HTTP: `functions.region(REGION).runWith(FAST_START)`.
- Keep module top level cheap: no network calls, no client construction that needs secrets;
  create SDK clients inside the handler or lazily (`let client; const getClient = () => client ??= new X()`).

## Open options (not done)
- Deploy the remaining ~100 functions so they also pick up the lazy map (they keep the old
  full-bundle code until their next deploy).
- Lazy loading of heavy SDKs inside handlers: @simplewebauthn/server (passkeys), openai + mcp-sdk + zod (aiAssist, mcpServer), stripe.
- esbuild bundling of `lib/` (fewer file reads; touches the deploy pipeline).
- 2nd gen migration (delete + create, needs a migration plan) and `minInstances` for launch —
  only after a decision by the user/orchestrator.
