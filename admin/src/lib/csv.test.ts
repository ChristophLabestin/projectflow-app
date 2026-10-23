import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
    it('quotes separators and guards formulas', () => {
        const csv = toCsv(['a', 'b'], [['x,y', '=SUM(1)'], ['say "hi"', null]]);
        expect(csv).toBe('\uFEFFa,b\r\n"x,y",\'=SUM(1)\r\n"say ""hi""",');
    });
});
