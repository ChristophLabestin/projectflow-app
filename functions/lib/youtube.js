"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.youtubeCallback = exports.getYouTubeAuthUrl = void 0;
const functions = require("firebase-functions");
const google_auth_library_1 = require("google-auth-library");
const init_1 = require("./init");
// TODO: User to provide these
const CLIENT_ID = '69028404212-6omiot90lrpgouq53tbhjuqbug03bg9s.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const getFunctionUrl = (name) => {
    // We use the rewrite on the main domain
    return `https://app.getprojectflow.com/${name}`;
};
const getOAuthClient = () => {
    return new google_auth_library_1.OAuth2Client(CLIENT_ID, CLIENT_SECRET, getFunctionUrl('youtubeCallback'));
};
exports.getYouTubeAuthUrl = functions.region('europe-west3').https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }
    const { projectId, tenantId } = data;
    if (!projectId || !tenantId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing projectId or tenantId');
    }
    const oauth2Client = getOAuthClient();
    // Generate a secure state
    const csrfState = Math.random().toString(36).substring(2);
    const stateObj = {
        projectId,
        tenantId,
        userId: context.auth.uid,
        csrf: csrfState
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: state,
        prompt: 'consent' // Force consent to ensure we get a refresh token
    });
    return { url };
});
exports.youtubeCallback = functions.region('europe-west3').https.onRequest(async (req, res) => {
    var _a, _b;
    const { code, state, error } = req.query;
    if (error) {
        res.status(400).send(`Error from Google: ${error}`);
        return;
    }
    if (!code || !state) {
        res.status(400).send('Missing code or state parameters');
        return;
    }
    try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        const { projectId, tenantId, userId } = decodedState;
        const oauth2Client = getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        // Fetch User Info (Channel)
        // We can't use googleapis package directly unless we install it, but we can fetch via REST
        const channelResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`
            }
        });
        const channelData = await channelResp.json();
        if (channelData.error) {
            throw new Error(channelData.error.message || JSON.stringify(channelData));
        }
        const channel = channelData.items && channelData.items[0];
        if (!channel) {
            throw new Error("No YouTube channel found for this account.");
        }
        const integrationsRef = init_1.db.collection('tenants').doc(tenantId)
            .collection('projects').doc(projectId)
            .collection('social_integrations');
        const channelId = channel.id;
        // Check for existing
        const existingQuery = await integrationsRef.where('platform', '==', 'YouTube')
            .where('channelId', '==', channelId).get();
        const integrationData = {
            platform: 'YouTube',
            projectId,
            authUserId: userId,
            username: channel.snippet.title,
            profilePictureUrl: (_b = (_a = channel.snippet.thumbnails) === null || _a === void 0 ? void 0 : _a.default) === null || _b === void 0 ? void 0 : _b.url,
            channelId: channelId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            status: 'Connected',
            connectedAt: new Date().toISOString(),
            expiryDate: tokens.expiry_date,
            scope: tokens.scope
        };
        // If we are re-connecting, we might not get a new refresh token unless 'prompt: consent' was used.
        // If tokens.refresh_token is undefined, we should NOT overwrite the existing one if it exists.
        if (!tokens.refresh_token && !existingQuery.empty) {
            delete integrationData.refreshToken;
        }
        if (!existingQuery.empty) {
            await existingQuery.docs[0].ref.update(integrationData);
        }
        else {
            await integrationsRef.add(integrationData);
        }
        res.send(`
            <html>
                <body>
                    <h1>Connected to YouTube!</h1>
                    <p>You can close this window now.</p>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'YOUTUBE_CONNECTED', platform: 'YouTube' }, '*');
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
    }
    catch (e) {
        console.error("YouTube Callback Error", e);
        res.status(500).send('Authentication processing failed: ' + e.message);
    }
});
//# sourceMappingURL=youtube.js.map