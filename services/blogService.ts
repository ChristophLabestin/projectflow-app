import { getMarketingSettings } from './marketingSettingsService';
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

export interface BlogPost {
    id: string;
    title: string; // We generate this (or you can map 'slug' to it)
    slug?: string;
    excerpt: string;
    content: string; // HTML Content
    coverImage: string | null;
    publishedAt?: string; // ISO String
    language?: string; // e.g. 'en', 'de' - for multi-language support
    author: {
        uid?: string;
        name: string;
        photoURL?: string | null;
    } | string; // Support string for simple mapping
    category: {
        name: string;
        slug: string;
    };
    tags: string[];
    status: 'published' | 'draft';
    createdAt: string | Date;
    url?: string;
}

export interface BlogTemplate {
    id: string;
    projectId: string;
    name: string;
    content: string; // HTML or JSON string
    createdAt: Date;
}

const getApiConfig = async (projectId: string): Promise<ApiResourceConfig | null> => {
    const settings = await getMarketingSettings(projectId);
    if (!settings) return null;

    if (settings.apiIntegration) {
        return settings.apiIntegration;
    }

    // Migration fallback for old blogIntegration
    if (settings.blogIntegration) {
        return {
            baseUrl: '', // Old settings had full URLs, so base is empty
            headers: settings.blogIntegration.headers || '{}',
            resources: {
                'posts': {
                    endpoints: {
                        list: { path: settings.blogIntegration.getEndpoint || '', method: 'GET' },
                        create: { path: settings.blogIntegration.endpoint || '', method: 'POST' },
                        update: { path: (settings.blogIntegration.endpoint || '') + '/:id', method: 'PUT' }, // Best guess
                        delete: { path: (settings.blogIntegration.endpoint || '') + '/:id', method: 'DELETE' } // Best guess
                    }
                }
            }
        };
    }
    return null;
};

/**
 * Extract Bearer token from headers string
 */
const extractToken = (headersJson?: string): string => {
    if (!headersJson) return '';
    try {
        const headers = JSON.parse(headersJson);
        const auth = headers.Authorization || headers.authorization || '';
        return auth.replace('Bearer ', '').trim();
    } catch (e) {
        return '';
    }
};

// Internal Cloud Functions Helper
const CLOUD_FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || `https://europe-west3-project-manager-9d0ad.cloudfunctions.net/api`;

const executeCloudApiRequest = async (path: string, method: string = 'GET', data?: any, token?: string) => {
    const url = `${CLOUD_FUNCTIONS_URL}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloud API Error: ${response.status} - ${errorText}`);
    }

    if (method === 'DELETE') return;
    return await response.json();
};

