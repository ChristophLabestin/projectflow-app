import React, { useEffect } from 'react';
import { SocialPlatform, SocialPostFormat, SocialAsset } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialPostPreviewProps {
    platform: SocialPlatform;
    format: SocialPostFormat;
    assets: SocialAsset[];
    caption: string;
    hashtags: string;
    isYouTube: boolean;
    thumbnailUrl: string;
    videoTitle: string;
    activeCarouselIndex: number;
    setActiveCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
    storyProgress: number;
    setStoryProgress: React.Dispatch<React.SetStateAction<number>>;
    isStoryPlaying: boolean;
    isPreviewHovered: boolean;
    videoDurations: Record<string, number>;
    setVideoDurations: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export const SocialPostPreview: React.FC<SocialPostPreviewProps> = ({
    platform,
    format,
    assets,
    caption,
    hashtags,
    isYouTube,
    thumbnailUrl,
    videoTitle,
    activeCarouselIndex,
    setActiveCarouselIndex,
    storyProgress,
    setStoryProgress,
    isStoryPlaying,
    isPreviewHovered,
    videoDurations,
    setVideoDurations
}) => {
    const { t } = useLanguage();
    // Shared Elements
    const mediaUrl = (isYouTube && thumbnailUrl) ? thumbnailUrl : (assets.length > 0 ? (assets[activeCarouselIndex]?.url || assets[0].url) : null);
    const currentAsset = assets[activeCarouselIndex] || assets[0];
    const mockUser = { name: 'Christopher Labestin', handle: '@chrislab', avatar: 'CL', headline: t('social.preview.linkedin.headline') };

    const PlatformIcon = ({ name, className = "" }: { name: string, className?: string }) => (
        <span className={`material-symbols-outlined ${className}`}>{name}</span>
    );

    // Sync playback state with video elements
    useEffect(() => {
        const videos = document.querySelectorAll('#preview-container video');
        const shouldPlay = isStoryPlaying && !isPreviewHovered;
        videos.forEach(v => {
            const video = v as HTMLVideoElement;
            if (shouldPlay) {
                video.play().catch(() => { });
            } else {
                video.pause();
            }
        });
    }, [isStoryPlaying, isPreviewHovered, mediaUrl]);

    // --- 1. INSTAGRAM FEED ---
    if (platform === 'Instagram' && format !== 'Story' && format !== 'Reel') {
        const instagramAssets = assets.length > 0 ? assets : [];
        const currentAsset = instagramAssets[activeCarouselIndex] || instagramAssets[0];

        return (
            <div className="w-full max-w-[400px] bg-white dark:bg-black text-black dark:text-white rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm font-sans flex flex-col mx-auto overflow-hidden transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-purple-600 p-[0.5px]">
                            <div className="w-full h-full rounded-full bg-white dark:bg-black border-2 border-white dark:border-black flex items-center justify-center overflow-hidden">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=ProjectFlow`} alt="avatar" className="w-full h-full" />
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-bold leading-none">projectflow.app</span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('social.preview.instagram.sponsored')}</span>
                        </div>
                    </div>
                    <PlatformIcon name="more_horiz" className="text-gray-900 dark:text-gray-100" />
                </div>

                {/* Media Container */}
                <div className={`w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden relative group ${(format === 'Image' || format === 'Post') ? 'aspect-square' : 'aspect-[4/5]'}`}>
                    {instagramAssets.length > 0 ? (
                        <>
                            {currentAsset.type === 'video' ? (
                                <video src={currentAsset.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                            ) : (
                                <img src={currentAsset.url} className="w-full h-full object-cover" />
                            )}

                            {instagramAssets.length > 1 && (
                                <>
                                    {/* Carousel Navigation */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveCarouselIndex(prev => Math.max(0, prev - 1)); }}
                                        className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-black/50 flex items-center justify-center shadow-lg transition-opacity ${activeCarouselIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <PlatformIcon name="chevron_left" className="text-black dark:text-white" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setActiveCarouselIndex(prev => Math.min(instagramAssets.length - 1, prev + 1)); }}
                                        className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 dark:bg-black/50 flex items-center justify-center shadow-lg transition-opacity ${activeCarouselIndex === instagramAssets.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <PlatformIcon name="chevron_right" className="text-black dark:text-white" />
                                    </button>

                                    {/* Pagination Dots */}
                                    <div className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1 z-10 transition-colors">
                                        {activeCarouselIndex + 1}/{instagramAssets.length}
                                    </div>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                                        {instagramAssets.map((_, i) => (
                                            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeCarouselIndex ? 'bg-blue-500 scale-125' : 'bg-white/40 shadow-sm'}`} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center text-gray-400 dark:text-gray-600">
                            <PlatformIcon name="image" className="text-7xl mb-2" />
                        </div>
                    )}
                </div>

                {/* Actions bar */}
                <div className="p-3 pb-0">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-4 items-center">
                            <PlatformIcon name="favorite" className="text-2xl hover:text-gray-500 cursor-pointer" />
                            <PlatformIcon name="mode_comment" className="text-2xl hover:text-gray-500 cursor-pointer -scale-x-100" />
                            <PlatformIcon name="send" className="text-2xl hover:text-gray-500 cursor-pointer" />
                        </div>
                        <PlatformIcon name="bookmark" className="text-2xl hover:text-gray-500 cursor-pointer" />
                    </div>
                    <div className="font-bold text-sm mb-1">{t('social.preview.instagram.likes').replace('{count}', '12,492')}</div>

                    {/* Caption */}
                    <div className="text-sm mb-1 leading-relaxed">
                        <span className="font-bold mr-2">projectflow.app</span>
                        {caption || <span className="text-gray-400 italic">{t('social.preview.instagram.captionPlaceholder')}</span>}
                    </div>
                    {hashtags && <div className="text-sm text-blue-900 dark:text-blue-400 mb-1">{hashtags}</div>}

                    <div className="text-gray-500 dark:text-gray-400 text-sm cursor-pointer mb-1">
                        {t('social.preview.instagram.viewComments').replace('{count}', '124')}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-tight mb-3">
                        {t('social.preview.instagram.timeAgo')}
                    </div>
                </div>
            </div>
        );
    }

    // --- 2. LINKEDIN TEXT ---
    if (platform === 'LinkedIn' && format === 'Text') {
        return (
            <div className="w-[370px] bg-white dark:bg-[#1B1F23] rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm font-sans text-black dark:text-[#E7E9EA] mx-auto overflow-hidden transition-colors">
                {/* Header */}
                <div className="p-3 flex gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full bg-blue-100" />
                    </div>
                    <div className="flex-1 leading-tight">
                        <div className="flex items-center gap-1">
                            <span className="font-semibold text-sm">{mockUser.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">• 1st</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{mockUser.headline}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <span>2h • </span>
                            <PlatformIcon name="public" className="text-[12px]" />
                        </div>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                        <PlatformIcon name="more_horiz" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="px-3 pb-4 text-sm whitespace-pre-wrap leading-relaxed">
                    {caption || <span className="text-gray-400 italic">{t('social.preview.linkedin.prompt')}</span>}
                    {hashtags && <div className="text-[#0A66C2] font-semibold mt-2">{hashtags}</div>}
                </div>

                {/* Interaction Stats */}
                <div className="px-3 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                            <div className="w-4 h-4 rounded-full bg-[#0A66C2] flex items-center justify-center text-white"><PlatformIcon name="thumb_up" className="text-[10px]" /></div>
                            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white"><PlatformIcon name="favorite" className="text-[10px]" /></div>
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white"><PlatformIcon name="celebration" className="text-[10px]" /></div>
                        </div>
                        <span className="hover:text-[#0A66C2] hover:underline cursor-pointer">128</span>
                    </div>
                    <div className="hover:text-[#0A66C2] hover:underline cursor-pointer">
                        {t('social.preview.linkedin.commentsReposts').replace('{comments}', '32').replace('{reposts}', '5')}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-1 py-1 flex justify-between border-t border-gray-200 dark:border-gray-700">
                    {[
                        { icon: 'thumb_up', label: t('social.preview.linkedin.actions.like') },
                        { icon: 'chat', label: t('social.preview.linkedin.actions.comment') },
                        { icon: 'repeat', label: t('social.preview.linkedin.actions.repost') },
                        { icon: 'send', label: t('social.preview.linkedin.actions.send') }
                    ].map(btn => (
                        <button key={btn.label} className="flex items-center gap-1.5 px-3 py-3 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors flex-1 justify-center">
                            <PlatformIcon name={btn.icon} className={`text-[20px] ${btn.icon === 'thumb_up' ? '-scale-x-100' : ''}`} />
                            <span className="text-sm font-semibold">{btn.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // --- 2B. LINKEDIN POST (with media) ---
    if (platform === 'LinkedIn') {
        return (
            <div className="w-[370px] bg-white dark:bg-[#1B1F23] rounded-lg border border-gray-300 dark:border-gray-700 shadow-sm font-sans text-black dark:text-[#E7E9EA] mx-auto overflow-hidden transition-colors">
                {/* Header */}
                <div className="p-3 flex gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full bg-blue-100" />
                    </div>
                    <div className="flex-1 leading-tight">
                        <div className="flex items-center gap-1">
                            <span className="font-semibold text-sm">{mockUser.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">• 1st</span>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{mockUser.headline}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <span>2h • </span>
                            <PlatformIcon name="public" className="text-[12px]" />
                        </div>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                        <PlatformIcon name="more_horiz" />
                    </div>
                </div>

                {/* Text Content (Above Media) */}
                <div className="px-3 pb-2 text-sm whitespace-pre-wrap">
                    {caption || <span className="text-gray-400 italic">{t('social.preview.linkedin.prompt')}</span>}
                    {hashtags && <span className="text-[#0A66C2] font-bold ml-1">{hashtags}</span>}
                </div>

                {/* Media */}
                {(mediaUrl || assets.length > 0) ? (
                    <div className="w-full bg-gray-100 dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700">
                        {assets.length === 1 ? (
                            assets[0].type === 'video' ? (
                                <video src={assets[0].url} className="w-full h-auto max-h-[400px] object-cover" autoPlay muted loop playsInline />
                            ) : (
                                <img src={assets[0].url} className="w-full h-auto max-h-[400px] object-cover" />
                            )
                        ) : assets.length > 1 ? (
                            <div className="grid grid-cols-2 gap-0.5">
                                {assets.slice(0, 4).map((a, i) => (
                                    a.type === 'video' ? (
                                        <video key={i} src={a.url} className="w-full aspect-square object-cover" autoPlay muted loop playsInline />
                                    ) : (
                                        <img key={i} src={a.url} className="w-full aspect-square object-cover" />
                                    )
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="w-full h-48 bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-400 border-y border-gray-100 dark:border-gray-700">
                        <PlatformIcon name="image" className="text-4xl" />
                    </div>
                )}

                {/* Interaction Stats */}
                <div className="px-3 py-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1">
                        <div className="flex -space-x-1">
                            <div className="w-4 h-4 rounded-full bg-[#0A66C2] flex items-center justify-center text-white"><PlatformIcon name="thumb_up" className="text-[10px]" /></div>
                            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white"><PlatformIcon name="favorite" className="text-[10px]" /></div>
                            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white"><PlatformIcon name="celebration" className="text-[10px]" /></div>
                        </div>
                        <span className="hover:text-[#0A66C2] hover:underline cursor-pointer">128</span>
                    </div>
                    <div className="hover:text-[#0A66C2] hover:underline cursor-pointer">
                        {t('social.preview.linkedin.commentsReposts').replace('{comments}', '32').replace('{reposts}', '5')}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-1 py-1 flex justify-between">
                    {[
                        { icon: 'thumb_up', label: t('social.preview.linkedin.actions.like') },
                        { icon: 'chat', label: t('social.preview.linkedin.actions.comment') },
                        { icon: 'repeat', label: t('social.preview.linkedin.actions.repost') },
                        { icon: 'send', label: t('social.preview.linkedin.actions.send') }
                    ].map(btn => (
                        <button key={btn.label} className="flex items-center gap-1.5 px-3 py-3 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors flex-1 justify-center">
                            <PlatformIcon name={btn.icon} className={`text-[20px] ${btn.icon === 'thumb_up' ? '-scale-x-100' : ''}`} />
                            <span className="text-sm font-semibold">{btn.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // --- 3. X TEXT (no media) ---
    if (platform === 'X' && format === 'Text') {
        return (
            <div className="w-[370px] bg-black text-white rounded-xl border border-gray-800 p-4 font-sans mx-auto">
                <div className="flex gap-3">
                    <div className="size-10 rounded-full bg-gray-700 shrink-0 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-1 text-[15px] leading-tight">
                            <span className="font-bold text-white hover:underline cursor-pointer">{mockUser.name}</span>
                            <PlatformIcon name="verified" className="text-blue-400 text-[14px]" />
                            <span className="text-gray-500 truncate">{mockUser.handle}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-500 hover:underline cursor-pointer">4h</span>
                            <PlatformIcon name="more_horiz" className="ml-auto text-gray-500 text-sm" />
                        </div>

                        {/* Content */}
                        <div className="mt-2 text-[15px] whitespace-pre-wrap text-white/90 leading-relaxed">
                            {caption || <span className="text-gray-600">{t('social.preview.x.prompt')}</span>}
                            {hashtags && <div className="text-blue-400 mt-2">{hashtags}</div>}
                        </div>

                        {/* Footer Metrics */}
                        <div className="flex justify-between mt-4 text-gray-500 max-w-md pr-2">
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-blue-500">
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10"><PlatformIcon name="chat_bubble_outline" className="text-[18px]" /></div>
                                <span className="text-xs">32</span>
                            </div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-green-500">
                                <div className="p-1.5 rounded-full group-hover:bg-green-500/10"><PlatformIcon name="repeat" className="text-[18px]" /></div>
                                <span className="text-xs">14</span>
                            </div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-pink-500">
                                <div className="p-1.5 rounded-full group-hover:bg-pink-500/10"><PlatformIcon name="favorite_border" className="text-[18px]" /></div>
                                <span className="text-xs">128</span>
                            </div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-blue-500">
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10"><PlatformIcon name="bar_chart" className="text-[18px]" /></div>
                                <span className="text-xs">2.4K</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <PlatformIcon name="ios_share" className="text-[18px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- 3B. X POST (with media) ---
    if (platform === 'X') {
        return (
            <div className="w-[370px] bg-black text-white rounded-xl border border-gray-800 p-4 font-sans mx-auto">
                <div className="flex gap-3">
                    <div className="size-10 rounded-full bg-gray-700 shrink-0 overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-1 text-[15px] leading-tight">
                            <span className="font-bold text-white hover:underline cursor-pointer">{mockUser.name}</span>
                            <PlatformIcon name="verified" className="text-blue-400 text-[14px]" />
                            <span className="text-gray-500 truncate">{mockUser.handle}</span>
                            <span className="text-gray-500">·</span>
                            <span className="text-gray-500 hover:underline cursor-pointer">4h</span>
                            <PlatformIcon name="more_horiz" className="ml-auto text-gray-500 text-sm" />
                        </div>

                        {/* Content */}
                        <div className="mt-1 text-[15px] whitespace-pre-wrap text-white/90 mb-3">
                            {caption || <span className="text-gray-600">{t('social.preview.x.prompt')}</span>}
                            {hashtags && <div className="text-blue-400 mt-1">{hashtags}</div>}
                        </div>

                        {/* Standard Media */}
                        {assets.length > 0 ? (
                            <div className={`rounded-xl overflow-hidden border border-gray-800 ${assets.length > 1 ? 'grid grid-cols-2 gap-px' : ''} ${assets.length === 1 ? 'aspect-video' : 'aspect-square'}`}>
                                {assets.map((a, i) => (
                                    a.type === 'video' ? (
                                        <video key={i} src={a.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                                    ) : (
                                        <img key={i} src={a.url} className="w-full h-full object-cover" />
                                    )
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-gray-800 bg-gray-900 aspect-video flex items-center justify-center text-gray-600">
                                <PlatformIcon name="image" className="text-4xl" />
                            </div>
                        )}

                        {/* Footer Metrics */}
                        <div className="flex justify-between mt-3 text-gray-500 max-w-md pr-2">
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-blue-500">
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10"><PlatformIcon name="chat_bubble_outline" className="text-[18px]" /></div>
                                <span className="text-xs">32</span>
                            </div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-green-500">
                                <div className="p-1.5 rounded-full group-hover:bg-green-500/10"><PlatformIcon name="repeat" className="text-[18px]" /></div>
                                <span className="text-xs">14</span>
                            </div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-pink-500">
                                <div className="p-1.5 rounded-full group-hover:bg-pink-500/10"><PlatformIcon name="favorite_border" className="text-[18px]" /></div>
                                <span className="text-xs">128</span>
                            </div>
                            <div className="flex items-center gap-1 group cursor-pointer hover:text-blue-500">
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10"><PlatformIcon name="bar_chart" className="text-[18px]" /></div>
                                <span className="text-xs">2.4K</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <PlatformIcon name="ios_share" className="text-[18px]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- 4. INSTAGRAM REELS (OVERHAUL) ---
    if (platform === 'Instagram' && format === 'Reel') {
        return (
            <div id="preview-container" className="w-full max-w-[380px] aspect-[9/16] bg-black text-white rounded-[2.5rem] overflow-hidden relative shadow-2xl border-[8px] border-gray-900 mx-auto font-sans">
                {/* Media Background */}
                {(thumbnailUrl || assets.length > 0) ? (
                    (currentAsset?.type === 'video' && !thumbnailUrl) ? (
                        <video
                            key={currentAsset.id}
                            src={mediaUrl}
                            className="absolute inset-0 w-full h-full object-cover"
                            autoPlay={isStoryPlaying && !isPreviewHovered}
                            muted
                            loop
                            playsInline
                        />
                    ) : (
                        <img key={currentAsset.id} src={thumbnailUrl || mediaUrl} className="absolute inset-0 w-full h-full object-cover" />
                    )
                ) : (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center text-gray-700">
                        <PlatformIcon name="movie" className="text-6xl" />
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

                {/* Top Bar */}
                <div className="absolute top-0 left-0 right-0 p-5 pt-10 z-20 flex items-center justify-between text-white drop-shadow-lg">
                    <PlatformIcon name="add" className="text-2xl" />
                    <div className="flex items-center gap-4 text-sm font-bold">
                        <div className="flex items-center gap-1">
                            <span>{t('social.preview.common.forYou')}</span>
                            <PlatformIcon name="expand_more" className="text-lg" />
                        </div>
                        <div className="flex items-center gap-2 opacity-60">
                            <span>{t('social.preview.common.friends')}</span>
                            <div className="flex -space-x-1.5 align-middle">
                                <div className="w-4 h-4 rounded-full border border-white overflow-hidden bg-gray-500">
                                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-full h-full" />
                                </div>
                                <div className="w-4 h-4 rounded-full border border-white overflow-hidden bg-gray-600">
                                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" className="w-full h-full" />
                                </div>
                                <div className="w-4 h-4 rounded-full border border-white overflow-hidden bg-gray-700 flex items-center justify-center text-[6px]">
                                    <PlatformIcon name="person" className="text-[10px]" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <PlatformIcon name="tune" className="text-2xl rotate-90" />
                </div>

                {/* Right Actions Sidebar */}
                <div className="absolute bottom-24 right-2 z-30 flex flex-col items-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                        <PlatformIcon name="favorite" className="text-[28px] drop-shadow-lg" />
                        <span className="text-[11px] font-bold drop-shadow-lg">148K</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <PlatformIcon name="chat_bubble" className="text-[26px] drop-shadow-lg -scale-x-100" />
                        <span className="text-[11px] font-bold drop-shadow-lg">1,960</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <PlatformIcon name="cached" className="text-[28px] drop-shadow-lg" />
                        <span className="text-[11px] font-bold drop-shadow-lg">5,273</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <div className="w-7 h-7 rounded-lg border-2 border-white flex items-center justify-center overflow-hidden">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg" className="w-4 h-4 brightness-0 invert" alt="IG" />
                        </div>
                        <span className="text-[11px] font-bold drop-shadow-lg">30,8K</span>
                    </div>

                    <PlatformIcon name="more_horiz" className="text-2xl drop-shadow-lg mt-1" />

                    <div className="w-9 h-9 rounded-full bg-black/40 border-2 border-white/80 overflow-hidden shadow-lg mt-2 flex items-center justify-center">
                        <img src={`https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=100&h=100&auto=format&fit=crop`} alt="album" className="w-full h-full object-cover animate-spin-slow" />
                    </div>
                </div>

                {/* Bottom Profile Info */}
                <div className="absolute bottom-16 left-0 right-14 p-4 z-20">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white/50">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Lufthansa`} className="w-full h-full" />
                        </div>
                        <span className="font-bold text-[13px] drop-shadow-md">lufthansa and lufthansaviews</span>
                        <button className="px-3 py-1 rounded-lg border border-white text-[11px] font-bold bg-transparent">{t('social.preview.facebook.follow')}</button>
                    </div>

                    <div className="text-[13px] mb-3 drop-shadow-md leading-relaxed">
                        <span className="font-bold mr-1">lufthansa</span>
                        {caption ? (
                            <span>
                                {caption.length > 60 ? caption.substring(0, 60) + '...' : caption}
                                <span className="text-white/70 font-bold ml-1">{t('social.preview.common.more')}</span>
                            </span>
                        ) : (
                            <span>
                                {t('social.preview.facebook.captionFallback')} <span className="text-white/70 font-bold ml-1">{t('social.preview.common.more')}</span>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] drop-shadow-md">
                        <PlatformIcon name="music_note" className="text-[14px]" />
                        <div className="animate-marquee whitespace-nowrap">Boeing 747-8 • lufthansa</div>
                    </div>
                </div>

                {/* Bottom Global Nav */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-black flex items-center justify-around px-2 z-40">
                    <PlatformIcon name="home" className="text-2xl" />
                    <PlatformIcon name="movie" className="text-2xl opacity-70" />
                    <PlatformIcon name="add_box" className="text-2xl opacity-70" />
                    <PlatformIcon name="search" className="text-2xl opacity-70" />
                    <div className="w-7 h-7 rounded-full bg-gray-700 overflow-hidden ring-2 ring-white/20">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Admin`} className="w-full h-full" />
                    </div>
                </div>

                {/* Bottom Progress Bar */}
                <div className="absolute bottom-16 left-0 right-0 h-0.5 bg-white/20 z-50">
                    <div
                        className="h-full bg-white transition-all duration-300"
                        style={{ width: `${storyProgress}%` }}
                    />
                </div>

                {/* Pause Overlay Indicator */}
                {(!isStoryPlaying || isPreviewHovered) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-50">
                        <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center animate-pulse">
                            <PlatformIcon name={!isStoryPlaying ? 'play_arrow' : 'pause'} className="text-4xl text-white" />
                        </div>
                    </div>
                )}
            </div>
        );
    }


    // --- OTHER VERTICAL FULL (TikTok / Story / Short) ---
    if (platform === 'TikTok' || format === 'Story' || format === 'Short') {
        const isStory = format === 'Story';
        return (
            <div id="preview-container" className="w-full max-w-[340px] aspect-[9/16] bg-black text-white rounded-[2rem] overflow-hidden relative shadow-2xl border-[4px] border-gray-900 mx-auto font-sans">
                {/* Media Background */}
                {mediaUrl ? (
                    currentAsset?.type === 'video' ? (
                        <video
                            key={currentAsset.id}
                            src={mediaUrl}
                            className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-500"
                            autoPlay={isStoryPlaying && !isPreviewHovered}
                            muted
                            playsInline
                            onLoadedMetadata={(e) => {
                                const d = e.currentTarget.duration * 1000;
                                if (d && (!videoDurations[currentAsset.id] || Math.abs(videoDurations[currentAsset.id] - d) > 100)) {
                                    setVideoDurations(prev => ({ ...prev, [currentAsset.id]: d }));
                                }
                            }}
                            onTimeUpdate={(e) => {
                                const video = e.currentTarget;
                                const progress = (video.currentTime / video.duration) * 100;
                                setStoryProgress(progress);
                            }}
                            onEnded={(e) => {
                                if (assets.length > 1) {
                                    setActiveCarouselIndex(idx => (idx + 1) % assets.length);
                                    setStoryProgress(0);
                                } else {
                                    // Loop single video
                                    e.currentTarget.currentTime = 0;
                                    e.currentTarget.play().catch(() => { });
                                    setStoryProgress(0);
                                }
                            }}
                        />
                    ) : (
                        <img key={currentAsset.id} src={mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-500" />
                    )
                ) : (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-600">
                        <PlatformIcon name="movie" className="text-6xl" />
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none" />

                {/* Top Bar (Story vs Feed) */}
                <div className="absolute top-0 left-0 right-0 p-3 pt-5 z-20">
                    {isStory ? (
                        <div className="flex gap-1 mb-4">
                            {assets.length > 0 ? (
                                assets.map((_, i) => {
                                    let progressWidth = '0%';
                                    let transition = 'none';

                                    if (i < activeCarouselIndex) {
                                        progressWidth = '100%';
                                    } else if (i === activeCarouselIndex) {
                                        progressWidth = `${storyProgress}%`;
                                        // Match onTimeUpdate frequency (usually 250ms) for smoothness
                                        if (isStoryPlaying && !isPreviewHovered && storyProgress > 0) {
                                            transition = 'width 250ms linear';
                                        }
                                    }

                                    return (
                                        <div key={i} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden shadow-sm">
                                            <div
                                                className="h-full bg-white shadow-sm"
                                                style={{
                                                    width: progressWidth,
                                                    transition: transition
                                                }}
                                            />
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
                                    <div className="w-1/3 h-full bg-white" />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex justify-between items-center text-white/80 font-bold px-1">
                            <span>{t('social.preview.facebook.following')}</span>
                            <span className="text-white border-b-2 border-white pb-0.5">{t('social.preview.tiktok.forYou')}</span>
                            <PlatformIcon name="search" className="text-2xl" />
                        </div>
                    )}
                    {isStory && (
                        <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-white/30 shadow-sm">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=ProjectFlow`} className="w-full h-full" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[13px] font-bold text-white drop-shadow-md leading-none">projectflow.app</span>
                                    <span className="text-white/70 text-[10px] drop-shadow-sm mt-0.5">2h</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <PlatformIcon name="more_horiz" className="text-white text-xl drop-shadow-md" />
                                <PlatformIcon name="close" className="text-white text-2xl drop-shadow-md" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Actions (Not for Story) */}
                {!isStory && (
                    <div className="absolute bottom-20 right-2 z-20 flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full border border-white overflow-hidden">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Chris`} className="w-full h-full" />
                            </div>
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-pink-500 rounded-full flex items-center justify-center text-white">
                                <PlatformIcon name="add" className="text-[12px] font-bold" />
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <PlatformIcon name="favorite" className="text-[32px] drop-shadow-md" />
                            <span className="text-xs font-bold drop-shadow-md">84.2K</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <PlatformIcon name="comment" className="text-[30px] drop-shadow-md -scale-x-100" />
                            <span className="text-xs font-bold drop-shadow-md">1,204</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <PlatformIcon name="bookmark" className="text-[32px] drop-shadow-md" />
                            <span className="text-xs font-bold drop-shadow-md">4K</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <PlatformIcon name="share" className="text-[30px] drop-shadow-md -scale-x-100" />
                            <span className="text-xs font-bold drop-shadow-md">842</span>
                        </div>

                        <div className="w-10 h-10 rounded-full bg-gray-800 border-4 border-black overflow-hidden animate-spin-slow mt-2">
                            <div className="w-full h-full bg-cover" style={{ backgroundImage: `url(https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?q=80&w=100&h=100&auto=format&fit=crop)` }}></div>
                        </div>
                    </div>
                )}

                {/* Bottom Info */}
                {!isStory && (
                    <div className="absolute bottom-0 left-0 w-full p-4 z-20 bg-gradient-to-t from-black/80 to-transparent pb-6">
                        <div className="font-bold text-shadow mb-2">@{mockUser.handle.replace('@', '')}</div>
                        <div className="text-sm text-shadow line-clamp-2 mb-2">
                            {caption || t('social.preview.tiktok.captionFallback')}
                        </div>
                        {hashtags && <div className="text-sm font-bold text-shadow mb-2">{hashtags}</div>}
                        <div className="flex items-center gap-2 text-sm overflow-hidden">
                            <PlatformIcon name="music_note" className="text-sm" />
                            <div className="animate-marquee whitespace-nowrap">
                                {t('social.preview.tiktok.originalSound').replace('{name}', mockUser.name)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Send Message (Story only) */}
                {isStory && (
                    <div className="absolute bottom-0 w-full p-4 flex gap-2 items-center z-20">
                        <input
                            type="text"
                            placeholder={t('social.preview.tiktok.messagePlaceholder')}
                            className="flex-1 bg-transparent border border-white/40 rounded-full px-4 py-2 text-sm text-white placeholder-white/70 outline-none"
                        />
                        <PlatformIcon name="favorite_border" className="text-2xl" />
                        <PlatformIcon name="send" className="text-2xl -rotate-45 mb-1" />
                    </div>
                )}

                {/* Pause Overlay Indicator */}
                {(!isStoryPlaying || isPreviewHovered) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-50">
                        <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center animate-pulse">
                            <PlatformIcon name={!isStoryPlaying ? 'play_arrow' : 'pause'} className="text-4xl text-white" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- 5. FACEBOOK REEL ---
    if (platform === 'Facebook' && format === 'Reel') {
        return (
            <div id="preview-container" className="w-full max-w-[380px] aspect-[9/16] bg-black text-white rounded-[2.5rem] overflow-hidden relative shadow-2xl border-[8px] border-gray-900 mx-auto font-sans">
                {/* Media Background */}
                {(thumbnailUrl || assets.length > 0) ? (
                    (currentAsset?.type === 'video' && !thumbnailUrl) ? (
                        <video
                            key={currentAsset.id}
                            src={mediaUrl}
                            className="absolute inset-0 w-full h-full object-cover"
                            autoPlay={isStoryPlaying && !isPreviewHovered}
                            muted
                            loop
                            playsInline
                        />
                    ) : (
                        <img key={currentAsset.id} src={thumbnailUrl || mediaUrl} className="absolute inset-0 w-full h-full object-cover" />
                    )
                ) : (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center text-gray-700">
                        <PlatformIcon name="movie" className="text-6xl" />
                    </div>
                )}

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />

                {/* Top Bar */}
                <div className="absolute top-0 left-0 right-0 p-5 pt-8 z-20 flex items-center justify-between text-white">
                    <PlatformIcon name="close" className="text-2xl" />
                    <div className="flex items-center gap-1 font-semibold text-base">
                        <span>{t('social.preview.common.reels')}</span>
                        <PlatformIcon name="expand_more" className="text-xl" />
                    </div>
                    <div className="flex items-center gap-3">
                        <PlatformIcon name="search" className="text-2xl" />
                        <PlatformIcon name="account_circle" className="text-2xl" />
                    </div>
                </div>

                {/* Right Actions Sidebar */}
                <div className="absolute bottom-36 right-3 z-30 flex flex-col items-center gap-5">
                    <div className="flex flex-col items-center gap-1">
                        <PlatformIcon name="thumb_up" className="text-[28px] drop-shadow-lg -scale-x-100" />
                        <span className="text-[12px] font-semibold drop-shadow-lg">139K</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <PlatformIcon name="chat_bubble_outline" className="text-[26px] drop-shadow-lg" />
                        <span className="text-[12px] font-semibold drop-shadow-lg">11</span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <PlatformIcon name="share" className="text-[26px] drop-shadow-lg -scale-x-100" />
                        <span className="text-[12px] font-semibold drop-shadow-lg">16.9K</span>
                    </div>
                </div>

                {/* Bottom Profile Info */}
                <div className="absolute bottom-20 left-0 right-12 p-4 z-20">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/50">
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full" />
                        </div>
                        <span className="font-semibold text-[14px] drop-shadow-md">{mockUser.name}</span>
                        <span className="material-symbols-outlined text-[#0866FF] text-[14px] filled">verified</span>
                        <PlatformIcon name="public" className="text-[14px] opacity-70" />
                        <button className="px-3 py-1 rounded-md bg-white/20 backdrop-blur-sm text-[12px] font-semibold">{t('social.preview.facebook.follow')}</button>
                    </div>

                    <div className="flex items-start gap-2">
                        <div className="text-[13px] drop-shadow-md leading-snug flex-1">
                            {caption ? (
                                <>
                                    {caption.length > 35 ? caption.substring(0, 35) + '...' : caption}
                                    <span className="text-white/70 ml-1">{t('social.preview.common.more')}</span>
                                </>
                            ) : (
                                <>
                                    {t('social.preview.facebook.captionFallback')}
                                    <span className="text-white/70 ml-1">{t('social.preview.common.more')}</span>
                                </>
                            )}
                        </div>
                        <PlatformIcon name="more_horiz" className="text-xl opacity-80" />
                    </div>
                </div>

                {/* Bottom Comment Bar */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-4 z-40 flex items-center gap-3 bg-black/80 backdrop-blur-sm">
                    <div className="flex-1 bg-white/10 rounded-full px-4 py-2 text-[14px] text-white/60">
                        {t('social.preview.common.addComment')}
                    </div>
                    <PlatformIcon name="sentiment_satisfied" className="text-2xl text-white/80" />
                    <span className="text-[14px] font-bold text-white/80 px-2 py-1 rounded border border-white/30">{t('social.preview.common.gif')}</span>
                </div>

                {/* Pause Overlay Indicator */}
                {(!isStoryPlaying || isPreviewHovered) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none z-50">
                        <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center animate-pulse">
                            <PlatformIcon name={!isStoryPlaying ? 'play_arrow' : 'pause'} className="text-4xl text-white" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- 6. FACEBOOK TEXT ---
    if (platform === 'Facebook' && format === 'Text') {
        return (
            <div className="w-[400px] bg-white dark:bg-[#18191A] text-black dark:text-[#E4E6EB] rounded-lg shadow-md font-sans mx-auto overflow-hidden transition-colors">
                {/* Header */}
                <div className="p-3 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full" alt="avatar" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[15px] hover:underline cursor-pointer">{mockUser.name}</span>
                            <span className="material-symbols-outlined text-[#0866FF] text-[16px] filled">verified</span>
                            <span className="text-gray-400 dark:text-[#B0B3B8] text-[15px]">·</span>
                            <span className="text-[#0866FF] font-semibold text-[15px] hover:underline cursor-pointer">{t('social.preview.facebook.follow')}</span>
                        </div>
                        <div className="text-[13px] text-gray-500 dark:text-[#B0B3B8] flex items-center gap-1 mt-0.5">
                            <span>Dec 13</span>
                            <span>·</span>
                            <PlatformIcon name="public" className="text-[13px]" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 dark:text-[#B0B3B8]">
                        <PlatformIcon name="more_horiz" className="text-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 rounded-full p-1" />
                        <PlatformIcon name="close" className="text-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 rounded-full p-1" />
                    </div>
                </div>

                {/* Text Content */}
                <div className="px-3 pb-4 text-[15px] leading-relaxed whitespace-pre-wrap">
                    {caption || <span className="text-muted">{t('social.preview.facebook.prompt')}</span>}
                    {hashtags && <div className="text-[#0866FF] mt-2">{hashtags}</div>}
                </div>

                {/* Bottom Stats Bar */}
                <div className="px-3 py-3 flex items-center justify-between border-t border-gray-200 dark:border-[#3E4042]">
                    {/* Left: Counts with icons */}
                    <div className="flex items-center gap-4 text-[15px] text-gray-600 dark:text-[#B0B3B8]">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#0866FF]">
                            <PlatformIcon name="thumb_up" className="text-xl -scale-x-100" />
                            <span>139K</span>
                        </div>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#0866FF]">
                            <PlatformIcon name="chat_bubble" className="text-xl" />
                            <span>11.9K</span>
                        </div>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#0866FF]">
                            <PlatformIcon name="share" className="text-xl -scale-x-100" />
                            <span>16.9K</span>
                        </div>
                    </div>

                    {/* Right: Reaction emojis */}
                    <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-[#0866FF] flex items-center justify-center text-white border-2 border-white dark:border-[#18191A] z-30">
                            <PlatformIcon name="thumb_up" className="text-[11px] filled -scale-x-100" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[#F7B125] flex items-center justify-center border-2 border-white dark:border-[#18191A] z-20">
                            <span className="text-[12px]">😮</span>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[#F7B125] flex items-center justify-center border-2 border-white dark:border-[#18191A] z-10">
                            <span className="text-[12px]">😂</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- 6B. FACEBOOK POST (with media) ---
    if (platform === 'Facebook' && (format === 'Post' || format === 'Image' || format === 'Video')) {

        const currentAsset = assets[activeCarouselIndex] || assets[0];

        return (
            <div className="w-[400px] bg-white dark:bg-[#18191A] text-black dark:text-[#E4E6EB] rounded-lg shadow-md font-sans mx-auto overflow-hidden transition-colors">
                {/* Header */}
                <div className="p-3 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUser.name}`} className="w-full h-full" alt="avatar" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[15px] hover:underline cursor-pointer">{mockUser.name}</span>
                            <span className="material-symbols-outlined text-[#0866FF] text-[16px] filled">verified</span>
                            <span className="text-gray-400 dark:text-[#B0B3B8] text-[15px]">·</span>
                            <span className="text-[#0866FF] font-semibold text-[15px] hover:underline cursor-pointer">{t('social.preview.facebook.follow')}</span>
                        </div>
                        <div className="text-[13px] text-gray-500 dark:text-[#B0B3B8] flex items-center gap-1 mt-0.5">
                            <span>Dec 13</span>
                            <span>·</span>
                            <PlatformIcon name="public" className="text-[13px]" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 dark:text-[#B0B3B8]">
                        <PlatformIcon name="more_horiz" className="text-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 rounded-full p-1" />
                        <PlatformIcon name="close" className="text-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 rounded-full p-1" />
                    </div>
                </div>

                {/* Caption */}
                <div className="px-3 pb-3 text-[15px] leading-snug">
                    {caption ? (
                        <span>
                            {caption.length > 90 ? (
                                <>
                                    {caption.substring(0, 90)}... <span className="text-gray-500 dark:text-[#B0B3B8] cursor-pointer hover:underline">{t('social.preview.facebook.seeMore')}</span>
                                </>
                            ) : caption}
                        </span>
                    ) : (
                        <span className="text-muted">
                            {t('social.preview.facebook.captionPlaceholder')} <span className="text-gray-500 dark:text-[#B0B3B8] cursor-pointer hover:underline">{t('social.preview.facebook.seeMore')}</span>
                        </span>
                    )}
                </div>

                {/* Media Container */}
                <div className="w-full bg-black relative aspect-[4/5] flex items-center justify-center">
                    {assets.length > 0 ? (
                        <>
                            {currentAsset.type === 'video' ? (
                                <>
                                    <video src={currentAsset.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                                    <div className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-gray-800/80 flex items-center justify-center text-white cursor-pointer hover:bg-gray-700">
                                        <PlatformIcon name="volume_up" className="text-xl" />
                                    </div>
                                </>
                            ) : (
                                <img src={currentAsset.url} className="w-full h-full object-cover" alt="post media" />
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center text-gray-500">
                            <PlatformIcon name="image" className="text-7xl mb-2" />
                        </div>
                    )}
                </div>

                {/* Bottom Stats Bar - Matches Screenshot */}
                <div className="px-3 py-3 flex items-center justify-between">
                    {/* Left: Counts with icons */}
                    <div className="flex items-center gap-4 text-[15px] text-gray-600 dark:text-[#B0B3B8]">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#0866FF]">
                            <PlatformIcon name="thumb_up" className="text-xl -scale-x-100" />
                            <span>139K</span>
                        </div>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#0866FF]">
                            <PlatformIcon name="chat_bubble" className="text-xl" />
                            <span>11.9K</span>
                        </div>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#0866FF]">
                            <PlatformIcon name="share" className="text-xl -scale-x-100" />
                            <span>16.9K</span>
                        </div>
                    </div>

                    {/* Right: Reaction emojis */}
                    <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-[#0866FF] flex items-center justify-center text-white border-2 border-white dark:border-[#18191A] z-30">
                            <PlatformIcon name="thumb_up" className="text-[11px] filled -scale-x-100" />
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[#F7B125] flex items-center justify-center border-2 border-white dark:border-[#18191A] z-20">
                            <span className="text-[12px]">😮</span>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-[#F7B125] flex items-center justify-center border-2 border-white dark:border-[#18191A] z-10">
                            <span className="text-[12px]">😂</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }


    // --- 6. YOUTUBE VIDEO CARD ---
    if (platform === 'YouTube') {
        return (
            <div className="w-full max-w-sm bg-white dark:bg-[#0f0f0f] rounded-xl overflow-hidden shadow-lg mx-auto font-sans">
                {/* Thumbnail */}
                <div className="aspect-video bg-gray-100 relative group cursor-pointer">
                    {(thumbnailUrl || assets.length > 0) ? (
                        <img src={thumbnailUrl || assets[0].url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <PlatformIcon name="play_circle" className="text-5xl" />
                        </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                        12:42
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 w-2/3" />
                </div>

                {/* Info */}
                <div className="p-3 flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0">CL</div>
                    <div className="flex-1">
                        <h3 className="text-main font-semibold leading-tight line-clamp-2 mb-1">
                            {videoTitle || t('social.preview.youtube.titleFallback')}
                        </h3>
                        <div className="text-sm text-muted flex flex-wrap items-center gap-1">
                            <span>{mockUser.name}</span>
                            <PlatformIcon name="check_circle" className="text-[12px] text-gray-500" />
                            <span>{t('social.preview.youtube.stats').replace('{views}', '12K').replace('{time}', t('social.preview.youtube.timeAgo'))}</span>
                        </div>
                    </div>
                    <PlatformIcon name="more_vert" className="text-main" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center text-muted italic">
            {t('social.preview.empty')}
        </div>
    );
};
