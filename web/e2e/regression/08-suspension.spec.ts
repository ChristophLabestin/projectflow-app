import { expect, test } from '@playwright/test';

import { adminSet, adminUnset, FIRESTORE, idToken, PROJECT_ID, signedInContext, TENANT, USERS } from './helpers';

/** Admin-console suspension (`tenants/{id}.suspendedAt`): the app shows the gate and the server refuses. */
test.describe.serial('workspace suspension', () => {
    test.afterAll(async () => {
        await adminUnset(`tenants/${TENANT}`, ['suspendedAt', 'suspendedReason', 'suspendedBy']);
    });

    test('a suspended workspace is locked in the app and on the server', async ({ browser }) => {
        const context = await signedInContext(browser);
        await adminSet(`tenants/${TENANT}`, { suspendedAt: new Date(), suspendedReason: 'E2E regression', suspendedBy: 'e2e' });
        const page = await context.newPage();
        await page.goto('/');
        const gate = page.locator('.workspace-gate');
        await expect(gate).toBeVisible({ timeout: 20_000 });
        await expect(gate.locator('.workspace-gate__title')).toContainText('is suspended');
        await expect(page.locator('.app-main-scroll')).toHaveCount(0);

        // The rules close direct reads too (server paths follow within the 60 s status cache).
        const res = await fetch(`${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/${TENANT}/projects/p-website`, {
            headers: { Authorization: `Bearer ${await idToken(USERS.owner)}` },
        });
        expect(res.status).toBe(403);
        await context.close();
    });
});
