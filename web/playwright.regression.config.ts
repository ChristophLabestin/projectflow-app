import { defineConfig } from '@playwright/test';

/**
 * E2E regression suite (scripts/e2e-regression.sh): core flows against the seeded emulators.
 * Serial on purpose: specs share one demo workspace and some flip workspace state (plan, suspension).
 */
export default defineConfig({
    testDir: './e2e/regression',
    timeout: 60_000,
    expect: { timeout: 10_000 },
    workers: 1,
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3151',
        // Locally the installed Google Chrome; CI installs Playwright's Chromium (SMOKE_CHANNEL='').
        ...(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {}),
        locale: 'en-US',
        trace: 'retain-on-failure',
    },
});
