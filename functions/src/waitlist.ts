import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';
import { sendEmail } from './email';

const db = admin.firestore();
const REGION = 'europe-west3';
// Allow all origins or restrict to specific domains
// const CORS_ORIGIN = ['https://getprojectflow.com', 'http://localhost:5173']; 
const CORS_ORIGIN = true; // Allowing all for now to match newsletter.ts pattern

// Helper to generate a unique code
const generateCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};

export const requestWaitlist = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        // 1. Validate Request
        const { name, email } = req.body;

        if (!name || !email) {
            res.status(400).json({ success: false, error: 'Missing required fields: name, email' });
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, error: 'Invalid email format' });
            return;
        }

        try {
            console.log(`Processing waitlist request for ${email}`);

            const code = generateCode();
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

            const waitlistData = {
                name,
                email,
                code,
                expiresAt,
                email_confirmed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const batch = db.batch();

            // 1. Add to 'waitlist_pending' collection
            const pendingRef = db.collection('waitlist_pending').doc();
            batch.set(pendingRef, waitlistData);

            // 2. Add/Update 'waitlist' collection (base level, email as ID)
            const waitlistRef = db.collection('waitlist').doc(email);
            batch.set(waitlistRef, {
                name,
                email,
                email_confirmed: false,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await batch.commit();

            // 3. Send Email
            const link = `https://getprojectflow.com/waitlist-confirm?code=${code}`;

            const subject = 'Confirm your spot on the ProjectFlow Waitlist';
            const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Welcome to ProjectFlow!</h2>
                    <p>Hi ${name},</p>
                    <p>Thanks for signing up for our waitlist. Please confirm your email address to secure your spot.</p>
                    <p>This link is valid for 4 hours.</p>
                    <div style="margin: 20px 0;">
                        <a href="${link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Waitlist Spot</a>
                    </div>
                    <p style="font-size: 12px; color: #888;">If you didn't request this, please ignore this email.</p>
                </div>
            `;

            await sendEmail(email, subject, html);

            res.status(200).json({ success: true, message: 'Confirmation email sent' });

        } catch (error: any) {
            console.error('Error processing waitlist request:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});

export const confirmWaitlist = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        const { code } = req.body;

        if (!code) {
            res.status(400).json({ success: false, error: 'Missing confirmation code' });
            return;
        }

        try {
            console.log(`Confirming waitlist code: ${code}`);

            // Find the pending request
            const snapshot = await db.collection('waitlist_pending')
                .where('code', '==', code)
                .where('email_confirmed', '==', false) // Note: using the same field name as stored? Stored as email_confirmed in 'waitlist' but 'confirmed' was old field. Updated to email_confirmed in requestWaitlist above.
                // Wait, in previous requestWaitlist, I generated waitlistData with `email_confirmed: false`.
                // Existing data might have `confirmed`. I should check what is consistent.
                // I will use `email_confirmed` for consistency with the new field logic.
                // Assuming this is a fresh deploy or I should handle both? 
                // Let's stick to `email_confirmed` as per previous step.
                .limit(1)
                .get();

            if (snapshot.empty) {
                // Fallback check for 'confirmed' if we had migration issues, but for now let's assume valid.
                // Wait, if I'm searching 'waitlist_pending', its schema was just defined in requestWaitlist.
                // In requestWaitlist I wrote `email_confirmed: false`. Good.

                res.status(404).json({ success: false, error: 'Invalid or already confirmed code' });
                return;
            }

            const doc = snapshot.docs[0];
            const requestData = doc.data();

            // Check expiration
            const expiresAt = requestData.expiresAt.toDate();
            if (Date.now() > expiresAt.getTime()) {
                res.status(412).json({ success: false, error: 'Confirmation code expired' });
                return;
            }

            const batch = db.batch();

            // 1. Mark pending doc as confirmed
            batch.update(doc.ref, { email_confirmed: true, confirmedAt: admin.firestore.FieldValue.serverTimestamp() });

            // 2. Update 'waitlist' collection (base level, email as ID)
            const waitlistRef = db.collection('waitlist').doc(requestData.email);
            batch.set(waitlistRef, {
                email_confirmed: true,
                confirmed_at: admin.firestore.FieldValue.serverTimestamp(),
                source: 'waitlist_confirmation'
            }, { merge: true });

            await batch.commit();

            res.status(200).json({ success: true, message: 'Waitlist confirmed successfully' });

        } catch (error: any) {
            console.error('Error confirming waitlist:', error);
            res.status(500).json({ success: false, error: 'Failed to confirm waitlist' });
        }
    });
});
