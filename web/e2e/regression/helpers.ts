import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/**
 * Shared helpers for the E2E regression suite (scripts/e2e-regression.sh): sign-in, admin writes to the
 * Firestore emulator (REST with `Bearer owner` bypasses the rules) and callable calls with a real ID token.
 * Everything runs against demo-projectflow emulators seeded by scripts/seed-emulator.mjs.
 */

export const PROJECT_ID = process.env.E2E_PROJECT_ID || 'demo-projectflow';
export const FIRESTORE = `http://127.0.0.1:${process.env.E2E_FIRESTORE_PORT || '8851'}`;
export const AUTH = `http://127.0.0.1:${process.env.E2E_AUTH_PORT || '9851'}`;
export const FUNCTIONS = `http://127.0.0.1:${process.env.E2E_FUNCTIONS_PORT || '5851'}`;
export const TENANT = 'ws-demo-studio';

export const USERS = {
    owner: { email: 'demo@projectflow.test', password: 'projectflow-demo' },
    outsider: { email: 'outsider@projectflow.test', password: 'pf-outsider-e2e' },
    /** Admin in Demo Studio, Owner of ws-berger-agency (where the demo owner is a Guest). */
    anna: { email: 'anna@projectflow.test', password: 'projectflow-demo' },
    /** Member in Demo Studio. */
    luis: { email: 'luis@projectflow.test', password: 'projectflow-demo' },
};

/** A fresh context signed in through the real login form (works for the dev server and the preview build). */
export const signedInContext = async (browser: Browser, user = USERS.owner): Promise<BrowserContext> => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    const email = page.locator('input[type="email"]');
    // The preview build always shows the form; the dev server (REGRESSION_WEB=dev) signs in on its own.
    if (!process.env.E2E_AUTO_LOGIN) {
        await email.fill(user.email);
        await page.locator('input[type="password"]').fill(user.password);
        await page.locator('button[type="submit"]').click();
    }
    await acceptLegalIfShown(page);
    await expect(page.locator('.app-main-scroll')).toBeVisible({ timeout: 30_000 });
    await page.close();
    return context;
};

/** The consent gate appears when legal docs are published (E2E_LEGAL=1); accept it once per user. */
export const acceptLegalIfShown = async (page: Page) => {
    const gate = page.getByTestId('legal-consent-gate');
    const shell = page.locator('.app-main-scroll');
    await expect(gate.or(shell).first()).toBeVisible({ timeout: 30_000 });
    if (await gate.isVisible()) {
        await page.getByTestId('legal-consent-accept').click();
        await expect(gate).toHaveCount(0, { timeout: 15_000 });
    }
};

/** Ready = app shell up and no loading scene. */
export const waitForApp = async (page: Page) => {
    await expect(page.locator('.app-main-scroll')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.brand-scene')).toHaveCount(0, { timeout: 20_000 });
};

// ---- Firestore emulator admin access -------------------------------------------------------------

type Json = null | boolean | number | string | Date | Json[] | { [key: string]: Json };

const toValue = (value: Json): Record<string, unknown> => {
    if (value === null) return { nullValue: null };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    if (typeof value === 'string') return { stringValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
    return { mapValue: { fields: toFields(value) } };
};
const toFields = (obj: { [key: string]: Json }) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toValue(v)]));

const fromValue = (value: any): any => {
    if ('nullValue' in value) return null;
    if ('booleanValue' in value) return value.booleanValue;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('stringValue' in value) return value.stringValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromValue);
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, fromValue(v)]));
    return value;
};

const docUrl = (path: string) => `${FIRESTORE}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

/** Merge-writes the given fields (only these fields are touched). */
export const adminSet = async (path: string, data: { [key: string]: Json }) => {
    const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const res = await fetch(`${docUrl(path)}?${mask}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: toFields(data) }) });
    if (!res.ok) throw new Error(`adminSet ${path}: ${res.status} ${await res.text()}`);
};

/** Removes fields from a doc (field mask without values). */
export const adminUnset = async (path: string, fields: string[]) => {
    const mask = fields.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const res = await fetch(`${docUrl(path)}?${mask}`, { method: 'PATCH', headers: ADMIN, body: JSON.stringify({ fields: {} }) });
    if (!res.ok) throw new Error(`adminUnset ${path}: ${res.status} ${await res.text()}`);
};

export const adminDelete = async (path: string) => {
    const res = await fetch(docUrl(path), { method: 'DELETE', headers: ADMIN });
    if (!res.ok && res.status !== 404) throw new Error(`adminDelete ${path}: ${res.status}`);
};

export const adminGet = async (path: string): Promise<Record<string, any> | null> => {
    const res = await fetch(docUrl(path), { headers: ADMIN });
    if (res.status === 404) return null;
    const body = await res.json();
    return Object.fromEntries(Object.entries(body.fields || {}).map(([k, v]) => [k, fromValue(v)]));
};

/** Document ids + data of a collection (first 300). */
export const adminList = async (path: string): Promise<Array<{ id: string; data: Record<string, any> }>> => {
    const res = await fetch(`${docUrl(path)}?pageSize=300`, { headers: ADMIN });
    const body = await res.json();
    return (body.documents || []).map((doc: any) => ({
        id: String(doc.name).split('/').pop(),
        data: Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, fromValue(v)])),
    }));
};

// ---- Auth + callables ----------------------------------------------------------------------------

export const idToken = async (user = USERS.owner): Promise<string> => {
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password, returnSecureToken: true }),
    });
    const body = await res.json();
    if (!body.idToken) throw new Error(`sign-in failed for ${user.email}: ${JSON.stringify(body)}`);
    return body.idToken;
};

/** Calls an onCall function; returns { status, result | error }. */
export const callable = async (name: string, data: unknown, token?: string) => {
    const res = await fetch(`${FUNCTIONS}/${PROJECT_ID}/europe-west3/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ data }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, result: body.result, error: body.error };
};

/** Firestore REST as a signed-in user (rules apply). */
export const userSet = async (path: string, data: { [key: string]: Json }, token: string) => {
    const res = await fetch(docUrl(path), {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: toFields(data) }),
    });
    return res.status;
};

/** Marks a seeded account's email as verified (Auth emulator admin API). */
export const verifyEmail = async (user: { email: string; password: string }) => {
    const token = await idToken(user);
    const localId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).user_id;
    const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`, {
        method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId, emailVerified: true }),
    });
    if (!res.ok) throw new Error(`verifyEmail: ${res.status} ${await res.text()}`);
    return localId as string;
};

export const uniqueName = (prefix: string) => `${prefix} ${Date.now().toString(36)}`;
