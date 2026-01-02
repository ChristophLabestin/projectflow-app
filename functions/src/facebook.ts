
import * as functions from 'firebase-functions';
import { db } from './init';

const getFunctionUrl = (name: string) => {
    const projectId = process.env.GCLOUD_PROJECT || 'project-manager-9d0ad';
    const region = 'europe-west3';
    return `https://${region}-${projectId}.cloudfunctions.net/${name}`;
};

export const getFacebookAuthUrl = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }

    const { projectId, tenantId } = data;
    if (!projectId || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing projectId or tenantId');
    }

    const CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;

    if (!CLIENT_ID) {
        throw new functions.https.HttpsError('failed-precondition', 'Facebook Client ID not configured');
    }

    const redirectUri = getFunctionUrl('facebookCallback');
    const csrfState = Math.random().toString(36).substring(2);

    // Create state object
    const stateObj = {
        projectId,
        tenantId,
        userId: context.auth.uid,
        csrf: csrfState
    };

    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');

    // Scopes for Instagram and Pages
    const scopes = [
        'email',
        'pages_show_list',
        'pages_read_engagement',
        'instagram_basic',
        'instagram_content_publish',
        'business_management'
    ].join(',');

    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes}`;

    return { url };
});

export const facebookCallback = functions.region('europe-west3').https.onRequest(async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        res.status(400).send(`Error from Facebook: ${error}`);
        return;
    }

    if (!code || !state) {
        res.status(400).send('Missing code or state parameters');
        return;
    }

    try {
        const CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;
        const CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
            throw new Error('Facebook config missing in backend');
        }

        const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString());
        const { projectId, tenantId, userId } = decodedState;

        const redirectUri = getFunctionUrl('facebookCallback');

        // 1. Exchange Code for Short-Lived Token
        const tokenResp = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${CLIENT_SECRET}&code=${code}`);
        const tokenData: any = await tokenResp.json();

        if (tokenData.error) {
            throw new Error(tokenData.error.message);
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange for Long-Lived Token
        const longLivedResp = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&fb_exchange_token=${shortLivedToken}`);
        const longLivedData: any = await longLivedResp.json();

        if (longLivedData.error) {
            throw new Error(longLivedData.error.message);
        }

        const accessToken = longLivedData.access_token;

        // 3. Get User Info
        const userResp = await fetch(`https://graph.facebook.com/me?fields=id,name,picture&access_token=${accessToken}`);
        const userData: any = await userResp.json();

        if (userData.error) {
            throw new Error(userData.error.message);
        }

        // 4. Save to Firestore as "PendingSetup"
        const integrationsRef = db.collection('tenants').doc(tenantId)
            .collection('projects').doc(projectId)
            .collection('social_integrations');

        const integrationData = {
            platform: 'FacebookData', // Intermediate type
            projectId,
            authUserId: userId,
            facebookUserId: userData.id,
            username: userData.name,
            profilePictureUrl: userData.picture?.data?.url || '',
            accessToken: accessToken,
            status: 'PendingSetup',
            connectedAt: new Date().toISOString(),
            isProjectLevel: true // Flag to distinguish from old connections
        };

        await integrationsRef.add(integrationData);

        // 5. Return success script
        res.send(`
            <html>
                <body>
                    <h1>Connected!</h1>
                    <p>Redirecting back to ProjectFlow...</p>
                    <script>
                        // Send message to opener
                        if (window.opener) {
                            window.opener.postMessage({ type: 'FACEBOOK_CONNECTED', platform: 'Facebook' }, '*');
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);

    } catch (e: any) {
        console.error("Facebook Callback Error", e);
        res.status(500).send('Authentication processing failed: ' + e.message);
    }
});
