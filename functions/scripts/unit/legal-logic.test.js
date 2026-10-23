// Unit tests: legal document gate evaluation, draft validation, mail copy + recipient filter.
const test = require('node:test');
const assert = require('node:assert/strict');
const legal = require('../../lib/legal-logic');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00Z');
const v = (version, changeType, effectiveOffsetDays = -10) => ({
    version, changeType, effectiveAtMs: NOW + effectiveOffsetDays * DAY, publishedAtMs: NOW - 20 * DAY,
    summary: { de: `Änderung ${version}`, en: `Change ${version}` },
});
const docs = (terms, privacy = [v(1, 'requiresAcceptance')]) => [
    { type: 'privacy', versions: privacy },
    { type: 'terms', versions: terms },
    { type: 'imprint', versions: [v(1, 'notifyOnly')] },
];

test('no published versions → no gate', () => {
    assert.deepEqual(legal.evaluateGate(docs([], []), null, NOW), { blocking: [], notices: [] });
});

test('never accepted → blocking initial consent (also when v1 is notifyOnly), imprint never gates', () => {
    const gate = legal.evaluateGate(docs([v(1, 'notifyOnly')]), null, NOW);
    assert.deepEqual(gate.blocking.map((item) => [item.type, item.version, item.acceptedVersion]), [['privacy', 1, null], ['terms', 1, null]]);
    assert.equal(gate.notices.length, 0);
});

test('accepted current version → nothing', () => {
    const gate = legal.evaluateGate(docs([v(1, 'requiresAcceptance')]), { privacy: { version: 1 }, terms: { version: 1 } }, NOW);
    assert.deepEqual(gate, { blocking: [], notices: [] });
});

test('requiresAcceptance change → blocking with changes newest first', () => {
    const gate = legal.evaluateGate(docs([v(1, 'requiresAcceptance'), v(2, 'notifyOnly'), v(3, 'requiresAcceptance')]), { privacy: { version: 1 }, terms: { version: 1 } }, NOW);
    assert.equal(gate.blocking.length, 1);
    assert.equal(gate.blocking[0].version, 3);
    assert.equal(gate.blocking[0].acceptedVersion, 1);
    assert.deepEqual(gate.blocking[0].changes.map((c) => c.version), [3, 2]);
});

test('only notifyOnly changes since acceptance → notice, not blocking', () => {
    const gate = legal.evaluateGate(docs([v(1, 'requiresAcceptance'), v(2, 'notifyOnly')]), { privacy: { version: 1 }, terms: { version: 1 } }, NOW);
    assert.equal(gate.blocking.length, 0);
    assert.deepEqual(gate.notices.map((item) => [item.type, item.version]), [['terms', 2]]);
});

test('future effectiveAt does not gate until it is effective', () => {
    const versions = [v(1, 'requiresAcceptance'), v(2, 'requiresAcceptance', 5)];
    const accepted = { privacy: { version: 1 }, terms: { version: 1 } };
    assert.equal(legal.evaluateGate(docs(versions), accepted, NOW).blocking.length, 0);
    const later = legal.evaluateGate(docs(versions), accepted, NOW + 6 * DAY);
    assert.deepEqual(later.blocking.map((item) => item.version), [2]);
    assert.equal(legal.currentEffective(versions, NOW).version, 1);
});

test('normalizeDraft validates and forces imprint to notifyOnly without mail', () => {
    const base = { title: { de: 'T', en: 'T' }, content: { de: '# A', en: '# A' }, summary: { de: '', en: '' } };
    assert.throws(() => legal.normalizeDraft({ ...base, type: 'cookies', changeType: 'notifyOnly' }), /type/);
    assert.throws(() => legal.normalizeDraft({ ...base, type: 'terms', changeType: 'maybe' }), /changeType/);
    assert.throws(() => legal.normalizeDraft({ ...base, type: 'terms', changeType: 'notifyOnly', content: { de: 'x', en: '' } }), /content.en/);
    assert.throws(() => legal.normalizeDraft({ ...base, type: 'terms', changeType: 'notifyOnly', effectiveAt: 'soon' }), /effectiveAt/);
    const imprint = legal.normalizeDraft({ ...base, type: 'imprint', changeType: 'requiresAcceptance', notifyByEmail: true });
    assert.equal(imprint.changeType, 'notifyOnly');
    assert.equal(imprint.notifyByEmail, false);
    const terms = legal.normalizeDraft({ ...base, type: 'terms', changeType: 'requiresAcceptance', effectiveAt: '2026-11-01T00:00:00Z' });
    assert.equal(terms.notifyByEmail, true);
    assert.equal(terms.effectiveAtMs, Date.parse('2026-11-01T00:00:00Z'));
    assert.equal(legal.normalizeDraft({ ...base, type: 'privacy', changeType: 'notifyOnly' }).notifyByEmail, false);
    assert.equal(legal.normalizeDraft({ ...base, type: 'privacy', changeType: 'notifyOnly', notifyByEmail: true }).notifyByEmail, true);
});

