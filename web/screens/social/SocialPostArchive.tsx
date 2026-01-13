import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { subscribeSocialPosts, deleteSocialPost } from '../../services/dataService';
import { SocialPost } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { getSocialPostStatusLabel } from '../../utils/socialLocalization';
import { format } from 'date-fns';
import { ReviewPostModal } from './components/ReviewPostModal';
import { PlatformIcon } from './components/PlatformIcon';
import { useConfirm } from '../../context/UIContext';

const POSTS_PER_PAGE = 24;

export const SocialPostArchive = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);
    const { t, dateLocale } = useLanguage();
    const confirm = useConfirm();

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeSocialPosts(projectId, (data) => {
            // Sort Newest First
            const sorted = data.sort((a, b) => {
                const dateA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.createdAt).getTime();
                const dateB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.createdAt).getTime();
                return dateB - dateA;
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

    // Calculate pagination
    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    const displayedPosts = posts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Link to={`/project/${projectId}/social/posts`} className="text-muted hover:text-main transition-colors">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </Link>
                        <h1 className="h2">{t('social.archive.title')}</h1>
                    </div>
                    <p className="text-muted ml-8">{t('social.archive.subtitle')}</p>
                </div>
            </div>

            {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-3xl border border-surface border-dashed">
                    <p className="text-muted">{t('social.postList.empty')}</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {displayedPosts.map(post => {
                            const hasMedia = post.assets && post.assets.length > 0;
                            const mainAsset = hasMedia ? post.assets[0] : null;

                            return (
                                <div
                                    key={post.id}
                                    className="group relative bg-card border border-surface rounded-2xl overflow-hidden cursor-pointer hover:border-[var(--color-primary-light)] hover:shadow-lg transition-all flex flex-col"
                                    onClick={() => navigate(`/project/${projectId}/social/edit/${post.id}`)}
                                >
                                    {/* Media */}
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

                                        {/* Platform */}
                                        <div className="absolute top-3 left-3 bg-white/90 dark:bg-black/80 backdrop-blur-sm p-1.5 rounded-lg shadow-sm">
                                            <div className="size-4">
                                                <PlatformIcon platform={post.platform} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4 flex flex-col flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${post.status === 'Published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    post.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                        post.status === 'In Review' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                            post.status === 'Failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                                'bg-surface-hover text-muted'
                                                }`}>
                                                {getSocialPostStatusLabel(post.status, t)}
                                            </span>
                                            {post.scheduledFor && (
                                                <span className="text-[10px] font-medium text-muted flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                                                    {format(new Date(post.scheduledFor), 'MMM d')}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-sm text-main line-clamp-2 font-medium mb-3">
                                            {post.content.caption || <span className="italic text-muted opacity-50">{t('social.postList.noCaption')}</span>}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewPost(post);
                                            }}
                                            className="p-1.5 bg-white/90 dark:bg-black/80 backdrop-blur-sm border border-transparent hover:border-surface rounded-lg shadow-sm text-main hover:text-primary transition-all"
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

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>

                            <span className="text-sm font-medium text-muted">
                                {currentPage} / {totalPages}
                            </span>

                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-2 rounded-lg border border-surface hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                        </div>
                    )}
                </>
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
