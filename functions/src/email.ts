import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';
const REGION = 'europe-west3'; // Frankfurt

export const testSMTPConnection = functions.region(REGION).https.onCall(async (data, context) => {
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
    } catch (error: any) {
        console.error('SMTP Test Error details:', error);
        return {
            success: false,
            error: error.message || 'Failed to connect',
            code: error.code,
            command: error.command
        };
    }
});

// Helper to create a reuseable transporter
const createTransporter = () => {
    // Ideally use functions.config() but for now use user provided as fallback or env
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER || 'christoph@christophlabestin.de';
    // IMPORTANT: User must set this env var or config
    const pass = process.env.SMTP_PASS || functions.config().smtp?.pass || 'nadm vtnn pgsj kxhr';

    if (!pass) {
        console.warn("SMTP Password not set! Emails will fail.");
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
            user,
            pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: '"ProjectFlow" <no-reply@getprojectflow.com>', // sender address
        to,
        subject,
        html
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
