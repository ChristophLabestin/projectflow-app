import type { CrashFrame } from '../../services/crashReportsService';

export const formatRelative = (ms: number, language: string): string => {
    if (!ms) return '—';
    const rtf = new Intl.RelativeTimeFormat(language === 'de' ? 'de' : 'en', { numeric: 'auto' });
    const minutes = Math.round((ms - Date.now()) / 60_000);
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 48) return rtf.format(hours, 'hour');
    return rtf.format(Math.round(hours / 24), 'day');
};

export const formatDateTime = (ms: number, language: string): string =>
    ms ? new Date(ms).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** One stack line: symbol + file:line (web/symbolicated) or image + offset (raw iOS). */
export const formatFrame = (frame: CrashFrame): { symbol: string; location: string } => {
    if (frame.file) {
        return {
            symbol: frame.function || '<anonymous>',
            location: `${frame.file}${frame.line ? `:${frame.line}` : ''}${frame.column ? `:${frame.column}` : ''}`,
        };
    }
    return {
        symbol: frame.function || (frame.offset !== undefined ? `${frame.image ?? '?'} + ${frame.offset}` : frame.address ?? '?'),
        location: frame.function ? frame.image ?? '' : frame.address ?? '',
    };
};
