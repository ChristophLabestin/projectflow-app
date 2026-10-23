// Unit tests: crash report validation, scrubbing and grouping (functions/src/crash-reports.ts).
const test = require('node:test');
const assert = require('node:assert/strict');
const crash = require('../../lib/crash-reports');

const base = (events, extra = {}) => ({
    platform: 'web', release: '2026-10-23T12:00', installId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    device: { os: 'macOS', osVersion: '15', browser: 'Chrome 140' }, events, ...extra,
});

test('rejects reports without platform, release, install id or events', () => {
    assert.equal(crash.parseCrashReport(null), null);
    assert.equal(crash.parseCrashReport(base([], { platform: 'android' })), null);
    assert.equal(crash.parseCrashReport(base([{ type: 'TypeError' }], { installId: 'x' })), null);
    assert.equal(crash.parseCrashReport(base([])), null);
});

test('scrubs emails, tokens, long numbers and URL queries from messages, routes and files', () => {
    const report = crash.parseCrashReport(base([{
        type: 'Error', message: 'Failed for anna@example.com with token=abc123 id 12345678 at https://x.test/a?b=c',
        route: '/projects/abc?invite=anna@example.com',
        frames: [{ function: 'load', file: 'https://app.getprojectflow.com/assets/index-AbCdEf12.js?v=1', line: 1, column: 99 }],
    }]));
    const [event] = report.events;
    assert.equal(event.message, 'Failed for <email> with token=<redacted> id <number> at https://x.test/a');
    assert.equal(event.route, '/projects/abc');
    assert.equal(event.frames[0].file, '/assets/index-AbCdEf12.js');
    assert.equal(report.environment, 'production');
    assert.equal(crash.scrub('NSInternalInconsistencyException'), 'NSInternalInconsistencyException');
    assert.equal(crash.scrub('key abcdef0123456789abcdef0123456789ab'), 'key <redacted>');
});

test('web events with the same culprit group across releases and bundle hashes', () => {
    const a = crash.parseCrashReport(base([{ type: 'TypeError', message: "Cannot read 'x' of undefined (12)", frames: [{ function: 'render', file: '/assets/index-AAAAAAAA.js' }] }]));
    const b = crash.parseCrashReport(base([{ type: 'TypeError', message: "Cannot read 'y' of undefined (99)", frames: [{ function: 'render', file: '/assets/index-BBBBBBBB.js' }] }], { release: 'other' }));
    assert.equal(crash.fingerprintOf('web', a.events[0]), crash.fingerprintOf('web', b.events[0]));
    assert.equal(crash.culpritOf('web', a.events[0].frames), 'render · index.js');
});

test('iOS frames and images are kept for local symbolication', () => {
    const report = crash.parseCrashReport(base([{
        type: 'SIGSEGV', mechanism: 'signal',
        frames: [{ image: 'ProjectFlow', uuid: '1ffd5d91-a49f-31e4-8f82-ae278ad0ed57', offset: 4096, address: '0x10000F000', inApp: true }],
        images: [{ name: 'ProjectFlow', uuid: '1ffd5d91-a49f-31e4-8f82-ae278ad0ed57', loadAddress: '0x100000000', arch: 'arm64' }, { name: 'bad' }],
    }], { platform: 'ios', environment: 'development', device: { os: 'iOS', osVersion: '27.0', model: 'iPhone18,1' } }));
    const [event] = report.events;
    assert.equal(report.environment, 'development');
    assert.deepEqual(event.frames[0], { image: 'ProjectFlow', uuid: '1FFD5D91-A49F-31E4-8F82-AE278AD0ED57', offset: 4096, address: '0x10000f000', inApp: true });
    assert.equal(event.images.length, 1);
    assert.equal(crash.culpritOf('ios', event.frames), 'ProjectFlow + 4096');
});
