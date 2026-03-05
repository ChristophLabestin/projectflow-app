import { test, expect } from '@playwright/test';

test('requires authentication to access finance page', async ({ page }) => {
    await page.goto('/finance');
    await expect(page).toHaveURL(/\/login/);
});

test('requires authentication to access calculations view in finance', async ({ page }) => {
    await page.goto('/finance?view=calculations');
    await expect(page).toHaveURL(/\/login/);
});
