import React, { useState, useMemo } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { PlatformIcon } from './PlatformIcon'; // Make sure this path is correct
import { SocialPostFormat } from '../../../types';

interface PlannedPostsSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    plannedContent: any[];
    onSelect: (post: any) => void;
}

const CONTENT_TYPE_COLORS: Record<string, string> = {
    Post: 'bg-blue-500 text-white',
    Reel: 'bg-pink-500 text-white',
    Story: 'bg-amber-500 text-white',
    Carousel: 'bg-violet-500 text-white',
    Short: 'bg-red-500 text-white',
    Video: 'bg-red-600 text-white',
    Text: 'bg-slate-500 text-white',
};

export const PlannedPostsSelectModal: React.FC<PlannedPostsSelectModalProps> = ({
    isOpen,
    onClose,
    plannedContent = [],
    onSelect
}) => {
    const [weekOffset, setWeekOffset] = useState(0);

    // Calculate total weeks
    const maxDayOffset = useMemo(() => {
        return plannedContent.reduce((max, p) => Math.max(max, p.dayOffset || 0), 0);
    }, [plannedContent]);
    const totalWeeks = Math.ceil((maxDayOffset + 1) / 7) || 1;

    // Filter posts for current week
    const currentWeekPosts = useMemo(() => {
        const startDay = weekOffset * 7;
        const endDay = startDay + 6;
        return plannedContent.filter(p => {
            const day = typeof p.dayOffset === 'number' ? p.dayOffset : -1;
            return day >= startDay && day <= endDay;
        }).sort((a, b) => (a.dayOffset || 0) - (b.dayOffset || 0));
    }, [plannedContent, weekOffset]);

    // Group by Day of Week (0-6)
    const columns = useMemo(() => {
        const cols = Array.from({ length: 7 }, (_, i) => ({
            dayIndex: i,
            dayNum: (weekOffset * 7) + i + 1,
            posts: [] as any[]
        }));

        currentWeekPosts.forEach(post => {
            const dayIndex = (post.dayOffset || 0) % 7;
            if (cols[dayIndex]) {
                cols[dayIndex].posts.push(post);
            }
        });
        return cols;
    }, [currentWeekPosts, weekOffset]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Select Planned Content"
            size="5xl"
            noPadding={true}
        >
            <div className="flex flex-col h-[80vh] w-full p-6">
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <p className="text-sm text-slate-500">Pick a planned item to create a post draft.</p>

                    {/* Week Navigator */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                        <button
                            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                            disabled={weekOffset === 0}
                            className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">chevron_left</span>
                        </button>
                        <span className="text-xs font-bold px-2 tabular-nums">
                            Week {weekOffset + 1} <span className="text-slate-400 font-normal">of {totalWeeks}</span>
                        </span>
                        <button
                            onClick={() => setWeekOffset(Math.min(totalWeeks - 1, weekOffset + 1))}
                            disabled={weekOffset >= totalWeeks - 1}
                            className="p-1 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </button>
                    </div>
                </div>

                {/* 7-Column Grid - Unified Scroll */}
                <div className="flex-1 overflow-y-auto overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="grid grid-cols-7 min-w-[1000px] divide-x divide-slate-200 dark:divide-slate-800 relative">
                        {columns.map((col) => (
                            <div key={col.dayIndex} className="flex flex-col">
                                {/* Column Header - Sticky */}
                                <div className="sticky top-0 z-20 p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-center shadow-sm">
                                    <div className="text-[10px] items-center justify-center font-bold uppercase tracking-wider text-slate-400 mb-1">
                                        Day
                                    </div>
                                    <div className="text-xl font-black text-slate-700 dark:text-slate-200 leading-none">
                                        {col.dayNum}
                                    </div>
                                </div>

                                {/* Posts Area */}
                                <div className="p-2 space-y-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors">
                                    {col.posts.length > 0 ? (
                                        col.posts.map(post => {
                                            const platforms = Array.isArray(post.platforms) ? post.platforms : (post.platform ? [post.platform] : []);
                                            const contentType = post.contentType || post.format || 'Post';
                                            const badgeColor = CONTENT_TYPE_COLORS[contentType] || 'bg-slate-500 text-white';

                                            return (
                                                <button
                                                    key={post.id}
                                                    onClick={() => onSelect(post)}
                                                    className="w-full text-left group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-cyan-500 dark:hover:border-cyan-400 hover:ring-1 hover:ring-cyan-500/20 transition-all"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex -space-x-1.5 overflow-hidden">
                                                            {platforms.map((p: string, i: number) => (
                                                                <div key={i} className="size-5 rounded-md bg-slate-100 dark:bg-slate-900 border border-white dark:border-slate-800 flex items-center justify-center shrink-0 z-10 relative">
                                                                    <div className="size-3.5"><PlatformIcon platform={p as any} /></div>
                                                                </div>
                                                            ))}
                                                            {platforms.length === 0 && (
                                                                <div className="size-5 rounded-md bg-slate-100 dark:bg-slate-800 border-dashed border-slate-300 dark:border-slate-600" />
                                                            )}
                                                        </div>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badgeColor} truncate max-w-[60px]`}>
                                                            {contentType}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 line-clamp-3 mb-2 leading-snug group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                                                        {post.hook || post.visualDirection || 'Untitled Post'}
                                                    </p>

                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium group-hover:text-cyan-600/70 dark:group-hover:text-cyan-400/70">
                                                        <span>Select</span>
                                                        <span className="material-symbols-outlined text-[12px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="h-24 flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800/50 rounded-lg">
                                            <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-wider">Empty</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
