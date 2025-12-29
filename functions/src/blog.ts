import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as cors from 'cors';
import { db } from './init';

const CORS_ORIGIN = true; // Allow all origins
const REGION = 'europe-west3'; // Same region as newsletter function

// Interfaces matching the provided datamodel
// content is 'any' here effectively because React.ReactNode is not JSON serializable directly
// and we are receiving JSON payload.
export interface Topic {
    name: string;
    slug: string;
}

export interface Author {
    id: string;
    name: string;
    role: string;
    avatar: string;
    bio?: string;
}

export interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: any; // Handled as JSON/string in API context
    coverImage: string;
    publishedAt: string;
    readTime: string;
    author: Author;
    category: Topic;
    tags: string[];
    featured?: boolean;
}

/**
 * Create Blog Post Endpoint
 * POST /api/blog/create
 */
export const createBlogPost = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        // Only allow POST
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

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

            // Construct proper object to clean any extra fields if necessary
            // or just validate structure. 
            // We use the provided ID or generate a new one if not present, 
            // though the interface says ID is required.
            const docId = data.slug; // Good practice to use slug as ID for blogs, or auto-id.
            // Requirement says "creates an entry in the blog_posts collection"

            const blogPost: BlogPost = {
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
                featured: !!data.featured
            };

            // Allow using the slug as the document ID for cleaner URLs/references
            // or let Firestore generate one if that's preferred. 
            // Let's use the provided slug as the document ID to ensure uniqueness by slug.

            const docRef = db.collection('blog_posts').doc(blogPost.slug);
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

        } catch (error: any) {
            console.error('Error creating blog post:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});

/**
 * Get Blog Posts Endpoint
 * GET /api/blog/posts
 */
export const getBlogPosts = functions.region(REGION).https.onRequest((req, res) => {
    return cors({ origin: CORS_ORIGIN })(req, res, async () => {
        // Only allow GET
        if (req.method !== 'GET') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        try {
            const { slug, limit, tag } = req.query;

            // 1. Get single post by slug
            if (slug && typeof slug === 'string') {
                const docRef = db.collection('blog_posts').doc(slug);
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
            let query: admin.firestore.Query = db.collection('blog_posts');

            // Apply tag filter
            if (tag && typeof tag === 'string') {
                query = query.where('tags', 'array-contains', tag);
            }

            // Apply sorting (most recent first)
            // Note: This requires an index if combined with 'where' filters on different fields,
            // but for 'tags' array-contains + orderBy 'publishedAt' it often works or requires a composite index.
            query = query.orderBy('publishedAt', 'desc');

            // Apply limit
            const limitVal = parseInt(limit as string) || 10;
            query = query.limit(Math.min(limitVal, 50)); // Max 50 per request

            const snapshot = await query.get();
            const posts = snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => doc.data());

            res.status(200).json({
                success: true,
                data: posts
            });

        } catch (error: any) {
            console.error('Error getting blog posts:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});
