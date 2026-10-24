import * as functions from 'firebase-functions/v1';
import type * as Nodemailer from 'nodemailer';
import * as dns from 'dns/promises';
import * as net from 'net';
import type * as SesV2 from '@aws-sdk/client-sesv2';

// Heavy SDKs load on first send, not at module load (cold start of every importer).
const nodemailer = (): typeof Nodemailer => require('nodemailer');
const sesSdk = (): typeof SesV2 => require('@aws-sdk/client-sesv2');
type SESv2Client = SesV2.SESv2Client;
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './init';
import {
  ALLOWED_SMTP_PORTS, EmailType, NON_TRANSACTIONAL, isAllowedSmtpPort, isAllowedSystemSmtpHost, isPrivateIp, smtpDailyAllowance, systemSmtpSecurity, SendRateLimiter, backoffMs, isActiveSuppression, isRetryableSendError,
  listUnsubscribeHeaders, normalizeEmail, sesTagValue, stripHtml, suppressionId
} from './email-logic';
import { memberRef } from './tenant-id';
const REGION = 'europe-west3'; // Frankfurt

/**
 * Resolves the host and returns a public IP to connect to. Pinning the
 * resolved IP (and using `servername` for TLS) avoids DNS rebinding.
 */
export const resolvePublicHost = async (host: string): Promise<string> => {
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new functions.https.HttpsError('invalid-argument', 'SMTP host is not allowed.');
  }
  return addresses[0].address;
};

