"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tiktokCallback = exports.getTikTokAuthUrl = void 0;
const functions = require("firebase-functions");
const init_1 = require("./init");
const CLIENT_KEY = 'aw6g76sf9ks0fydb';
const CLIENT_SECRET = 'BqixSWhlVlKX8mD6IJJOWz8ZPMjlm7RW';
const getFunctionUrl = (name) => {
    // We use the rewrite on the main domain
    return `https://app.getprojectflow.com/${name}`;
};
exports.getTikTokAuthUrl = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }
    const { projectId, tenantId } = data;
    if (!projectId || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing projectId or tenantId');
    }
    const redirectUri = getFunctionUrl('tiktokCallback');
    const csrfState = Math.random().toString(36).substring(2);
    // Create state object
    const stateObj = {
        projectId,
        tenantId,
        userId: context.auth.uid,
        csrf: csrfState
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    const scopes = 'user.info.basic,video.list,video.upload';
    const url = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&response_type=code&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    return { url };
});
exports.tiktokCallback = functions.region('europe-west3').https.onRequest(async (req, res) => {
    const { code, state, error } = req.query;
    if (error) {
        res.status(400).send(`Error from TikTok: ${error}`);
        return;
    }
    if (!code || !state) {
        res.status(400).send('Missing code or state parameters');
        return;
    }
    try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        const { projectId, tenantId, userId } = decodedState;
        const redirectUri = getFunctionUrl('tiktokCallback');
        // Exchange code for tokens
        const tokenParams = new URLSearchParams();
        tokenParams.append('client_key', CLIENT_KEY);
        tokenParams.append('client_secret', CLIENT_SECRET);
        tokenParams.append('code', code);
        tokenParams.append('grant_type', 'authorization_code');
        tokenParams.append('redirect_uri', redirectUri);
        const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: tokenParams
        });
        const tokenData = await tokenResp.json();
        if (tokenData.error) {
            throw new Error(tokenData.error_description || JSON.stringify(tokenData));
        }
        const { access_token, open_id, expires_in, refresh_token, refresh_expires_in } = tokenData;
        // Fetch User Info
        const userResp = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url', {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });
        const userData = await userResp.json();
        if (userData.error) {
            throw new Error(userData.error.message || JSON.stringify(userData));
        }
        const userInfo = userData.data.user;
        // Save to Firestore
        const integrationsRef = init_1.db.collection('tenants').doc(tenantId)
            .collection('projects').doc(projectId)
            .collection('social_integrations');
        // Check for existing
        const existingQuery = await integrationsRef.where('platform', '==', 'TikTok')
            .where('openId', '==', open_id).get();
        const integrationData = {
            platform: 'TikTok',
            projectId,
            authUserId: userId,
            username: userInfo.display_name,
            profilePictureUrl: userInfo.avatar_url,
            accessToken: access_token,
            refreshToken: refresh_token,
            openId: open_id,
            status: 'Connected',
            connectedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
            refreshExpiresAt: new Date(Date.now() + refresh_expires_in * 1000).toISOString()
        };
        if (!existingQuery.empty) {
            await existingQuery.docs[0].ref.update(integrationData);
        }
        else {
            await integrationsRef.add(integrationData);
        }
        // Return success script
        res.send(`
            <html>
                <body>
                    <h1>Connected!</h1>
                    <p>You can close this window now.</p>
                    <script>
                        // Send message to opener
                        if (window.opener) {
                            window.opener.postMessage({ type: 'TIKTOK_CONNECTED', platform: 'TikTok' }, '*');
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
    }
    catch (e) {
        console.error("TikTok Callback Error", e);
        res.status(500).send('Authentication processing failed: ' + e.message);
    }
});
//# sourceMappingURL=tiktok.js.map