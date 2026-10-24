// Unit tests of the pure Forms server helpers (src/forms-helpers.ts): session tokens, spam heuristic,
// IP hashing and the defensive sanitizers. Contract: brain/plans/forms-api-contract.md.
const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('../../lib/forms-helpers');

const SECRET = 'unit-test-secret';
const NOW = 1_800_000_000_000;

test('session token: sign and verify roundtrip', () => {
    const session = h.signFormSession(SECRET, 'tok123', NOW, 'nonce1');
    assert.match(session, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const check = h.verifyFormSession(SECRET, session, 'tok123', NOW + 5000, { minAgeMs: 3000 });
    assert.deepEqual(check, { ok: true, iat: NOW, nonce: 'nonce1' });
});

test('session token: too fast, expired, wrong token, wrong secret', () => {
    const session = h.signFormSession(SECRET, 'tok123', NOW, 'n');
    assert.equal(h.verifyFormSession(SECRET, session, 'tok123', NOW + 1000, { minAgeMs: 3000 }).reason, 'too-fast');
    assert.equal(h.verifyFormSession(SECRET, session, 'tok123', NOW + h.SESSION_MAX_AGE_MS + 1).reason, 'expired');
    assert.equal(h.verifyFormSession(SECRET, session, 'tok123', NOW + h.SESSION_MAX_AGE_MS - 1).ok, true);
    assert.equal(h.verifyFormSession(SECRET, session, 'other', NOW + 5000).reason, 'token');
    assert.equal(h.verifyFormSession('another-secret', session, 'tok123', NOW + 5000).reason, 'signature');
});

test('session token: tampered payload or signature, garbage input', () => {
    const session = h.signFormSession(SECRET, 'tok123', NOW, 'n');
    const [payload, sig] = session.split('.');
    const forged = Buffer.from(JSON.stringify({ tok: 'tok123', iat: NOW + 999999999, n: 'n' })).toString('base64url');
    assert.equal(h.verifyFormSession(SECRET, `${forged}.${sig}`, 'tok123', NOW + 5000).reason, 'signature');
    assert.equal(h.verifyFormSession(SECRET, `${payload}.${sig.slice(0, -2)}xx`, 'tok123', NOW + 5000).reason, 'signature');
    for (const bad of [undefined, null, 12, '', 'abc', 'a.b.c', `${payload}.`, 'x'.repeat(700)]) {
        assert.equal(h.verifyFormSession(SECRET, bad, 'tok123', NOW).ok, false);
    }
});

test('session token: issue time in the future is rejected', () => {
    const session = h.signFormSession(SECRET, 't', NOW + 10 * 60000, 'n');
    assert.equal(h.verifyFormSession(SECRET, session, 't', NOW).ok, false);
});

test('ip hash: stable per day and salt, differs across days and ips', () => {
    const salt = h.dailySalt(SECRET, NOW);
    assert.equal(h.hashIp(salt, '1.2.3.4'), h.hashIp(salt, '1.2.3.4'));
    assert.notEqual(h.hashIp(salt, '1.2.3.4'), h.hashIp(salt, '1.2.3.5'));
    assert.notEqual(salt, h.dailySalt(SECRET, NOW + 24 * 3600 * 1000));
    assert.equal(salt, h.dailySalt(SECRET, NOW + 60 * 1000));
    assert.doesNotMatch(h.hashIp(salt, '1.2.3.4'), /1\.2\.3\.4/);
});

test('respondent key is per form and uid', () => {
    assert.equal(h.respondentKey(SECRET, 'f1', 'u1'), h.respondentKey(SECRET, 'f1', 'u1'));
    assert.notEqual(h.respondentKey(SECRET, 'f1', 'u1'), h.respondentKey(SECRET, 'f2', 'u1'));
    assert.notEqual(h.respondentKey(SECRET, 'f1', 'u1'), h.respondentKey(SECRET, 'f1', 'u2'));
});

const schema = {
    sections: [{ id: 's' }],
    fields: [
        { id: 'a', sectionId: 's', type: 'longText', label: 'A' },
        { id: 'b', sectionId: 's', type: 'shortText', label: 'B' },
        { id: 'c', sectionId: 's', type: 'singleChoice', label: 'C', options: [{ id: 'o', label: 'O' }], allowOther: true },
        { id: 'e', sectionId: 's', type: 'email', label: 'E' }
    ]
};

test('spam heuristic: more than 3 links in free text', () => {
    assert.equal(h.countLinks('see https://a.de and www.b.de, http://c.de'), 3);
    assert.equal(h.hasTooManyLinks(schema, { a: 'https://a.de https://b.de https://c.de' }), false);
    assert.equal(h.hasTooManyLinks(schema, { a: 'https://a.de https://b.de https://c.de', b: 'http://d.de' }), true);
    assert.equal(h.hasTooManyLinks(schema, { a: 'x', c: { selected: [], other: 'https://1.de https://2.de https://3.de https://4.de' } }), true);
    // Email addresses are not links.
    assert.equal(h.hasTooManyLinks(schema, { e: 'a@b.de http://x.de http://y.de http://z.de http://w.de' }), false);
});

test('content hash: key order independent, content sensitive', () => {
    assert.equal(h.contentHash({ a: 'x', b: 'y' }), h.contentHash({ b: 'y', a: 'x' }));
    assert.notEqual(h.contentHash({ a: 'x' }), h.contentHash({ a: 'y' }));
    assert.equal(h.contentHash({ f: [{ fileId: '1', name: 'n', size: 3 }] }), h.contentHash({ f: [{ fileId: '2', name: 'n', size: 3 }] }));
});

test('sanitizeSchema: known keys only, trimmed, unknown types dropped', () => {
    const out = h.sanitizeSchema({
        evil: 1,
        sections: [{ id: 's 1!', title: '  Titel  ', foo: 'bar' }, 'nope'],
        fields: [
            { id: 'f1', sectionId: 's1', type: 'shortText', label: '  Name ', required: true, junk: 1, maxLength: 99999 },
            { id: 'f2', sectionId: 's1', type: 'bogus', label: 'x' },
            { id: 'f3', sectionId: 's1', type: 'singleChoice', label: 'Wahl', options: [{ id: 'o1', label: ' A ' }, { label: 'B' }], allowOther: true, maxLength: 5 },
            { id: 'f4', sectionId: 's1', type: 'email', label: 'Mail', isRespondentEmail: true },
            { id: 'f5', sectionId: 's1', type: 'email', label: 'Mail 2', isRespondentEmail: true },
            { id: 'f6', sectionId: 's1', type: 'consent', label: 'ok', consentUrl: 'javascript:alert(1)' }
        ]
    });
    assert.deepEqual(Object.keys(out), ['sections', 'fields']);
    assert.deepEqual(out.sections, [{ id: 's1', title: 'Titel' }]);
    assert.equal(out.fields.length, 5);
    assert.equal(out.fields[0].label, 'Name');
    assert.equal(out.fields[0].required, true);
    assert.equal(out.fields[0].maxLength, 500);
    assert.equal(out.fields[0].junk, undefined);
    assert.equal(out.fields[1].maxLength, undefined);
    assert.equal(out.fields[1].options[0].label, 'A');
    assert.ok(out.fields[1].options[1].id);
    assert.equal(out.fields[2].isRespondentEmail, true);
    assert.equal(out.fields[3].isRespondentEmail, undefined);
    assert.equal(out.fields[4].consentUrl, undefined);
});

test('sanitizeSchema: counts are cut one above the limit so validation still reports them', () => {
    const fields = Array.from({ length: 200 }, (_, i) => ({ id: `f${i}`, sectionId: 's', type: 'shortText', label: 'x' }));
    const out = h.sanitizeSchema({ sections: [{ id: 's' }], fields });
    assert.equal(out.fields.length, 101);
    assert.deepEqual(h.sanitizeSchema(null), { sections: [], fields: [] });
    assert.deepEqual(h.sanitizeSchema('x'), { sections: [], fields: [] });
});

test('sanitizeCondition: scalar values only, empty rules mean no condition', () => {
    assert.equal(h.sanitizeCondition({ mode: 'any', rules: [] }), null);
    assert.equal(h.sanitizeCondition('x'), null);
    const out = h.sanitizeCondition({ mode: 'weird', rules: [{ fieldId: 'a b', op: 'equals', value: { x: 1 } }, { fieldId: 'c', op: 'gt', value: 3 }] });
    assert.equal(out.mode, 'all');
    assert.equal(out.rules[0].fieldId, 'ab');
    assert.equal(out.rules[0].value, null);
    assert.equal(out.rules[1].value, 3);
});

const scope = { tenantId: 't1', formId: 'f1' };

test('sanitizeTheme: without full theme only the preset survives', () => {
    assert.deepEqual(h.sanitizeTheme({ preset: 'forest', accent: '#ff0000', font: 'inter' }, { fullTheme: false }, scope), { preset: 'forest' });
    assert.deepEqual(h.sanitizeTheme({ preset: 'nope' }, { fullTheme: false }, scope), { preset: 'projectflow-light' });
    assert.deepEqual(h.sanitizeTheme({ preset: 'nope' }, { fullTheme: false }, scope, { preset: 'ocean' }), { preset: 'ocean' });
});

test('sanitizeTheme: full theme validates colors, font, radius and asset paths', () => {
    const out = h.sanitizeTheme({
        preset: 'paper', accent: '#ABCDEF', text: 'red', surface: 'url(javascript:1)', font: 'comic-sans', radius: 7, fieldStyle: 'x',
        background: { type: 'image', imagePath: 'public/forms/t1/f1/assets/background-abc.png', color: '#112233' },
        logoPath: 'public/forms/t1/f1/assets/logo-1.png',
        coverPath: 'public/forms/other/f1/assets/cover.png'
    }, { fullTheme: true }, scope);
    assert.equal(out.accent, '#abcdef');
    assert.equal(out.text, '#18181b');
    assert.equal(out.surface, '#ffffff');
    assert.equal(out.font, 'plus-jakarta-sans');
    assert.equal(out.radius, 16);
    assert.equal(out.fieldStyle, 'sunken');
    assert.equal(out.background.imagePath, 'public/forms/t1/f1/assets/background-abc.png');
    assert.equal(out.logoPath, 'public/forms/t1/f1/assets/logo-1.png');
    assert.equal(out.coverPath, undefined);
    const bad = h.sanitizeTheme({ background: { type: 'image', imagePath: 'public/forms/t1/f1/assets/../../x.png' } }, { fullTheme: true }, scope);
    assert.equal(bad.background.type, 'color');
    for (const font of h.FORM_FONTS) assert.equal(h.sanitizeTheme({ font }, { fullTheme: true }, scope).font, font);
});

test('sanitizeSettings: defaults, retention whitelist, https-only urls, branding gate', () => {
    const base = h.defaultSettings('owner1');
    assert.equal(base.retentionMonths, 12);
    const out = h.sanitizeSettings({
        closesAt: 123456, maxResponses: 0, retentionMonths: 7, hideBranding: true, unknown: 1,
        confirmation: { text: ' Danke ', redirectUrl: 'http://insecure.example' },
        consent: { text: 'Ich stimme zu', url: 'https://example.com/p' },
        notifyMemberIds: ['a', 5, ' b '], aiTriage: { enabled: true, categories: ['x', '', 3] }
    }, base, { removeBranding: false });
    assert.equal(out.closesAt, 123456);
    assert.equal(out.maxResponses, null);
    assert.equal(out.retentionMonths, 12);
    assert.equal(out.hideBranding, false);
    assert.deepEqual(out.confirmation, { text: 'Danke' });
    assert.deepEqual(out.consent, { text: 'Ich stimme zu', url: 'https://example.com/p' });
    assert.deepEqual(out.notifyMemberIds, ['a', 'b']);
    assert.deepEqual(out.aiTriage, { enabled: true, categories: ['x'] });
    assert.equal(out.unknown, undefined);
    assert.equal(h.sanitizeSettings({ hideBranding: true }, base, { removeBranding: true }).hideBranding, true);
    assert.equal(h.sanitizeSettings({ retentionMonths: null }, base, { removeBranding: true }).retentionMonths, null);
    assert.equal(h.sanitizeSettings({ retentionMonths: 24 }, base, { removeBranding: true }).retentionMonths, 24);
    // A patch without a key keeps the current value.
    assert.equal(h.sanitizeSettings({}, { ...base, maxResponses: 50 }, { removeBranding: true }).maxResponses, 50);
});

test('sanitizeOrigins: https origins and localhost only, deduped', () => {
    assert.deepEqual(h.sanitizeOrigins(['https://a.de/path', 'https://a.de', 'http://evil.de', 'http://localhost:3000', 'javascript:1', 5]),
        ['https://a.de', 'http://localhost:3000']);
    assert.deepEqual(h.sanitizeOrigins('x'), []);
});

test('compact removes undefined recursively', () => {
    assert.deepEqual(h.compact({ a: 1, b: undefined, c: { d: undefined, e: [1, undefined, { f: undefined }] }, g: null }), { a: 1, c: { e: [1, {}] }, g: null });
});

test('sanitizeActions: needs a project id', () => {
    assert.deepEqual(h.sanitizeActions({ createTask: { mapping: { title: 'x' } } }), {});
    const out = h.sanitizeActions({ createTask: { projectId: 'p1', mapping: { title: 'T', description: ['a', 2] }, defaults: { priority: 'High' } } });
    assert.equal(out.createTask.projectId, 'p1');
    assert.deepEqual(out.createTask.mapping.description, ['a']);
});
