import { expect, test } from '@playwright/test';

import { adminDelete, adminGet, adminSet, callable, FUNCTIONS, idToken, PROJECT_ID, USERS, userSet } from './helpers';

/** API-level regressions for brain/audits/2026-10-24-security-review.md (C1, H1, H3, H4). */
test.describe('security regressions', () => {
    test('C1: aiAssist rejects a path-injected tenantId', async () => {
        const token = await idToken(USERS.outsider);
        const res = await fetch(`${FUNCTIONS}/${PROJECT_ID}/europe-west3/aiAssist`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ capability: 'write', tenantId: 'ws-demo-studio/users/x', input: { action: 'improve', text: 'x' } }),
        });
        expect(res.status).toBe(400);
    });

    test('C1: callables treat a nested tenant path as no access', async () => {
        const token = await idToken(USERS.owner);
        const res = await callable('getWorkspaceFileQuota', { tenantId: 'ws-demo-studio/users/demo-owner' }, token);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    test('H1: a guest does not list files of projects they are not on', async () => {
        // Demo owner is a Guest in ws-berger-agency and not on p-internal.
        const hidden = 'tenants/ws-berger-agency/files/e2e-hidden';
        await adminSet(hidden, {
            tenantId: 'ws-berger-agency', module: 'files', listed: true, status: 'ready', projectId: 'p-internal',
            name: 'internal-budget.pdf', fileName: 'internal-budget.pdf', mimeType: 'application/pdf', sizeBytes: 10,
            provider: 'firebase', providerRef: { firebasePath: 'tenants/ws-berger-agency/files/files/p-internal/x/y/z.pdf' },
            createdAt: new Date(),
        });
        try {
            const res = await callable('listTenantFiles', { tenantId: 'ws-berger-agency' }, await idToken(USERS.owner));
            expect(res.status).toBe(200);
            expect((res.result.files as Array<{ id: string }>).map((file) => file.id)).not.toContain('e2e-hidden');
        } finally {
            await adminDelete(hidden);
        }
    });

    test('H3: clients cannot create workspaces (no forged createdAt / trial)', async () => {
        // Since 2026-10-24 workspaces are created only by Cloud Functions (createTeamWorkspace etc.), so a forged
        // createdAt cannot reach onTenantCreatedBilling at all.
        const token = await idToken(USERS.outsider);
        const tenantId = `e2e-trial-${Date.now().toString(36)}`;
        const uid = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).user_id;
        const status = await userSet(`tenants/${tenantId}`, {
            tenantId, name: 'Forged trial', ownerId: uid, createdBy: uid, createdAt: new Date('2099-01-01T00:00:00Z'),
        }, token);
        expect(status).toBe(403);
        expect(await adminGet(`tenants/${tenantId}`)).toBeFalsy();
    });

    test('H4: a workspace admin cannot raise tenant limits', async () => {
        const token = await idToken(USERS.anna);
        const res = await fetch(`http://127.0.0.1:${process.env.E2E_FIRESTORE_PORT || '8851'}/v1/projects/${PROJECT_ID}/databases/(default)/documents/tenants/ws-demo-studio?updateMask.fieldPaths=limits`, {
            method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { limits: { mapValue: { fields: { automations: { mapValue: { fields: { runsPerMonth: { integerValue: '1000000000' } } } } } } } } }),
        });
        expect(res.status).toBe(403);
    });
});
