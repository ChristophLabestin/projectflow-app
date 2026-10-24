// Unit tests: platform waitlist/newsletter logic (functions/src/platform-newsletter/logic.ts).
const test = require('node:test');
const assert = require('node:assert/strict');
const n = require('../../lib/platform-newsletter/logic');
const emailLogic = require('../../lib/email-logic');

test('emails are normalized and validated', () => {
    assert.equal(n.parseEmail('  Max@Example.COM '), 'max@example.com');
    assert.equal(n.parseEmail('no-at-sign'), null);
    assert.equal(n.parseEmail('a@b'), null);
    assert.equal(n.parseEmail('a"b@example.com'), null);
    assert.equal(n.parseEmail(`${'x'.repeat(250)}@example.com`), null);
    assert.equal(n.parseEmail(42), null);
});

test('subscriber id equals the suppression id (one hash per address)', () => {
    assert.equal(n.subscriberId('Max@Example.com'), emailLogic.suppressionId('max@example.com'));
    assert.match(n.subscriberId('max@example.com'), /^[0-9a-f]{40}$/);
});

test('bot heuristics: honeypot and too-fast submit', () => {
    const now = 1_000_000;
    assert.equal(n.looksLikeBot({ website: 'http://spam' }, now), true);
    assert.equal(n.looksLikeBot({ startedAt: now - 500 }, now), true);
    assert.equal(n.looksLikeBot({ startedAt: now - 5000, website: '' }, now), false);
    assert.equal(n.looksLikeBot({}, now), false);
});

test('tokens are random and stored only as hash', () => {
    const a = n.newToken();
    assert.notEqual(a, n.newToken());
    assert.ok(a.length >= 32);
    assert.equal(n.tokenId(a), n.tokenId(a));
    assert.notEqual(n.tokenId(a), a);
});

test('consent record carries version and text hash per list + language', () => {
    const de = n.consentRecord('newsletter', 'de');
    const en = n.consentRecord('newsletter', 'en');
    assert.match(de.consentVersion, /^newsletter-\d{4}-\d{2}-\d{2}-de$/);
    assert.notEqual(de.consentHash, en.consentHash);
    assert.notEqual(n.consentRecord('waitlist', 'de').consentHash, de.consentHash);
});

test('confirm URL points to the landing confirm page per language', () => {
    assert.equal(n.confirmUrl('abc', 'de'), 'https://getprojectflow.com/bestaetigen?t=abc');
    assert.equal(n.confirmUrl('a b', 'en', 'http://localhost:3161'), 'http://localhost:3161/en/confirm?t=a%20b');
});

test('aggregate status prefers confirmed, then pending', () => {
    assert.equal(n.aggregateStatus({ waitlist: { status: 'unsubscribed' }, newsletter: { status: 'confirmed' } }), 'confirmed');
    assert.equal(n.aggregateStatus({ waitlist: { status: 'pending' }, newsletter: { status: 'bounced' } }), 'pending');
    assert.equal(n.aggregateStatus({ newsletter: { status: 'unsubscribed' } }), 'unsubscribed');
});

test('audience matching: list confirmed + optional filters', () => {
    const sub = { email: 'a@b.de', lang: 'de', uid: 'u1', lists: { newsletter: { status: 'confirmed', source: 'app' }, waitlist: { status: 'pending' } } };
    assert.equal(n.matchesAudience(sub, n.normalizeAudience({ list: 'newsletter' })), true);
    assert.equal(n.matchesAudience(sub, n.normalizeAudience({ list: 'waitlist' })), false);
    assert.equal(n.matchesAudience(sub, n.normalizeAudience({ list: 'newsletter', lang: 'en' })), false);
    assert.equal(n.matchesAudience({ ...sub, uid: null }, n.normalizeAudience({ list: 'newsletter', appUsersOnly: true })), false);
    assert.equal(n.matchesAudience(sub, n.normalizeAudience({ list: 'newsletter', source: 'landing' })), false);
    assert.deepEqual(n.normalizeAudience({ list: 'bogus', lang: 'fr' }), { list: 'newsletter', lang: null, appUsersOnly: false, source: null });
});

test('campaign input needs the default language variant; ready check finds gaps', () => {
    assert.throws(() => n.normalizeCampaignInput({ defaultLang: 'de', variants: { en: { subject: 'Hi', markdown: 'x' } } }), n.CampaignInputError);
    const c = n.normalizeCampaignInput({ variants: { de: { subject: ' Hallo ', preheader: 'p', markdown: '# Hi' }, en: { subject: 'Hello', markdown: '' } } });
    assert.equal(c.defaultLang, 'de');
    assert.equal(c.title, 'Hallo');
    assert.deepEqual(n.campaignReadyErrors(c), ['en: content missing']);
    assert.equal(n.variantFor(c, 'en').lang, 'en');
    assert.equal(n.variantFor({ ...c, variants: { de: c.variants.de } }, 'en').lang, 'de');
});

