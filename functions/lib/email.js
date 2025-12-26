"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSMTPConnection = void 0;
const functions = require("firebase-functions");
const nodemailer = require("nodemailer");
const REGION = 'europe-west3'; // Frankfurt
exports.testSMTPConnection = functions.region(REGION).https.onCall(async (data, context) => {
    console.log('SMTP Test Connection initiated with data:', JSON.stringify(data));
    const { host, port, user, pass, secure } = data;
    if (!host || !user || !pass) {
        console.warn('Missing SMTP credentials in request');
        throw new functions.https.HttpsError('invalid-argument', 'Missing SMTP credentials');
    }
    try {
        const smtpPort = parseInt(port) || 587;
        console.log(`Connecting to ${host}:${smtpPort} (secure: ${!!secure})`);
        const transporter = nodemailer.createTransport({
            host,
            port: smtpPort,
            secure: secure || false,
            auth: {
                user,
                pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        await transporter.verify();
        console.log('SMTP Verification successful');
        return { success: true, message: 'SMTP Connection Successful' };
    }
    catch (error) {
        console.error('SMTP Test Error details:', error);
        return {
            success: false,
            error: error.message || 'Failed to connect',
            code: error.code,
            command: error.command
        };
    }
});
//# sourceMappingURL=email.js.map