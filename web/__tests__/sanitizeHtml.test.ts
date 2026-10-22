import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../utils/sanitizeHtml';

describe('sanitizeHtml', () => {
    it('strips scripts, event handlers and javascript: URLs', () => {
        const dirty = '<p>Hi</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">x</a><iframe src="https://evil.example"></iframe>';
        const clean = sanitizeHtml(dirty);
        expect(clean).not.toMatch(/<script|onerror|javascript:|<iframe/i);
        expect(clean).toContain('<p>Hi</p>');
    });

    it('keeps formatting markup and inline styles', () => {
        const html = '<h2>Title</h2><p style="text-align: center"><strong>bold</strong> <a href="https://example.com">link</a></p>';
        expect(sanitizeHtml(html)).toBe(html);
    });

    it('handles empty input', () => {
        expect(sanitizeHtml(undefined)).toBe('');
    });
});
