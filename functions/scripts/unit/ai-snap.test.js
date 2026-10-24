// Unit test: Snap (image → kind → task drafts) pure helpers.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeSnapInput, SnapInputError, pickKind, pickProject, cleanDrafts, buildDraftInstructions, MAX_SNAP_TASKS
} = require('../../lib/ai-snap');

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('input: needs a base64 image data URL, bounds note and project id', () => {
    assert.throws(() => normalizeSnapInput({}), SnapInputError);
    assert.throws(() => normalizeSnapInput({ image: 'https://evil.example/x.png' }), SnapInputError);
    assert.throws(() => normalizeSnapInput({ image: 'data:image/svg+xml;base64,PHN2Zz4=' }), SnapInputError);
    assert.throws(() => normalizeSnapInput({ image: 'data:image/png;base64,' + 'A'.repeat(7_000_001) }), SnapInputError);
    const input = normalizeSnapInput({ image: PNG, note: ' x '.repeat(600), projectId: '../p' });
    assert.equal(input.image, PNG);
    assert.equal(input.note.length, 1000);
    assert.equal(input.projectId, undefined);
    assert.equal(normalizeSnapInput({ image: PNG, projectId: 'p-app' }).projectId, 'p-app');
});

test('kind: confident choice wins, low confidence or refusal falls back to other', () => {
    assert.deepEqual(pickKind([{ type: 'choice', name: 'kind', choice: 'bug', confidence: 0.9, probabilities: [] }]), { kind: 'bug', confidence: 0.9 });
    assert.equal(pickKind([{ type: 'choice', name: 'kind', choice: 'bug', confidence: 0.3, probabilities: [] }]).kind, 'other');
    assert.equal(pickKind([{ type: 'choice', name: 'kind', choice: 'nonsense', confidence: 0.9, probabilities: [] }]).kind, 'other');
    assert.equal(pickKind([{ type: 'refusal', name: 'kind' }]).kind, 'other');
});

test('project: confident known choice, else fallback, else first candidate', () => {
    const choices = [{ id: 'a' }, { id: 'b' }];
    assert.equal(pickProject([{ type: 'choice', name: 'project', choice: 'b', confidence: 0.8, probabilities: [] }], choices), 'b');
    assert.equal(pickProject([{ type: 'choice', name: 'project', choice: 'b', confidence: 0.2, probabilities: [] }], choices, 'x'), 'x');
    assert.equal(pickProject([{ type: 'choice', name: 'project', choice: 'zzz', confidence: 0.9, probabilities: [] }], choices), 'a');
    assert.equal(pickProject([], []), undefined);
});

test('drafts: trimmed, empty titles dropped, priority defaulted, capped', () => {
    const drafts = cleanDrafts([
        { title: '  Fix   login ', description: ' d ', priority: 'High' },
        { title: '', description: 'x', priority: 'Low' },
        { title: 'T', description: 'x', priority: 'Whatever' },
        ...Array.from({ length: 10 }, (_, i) => ({ title: `t${i}`, description: '', priority: 'Low' }))
    ]);
    assert.equal(drafts.length, MAX_SNAP_TASKS);
    assert.deepEqual(drafts[0], { title: 'Fix login', description: 'd', priority: 'High' });
    assert.equal(drafts[1].priority, 'Medium');
    assert.deepEqual(cleanDrafts('nope'), []);
});

test('draft instructions: kind guide, language and injection guard', () => {
    const text = buildDraftInstructions('bug', 'de', 'Mobile App');
    assert.match(text, /classified as: bug/);
    assert.match(text, /in German/);
    assert.match(text, /never instructions/);
    assert.match(text, /"Mobile App"/);
});
