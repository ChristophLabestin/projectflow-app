import { expect, test, type BrowserContext } from '@playwright/test';

import { signedInContext, uniqueName, waitForApp } from './helpers';

test.describe.serial('wiki: create, edit, link', () => {
    let context: BrowserContext;
    test.beforeAll(async ({ browser }) => { context = await signedInContext(browser); });
    test.afterAll(async () => { await context?.close(); });

    const target = uniqueName('E2E target page');
    const source = uniqueName('E2E source page');

    const newPage = async (page: import('@playwright/test').Page, title: string, body: string) => {
        await page.goto('/wiki');
        await waitForApp(page);
        await page.getByRole('button', { name: 'New page' }).first().click();
        await expect(page).toHaveURL(/\/wiki\/[^/]+$/, { timeout: 15_000 });
        const titleField = page.getByRole('textbox', { name: 'Page title' });
        await titleField.fill(title);
        const prose = page.locator('.wiki-prose[contenteditable="true"]');
        await prose.click();
        await page.keyboard.type(body);
        await expect(page.locator('.wiki-save.is-saved')).toHaveText('Saved', { timeout: 20_000 });
    };

    test('create a page and edit its body (autosave)', async () => {
        const page = await context.newPage();
        await newPage(page, target, 'First version of the target page. ');
        await page.keyboard.type('Edited afterwards.');
        await expect(page.locator('.wiki-save.is-saved')).toHaveText('Saved', { timeout: 20_000 });
        await page.reload();
        await waitForApp(page);
        await expect(page.locator('.wiki-prose')).toContainText('Edited afterwards.', { timeout: 15_000 });
        await page.close();
    });

    test('link to the first page with an @-mention', async () => {
        const page = await context.newPage();
        await newPage(page, source, 'See ');
        await page.keyboard.type(`@${target.split(' ').slice(0, 3).join(' ')}`);
        const suggest = page.locator('.wiki-suggest');
        await expect(suggest.getByRole('option', { name: new RegExp(target) })).toBeVisible({ timeout: 15_000 });
        await suggest.getByRole('option', { name: new RegExp(target) }).click();
        const chip = page.locator('.wiki-mention--doc');
        await expect(chip).toContainText(target);
        await expect(page.locator('.wiki-save.is-saved')).toHaveText('Saved', { timeout: 20_000 });
        await chip.click();
        await expect(page.getByRole('textbox', { name: 'Page title' })).toHaveValue(target, { timeout: 15_000 });
        await page.close();
    });
});
