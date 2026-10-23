/**
 * AI & integrations access model (brain/plans/ai-integrations-concept.md §4/§5).
 *
 * Effective permissions of any machine caller = token scopes ∩ role ceiling ∩ workspace AI policy.
 * Pure helpers (no Firestore) so they are unit-testable; Firestore access lives in the callers.
 */

export type WorkspaceRole = 'Owner' | 'Admin' | 'Member' | 'Guest';

/** How the caller authenticated. `workspace-token` = legacy `pfat_` tokens acting as their creator. */
export type PrincipalKind = 'firebase' | 'workspace-token' | 'oauth' | 'personal-token';

export type AiPolicy = {
    /** Master switch for AI clients and tokens in this workspace. */
    enabled: boolean;
    /** Guests may connect AI clients (limited to their projects). */
    allowGuests: boolean;
    /** OAuth connections and personal tokens may hold `*:delete` scopes. */
    allowDeleteScopes: boolean;
    /** Members may create personal access tokens. */
    allowPersonalTokens: boolean;
};

/** Concept decisions 3–5: AI on, guests off, delete scopes off, personal tokens on. */
export const DEFAULT_AI_POLICY: AiPolicy = {
    enabled: true,
    allowGuests: false,
    allowDeleteScopes: false,
    allowPersonalTokens: true
};

export const normalizeAiPolicy = (raw: unknown): AiPolicy => {
    const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const pick = (key: keyof AiPolicy) => (typeof data[key] === 'boolean' ? (data[key] as boolean) : DEFAULT_AI_POLICY[key]);
    return {
        enabled: pick('enabled'),
        allowGuests: pick('allowGuests'),
        allowDeleteScopes: pick('allowDeleteScopes'),
        allowPersonalTokens: pick('allowPersonalTokens')
    };
};

export const PM_SCOPES = [
    'projects:read',
    'projects:write',
    'projects:delete',
    'tasks:read',
    'tasks:write',
    'tasks:delete',
    'initiatives:read',
    'initiatives:write',
    'initiatives:delete'
] as const;

/** Highest scopes a role can ever exercise through a machine client. The role always beats the scope. */
const ROLE_CEILING: Record<WorkspaceRole, ReadonlySet<string>> = {
    Owner: new Set(PM_SCOPES),
    Admin: new Set(PM_SCOPES),
    Member: new Set(PM_SCOPES.filter((scope) => scope !== 'projects:delete')),
    Guest: new Set(['projects:read', 'tasks:read', 'tasks:write', 'initiatives:read'])
};

export const normalizeRole = (role: unknown): WorkspaceRole | null =>
    role === 'Owner' || role === 'Admin' || role === 'Member' || role === 'Guest' ? role : null;

const isDeleteScope = (scope: string) => scope.endsWith(':delete');

/**
 * Scopes outside the PM set (e.g. platform-admin `blog:*`, `newsletter:*`) are not role-bound workspace
 * data and pass through unchanged; their own endpoints authorize them.
 */
export const effectiveScopes = (input: {
    tokenScopes: readonly string[];
    role: WorkspaceRole;
    policy: AiPolicy;
    kind: PrincipalKind;
}): string[] => {
    const ceiling = ROLE_CEILING[input.role];
    const pm = new Set<string>(PM_SCOPES);
    // Legacy workspace tokens were configured explicitly by an owner; the delete switch governs
    // new user-level connections (OAuth, personal tokens).
    const deleteGoverned = input.kind === 'oauth' || input.kind === 'personal-token';
    return [...new Set(input.tokenScopes)].filter((scope) => {
        if (!pm.has(scope)) return true;
        if (!ceiling.has(scope)) return false;
        if (deleteGoverned && isDeleteScope(scope) && !input.policy.allowDeleteScopes) return false;
        return true;
    });
};

export type AccessDecision = { ok: true } | { ok: false; status: 403; error: string };

/** Workspace-level gate: is this kind of caller allowed in this workspace at all? */
export const checkWorkspaceAccess = (input: { role: WorkspaceRole; policy: AiPolicy; kind: PrincipalKind }): AccessDecision => {
    // Signed-in app sessions are not "AI access"; the app's own rules apply.
    if (input.kind === 'firebase') return { ok: true };
    if (!input.policy.enabled) return { ok: false, status: 403, error: 'AI access is disabled for this workspace.' };
    if (input.role === 'Guest' && !input.policy.allowGuests) {
        return { ok: false, status: 403, error: 'Guests cannot use AI integrations in this workspace.' };
    }
    if (input.kind === 'personal-token' && !input.policy.allowPersonalTokens) {
        return { ok: false, status: 403, error: 'Personal access tokens are disabled for this workspace.' };
    }
    return { ok: true };
};

/** Guests only reach projects whose `memberIds` contain them (same rule as firestore.rules). */
export const canReachProject = (role: WorkspaceRole, uid: string, project: { memberIds?: unknown } | null | undefined): boolean => {
    if (!project) return false;
    if (role !== 'Guest') return true;
    return Array.isArray(project.memberIds) && project.memberIds.includes(uid);
};

// ---------------------------------------------------------------------------
// Rate limiting (per instance token bucket; approximate across instances by design)
// ---------------------------------------------------------------------------

export type RateLimitRule = { capacity: number; refillPerSecond: number };

export const RATE_LIMITS = {
    /** All requests of one credential. */
    request: { capacity: 120, refillPerSecond: 2 },
    /** Writes and deletes of one credential. */
    write: { capacity: 30, refillPerSecond: 0.5 }
} satisfies Record<string, RateLimitRule>;

export class RateLimiter {
    private buckets = new Map<string, { tokens: number; updatedAt: number }>();

    constructor(private readonly now: () => number = () => Date.now(), private readonly maxKeys = 10000) {}

    /** Takes one unit; returns 0 when allowed, else the seconds until the next unit is available. */
    take(key: string, rule: RateLimitRule): number {
        const now = this.now();
        const bucket = this.buckets.get(key) || { tokens: rule.capacity, updatedAt: now };
        const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
        bucket.tokens = Math.min(rule.capacity, bucket.tokens + elapsed * rule.refillPerSecond);
        bucket.updatedAt = now;
        if (bucket.tokens >= 1) {
            bucket.tokens -= 1;
            this.store(key, bucket);
            return 0;
        }
        this.store(key, bucket);
        return Math.ceil((1 - bucket.tokens) / rule.refillPerSecond);
    }

    private store(key: string, bucket: { tokens: number; updatedAt: number }) {
        // Map keeps insertion order: drop the oldest key once the cap is reached.
        this.buckets.delete(key);
        if (this.buckets.size >= this.maxKeys) {
            const oldest = this.buckets.keys().next().value;
            if (oldest !== undefined) this.buckets.delete(oldest);
        }
        this.buckets.set(key, bucket);
    }
}

/** `lastUsedAt` is written at most every 5 minutes instead of on every call. */
export const shouldTouchLastUsed = (lastUsedAt: { toDate?: () => Date } | null | undefined, now: Date, intervalMs = 5 * 60 * 1000) => {
    const last = lastUsedAt?.toDate?.();
    return !last || now.getTime() - last.getTime() >= intervalMs;
};

export const AI_AUDIT_RETENTION_DAYS = 180;
