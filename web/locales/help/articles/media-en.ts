import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'media',
    category: 'ai',
    icon: 'perm_media',
    title: 'Media library',
    summary: 'Keep images and videos in one place, upload new files, edit images and pick media where you need it.',
    keywords: ['media', 'library', 'images', 'videos', 'upload', 'assets', 'photos', 'stock', 'unsplash', 'nano banana', 'edit image', 'cover'],
    sections: [
        {
            id: 'overview',
            title: 'What the media library holds',
            keywords: ['assets', 'folders', 'projects', 'uncategorized', 'files'],
            blocks: [
                { type: 'text', text: 'The [Media](/media) page collects the images and videos from your projects in one place. Images you upload in your projects or generate with AI show up here too.' },
                { type: 'text', text: 'Files are grouped by project. Files that do not belong to a project are listed under **Uncategorized Workspace Assets**. Depending on your sidebar, **Media** may sit behind **More**.' },
            ],
        },
        {
            id: 'upload',
            title: 'Upload media',
            keywords: ['upload', 'add', 'image', 'video', 'project'],
            blocks: [
                { type: 'steps', items: [
                    'Click **Upload Media** to add files to the workspace library, or **Upload to …** on a project group to add them to that project.',
                    'Choose one or more images or videos.',
                    'Wait for the confirmation. The files appear in their group.',
                ] },
            ],
        },
        {
            id: 'manage',
            title: 'Copy, download, edit and delete',
            keywords: ['copy link', 'download', 'edit', 'delete', 'replace', 'crop'],
            blocks: [
                { type: 'text', text: 'Hover over a file to see its actions:' },
                { type: 'list', items: [
                    '**Copy Link** copies the file URL to your clipboard.',
                    '**Download** saves the file to your computer.',
                    '**Edit** opens the image editor. You can save the result as a new image or replace the original.',
                    '**Delete** removes the file after you confirm. This cannot be undone.',
                ] },
            ],
        },
        {
            id: 'picker',
            title: 'Pick media inside the app',
            keywords: ['picker', 'select image', 'cover image', 'blog', 'stock photos', 'nano banana', 'ai image', 'unsplash'],
            blocks: [
                { type: 'text', text: 'Where you choose an image, for example a blog post cover, a **Media Library** window opens with these tabs:' },
                { type: 'terms', items: [
                    { term: 'Personal Images / Project Images', text: 'Pick from files you already have. You can switch between the current project and all media in the workspace.' },
                    { term: 'Upload', text: 'Drop or browse files. PNG, JPG, GIF and MP4 up to 10 MB are supported.' },
                    { term: 'Nano Banana', text: 'An AI design studio. Use **Generate** to create an image from a prompt, or **Rework** to transform a reference image.' },
                    { term: 'Stock Photos', text: 'Search photos from Unsplash and save them to your library.' },
                ] },
                { type: 'callout', tone: 'note', text: 'AI image generation has its own monthly image limit.' },
            ],
        },
    ],
};

export default article;
