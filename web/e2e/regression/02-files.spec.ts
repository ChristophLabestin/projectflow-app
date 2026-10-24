import { expect, test, type BrowserContext } from '@playwright/test';

import { adminList, signedInContext, TENANT, uniqueName, waitForApp } from './helpers';

test.describe.serial('files: upload, trash, delete permanently', () => {
    let context: BrowserContext;
    test.beforeAll(async ({ browser }) => { context = await signedInContext(browser); });
    test.afterAll(async () => { await context?.close(); });

    test('upload a file, move it to the trash and purge it', async () => {
        const page = await context.newPage();
        const name = `${uniqueName('e2e-notes').replace(/\s+/g, '-')}.txt`;
        const row = page.getByRole('button', { name: `Actions for ${name}` });

        const errors: string[] = [];
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text().slice(0, 300)); });
        await page.goto('/files');
        await waitForApp(page);
        await expect(page.locator('.files-page__title')).toBeVisible();
        await page.locator('input[type=file][multiple]').setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('ProjectFlow E2E regression file') });
        await expect(row, `upload shows up (console: ${errors.join(' | ')})`).toBeVisible({ timeout: 30_000 });
        await expect.poll(async () => (await adminList(`tenants/${TENANT}/files`)).some((file) => file.data.name === name), { timeout: 10_000 }).toBe(true);

        await page.getByRole('button', { name: `Actions for ${name}` }).click();
        await page.getByRole('menuitemradio', { name: 'Move to trash' }).click();
        await expect(page.getByText('Moved to trash')).toBeVisible();
        await expect(row).toHaveCount(0);

        await page.locator('.files-browser__trash').click();
        await expect(row).toBeVisible();
        await page.getByRole('button', { name: `Actions for ${name}` }).click();
        await page.getByRole('menuitemradio', { name: 'Delete permanently' }).click();
        // The confirm modal has no dialog role: scope by its heading.
        await page.getByRole('heading', { name: 'Delete file permanently?' }).locator('..').getByRole('button', { name: 'Delete permanently' }).click();
        await expect(page.getByText('File deleted')).toBeVisible();
        await expect.poll(async () => (await adminList(`tenants/${TENANT}/files`)).some((file) => file.data.name === name), { timeout: 10_000 }).toBe(false);
        await page.close();
    });
});
