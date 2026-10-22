import DOMPurify from 'dompurify';

// Every user- or API-provided HTML string must pass through here before it
// reaches dangerouslySetInnerHTML. Scripts, event handlers, javascript: URLs
// and embedded frames/forms are stripped; formatting markup is kept.
export const sanitizeHtml = (html: string | null | undefined): string =>
    DOMPurify.sanitize(html || '', {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'textarea', 'select', 'object', 'embed'],
    });
