import { expect, test, type BrowserContext } from '@playwright/test';

import { adminList, signedInContext, TENANT, uniqueName, waitForApp } from './helpers';

test.describe.serial('tasks: create, edit, complete', () => {
    let context: BrowserContext;
    test.beforeAll(async ({ browser }) => { context = await signedInContext(browser); });
    test.afterAll(async () => { await context?.close(); });

    test('quick-add, rename in the edit modal, mark as done', async () => {
        const page = await context.newPage();
        const title = uniqueName('E2E task');
        const renamed = `${title} (edited)`;

        await page.goto('/project/p-website/tasks');
        await waitForApp(page);
        const quickAdd = page.getByPlaceholder('Add a task and press Enter…');
        await quickAdd.fill(title);
        await quickAdd.press('Enter');
        await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 });

        // Open the detail page via the stored id (stable, independent of list layout).
        const tasks = await adminList(`tenants/${TENANT}/projects/p-website/tasks`);
        const created = tasks.find((task) => task.data.title === title);
        expect(created, 'task stored in Firestore').toBeTruthy();
        await page.goto(`/project/p-website/tasks/${created!.id}`);
        await waitForApp(page);
        await expect(page.locator('.task-detail__title')).toHaveText(title, { timeout: 15_000 });

        await page.getByRole('button', { name: 'Edit', exact: true }).click();
        const dialog = page.locator('.edit-task-form');
        const titleInput = dialog.locator('input').first();
        await titleInput.fill(renamed);
        await dialog.getByRole('button', { name: 'Save Changes' }).click();
        await expect(page.locator('.task-detail__title')).toHaveText(renamed, { timeout: 15_000 });

        await page.getByRole('button', { name: 'Mark as Done' }).click();
        await expect(page.getByRole('button', { name: 'Completed' })).toBeVisible({ timeout: 15_000 });
        await expect.poll(async () => (await adminList(`tenants/${TENANT}/projects/p-website/tasks`))
            .find((task) => task.id === created!.id)?.data.isCompleted, { timeout: 10_000 }).toBe(true);
        await page.close();
    });
});
