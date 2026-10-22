// Unit test: FCM message shape for Live Activity start / update / end (contract C5).
// Importing lib/live-activity initialises firebase-admin without credentials, which is fine offline.
const test = require('node:test');
const assert = require('node:assert/strict');
const focus = require('../../lib/focus-logic');
const la = require('../../lib/live-activity');

const state = focus.normalizeFocus({
    itemId: 't1', itemType: 'task', title: 'Write', projectId: 'p1', tenantId: 'ws', status: 'active', startedAt: '2026-10-22T10:00:00.000Z'
});
const extras = { projectName: 'Site', nextStep: 'Send draft', tenantId: 'ws' };

test('start message: push-to-start token, attributes, content state, alert', () => {
    const start = la.buildLiveActivityMessage({ kind: 'start', fcmToken: 'fcm', liveActivityToken: 'start-token', nowSeconds: 1000, focus: state, extras, language: 'de' });
    assert.equal(start.token, 'fcm');
    assert.equal(start.apns.liveActivityToken, 'start-token');
    assert.equal(start.apns.headers['apns-priority'], '10');
    const aps = start.apns.payload.aps;
    assert.equal(aps.event, 'start');
    assert.equal(aps.timestamp, 1000);
    assert.equal(aps['attributes-type'], 'FocusActivityAttributes');
    assert.deepEqual(aps.attributes, { itemId: 't1', itemType: 'task', tenantId: 'ws', projectId: 'p1' });
    assert.equal(aps['content-state'].projectName, 'Site');
    assert.equal(aps['content-state'].nextStep, 'Send draft');
    assert.equal(aps.alert.title, 'Fokus gestartet');
    assert.equal(aps.alert.body, 'Write');
});

test('update message: no attributes, no alert', () => {
    const update = la.buildLiveActivityMessage({ kind: 'update', fcmToken: 'fcm', liveActivityToken: 'push-token', nowSeconds: 1001, focus: state, extras });
    const aps = update.apns.payload.aps;
    assert.equal(aps.event, 'update');
    assert.equal(aps['attributes-type'], undefined);
    assert.equal(aps.attributes, undefined);
    assert.equal(aps.alert, undefined);
    assert.equal(aps['content-state'].status, 'active');
});

test('end message: dismissal date and a content state are always present', () => {
    const end = la.buildLiveActivityMessage({ kind: 'end', fcmToken: 'fcm', liveActivityToken: 'push-token', nowSeconds: 1002, focus: null });
    const aps = end.apns.payload.aps;
    assert.equal(aps.event, 'end');
    assert.equal(aps['dismissal-date'], 1002);
    assert.ok(aps['content-state']);
});
