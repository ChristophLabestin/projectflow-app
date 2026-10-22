import * as admin from 'firebase-admin';

// Initialize Firebase Admin globally once
if (!admin.apps.length) {
    // Check for service account key for local dev
    try {
        // When running in functions shell/emulator, PWD might be different, but require resolves relative to the file.
        // functions/lib/init.js -> functions/service-account.json
        const serviceAccount = require('../service-account.json');
        // Ensure private key string has correct newlines
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            serviceAccountId: serviceAccount.client_email // Explicitly set serviceAccountId
        });
    } catch {
        // No local key (deployed functions, emulator): default credentials.
        admin.initializeApp();
    }
}

export const db = admin.firestore();
export const auth = admin.auth();