test('buildLegalMail localizes, escapes the summary and links document + app', () => {
    const input = { type: 'terms', version: 2, changeType: 'requiresAcceptance', summary: { de: 'Neu <b>x</b>', en: 'New' }, effectiveAtMs: Date.parse('2026-11-01T10:00:00Z') };
    const de = legal.buildLegalMail(input, 'de');
    assert.equal(de.subject, 'Aktualisierung: Nutzungsbedingungen');
    assert.match(de.bodyHtml, /Neu &lt;b&gt;x&lt;\/b&gt;/);
    assert.match(de.bodyHtml, /1\. November 2026/);
    assert.match(de.bodyHtml, /legal\/terms\?v=2/);
    assert.equal(de.actionLink, 'https://app.getprojectflow.com');
    const en = legal.buildLegalMail({ ...input, changeType: 'notifyOnly' }, 'en');
    assert.match(en.bodyHtml, /No action is required/);
});

test('shouldMailUser skips missing addresses, deleted users and users who already accepted', () => {
    assert.equal(legal.shouldMailUser({ email: 'a@b.de' }, 1, 2), true);
    assert.equal(legal.shouldMailUser({ email: 'a@b.de' }, 2, 2), false);
    assert.equal(legal.shouldMailUser({}, 0, 2), false);
    assert.equal(legal.shouldMailUser({ email: 'a@b.de', deleted: true }, 0, 2), false);
    assert.equal(legal.resolveLang('de-DE'), 'de');
    assert.equal(legal.resolveLang(undefined), 'en');
});

test('machineAccessBlock: blocks only after the grace period of the triggering version', () => {
    const accepted = { privacy: { version: 1 }, terms: { version: 1 } };
    const terms = [v(1, 'requiresAcceptance'), { ...v(2, 'requiresAcceptance', -3), machineGraceDays: 14 }];
    assert.equal(legal.machineAccessBlock(docs(terms), accepted, NOW), null, 'still in grace');
    const later = legal.machineAccessBlock(docs(terms), accepted, NOW + 12 * DAY);
    assert.deepEqual([later.type, later.version], ['terms', 2]);
    assert.equal(later.blockedSinceMs, NOW + 11 * DAY);
    const custom = [v(1, 'requiresAcceptance'), { ...v(2, 'requiresAcceptance', -3), machineGraceDays: 0 }];
    assert.equal(legal.machineAccessBlock(docs(custom), accepted, NOW).version, 2);
    // notifyOnly changes never block machine access
    assert.equal(legal.machineAccessBlock(docs([v(1, 'requiresAcceptance'), v(2, 'notifyOnly', -30)]), accepted, NOW), null);
    // never accepted: grace counts from the oldest version (default 14 days)
    assert.equal(legal.machineAccessBlock(docs([v(1, 'requiresAcceptance', -10)], [v(1, 'requiresAcceptance', -10)]), {}, NOW), null);
    assert.equal(legal.machineAccessBlock(docs([v(1, 'requiresAcceptance', -15)], [v(1, 'requiresAcceptance', -15)]), {}, NOW).type, 'privacy');
    assert.equal(legal.normalizeDraft({ type: 'terms', changeType: 'notifyOnly', title: { de: 'T', en: 'T' }, content: { de: 'x', en: 'x' }, summary: {} }).machineGraceDays, 14);
    assert.throws(() => legal.normalizeDraft({ type: 'terms', changeType: 'notifyOnly', title: { de: 'T', en: 'T' }, content: { de: 'x', en: 'x' }, machineGraceDays: -1 }), /machineGraceDays/);
});
