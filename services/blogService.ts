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
            throw new Error(`Failed to fetch posts: ${response.statusText}`);
        }

        const data = await response.json();

        // Basic mapping - assumes the API returns an array of objects roughly matching BlogPost
        // In a real app, we might need a mapper function or the Data Model definition to map fields
        if (Array.isArray(data)) {
            return data.map((item: any) => ({
                id: item.id || item._id || String(Math.random()),
                title: item.title || 'Untitled',
                excerpt: item.excerpt || item.description || item.summary || '',
                coverImage: item.coverImage || item.image || item.thumbnail || null,
                author: item.author?.name || item.author || 'Unknown',
                status: item.status === 'published' ? 'published' : 'draft',
                createdAt: item.createdAt || item.publishedAt || item.date || new Date(),
                url: item.url || item.slug ? `/${item.slug}` : undefined
            }));
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
