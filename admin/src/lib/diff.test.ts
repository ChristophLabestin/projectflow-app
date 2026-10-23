import { describe, expect, it } from 'vitest';
import { diffLines, withContext } from './diff';

describe('diffLines', () => {
    it('marks additions and deletions', () => {
        expect(diffLines('a\nb\nc', 'a\nx\nc')).toEqual([
            { kind: 'same', text: 'a' }, { kind: 'del', text: 'b' }, { kind: 'add', text: 'x' }, { kind: 'same', text: 'c' },
        ]);
    });
    it('collapses long unchanged runs', () => {
        const lines = diffLines('1\n2\n3\n4\n5\n6\n7', '1\n2\n3\n4\n5\n6\nX');
        expect(withContext(lines, 1)).toEqual([{ kind: 'gap', count: 5 }, { kind: 'same', text: '6' }, { kind: 'del', text: '7' }, { kind: 'add', text: 'X' }]);
    });
});
