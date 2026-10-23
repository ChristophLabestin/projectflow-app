import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {}, functions: {} }));
vi.mock('../fileStorageService', () => ({ uploadTenantFile: vi.fn() }));

import { fileKind, fileOriginPath, formatBytes, toFileItem } from '../filesService';

describe('filesService', () => {
    it('normalizes managed files', () => {
        const item = toFileItem('f1', {
            module: 'files', status: 'ready', name: 'Plan.pdf', fileName: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 10,
            projectId: 'p1', parent: { type: 'comment', id: 'c1', projectId: 'p1', rootType: 'task', rootId: 't1' }, version: 2,
        });
        expect(item?.legacy).toBe(false);
        expect(item?.name).toBe('Plan.pdf');
        expect(fileOriginPath(item!)).toBe('/project/p1/tasks/t1');
    });

    it('derives parents for legacy rows and drops deleted ones', () => {
        expect(toFileItem('m', { module: 'media', status: 'ready', projectId: null, fileName: 'a.png' })?.parent.type).toBe('workspace');
        const attachment = toFileItem('a', { module: 'project', status: 'ready', projectId: 'p1', entityType: 'task-attachment', entityId: 't9', fileName: 'x.pdf' });
        expect(attachment?.parent).toMatchObject({ type: 'task', rootId: 't9' });
        expect(attachment?.legacy).toBe(true);
        expect(toFileItem('d', { status: 'deleted' })).toBeNull();
        expect(toFileItem('mm', { module: 'media', listed: true, status: 'ready', projectId: null, fileName: 'a.png',
            parent: { type: 'workspace', id: 'workspace', projectId: null, rootType: 'workspace', rootId: 'workspace' } })?.legacy).toBe(false);
    });

    it('classifies kinds and formats sizes', () => {
        expect(fileKind({ mimeType: 'image/png', name: 'a.png' })).toBe('image');
        expect(fileKind({ mimeType: 'application/octet-stream', name: 'notes.md' })).toBe('text');
        expect(fileKind({ mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name: 'a.xlsx' })).toBe('sheet');
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    });
});
