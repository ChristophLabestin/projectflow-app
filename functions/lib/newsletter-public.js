"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmNewsletterSignup = exports.requestNewsletterSignup = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");
const email_1 = require("./email");
const db = admin.firestore();
const REGION = 'europe-west3';
const CORS_ORIGIN = true;
// Helper to generate a unique code
const generateCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
};
exports.requestNewsletterSignup = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        // 1. Validate Request
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ success: false, error: 'Missing required field: email' });
            return;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, error: 'Invalid email format' });
            return;
        }
        try {
            console.log(`Processing newsletter signup request for ${email}`);
            const code = generateCode();
            const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 4 * 60 * 60 * 1000); // 4 hours
            const pendingData = {
                email,
                code,
                expiresAt,
                confirmed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            const batch = db.batch();
            // 1. Add to 'newsletter_pending' collection
            const pendingRef = db.collection('newsletter_pending').doc();
            batch.set(pendingRef, pendingData);
            await batch.commit();
            // 2. Send Email
            const link = `https://getprojectflow.com/confirmNewsletterSignup?code=${code}`;
            const subject = 'Confirm your subscription';
            const html = (0, email_1.getSystemEmailTemplate)('Confirm Newsletter Subscription', "You're one step away from receiving the latest updates, tips, and news from ProjectFlow. Please confirm your email address to subscribe.", link, 'Confirm Subscription');
            await (0, email_1.sendEmail)(email, subject, html);
            res.status(200).json({ success: true, message: 'Confirmation email sent' });
        }
        catch (error) {
            console.error('Error processing newsletter signup:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});
exports.confirmNewsletterSignup = functions.region(REGION).https.onRequest((req, res) => {
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
            console.log(`Confirming newsletter code: ${code}`);
            // Find the pending request
            const snapshot = await db.collection('newsletter_pending')
                .where('code', '==', code)
                .where('confirmed', '==', false)
                .limit(1)
                .get();
            if (snapshot.empty) {
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
            batch.update(doc.ref, { confirmed: true, confirmedAt: admin.firestore.FieldValue.serverTimestamp() });
            // 2. Add/Update 'newsletter_subscribers' collection (base level, email as ID)
            const subscriberRef = db.collection('newsletter_subscribers').doc(requestData.email);
            batch.set(subscriberRef, {
                email: requestData.email,
                subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'landing_page',
                status: 'active'
            }, { merge: true });
            await batch.commit();
            res.status(200).json({ success: true, message: 'Newsletter subscription confirmed' });
        }
        catch (error) {
            console.error('Error confirming newsletter signup:', error);
            res.status(500).json({ success: false, error: 'Failed to confirm subscription' });
        }
    });
});
//# sourceMappingURL=newsletter-public.js.map