// Generic Fetcher
const executeApiRequest = async (config: ApiResourceConfig, resourceName: string, action: 'list' | 'get' | 'create' | 'update' | 'delete', params?: { id?: string, data?: any }) => {
    const resource = config.resources[resourceName];
    if (!resource) throw new Error(`Resource '${resourceName}' not configured`);

    const endpoint = resource.endpoints[action];
    if (!endpoint) throw new Error(`Endpoint for '${action}' on '${resourceName}' not configured`);

    let url = endpoint.path.startsWith('http') ? endpoint.path : `${config.baseUrl}${endpoint.path}`;

    // Replace :id parameter
    if (params?.id) {
        url = url.replace(':id', params.id);
    }

    // Parse headers
    let headers: Record<string, string> = {};
    try {
        headers = JSON.parse(config.headers || '{}');
    } catch (e) {
        console.error('Failed to parse headers', e);
    }

    const fetchOptions: RequestInit = {
        method: endpoint.method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    if (params?.data && (endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH')) {
        fetchOptions.body = JSON.stringify(params.data);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // DELETE might not return JSON
    if (action === 'delete') return;

    return await response.json();
};

/**
 * Fetches blog posts from the configured external GET endpoint.
 */
export const fetchExternalBlogPosts = async (projectId: string): Promise<BlogPost[]> => {
    const config = await getApiConfig(projectId);
    if (!config) return [];

    try {
        const data = await executeApiRequest(config, 'posts', 'list');
        console.log('Blog Fetch Response Data:', data);

        // Basic mapping - assumes the API returns an array of objects roughly matching BlogPost
        // In a real app, we might need a mapper function or the Data Model definition to map fields
        // Intelligent mapping implementation
        let postsArray: any[] = [];

        if (Array.isArray(data)) {
            postsArray = data;
        } else if (data && typeof data === 'object') {
            // Try to find the array in common properties
            if (Array.isArray(data.data)) postsArray = data.data;
            else if (Array.isArray(data.posts)) postsArray = data.posts;
            else if (Array.isArray(data.results)) postsArray = data.results;
            else if (Array.isArray(data.items)) postsArray = data.items;
            // specific case for Strapi or similar that might wrap in attributes
            else if (Array.isArray(data.entries)) postsArray = data.entries;
        }

        console.log('Found posts array:', postsArray.length, 'items');

        if (postsArray.length > 0) {
            return postsArray.map((item: any) => {
                // Handle unwrapping for CMSs like Strapi where fields are in 'attributes'
                const fields = item.attributes || item;

                return {
                    id: item.id || fields.id || item._id || String(Math.random()),
                    title: fields.title || 'Untitled',
                    slug: fields.slug || '',
                    content: fields.content || fields.body || fields.html || fields.text || '',
                    excerpt: fields.excerpt || fields.description || fields.summary || '',
                    coverImage: fields.coverImage || fields.image || fields.thumbnail || null,
                    author: typeof fields.author === 'object' ? fields.author : { name: fields.author || 'Unknown' },
                    category: fields.category || { name: 'General', slug: 'general' },
                    tags: Array.isArray(fields.tags) ? fields.tags : [],
                    language: fields.language || fields.locale || fields.lang || undefined,
                    status: (fields.status === 'published' || item.publishedAt) ? 'published' : 'draft',
                    createdAt: fields.createdAt || fields.publishedAt || fields.date || new Date(),
                    url: fields.url || fields.slug ? `/${fields.slug}` : undefined
                };
            });
        }

        return [];
    } catch (error) {
        console.error('Error fetching external blog posts:', error);
        throw error;
    }
};

/**
 * Publishes a new blog post to the configured external POST endpoint.
 */
export const publishBlogPost = async (projectId: string, postData: any): Promise<any> => {
    const config = await getApiConfig(projectId);
    if (!config) throw new Error('Blog integration not configured');
    return await executeApiRequest(config, 'posts', 'create', { data: postData });
};

/**
 * Updates an existing blog post.
 */
export const updateBlogPost = async (projectId: string, blogId: string, postData: any): Promise<any> => {
    const config = await getApiConfig(projectId);
    if (!config) throw new Error('Blog integration not configured');
    return await executeApiRequest(config, 'posts', 'update', { id: blogId, data: postData });
};

/**
 * Deletes a blog post.
 */
export const deleteBlogPost = async (projectId: string, blogId: string): Promise<void> => {
    const config = await getApiConfig(projectId);
    if (!config) throw new Error('Blog integration not configured');
    await executeApiRequest(config, 'posts', 'delete', { id: blogId });
};

/**
 * Categories CRUD
 */
export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
}

export const fetchCategories = async (projectId: string): Promise<BlogCategory[]> => {
    const config = await getApiConfig(projectId);

    // If external config exists and has categories, use it
    if (config?.resources['categories']) {
        try {
            const data = await executeApiRequest(config, 'categories', 'list');
            let categoriesArray: any[] = [];
            if (Array.isArray(data)) categoriesArray = data;
            else if (data && typeof data === 'object') {
                if (Array.isArray(data.data)) categoriesArray = data.data;
                else if (Array.isArray(data.categories)) categoriesArray = data.categories;
            }
            return categoriesArray.map((item: any) => ({
                id: item.id || item._id,
                name: item.name || item.title,
                slug: item.slug,
                description: item.description
            }));
        } catch (e) {
            console.error('Failed to fetch external categories', e);
        }
    }

    // Fallback to internal Cloud Functions
    try {
        const token = extractToken(config?.headers);

        const response = await executeCloudApiRequest('/blog/categories', 'GET', null, token);
        return response.data || [];
    } catch (e) {
        console.error('Failed to fetch internal categories', e);
        return [];
    }
};

export const createCategory = async (projectId: string, category: Partial<BlogCategory>): Promise<BlogCategory> => {
    const config = await getApiConfig(projectId);
    if (config?.resources['categories']) {
        return await executeApiRequest(config, 'categories', 'create', { data: category });
    }

    const token = extractToken(config?.headers);
    const response = await executeCloudApiRequest('/blog/categories/manage', 'POST', category, token);
    return response.data;
};

export const updateCategory = async (projectId: string, id: string, category: Partial<BlogCategory>): Promise<BlogCategory> => {
    const config = await getApiConfig(projectId);
    if (config?.resources['categories']) {
        return await executeApiRequest(config, 'categories', 'update', { id, data: category });
    }

    const token = extractToken(config?.headers);
    const response = await executeCloudApiRequest(`/blog/categories/manage/${id}`, 'PUT', category, token);
    return response.data;
};

export const deleteCategory = async (projectId: string, id: string): Promise<void> => {
    const config = await getApiConfig(projectId);
    if (config?.resources['categories']) {
        await executeApiRequest(config, 'categories', 'delete', { id });
        return;
    }

    const token = extractToken(config?.headers);
    await executeCloudApiRequest(`/blog/categories/manage/${id}`, 'DELETE', null, token);
};

/**
 * Saves a blog post layout as a template in Firestore.
 */
export const saveBlogTemplate = async (projectId: string, name: string, content: string): Promise<string> => {
    try {
        const templatesRef = collection(db, 'blog_templates');
        const docRef = await addDoc(templatesRef, {
            projectId,
            name,
            content,
            createdAt: new Date()
        });
        return docRef.id;
    } catch (error) {
        console.error('Error saving blog template:', error);
        throw error;
    }
};

/**
 * Fetches saved blog templates for a project.
 */
export const getBlogTemplates = async (projectId: string): Promise<BlogTemplate[]> => {
    try {
        const templatesRef = collection(db, 'blog_templates');
        const q = query(templatesRef, where('projectId', '==', projectId));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as BlogTemplate[];
    } catch (error) {
        console.error('Error fetching blog templates:', error);
        throw error;
    }
};

/**
 * Deletes a blog template.
 */
export const deleteBlogTemplate = async (templateId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'blog_templates', templateId));
    } catch (error) {
        console.error('Error deleting blog template:', error);
        throw error;
    }
};
