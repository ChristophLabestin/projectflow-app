const nf = new Intl.NumberFormat('de-DE');
const nfCompact = new Intl.NumberFormat('de-DE', { notation: 'compact', maximumFractionDigits: 1 });
const df = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
const dayFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' });
const rtf = new Intl.RelativeTimeFormat('de-DE', { numeric: 'auto' });

export const num = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? '–' : nf.format(value));
export const compact = (value: number | null | undefined) => (value == null || !Number.isFinite(value) ? '–' : value >= 10_000 ? nfCompact.format(value) : nf.format(value));
export const pct = (value: number | null | undefined, digits = 1) => (value == null || !Number.isFinite(value) ? '–' : `${(value * 100).toFixed(digits).replace('.', ',')} %`);
export const usd = (value: number | null | undefined) => (value == null ? '–' : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 10 ? 2 : 0 }).format(value));
export const dateTime = (ms: number | null | undefined) => (ms ? df.format(new Date(ms)) : '–');
export const day = (ms: number | string) => dayFmt.format(typeof ms === 'string' ? new Date(`${ms}T00:00:00`) : new Date(ms));

export const relative = (ms: number | null | undefined, now = Date.now()) => {
    if (!ms) return '–';
    const diff = (ms - now) / 1000;
    const abs = Math.abs(diff);
    if (abs < 45) return 'gerade eben';
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 30 * 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
    return dateTime(ms);
};

export const delta = (current: number, previous: number): number | null => (previous > 0 ? (current - previous) / previous : current > 0 ? null : 0);
