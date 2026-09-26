/**
 * Assigns each label a row so labels that would overlap horizontally are
 * stacked instead (greedy interval packing). Returns row index per item and
 * the number of rows used.
 */
export const staggerLabels = (items: { x: number; width: number }[], gap = 8) => {
    const rowEnds: number[] = [];
    const rows = items.map((item) => {
        let row = rowEnds.findIndex((end) => item.x >= end + gap);
        if (row === -1) {
            row = rowEnds.length;
            rowEnds.push(0);
        }
        rowEnds[row] = item.x + item.width;
        return row;
    });
    return { rows, rowCount: Math.max(1, rowEnds.length) };
};

/** Rough label width for 11px semibold text (no DOM measuring needed). */
export const estimateLabelWidth = (text: string) => 34 + text.length * 6.4;
