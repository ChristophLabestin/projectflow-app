import React, { useState } from 'react';
import { SocialPost, SocialPlatform, SocialPostStatus } from '../../../types';
import { SocialPostCard } from '../components/SocialPostCard';
import { useDraggable, useDroppable, DndContext, DragOverlay, DragEndEvent, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday } from 'date-fns';
import { useLanguage } from '../../../context/LanguageContext';
import { getSocialPostFormatLabel, getSocialPostStatusLabel } from '../../../utils/socialLocalization';

// --- Local DnD Wrappers ---
const DraggablePostCard = ({ post, children, className }: { post: SocialPost; children: React.ReactNode, className?: string }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: post.id,
        data: { post, origin: 'calendar' }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`touch-none ${className}`}>
            {children}
        </div>
    );
};

const DroppableDay = ({ date, children, isCurrentMonth }: { date: Date; children: React.ReactNode; isCurrentMonth: boolean }) => {
    const { t, dateLocale } = useLanguage();
    const dateStr = format(date, 'yyyy-MM-dd');
    const { setNodeRef, isOver } = useDroppable({
        id: `date:${dateStr}`,
        data: { date: dateStr }
    });

    return (
        <div
            ref={setNodeRef}
            className={`p-2 border-r border-b border-surface relative transition-colors h-full flex flex-col ${!isCurrentMonth ? 'bg-surface text-muted opacity-50' : 'bg-surface'
                } ${isOver ? 'bg-surface-hover shadow-inner' : ''}`}
        >
            <div className={`text-right text-xs font-medium mb-1 ${isToday(date) ? 'text-primary font-bold' : ''} ${!isCurrentMonth ? 'opacity-50' : ''}`}>
                {isToday(date) && <span className="mr-1">{t('social.calendar.today')}</span>}
                {format(date, 'd', { locale: dateLocale })}
            </div>
            {children}
        </div>
    );
};

const DroppableSidebar = ({ children }: { children: React.ReactNode }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'sidebar-unscheduled',
    });

    return (
        <div
            ref={setNodeRef}
            className={`flex-1 transition-colors ${isOver ? 'bg-surface-hover' : ''}`}
        >
            {children}
        </div>
    );
};


interface CampaignCalendarViewProps {
    posts: SocialPost[];
    currentCampaignId: string;
    onSchedulePost: (postId: string, date: Date | null) => void;
    onEditPost: (post: SocialPost) => void;
}

