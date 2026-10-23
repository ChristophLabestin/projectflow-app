/** UTC day keys (YYYY-MM-DD), oldest first — the server buckets by UTC day too. */
export const dayKeyList = (days: number, now = Date.now()) =>
    Array.from({ length: days }, (_, i) => new Date(now - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10));
