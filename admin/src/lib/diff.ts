export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };

/** Line diff via LCS (documents are a few hundred lines; O(n·m) is fine). */
export const diffLines = (before: string, after: string): DiffLine[] => {
    const a = before.split('\n');
    const b = after.split('\n');
    const n = a.length;
    const m = b.length;
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
        }
    }
    const out: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++; }
        else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ kind: 'del', text: a[i++] });
        else out.push({ kind: 'add', text: b[j++] });
    }
    while (i < n) out.push({ kind: 'del', text: a[i++] });
    while (j < m) out.push({ kind: 'add', text: b[j++] });
    return out;
};

/** Keeps `context` unchanged lines around changes; longer unchanged runs collapse into one marker. */
export const withContext = (lines: DiffLine[], context = 2): (DiffLine | { kind: 'gap'; count: number })[] => {
    const keep = lines.map(() => false);
    lines.forEach((line, index) => {
        if (line.kind === 'same') return;
        for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k++) keep[k] = true;
    });
    const out: (DiffLine | { kind: 'gap'; count: number })[] = [];
    let gap = 0;
    lines.forEach((line, index) => {
        if (keep[index]) {
            if (gap) out.push({ kind: 'gap', count: gap });
            gap = 0;
            out.push(line);
        } else gap++;
    });
    if (gap) out.push({ kind: 'gap', count: gap });
    return out;
};
