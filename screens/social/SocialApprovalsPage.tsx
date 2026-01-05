import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeSocialPosts, updateSocialPost } from '../../services/dataService';
import { SocialPost } from '../../types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { PlatformIcon } from './components/PlatformIcon';
import { ReviewPostModal } from './components/ReviewPostModal';
import { useLanguage } from '../../context/LanguageContext';
import { format } from 'date-fns';
import { getSocialPostFormatLabel } from '../../utils/socialLocalization';

export const SocialApprovalsPage = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t, dateLocale } = useLanguage();
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [previewPost, setPreviewPost] = useState<SocialPost | null>(null);

    useEffect(() => {
        if (!projectId) return;

        const unsubscribe = subscribeSocialPosts(projectId, (data) => {
            const pendingPosts = data.filter(p =>
                p.status === 'In Review' ||
                p.status === 'PendingReview' ||
                p.status === 'Pending Approval' // Handle potential legacy or varied status strings
            ).sort((a, b) => {
                // Sort by schedule date if available, else created date
                const dateA = a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.createdAt).getTime();
                const dateB = b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.createdAt).getTime();
                return dateA - dateB;
            });
            setPosts(pendingPosts);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [projectId]);

    const handleApprove = async (post: SocialPost) => {
        try {
            await updateSocialPost(projectId!, post.id, {
                status: post.scheduledFor ? 'Scheduled' : 'Approved',
                approvedBy: 'current-user', // Should be auth.currentUser.uid
                approvedAt: new Date().toISOString()
            });
            setIsReviewOpen(false);
            setSelectedPost(null);
        } catch (error) {
            console.error("Failed to approve post:", error);
        }
    };

    const handleReject = async (post: SocialPost, reason: string) => {
        try {
            await updateSocialPost(projectId!, post.id, {
                status: 'Changes Requested',
                rejectionReason: reason
            });
            setIsReviewOpen(false);
            setSelectedPost(null);
        } catch (error) {
            console.error("Failed to reject post:", error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 px-6 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <button
                            onClick={() => navigate(`/project/${projectId}/social`)}
                            className="text-muted hover:text-main transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h1 className="text-2xl font-black text-main tracking-tight">{t('social.approvals.title')}</h1>
                    </div>
                    <p className="text-muted font-medium ml-8">{t('social.approvals.subtitle')}</p>
                </div>
            </div>

            {posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-3xl border border-surface border-dashed">
                    <div className="size-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-6">
                        <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
                    </div>
                    <h3 className="text-xl font-bold text-main mb-2">{t('social.approvals.emptyTitle')}</h3>
                    <p className="text-muted max-w-md text-center">{t('social.approvals.emptySubtitle')}</p>
                    <Button
                        className="mt-6"
                        variant="secondary"
                        onClick={() => navigate(`/project/${projectId}/social`)}
                    >
                        {t('social.approvals.backToDashboard')}
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.map(post => (
                        <Card key={post.id} className="group relative overflow-hidden transition-all hover:shadow-lg border-surface hover:border-[var(--color-primary-light)]">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="size-8 rounded-lg bg-surface flex items-center justify-center border border-surface">
                                        <div className="size-4">
                                            <PlatformIcon platform={post.platform} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-main">{post.platform}</div>
                                        <div className="text-[10px] text-muted uppercase tracking-wider">{post.format}</div>
                                    </div>
                                </div>
                                <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    {t('social.postStatus.Review')}
                                </div>
                            </div>

                            {/* Content Preview */}
                            <div className="space-y-3 mb-6">
                                <p className="text-sm text-main line-clamp-3 min-h-[3rem]">
                                    {post.content.caption || <span className="italic text-muted">{t('social.post.noCaption')}</span>}
                                </p>
                                {post.assets && post.assets.length > 0 && (
                                    <div className="h-32 w-full rounded-lg bg-surface bg-cover bg-center border border-surface"
                                        style={{ backgroundImage: `url(${post.assets[0].url})` }}
                                    />
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    {post.scheduledFor
                                        ? format(new Date(post.scheduledFor), 'MMM d, h:mm a', { locale: dateLocale })
                                        : <span className="italic">{t('social.post.unscheduled')}</span>
                                    }
                                </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="absolute top-4 right-12 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewPost(post);
                                    }}
                                    className="p-1.5 bg-card border border-surface rounded-lg shadow-sm hover:bg-surface-hover text-muted hover:text-primary transition-colors"
                                    title={t('social.approvals.reviewBtn')}
                                >
                                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-auto pt-4 border-t border-surface">
                                <Button
                                    className="flex-1"
                                    variant="primary"
                                    onClick={() => {
                                        setSelectedPost(post);
                                        setIsReviewOpen(true);
                                    }}
                                >
                                    {t('social.approvals.reviewBtn')}
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {selectedPost && (
                <ReviewPostModal
                    post={selectedPost}
                    isOpen={isReviewOpen}
                    onClose={() => {
                        setIsReviewOpen(false);
                        setSelectedPost(null);
                    }}
                    onApprove={handleApprove}
                    onReject={handleReject}
                />
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
