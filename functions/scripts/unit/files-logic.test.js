// Unit tests: file manager type blocklist, parent normalisation, access + quota rules.
const test = require('node:test');
const assert = require('node:assert/strict');
const files = require('../../lib/files-logic');

test('blocks executables and active content by extension or mime', () => {
    assert.equal(files.isBlockedFileType('setup.exe', 'application/octet-stream'), true);
    assert.equal(files.isBlockedFileType('run.SH', ''), true);
    assert.equal(files.isBlockedFileType('logo.svg', 'image/png'), true);
    assert.equal(files.isBlockedFileType('page.txt', 'text/html'), true);
    assert.equal(files.isBlockedFileType('x.bin2', 'application/x-msdownload'), true);
    assert.equal(files.isBlockedFileType('report.pdf', 'application/pdf'), false);
    assert.equal(files.isBlockedFileType('notes.md', 'text/markdown'), false);
    assert.equal(files.isBlockedFileType('clip.mov', 'video/quicktime'), false);
});

test('sanitizes names and folders', () => {
    assert.equal(files.sanitizeFileName('  a/b\\c.pdf '), 'a-b-c.pdf');
    assert.equal(files.sanitizeFileName(`${'x'.repeat(300)}.pdf`).length, files.MAX_FILE_NAME_LENGTH);
    assert.ok(files.sanitizeFileName(`${'x'.repeat(300)}.pdf`).endsWith('.pdf'));
    assert.equal(files.sanitizeFolder('/Verträge// 2026 /'), 'Verträge/2026');
    assert.deepEqual(files.sanitizeTags(['a', 'a', ' b ', 3]), ['a', 'b']);
});

test('normalizes parents', () => {
    assert.deepEqual(files.normalizeParent({ type: 'task', id: 't1', projectId: 'p1', title: 'T' }),
        { type: 'task', id: 't1', projectId: 'p1', rootType: 'task', rootId: 't1', title: 'T' });
    assert.equal(files.normalizeParent({ type: 'task', id: 't1' }), null, 'task needs project');
    assert.equal(files.normalizeParent({ type: 'project', id: 'p2', projectId: 'p1' }), null, 'project id must match');
    assert.equal(files.normalizeParent({ type: 'bogus', id: 'x' }), null);
    assert.deepEqual(files.normalizeParent({ type: 'workspace', id: 'ignored', projectId: 'p1' }),
        { type: 'workspace', id: 'workspace', projectId: null, rootType: 'workspace', rootId: 'workspace', title: '' });
    const comment = files.normalizeParent({ type: 'comment', id: 'c1', projectId: 'p1', rootType: 'task', rootId: 't1' });
    assert.equal(comment.rootId, 't1');
    assert.equal(files.normalizeParent({ type: 'comment', id: 'c1', projectId: 'p1' }), null, 'comment needs root');
    assert.equal(files.normalizeParent({ type: 'doc', id: 'd1' }).projectId, null, 'workspace docs allowed');
});

test('read scope mirrors firestore rules', () => {
    const project = { ownerId: 'owner', memberIds: ['guestIn'] };
    const ctx = (uid, role, p = project) => ({ uid, role, isMember: true, project: p });
    assert.equal(files.canReadScope(ctx('m', 'Member'), 'p1'), true);
    assert.equal(files.canReadScope(ctx('guestIn', 'Guest'), 'p1'), true);
    assert.equal(files.canReadScope(ctx('guestOut', 'Guest'), 'p1'), false);
    assert.equal(files.canReadScope(ctx('guestIn', 'Guest', null), null), false, 'guests never see workspace files');
    assert.equal(files.canReadScope(ctx('m', 'Member', null), null), true);
    assert.equal(files.canReadScope(ctx('m', 'Member', null), 'missing'), false, 'missing project');
    assert.equal(files.canReadScope({ uid: 'x', role: '', isMember: false, project }, 'p1'), false);
});

test('manage and purge rights', () => {
    const project = { ownerId: 'pOwner', memberIds: ['guestIn'] };
    const file = { createdBy: 'uploader', projectId: 'p1' };
    const ctx = (uid, role) => ({ uid, role, isMember: true, project });
    assert.equal(files.canManageFile(ctx('uploader', 'Member'), file), true);
    assert.equal(files.canManageFile(ctx('other', 'Member'), file), false);
    assert.equal(files.canManageFile(ctx('pOwner', 'Member'), file), true);
    assert.equal(files.canManageFile(ctx('admin', 'Admin'), file), true);
    assert.equal(files.canPurgeFile(ctx('pOwner', 'Member'), file), false);
    assert.equal(files.canPurgeFile(ctx('uploader', 'Member'), file), true);
    assert.equal(files.canManageFile(ctx('guestOut', 'Guest'), { createdBy: 'guestOut', projectId: 'p1' }), false);
});

test('quota', () => {
    assert.equal(files.resolveQuotaBytes(undefined), files.DEFAULT_WORKSPACE_QUOTA_BYTES);
    assert.equal(files.resolveQuotaBytes({ storageQuotaBytes: 100 }), 100);
    assert.equal(files.quotaAllows(90, 100, 10), true);
    assert.equal(files.quotaAllows(91, 100, 10), false);
});

test('legacy rows get file-manager fields', () => {
    const media = files.legacyFileFields({ module: 'media', fileName: 'a/b.png', projectId: 'p1' }, { uploaderName: 'Ann' });
    assert.equal(media.parent.type, 'project', 'project media stays project-scoped');
    assert.equal(files.legacyFileFields({ module: 'media', fileName: 'w.png' }).parent.type, 'workspace');
    assert.equal(media.name, 'a-b.png');
    assert.equal(media.uploaderName, 'Ann');
    const att = files.legacyFileFields({ module: 'project', entityType: 'task-attachment', entityId: 't1', projectId: 'p1', fileName: 'x.pdf' }, { parentTitle: 'Task' });
    assert.deepEqual(att.parent, { type: 'task', id: 't1', projectId: 'p1', rootType: 'task', rootId: 't1', title: 'Task' });
    assert.equal(files.legacyFileFields({ module: 'project', entityType: 'cover', entityId: 'p1', projectId: 'p1' }), null);
    assert.equal(files.legacyFileFields({ module: 'profile', entityType: 'avatar' }), null);
    assert.equal(files.legacyFileFields({ module: 'media', listed: true }), null, 'already migrated');
    assert.equal(files.legacyFileFields({ module: 'project', entityType: 'task-attachment', entityId: 't1' }), null, 'needs project');
});
