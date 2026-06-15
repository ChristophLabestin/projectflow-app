/**
 * Retry a transient async operation with exponential backoff.
 *
 * Intended for network-bound calls (Firestore reads/writes, HTTP) that can fail
 * on temporary connectivity blips. Permanent errors (permission-denied, invalid
 * argument, not-found) are NOT retried so real bugs surface immediately.
 */

type RetryOptions = {
    retries?: number;
    /** Base delay in ms for the first retry; doubles each attempt. */
    baseDelayMs?: number;
    /** Cap for a single backoff delay. */
    maxDelayMs?: number;
    /** Decide whether a given error is worth retrying. */
    shouldRetry?: (error: unknown) => boolean;
    /** Called before each retry (e.g. for logging/telemetry). */
    onRetry?: (error: unknown, attempt: number) => void;
};

// Firestore / fetch error codes that indicate a transient condition.
const TRANSIENT_CODES = new Set([
    'unavailable',
    'deadline-exceeded',
    'aborted',
    'internal',
    'resource-exhausted',
    'cancelled',
]);

export const isTransientError = (error: unknown): boolean => {
    if (!error) return false;
    const code = (error as { code?: string }).code;
    if (typeof code === 'string') {
        const normalized = code.replace(/^[a-z-]+\//, ''); // strip "auth/" style prefixes
        if (TRANSIENT_CODES.has(normalized)) return true;
    }
    const message = (error as { message?: string }).message?.toLowerCase() ?? '';
    return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('failed to fetch') ||
        message.includes('offline') ||
        message.includes('temporarily unavailable')
    );
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
): Promise<T> {
    const {
        retries = 3,
        baseDelayMs = 300,
        maxDelayMs = 4000,
        shouldRetry = isTransientError,
        onRetry,
    } = options;

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt === retries || !shouldRetry(error)) {
                throw error;
            }
            onRetry?.(error, attempt + 1);
            const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
            // Jitter avoids thundering-herd retries when many clients reconnect.
            await wait(delay + Math.floor(Math.random() * delay * 0.25));
        }
    }
    throw lastError;
}
