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

export const createGithubIssue = async (repo: string, token: string, title: string, body: string): Promise<{ url: string; number: number }> => {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title,
                body,
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create GitHub issue');
        }

        const data = await response.json();
        return {
            url: data.html_url,
            number: data.number
        };
    } catch (error) {
        console.error('Error creating GitHub issue:', error);
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
export const updateGithubIssue = async (repo: string, token: string, number: number, data: { state?: 'open' | 'closed'; title?: string; body?: string }): Promise<void> => {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update GitHub issue');
        }
    } catch (error) {
        console.error('Error updating GitHub issue:', error);
        throw error;
    }
};

export const addGithubIssueComment = async (repo: string, token: string, number: number, body: string): Promise<void> => {
    try {
        const response = await fetch(`https://api.github.com/repos/${repo}/issues/${number}/comments`, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to post GitHub comment');
        }
    } catch (error) {
        console.error('Error posting GitHub comment:', error);
        throw error;
    }
};

export const fetchCommitsReferencingIssue = async (repo: string, token: string | undefined, issueNumber: number): Promise<GithubCommit[]> => {
    try {
        // GitHub Search API is better for finding references, 
        // but for simplicity we'll fetch the last 100 commits and filter.
        // A more robust way would be to search commits with "q=repo:OWNER/REPO #NUMBER"
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
        };
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=100`, {
            headers
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch commits for reference');
        }

        const commits: GithubCommit[] = await response.json();

        // Filter commits that mention the issue number in the message (e.g., #123)
        // or contain the issue full URL
        const refPattern = new RegExp(`(#|/issues/)${issueNumber}(\\D|$)`, 'i');
        return commits.filter(c => refPattern.test(c.commit.message));
    } catch (error) {
        console.error('Error fetching commits for issue:', error);
        throw error;
    }
};
