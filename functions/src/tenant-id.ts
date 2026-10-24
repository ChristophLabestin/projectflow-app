import * as functions from 'firebase-functions/v1';

import { db } from './init';

/**
 * Workspace and user ids are single path segments. A client-supplied id with a slash would address a
 * nested path (`tenants/OWN/users/<uid>/members/<uid>`) that the caller can write through the rules,
 * so a forged membership/policy there must never pass a server check (brain/audits/2026-10-24-security-review.md, C1).
 */
export const isValidIdSegment = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0 && value.length <= 128 && !value.includes('/') &&
    value !== '.' && value !== '..' && !/^__.*__$/.test(value) && value.trim() === value;

export const isValidTenantId = isValidIdSegment;

/** Callable guard: rejects anything that is not one plain id segment. */
export const assertValidTenantId = (value: unknown, field = 'tenantId'): string => {
    if (!isValidTenantId(value)) {
        throw new functions.https.HttpsError('invalid-argument', `${field} is invalid.`);
    }
    return value;
};

/** `tenants/{tenantId}/members/{uid}` for validated ids only. */
export const memberRef = (tenantId: string, uid: string) => {
    assertValidTenantId(tenantId);
    assertValidTenantId(uid, 'uid');
    return db.doc(`tenants/${tenantId}/members/${uid}`);
};
