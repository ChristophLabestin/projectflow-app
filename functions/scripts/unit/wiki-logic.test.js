// Unit test: wiki activity event planning (throttle buckets, archive/restore, creation).
const test = require('node:test');
const assert = require('node:assert/strict');
const { planDocEvents, docPath, DOC_UPDATE_BUCKET_MS } = require('../../lib/wiki-logic');

const base = { title: 'Spec', bodyRev: 3, createdBy: 'u1', updatedBy: 'u2', spaceType: 'workspace', projectId: null, archivedAt: null };

test('creation, deletion and archive transitions', () => {
    assert.deepEqual(planDocEvents(null, base, 'd1').map((e) => [e.type, e.actorId]), [['doc.created', 'u1']]);
    assert.equal(planDocEvents(base, null, 'd1')[0].type, 'doc.deleted');
    const archived = { ...base, archivedAt: 1, archivedBy: 'u3', archivedRoot: true };
    assert.deepEqual(planDocEvents(base, archived, 'd1').map((e) => [e.type, e.actorId]), [['doc.archived', 'u3']]);
    assert.deepEqual(planDocEvents(base, { ...archived, archivedRoot: false }, 'd1'), []);
    assert.equal(planDocEvents(archived, base, 'd1')[0].type, 'doc.restored');
});

test('updates only on content/title change and share a 10-minute bucket per person', () => {
    assert.deepEqual(planDocEvents(base, { ...base, order: 5 }, 'd1'), []);
    const t0 = 1_700_000_000_000 - (1_700_000_000_000 % DOC_UPDATE_BUCKET_MS);
    const a = planDocEvents(base, { ...base, bodyRev: 4, updatedAt: t0 + 1000 }, 'd1')[0];
    const b = planDocEvents(base, { ...base, bodyRev: 5, updatedAt: t0 + 60_000 }, 'd1')[0];
    const c = planDocEvents(base, { ...base, bodyRev: 6, updatedAt: t0 + DOC_UPDATE_BUCKET_MS + 1 }, 'd1')[0];
    assert.equal(a.type, 'doc.updated');
    assert.equal(a.key, b.key);
    assert.notEqual(a.key, c.key);
    const renamed = planDocEvents(base, { ...base, title: 'Spec v2', updatedAt: t0 }, 'd1')[0];
    assert.deepEqual(renamed.changes, { title: { from: 'Spec', to: 'Spec v2' } });
});

test('paths point at the right wiki', () => {
    assert.equal(docPath('d1', base), '/wiki/d1');
    assert.equal(docPath('d1', { spaceType: 'project', projectId: 'p1' }), '/project/p1/wiki/d1');
});
