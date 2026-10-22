/**
 * Service for interacting with GitHub REST API
 */

export interface GithubCommit {
    sha: string;
    commit: {
        author: {
            name: string;
            date: string;
        };
        message: string;
    };
    author: {
        avatar_url: string;
        login: string;
    } | null;
    html_url: string;
}

export interface GithubRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    description: string | null;
}

export const fetchLastCommits = async (repo: string, token?: string): Promise<GithubCommit[]> => {
    try {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, {
            headers
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch commits');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching GitHub commits:', error);
        throw error;
    }
};

export const fetchUserRepositories = async (token: string): Promise<GithubRepo[]> => {
    try {
        const response = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated`, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch repositories');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching user repositories:', error);
        throw error;
    }
};
