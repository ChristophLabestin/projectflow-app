"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlogPosts = exports.createBlogPost = exports.onBlogPostWrite = void 0;
const functions = require("firebase-functions");
const init_1 = require("./init");
const corsConfig_1 = require("./corsConfig");
const authUtils_1 = require("./authUtils");
const REGION = 'europe-west3'; // Same region as newsletter function
/**
 * Trigger: On Blog Post Write
 * Automatically syncs 'translations' map across all posts with the same translationId
 */
exports.onBlogPostWrite = functions.region(REGION).firestore
    .document('blog_posts/{slug}')
    .onWrite(async (change, context) => {
    const afterData = change.after.exists ? change.after.data() : null;
    const beforeData = change.before.exists ? change.before.data() : null;
    // 1. Handle Deletion
    if (!afterData && beforeData && beforeData.translationId) {
        // Remove from siblings
        await syncTranslations(beforeData.translationId);
        return;
    }
    // 2. Handle Create or Update
    if (afterData && afterData.translationId) {
        const hasChanged = JSON.stringify(afterData.translations) !== JSON.stringify(beforeData === null || beforeData === void 0 ? void 0 : beforeData.translations) ||
            afterData.translationId !== (beforeData === null || beforeData === void 0 ? void 0 : beforeData.translationId) ||
            afterData.slug !== (beforeData === null || beforeData === void 0 ? void 0 : beforeData.slug) ||
            afterData.language !== (beforeData === null || beforeData === void 0 ? void 0 : beforeData.language) ||
            afterData.coverImage !== (beforeData === null || beforeData === void 0 ? void 0 : beforeData.coverImage);
        // Prevent infinite loops: only sync if meaningful data changed,
        // AND we aren't just receiving the sync update itself (hard to detect perfectly without a flag,
        // but checking if the map is ALREADY correct helps).
        if (hasChanged) {
            // If cover image changed, propagate it
            const updates = {};
            if (afterData.coverImage !== (beforeData === null || beforeData === void 0 ? void 0 : beforeData.coverImage)) {
                updates.coverImage = afterData.coverImage;
            }
            await syncTranslations(afterData.translationId, updates);
        }
    }
});
/**
 * Helper: Syncs translation map for a given group ID
 */
const syncTranslations = async (translationId, updates) => {
    // 1. Fetch all posts in this group
    const snapshot = await init_1.db.collection('blog_posts')
        .where('translationId', '==', translationId)
        .get();
    if (snapshot.empty)
        return;
    // 2. Build the map { [lang]: slug }
    const translationMap = {};
    snapshot.docs.forEach(doc => {
        const p = doc.data();
        if (p.language) {
            translationMap[p.language] = p.slug;
        }
    });
    // 3. Update all docs if their map is outdated OR if we have other updates (image) that need applying
    const batch = init_1.db.batch();
    let commitNeeded = false;
    snapshot.docs.forEach(doc => {
        const p = doc.data();
        const currentMapJSON = JSON.stringify(p.translations || {});
        const newMapJSON = JSON.stringify(translationMap);
        const docUpdates = {};
        let needsUpdate = false;
        // Check translation map
        if (currentMapJSON !== newMapJSON) {
            docUpdates.translations = translationMap;
            needsUpdate = true;
        }
        // Check cover image sync
        if ((updates === null || updates === void 0 ? void 0 : updates.coverImage) !== undefined && p.coverImage !== updates.coverImage) {
            docUpdates.coverImage = updates.coverImage;
            needsUpdate = true;
        }
        if (needsUpdate) {
            batch.update(doc.ref, docUpdates);
            commitNeeded = true;
        }
    });
    if (commitNeeded) {
        console.log(`Syncing group ${translationId}: map=${Object.keys(translationMap)}, updates=${JSON.stringify(updates)}`);
        await batch.commit();
    }
};
/**
 * Create Blog Post Endpoint
 * POST /api/blog/create
 */
