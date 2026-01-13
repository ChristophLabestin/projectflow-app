
import React, { useState } from 'react';
import { SocialPost } from '../../../types';
import { SocialPostPreview } from './SocialPostPreview';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { format } from 'date-fns';
import { useLanguage } from '../../../context/LanguageContext';
import { getSocialPostStatusLabel } from '../../../utils/socialLocalization';

interface ReviewPostModalProps {
    post: SocialPost;
    isOpen: boolean;
    onClose: () => void;
    onApprove?: (post: SocialPost) => void;
    onReject?: (post: SocialPost, reason: string) => void;
    readOnly?: boolean;
}

export const ReviewPostModal: React.FC<ReviewPostModalProps> = ({
    post,
    isOpen,
    onClose,
    onApprove,
    onReject,
    ...rest
}) => {
    const [rejectMode, setRejectMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
    const [storyProgress, setStoryProgress] = useState(0);
    const [isStoryPlaying, setIsStoryPlaying] = useState(true);
    const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});
    const { t, dateLocale } = useLanguage();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-5xl h-[80vh] bg-card rounded-2xl shadow-2xl flex overflow-hidden border border-surface">

                {/* Left: Info */}
                <div className="w-[40%] border-r border-surface flex flex-col bg-surface">
                    <div className="p-6 border-b border-surface">
                        <h2 className="text-xl font-bold text-main mb-2">{t('social.reviewPost.title')}</h2>
                        <div className="flex gap-2">
                            <div className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                {getSocialPostStatusLabel('In Review', t)}
                            </div>
                            <div className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-surface-hover text-muted">
                                {post.platform}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto space-y-6">
                        <div>
                            <label className="text-xs font-semibold text-muted uppercase block mb-1">{t('social.reviewPost.schedule')}</label>
                            <p className="text-sm text-main font-medium">
                                {post.scheduledFor
                                    ? format(new Date(post.scheduledFor), 'MMMM d, yyyy @ p', { locale: dateLocale })
                                    : t('social.reviewPost.noDate')
                                }
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-muted uppercase block mb-1">{t('social.reviewPost.caption')}</label>
                            <div className="bg-card p-3 rounded-lg border border-surface">
                                <p className="text-sm text-main whitespace-pre-wrap">
                                    {post.content.caption || t('social.reviewPost.noCaption')}
                                </p>
                            </div>
                        </div>

                        {post.content.hashtags && post.content.hashtags.length > 0 && (
                            <div>
                                <label className="text-xs font-semibold text-muted uppercase block mb-1">{t('social.reviewPost.hashtags')}</label>
                                <p className="text-sm text-indigo-500 font-mono">
                                    {post.content.hashtags.map(h => h).join(' ')}
                                </p>
                            </div>
                        )}

                        {rejectMode && (
                            <div className="animate-fade-in">
                                <label className="text-xs font-semibold text-red-500 uppercase block mb-2">{t('social.reviewPost.rejectionReason')}</label>
                                <Textarea
                                    value={rejectionReason}
                                    onChange={e => setRejectionReason(e.target.value)}
                                    placeholder={t('social.reviewPost.rejectionPlaceholder')}
                                    className="min-h-[100px] border-red-200 focus:ring-red-500"
                                    autoFocus
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-surface bg-card flex justify-between items-center gap-4">
                        {rejectMode ? (
                            <>
                                <Button variant="ghost" onClick={() => setRejectMode(false)}>{t('social.reviewPost.cancel')}</Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => onReject(post, rejectionReason)}
                                    disabled={!rejectionReason.trim()}
                                >
                                    {t('social.reviewPost.confirmReject')}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={onClose}>{t('social.reviewPost.close')}</Button>
                                {!rest.readOnly && onApprove && (
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                                            onClick={() => setRejectMode(true)}
                                        >
                                            {t('social.reviewPost.reject')}
                                        </Button>
                                        <Button variant="primary" onClick={() => onApprove(post)}>{t('social.reviewPost.approve')}</Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right: Preview */}
                <div className="w-[60%] bg-surface relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

                    <div className="relative z-10 w-full h-full overflow-y-auto custom-scrollbar p-8">
                        <div className="min-h-min w-full flex justify-center">
                            <SocialPostPreview
                                platform={post.platform}
                                format={post.format}
                                assets={post.assets || []}
                                caption={post.content.caption}
                                hashtags={post.content.hashtags?.join(' ') || ''}
                                isYouTube={post.platform === 'YouTube'}
                                thumbnailUrl={post.videoConcept?.thumbnailUrl || post.assets?.[0]?.url || ''}
                                videoTitle={post.videoConcept?.title || ''}

                                // Interactive props (read-only mostly, but functional for playback)
                                activeCarouselIndex={activeCarouselIndex}
                                setActiveCarouselIndex={setActiveCarouselIndex}
                                storyProgress={storyProgress}
                                setStoryProgress={setStoryProgress}
                                isStoryPlaying={isStoryPlaying}
                                isPreviewHovered={false}
                                videoDurations={videoDurations}
                                setVideoDurations={setVideoDurations}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
