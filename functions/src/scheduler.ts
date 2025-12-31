
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

const db = admin.firestore();

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
}

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

async function publishInstagramPhoto(igAccountId: string, imageUrl: string, caption: string, accessToken: string) {
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

export const checkScheduledPosts = onSchedule("every 10 minutes", async (event) => {
    const now = new Date();
    const snapshot = await db.collectionGroup('social_posts')
        .where('status', '==', 'Scheduled')
        .where('scheduledFor', '<=', now.toISOString())
        .get();

    if (snapshot.empty) {
        console.log("No scheduled posts to publish.");
        return;
    }

    console.log(`Found ${snapshot.size} posts to publish.`);

    const promises = snapshot.docs.map(async (doc) => {
        const post = { id: doc.id, ...doc.data() } as SocialPost;

        try {
            // 1. Get Project & Tenant info to find integration
            // We need to find the social_integration for this project.
            // Assuming social_integrations are in a subcollection of the project 
            // OR we can query them by projectId if they are global/collection group.
            // Based on typical structure: tenants/{tid}/projects/{pid}/social_integrations/{id}

            // We can resolve the project ref from the post ref
            const projectRef = doc.ref.parent.parent;
            if (!projectRef) throw new Error("Could not find parent project");

            const integrationsSnap = await projectRef.collection('social_integrations')
                .where('platform', '==', post.platform)
                .limit(1)
                .get();

            if (integrationsSnap.empty) {
                throw new Error(`No ${post.platform} integration found for project ${projectRef.id}`);
            }

            const integration = integrationsSnap.docs[0].data() as SocialIntegration;

            if (!integration.accessToken) {
                throw new Error("Integration missing access token");
            }

            let publishedId: string | undefined;

            if (post.platform === 'Instagram') {
                if (!integration.instagram_business_account?.id) {
                    throw new Error("Instagram business account ID not found in integration");
                }

                // Currently only supporting single image for simplicity as per MVP
                if (!post.assets || post.assets.length === 0) {
                    throw new Error("No assets to publish");
                }

                // TODO: Support Carousel/Video
                const imageUrl = post.assets[0].url;
                publishedId = await publishInstagramPhoto(
                    integration.instagram_business_account.id,
                    imageUrl,
                    post.content.caption,
                    integration.accessToken
                );
            } else {
                // Other platforms not implemented in this scheduler yet
                console.log(`Skipping ${post.platform} post ${post.id} - not implemented in scheduler yet`);
                return;
            }

            // Update status
            await doc.ref.update({
                status: 'Published',
                publishedAt: new Date().toISOString(),
                externalId: publishedId || null,
                error: admin.firestore.FieldValue.delete()
            });
            console.log(`Successfully published post ${post.id}`);

        } catch (error: any) {
            console.error(`Failed to publish post ${post.id}:`, error);
            await doc.ref.update({
                status: 'Failed',
                error: error.message || 'Unknown error'
            });
        }
    });

    await Promise.all(promises);
});
