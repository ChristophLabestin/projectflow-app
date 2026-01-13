const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || process.env.VITE_UNSPLASH_ACCESS_KEY;
const API_URL = 'https://api.unsplash.com';

export interface UnsplashImage {
    id: string;
    width: number;
    height: number;
    color: string;
    description: string;
    alt_description: string;
    urls: {
        raw: string;
        full: string;
        regular: string;
        small: string;
        thumb: string;
    };
    links: {
        download: string;
        download_location: string;
    };
    user: {
        id: string;
        username: string;
        name: string;
        profile_image: {
            small: string;
            medium: string;
            large: string;
        };
    };
}

interface SearchResponse {
    total: number;
    total_pages: number;
    results: UnsplashImage[];
}

export const searchStockImages = async (query: string, page = 1, perPage = 20): Promise<SearchResponse> => {
    if (!UNSPLASH_ACCESS_KEY) {
        throw new Error('Missing Unsplash API Key. Please add VITE_UNSPLASH_ACCESS_KEY to your .env file.');
    }

    try {
        const url = new URL(`${API_URL}/search/photos`);
        url.searchParams.append('query', query);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('orientation', 'landscape');
        url.searchParams.append('client_id', UNSPLASH_ACCESS_KEY);

        const response = await fetch(url.toString());

        if (!response.ok) {
            throw new Error(`Unsplash API Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Unsplash Search Error:', error);
        throw error;
    }
};

export const getCuratedPhotos = async (page = 1, perPage = 20): Promise<UnsplashImage[]> => {
    if (!UNSPLASH_ACCESS_KEY) {
        return [];
    }

    try {
        const url = new URL(`${API_URL}/photos`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('order_by', 'popular');
        url.searchParams.append('client_id', UNSPLASH_ACCESS_KEY);

        const response = await fetch(url.toString());

        if (!response.ok) {
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Unsplash Curated Error:', error);
        return [];
    }
};

export const triggerDownload = async (downloadLocation: string): Promise<void> => {
    if (!UNSPLASH_ACCESS_KEY) return;

    try {
        const url = new URL(downloadLocation);
        url.searchParams.append('client_id', UNSPLASH_ACCESS_KEY);

        await fetch(url.toString());
    } catch (error) {
        console.error('Unsplash Download Tracking Error:', error);
    }
};
