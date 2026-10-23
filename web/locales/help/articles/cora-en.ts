import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'cora',
    category: 'cora',
    icon: 'auto_awesome',
    title: 'CORA, your AI assistant',
    summary: 'Ask CORA questions from the Help Center, draft blog posts and create images, and connect your own AI tools.',
    keywords: ['cora', 'ai', 'assistant', 'ask', 'question', 'blog assistant', 'draft', 'image generation', 'limit', 'tokens', 'mcp', 'claude', 'chatgpt', 'gemini'],
    sections: [
        {
            id: 'what-is-cora',
            title: 'What is CORA?',
            keywords: ['about', 'ai', 'assistant', 'workspace context'],
            blocks: [
                { type: 'text', text: 'CORA is the AI assistant built into ProjectFlow. It can answer questions using your workspace context, draft content and generate images.' },
                { type: 'text', text: 'CORA works inside specific places in the app, described below. It does not change your data on its own.' },
            ],
        },
        {
            id: 'ask-cora',
            title: 'Ask CORA a question',
            keywords: ['ask', 'help center', 'question', 'answer', 'search'],
            blocks: [
                { type: 'steps', items: [
                    'Open the **Help Center** from the top bar.',
                    'Type your question into the search field.',
                    'Below the results, click **Ask CORA about "…"**.',
                ] },
                { type: 'text', text: 'CORA summarizes an answer using your workspace context. If it fails, you see "CORA search failed" and can try again.' },
                { type: 'callout', tone: 'tip', text: 'Check the help articles in the results first. They are often faster for how-to questions.' },
            ],
        },
        {
            id: 'blog-assistant',
            title: 'Draft a blog post',
            keywords: ['blog', 'marketing', 'draft', 'write', 'topics', 'web search', 'post'],
            blocks: [
                { type: 'text', text: 'In the blog editor of a project with the Marketing module, click **Ask CORA** to open the **CORA Blog Assistant**.' },
                { type: 'steps', items: [
                    'Describe what the post should be about, or click **Suggest Topics** for ideas.',
                    'Choose the **Language** and decide whether **Web Search** should be enabled for sources.',
                    'Click **Generate Full Post**. CORA fills in title, excerpt and content.',
                    'Review and edit the draft before you publish it.',
                ] },
            ],
        },
        {
            id: 'images',
            title: 'Create and rework images',
            keywords: ['image', 'generate', 'nano banana', 'rework', 'picture', 'cover'],
            blocks: [
                { type: 'text', text: 'Wherever you pick an image, the **Nano Banana** tab of the **Media Library** window lets you **Generate** an image from a prompt or **Rework** a reference image. See the [Media](/media) article for the full picker.' },
            ],
        },
        {
            id: 'limits',
            title: 'Usage limits and your own AI tools',
            keywords: ['limit', 'tokens', 'monthly', 'mcp', 'integrations', 'claude', 'chatgpt', 'codex', 'cursor'],
            blocks: [
                { type: 'text', text: 'CORA has monthly limits for text and for images. When you reach one, you see a message that the limit was reached, and it resets monthly.' },
                { type: 'text', text: 'To use your own AI tools with ProjectFlow, open **Settings** and go to **AI & integrations**. It explains how to connect Claude, ChatGPT, Codex, Cursor or any MCP client to your workspace.' },
            ],
        },
    ],
};

export default article;
