import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { fetchExternalBlogPosts, BlogPost, deleteBlogPost } from '../../services/blogService';
import { subscribeMarketingSettings } from '../../services/marketingSettingsService';
import { useToast, useConfirm } from '../../context/UIContext';
import { Button } from '../../components/ui/Button';

const BlogList = () => {
    const { t, language, dateLocale } = useLanguage();
    const navigate = useNavigate();
    const { id: projectId } = useParams();
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Language filter state
    const [supportedLanguages, setSupportedLanguages] = useState<string[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string | 'all'>('all');

    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    // Subscribe to marketing settings for language config
    useEffect(() => {
        if (!projectId) return;
        const unsubscribe = subscribeMarketingSettings(projectId, (settings) => {
            if (settings?.apiIntegration?.supportedLanguages) {
                setSupportedLanguages(settings.apiIntegration.supportedLanguages);
            }
        });
        return () => unsubscribe();
    }, [projectId]);

    React.useEffect(() => {
        const loadBlogs = async () => {
            if (!projectId) return;
            setIsLoading(true);
            setError(null);
            try {
                // Fetch from external API
                const externalBlogs = await fetchExternalBlogPosts(projectId);
                setBlogs(externalBlogs);
            } catch (err) {
                console.error('Failed to fetch blogs', err);
                setError('Failed to load blog posts. Please check your integration settings.');
            } finally {
                setIsLoading(false);
            }
        };

        loadBlogs();
    }, [projectId]);

    const handleCreate = () => {
        navigate('create');
    };

    const handleDelete = async (e: React.MouseEvent, blogId: string) => {
        e.stopPropagation(); // Prevent navigation
        if (!projectId) return;

        const confirmed = await confirm(
            t('marketing.blogList.deleteTitle'),
            t('marketing.blogList.deleteMessage')
        );

        if (!confirmed) return;

        try {
            await deleteBlogPost(projectId, blogId);
            setBlogs(prev => prev.filter(b => b.id !== blogId));
            showSuccess(t('marketing.blogList.deleted'));
        } catch (err) {
            console.error('Failed to delete post', err);
            showError(t('marketing.blogList.deleteFailed'));
        }
    };

    const handleEdit = (blogId: string) => {
        const blog = blogs.find(b => b.id === blogId);
        navigate(`${blogId}`, { state: { blogPost: blog } });
    };

    // Filter blogs by selected language
    const filteredBlogs = selectedLanguage === 'all'
        ? blogs
        : blogs.filter(blog => blog.language === selectedLanguage);

    const groupedBlogs = React.useMemo(() => {
        // If specific language selected, show as is (but mapped to structure)
        if (selectedLanguage !== 'all') {
            return filteredBlogs.map(b => ({
                ...b,
                availableLanguages: b.language ? [{ lang: b.language || 'en', id: b.id }] : [],
            }));
        }

        // Group by translationGroupId
        const groups: Record<string, BlogPost[]> = {};
        const standalone: BlogPost[] = [];

        filteredBlogs.forEach(blog => {
            const groupId = blog.translationId || blog.translationGroupId;
            if (groupId) {
                if (!groups[groupId]) {
                    groups[groupId] = [];
                }
                groups[groupId].push(blog);
            } else {
                standalone.push(blog);
            }
        });

        const groupRepresentatives = Object.values(groups).map(group => {
            // Normalize current language
            const currentLang = (language || 'en').toLowerCase();

            // Pick representative: 
            // 1. Match current app language
            // 2. Match 'en'
            // 3. First available
            const primary = group.find(b => (b.language || 'en').toLowerCase() === currentLang) ||
                group.find(b => (b.language || 'en').toLowerCase() === 'en') ||
                group[0];

            return {
                ...primary,
                availableLanguages: group.map(b => ({ lang: b.language || 'en', id: b.id })).sort((a, b) => {
                    const langA = (a.lang || 'en').toLowerCase();
                    const langB = (b.lang || 'en').toLowerCase();

                    // Sort: Current language first, then English, then others
                    if (langA === currentLang) return -1;
                    if (langB === currentLang) return 1;
                    if (langA === 'en') return -1;
                    if (langB === 'en') return 1;
                    return langA.localeCompare(langB);
                }),
            };
        });

        const standaloneReps = standalone.map(b => ({
            ...b,
            availableLanguages: b.language ? [{ lang: b.language, id: b.id }] : []
        }));

        // Sort by created date
        return [...groupRepresentatives, ...standaloneReps].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [filteredBlogs, selectedLanguage, language]);

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-main">{t('marketing.blogList.title')}</h1>
                    <p className="text-sm text-muted">{t('marketing.blogList.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Language Filter - Only show if languages are configured */}
                    {supportedLanguages.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">{t('marketing.blogList.language')}</span>
                            <select
                                value={selectedLanguage}
                                onChange={(e) => setSelectedLanguage(e.target.value)}
                                className="px-3 py-1.5 text-sm bg-surface border border-surface rounded-lg focus:border-primary outline-none"
                            >
                                <option value="all">{t('marketing.blogList.allLanguages')}</option>
                                {supportedLanguages.map(lang => (
                                    <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center p-1 bg-surface-hover rounded-lg">
                        <button aria-label={t('marketing.blogList.gridView')}
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                                ? 'bg-surface-card shadow-sm text-main'
                                : 'text-muted hover:text-main'}`}
                            title={t('marketing.blogList.gridView')}
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                        <button aria-label={t('marketing.blogList.listView')}
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                                ? 'bg-surface-card shadow-sm text-main'
                                : 'text-muted hover:text-main'}`}
                            title={t('marketing.blogList.listView')}
                        >
                            <span className="material-symbols-outlined text-[20px]">view_list</span>
                        </button>
                    </div>

                    <Button
                        onClick={handleCreate}
                        className="px-4 py-2 rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm font-medium gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        {t('marketing.blogList.createPost')}
                    </Button>
                </div>
            </div>

            {/* Grid */}
            {isLoading && (
                <div className="flex justify-center p-12">
                    <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="p-4 mb-6 rounded-lg bg-error/10 border border-error/20 text-error flex items-center gap-3">
                    <span className="material-symbols-outlined">error</span>
                    <p>{error}</p>
                    <button onClick={() => window.location.reload()} className="ml-auto underline text-sm">{t('common.retry')}</button>
                </div>
            )}

            {/* Content Area */}
            {!isLoading && (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
                        {groupedBlogs.map((blog: any) => (
                            <div
                                key={blog.id}
                                onClick={() => handleEdit(blog.id)}
                                className="group relative flex flex-col bg-card border border-surface rounded-xl overflow-hidden hover:shadow-md hover:border-[var(--color-primary-light)] transition-all cursor-pointer h-[280px]"
                            >
                                {/* Status Badge */}
                                <div className="absolute top-3 right-3 z-10">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm border ${blog.status === 'published'
                                        ? 'bg-surface-card text-success border-success/20'
                                        : 'bg-surface-card text-warning border-warning/20'
                                        }`}>
                                        {blog.status === 'published' ? t('marketing.blogList.status.published') : t('marketing.blogList.status.draft')}
                                    </span>
                                </div>
                                <div className="absolute top-3 right-3 z-20 mt-8 flex flex-row items-center gap-1">
                                    {blog.availableLanguages && blog.availableLanguages.map((langItem: any) => (
                                        <button
                                            key={langItem.lang}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (langItem.id !== blog.id) {
                                                    navigate(`${langItem.id}`);
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-sm transition-all uppercase tracking-wide ${langItem.id === blog.id
                                                ? 'bg-surface-card text-primary ring-1 ring-primary/10'
                                                : 'bg-surface-card/90 text-muted hover:bg-surface-card hover:text-primary'
                                                }`}
                                            title={t('marketing.blogList.switchTo').replace('{lang}', langItem.lang.toUpperCase())}
                                        >
                                            {langItem.lang}
                                        </button>
                                    ))}
                                </div>

                                {/* Delete Button (Visible on hover) */}
                                <button aria-label={t('marketing.blogList.deletePost')}
                                    onClick={(e) => handleDelete(e, blog.id)}
                                    className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-surface-card/90 text-error opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/10 shadow-sm"
                                    title={t('marketing.blogList.deletePost')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>

                                {/* Cover Image */}
                                <div className="h-40 bg-surface-hover relative overflow-hidden">
                                    {blog.coverImage ? (
                                        <img
                                            src={blog.coverImage}
                                            alt={blog.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted">
                                            <span className="material-symbols-outlined text-5xl opacity-20">image</span>
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 p-4 flex flex-col">
                                    <h3 className="text-lg font-semibold text-main mb-2 line-clamp-1 group-hover:text-primary transition-colors">
                                        {blog.title}
                                    </h3>
                                    <p className="text-sm text-muted line-clamp-2 mb-auto">
                                        {blog.excerpt}
                                    </p>

                                    {/* Category Badge */}
                                    {blog.category && (
                                        <div className="mt-3">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-hover text-muted border border-surface">
                                                {blog.category.name}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-xs text-muted mt-4">
                                        <span>{typeof blog.author === 'object' ? blog.author.name : blog.author}</span>
                                        <span>{format(new Date(blog.createdAt), 'PP', { locale: dateLocale })}</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Create New Card (Placeholder style) */}
                        <button
                            onClick={handleCreate}
                            className="flex flex-col items-center justify-center gap-3 h-[280px] border-2 border-dashed border-surface rounded-xl hover:border-primary hover:bg-surface-hover transition-all group text-muted hover:text-primary"
                        >
                            <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center group-hover:bg-[var(--color-primary-light)] transition-colors">
                                <span className="material-symbols-outlined text-2xl">add</span>
                            </div>
                            <span className="font-medium">{t('marketing.blogList.createBlog')}</span>
                        </button>
                    </div>
                ) : (
                    <div className="bg-card border border-surface rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-surface border-b border-surface">
                                    <tr>
                                        <th className="py-3 px-4 font-medium text-muted w-1/2">{t('marketing.blogList.col.post')}</th>
                                        <th className="py-3 px-4 font-medium text-muted">{t('marketing.blogList.col.author')}</th>
                                        <th className="py-3 px-4 font-medium text-muted">{t('marketing.blogList.col.status')}</th>
                                        <th className="py-3 px-4 font-medium text-muted">{t('marketing.blogList.col.date')}</th>
                                        <th className="py-3 px-4 font-medium text-muted text-right">{t('marketing.blogList.col.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--color-surface-border)]">
                                    {groupedBlogs.map((blog: any) => (
                                        <tr
                                            key={blog.id}
                                            onClick={() => handleEdit(blog.id)}
                                            className="hover:bg-surface-hover cursor-pointer transition-colors group"
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-surface-hover overflow-hidden shrink-0">
                                                        {blog.coverImage ? (
                                                            <img src={blog.coverImage} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <span className="material-symbols-outlined text-[18px] text-muted/50">image</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-main group-hover:text-primary transition-colors">{blog.title}</div>
                                                        <div className="text-xs text-muted line-clamp-1 max-w-[300px]">{blog.excerpt}</div>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {blog.availableLanguages && blog.availableLanguages.length > 0 ? (
                                                                blog.availableLanguages.map((langItem: any) => (
                                                                    <button
                                                                        key={langItem.lang}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (langItem.id !== blog.id) {
                                                                                navigate(`${langItem.id}`);
                                                                            }
                                                                        }}
                                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${langItem.lang === blog.language
                                                                            ? 'bg-primary/10 text-primary border-primary/20'
                                                                            : 'bg-surface-hover text-muted border-surface hover:bg-primary/10 hover:text-primary'
                                                                            }`}
                                                                        title={t('marketing.blogList.switchTo').replace('{lang}', langItem.lang.toUpperCase())}
                                                                    >
                                                                        {langItem.lang.toUpperCase()}
                                                                    </button>
                                                                ))
                                                            ) : (
                                                                blog.language && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                                                                        {blog.language.toUpperCase()}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-muted">{typeof blog.author === 'object' ? blog.author.name : blog.author}</td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${blog.status === 'published'
                                                    ? 'bg-success/10 text-success'
                                                    : 'bg-warning/10 text-warning'
                                                    }`}>
                                                    {blog.status === 'published' ? t('marketing.blogList.status.published') : t('marketing.blogList.status.draft')}
                                                </span>
                                                {blog.language && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary ml-1">
                                                        {blog.language.toUpperCase()}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-muted">
                                                {format(new Date(blog.createdAt), 'PP', { locale: dateLocale })}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button aria-label={t('common.delete')}
                                                    onClick={(e) => handleDelete(e, blog.id)}
                                                    className="p-1.5 rounded-md text-muted hover:text-error hover:bg-error/10 transition-colors opacity-0 group-hover:opacity-100"
                                                    title={t('common.delete')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredBlogs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-muted">
                                                No blog posts found. <button onClick={handleCreate} className="text-primary hover:underline">Create your first post</button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
        </div>
    );
};

export { BlogList };