export const testSMTPConnection = functions.region(REGION).https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const { tenantId, host, port, user, pass, secure } = data || {};

  if (typeof tenantId !== 'string' || !tenantId) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId is required');
  }
  const membership = await memberRef(tenantId, uid).get();
  const role = membership.exists ? membership.data()?.role : null;
  if (role !== 'Owner' && role !== 'Admin') {
    throw new functions.https.HttpsError('permission-denied', 'Workspace owner or admin access required');
  }

  if (typeof host !== 'string' || !host || host.length > 255 || !user || !pass) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing SMTP credentials');
  }

  const smtpPort = parseInt(port, 10) || 587;
  if (!ALLOWED_SMTP_PORTS.includes(smtpPort)) {
    throw new functions.https.HttpsError('invalid-argument', 'SMTP port must be one of 25, 465, 587, 2525');
  }

  const resolvedIp = await resolvePublicHost(host);

  try {
    const transporter = nodemailer().createTransport({
      host: resolvedIp,
      port: smtpPort,
      secure: !!secure,
      auth: {
        user,
        pass
      },
      tls: {
        servername: net.isIP(host) ? undefined : host,
        rejectUnauthorized: true
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    await transporter.verify();

    return { success: true, message: 'SMTP Connection Successful' };
  } catch (error: any) {
    console.error('SMTP test failed:', error?.code, error?.command);
    return {
      success: false,
      error: 'Failed to connect to the SMTP server. Check host, port, credentials and TLS settings.',
      code: error?.code
    };
  }
});

// ---------------------------------------------------------------------------
// System mail: Amazon SES (API v2) with SMTP fallback. Runbook: brain/operations/email-ses.md
// ---------------------------------------------------------------------------

export { EMAIL_SECRETS } from './email-logic';

export type EmailSendOptions = {
  tenantId?: string;
  fromEmail?: string;
  /** SES tag `type`; also decides transactional vs. list mail. */
  type?: EmailType;
  replyTo?: string;
  /** One-click unsubscribe URL (RFC 8058) for non-transactional mails. */
  unsubscribeUrl?: string;
  text?: string;
};

export type SendEmailResult = {
  transport: 'ses' | 'smtp' | 'tenant-smtp' | 'suppressed';
  messageId?: string;
};

const SYSTEM_FROM_EMAIL = 'no-reply@getprojectflow.com';
const env = (name: string, fallback = '') => (process.env[name] || fallback).trim();
const sesFrom = () => env('SES_FROM', 'ProjectFlow <notifications@mail.getprojectflow.com>');
const replyToDefault = () => env('EMAIL_REPLY_TO', 'hello@getprojectflow.com');

const getTenantSmtpConfig = async (tenantId?: string) => {
  if (!tenantId) {
    return null;
  }

  try {
    const snap = await db.collection('tenants').doc(tenantId).collection('secrets').doc('smtp').get();
    const data = snap.data();

    if (!snap.exists || !data?.useCustom || !data?.host || !data?.user || !data?.pass) {
      return null;
    }

    const port = parseInt(String(data.port || '587'), 10) || 587;
    return {
      host: data.host,
      port,
      secure: port === 465,
      user: data.user,
      pass: data.pass,
      fromEmail: data.fromEmail || SYSTEM_FROM_EMAIL
    };
  } catch (error) {
    console.warn(`Failed to load tenant SMTP config for ${tenantId}`, error);
    return null;
  }
};

const systemSmtpConfig = () => {
  const port = parseInt(env('SMTP_PORT', '465'), 10) || 465;
  return { host: env('SMTP_HOST', 'smtp.gmail.com'), port, secure: port === 465, user: env('SMTP_USER'), pass: env('SMTP_PASS'), fromEmail: env('SMTP_FROM', SYSTEM_FROM_EMAIL) };
};

let systemTransport: { key: string; transport: any } | null = null;
const smtpLimiter = new SendRateLimiter(parseFloat(env('SMTP_MAX_SEND_RATE', '0.5')) || 0.5);

/**
 * System SMTP (Google Workspace bridge): allowlisted host, TLS on 465/587 only, resolved public IP
 * pinned (audit M9), one pooled connection, paced and capped per day (SMTP_DAILY_LIMIT).
 */
const sendViaSystemSmtp = async (
  mail: { to: string; subject: string; html: string; text: string; replyTo: string; headers: { Name: string; Value: string }[]; type: EmailType }
) => {
  const config = systemSmtpConfig();
  if (!config.user || !config.pass || config.pass === 'unset') throw new Error('System SMTP is not configured (SMTP_USER / SMTP_PASS).');
  if (!isAllowedSystemSmtpHost(config.host, env('SMTP_ALLOWED_HOSTS'))) throw new Error('System SMTP host is not allowlisted.');
  const security = systemSmtpSecurity(config.port);
  if (!security) throw new Error('System SMTP port must be 465 or 587.');

  const day = new Date().toISOString().slice(0, 10);
  const statsRef = db.collection('email_stats').doc(day);
  const sentToday = Number((await statsRef.get()).get('counts.smtp') || 0);
  if (!smtpDailyAllowance(sentToday, parseInt(env('SMTP_DAILY_LIMIT', '1800'), 10))) {
    throw new Error(`System SMTP daily limit reached (${sentToday}).`);
  }

  const getTransport = async () => {
    const key = `${config.host}|${config.port}|${config.user}`;
    if (!systemTransport || systemTransport.key !== key) {
      systemTransport?.transport.close?.();
      // Resolved once per pooled transport; Gmail rotates IPs, all of them must be public.
      const ip = await resolvePublicHost(config.host);
      systemTransport = {
        key,
        transport: nodemailer().createTransport({
          host: ip,
          port: config.port,
          ...security,
          pool: true,
          maxConnections: 1,
          auth: { user: config.user, pass: config.pass },
          tls: { rejectUnauthorized: true, servername: config.host, minVersion: 'TLSv1.2' },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 30000
        })
      };
    }
    return systemTransport.transport;
  };
  const fromName = env('SMTP_FROM_NAME', 'ProjectFlow');
  for (let attempt = 0; ; attempt++) {
    const wait = smtpLimiter.reserve();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      const transport = await getTransport();
      const info = await transport.sendMail({
        from: { name: fromName, address: config.fromEmail },
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        headers: Object.fromEntries(mail.headers.map((h) => [h.Name, h.Value]))
      });
      await statsRef.set({ day, counts: { smtp: FieldValue.increment(1), send: FieldValue.increment(1) }, byType: { [mail.type]: { send: FieldValue.increment(1) } }, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        .catch((error) => console.warn('email_stats update failed', error?.code));
      return info.messageId as string;
    } catch (error: any) {
      // 4xx = temporary (Gmail rate limit 421/454), network errors; 5xx = permanent.
      const code = Number(error?.responseCode || 0);
      const temporary = (code >= 400 && code < 500) || ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'ECONNRESET'].includes(error?.code);
      if (attempt >= 2 || !temporary) throw error;
      systemTransport?.transport.close?.();
      systemTransport = null;
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt + 1)));
    }
  }
};

