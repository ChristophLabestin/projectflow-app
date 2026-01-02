"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoStartSprints = exports.debugScheduler = exports.checkScheduledPosts = exports.publishScheduledPosts = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const init_1 = require("./init");
const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';
async function publishInstagramPhoto(igAccountId, imageUrl, caption, accessToken, log) {
    var _a, _b;
    const logger = log || console.log;
    logger(`Attempting to publish to Instagram Account: ${igAccountId}`);
    // 1. Create Media Container
    const containerResponse = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`, { method: 'POST' });
    const containerData = await containerResponse.json();
    if (containerData.error || !containerData.id) {
        throw new Error(((_a = containerData.error) === null || _a === void 0 ? void 0 : _a.message) || 'Failed to create media container');
    }
    const creationId = containerData.id;
    logger(`Media Container Created: ${creationId}`);
    // 2. Wait a bit for processing (simple delay, though ideally we should poll status)
    await new Promise(r => setTimeout(r, 2000));
    // 3. Publish Media
    const publishResponse = await fetch(`${GRAPH_API_BASE}/${igAccountId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`, { method: 'POST' });
    const publishData = await publishResponse.json();
    if (publishData.error || !publishData.id) {
        throw new Error(((_b = publishData.error) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to publish media');
    }
    return publishData.id;
}
const publishScheduledPosts = async (log) => {
    const logger = log || console.log;
    logger("Scheduler logic triggered.");
    // Check DB connection
    try {
        await init_1.db.collection('tenants').limit(1).get();
        logger("DB Connection check passed.");
    }
    catch (e) {
        logger(`DB Connection check FAILED: ${e.message}`);
        return;
    }
    const now = new Date();
    logger(`Checking for posts scheduled before: ${now.toISOString()}`);
    const snapshot = await init_1.db.collectionGroup('social_posts')
        .where('status', '==', 'Scheduled')
        .where('scheduledFor', '<=', now.toISOString())
        .get();
    if (snapshot.empty) {
        logger("No scheduled posts to publish found.");
        return;
    }
    logger(`Found ${snapshot.size} posts to publish.`);
    const promises = snapshot.docs.map(async (doc) => {
        var _a;
        const post = Object.assign({ id: doc.id }, doc.data());
        logger(`Processing post ${post.id} for ${post.platform}`);
        try {
            // 1. Get Project & Tenant info to find integration
            const projectRef = doc.ref.parent.parent;
            if (!projectRef)
                throw new Error("Could not find parent project");
            logger(`Found project ref: ${projectRef.path}`);
            const integrationsSnap = await projectRef.collection('social_integrations')
                .where('platform', '==', post.platform)
                .limit(1)
                .get();
            if (integrationsSnap.empty) {
                throw new Error(`No ${post.platform} integration found for project ${projectRef.id}`);
            }
            const integration = integrationsSnap.docs[0].data();
            logger(`Found integration for ${post.platform}`);
            if (!integration.accessToken) {
                throw new Error("Integration missing access token");
            }
            let publishedId;
            if (post.platform === 'Instagram') {
                const igId = integration.instagramBusinessAccountId || ((_a = integration.instagram_business_account) === null || _a === void 0 ? void 0 : _a.id);
                if (!igId) {
                    throw new Error("Instagram business account ID not found in integration");
                }
                // Currently only supporting single image for simplicity as per MVP
                if (!post.assets || post.assets.length === 0) {
                    throw new Error("No assets to publish");
                }
                // TODO: Support Carousel/Video
                const imageUrl = post.assets[0].url;
                publishedId = await publishInstagramPhoto(igId, imageUrl, post.content.caption, integration.accessToken, logger);
            }
            else {
                // Other platforms not implemented in this scheduler yet
                logger(`Skipping ${post.platform} post ${post.id} - not implemented in scheduler yet`);
                return;
            }
            // Update status
            await doc.ref.update({
                status: 'Published',
                publishedAt: new Date().toISOString(),
                externalId: publishedId || null,
                error: admin.firestore.FieldValue.delete()
            });
            logger(`Successfully published post ${post.id}`);
        }
        catch (error) {
            logger(`Failed to publish post ${post.id}: ${error.message}`);
            await doc.ref.update({
                status: 'Failed',
                error: error.message || 'Unknown error'
            });
        }
    });
    await Promise.all(promises);
    logger("Finished processing.");
};
exports.publishScheduledPosts = publishScheduledPosts;
exports.checkScheduledPosts = (0, scheduler_1.onSchedule)({ schedule: "every 1 minutes", region: "europe-west3" }, async (event) => {
    await (0, exports.publishScheduledPosts)();
});
exports.debugScheduler = (0, https_1.onRequest)({ region: "europe-west3" }, async (req, res) => {
    const logs = [];
    const log = (msg) => logs.push(msg);
    try {
        await (0, exports.publishScheduledPosts)(log);
        res.status(200).send(`LOGS:\n${logs.join('\n')}`);
    }
    catch (e) {
        res.status(500).send(`ERROR:\n${e.message}\n\nLOGS:\n${logs.join('\n')}`);
    }
});
/**
 * Automatically start sprints that have autoStart enabled and whose startDate has arrived.
 * Runs every hour.
 */
exports.autoStartSprints = (0, scheduler_1.onSchedule)({ schedule: "every 1 hours", region: "europe-west3" }, async (event) => {
    const now = new Date();
    console.log(`[SprintScheduler] Running auto-start check at ${now.toISOString()}`);
    try {
        const snapshot = await init_1.db.collectionGroup('sprints')
            .where('status', '==', 'Planning')
            .where('autoStart', '==', true)
            .get();
        if (snapshot.empty) {
            console.log('[SprintScheduler] No pending auto-start sprints found.');
            return;
        }
        const batch = init_1.db.batch();
        let updateCount = 0;
        snapshot.docs.forEach(doc => {
            var _a;
            const sprint = doc.data();
            // Parse start date
            let startDate;
            if ((_a = sprint.startDate) === null || _a === void 0 ? void 0 : _a.toDate) {
                startDate = sprint.startDate.toDate();
            }
            else {
                startDate = new Date(sprint.startDate);
            }
            // If start date is in the past or now
            if (startDate <= now) {
                console.log(`[SprintScheduler] Starting sprint ${doc.id} (Project: ${sprint.projectId})`);
                batch.update(doc.ref, {
                    status: 'Active',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                updateCount++;
            }
        });
        if (updateCount > 0) {
            await batch.commit();
            console.log(`[SprintScheduler] Successfully started ${updateCount} sprints.`);
        }
        else {
            console.log('[SprintScheduler] Found candidates but none ready to start yet.');
        }
    }
    catch (error) {
        console.error('[SprintScheduler] Error auto-starting sprints:', error);
    }
});
//# sourceMappingURL=scheduler.js.map