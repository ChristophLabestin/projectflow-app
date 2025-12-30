"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manageCategories = exports.getCategories = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const init_1 = require("./init");
const corsConfig_1 = require("./corsConfig");
const REGION = 'europe-west3';
/**
 * Get Categories Endpoint
 * GET /api/blog/categories
 */
exports.getCategories = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        if (req.method !== 'GET') {
            res.status(405).json({ success: false, error: 'Method Not Allowed' });
            return;
        }
        try {
            const snapshot = await init_1.db.collection('blog_categories').orderBy('name', 'asc').get();
            const categories = snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
            res.status(200).json({
                success: true,
                data: categories
            });
        }
        catch (error) {
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
exports.manageCategories = functions.region(REGION).https.onRequest((req, res) => {
    return (0, corsConfig_1.corsMiddleware)(req, res, async () => {
        const segments = req.path.split('/').filter(s => s.length > 0);
        // Path might look like /manageCategories/ID or just /manageCategories
        // In the api routing, it might be slightly different.
        // If we route /api/blog/categories/manage -> it hits this.
        // If we route /api/blog/categories/manage/ID -> it hits this.
        let pathId;
        if (segments.length > 1) {
            pathId = segments[segments.length - 1];
            if (pathId === 'manage')
                pathId = undefined; // it was /manage
        }
        // 1. DELETE
        if (req.method === 'DELETE') {
            if (!pathId) {
                res.status(400).json({ success: false, error: 'Missing category ID' });
                return;
            }
            try {
                await init_1.db.collection('blog_categories').doc(pathId).delete();
                res.status(200).json({ success: true, message: 'Category deleted successfully' });
            }
            catch (error) {
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
                const docRef = init_1.db.collection('blog_categories').doc(pathId);
                const docSnap = await docRef.get();
                if (!docSnap.exists) {
                    res.status(404).json({ success: false, error: 'Category not found' });
                    return;
                }
                await docRef.update(Object.assign(Object.assign({}, data), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
                const updated = await docRef.get();
                res.status(200).json({
                    success: true,
                    message: 'Category updated successfully',
                    data: Object.assign({ id: updated.id }, updated.data())
                });
            }
            catch (error) {
                console.error('Error updating category:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }
        // 3. POST (Create)
        if (req.method === 'POST') {
            try {
                const data = req.body;
                if (!data.name) {
                    res.status(400).json({ success: false, error: 'Missing category name' });
                    return;
                }
                const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const category = {
                    name: data.name,
                    slug: slug,
                    description: data.description || '',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const docRef = await init_1.db.collection('blog_categories').add(category);
                const newDoc = await docRef.get();
                res.status(201).json({
                    success: true,
                    message: 'Category created successfully',
                    data: Object.assign({ id: newDoc.id }, newDoc.data())
                });
            }
            catch (error) {
                console.error('Error creating category:', error);
                res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
            }
            return;
        }
        res.status(405).json({ success: false, error: 'Method Not Allowed' });
    });
});
//# sourceMappingURL=categories.js.map