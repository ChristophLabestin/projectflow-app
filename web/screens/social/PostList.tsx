import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { subscribeSocialPosts, deleteSocialPost } from '../../services/dataService';
import { SocialPost } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getSocialPostStatusLabel } from '../../utils/socialLocalization';
import { format } from 'date-fns';
import { ReviewPostModal } from './components/ReviewPostModal';
import { PlatformIcon } from './components/PlatformIcon';
import { useConfirm } from '../../context/UIContext';
import { Button } from '../../components/ui/Button';

export const PostList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);
    // View mode is less relevant with horizontal scroll groups, but we can keep it or force 'card' look for horizontal.
    // The user requested horizontal scrolling, which implies a row of cards.
    // We will stick to the card design for the horizontal scroll items.

    const { t, dateLocale, dateFormat } = useLanguage();
    const confirm = useConfirm();

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeSocialPosts(projectId, (data) => {
            // Sort by created/scheduled
            const sorted = data.sort((a, b) => {
                const dateA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.createdAt).getTime();
                const dateB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.createdAt).getTime();
                return dateB - dateA; // Newest first
            });
            setPosts(sorted);
        });
        return () => unsub();
    }, [projectId]);

    const handleDelete = async (e: React.MouseEvent, post: SocialPost) => {
        e.stopPropagation();
        if (!projectId) return;

        const confirmed = await confirm(
            t('social.postForm.delete.confirmTitle'),
            t('social.postForm.delete.confirmMessage')
        );

        if (confirmed) {
            await deleteSocialPost(projectId, post.id);
        }
    };

    const failedPosts = posts.filter(p => p.status === 'Failed');
    const recentPosts = posts.filter(p => p.status !== 'Failed');

    // Limit recent posts to 20
    const displayedRecentPosts = recentPosts.slice(0, 20);
    const hasMorePosts = recentPosts.length > 20;

    const renderPostCard = (post: SocialPost, isFailed: boolean = false) => {
        const hasMedia = post.assets && post.assets.length > 0;
        const mainAsset = hasMedia ? post.assets[0] : null;

        return (
            <div
                key={post.id}
                className={`group relative flex-shrink-0 w-[280px] bg-card border rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all ${isFailed ? 'border-red-300 dark:border-red-800 ring-1 ring-red-100 dark:ring-red-900/30' : 'border-surface hover:border-[var(--color-primary-light)]'}`}
                onClick={() => navigate(`/project/${projectId}/social/edit/${post.id}`)}
            >
                {/* Media / Thumbnail */}
                <div className="aspect-square w-full bg-surface-hover relative overflow-hidden flex items-center justify-center">
                    {mainAsset ? (
                        mainAsset.type === 'video' ? (
                            <video src={mainAsset.url} className="w-full h-full object-cover" muted />
                        ) : (
                            <img src={mainAsset.url} className="w-full h-full object-cover" loading="lazy" />
                        )
                    ) : (
                        <span className="material-symbols-outlined text-4xl text-subtle">
                            {post.format === 'Text' ? 'article' : 'image'}
                        </span>
                    )}

                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />

                    {/* Platform Badge */}
                    <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-sm p-1.5 rounded-lg shadow-sm">
                        <div className="size-4">
                            <PlatformIcon platform={post.platform} />
                        </div>
                    </div>
                </div>

                {/* Content Info */}
                <div className="p-4 flex flex-col h-[140px]">
                    <div className="flex items-center justify-between mb-2">
                        <span className={`relative group/status flex items-center justify-center text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${post.status === 'Published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            post.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                post.status === 'In Review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    post.status === 'Failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                        'bg-surface-hover text-muted'
                            }`}>
                            {getSocialPostStatusLabel(post.status, t)}
                            {post.status === 'Failed' && post.error && (
                                <div className="absolute bottom-full left-0 mb-2 hidden group-hover/status:block w-48 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50 normal-case font-normal text-left">
                                    {post.error}
                                    <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
                                </div>
                            )}
                        </span>
                        {post.scheduledFor && (
                            <span className="text-[10px] font-medium text-muted flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                {format(new Date(post.scheduledFor), 'MMM d')}
                            </span>
                        )}
                    </div>

                    <p className="text-sm text-main line-clamp-2 font-medium mb-3 flex-1">
                        {post.content.caption || <span className="italic text-muted opacity-50">{t('social.postList.noCaption')}</span>}
                    </p>

                    <div className="flex items-center justify-between mt-auto text-xs text-muted">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[14px]">tag</span>
                            <span>{post.content.hashtags?.length || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                        onClick={(e) => handleDelete(e, post)}
                        className="p-1.5 bg-white/90 dark:bg-black/80 backdrop-blur-sm border border-transparent hover:border-red-200 rounded-lg shadow-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-all"
                        title={t('social.postForm.delete.title')}
                    >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-10 pb-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="h2 mb-1">{t('social.postList.title')}</h1>
                    <p className="text-muted">{t('social.postList.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to={`/project/${projectId}/social/create`}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm shadow-indigo-500/20"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span>{t('social.postList.newPost')}</span>
                    </Link>
                </div>
            </div>

            {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-3xl border border-surface border-dashed">
                    <div className="size-20 bg-surface-hover rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-muted">post_add</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('social.postList.empty')}</h3>
                    <p className="text-muted max-w-md text-center mb-6">{t('social.approvals.emptySubtitle')}</p>
                    <Link
                        to={`/project/${projectId}/social/create`}
                    >
                        <Button variant="secondary">{t('social.postList.newPost')}</Button>
                    </Link>
                </div>
            ) : (
                <div className="space-y-10 animate-fade-in">

                    {/* FAILED SECTION */}
                    {failedPosts.length > 0 && (
                        <section>
                            <div className="flex items-center gap-2 mb-4 text-red-600 dark:text-red-400">
                                <span className="material-symbols-outlined">error</span>
                                <h3 className="text-lg font-bold">{t('social.postList.failedSection')}</h3>
                                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-xs font-bold">{failedPosts.length}</span>
                            </div>
                            <div className="flex overflow-x-auto pb-6 gap-6 scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0">
                                {failedPosts.map(post => renderPostCard(post, true))}
                            </div>
                        </section>
                    )}

                    {/* RECENT SECTION */}
                    {recentPosts.length > 0 && (
                        <section>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-main">
                                    <span className="material-symbols-outlined">history</span>
                                    <h3 className="text-lg font-bold">{t('social.postList.recentSection')}</h3>
                                </div>
                                <Link to={`/project/${projectId}/social/archive`} className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                                    {t('social.postList.viewArchive')}
                                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </Link>
                            </div>

                            <div className="flex overflow-x-auto pb-6 gap-6 scrollbar-hide -mx-6 px-6 sm:mx-0 sm:px-0">
                                {displayedRecentPosts.map(post => renderPostCard(post, false))}

                                {hasMorePosts && (
                                    <div
                                        onClick={() => navigate(`/project/${projectId}/social/archive`)}
                                        className="flex-shrink-0 w-[120px] bg-surface-hover border border-surface rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--color-surface-pressed)] transition-colors group"
                                    >
                                        <div className="size-12 rounded-full bg-card flex items-center justify-center shadow-sm mb-2 group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-main">inventory_2</span>
                                        </div>
                                        <span className="text-xs font-bold text-muted text-center px-4">{t('social.postList.viewArchive')}</span>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {previewPost && (
                <ReviewPostModal
                    post={previewPost}
                    isOpen={!!previewPost}
                    onClose={() => setPreviewPost(null)}
                    readOnly
                />
            )}
        </div>
    );
};