const sendViaSmtp = async (
  config: { host: string; port: number; secure: boolean; user: string; pass: string; fromEmail: string },
  mail: { to: string; subject: string; html: string; text: string; replyTo: string; headers: { Name: string; Value: string }[] },
  pinnedIp?: string
) => {
  if (!config.host || !config.pass) {
    throw new Error('SMTP is not configured (SMTP_HOST / SMTP_PASS).');
  }
  const transporter = nodemailer().createTransport({
    host: pinnedIp || config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: true, servername: pinnedIp && !net.isIP(config.host) ? config.host : undefined },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });
  const info = await transporter.sendMail({
    from: `"ProjectFlow" <${config.fromEmail}>`,
    to: mail.to,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: Object.fromEntries(mail.headers.map((h) => [h.Name, h.Value]))
  });
  return info.messageId as string;
};

let sesClient: SESv2Client | null = null;
const limiter = new SendRateLimiter(parseFloat(env('SES_MAX_SEND_RATE', '1')) || 1);
let rateCheckedAt = 0;

const sesCredentials = () => {
  const accessKeyId = env('AWS_SES_ACCESS_KEY_ID');
  const secretAccessKey = env('AWS_SES_SECRET_ACCESS_KEY');
  // Placeholder values keep deploys working before the real IAM key is set.
  if (!accessKeyId || !secretAccessKey || accessKeyId === 'unset' || secretAccessKey === 'unset') return null;
  return { accessKeyId, secretAccessKey };
};

const getSesClient = () => {
  const credentials = sesCredentials();
  if (!credentials) return null;
  if (!sesClient) {
    sesClient = new (sesSdk().SESv2Client)({ region: env('SES_REGION', 'eu-north-1'), credentials, maxAttempts: 1 });
  }
  return sesClient;
};

/** Paces to the account's max send rate (GetAccount, refreshed every 10 minutes). */
const awaitSendSlot = async (client: SESv2Client) => {
  if (Date.now() - rateCheckedAt > 10 * 60_000) {
    rateCheckedAt = Date.now();
    try {
      const account = await client.send(new (sesSdk().GetAccountCommand)({}));
      const rate = account.SendQuota?.MaxSendRate;
      if (rate) limiter.setRate(rate);
    } catch (error: any) {
      console.warn('SES GetAccount failed, keeping send rate', error?.name);
    }
  }
  const wait = limiter.reserve();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
};

const sendViaSes = async (
  client: SESv2Client,
  mail: { to: string; subject: string; html: string; text: string; replyTo: string; headers: { Name: string; Value: string }[]; type: EmailType }
) => {
  const configurationSet = env('SES_CONFIGURATION_SET', 'projectflow-default');
  const command = new (sesSdk().SendEmailCommand)({
    FromEmailAddress: sesFrom(),
    Destination: { ToAddresses: [mail.to] },
    ReplyToAddresses: mail.replyTo ? [mail.replyTo] : undefined,
    ConfigurationSetName: configurationSet === 'none' ? undefined : configurationSet,
    EmailTags: [
      { Name: 'type', Value: sesTagValue(mail.type) },
      { Name: 'category', Value: NON_TRANSACTIONAL.has(mail.type) ? 'list' : 'transactional' }
    ],
    Content: {
      Simple: {
        Subject: { Data: mail.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: mail.html, Charset: 'UTF-8' }, Text: { Data: mail.text, Charset: 'UTF-8' } },
        Headers: mail.headers.length ? mail.headers : undefined
      }
    }
  });
  for (let attempt = 0; ; attempt++) {
    await awaitSendSlot(client);
    try {
      const out = await client.send(command);
      return out.MessageId;
    } catch (error: any) {
      if (attempt >= 3 || !isRetryableSendError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    }
  }
};

