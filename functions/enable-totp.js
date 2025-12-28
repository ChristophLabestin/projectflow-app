const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');

// Initialize with default credentials
admin.initializeApp();

async function enableTOTP() {
    try {
        const auth = getAuth();
        console.log('Fetching project configuration...');

        await auth.projectConfigManager().updateProjectConfig({
            multiFactorConfig: {
                providerConfigs: [{
                    state: "ENABLED",
                    totpProviderConfig: {
                        adjacentIntervals: 5
                    }
                }]
            }
        });

        console.log('Successfully enabled TOTP MFA support!');
        process.exit(0);
    } catch (error) {
        console.error('Error enabling TOTP MFA:', error);
        process.exit(1);
    }
}

enableTOTP();
