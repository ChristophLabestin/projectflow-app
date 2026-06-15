import * as Sentry from '@sentry/react';

/**
 * Centralized error reporting. Sentry is only initialized when a DSN is
 * provided via `VITE_SENTRY_DSN`, so local/dev builds and any environment
 * without a DSN are a complete no-op (nothing is sent, no network calls).
 */

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined)
    || (import.meta.env.MODE as string | undefined)
    || 'production';
const release = import.meta.env.VITE_APP_VERSION as string | undefined;

let initialized = false;

export const initErrorReporting = (): void => {
    if (initialized || !dsn) {
        return;
    }

    Sentry.init({
        dsn,
        environment,
        release,
        // Conservative defaults; tune via env once volume is known.
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        // Avoid leaking PII unless explicitly enabled.
        sendDefaultPii: false,
    });

    initialized = true;
};

export const isErrorReportingEnabled = (): boolean => initialized;

/** Associate subsequent events with the signed-in user (id only, no PII). */
export const setErrorUser = (userId: string | null): void => {
    if (!initialized) return;
    Sentry.setUser(userId ? { id: userId } : null);
};

/** Report a handled error with optional structured context. */
export const reportError = (
    error: unknown,
    context?: Record<string, unknown>,
): void => {
    if (!initialized) {
        // Keep a console trail in dev / when Sentry is disabled.
        // eslint-disable-next-line no-console
        console.error('[reportError]', error, context ?? '');
        return;
    }

    Sentry.captureException(error, context ? { extra: context } : undefined);
};
