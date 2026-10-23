import { defineConfig } from '@playwright/test';

// Admin console smoke (scripts/predeploy-smoke-admin.sh). Base URL comes from PLAYWRIGHT_BASE_URL.
export default defineConfig({
    testDir: '.',
    timeout: 60_000,
    retries: 0,
    workers: 1,
    use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4292', trace: 'off' },
});
