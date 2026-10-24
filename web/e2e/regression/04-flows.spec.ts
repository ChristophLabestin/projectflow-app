import { expect, test, type BrowserContext } from '@playwright/test';

import { adminList, adminSet, signedInContext, TENANT, uniqueName, waitForApp } from './helpers';

test.describe.serial('flows: template, test run, activate, event, run log', () => {
    let context: BrowserContext;
    test.beforeAll(async ({ browser }) => { context = await signedInContext(browser); });
    test.afterAll(async () => { await context?.close(); });

    test('create from a template, test, activate and see the run of a real event', async () => {
        test.setTimeout(120_000);
        const page = await context.newPage();
        const name = uniqueName('E2E done flow');

        await page.goto('/flows/new?start=template');
        await waitForApp(page);
        await page.locator('.flow-gallery__card', { hasText: 'Tell the creator when a task is done' }).first().click();
        await expect(page).toHaveURL(/\/flows\/new\/edit/, { timeout: 15_000 });
        await page.getByRole('textbox', { name: 'Flow name' }).fill(name);
        await page.getByRole('button', { name: 'Create flow' }).click();
        await expect(page.getByText('Flow saved')).toBeVisible({ timeout: 15_000 });
        await expect(page).toHaveURL(/\/flows\/(?!new)[^/?]+/);

        const flows = await adminList(`tenants/${TENANT}/automations`);
        const flow = flows.find((entry) => entry.data.name === name);
        expect(flow, 'flow stored').toBeTruthy();

        // Test tab: dry-run preview against current tasks.
        await page.getByRole('tab', { name: 'Test' }).click();
        await page.getByRole('button', { name: /Check matches|Check again/ }).click();
        await expect(page.locator('.flow-preview__summary')).toContainText(/Would match \d+ tasks?/, { timeout: 20_000 });

        // Activate: switch off and on again, the stored flag follows.
        await page.getByRole('tab', { name: 'Setup' }).click();
        const toggle = page.getByRole('switch', { name: 'Flow active' }).or(page.getByLabel('Flow active')).first();
        await toggle.click();
        await expect.poll(async () => (await adminList(`tenants/${TENANT}/automations`)).find((entry) => entry.id === flow!.id)?.data.enabled, { timeout: 15_000 }).toBe(false);
        await toggle.click();
        await expect.poll(async () => (await adminList(`tenants/${TENANT}/automations`)).find((entry) => entry.id === flow!.id)?.data.enabled, { timeout: 15_000 }).toBe(true);

        // Real event: a task in the workspace goes to Done (server write, like another user).
        await adminSet(`tenants/${TENANT}/projects/p-website/tasks/t-perf`, { status: 'Done', isCompleted: true, completedAt: new Date().toISOString(), updatedAt: new Date() });
        await expect.poll(async () => (await adminList(`tenants/${TENANT}/automation_runs`))
            .filter((run) => run.data.automationId === flow!.id).map((run) => run.data.status), { timeout: 45_000 }).toContain('succeeded');

        // Run log in the UI.
        await page.reload();
        await waitForApp(page);
        await page.getByRole('tab', { name: 'Run log' }).click();
        await expect(page.locator('.flow-run__row').first()).toContainText('Succeeded', { timeout: 15_000 });
        await page.close();
    });
});
