import * as functions from 'firebase-functions/v1';
import * as crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { EMAIL_SECRETS, sendEmail } from './email';
import { corsMiddleware } from './corsConfig';
import { db } from './init';

const REGION = 'europe-west3';

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_COLLECTION = 'contact_rate_limits';

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/** Returns false when the IP exceeded RATE_LIMIT_MAX submissions in the window. */
const consumeRateLimit = async (ip: string): Promise<boolean> => {
    const key = crypto.createHash('sha256').update(ip).digest('hex');
    const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key);
    return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const now = Date.now();
        const data = snap.data();
        const windowStart = typeof data?.windowStart === 'number' ? data.windowStart : 0;
        const inWindow = now - windowStart < RATE_LIMIT_WINDOW_MS;
        const count = inWindow ? Number(data?.count || 0) : 0;
        if (count >= RATE_LIMIT_MAX) {
            return false;
        }
        tx.set(ref, {
            windowStart: inWindow ? windowStart : now,
            count: count + 1,
            updatedAt: FieldValue.serverTimestamp()
        });
        return true;
    });
};

export const sendContactFormEmail = functions.region(REGION).runWith({ secrets: EMAIL_SECRETS }).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        const body = req.body || {};

        // Honeypot: real users never fill this hidden field. Pretend success.
        if (typeof body.website === 'string' && body.website.trim() !== '') {
            res.status(200).json({ success: true, message: 'Message sent successfully' });
            return;
        }

        // 1. Validate Request
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const email = typeof body.email === 'string' ? body.email.trim() : '';
        const message = typeof body.message === 'string' ? body.message.trim() : '';

        if (!name || !email || !message) {
            res.status(400).json({ success: false, error: 'Missing required fields: name, email, or message' });
            return;
        }

        if (name.length > MAX_NAME_LENGTH || email.length > MAX_EMAIL_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
            res.status(400).json({ success: false, error: 'Input too long' });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, error: 'Invalid email format' });
            return;
        }

        try {
            const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
            if (!(await consumeRateLimit(ip))) {
                res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
                return;
            }

            const subject = `New Contact Form Submission from ${name.replace(/[\r\n]+/g, ' ')}`;
            const html = `
                <h2>New Contact Message</h2>
                <p><strong>Name:</strong> ${escapeHtml(name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
            `;

            // Send email to admin
            await sendEmail('hello@getprojectflow.com', subject, html, { type: 'contact' });

            res.status(200).json({ success: true, message: 'Message sent successfully' });

        } catch (error: any) {
            console.error('Error processing contact form submission:', error);
            res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
    });
});
