import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'marketing',
    category: 'cora',
    icon: 'edit_note',
    title: 'Marketing: project blog',
    summary: 'Connect your website blog to a project, write posts with CORA and publish them.',
    keywords: ['blog', 'posts', 'publish', 'cms', 'content', 'api', 'article', 'draft', 'translation', 'marketing module'],
    sections: [
        {
            id: 'what-it-is',
            title: 'What the Marketing module does',
            keywords: ['module', 'blog', 'website'],
            blocks: [
                { type: 'text', text: 'Marketing is a project module for your **blog**. You write and manage posts in ProjectFlow, and they are synced with the blog on your own website through its REST API.' },
                { type: 'text', text: 'The module is switched on per project. If you do not see **Marketing** in a project, the module is not enabled for it or your role has no access.' },
            ],
        },
        {
            id: 'connect-blog',
            title: 'How do I connect my website blog?',
            keywords: ['setup', 'wizard', 'integration', 'api', 'base url', 'headers', 'endpoint', 'data model', 'languages'],
            blocks: [
                { type: 'text', text: 'Without a connection the module shows **No API Connected**. The setup wizard links ProjectFlow to your CMS or custom backend so posts and categories can be synced.' },
                {
                    type: 'steps',
                    items: [
                        'Open **Marketing** in your project and go to the blog settings (**Blog Integration**).',
                        'Click **Start Setup Wizard** (later: **Reconfigure**).',
                        'Under **Base Configuration** enter the **Base URL** of your API and, if needed, **Global Headers (JSON)**.',
                        'Under **Resource Configuration** set the endpoints for **Posts** and **Categories** and use **Test Endpoint** to verify the list endpoint.',
                        'Optional: describe your post structure under **Data Model (Optional)**. If it contains a language field, you can pick the languages to support.',
                        'Click **Validate Configuration**, then **Save Configuration**.',
                    ],
                },
                { type: 'callout', tone: 'tip', text: 'Use a placeholder for the resource ID in update, delete and get paths. The wizard shows which one it expects next to the endpoint fields.' },
            ],
        },
        {
            id: 'write-post',
            title: 'How do I write and publish a post?',
            keywords: ['create', 'editor', 'draft', 'publish', 'cover', 'category', 'tags', 'preview', 'autosave'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'In the project, open **Marketing** to see your **Blog Posts**, then click **Create New Post**.',
                        'Enter the **Post Title**, optionally add a cover image, a category and **Tags**.',
                        'Write the content. Type `/` in the editor for formatting commands.',
                        'Check the result in **Live Preview**.',
                        'Click **Save as Draft** to keep it private, or **Publish Post** to send it to your blog.',
                    ],
                },
                { type: 'text', text: 'The editor autosaves while you work. **Save as New** stores a copy of the current post. Use **Manage Categories** and **Manage Templates** to maintain categories and reusable templates.' },
            ],
        },
        {
            id: 'cora-and-languages',
            title: 'Can CORA help with posts and translations?',
            keywords: ['ai', 'cora', 'generate', 'topics', 'translate', 'language', 'web search'],
            blocks: [
                { type: 'text', text: 'Yes. **Ask CORA** in the editor opens the **CORA Blog Assistant**. Describe what the post should be about, or click **Suggest Topics** for ideas, then **Generate Full Post** to get a draft. You can turn **Web Search** on to let CORA use sources.' },
                { type: 'text', text: 'If your blog connection supports several languages, switch the post language with **Select Language**. ProjectFlow asks whether to translate the content with AI first.' },
                { type: 'callout', tone: 'note', text: 'AI drafts are a starting point. Read and edit them before you publish.' },
            ],
        },
        {
            id: 'status',
            title: 'Draft or published?',
            keywords: ['status', 'filter', 'grid', 'list', 'delete'],
            blocks: [
                { type: 'text', text: 'The post list shows each post with its status, author and date. Filter by language, and switch between **Grid View** and **List View**.' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Draft', text: 'Saved in ProjectFlow, not yet published to your blog.' },
                        { term: 'Published', text: 'Live on your connected blog.' },
                    ],
                },
            ],
        },
    ],
};

export default article;
