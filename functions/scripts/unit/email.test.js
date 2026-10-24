// Unit tests: SES suppression logic, SNS signature, unsubscribe tokens, rate limit and
// mail templates (functions/src/email-logic.ts, functions/src/email-template.ts).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const logic = require('../../lib/email-logic');
const tpl = require('../../lib/email-template');

const bounce = (bounceType, recipients) => ({
    eventType: 'Bounce',
    mail: { messageId: 'm-1', destination: recipients, tags: { type: ['invitation'] } },
    bounce: { bounceType, bounceSubType: 'General', bouncedRecipients: recipients.map((emailAddress) => ({ emailAddress, diagnosticCode: 'smtp; 550' })) },
});

test('suppression ids are stable and case-insensitive', () => {
    assert.equal(logic.suppressionId(' Anna@Example.com '), logic.suppressionId('anna@example.com'));
    assert.notEqual(logic.suppressionId('a@example.com'), logic.suppressionId('b@example.com'));
    assert.match(logic.suppressionId('a/b@example.com'), /^[0-9a-f]{40}$/);
});

test('only active suppressions block sending', () => {
    assert.equal(logic.isActiveSuppression({ active: true }), true);
    assert.equal(logic.isActiveSuppression({ active: false, softBounces: [1, 2] }), false);
    assert.equal(logic.isActiveSuppression(undefined), false);
});

test('permanent bounces and complaints suppress, transient bounces count', () => {
    const hard = logic.parseSesEvent(bounce('Permanent', ['Bounce@Simulator.amazonses.com']));
    assert.equal(hard.mailType, 'invitation');
    assert.deepEqual(hard.actions.map((a) => [a.kind, a.email, a.reason]), [['suppress', 'bounce@simulator.amazonses.com', 'bounce']]);
    assert.match(hard.actions[0].detail, /Permanent · General · smtp; 550/);

    const soft = logic.parseSesEvent(bounce('Transient', ['x@example.com']));
    assert.equal(soft.actions[0].kind, 'soft-bounce');

    const complaint = logic.parseSesEvent({
        eventType: 'Complaint', mail: { messageId: 'm-2', tags: {} },
        complaint: { complaintFeedbackType: 'abuse', complainedRecipients: [{ emailAddress: 'complaint@simulator.amazonses.com' }] },
    });
    assert.deepEqual(complaint.actions.map((a) => [a.kind, a.reason, a.detail]), [['suppress', 'complaint', 'abuse']]);
    assert.equal(complaint.mailType, '');

    const delivery = logic.parseSesEvent({ eventType: 'Delivery', mail: { destination: ['ok@example.com'] } });
    assert.deepEqual(delivery.actions, [{ kind: 'count', email: 'ok@example.com', event: 'delivery' }]);
    // Legacy identity notifications use notificationType.
    assert.equal(logic.parseSesEvent({ notificationType: 'Bounce', bounce: { bounceType: 'Permanent', bouncedRecipients: [] } }).eventType, 'Bounce');
    assert.equal(logic.parseSesEvent({}), null);
    assert.equal(logic.parseSesEvent(null), null);
});

test('three soft bounces within seven days suppress', () => {
    const day = 86_400_000;
    let state = logic.applySoftBounce(undefined, 10 * day);
    assert.equal(state.suppress, false);
    state = logic.applySoftBounce(state.softBounces, 11 * day);
    assert.equal(state.suppress, false);
    assert.equal(logic.applySoftBounce(state.softBounces, 12 * day).suppress, true);
    // Old bounces fall out of the window.
    assert.equal(logic.applySoftBounce(state.softBounces, 30 * day).suppress, false);
});

test('SNS messages: string to sign, signature, cert and topic checks', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const msg = {
        Type: 'Notification', MessageId: 'id-1', TopicArn: 'arn:aws:sns:eu-north-1:123456789012:projectflow-ses-events',
        Message: '{"eventType":"Delivery"}', Timestamp: '2026-10-24T10:00:00.000Z', SignatureVersion: '2',
        SigningCertURL: 'https://sns.eu-north-1.amazonaws.com/SimpleNotificationService-abc.pem', Signature: '',
    };
    const toSign = logic.snsStringToSign(msg);
    assert.equal(toSign, `Message\n${msg.Message}\nMessageId\nid-1\nTimestamp\n${msg.Timestamp}\nTopicArn\n${msg.TopicArn}\nType\nNotification\n`);
    msg.Signature = crypto.sign('sha256', Buffer.from(toSign), privateKey).toString('base64');
    const parsed = logic.parseSnsMessage(JSON.stringify(msg));
    assert.ok(crypto.createVerify('RSA-SHA256').update(logic.snsStringToSign(parsed)).verify(publicKey, parsed.Signature, 'base64'));
    assert.ok(!crypto.createVerify('RSA-SHA256').update(logic.snsStringToSign({ ...parsed, Message: '{}' })).verify(publicKey, parsed.Signature, 'base64'));

    const sub = { ...msg, Type: 'SubscriptionConfirmation', Token: 't', SubscribeURL: 'https://sns.eu-north-1.amazonaws.com/?Action=ConfirmSubscription' };
    assert.match(logic.snsStringToSign(sub), /^Message\n.*\nMessageId\nid-1\nSubscribeURL\n.*\nTimestamp\n.*\nToken\nt\nTopicArn/s);

    assert.equal(logic.isSnsCertUrl(msg.SigningCertURL), true);
    assert.equal(logic.isSnsCertUrl('https://sns.eu-north-1.amazonaws.com.evil.com/x.pem'), false);
    assert.equal(logic.isSnsCertUrl('http://sns.eu-north-1.amazonaws.com/x.pem'), false);
    assert.equal(logic.isSnsHostUrl('https://evil.com/?sns.eu-north-1.amazonaws.com'), false);
    assert.equal(logic.parseSnsMessage({ ...msg, SignatureVersion: '3' }), null);
    assert.equal(logic.parseSnsMessage('not json'), null);

    assert.equal(logic.isAllowedTopic(msg.TopicArn, ` ${msg.TopicArn} , arn:other`), true);
    assert.equal(logic.isAllowedTopic('arn:aws:sns:eu-north-1:999:projectflow-ses-events', msg.TopicArn), false);
    assert.equal(logic.isAllowedTopic(msg.TopicArn, ''), false);
    assert.equal(logic.isAllowedTopic(msg.TopicArn, undefined), false);
});

