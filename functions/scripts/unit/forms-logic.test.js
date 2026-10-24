// Unit tests: Forms shared logic (brain/plans/forms-concept.md). The behaviour is pinned in detail by the
// golden fixtures (shared/fixtures/forms*); here: the web/functions copies stay identical, plus server-only paths.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const forms = require('../../lib/forms-logic');

test('functions copy is byte-identical to web/utils/formsLogic.ts', () => {
    const web = fs.readFileSync(path.resolve(__dirname, '../../../web/utils/formsLogic.ts'), 'utf8');
    const fn = fs.readFileSync(path.resolve(__dirname, '../../src/forms-logic.ts'), 'utf8');
    assert.equal(fn, web, 'run: cp web/utils/formsLogic.ts functions/src/forms-logic.ts');
});

const schema = {
    sections: [{ id: 's1' }, { id: 's2', showIf: { mode: 'all', rules: [{ fieldId: 'kind', op: 'equals', value: 'bug' }] } }],
    fields: [
        { id: 'kind', sectionId: 's1', type: 'singleChoice', label: 'Kind', required: true, options: [{ id: 'bug', label: 'Bug' }, { id: 'idea', label: 'Idea' }] },
        { id: 'name', sectionId: 's1', type: 'shortText', label: 'Name' },
        { id: 'steps', sectionId: 's2', type: 'longText', label: 'Steps', required: true },
        { id: 'shot', sectionId: 's2', type: 'fileUpload', label: 'Screenshot', maxFiles: 2, maxFileBytes: 1000, fileKinds: ['image'] }
    ]
};

test('hidden sections are not required and their answers are dropped', () => {
    const result = forms.validateSubmission(schema, { kind: { selected: ['idea'] }, steps: 'leak', name: '  Ada ' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.answers, { kind: { selected: ['idea'] }, name: 'Ada' });
});

test('visible required fields and file rules are enforced', () => {
    const result = forms.validateSubmission(schema, {
        kind: { selected: ['bug'] },
        shot: [{ fileId: 'f1', name: 'x.svg', size: 10, contentType: 'image/svg+xml' }]
    });
    assert.deepEqual(result.errors, [{ fieldId: 'steps', code: 'required' }, { fieldId: 'shot', code: 'fileTypeNotAllowed' }]);
});

test('a text answer that spells an error code is still a valid answer', () => {
    const result = forms.validateSubmission(schema, { kind: { selected: ['bug'] }, steps: 'required' });
    assert.equal(result.ok, true);
    assert.equal(result.answers.steps, 'required');
});

test('csv cells escape quotes and neutralize formulas', () => {
    assert.equal(forms.csvCell('=SUM(A1)'), "'=SUM(A1)");
    assert.equal(forms.csvCell('a "b", c'), '"a ""b"", c"');
    assert.equal(forms.csvCell('a;b', ';'), '"a;b"');
    assert.equal(forms.csvCell('a;b', ','), 'a;b');
});

test('quota follows the plan and the platform override', () => {
    assert.equal(forms.formQuotaFor({ plan: 'free' }, null).activeForms, 3);
    assert.equal(forms.formQuotaFor(null, null).plan, 'legacy');
    assert.equal(forms.formQuotaFor({ plan: 'bogus' }, null).plan, 'free');
    const override = forms.formQuotaFor({ plan: 'free' }, { limits: { forms: { responsesPerMonth: 500, logic: true, activeForms: null } } });
    assert.deepEqual([override.responsesPerMonth, override.logic, override.activeForms], [500, true, null]);
});

test('access: members create, guests do not, editors edit', () => {
    const member = { uid: 'u1', role: 'Member' };
    const guest = { uid: 'g1', role: 'Guest' };
    assert.equal(forms.canCreateForms(member), true);
    assert.equal(forms.canCreateForms(guest), false);
    assert.equal(forms.canCreateForms({ ...guest, permissions: ['tenant.forms.create'] }), true);
    assert.equal(forms.canEditForm({ ownerId: 'u2', editorIds: ['u1'] }, member), true);
    assert.equal(forms.canEditForm({ ownerId: 'u2' }, member), false);
    assert.equal(forms.canEditForm({ ownerId: 'u2' }, { uid: 'a', role: 'Admin' }), true);
    assert.equal(forms.canEditForm({ ownerId: 'g1' }, guest), false);
});

test('response expiry adds the retention months; unknown retention keeps the response', () => {
    const at = Date.UTC(2026, 9, 24);
    assert.equal(forms.responseExpiry(at, 12), Date.UTC(2027, 9, 24));
    assert.equal(forms.responseExpiry(at, null), null);
    assert.equal(forms.responseExpiry(at, 7), null);
});