/** Mirrors a manual change to the SES account-level suppression list (best effort, needs the IAM permissions in email-ses.md). */
export const syncSesAccountSuppression = async (email: string, suppress: boolean, reason: 'BOUNCE' | 'COMPLAINT' = 'BOUNCE') => {
  const client = getSesClient();
  if (!client) return 'skipped';
  try {
    if (suppress) {
      await client.send(new (sesSdk().PutSuppressedDestinationCommand)({ EmailAddress: normalizeEmail(email), Reason: reason }));
    } else {
      await client.send(new (sesSdk().DeleteSuppressedDestinationCommand)({ EmailAddress: normalizeEmail(email) }));
    }
    return 'ok';
  } catch (error: any) {
    if (error?.name === 'NotFoundException') return 'ok';
    console.warn('SES account suppression sync failed', error?.name);
    return 'failed';
  }
};

/** True when the address is on the suppression list (hard bounce, complaint, manual). */
export const isEmailSuppressed = async (email: string): Promise<boolean> => {
  try {
    const snap = await db.collection('email_suppressions').doc(suppressionId(email)).get();
    return isActiveSuppression(snap.data());
  } catch (error) {
    console.warn('Suppression lookup failed, sending anyway', error);
    return false;
  }
};

/**
 * Sends one system mail. Order: suppression list → tenant SMTP (workspace setting) →
 * SES (default, EMAIL_TRANSPORT=ses) → system SMTP (EMAIL_TRANSPORT=smtp, or as sandbox
 * fallback with EMAIL_SMTP_FALLBACK=true when SES rejects an unverified recipient).
 */
export const sendEmail = async (to: string, subject: string, html: string, options: EmailSendOptions = {}): Promise<SendEmailResult> => {
  const recipient = normalizeEmail(to);
  const type: EmailType = options.type || 'system';
  if (await isEmailSuppressed(recipient)) {
    console.log(`Email suppressed (type=${type}, id=${suppressionId(recipient).slice(0, 8)})`);
    return { transport: 'suppressed' };
  }
  const headers = options.unsubscribeUrl ? listUnsubscribeHeaders(options.unsubscribeUrl) : [];
  const mail = { to: recipient, subject, html, text: options.text || stripHtml(html), replyTo: options.replyTo || replyToDefault(), headers, type };

  const tenantSmtp = await getTenantSmtpConfig(options.tenantId);
  if (tenantSmtp) {
    // Workspace-controlled host: public IPs and mail ports only, resolved IP pinned (audit M9).
    if (!isAllowedSmtpPort(tenantSmtp.port)) throw new Error('Workspace SMTP port is not allowed.');
    const ip = await resolvePublicHost(tenantSmtp.host);
    const messageId = await sendViaSmtp({ ...tenantSmtp, fromEmail: options.fromEmail || tenantSmtp.fromEmail }, mail, ip);
    return { transport: 'tenant-smtp', messageId };
  }

  const client = env('EMAIL_TRANSPORT', 'ses') === 'smtp' ? null : getSesClient();
  if (!client) {
    if (env('EMAIL_TRANSPORT', 'ses') !== 'smtp') console.warn('SES credentials missing, using system SMTP');
    const messageId = await sendViaSystemSmtp(mail);
    console.log(`SMTP sent type=${type} messageId=${messageId}`);
    return { transport: 'smtp', messageId };
  }
  try {
    const messageId = await sendViaSes(client, mail);
    console.log(`SES sent type=${type} messageId=${messageId}`);
    return { transport: 'ses', messageId };
  } catch (error: any) {
    const sandboxReject = error?.name === 'MessageRejected' && /not verified/i.test(String(error?.message || ''));
    if (sandboxReject && env('EMAIL_SMTP_FALLBACK') === 'true') {
      console.warn('SES sandbox rejected the recipient, falling back to SMTP');
      const messageId = await sendViaSystemSmtp(mail);
      return { transport: 'smtp', messageId };
    }
    console.error(`SES send failed type=${type}`, error?.name, error?.message);
    throw error;
  }
};

export { getSystemEmailTemplate, getNotificationEmailTemplate, EMAIL_IMPRINT } from './email-template';
