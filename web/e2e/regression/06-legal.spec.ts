import { expect, test } from '@playwright/test';

import { adminGet, USERS } from './helpers';

/** Published legal docs (E2E_LEGAL=1): a user without consent sees the blocking gate; accepting unlocks the app. */
test('legal consent gate blocks until accepted', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(USERS.luis.email);
    await page.locator('input[type="password"]').fill(USERS.luis.password);
    await page.locator('button[type="submit"]').click();

    const gate = page.getByTestId('legal-consent-gate');
    await expect(gate).toBeVisible({ timeout: 30_000 });
    await expect(gate.locator('.legal-gate__title')).toHaveText(/accept our terms|updated our legal documents/);
    // Nothing behind the gate is usable: navigating does not bypass it.
    await page.goto('/projects');
    await expect(gate).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('legal-consent-accept').click();
    await expect(gate).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('.app-main-scroll')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => adminGet('legal_acceptances/demo-luis'), { timeout: 10_000 }).toBeTruthy();

    // Accepted once = no gate on the next load.
    await page.reload();
    await expect(page.locator('.app-main-scroll')).toBeVisible({ timeout: 20_000 });
    await expect(gate).toHaveCount(0);
    await context.close();
});
