/**
 * Grapheme-safe initials. `str[0]` / `charAt(0)` split emoji and other
 * surrogate-pair characters in half, rendering a broken glyph.
 */
const segmenter: { segment: (input: string) => Iterable<{ segment: string }> } | null =
    typeof Intl !== 'undefined' && (Intl as any).Segmenter
        ? new (Intl as any).Segmenter(undefined, { granularity: 'grapheme' })
        : null;

/** First user-perceived character of a string (emoji safe), or '' when empty. */
export const firstGrapheme = (value?: string | null): string => {
    const text = (value || '').trim();
    if (!text) return '';
    if (segmenter) {
        for (const part of segmenter.segment(text)) {
            return part.segment;
        }
    }
    return Array.from(text)[0] || '';
};

/** Uppercased first grapheme, or the fallback when there is nothing to show. */
export const initialOf = (value?: string | null, fallback = '?'): string => {
    const first = firstGrapheme(value);
    return first ? first.toUpperCase() : fallback;
};

/** Up to `max` initials from the first words of a name (emoji safe). */
export const initialsOf = (value?: string | null, fallback = '?', max = 2): string => {
    const letters = (value || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, max)
        .map((part) => firstGrapheme(part).toUpperCase())
        .join('');
    return letters || fallback;
};
