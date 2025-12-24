"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSMTPConnection = void 0;
const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const REGION = 'europe-west3'; // Frankfurt
exports.testSMTPConnection = functions.region(REGION).https.onCall(async (data, context) => {
    const { host, port, user, pass, secure } = data;
    if (!host || !user || !pass) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing SMTP credentials');
    }
    try {
        const transporter = nodemailer.createTransport({
            host,
            port: parseInt(port) || 587,
            secure: secure || false,
            auth: {
                user,
                pass
            },
            tls: {
                rejectUnauthorized: false // Often needed for development/self-signed certs
            }
        });
        await transporter.verify();
        return { success: true, message: 'SMTP Connection Successful' };
    }
    catch (error) {
        console.error('SMTP Test Error:', error);
        return { success: false, error: error.message || 'Failed to connect' };
    }
});
//# sourceMappingURL=email.js.map