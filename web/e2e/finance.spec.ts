import { test, expect } from '@playwright/test';

test('requires authentication to access finance page', async ({ page }) => {
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/login/);
});
