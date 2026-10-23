/** RFC 4180 CSV with a BOM (Excel opens UTF-8 correctly) and formula-injection guard. */
export const toCsv = (header: string[], rows: unknown[][]) => {
    const cell = (value: unknown) => {
        let text = value == null ? '' : String(value);
        if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return '\uFEFF' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
};

export const downloadCsv = (filename: string, header: string[], rows: unknown[][]) => {
    const blob = new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
