import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { auth } from '../../services/firebase';
import { MediaLibrary } from '../../components/MediaLibrary/MediaLibraryModal';
import { publishBlogPost, fetchExternalBlogPosts, BlogPost, updateBlogPost, fetchCategories, BlogCategory } from '../../services/blogService';
import { subscribeMarketingSettings } from '../../services/marketingSettingsService';
import { translateBlogPostAI } from '../../services/geminiService';
import { useToast, useConfirm } from '../../context/UIContext';
import { motion } from 'framer-motion';
import { ArrowLeft, Globe } from 'lucide-react';
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
    const [translationId, setTranslationId] = useState<string | null>(null);
    const [linkedTranslations, setLinkedTranslations] = useState<Record<string, string>>({});

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
    const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);

    // Store content in state to pass to preview
    const [content, setContent] = useState('');
    const editorRef = useRef<Editor | null>(null);

    // Multi-language support
    const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
    const [currentLanguage, setCurrentLanguage] = useState<string>('en');

    const [showLanguageMenu, setShowLanguageMenu] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);

    // Initial load from location state (for translations)
    useEffect(() => {
        const state = location.state as any;

        // precise language setting
        if (state?.blogPost?.language) {
            setCurrentLanguage(state.blogPost.language);
        }

        if (state?.autoTranslate && state?.blogPost) {
            const timer = setTimeout(() => {
                handleAutoTranslate(
                    state.blogPost.content,
                    state.blogPost.title,
                    state.blogPost.excerpt
                );
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [location.state]);

    const handleAutoTranslate = async (overrideContent?: string, overrideTitle?: string, overrideExcerpt?: string) => {
        const contentToUse = overrideContent || content;
        if (!contentToUse) return;

        setIsTranslating(true);
        try {
            const state = location.state as { sourceLanguage?: string };
            const srcLang = state?.sourceLanguage;

            const { content: translatedHtml, title: translatedTitle, excerpt: translatedExcerpt } = await translateBlogPostAI(
                contentToUse,
                (location.state as any)?.blogPost?.language || currentLanguage,
                srcLang,
                overrideTitle || title,
                overrideExcerpt || excerpt
            );

            setContent(translatedHtml);
            editorRef.current?.commands.setContent(translatedHtml);

            if (translatedTitle) setTitle(translatedTitle);
            if (translatedExcerpt) setExcerpt(translatedExcerpt);

            showSuccess(`Content translated to ${((location.state as any)?.blogPost?.language || currentLanguage).toUpperCase()}`);
        } catch (error) {
            console.error(error);
            showError('Failed to translate content');
        } finally {
            setIsTranslating(false);
        }
    };

    // Subscribe to marketing settings to get supported languages
    useEffect(() => {
        if (!projectId) return;
        const unsubscribe = subscribeMarketingSettings(projectId, (settings) => {
            if (settings?.apiIntegration?.supportedLanguages) {
                setSupportedLanguages(settings.apiIntegration.supportedLanguages);
                // Set default language if not already set
                if (settings.apiIntegration.supportedLanguages.length > 0 && !settings.apiIntegration.supportedLanguages.includes(currentLanguage)) {
                    setCurrentLanguage(settings.apiIntegration.supportedLanguages[0]);
                }
            }
        });
        return () => unsubscribe();
    }, [projectId]);

    const loadCats = useCallback(async () => {
        try {
            if (!projectId) return;
            const cats = await fetchCategories(projectId);
            setCategories(cats);

            // Sync selected category to ensure name/slug changes are picked up
            setSelectedCategory(prev => {
                if (!prev) return null;
                const fresh = cats.find(c => c.id === prev.id);
                return fresh || prev;
            });
        } catch (e) {
            console.error("Failed to load categories", e);
        }
    }, [projectId]);

    // Check for existing blog post data
    React.useEffect(() => {
        const loadPost = async () => {
            if (!blogId && !location.state?.blogPost) return;

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
                setContent(post.content || '');
                setTranslationId(post.translationId || post.translationGroupId || null);
                if (post.translations) {
                    setLinkedTranslations(post.translations);
                } else if (post.translationId) {
                    // Fallback for transition period: fetch manually if translations map not yet present
                    // This can be removed once all posts are migrated
                    // But for now we rely on the backend trigger to populate 'translations'
                }
                // Use a small timeout to ensure editor is mounted if this is initial render
                setTimeout(() => {
                    editorRef.current?.commands.setContent(post.content || '');
                    // Reset change tracking after initial load from state
                    hasChangesRef.current = false;
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
                        setTranslationId(post.translationId || post.translationGroupId || null);
                        if (post.language) setCurrentLanguage(post.language);
                        if (post.translations) {
                            setLinkedTranslations(post.translations);
                        }
                        editorRef.current?.commands.setContent(post.content || '');
                        // Reset change tracking after initial load from API
                        hasChangesRef.current = false;
                    } else {
                        showError('Blog post not found');
                    }
                } catch (e) {
                    console.error('Failed to load post', e);
                    showError('Failed to load blog post');
                }
            }
        };

        loadPost();
        loadCats();
    }, [blogId, projectId, loadCats]);

    // Poll for translation updates if we have an ID but no map (or just to keep fresh)
    useEffect(() => {
        if (!projectId || !translationId) return;

        // Simple polling to catch updates from the backend trigger
        const poll = setInterval(async () => {
            try {
                const posts = await fetchExternalBlogPosts(projectId);
                const currentPost = posts.find(p => p.id === blogId);
                if (currentPost?.translations) {
                    setLinkedTranslations(currentPost.translations);
                }
            } catch (e) {
                // ignore silent errors
            }
        }, 5000);

        return () => clearInterval(poll);
    }, [projectId, translationId, blogId]);

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
    const isInitialMount = useRef(true);
    React.useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        hasChangesRef.current = true;
    }, [title, content, coverImage, selectedCategory, tags, excerpt]);

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
                publishedAt: new Date().toISOString(),
                language: currentLanguage,
                translationId: translationId || undefined
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
                    navigate(`/project/${projectId}/marketing/blog/${newId}`, { replace: true, state: { blogPost: { ...postData, id: newId } } });
                }

                if (!isAutosave) showSuccess(`Blog post ${newStatus === 'published' ? 'published' : 'saved'} successfully!`);
            }

            // Autosave complete
            hasChangesRef.current = false;
            setLastSavedTime(new Date());

            if (!isAutosave) {
                navigate(`/project/${projectId}/marketing/blog`);
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
                        onClick={() => navigate(`/project/${projectId}/marketing/blog`)}
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



                        {/* Language Selector - Only show if multiple languages are configured */}
                        {supportedLanguages.length > 1 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-2 border border-[var(--color-surface-border)]"
                                    title="Select Language"
                                >
                                    <Globe size={16} />
                                    <span className="uppercase">{currentLanguage}</span>
                                    <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                </button>

                                {showLanguageMenu && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowLanguageMenu(false)}
                                        />
                                        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-lg py-1 min-w-[180px]">
                                            <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-surface-border)]">
                                                Post Language
                                            </div>
                                            {supportedLanguages.map(lang => {
                                                const isCurrent = currentLanguage === lang;
                                                const linkedSlug = linkedTranslations[lang];
                                                const isAvailable = isCurrent || !!linkedSlug;

                                                if (!isAvailable) return null;

                                                return (
                                                    <button
                                                        key={lang}
                                                        onClick={() => {
                                                            setShowLanguageMenu(false);
                                                            if (linkedSlug && linkedSlug !== blogId) {
                                                                // If we have slug, we need to find ID or route by slug?
                                                                // The current app routes by ID mostly, but let's check if we can resolve it.
                                                                // Actually, fetchExternalBlogPosts returns ID.
                                                                // The backend map stores SLUG.
                                                                // We might need to fetch the post by slug to get ID or just assume ID=Slug if that's how it works?
                                                                // Looking at blogService: id = item.id || fields.id.
                                                                // Cloud function uses slug as Doc ID. So likely ID == Slug.
                                                                navigate(`/project/${projectId}/marketing/blog/${linkedSlug}`);
                                                            }
                                                        }}
                                                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--color-surface-hover)] ${isCurrent ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-text-main)]'
                                                            }`}
                                                    >
                                                        {isCurrent && (
                                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                                        )}
                                                        <span className={isCurrent ? '' : 'ml-6'}>{lang.toUpperCase()}</span>
                                                    </button>
                                                );
                                            })}

                                            {blogId && (
                                                <>
                                                    <div className="border-t border-[var(--color-surface-border)] my-1" />
                                                    <div className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                                                        Create a translation in another language:
                                                    </div>
                                                    {supportedLanguages
                                                        .filter(lang => lang !== currentLanguage && !linkedTranslations[lang])
                                                        .map(lang => (
                                                            <button
                                                                key={`translate-${lang}`}
                                                                onClick={async () => {
                                                                    setCurrentLanguage(lang);
                                                                    setShowLanguageMenu(false);

                                                                    // Ensure we have a translationId
                                                                    let activeId = translationId;
                                                                    if (!activeId && blogId) {
                                                                        activeId = crypto.randomUUID();
                                                                        // Save ID to current post first
                                                                        try {
                                                                            await updateBlogPost(projectId!, blogId, { translationId: activeId });
                                                                            setTranslationId(activeId);
                                                                        } catch (e) {
                                                                            console.error("Failed to init translation ID", e);
                                                                            showError("Failed to prepare translation");
                                                                            return;
                                                                        }
                                                                    }

                                                                    // Ask for AI Translation
                                                                    const useAI = await confirm(
                                                                        'Use AI Translation?',
                                                                        `Do you want to automatically translate the content to ${lang.toUpperCase()} using AI?`
                                                                    );

                                                                    navigate(`/project/${projectId}/marketing/blog/create`, {
                                                                        state: {
                                                                            blogPost: {
                                                                                title,
                                                                                content,
                                                                                excerpt,
                                                                                coverImage,
                                                                                category: selectedCategory,
                                                                                tags,
                                                                                language: lang,
                                                                                translationId: activeId
                                                                            },
                                                                            isTranslation: true,
                                                                            sourceLanguage: currentLanguage,
                                                                            autoTranslate: useAI
                                                                        }
                                                                    });
                                                                }}
                                                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--color-surface-hover)] text-[var(--color-primary)]"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">translate</span>
                                                                Create {lang.toUpperCase()} Translation
                                                            </button>
                                                        ))}
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
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

                        <Button
                            onClick={() => handleSave('published')}
                            disabled={isPublishing}
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed gap-2"
                        >
                            {isPublishing && status === 'published' && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                            {isPublishing && status === 'published' ? 'Publishing...' : 'Publish Post'}
                        </Button>
                    </div>
                </div>

                {isTranslating && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-3 text-amber-800 dark:text-amber-200">
                            <span className="animate-spin material-symbols-outlined text-[20px]">refresh</span>
                            <span className="font-medium">Translating content to {currentLanguage.toUpperCase()}...</span>
                        </div>
                        <div className="text-xs opacity-75">
                            This may take a few seconds
                        </div>
                    </div>
                )}



                {/* Main Split View Area */}
                <div className="flex-1 min-h-0 flex gap-6">

                    {/* LEFT: Editor Side */}
                    <div className={`flex-1 flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden shadow-sm relative ${isFullscreen ? 'w-1/2' : 'w-1/2'}`}>
                        {/* Meta Data Inputs */}
                        <div className="border-b border-[var(--color-surface-border)] bg-white/50 dark:bg-black/20">
                            <div className="p-6 pb-4 flex items-center justify-between gap-4">
                                <input
                                    type="text"
                                    placeholder="Post Title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="flex-1 text-3xl font-bold bg-transparent border-none outline-none placeholder:text-[var(--color-text-muted)]/50 text-[var(--color-text-main)]"
                                />
                                <button
                                    onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
                                    className="p-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] transition-colors flex items-center justify-center"
                                    title={isSettingsCollapsed ? 'Expand Settings' : 'Collapse Settings'}
                                >
                                    <span className="material-symbols-outlined">
                                        {isSettingsCollapsed ? 'expand_more' : 'expand_less'}
                                    </span>
                                </button>
                            </div>

                            <motion.div
                                initial={false}
                                animate={{
                                    height: isSettingsCollapsed ? 0 : 'auto',
                                    opacity: isSettingsCollapsed ? 0 : 1,
                                    marginBottom: isSettingsCollapsed ? 0 : 0
                                }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="px-6 pb-6 space-y-4">
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

                                    {/* Category & Tags Row */}
                                    <div className="grid grid-cols-2 gap-6">
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
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5 text-[var(--color-text-muted)]">Tags</label>
                                            <div className="space-y-2">
                                                {tags.length > 0 && (
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
                                                )}
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
                                                    className="w-full text-sm bg-black/5 dark:bg-white/5 border-none rounded-lg px-3 py-2.5 outline-none placeholder:text-[var(--color-text-muted)] text-[var(--color-text-main)]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
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
                projectId={projectId}
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

            {
                projectId && (
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
                )
            }

            {
                showCategoryManager && (
                    <CategoryManager
                        onClose={() => {
                            setShowCategoryManager(false);
                            loadCats();
                        }}
                        onSelect={(cat) => setSelectedCategory(cat)}
                        projectId={projectId || ''}
                    />
                )
            }
        </>
    );
};
