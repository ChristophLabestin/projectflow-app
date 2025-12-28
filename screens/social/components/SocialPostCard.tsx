import React from 'react';
import { SocialPost } from '../../../types';
import { PlatformIcon } from './PlatformIcon';

interface SocialPostCardProps {
    post: SocialPost;
    onClick?: () => void;
    onDelete?: (e: React.MouseEvent) => void;
    onSplit?: (e: React.MouseEvent) => void;
    className?: string;
    showStatus?: boolean; // Sometimes we might want to hide it if column implies it
}



export const SocialPostCard: React.FC<SocialPostCardProps> = ({
    post,
    onClick,
    onDelete,
    onSplit,
    className = '',
    showStatus = true
}) => {
    const isVideo = ['Video', 'Reel', 'Short', 'Story'].includes(post.format);
    const hasMedia = !!(post.videoConcept?.thumbnailUrl || post.assets?.[0]?.url);
    const mediaUrl = post.videoConcept?.thumbnailUrl || post.assets?.[0]?.url;

    // Platform Color Logic
    const getPlatformColor = (p: string, platforms?: string[], rejectionReason?: string) => {
        if (rejectionReason) return 'border-l-red-500 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10';
        if (platforms && platforms.length > 1) return 'border-l-indigo-500'; // Multi-platform color
        switch (p) {
            case 'Instagram': return 'border-l-pink-500';
            case 'LinkedIn': return 'border-l-blue-600';
            case 'YouTube': return 'border-l-red-600';
            case 'TikTok': return 'border-l-black dark:border-l-white';
            default: return 'border-l-gray-400';
        }
    };

    const getPlatformBadgeStyle = (p: string) => {
        switch (p) {
            case 'Instagram': return 'bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400';
            case 'LinkedIn': return 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
            case 'YouTube': return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
            case 'TikTok': return 'bg-gray-100 text-black dark:bg-gray-800 dark:text-white';
            default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        }
    };

    // --- Concept / Idea Layout (Text Focused) ---
    if (post.isConcept) {
        return (
            <div
                onClick={onClick}
                className={`group relative flex flex-col bg-[#fff9c4] dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${className}`}
            >
                {/* Header: Platform Icons & Delete */}
                <div className="flex justify-between items-start mb-3">
                    <div className="flex -space-x-1.5 overflow-hidden">
                        {post.platforms?.map((p, i) => (
                            <div key={p} className="w-6 h-6 shrink-0 shadow-sm rounded-full">
                                <PlatformIcon platform={p as any} className="w-full h-full" />
                            </div>
                        ))}
                    </div>

                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                            className="text-yellow-600/60 hover:text-red-500 dark:text-yellow-500/50 dark:hover:text-red-400 transition-colors p-1"
                        >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    )}
                </div>

                {/* Content: Title/Concept */}
                <div className="flex-1 space-y-2 mb-2">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100/90 text-sm leading-snug">
                        {post.videoConcept?.title || (post.content.caption ? (post.content.caption.length > 30 ? post.content.caption.slice(0, 30) + '...' : post.content.caption) : 'Untitled Idea')}
                    </h3>
                    {post.content.caption && (
                        <p className="text-xs text-yellow-800/80 dark:text-yellow-200/70 line-clamp-4 font-sans leading-relaxed">
                            {post.content.caption}
                        </p>
                    )}
                </div>

                {/* Footer: Split Action */}
                {post.platforms && post.platforms.length > 1 && onSplit && (
                    <div className="mt-2 pt-2 border-t border-yellow-200/50 dark:border-yellow-900/30">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSplit(e);
                            }}
                            className="w-full py-1.5 text-xs font-bold text-yellow-800 dark:text-yellow-200 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-md hover:bg-yellow-200/50 dark:hover:bg-yellow-900/40 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[14px]">call_split</span>
                            Split into {post.platforms.length} Drafts
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // --- Standard Post Layout ---
    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer ${className}`}
        >
            {/* Status Strip (if showing status or rejection) */}
            <div className={`h-1 w-full ${getPlatformColor(post.platform, undefined, post.rejectionReason).replace('border-l-', 'bg-')}`} />

            <div className="flex">
                {/* Left: Media Thumbnail (if exists) */}
                {hasMedia && (
                    <div className="w-[100px] bg-slate-100 dark:bg-slate-800 relative shrink-0">
                        {mediaUrl ? (
                            <img src={mediaUrl} alt="Thumbnail" className="w-full h-full object-cover absolute inset-0" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined">image</span>
                            </div>
                        )}
                        {/* Type Badge */}
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[8px] font-bold text-white uppercase tracking-wider">
                            {post.format === 'Story' ? 'Story' : isVideo ? 'Video' : 'Post'}
                        </div>
                    </div>
                )}

                {/* Right: Content */}
                <div className="flex-1 p-3 flex flex-col min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            {/* Platform Icon (Small) */}
                            {/* Platform Icon (Small) */}
                            <div className="w-5 h-5 flex-shrink-0">
                                <PlatformIcon platform={post.platform} className="w-full h-full object-contain" />
                            </div>
                            {/* Title */}
                            <h4 className="text-sm font-semibold text-[var(--color-text-main)] truncate block">
                                {post.videoConcept?.title || post.content.caption?.slice(0, 30) || 'Untitled Post'}
                            </h4>
                        </div>

                        {onDelete && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(e); }}
                                className="text-[var(--color-text-muted)] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        )}
                    </div>

                    {/* Caption Preview */}
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-3 leading-relaxed">
                        {post.content.caption || 'No caption...'}
                    </p>

                    {/* Footer Meta */}
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-[var(--color-surface-border)]">
                        {/* Date */}
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] font-medium">
                            <span className="material-symbols-outlined text-[12px]">event</span>
                            {post.scheduledFor ? new Date(post.scheduledFor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unscheduled'}
                        </div>

                        {/* Badges */}
                        {post.rejectionReason && (
                            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-bold uppercase">
                                Revision
                            </span>
                        )}
                        {!post.rejectionReason && showStatus && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${post.status === 'Published' ? 'bg-green-100 text-green-700' :
                                post.status === 'Scheduled' ? 'bg-orange-100 text-orange-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                {post.status}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
