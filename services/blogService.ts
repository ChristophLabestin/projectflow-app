import { getMarketingSettings } from './marketingSettingsService';

export interface BlogPost {
    id: string;
    title: string;
    excerpt?: string;
    coverImage?: string;
    author?: string;
    status: 'published' | 'draft';
    createdAt: string | Date;
    url?: string;
    // content is usually not needed for list view, but might be present
    content?: string;
}

interface BlogIntegrationConfig {
    endpoint?: string;
    getEndpoint?: string;
    headers?: Record<string, string>;
}

// Fetch integration config from marketing settings
const getBlogConfig = async (projectId: string): Promise<BlogIntegrationConfig | null> => {
    const settings = await getMarketingSettings(projectId);
    if (!settings?.blogIntegration) return null;

    let headers = {};
    try {
        if (settings.blogIntegration.headers) {
            headers = JSON.parse(settings.blogIntegration.headers);
        }
    } catch (e) {
        console.error('Failed to parse blog integration headers', e);
    }

    return {
        endpoint: settings.blogIntegration.endpoint,
        getEndpoint: settings.blogIntegration.getEndpoint,
        headers
    };
};

/**
 * Fetches blog posts from the configured external GET endpoint.
 */
export const fetchExternalBlogPosts = async (projectId: string): Promise<BlogPost[]> => {
    const config = await getBlogConfig(projectId);

    if (!config || !config.getEndpoint) {
        console.warn('No blog GET endpoint configured for project', projectId);
        return [];
    }

    try {
        const response = await fetch(config.getEndpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            }
        });

        if (!response.ok) {
            console.error('Blog Fetch Error:', response.status, response.statusText);
            throw new Error(`Failed to fetch posts: ${response.statusText}`);
        }

        const data = await response.json();
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
                    excerpt: fields.excerpt || fields.description || fields.summary || '',
                    coverImage: fields.coverImage || fields.image || fields.thumbnail || null,
                    author: fields.author?.name || fields.author || 'Unknown',
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
    const config = await getBlogConfig(projectId);

    if (!config || !config.endpoint) {
        throw new Error('No blog POST endpoint configured. Please configure it in Marketing Settings.');
    }

    try {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to publish post: ${response.statusText} - ${errorBody}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error publishing blog post:', error);
        throw error;
    }
};

/**
 * Updates an existing blog post.
 */
export const updateBlogPost = async (projectId: string, blogId: string, postData: any): Promise<any> => {
    const config = await getBlogConfig(projectId);

    if (!config || !config.endpoint) {
        throw new Error('No blog POST endpoint configured.');
    }

    try {
        // Assume RESTful convention: PUT /endpoint/:id
        // Handle trailing slash in endpoint if present
        const baseUrl = config.endpoint.endsWith('/') ? config.endpoint.slice(0, -1) : config.endpoint;
        const url = `${baseUrl}/${blogId}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            body: JSON.stringify(postData)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to update post: ${response.statusText} - ${errorBody}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating blog post:', error);
        throw error;
    }
};

/**
 * Deletes a blog post.
 */
export const deleteBlogPost = async (projectId: string, blogId: string): Promise<void> => {
    const config = await getBlogConfig(projectId);

    if (!config || !config.endpoint) {
        throw new Error('No blog POST endpoint configured for deletion.');
    }

    try {
        // Assume RESTful convention: DELETE /endpoint/:id
        // Handle trailing slash in endpoint if present
        const baseUrl = config.endpoint.endsWith('/') ? config.endpoint.slice(0, -1) : config.endpoint;
        const url = `${baseUrl}/${blogId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to delete post: ${response.statusText} - ${errorBody}`);
        }
    } catch (error) {
        console.error('Error deleting blog post:', error);
        throw error;
    }
};
