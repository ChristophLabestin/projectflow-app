import type { EffortEntry } from '../types';
import { toIsoDate } from './taskDates';

export type ParsedEffortRow = Omit<EffortEntry, 'id' | 'projectId' | 'tenantId' | 'createdAt' | 'updatedAt'>;

const FIELD_ALIASES: Record<keyof ParsedEffortRow, string[]> = {
    date: ['datum', 'date'],
    task: ['aufgabe', 'task', 'tätigkeit', 'taetigkeit'],
    durationValue: ['dauer (wert)', 'dauer wert', 'dauer', 'duration (value)', 'duration value', 'duration'],
    durationUnit: ['dauer (einheit)', 'dauer einheit', 'einheit', 'duration (unit)', 'duration unit', 'unit'],
    tokenValue: ['token (wert)', 'token wert', 'token', 'tokens', 'token (value)', 'token value'],
    tokenUnit: ['token (einheit)', 'token einheit', 'token (unit)', 'token unit'],
    note: ['notiz', 'note', 'bemerkung', 'kommentar']
};

const POSITIONAL: (keyof ParsedEffortRow)[] = ['date', 'task', 'durationValue', 'durationUnit', 'tokenValue', 'tokenUnit', 'note'];

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const isSeparatorRow = (cells: string[]) => cells.every(c => /^:?-{2,}:?$/.test(c.trim()) || c.trim() === '');

const splitRow = (line: string): string[] => {
    let l = line.trim();
    if (l.startsWith('|')) l = l.slice(1);
    if (l.endsWith('|')) l = l.slice(0, -1);
    // split on unescaped pipes
    return l.split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
};

const parseNumber = (raw?: string): number => {
    if (!raw) return 0;
    const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : 0;
};

const parseDate = (raw?: string): string => {
    const v = (raw || '').trim();
    if (!v) return '';
    // dd.mm.yyyy or dd/mm/yyyy
    const dm = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})$/);
    if (dm) {
        const [, d, m, y] = dm;
        const year = y.length === 2 ? `20${y}` : y;
        return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // already ISO-ish
    const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        const [, y, m, d] = iso;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return v;
};

const buildColumnMap = (header: string[]): (keyof ParsedEffortRow | null)[] => {
    const normalized = header.map(normalize);
    const fields = Object.keys(FIELD_ALIASES) as (keyof ParsedEffortRow)[];
    const used = new Set<keyof ParsedEffortRow>();

    // Pass 1: exact matches win (so "Dauer (Einheit)" maps to durationUnit and not
    // to durationValue via the loose "dauer" prefix).
    const map: (keyof ParsedEffortRow | null)[] = normalized.map((cell) => {
        for (const field of fields) {
            if (!used.has(field) && FIELD_ALIASES[field].some(alias => cell === alias)) {
                used.add(field);
                return field;
            }
        }
        return null;
    });

    // Pass 2: prefix matches for anything still unresolved.
    return map.map((field, i) => {
        if (field) return field;
        const cell = normalized[i];
        for (const candidate of fields) {
            if (!used.has(candidate) && FIELD_ALIASES[candidate].some(alias => cell.startsWith(alias))) {
                used.add(candidate);
                return candidate;
            }
        }
        return null;
    });
};

export interface EffortMarkdownParseResult {
    rows: ParsedEffortRow[];
    matchedHeader: boolean;
    skipped: number;
}

/** Parses a GitHub-flavoured markdown table into effort rows. Tolerant of header
 *  naming, German decimals (comma), dd.mm.yyyy dates, and missing trailing columns. */
export const parseEffortMarkdown = (markdown: string): EffortMarkdownParseResult => {
    const lines = markdown.split(/\r?\n/).map(l => l.trim()).filter(l => l.includes('|'));
    if (lines.length === 0) return { rows: [], matchedHeader: false, skipped: 0 };

    const tableRows = lines.map(splitRow);
    let columnMap: (keyof ParsedEffortRow | null)[] | null = null;
    let matchedHeader = false;
    let startIdx = 0;

    // First row is treated as header if at least 2 cells map to known fields.
    const headerCandidate = buildColumnMap(tableRows[0]);
    if (headerCandidate.filter(Boolean).length >= 2) {
        columnMap = headerCandidate;
        matchedHeader = true;
        startIdx = 1;
    }

    const rows: ParsedEffortRow[] = [];
    let skipped = 0;

    for (let i = startIdx; i < tableRows.length; i++) {
        const cells = tableRows[i];
        if (isSeparatorRow(cells)) continue;

        const get = (field: keyof ParsedEffortRow): string | undefined => {
            if (columnMap) {
                const idx = columnMap.indexOf(field);
                return idx >= 0 ? cells[idx] : undefined;
            }
            const idx = POSITIONAL.indexOf(field);
            return idx >= 0 ? cells[idx] : undefined;
        };

        const task = (get('task') || '').trim();
        const durationValue = parseNumber(get('durationValue'));
        const tokenValue = parseNumber(get('tokenValue'));
        const date = parseDate(get('date'));

        // Drop rows with no content at all.
        if (!task && !durationValue && !tokenValue && !date) { skipped++; continue; }

        rows.push({
            date: date || toIsoDate(new Date()),
            task: task || '—',
            durationValue,
            durationUnit: (get('durationUnit') || 'h').trim() || 'h',
            tokenValue,
            tokenUnit: (get('tokenUnit') || '').trim(),
            note: (get('note') || '').trim()
        });
    }

    return { rows, matchedHeader, skipped };
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace('.', ','));

/** Serialises effort entries back to a markdown table (for copy/export). */
export const effortToMarkdown = (entries: Array<Partial<EffortEntry>>): string => {
    const header = '| Datum | Aufgabe | Dauer (Wert) | Dauer (Einheit) | Token (Wert) | Token (Einheit) | Notiz |';
    const sep = '| --- | --- | --- | --- | --- | --- | --- |';
    const rows = entries.map(e => `| ${e.date || ''} | ${e.task || ''} | ${fmt(Number(e.durationValue) || 0)} | ${e.durationUnit || ''} | ${e.tokenValue ? fmt(Number(e.tokenValue)) : ''} | ${e.tokenUnit || ''} | ${(e.note || '').replace(/\|/g, '\\|')} |`);
    return [header, sep, ...rows].join('\n');
};
