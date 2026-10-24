import { expect, test, type BrowserContext } from '@playwright/test';

import { adminDelete, adminGet, adminSet, signedInContext, TENANT, waitForApp } from './helpers';

const ENT = `tenants/${TENANT}/entitlements/plan`;

/** Free plan on the demo workspace: project limit, read-only project over the limit, no invites. */
test.describe.serial('plan limits: Free', () => {
    let context: BrowserContext;
    let original: Record<string, any> | null = null;
    test.beforeAll(async ({ browser }) => {
        original = await adminGet(ENT);
        await adminSet(ENT, {
            plan: 'free', workspaceType: 'team', status: 'free', seats: 0, memberLimit: 1, projectLimit: 3, projectCount: 4,
            invitesAllowed: false, lockedProjectIds: ['p-old'], memberCount: 1, aiAddonSeats: 0, aiMemberIds: [],
        });
        context = await signedInContext(browser);
    });
    test.afterAll(async () => {
        await context?.close();
        // Back to the seeded entitlement (other specs run on the same workspace).
        await adminDelete(ENT);
        if (original) await adminSet(ENT, original);
    });

    test('creating a fourth project shows the limit dialog', async () => {
        const page = await context.newPage();
        await page.goto('/projects');
        await waitForApp(page);
        await page.getByRole('button', { name: /Create Project|New project/i }).first().click();
        await expect(page.getByText('Project limit reached')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('.plan-limit-dialog__body')).toContainText('The Free plan includes 3 projects');
        await page.close();
    });

    test('a project over the limit is read-only', async () => {
        const page = await context.newPage();
        await page.goto('/project/p-old');
        await waitForApp(page);
        await expect(page.locator('.plan-lock-gate .plan-hint')).toContainText('Read-only project', { timeout: 15_000 });
        await page.close();
    });

    test('invitations are not available', async () => {
        const page = await context.newPage();
        await page.goto('/team');
        await waitForApp(page);
        await page.getByRole('button', { name: /^(person_add\s*)?Invite$/ }).first().click();
        await expect(page.getByRole('dialog').getByText('Invitations are part of Team')).toBeVisible({ timeout: 15_000 });
        await page.close();
    });
});