test('unsubscribe tokens round-trip and reject tampering', () => {
    const token = logic.signUnsubscribeToken('k'.repeat(43), 'uid-1', 'notif:comments');
    assert.deepEqual(logic.verifyUnsubscribeToken('k'.repeat(43), token), { subject: 'uid-1', scope: 'notif:comments' });
    assert.equal(logic.verifyUnsubscribeToken('other-key', token), null);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ s: 'uid-2', c: 'notif:comments' })).toString('base64url');
    assert.equal(logic.verifyUnsubscribeToken('k'.repeat(43), `${forged}.${sig}`), null);
    assert.equal(logic.verifyUnsubscribeToken('k'.repeat(43), payload), null);
    assert.equal(logic.verifyUnsubscribeToken('k'.repeat(43), ''), null);
});

test('List-Unsubscribe headers follow RFC 8058', () => {
    assert.deepEqual(logic.listUnsubscribeHeaders('https://x.test/u?t=1'), [
        { Name: 'List-Unsubscribe', Value: '<https://x.test/u?t=1>' },
        { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
    ]);
    assert.match(logic.listUnsubscribeHeaders('https://x.test/u', 'u@x.test')[0].Value, /^<https:\/\/x\.test\/u>, <mailto:u@x\.test\?subject=unsubscribe>$/);
    assert.equal(logic.NON_TRANSACTIONAL.has('notification'), true);
    assert.equal(logic.NON_TRANSACTIONAL.has('invitation'), false);
});

test('rate limiter spaces sends to the SES max send rate', () => {
    let now = 1000;
    const limiter = new logic.SendRateLimiter(2, () => now);
    assert.deepEqual([limiter.reserve(), limiter.reserve(), limiter.reserve()], [0, 500, 1000]);
    now = 5000;
    assert.equal(limiter.reserve(), 0);
    limiter.setRate(14);
    limiter.setRate(0); // ignored
    assert.equal(limiter.reserve(), Math.round(1000 / 2)); // slot reserved with the old rate
    assert.ok(Math.abs(limiter.reserve() - (500 + 1000 / 14)) < 1e-6);
});

test('retry only throttling, network and 5xx errors', () => {
    assert.equal(logic.isRetryableSendError({ name: 'TooManyRequestsException' }), true);
    assert.equal(logic.isRetryableSendError({ name: 'Throttling', message: 'Maximum sending rate exceeded.' }), true);
    assert.equal(logic.isRetryableSendError({ name: 'X', $metadata: { httpStatusCode: 503 } }), true);
    assert.equal(logic.isRetryableSendError({ name: 'MessageRejected', $metadata: { httpStatusCode: 400 } }), false);
    assert.equal(logic.isRetryableSendError({ name: 'SendingPausedException' }), false);
    assert.equal(logic.backoffMs(0, () => 0), 500);
    assert.equal(logic.backoffMs(10, () => 0), 8000);
    assert.equal(logic.sesTagValue('newsletter optin!'), 'newsletter_optin_');
});

test('system template shows the real imprint, not the old San Francisco footer', () => {
    const html = tpl.getSystemEmailTemplate('Join us', 'Body', 'https://app.getprojectflow.com/invite/1', 'Accept', 'de');
    assert.ok(html.includes(tpl.EMAIL_IMPRINT));
    assert.ok(html.includes('Frühlingsstraße 8 · 84082 Laberweinting'));
    assert.ok(!/San Francisco|Project Flow Inc/.test(html));
    assert.ok(html.includes('oder Link einfügen') || html.includes('Link'));
    assert.ok(html.includes('href="https://app.getprojectflow.com/invite/1"'));
});

test('notification template escapes content and links settings + unsubscribe', () => {
    const html = tpl.getNotificationEmailTemplate('<b>Task</b> "x"', 'Anna & Ben <script>', {
        appUrl: 'https://app.getprojectflow.com/', settingsUrl: 'https://app.getprojectflow.com/?openSettings=notifications', unsubscribeUrl: 'https://u.test/?t=a&b',
    }, 'en');
    assert.ok(html.includes('&lt;b&gt;Task&lt;/b&gt; &quot;x&quot;'));
    assert.ok(html.includes('Anna &amp; Ben &lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('href="https://u.test/?t=a&amp;b"'));
    assert.ok(html.includes('Unsubscribe from these emails'));
    assert.ok(html.includes(tpl.EMAIL_IMPRINT));
    const noUnsub = tpl.getNotificationEmailTemplate('S', 'M', { appUrl: 'a', settingsUrl: 's', unsubscribeUrl: null }, 'de');
    assert.ok(!noUnsub.includes('abbestellen'));
    assert.ok(noUnsub.includes('Benachrichtigungseinstellungen'));
});

test('plain-text part strips markup and keeps links', () => {
    const text = logic.stripHtml('<html><head><style>p{}</style></head><body><h1>Hi</h1><p>A &amp; B<br>next</p><a href="https://x.test">Go</a></body></html>');
    assert.equal(text, 'Hi\nA & B\nnext\nGo (https://x.test)');
});
