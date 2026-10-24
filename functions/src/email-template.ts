// System mail layout. Pure module (no Firebase imports), unit tested in scripts/unit/email.test.js.
import { EMAIL_CONTENT, Language } from './email-locales';

/** Imprint shown in every system mail footer (Impressum, DE). */
export const EMAIL_IMPRINT = 'ProjectFlow · Christoph Labestin · Frühlingsstraße 8 · 84082 Laberweinting · hello@getprojectflow.com';

export const getSystemEmailTemplate = (
  title: string,
  body: string,
  actionLink: string,
  actionText: string,
  language: Language = 'en'
) => {
  const t = EMAIL_CONTENT[language].common;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #000000; margin: 0; padding: 0; background-color: #f9fafb; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
    .header { padding: 40px 0; text-align: center; }
    .logo { width: 48px; height: 48px; margin-bottom: 16px; border-radius: 12px; background: #000000; display: inline-flex; align-items: center; justify-content: center; color: #ffffff; font-weight: bold; font-size: 24px; }
    .app-name { font-size: 18px; font-weight: 600; color: #000000; margin: 0; }
    .content { padding: 0 40px 40px; text-align: center; }
    .icon-shield { width: 64px; height: 64px; margin: 0 auto 24px; color: #000000; }
    h1 { font-size: 30px; font-weight: 700; color: #000000; margin: 0 0 16px; letter-spacing: -0.5px; }
    p { font-size: 16px; color: #000000; margin: 0 0 32px; line-height: 1.6; }
    .button { display: inline-block; background-color: #000000; color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; transition: opacity 0.2s; }
    .button:hover { opacity: 0.9; }
    .divider { display: flex; align-items: center; text-align: center; margin: 40px 0; color: #9ca3af; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
    .divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid #e5e7eb; }
    .divider::before { margin-right: 16px; }
    .divider::after { margin-left: 16px; }
    .link-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; margin-bottom: 40px; text-align: left; }
    .link-text { flex: 1; font-family: monospace; font-size: 13px; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
    .footer { border-top: 1px solid #f3f4f6; padding: 32px 40px; text-align: center; font-size: 12px; color: #9ca3af; line-height: 1.5; background: #fafafa; }
    .footer p { margin: 8px 0; font-size: 12px; }
    
    /* Dark mode overrides to force light theme */
    @media (prefers-color-scheme: dark) {
      body { background-color: #f9fafb !important; color: #000000 !important; }
      .container { background-color: #ffffff !important; color: #000000 !important; }
      h1, .app-name, .icon-shield { color: #000000 !important; }
      p { color: #000000 !important; }
      .button { background-color: #000000 !important; color: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">P</div>
      <div class="app-name">ProjectFlow</div>
    </div>
    
    <div class="content">
      <!-- Shield Icon SVG -->
      <div class="icon-shield">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="M9 12l2 2 4-4"></path>
        </svg>
      </div>

      <h1>${title}</h1>
      <p>${body}</p>
      
      <a href="${actionLink}" class="button">${actionText}</a>

      <div class="divider">${t.orPasteLink}</div>

      <div class="link-box">
        <div class="link-text">${actionLink}</div>
        <!-- Icon is a link because emails don't support JS copy-to-clipboard -->
        <a href="${actionLink}" style="text-decoration: none; color: #9ca3af;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </a>
      </div>
    </div>

    <div class="footer">
      <p>${t.footerIgnore}<br>${t.footerNoList}</p>
      <p>&copy; ${new Date().getFullYear()} ${EMAIL_IMPRINT}</p>
    </div>
  </div>
</body>
</html>
    `;
};

const escapeHtml = (value: string) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** Notification mail (non-transactional): plain text in, escaped; footer with settings + one-click unsubscribe. */
export const getNotificationEmailTemplate = (
  subject: string,
  message: string,
  links: { appUrl: string; settingsUrl: string; unsubscribeUrl?: string | null },
  language: Language = 'en'
) => {
  const t = EMAIL_CONTENT[language].common;
  const link = (href: string, text: string) => `<a href="${escapeHtml(href)}" style="color:#6b7280;">${escapeHtml(text)}</a>`;
  return `<!DOCTYPE html>
<html lang="${language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#000000;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="padding:32px 40px 8px;font-size:16px;font-weight:600;">ProjectFlow</div>
    <div style="padding:0 40px 32px;">
      <h2 style="font-size:22px;margin:16px 0;">${escapeHtml(subject)}</h2>
      <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">${escapeHtml(message)}</p>
      <a href="${escapeHtml(links.appUrl)}" style="display:inline-block;background:#000000;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">${escapeHtml(t.openApp)}</a>
    </div>
    <div style="border-top:1px solid #f3f4f6;padding:24px 40px;font-size:12px;line-height:1.5;color:#9ca3af;background:#fafafa;">
      <p style="margin:0 0 8px;">${escapeHtml(t.notificationReason)}<br>${link(links.settingsUrl, t.notificationSettings)}${links.unsubscribeUrl ? ` · ${link(links.unsubscribeUrl, t.unsubscribe)}` : ''}</p>
      <p style="margin:0;">&copy; ${new Date().getFullYear()} ${EMAIL_IMPRINT}</p>
    </div>
  </div>
</body>
</html>`;
};
