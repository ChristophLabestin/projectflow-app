import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { adminDelete, adminGet, adminList, adminSet, callable, idToken, signedInContext, TENANT, USERS, verifyEmail, waitForApp } from './helpers';

const ENT = `tenants/${TENANT}/entitlements/plan`;
const fullMembers = async () => (await adminList(`tenants/${TENANT}/members`)).filter((m) => m.data.role !== 'Guest').length;

const openInvite = async (page: Page) => {
    await page.goto('/team');
    await waitForApp(page);
    await page.getByRole('button', { name: /^(person_add\s*)?Invite$/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
};

test.describe.serial('invites with seat limit', () => {
    let context: BrowserContext;
    let inviteId = '';
    let original: Record<string, any> | null = null;
    test.beforeAll(async ({ browser }) => {
        original = await adminGet(ENT);
        context = await signedInContext(browser);
    });
    test.afterAll(async () => {
        await context?.close();
        // Back to the seeded entitlement (other specs run on the same workspace).
        await adminDelete(ENT);
        if (original) await adminSet(ENT, original);
        await adminDelete(`tenants/${TENANT}/members/${JSON.parse(Buffer.from((await idToken(USERS.outsider)).split('.')[1], 'base64url').toString()).user_id}`);
    });

    test('owner invites by email', async () => {
        const page = await context.newPage();
        await openInvite(page);
        await page.getByPlaceholder('name@company.com').fill(USERS.outsider.email);
        await page.getByRole('button', { name: 'Send invitation' }).click();
        await expect(page.getByText('Invitation created.', { exact: false })).toBeVisible({ timeout: 15_000 });
        const invite = (await adminList(`tenants/${TENANT}/invitations`)).find((entry) => entry.data.email === USERS.outsider.email && entry.data.status === 'pending');
        expect(invite, 'pending invitation stored').toBeTruthy();
        inviteId = invite!.id;
        await page.close();
    });

    test('the invite modal blocks members at the member limit, guests stay possible', async () => {
        await adminSet(ENT, { plan: 'team', workspaceType: 'team', status: 'active', memberLimit: await fullMembers(), invitesAllowed: true, projectLimit: null });
        const page = await context.newPage();
        await openInvite(page);
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByText('the limit is reached', { exact: false })).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
        await dialog.locator('input[name="invite-role"][value="Guest"]').check({ force: true });
        await expect(dialog.getByText('the limit is reached', { exact: false })).toHaveCount(0);
        await page.close();
    });

    test('accepting is refused when all paid seats are used, allowed after adding a seat', async () => {
        const seats = await fullMembers();
        await adminSet(ENT, { plan: 'team', workspaceType: 'team', status: 'active', memberLimit: 50, invitesAllowed: true, stripeSubscriptionId: 'sub_e2e', seats, billingExempt: false });
        await verifyEmail(USERS.outsider);
        const token = await idToken(USERS.outsider);
        const refused = await callable('acceptWorkspaceInvite', { tenantId: TENANT, inviteId }, token);
        expect(refused.error?.message).toBe('plan-seat-limit');

        await adminSet(ENT, { seats: seats + 1 });
        const accepted = await callable('acceptWorkspaceInvite', { tenantId: TENANT, inviteId }, token);
        expect(accepted.error, JSON.stringify(accepted.error)).toBeUndefined();
        expect(await fullMembers()).toBe(seats + 1);
    });
});