exports.createBlogPost = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        const token = (0, authUtils_1.getAuthToken)(req);
        if (!token) {
            res.status(401).json({ success: false, error: 'Missing API token' });
            return;
        }
        const validation = await (0, authUtils_1.validateAPIToken)(token, 'blog:write');
        if (!validation.valid) {
            res.status(401).json({ success: false, error: validation.error });
            return;
        }
        // Extract ID from path if present (e.g. /createBlogPost/my-slug)
        // We filter out empty segments and ignore 'createBlogPost' if it's the only segment.
        const segments = req.path.split('/').filter(s => s.length > 0);
        const lastSegment = segments[segments.length - 1];
        // If the last segment is the function name itself, it means no ID was provided.
        // Or if explicit 'createBlogPost' check is needed:
        const pathId = (lastSegment && lastSegment !== 'createBlogPost') ? lastSegment : undefined;
        // 1. DELETE
        if (req.method === 'DELETE') {
            if (!pathId) {
                res.status(400).json({ success: false, error: 'Missing blog ID in URL path' });
                return;
            }
            try {
                const docRef = init_1.db.collection('blog_posts').doc(pathId);
                const doc = await docRef.get();
                if (!doc.exists) {
                    res.status(404).json({ success: false, error: 'Blog post not found' });
                    return;
                }
                await docRef.delete();
                res.status(200).json({ success: true, message: 'Blog post deleted successfully' });
            }
            catch (error) {
                console.error('Error deleting blog post:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }
        // 2. PUT (Update)
        if (req.method === 'PUT') {
            if (!pathId) {
                res.status(400).json({ success: false, error: 'Missing blog ID in URL path' });
                return;
            }
            try {
                const data = req.body;
                const docRef = init_1.db.collection('blog_posts').doc(pathId);
                const doc = await docRef.get();
                if (!doc.exists) {
                    res.status(404).json({ success: false, error: 'Blog post not found' });
                    return;
                }
                // Update fields
                await docRef.update(Object.assign(Object.assign({}, data), { 
                    // Prevent changing crucial immutable fields if needed, or allow all
                    updatedAt: new Date().toISOString() }));
                res.status(200).json({ success: true, message: 'Blog post updated successfully' });
            }
            catch (error) {
                console.error('Error updating blog post:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }
        // 3. POST (Create)
        if (req.method === 'POST') {
            try {
                const data = req.body;
                // Basic validation
                if (!data.slug || !data.title || !data.content || !data.author || !data.category) {
                    res.status(400).json({
                        success: false,
                        error: 'Missing required fields: slug, title, content, author, category'
                    });
                    return;
                }
                const docId = data.slug;
                const blogPost = {
                    id: data.id || docId,
                    slug: data.slug,
                    title: data.title,
                    excerpt: data.excerpt || '',
                    content: data.content,
                    coverImage: data.coverImage || '',
                    publishedAt: data.publishedAt || new Date().toISOString(),
                    readTime: data.readTime || '5 min read',
                    author: data.author,
                    category: data.category,
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    featured: !!data.featured,
                    language: data.language || 'en',
                    translationGroupId: data.translationGroupId || null,
                    translationId: data.translationId || data.translationGroupId || null,
                    sourceLanguage: data.sourceLanguage || null
                };
                const docRef = init_1.db.collection('blog_posts').doc(blogPost.slug);
                const doc = await docRef.get();
                if (doc.exists) {
                    res.status(409).json({ success: false, error: 'Blog post with this slug already exists' });
                    return;
                }
                await docRef.set(blogPost);
                res.status(201).json({
                    success: true,
                    message: 'Blog post created successfully',
                    data: blogPost
                });
            }
            catch (error) {
                console.error('Error creating blog post:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }
        // If not POST, PUT, or DELETE
        res.status(405).json({ success: false, error: 'Method Not Allowed' });
    });
});
/**
 * Get Blog Posts Endpoint
 * GET /api/blog/posts
 */
exports.getBlogPosts = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        // Only allow GET
        if (req.method !== 'GET') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        const token = (0, authUtils_1.getAuthToken)(req);
        if (!token) {
            res.status(401).json({ success: false, error: 'Missing API token' });
            return;
        }
        const validation = await (0, authUtils_1.validateAPIToken)(token, 'blog:read');
        if (!validation.valid) {
            res.status(401).json({ success: false, error: validation.error });
            return;
        }
        try {
            const { slug, limit, tag } = req.query;
            // 1. Get single post by slug
            if (slug && typeof slug === 'string') {
                const docRef = init_1.db.collection('blog_posts').doc(slug);
                const doc = await docRef.get();
                if (!doc.exists) {
                    res.status(404).json({ success: false, error: 'Blog post not found' });
                    return;
                }
                res.status(200).json({
                    success: true,
                    data: doc.data()
                });
                return;
            }
            // 2. Query posts list
            let query = init_1.db.collection('blog_posts');
            // Apply tag filter
            if (tag && typeof tag === 'string') {
                query = query.where('tags', 'array-contains', tag);
            }
            // Apply sorting (most recent first)
            // Note: This requires an index if combined with 'where' filters on different fields,
            // but for 'tags' array-contains + orderBy 'publishedAt' it often works or requires a composite index.
            query = query.orderBy('publishedAt', 'desc');
            // Apply limit
            const limitVal = parseInt(limit) || 10;
            query = query.limit(Math.min(limitVal, 50)); // Max 50 per request
            const snapshot = await query.get();
            const posts = snapshot.docs.map((doc) => doc.data());
            res.status(200).json({
                success: true,
                data: posts
            });
        }
        catch (error) {
            console.error('Error getting blog posts:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});
//# sourceMappingURL=blog.js.map