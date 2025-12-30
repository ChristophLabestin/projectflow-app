import React, { useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { MediaLibrary } from '../../components/MediaLibrary/MediaLibraryModal';
import { publishBlogPost, fetchExternalBlogPosts, BlogPost, updateBlogPost, fetchCategories, BlogCategory } from '../../services/blogService';
import { useToast, useConfirm } from '../../context/UIContext';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { AdvancedEditor } from '../../components/editor/AdvancedEditor';
import { BlogPostTemplate } from './components/blog/BlogPostTemplate';
import { BlogAIModal } from './components/blog/BlogAIModal';
import { TemplateManagerModal } from './components/TemplateManagerModal';
import { CategoryManager } from './components/CategoryManager';
import { Editor } from '@tiptap/react';
import { Sparkles, Layout } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export const BlogEditor = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: projectId, blogId } = useParams<{ id: string; blogId?: string }>();
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [coverImage, setCoverImage] = useState<string | null>(null);

    // Category State
    const [categories, setCategories] = useState<BlogCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
    const [showCategoryManager, setShowCategoryManager] = useState(false);

    const [tags, setTags] = useState<string[]>([]);
    const [status, setStatus] = useState<'draft' | 'published'>('draft');
    const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
    const [mediaPickerMode, setMediaPickerMode] = useState<'cover' | 'content'>('cover');
    const [isPublishing, setIsPublishing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const { showSuccess, showError } = useToast();

    // Store content in state to pass to preview
    const [content, setContent] = useState('');
    const editorRef = useRef<Editor | null>(null);

    // Check for existing blog post data
    React.useEffect(() => {
        const loadPost = async () => {
            if (!blogId) return;

            // 1. Try from navigation state
            if (location.state?.blogPost) {
                const post = location.state.blogPost as BlogPost;
                setTitle(post.title);
                setExcerpt(post.excerpt || '');
                setCoverImage(post.coverImage || null);
                if (post.category) setSelectedCategory(post.category);
                setTags(post.tags || []);
                setStatus(post.status);
                setContent(post.content || '');
                // Force update editor content
                // Use a small timeout to ensure editor is mounted if this is initial render
                setTimeout(() => {
                    editorRef.current?.commands.setContent(post.content || '');
                }, 0);
                return;
            }

            // 2. Fallback: Fetch from API if direct link/refresh
            if (projectId) {
                try {
                    const posts = await fetchExternalBlogPosts(projectId);
                    const post = posts.find(p => p.id === blogId);
                    if (post) {
                        setTitle(post.title);
                        setExcerpt(post.excerpt || '');
                        setCoverImage(post.coverImage || null);
                        if (post.category) setSelectedCategory(post.category);
                        setTags(post.tags || []);
                        setStatus(post.status);
                        setContent(post.content || '');
                        // Force update editor content
                        editorRef.current?.commands.setContent(post.content || '');
                    } else {
                        showError('Blog post not found');
                    }
                } catch (e) {
                    console.error('Failed to load post', e);
                    showError('Failed to load blog post');
                }
            }
        };

        const loadCats = async () => {
            try {
                const cats = await fetchCategories();
                setCategories(cats);
            } catch (e) {
                console.error("Failed to load categories", e);
            }
        };

        loadPost();
        loadCats();
    }, [blogId, projectId]);

    const handleOpenMediaPicker = (mode: 'cover' | 'content') => {
        setMediaPickerMode(mode);
        setIsMediaPickerOpen(true);
    };

    const handleMediaSelect = (url: string) => {
        if (mediaPickerMode === 'cover') {
            setCoverImage(url);
        } else {
            // Use the ref to interact with the editor instance
            editorRef.current?.chain().focus().setImage({ src: url }).run();
        }
        setIsMediaPickerOpen(false);
    };

    const handleAIGenerated = (data: { title: string; excerpt: string; content: string }) => {
        setTitle(data.title);
        setExcerpt(data.excerpt);
        // Update both local state and editor
        setContent(data.content);
        editorRef.current?.commands.setContent(data.content);
        showSuccess('Blog post drafted by CORA!');
    };

    const confirm = useConfirm();

    const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
    const [isAutosaving, setIsAutosaving] = useState(false);

    // Autosave Logic
    // We use a ref to track if changes are pending
    const hasChangesRef = useRef(false);

    // Track changes
    React.useEffect(() => {
        if (title || content || coverImage || selectedCategory || tags.length > 0) {
            hasChangesRef.current = true;
        }
    }, [title, content, coverImage, selectedCategory, tags]);

    const handleSave = async (newStatus: 'draft' | 'published', forceCreate = false, isAutosave = false) => {
        if (!projectId) return;

        // If autosave and no changes since last time, skip
        if (isAutosave && !hasChangesRef.current) return;

        // If explicitly publishing, always allowed. If autosave, only proceed if not busy.
        if (isAutosave) {
            setIsAutosaving(true);
        } else {
            setIsPublishing(true);
        }

        setStatus(newStatus);

        try {
            // Generate slug from title
            const slug = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');

            const currentEditor = editorRef.current;
            const htmlContent = currentEditor ? currentEditor.getHTML() : content;
            const finalExcerpt = excerpt.trim() || (currentEditor ? currentEditor.getText().slice(0, 150) + '...' : '');

            const postData = {
                slug,
                title,
                content: htmlContent,
                excerpt: finalExcerpt,
                coverImage,
                author: {
                    uid: auth.currentUser?.uid || 'anonymous',
                    name: auth.currentUser?.displayName || 'Anonymous',
                    photoURL: auth.currentUser?.photoURL || null
                },
                category: selectedCategory || { name: 'Uncategorized', slug: 'uncategorized' },
                tags: tags,
                status: newStatus,
                publishedAt: new Date().toISOString()
            };

            let savedPostId = blogId;

            if (blogId && !forceCreate) {
                // Update existing post
                if (!isAutosave) {
                    const confirmed = await confirm(
                        'Update Blog Post',
                        'Are you sure you want to update this existing post?'
                    );
                    if (!confirmed) {
                        setIsPublishing(false);
                        return;
                    }
                }

                await updateBlogPost(projectId, blogId, postData);
                if (!isAutosave) showSuccess(`Blog post updated successfully!`);
            } else {
                // Create new post
                if (forceCreate && !isAutosave) {
                    const confirmed = await confirm(
                        'Save as New Post',
                        'Are you sure you want to create a new copy of this post?'
                    );
                    if (!confirmed) {
                        setIsPublishing(false);
                        return;
                    }
                }

                // If this is an autosave of a NEW post, we create it once, then subsequent saves are updates
                const result = await publishBlogPost(projectId, postData);

                // Try to extract ID from result to update URL for future saves
                const newId = result.id || result._id || result.data?.id;
                if (newId) {
                    savedPostId = newId;
                    // Update URL silently so we are now "editing" this post instead of "creating"
                    navigate(`../blog/${newId}/edit`, { replace: true, state: { blogPost: { ...postData, id: newId } } });
                }

                if (!isAutosave) showSuccess(`Blog post ${newStatus === 'published' ? 'published' : 'saved'} successfully!`);
            }

            // Autosave complete
            hasChangesRef.current = false;
            setLastSavedTime(new Date());

            if (!isAutosave) {
                navigate('../blog');
            }
        } catch (error) {
            console.error('Failed to save', error);
            if (!isAutosave) showError('Failed to save blog post.');
        } finally {
            setIsPublishing(false);
            setIsAutosaving(false);
        }
    };

    // Stable reference to handleSave to avoid resetting interval
    const handleSaveRef = useRef(handleSave);
    React.useEffect(() => {
        handleSaveRef.current = handleSave;
    });

    // Autosave Interval - only mounts once
    React.useEffect(() => {
        const interval = setInterval(() => {
            if (hasChangesRef.current && status === 'draft') {
                handleSaveRef.current('draft', false, true);
            }
        }, 30000); // Autosave every 30 seconds

        return () => clearInterval(interval);
    }, [status]); // Only restart if status changes (e.g. becomes draft)

    // Construct preview post object
    const previewPost: Partial<BlogPost> = {
        title,
        content,
        excerpt,
        coverImage: coverImage || undefined,
        author: auth.currentUser?.displayName || 'Anonymous',
        createdAt: new Date(),
        // Add other necessary fields for template
    };

    return (
        <>
            <div className={`flex flex-col gap-4 bg-[var(--color-surface-bg)] dark:bg-black transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[99999] p-6' : 'h-[calc(100vh-140px)]'}`}>

                {/* Top Bar Actions */}
                <div className="flex items-center justify-between shrink-0">
                    <button
                        onClick={() => navigate('../blog')}
                        className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        <ArrowLeft size={18} />
                        <span>Back to Blogs</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className={`p-2 rounded-lg text-sm font-medium transition-colors ${isFullscreen ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}`}
                            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        >
                            <span className="material-symbols-outlined text-[20px]">
                                {isFullscreen ? 'close_fullscreen' : 'open_in_full'}
                            </span>
                        </button>


                        <div className="w-px h-6 bg-[var(--color-surface-border)] mx-1" />

                        <button
                            onClick={() => setIsAIModalOpen(true)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30 transition-colors flex items-center gap-2"
                        >
                            <Sparkles size={16} />
                            <span>Ask CORA</span>
                        </button>

                        <button
                            onClick={() => setIsTemplateModalOpen(true)}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 transition-colors flex items-center gap-2"
                            title="Manage Templates"
                        >
                            <Layout size={16} />
                            <span>Templates</span>
                        </button>

                        <div className="w-px h-6 bg-[var(--color-surface-border)] mx-1" />

                        {/* Autosave Status */}
                        <div className="text-xs text-[var(--color-text-muted)] opacity-70">
                            {isAutosaving ? 'Autosaving...' : lastSavedTime ? `Saved ${lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </div>

                        {blogId && (
                            <button
                                onClick={() => handleSave('draft', true)}
                                disabled={isPublishing}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 flex items-center gap-2"
                                title="Save as a new post (copy)"
                            >
                                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                Save as New
                            </button>
                        )}

                        <button
                            onClick={() => handleSave('draft')}
                            disabled={isPublishing}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
                        >
                            {isPublishing && status === 'draft' ? 'Saving...' : 'Save as Draft'}
                        </button>

                        <button
                            onClick={() => handleSave('published')}
                            disabled={isPublishing}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white dark:text-black hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isPublishing && status === 'published' && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            {isPublishing && status === 'published' ? 'Publishing...' : 'Publish Post'}
                        </button>
                    </div>
                </div>

                {/* Main Split View Area */}
                <div className="flex-1 min-h-0 flex gap-6">

                    {/* LEFT: Editor Side */}
                    <div className={`flex-1 flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden shadow-sm relative ${isFullscreen ? 'w-1/2' : 'w-1/2'}`}>
                        {/* Meta Data Inputs */}
                        <div className="p-6 border-b border-[var(--color-surface-border)] space-y-4 bg-white/50 dark:bg-black/20">
                            <input
                                type="text"
                                placeholder="Post Title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-[var(--color-text-muted)]/50 text-[var(--color-text-main)]"
                            />

                            {/* Excerpt Input */}
                            <textarea
                                placeholder="Enter a short excerpt (optional)..."
                                value={excerpt}
                                onChange={(e) => setExcerpt(e.target.value)}
                                className="w-full text-sm bg-transparent border-none outline-none placeholder:text-[var(--color-text-muted)]/50 text-[var(--color-text-muted)] resize-none h-[40px] focus:h-[80px] transition-all"
                            />

                            {/* Cover Image Selection */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleOpenMediaPicker('cover')}
                                    className="flex items-center gap-2 text-sm text-[var(--color-primary)] font-medium hover:underline"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                                    {coverImage ? 'Change Cover Image' : 'Add Cover Image'}
                                </button>
                                {coverImage && (
                                    <button
                                        onClick={() => setCoverImage(null)}
                                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>

                            {/* Category & Tags */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-muted)]">Category</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <select
                                                className="w-full appearance-none bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                                value={selectedCategory?.id || ''}
                                                onChange={(e) => {
                                                    const cat = categories.find(c => c.id === e.target.value);
                                                    setSelectedCategory(cat || null);
                                                }}
                                            >
                                                <option value="">Select a category...</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]">
                                                <span className="material-symbols-outlined text-sm">expand_more</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            className="shrink-0 aspect-square flex items-center justify-center p-0 w-10"
                                            onClick={() => setShowCategoryManager(true)}
                                            title="Manage Categories"
                                        >
                                            <span className="material-symbols-outlined">settings</span>
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-[var(--color-text-muted)]">Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((tag, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-surface-hover)] text-xs font-medium">
                                                {tag}
                                                <button
                                                    onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                                                    className="hover:text-red-500 flex items-center justify-center"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Add tag and press Enter..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = e.currentTarget.value.trim();
                                                if (val && !tags.includes(val)) {
                                                    setTags([...tags, val]);
                                                    e.currentTarget.value = '';
                                                }
                                            }
                                        }}
                                        className="w-full text-sm bg-black/5 dark:bg-white/5 border-none rounded-lg px-3 py-2 outline-none placeholder:text-[var(--color-text-muted)] text-[var(--color-text-main)]"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Advanced Editor */}
                        <div className="flex-1 overflow-y-auto bg-[var(--color-surface-card)]">
                            <AdvancedEditor
                                editorRef={editorRef}
                                initialContent={content}
                                onUpdate={setContent}
                                placeholder="Write something amazing... Type '/' for commands."
                            />
                        </div>
                    </div>


                    {/* RIGHT: Preview Side */}
                    <div className="flex-1 flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden shadow-sm relative w-1/2">
                        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-black/5 text-xs font-semibold uppercase tracking-wider text-black/50 pointer-events-none dark:bg-white/10 dark:text-white/50">
                            Live Preview
                        </div>

                        {/* Reusable Template Usage */}
                        <div className="flex-1 overflow-y-auto">
                            <BlogPostTemplate post={previewPost} isPreview={true} />
                        </div>
                    </div>

                </div>
            </div>

            <MediaLibrary
                isOpen={isMediaPickerOpen}
                onClose={() => setIsMediaPickerOpen(false)}
                onSelect={(asset) => handleMediaSelect(asset.url)}
                projectId={projectId || ''}
            />

            <BlogAIModal
                isOpen={isAIModalOpen}
                onClose={() => setIsAIModalOpen(false)}
                onGenerate={(result) => {
                    // Assuming result is { title, excerpt, content }
                    if (result.title) setTitle(result.title);
                    if (result.excerpt) setExcerpt(result.excerpt);
                    if (result.content) {
                        editorRef.current?.commands.setContent(result.content);
                        setContent(result.content);
                    }
                    // No close here? usually modal handles validation or confirm.
                    // But onClose is already passed.
                }}
            />

            {projectId && (
                <TemplateManagerModal
                    isOpen={isTemplateModalOpen}
                    onClose={() => setIsTemplateModalOpen(false)}
                    currentContent={content || ''}
                    projectId={projectId}
                    onLoadTemplate={(newContent) => {
                        editorRef.current?.commands.setContent(newContent);
                        setContent(newContent);
                        handleSave('draft');
                    }}
                />
            )}

            {showCategoryManager && (
                <CategoryManager
                    onClose={() => setShowCategoryManager(false)}
                    onSelect={(cat) => setSelectedCategory(cat)}
                />
            )}
        </>
    );
};
