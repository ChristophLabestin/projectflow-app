import { expect, test, type Page } from '@playwright/test';

/**
 * Pre-deploy smoke for the admin console (scripts/predeploy-smoke-admin.sh): production bundle against the
 * seeded emulators (scripts/dev-admin.sh). A normal user is stopped at the gate; the admin opens every page with a
 * full reload (real chunk loading) without console errors, error notes or a stuck loader.
 */
if (process.env.SMOKE_CHANNEL) test.use({ channel: process.env.SMOKE_CHANNEL });

const PAGES = [
    { path: '/', title: 'Übersicht' },
    { path: '/users', title: 'Nutzer' },
    { path: '/workspaces', title: 'Workspaces' },
    { path: '/onboarding', title: 'Onboarding' },
    { path: '/crashes', title: 'Crashes' },
    { path: '/ai', title: 'KI & MCP' },
    { path: '/system', title: 'System' },
    { path: '/legal', title: 'Rechtsdokumente' },
    { path: '/blog', title: 'Blog' },
    { path: '/newsletter', title: 'Leads & Newsletter' },
    { path: '/audit', title: 'Audit-Log' },
];

const watchErrors = (page: Page) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (msg) => {
        if (msg.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 40[13]/.test(msg.text())) errors.push(msg.text());
    });
    return errors;
};

const signIn = async (page: Page, email: string, password: string) => {
    await page.goto('/');
    await page.getByPlaceholder('E-Mail').fill(email);
    await page.getByPlaceholder('Passwort').fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
};

test('normal user is stopped at the gate', async ({ page }) => {
    await signIn(page, 'outsider@projectflow.test', 'pf-outsider-e2e');
    await expect(page.getByRole('heading', { name: 'Kein Zugang' })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.ac-sidebar')).toHaveCount(0);
});

test('admin opens every page', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'demo@projectflow.test', 'projectflow-demo');
    await expect(page.locator('.ac-sidebar')).toBeVisible({ timeout: 30_000 });
    for (const p of PAGES) {
        await page.goto(p.path);
        await expect(page.locator('.ac-page__head h1').first(), p.path).toHaveText(p.title, { timeout: 30_000 });
        await expect(page.locator('.ac-skeleton'), `${p.path} still loading`).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator('.ac-alert--error'), `${p.path} shows an error`).toHaveCount(0);
    }
    expect(errors, errors.join('\n')).toEqual([]);
});
