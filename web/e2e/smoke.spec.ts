import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Pre-deploy smoke test (scripts/predeploy-smoke.sh): the production build against the seeded emulators.
 * Signs in as the demo owner and opens the main routes with a full page load each (real chunk loading),
 * failing on console errors, uncaught exceptions, the error boundary / route error page, or a stuck loader.
 * Guards the two failure modes we shipped once: blank app after a chunk error, and a crashing route wrapper.
 */

// Locally the installed Google Chrome (no extra Playwright browser download); CI installs Playwright's Chromium.
if (process.env.SMOKE_CHANNEL) test.use({ channel: process.env.SMOKE_CHANNEL });

const EMAIL = process.env.SMOKE_EMAIL || 'demo@projectflow.test';
const PASSWORD = process.env.SMOKE_PASSWORD || 'projectflow-demo';

type Route = { name: string; path: string; ready?: (page: Page) => Promise<void> };

const settingsDialog = (text: RegExp) => async (page: Page) => {
    await expect(page.getByRole('dialog').filter({ hasText: text }).first()).toBeVisible({ timeout: 15_000 });
};

const ROUTES: Route[] = [
    { name: 'dashboard', path: '/' },
    { name: 'my tasks', path: '/tasks' },
    { name: 'calendar', path: '/calendar' },
    { name: 'projects', path: '/projects' },
    { name: 'project overview', path: '/project/p-website' },
    { name: 'project tasks', path: '/project/p-website/tasks' },
    { name: 'task detail', path: '/project/p-website/tasks/t-hero' },
    { name: 'files', path: '/files' },
    { name: 'wiki', path: '/wiki' },
    { name: 'flows', path: '/flows' },
    { name: 'activity', path: '/activity' },
    { name: 'insights', path: '/insights' },
    { name: 'settings', path: '/?openSettings=account', ready: settingsDialog(/settings|einstellungen/i) },
    { name: 'billing tab', path: '/?openSettings=billing', ready: settingsDialog(/plan/i) },
];

// Noise that is not an app failure: third-party assets that may be offline in CI.
const isExternalNoise = (text: string, url: string) =>
    /svgrepo\.com|images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com/.test(`${text} ${url}`);

test.describe.serial('pre-deploy smoke', () => {
    let context: BrowserContext;

    // Errors of one page only: a request still running when the previous route was left must not count here.
    const watch = (page: Page) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
        page.on('console', (message) => {
            if (message.type() !== 'error') return;
            const url = message.location()?.url || '';
            if (isExternalNoise(message.text(), url)) return;
            errors.push(`console: ${message.text()}${url ? ` (${url})` : ''}`);
        });
        return errors;
    };

    test.beforeAll(async ({ browser }) => {
        // One signed-in context (auth lives in IndexedDB); every route gets a fresh page in it.
        context = await browser.newContext();
        const page = await context.newPage();
        await page.goto('/login');
        await page.locator('input[type="email"]').fill(EMAIL);
        await page.locator('input[type="password"]').fill(PASSWORD);
        await page.locator('button[type="submit"]').click();
        await expect(page.locator('.app-main-scroll')).toBeVisible({ timeout: 30_000 });
        await page.close();
    });

    test.afterAll(async () => {
        await context?.close();
    });

    for (const route of ROUTES) {
        test(`renders ${route.name} (${route.path})`, async () => {
            const page = await context.newPage();
            const errors = watch(page);
            try {
                await page.goto(route.path);
                // App shell up and no loading scene left (workspace gate / route suspense).
                await expect(page.locator('.app-main-scroll')).toBeVisible({ timeout: 20_000 });
                await expect(page.locator('.brand-scene')).toHaveCount(0, { timeout: 20_000 });
                if (route.ready) await route.ready(page);
                // Late errors (lazy chunks, effects, first snapshots).
                await page.waitForTimeout(1_200);

                await expect(page.locator('.error-boundary'), 'error boundary shown').toHaveCount(0);
                await expect(page.locator('.error-page'), 'route error / 404 page shown').toHaveCount(0);
                expect(errors, `errors on ${route.path}`).toEqual([]);
            } finally {
                await page.close();
            }
        });
    }
});
