import { onSchedule } from "firebase-functions/v2/scheduler";
import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "./init";

// Types locally defined since we can't easily import from root in this setup
type SocialPlatform = 'Instagram' | 'Facebook' | 'LinkedIn' | 'TikTok' | 'X' | 'YouTube';

interface SocialPost {
    id: string;
    projectId: string;
    platform: SocialPlatform;
    content: {
        caption: string;
    };
    assets: { url: string; type: 'image' | 'video' }[];
    status: string;
    scheduledFor?: string;
}

interface SocialIntegration {
    id: string;
    platform: SocialPlatform;
    accessToken?: string;
    instagram_business_account?: {
        id: string;
    };
    instagramBusinessAccountId?: string;
}

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

async function publishInstagramPhoto(igAccountId: string, imageUrl: string, caption: string, accessToken: string, log?: (msg: string) => void) {
    const logger = log || console.log;
    logger(`Attempting to publish to Instagram Account: ${igAccountId}`);
    // 1. Create Media Container
    const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${accessToken}`,
        { method: 'POST' }
    );
    const containerData = await containerResponse.json();

    if (containerData.error || !containerData.id) {
        throw new Error(containerData.error?.message || 'Failed to create media container');
    }

    const creationId = containerData.id;
    logger(`Media Container Created: ${creationId}`);

    // 2. Wait a bit for processing (simple delay, though ideally we should poll status)
    await new Promise(r => setTimeout(r, 2000));

    // 3. Publish Media
    const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${igAccountId}/media_publish?creation_id=${creationId}&access_token=${accessToken}`,
        { method: 'POST' }
    );
    const publishData = await publishResponse.json();

    if (publishData.error || !publishData.id) {
        throw new Error(publishData.error?.message || 'Failed to publish media');
    }

    return publishData.id;
}

