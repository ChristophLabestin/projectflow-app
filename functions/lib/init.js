"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = exports.db = void 0;
const admin = require("firebase-admin");
// Initialize Firebase Admin globally once
if (!admin.apps.length) {
    // Check for service account key for local dev
    try {
        // When running in functions shell/emulator, PWD might be different, but require resolves relative to the file.
        // functions/lib/init.js -> functions/service-account.json
        const serviceAccount = require('../service-account.json');
        console.log('Init: Loading service account:', {
            client_email: serviceAccount.client_email,
            project_id: serviceAccount.project_id,
            has_private_key: !!serviceAccount.private_key,
            private_key_length: serviceAccount.private_key ? serviceAccount.private_key.length : 0
        });
        // Ensure private key string has correct newlines
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            serviceAccountId: serviceAccount.client_email // Explicitly set serviceAccountId
        });
        console.log('Init: Initialized Firebase Admin with local service account.');
    }
    catch (e) {
        console.error('Init: Failed to load service account', e);
        // Fallback to default (Cloud environment or no key)
        console.log('Init: Initializing Firebase Admin with default credentials.');
        admin.initializeApp();
    }
}
exports.db = admin.firestore();
exports.auth = admin.auth();
//# sourceMappingURL=init.js.map