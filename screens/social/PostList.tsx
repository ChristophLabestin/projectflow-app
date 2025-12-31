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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="h2 mb-1">{t('social.postList.title')}</h1>
                    <p className="text-[var(--color-text-muted)]">{t('social.postList.subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-[var(--color-surface-hover)] p-1 rounded-lg border border-[var(--color-surface-border)]">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-[var(--color-surface-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            title="Grid View"
                        >
                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-all ${viewMode === 'list' ? 'bg-[var(--color-surface-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            title="List View"
                        >
                            <span className="material-symbols-outlined text-[20px]">view_list</span>
                        </button>
                    </div>

                    <Link
                        to={`/project/${projectId}/social/create`}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm shadow-indigo-500/20"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span>{t('social.postList.newPost')}</span>
                    </Link>
                </div>
            </div>

            {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-[var(--color-surface-card)] rounded-3xl border border-[var(--color-surface-border)] border-dashed">
                    <div className="size-20 bg-[var(--color-surface-hover)] rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)]">post_add</span>
                    </div>
                    <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">{t('social.postList.empty')}</h3>
                    <p className="text-[var(--color-text-muted)] max-w-md text-center mb-6">{t('social.approvals.emptySubtitle')}</p>
                    <Link
                        to={`/project/${projectId}/social/create`}
                    >
                        <Button variant="secondary">{t('social.postList.newPost')}</Button>
                    </Link>
                </div>
            ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-3"}>
                    {posts.map(post => {
                        const hasMedia = post.assets && post.assets.length > 0;
                        const mainAsset = hasMedia ? post.assets[0] : null;

                        // Unified Card Logic
                        return (
                            <div
                                key={post.id}
                                className={`group relative bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl overflow-hidden cursor-pointer hover:border-[var(--color-primary-light)] hover:shadow-lg transition-all ${viewMode === 'list' ? 'flex gap-4 p-4' : 'flex flex-col'}`}
                                onClick={() => navigate(`/project/${projectId}/social/edit/${post.id}`)}
                            >
                                {/* Media / Thumbnail */}
                                <div className={`${viewMode === 'list' ? 'size-24 rounded-xl' : 'aspect-square w-full'} bg-[var(--color-surface-hover)] relative overflow-hidden flex-shrink-0 flex items-center justify-center`}>
                                    {mainAsset ? (
                                        mainAsset.type === 'video' ? (
                                            <video src={mainAsset.url} className="w-full h-full object-cover" muted />
                                        ) : (
                                            <img src={mainAsset.url} className="w-full h-full object-cover" loading="lazy" />
                                        )
                                    ) : (
                                        <span className="material-symbols-outlined text-4xl text-[var(--color-text-subtle)]">
                                            {post.format === 'Text' ? 'article' : 'image'}
                                        </span>
                                    )}

                                    {/* Overlay for grid view interactions */}
                                    {viewMode === 'grid' && (
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    )}

                                    {/* Platform Badge (Grid only, top left) */}
                                    {viewMode === 'grid' && (
                                        <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-sm p-1.5 rounded-lg shadow-sm">
                                            <div className="size-4">
                                                <PlatformIcon platform={post.platform} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content Info */}
                                <div className={`flex-1 flex flex-col ${viewMode === 'grid' ? 'p-4' : ''}`}>
                                    {/* Header (List only) */}
                                    {viewMode === 'list' && (
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className="size-5">
                                                    <PlatformIcon platform={post.platform} />
                                                </div>
                                                <span className="text-sm font-bold text-[var(--color-text-main)]">{post.platform}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${post.status === 'Published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            post.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                post.status === 'In Review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                    'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                                            }`}>
                                            {getSocialPostStatusLabel(post.status, t)}
                                        </span>
                                        {viewMode === 'grid' && post.scheduledFor && (
                                            <span className="text-[10px] font-medium text-[var(--color-text-muted)] flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                                {format(new Date(post.scheduledFor), 'MMM d')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Caption */}
                                    <p className="text-sm text-[var(--color-text-main)] line-clamp-2 font-medium mb-3 flex-1">
                                        {post.content.caption || <span className="italic text-[var(--color-text-muted)] opacity-50">{t('social.postList.noCaption')}</span>}
                                    </p>

                                    {/* Footer Info */}
                                    <div className="flex items-center justify-between mt-auto text-xs text-[var(--color-text-muted)]">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[14px]">tag</span>
                                            <span>{post.content.hashtags?.length || 0}</span>
                                        </div>
                                        {viewMode === 'list' && post.scheduledFor && (
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                                                {format(new Date(post.scheduledFor), `${dateFormat} p`, { locale: dateLocale })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Hover Actions (Absolute) */}
                                <div className={`absolute ${viewMode === 'grid' ? 'top-3 right-3' : 'right-4 bottom-4'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-2`}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewPost(post);
                                        }}
                                        className="p-1.5 bg-white/90 dark:bg-black/80 backdrop-blur-sm border border-transparent hover:border-[var(--color-surface-border)] rounded-lg shadow-sm text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-all"
                                        title={t('social.approvals.reviewBtn')}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">visibility</span>
                                    </button>
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
                    })}
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