export const publishScheduledPosts = async (log?: (msg: string) => void) => {
    const logger = log || console.log;
    logger("Scheduler logic triggered.");

    // Check DB connection
    try {
        await db.collection('tenants').limit(1).get();
        logger("DB Connection check passed.");
    } catch (e: any) {
        logger(`DB Connection check FAILED: ${e.message}`);
        return;
    }

    const now = new Date();
    logger(`Checking for posts scheduled before: ${now.toISOString()}`);

    const snapshot = await db.collectionGroup('social_posts')
        .where('status', '==', 'Scheduled')
        .where('scheduledFor', '<=', now.toISOString())
        .get();

    if (snapshot.empty) {
        logger("No scheduled posts to publish found.");
        return;
    }

    logger(`Found ${snapshot.size} posts to publish.`);

    const promises = snapshot.docs.map(async (doc) => {
        const post = { id: doc.id, ...doc.data() } as SocialPost;
        logger(`Processing post ${post.id} for ${post.platform}`);

        try {
            // 1. Get Project & Tenant info to find integration
            const projectRef = doc.ref.parent.parent;
            if (!projectRef) throw new Error("Could not find parent project");

            logger(`Found project ref: ${projectRef.path}`);

            const integrationsSnap = await projectRef.collection('social_integrations')
                .where('platform', '==', post.platform)
                .limit(1)
                .get();

            if (integrationsSnap.empty) {
                throw new Error(`No ${post.platform} integration found for project ${projectRef.id}`);
            }

            const integration = integrationsSnap.docs[0].data() as SocialIntegration;
            logger(`Found integration for ${post.platform}`);

            if (!integration.accessToken) {
                throw new Error("Integration missing access token");
            }

            let publishedId: string | undefined;

            if (post.platform === 'Instagram') {
                const igId = integration.instagramBusinessAccountId || integration.instagram_business_account?.id;

                if (!igId) {
                    throw new Error("Instagram business account ID not found in integration");
                }

                // Currently only supporting single image for simplicity as per MVP
                if (!post.assets || post.assets.length === 0) {
                    throw new Error("No assets to publish");
                }

                // TODO: Support Carousel/Video
                const imageUrl = post.assets[0].url;
                publishedId = await publishInstagramPhoto(
                    igId,
                    imageUrl,
                    post.content.caption,
                    integration.accessToken,
                    logger
                );
            } else {
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

        } catch (error: any) {
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

export const checkScheduledPosts = onSchedule({ schedule: "every 1 minutes", region: "europe-west3" }, async (event) => {
    await publishScheduledPosts();
});

export const debugScheduler = onRequest({ region: "europe-west3" }, async (req, res) => {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    try {
        await publishScheduledPosts(log);
        res.status(200).send(`LOGS:\n${logs.join('\n')}`);
    } catch (e: any) {
        res.status(500).send(`ERROR:\n${e.message}\n\nLOGS:\n${logs.join('\n')}`);
    }
});

// ─────────────────────────────────────────────────────────────
// Sprint Auto-Start Scheduler
// ─────────────────────────────────────────────────────────────

interface Sprint {
    id: string;
    projectId: string;
    name: string;
    startDate: string;
    status: 'Planning' | 'Active' | 'Completed' | 'Archived';
    autoStart?: boolean;
}

/**
 * Automatically start sprints that have autoStart enabled and whose startDate has arrived.
 * Runs every hour.
 */
export const autoStartSprints = onSchedule({ schedule: "every 1 hours", region: "europe-west3" }, async (event) => {
    const now = new Date();
    console.log(`[SprintScheduler] Running auto-start check at ${now.toISOString()}`);

    try {
        const snapshot = await db.collectionGroup('sprints')
            .where('status', '==', 'Planning')
            .where('autoStart', '==', true)
            .get();

        if (snapshot.empty) {
            console.log('[SprintScheduler] No pending auto-start sprints found.');
            return;
        }

        const batch = db.batch();
        let updateCount = 0;

        snapshot.docs.forEach(doc => {
            const sprint = doc.data() as Sprint;

            // Parse start date
            let startDate: Date;
            if ((sprint.startDate as any)?.toDate) {
                startDate = (sprint.startDate as any).toDate();
            } else {
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
        } else {
            console.log('[SprintScheduler] Found candidates but none ready to start yet.');
        }

    } catch (error: any) {
        console.error('[SprintScheduler] Error auto-starting sprints:', error);
    }
});

// ─────────────────────────────────────────────────────────────
// Daily Health Snapshots Scheduler
// ─────────────────────────────────────────────────────────────

type HealthStatus = 'excellent' | 'healthy' | 'warning' | 'critical' | 'stalemate' | 'normal';

/**
 * Calculate a simplified health score for a project based on task data.
 * This is a cloud function version - simplified from the full client-side calculation.
 */
function calculateSimpleHealthScore(
    tasks: admin.firestore.QueryDocumentSnapshot[],
    issues: admin.firestore.QueryDocumentSnapshot[]
): { score: number; status: HealthStatus; trend: 'improving' | 'declining' | 'stable' } {
    let score = 70; // Base score

    if (tasks.length === 0 && issues.length === 0) {
        return { score: 50, status: 'normal', trend: 'stable' };
    }

    // Task completion rate
    const completedTasks = tasks.filter(t => t.data().isCompleted).length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    // Boost for high completion
    if (completionRate >= 0.8) score += 15;
    else if (completionRate >= 0.5) score += 5;
    else if (completionRate < 0.3 && totalTasks > 0) score -= 10;

    // Overdue tasks penalty
    const now = new Date();
    const overdueTasks = tasks.filter(t => {
        const data = t.data();
        if (data.isCompleted) return false;
        if (!data.dueDate) return false;
        const dueDate = typeof data.dueDate === 'string' ? new Date(data.dueDate) : data.dueDate.toDate?.() || new Date(data.dueDate);
        return dueDate < now;
    });

    if (overdueTasks.length > 0) {
        score -= Math.min(overdueTasks.length * 5, 25);
    }

    // Urgent/High priority pending penalty
    const urgentPending = tasks.filter(t => {
        const data = t.data();
        return !data.isCompleted && (data.priority === 'Urgent' || data.priority === 'High');
    });

    if (urgentPending.length > 3) score -= 10;
    else if (urgentPending.length > 0) score -= 5;

    // Open issues penalty
    const openIssues = issues.filter(i => {
        const data = i.data();
        return data.status !== 'Resolved' && data.status !== 'Closed';
    });

    if (openIssues.length > 5) score -= 15;
    else if (openIssues.length > 2) score -= 10;
    else if (openIssues.length > 0) score -= 5;

    // Clamp score
    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: HealthStatus;
    if (score >= 85) status = 'excellent';
    else if (score >= 70) status = 'healthy';
    else if (score >= 50) status = 'warning';
    else if (score >= 30) status = 'critical';
    else status = 'critical';

    // Trend is simplified to 'stable' since we don't have historical data in this context
    // The real trend would require comparing to previous snapshot
    return { score, status, trend: 'stable' };
}

/**
 * Save daily health snapshots for ALL projects.
 * Runs at midnight (00:00) every day.
 */
export const dailyHealthSnapshots = onSchedule(
    { schedule: "0 0 * * *", region: "europe-west3", timeZone: "Europe/Berlin" },
    async (event) => {
        const today = new Date().toISOString().split('T')[0];
        console.log(`[HealthSnapshots] Running daily snapshot for ${today}`);

        try {
            // Get all tenants
            const tenantsSnap = await db.collection('tenants').get();

            if (tenantsSnap.empty) {
                console.log('[HealthSnapshots] No tenants found.');
                return;
            }

            let projectCount = 0;
            let snapshotCount = 0;

            for (const tenantDoc of tenantsSnap.docs) {
                const tenantId = tenantDoc.id;

                // Get all projects for this tenant
                const projectsSnap = await db.collection('tenants').doc(tenantId)
                    .collection('projects').get();

                for (const projectDoc of projectsSnap.docs) {
                    projectCount++;
                    const projectId = projectDoc.id;

                    try {
                        // Get tasks for this project
                        const tasksSnap = await db.collection('tenants').doc(tenantId)
                            .collection('projects').doc(projectId)
                            .collection('tasks').get();

                        // Get issues for this project
                        const issuesSnap = await db.collection('tenants').doc(tenantId)
                            .collection('projects').doc(projectId)
                            .collection('issues').get();

                        // Calculate health
                        const health = calculateSimpleHealthScore(tasksSnap.docs, issuesSnap.docs);

                        // Save snapshot using date as document ID (prevents duplicates)
                        const snapshotRef = db.collection('tenants').doc(tenantId)
                            .collection('projects').doc(projectId)
                            .collection('healthSnapshots').doc(today);

                        await snapshotRef.set({
                            projectId,
                            tenantId,
                            score: health.score,
                            status: health.status,
                            trend: health.trend,
                            date: today,
                            timestamp: admin.firestore.FieldValue.serverTimestamp()
                        });

                        snapshotCount++;
                    } catch (err: any) {
                        console.error(`[HealthSnapshots] Error processing project ${projectId}:`, err.message);
                    }
                }
            }

            console.log(`[HealthSnapshots] Completed. Processed ${projectCount} projects, saved ${snapshotCount} snapshots.`);

        } catch (error: any) {
            console.error('[HealthSnapshots] Error:', error);
        }
    }
);

/**
 * Debug endpoint for testing health snapshots manually
 */
export const debugHealthSnapshots = onRequest({ region: "europe-west3" }, async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); console.log(msg); };

    log(`[HealthSnapshots] Manual run for ${today}`);

    try {
        const tenantsSnap = await db.collection('tenants').get();
        log(`Found ${tenantsSnap.size} tenants`);

        let projectCount = 0;
        let snapshotCount = 0;

        for (const tenantDoc of tenantsSnap.docs) {
            const tenantId = tenantDoc.id;
            const projectsSnap = await db.collection('tenants').doc(tenantId)
                .collection('projects').get();

            log(`Tenant ${tenantId}: ${projectsSnap.size} projects`);

            for (const projectDoc of projectsSnap.docs) {
                projectCount++;
                const projectId = projectDoc.id;
                const projectData = projectDoc.data();

                try {
                    const tasksSnap = await db.collection('tenants').doc(tenantId)
                        .collection('projects').doc(projectId)
                        .collection('tasks').get();

                    const issuesSnap = await db.collection('tenants').doc(tenantId)
                        .collection('projects').doc(projectId)
                        .collection('issues').get();

                    const health = calculateSimpleHealthScore(tasksSnap.docs, issuesSnap.docs);

                    const snapshotRef = db.collection('tenants').doc(tenantId)
                        .collection('projects').doc(projectId)
                        .collection('healthSnapshots').doc(today);

                    await snapshotRef.set({
                        projectId,
                        tenantId,
                        score: health.score,
                        status: health.status,
                        trend: health.trend,
                        date: today,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });

                    log(`  Project "${projectData.title || projectId}": Score ${health.score} (${health.status})`);
                    snapshotCount++;
                } catch (err: any) {
                    log(`  Error on project ${projectId}: ${err.message}`);
                }
            }
        }

        log(`Done. ${projectCount} projects, ${snapshotCount} snapshots.`);
        res.status(200).send(`LOGS:\n${logs.join('\n')}`);

    } catch (error: any) {
        log(`ERROR: ${error.message}`);
        res.status(500).send(`ERROR:\n${error.message}\n\nLOGS:\n${logs.join('\n')}`);
    }
});
