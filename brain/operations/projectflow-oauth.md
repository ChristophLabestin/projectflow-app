# ProjectFlow OAuth for MCP clients

Date: 2026-10-23 · Concept: `brain/plans/ai-integrations-concept.md` · Code: `functions/src/oauth-server.ts`, `oauth-core.ts`, `oauth-config.ts`, `ai-tokens.ts`, `web/screens/OAuthConsent.tsx`

## URLs (production)
- Issuer / AS metadata: `https://app.getprojectflow.com/.well-known/oauth-authorization-server` (function `oauth`).
- Protected resource metadata: `https://app.getprojectflow.com/.well-known/oauth-protected-resource/mcp` (function `mcp`; resource = the MCP URL the client called: `app.getprojectflow.com/mcp`, later `mcp.getprojectflow.com/mcp`).
- Endpoints: `/oauth/authorize`, `/oauth/token`, `/oauth/register` (DCR), `/oauth/revoke`; consent page `/oauth/consent` (web app). All via Hosting rewrites → a hosting deploy is required after changing them.

## Flow
1. Client calls `/mcp` without token → 401 + `resource_metadata` → PRM → AS metadata.
2. Client registers (DCR, `pfc_…` id) or uses a Client ID Metadata Document (https `client_id`, fetched with SSRF guard, cached 24 h).
3. `/oauth/authorize` (PKCE S256 required, redirect exact or loopback any port) parks `oauth_requests/{id}` (10 min) → `/oauth/consent?request=…`.
4. Consent (Firebase sign-in): user picks one workspace (policy + role shown) and scopes → callable `approveOAuthConsent` creates/updates `ai_grants/{id}` (one per user × workspace × client) and a one-time code (60 s).
5. `/oauth/token`: code + verifier → `pfo_` access (1 h) + `pfr_` refresh (30 d, rotating; reuse or code replay revokes the grant). `resource` binds the audience.
6. `/mcp` and `/api` resolve `pfo_`/`pfp_` via `ai_tokens/{sha256}` → grant → live `members` role; effective scopes = grant scopes ∩ role ceiling ∩ AI policy (`ai-access.ts`).

## Personal access tokens & connections
- `createPersonalAccessToken({tenantId, name, scopes, expiresInDays ≤ 365})` → `pfp_…` shown once.
- `listAiConnections({tenantId, all?})` (all = Owner/Admin), `revokeAiConnection({grantId})` (owner of the grant or Owner/Admin) — deletes the grant's tokens immediately.

## Storage (Admin SDK only, rules deny-all)
`oauth_clients`, `oauth_requests`, `oauth_codes`, `ai_grants`, `ai_tokens` (TTL on `expireAt`; revoked grants kept 180 days).

## Testing
`cd functions && npm run test:ai-access` (own emulators 9951/8951/5951): DCR, PKCE, consent, token, refresh rotation + reuse, PAT, revocation, policy. Manual consent UI: `.claude/launch.json` → `web-ai-emulator` (port 3020) against those emulators.
