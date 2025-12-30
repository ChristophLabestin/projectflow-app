import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { db } from './init';
import { corsMiddleware } from './corsConfig';
import { validateAPIToken, getAuthToken } from './authUtils';

const REGION = 'europe-west3';

export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    createdAt: any;
}

/**
 * Get Categories Endpoint
 * GET /api/blog/categories
 */
export const getCategories = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        if (req.method !== 'GET') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }

        const token = getAuthToken(req);
        if (!token) {
            res.status(401).json({ success: false, error: 'Missing API token' });
            return;
        }

        const validation = await validateAPIToken(token, 'blog:categories:read');
        if (!validation.valid) {
            res.status(401).json({ success: false, error: validation.error });
            return;
        }

        try {
            const snapshot = await db.collection('blog_categories').orderBy('name', 'asc').get();
            const categories = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            res.status(200).json({
                success: true,
                data: categories
            });
        } catch (error: any) {
            console.error('Error getting categories:', error);
            res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
        }
    });
});

/**
 * Manage Categories Endpoint
 * POST /api/blog/categories/manage (Create)
 * PUT /api/blog/categories/manage/:id (Update)
 * DELETE /api/blog/categories/manage/:id (Delete)
 */
export const manageCategories = functions.region(REGION).https.onRequest((req, res) => {
    return corsMiddleware(req, res, async () => {
        const segments = req.path.split('/').filter(s => s.length > 0);
        // Path might look like /manageCategories/ID or just /manageCategories
        // In the api routing, it might be slightly different.
        // If we route /api/blog/categories/manage -> it hits this.
        // If we route /api/blog/categories/manage/ID -> it hits this.

        const token = getAuthToken(req);
        if (!token) {
            res.status(401).json({ success: false, error: 'Missing API token' });
            return;
        }

        const validation = await validateAPIToken(token, 'blog:categories:write');
        if (!validation.valid) {
            res.status(401).json({ success: false, error: validation.error });
            return;
        }

        let pathId: string | undefined;
        if (segments.length > 0) {
            // If the last segment is 'manage', it means no ID was provided (e.g. /categories/manage)
            // Otherwise, the last segment is likely the ID
            const lastSegment = segments[segments.length - 1];
            if (lastSegment !== 'manage') {
                pathId = lastSegment;
            }
        }

        // 1. DELETE
        if (req.method === 'DELETE') {
            if (!pathId) {
                res.status(400).json({ success: false, error: 'Missing category ID' });
                return;
            }

            try {
                await db.collection('blog_categories').doc(pathId).delete();
                res.status(200).json({ success: true, message: 'Category deleted successfully' });
            } catch (error: any) {
                console.error('Error deleting category:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }

        // 2. PUT (Update)
        if (req.method === 'PUT') {
            if (!pathId) {
                res.status(400).json({ success: false, error: 'Missing category ID' });
                return;
            }

            try {
                const data = req.body;
                const docRef = db.collection('blog_categories').doc(pathId);
                const docSnap = await docRef.get();

                if (!docSnap.exists) {
                    res.status(404).json({ success: false, error: 'Category not found' });
                    return;
                }

                await docRef.update({
                    ...data,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                const updated = await docRef.get();
                res.status(200).json({
                    success: true,
                    message: 'Category updated successfully',
                    data: { id: updated.id, ...updated.data() }
                });
            } catch (error: any) {
                console.error('Error updating category:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }

        // 3. POST (Create)
        if (req.method === 'POST') {
            if (pathId) {
                res.status(405).json({ success: false, error: 'Method Not Allowed. Use PUT to update existing categories or DELETE to remove them.' });
                return;
            }
            try {
                const data = req.body;

                if (!data.name) {
                    res.status(400).json({ success: false, error: 'Missing category name' });
                    return;
                }

                const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

                const category: Partial<BlogCategory> = {
                    name: data.name,
                    slug: slug,
                    description: data.description || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };

                const docRef = await db.collection('blog_categories').add(category);
                const newDoc = await docRef.get();

                res.status(201).json({
                    success: true,
                    message: 'Category created successfully',
                    data: { id: newDoc.id, ...newDoc.data() }
                });
            } catch (error: any) {
                console.error('Error creating category:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }

        res.status(405).json({ success: false, error: 'Method Not Allowed' });
    });
});