test('markdown renders a safe subset and escapes HTML', () => {
    const html = n.renderMarkdown('# Titel\n\nHallo **Welt** und *du*.\nZeile 2\n\n- eins\n- zwei\n\n1. a\n\n---\n\n[[Jetzt testen]](https://app.getprojectflow.com/?a=1&b=2)\n\n[Link](https://x.de) <script>alert(1)</script> [bad](javascript:alert(1))');
    assert.match(html, /<h1[^>]*>Titel<\/h1>/);
    assert.match(html, /<strong>Welt<\/strong>/);
    assert.match(html, /<em>du<\/em>/);
    assert.match(html, /Welt<\/strong> und <em>du<\/em>\.<br>Zeile 2/);
    assert.match(html, /<ul[^>]*><li>eins<\/li><li>zwei<\/li><\/ul>/);
    assert.match(html, /<ol[^>]*><li>a<\/li><\/ol>/);
    assert.match(html, /<hr/);
    assert.match(html, /<a href="https:\/\/app\.getprojectflow\.com\/\?a=1&amp;b=2" style="display:inline-block;[^"]*">Jetzt testen<\/a>/);
    assert.match(html, /<a href="https:\/\/x\.de"/);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!/href="javascript/.test(html));
});

test('placeholders: name escaped, fallback when empty, raw for subjects', () => {
    assert.equal(n.applyPlaceholders('Hallo {{name|du}}!', { name: '' }), 'Hallo du!');
    assert.equal(n.applyPlaceholders('Hallo {{ name }}!', { name: '<b>Max</b>' }), 'Hallo &lt;b&gt;Max&lt;/b&gt;!');
    assert.equal(n.applyPlaceholders('Hi {{name}} & co', { name: 'A&B' }, false), 'Hi A&B & co');
});

test('newsletter mail has preheader, unsubscribe link, reason and imprint', () => {
    const html = n.newsletterEmailHtml({ subject: 'S <1>', preheader: 'Vorschau', bodyHtml: '<p>x</p>', lang: 'de', list: 'waitlist', unsubscribeUrl: 'https://u.example/?t=a&b' });
    assert.ok(html.includes('Vorschau'));
    assert.ok(html.includes('href="https://u.example/?t=a&amp;b"'));
    assert.ok(html.includes('Abmelden'));
    assert.ok(html.includes('Warteliste'));
    assert.ok(html.includes('84082 Laberweinting'));
    assert.ok(html.includes('S &lt;1&gt;'));
});

test('daily quota resets per UTC day', () => {
    const now = Date.parse('2026-10-24T12:00:00Z');
    assert.equal(n.remainingDailyQuota({ day: '2026-10-24', count: 140 }, 150, now), 10);
    assert.equal(n.remainingDailyQuota({ day: '2026-10-23', count: 150 }, 150, now), 150);
    assert.equal(n.remainingDailyQuota({ day: '2026-10-24', count: 200 }, 150, now), 0);
});

test('SES events expose the campaign tag; newsletter unsubscribe tokens verify', () => {
    const ev = emailLogic.parseSesEvent({ eventType: 'Delivery', mail: { messageId: 'm', destination: ['a@b.de'], tags: { type: ['newsletter'], campaign: ['c123'] } } });
    assert.equal(ev.campaignId, 'c123');
    assert.equal(ev.mailType, 'newsletter');
    const token = emailLogic.signUnsubscribeToken('k'.repeat(40), 'sub-id', 'newsletter:newsletter:c123');
    assert.deepEqual(emailLogic.verifyUnsubscribeToken('k'.repeat(40), token), { subject: 'sub-id', scope: 'newsletter:newsletter:c123' });
});

test('masked email keeps domain', () => {
    assert.equal(n.maskEmail('maximilian@example.com'), 'ma••••••@example.com');
    assert.equal(n.maskEmail('ab@x.de'), 'ab•@x.de');
});

test('landing shows exactly the consent texts that are logged as proof', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const landing = fs.readFileSync(path.join(__dirname, '../../../landing/src/content/optin.ts'), 'utf8');
    for (const list of n.LISTS) for (const lang of ['de', 'en']) {
        assert.ok(landing.includes(`'${n.CONSENT_TEXTS[list][lang]}'`), `${list}/${lang} consent text differs between landing and functions`);
    }
});
