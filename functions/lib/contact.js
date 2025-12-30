"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendContactFormEmail = void 0;
const functions = require("firebase-functions");
const email_1 = require("./email");
const corsConfig_1 = require("./corsConfig");
const REGION = 'europe-west3';
exports.sendContactFormEmail = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        // 1. Validate Request
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            res.status(400).json({ success: false, error: 'Missing required fields: name, email, or message' });
            return;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            res.status(400).json({ success: false, error: 'Invalid email format' });
            return;
        }
        try {
            console.log(`Processing contact form submission from ${email}`);
            const subject = `New Contact Form Submission from ${name}`;
            const html = `
                <h2>New Contact Message</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Message:</strong></p>
                <p style="white-space: pre-wrap;">${message}</p>
            `;
            // Send email to admin
            await (0, email_1.sendEmail)('hello@getprojectflow.com', subject, html);
            res.status(200).json({ success: true, message: 'Message sent successfully' });
        }
        catch (error) {
            console.error('Error processing contact form submission:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});
//# sourceMappingURL=contact.js.map