export const CampaignCalendarView: React.FC<CampaignCalendarViewProps> = ({ posts, currentCampaignId, onSchedulePost, onEditPost }) => {
    const { t, dateLocale } = useLanguage();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [activeDragItem, setActiveDragItem] = useState<SocialPost | null>(null);
    const [hoveredPost, setHoveredPost] = useState<SocialPost | null>(null);
    const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);
    const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<SocialPostStatus[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: any) => {
        setActiveDragItem(event.active.data.current?.post || null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragItem(null);

        if (!over) return;

        const postId = active.id as string;
        const targetId = over.id as string;

        // If dropped on sidebar -> Unschedule
        if (targetId === 'sidebar-unscheduled') {
            onSchedulePost(postId, null);
            return;
        }

        // If dropped on a day -> Schedule
        if (targetId.startsWith('date:')) {
            const dateStr = targetId.replace('date:', '');
            // Create date object at noon to avoid timezone edge cases for simple scheduling
            const newDate = new Date(dateStr + 'T12:00:00');
            onSchedulePost(postId, newDate);
        }
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const today = () => setCurrentMonth(new Date());

    // Filter Posts
    const visiblePosts = posts.filter(p => {
        if (p.isConcept) return false;
        if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(p.platform)) return false;
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(p.status)) return false;
        return true;
    });
    const unscheduled = visiblePosts.filter(p => !p.scheduledFor && p.status !== 'Published' && p.campaignId === currentCampaignId);
    const scheduledPosts = visiblePosts.filter(p => p.scheduledFor);

    // Grid Generation
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = [
        t('social.calendar.weekdays.sun'),
        t('social.calendar.weekdays.mon'),
        t('social.calendar.weekdays.tue'),
        t('social.calendar.weekdays.wed'),
        t('social.calendar.weekdays.thu'),
        t('social.calendar.weekdays.fri'),
        t('social.calendar.weekdays.sat')
    ];

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full">
                {/* Sidebar: Unscheduled */}
                <div className="w-[260px] flex flex-col border-r border-surface bg-card shrink-0 z-10 h-full">
                    <div className="p-4 border-b border-surface flex items-center justify-between shrink-0">
                        <h3 className="font-bold text-main text-sm">{t('social.calendar.unscheduled')}</h3>
                        <span className="text-xs bg-surface-hover px-2 py-0.5 rounded-full text-muted font-bold">{unscheduled.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                        <DroppableSidebar>
                            {unscheduled.map(post => (
                                <DraggablePostCard key={post.id} post={post} className="cursor-grab active:cursor-grabbing">
                                    <SocialPostCard
                                        post={post}
                                        onClick={() => onEditPost(post)}
                                        className="h-20" // Compact
                                        showStatus={false}
                                    />
                                </DraggablePostCard>
                            ))}
                            {unscheduled.length === 0 && (
                                <div className="text-center py-8 opacity-50 text-sm">
                                    {t('social.calendar.emptyUnscheduled')}
                                </div>
                            )}
                        </DroppableSidebar>
                    </div>
                </div>

                {/* Main Calendar Area - Flex Column to fill height */}
                <div className="flex-1 flex flex-col bg-surface h-full overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 flex items-center justify-between border-b border-surface shrink-0 bg-surface">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-main">
                                {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
                            </h2>
                            <div className="flex bg-card rounded-lg border border-surface p-0.5">
                                <button onClick={prevMonth} className="p-1 hover:bg-surface-hover rounded-md transition-colors text-muted">
                                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                                </button>
                                <button onClick={today} className="px-3 text-xs font-bold hover:bg-surface-hover rounded-md transition-colors text-muted">
                                    {t('social.calendar.today')}
                                </button>
                                <button onClick={nextMonth} className="p-1 hover:bg-surface-hover rounded-md transition-colors text-muted">
                                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                                </button>
                            </div>
                        </div>

                        {/* Filter Button & Popover */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-md transition-all border flex items-center gap-2 text-xs font-medium ${selectedPlatforms.length > 0 || selectedStatuses.length > 0
                                    ? 'bg-primary text-on-primary border-primary'
                                    : 'bg-card border-surface text-main hover:bg-surface-hover'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[16px]">filter_list</span>
                                <span>{t('social.calendar.filter')}</span>
                                {(selectedPlatforms.length > 0 || selectedStatuses.length > 0) && (
                                    <span className="bg-white/20 px-1.5 rounded-full text-[10px]">
                                        {selectedPlatforms.length + selectedStatuses.length}
                                    </span>
                                )}
                            </button>

                            {/* Popover */}
                            {showFilters && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-surface rounded-lg shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-bold text-xs uppercase tracking-wider text-muted">{t('social.calendar.filters')}</h4>
                                            {(selectedPlatforms.length > 0 || selectedStatuses.length > 0) && (
                                                <button
                                                    onClick={() => { setSelectedPlatforms([]); setSelectedStatuses([]); }}
                                                    className="text-[10px] text-primary hover:underline"
                                                >
                                                    {t('social.calendar.clearAll')}
                                                </button>
                                            )}
                                        </div>

                                        {/* Platforms */}
                                        <div className="mb-4">
                                            <label className="text-xs font-medium mb-2 block text-main">{t('social.calendar.platform')}</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'] as SocialPlatform[]).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => {
                                                            if (selectedPlatforms.includes(p)) setSelectedPlatforms(selectedPlatforms.filter(i => i !== p));
                                                            else setSelectedPlatforms([...selectedPlatforms, p]);
                                                        }}
                                                        className={`text-[10px] p-1.5 rounded border flex justify-center ${selectedPlatforms.includes(p)
                                                            ? 'bg-primary/10 border-primary text-primary font-bold'
                                                            : 'bg-surface border-surface text-muted hover:border-muted'
                                                            }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div>
                                            <label className="text-xs font-medium mb-2 block text-main">{t('social.calendar.status')}</label>
                                            <div className="space-y-1">
                                                {(['Draft', 'In Review', 'Approved', 'Scheduled', 'Published'] as SocialPostStatus[]).map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => {
                                                            if (selectedStatuses.includes(s)) setSelectedStatuses(selectedStatuses.filter(i => i !== s));
                                                            else setSelectedStatuses([...selectedStatuses, s]);
                                                        }}
                                                        className={`w-full text-left text-xs px-2 py-1.5 rounded flex items-center justify-between ${selectedStatuses.includes(s)
                                                            ? 'bg-primary/10 text-primary font-medium'
                                                            : 'text-muted hover:bg-surface-hover'
                                                            }`}
                                                    >
                                                        {getSocialPostStatusLabel(s, t)}
                                                        {selectedStatuses.includes(s) && <span className="material-symbols-outlined text-[14px]">check</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Week Header */}
                    <div className="grid grid-cols-7 border-b border-surface bg-surface shrink-0">
                        {weekDays.map(day => (
                            <div key={day} className="py-2 text-center text-xs font-bold text-muted uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Month Grid - Fit to remaining height */}
                    <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr h-full">
                        {calendarDays.map((day, idx) => {
                            const dayPosts = scheduledPosts.filter(p => p.scheduledFor && isSameDay(parseISO(p.scheduledFor), day));
                            const isCurrent = isSameMonth(day, currentMonth);

                            return (
                                <DroppableDay key={day.toISOString()} date={day} isCurrentMonth={isCurrent}>
                                    <div className="space-y-1 max-h-full overflow-y-auto custom-scrollbar pr-1">
                                        {dayPosts.map(post => {
                                            const isCurrentCampaign = post.campaignId === currentCampaignId;
                                            return (
                                                <DraggablePostCard key={post.id} post={post} className={`cursor-grab active:cursor-grabbing ${!isCurrentCampaign ? 'pointer-events-none' : ''}`}>
                                                    {/* Mini Card for Calendar */}
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); if (isCurrentCampaign) onEditPost(post); }}
                                                        onMouseEnter={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const CARD_WIDTH = 260; // w-64 is 16rem = 256px + padding
                                                            const SPACE_RIGHT = window.innerWidth - rect.right;

                                                            let x = rect.right + 10;
                                                            const CARD_HEIGHT = 160; // Estimated height for the popover
                                                            const SPACE_BELOW = window.innerHeight - rect.top;

                                                            if (SPACE_RIGHT < CARD_WIDTH + 20) {
                                                                x = rect.left - CARD_WIDTH - 10;
                                                            }

                                                            let y = rect.top;
                                                            if (SPACE_BELOW < CARD_HEIGHT + 20) {
                                                                y = rect.bottom - CARD_HEIGHT; // Shift up to align bottom
                                                            }

                                                            setHoveredPost(post);
                                                            setHoverPosition({ x, y });
                                                        }}
                                                        onMouseLeave={() => {
                                                            setHoveredPost(null);
                                                            setHoverPosition(null);
                                                        }}
                                                        className={`rounded border p-1 flex items-center gap-2 transition-all shadow-sm text-left overflow-hidden group h-8 ${isCurrentCampaign
                                                            ? 'bg-card border-surface hover:border-primary hover:border-l-4'
                                                            : 'bg-surface border-transparent opacity-50 grayscale'
                                                            }`}
                                                    >
                                                        {post.platform === 'Instagram' && <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0" />}
                                                        {post.platform === 'Facebook' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                                                        {post.platform === 'LinkedIn' && <span className="w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0" />}
                                                        {post.platform === 'YouTube' && <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />}
                                                        {post.platform === 'TikTok' && <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white shrink-0" />}
                                                        {post.platform === 'X' && <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white shrink-0" />}

                                                        <span className="text-[10px] font-medium truncate text-main leading-tight">
                                                            {post.videoConcept?.title || post.content.caption || t('social.calendar.untitled')}
                                                        </span>
                                                    </div>
                                                </DraggablePostCard>
                                            );
                                        })}
                                    </div>
                                </DroppableDay>
                            );
                        })}
                    </div>
                </div>
            </div>
            <DragOverlay>
                {activeDragItem ? (
                    <div className="w-[200px] opacity-90 rotate-2 pointer-events-none">
                        <div className="bg-card rounded-lg border border-surface p-2 shadow-xl flex items-center gap-2">
                            <span className="text-xs font-bold truncate">
                                {activeDragItem.videoConcept?.title || activeDragItem.content.caption || t('social.calendar.postFallback')}
                            </span>
                        </div>
                    </div>
                ) : null}
            </DragOverlay>

            {/* Hover Preview Card */}
            {hoveredPost && hoverPosition && (
                <div
                    className="fixed z-50 w-64 bg-card rounded-lg border border-surface shadow-xl p-3 pointer-events-none animate-in fade-in duration-200"
                    style={{ left: hoverPosition.x, top: hoverPosition.y }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            {hoveredPost.platform}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${hoveredPost.status === 'Published' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    </div>
                    <div className="text-sm font-medium text-main mb-1 line-clamp-2">
                        {hoveredPost.videoConcept?.title || hoveredPost.content.caption || `${getSocialPostFormatLabel(hoveredPost.format, t)} ${t('social.calendar.postLabel')}`}
                    </div>
                    <div className="text-xs text-muted line-clamp-3">
                        {hoveredPost.content.caption || t('social.calendar.noCaption')}
                    </div>
                </div>
            )}
        </DndContext>
    );
};
