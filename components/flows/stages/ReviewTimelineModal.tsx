import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { SocialPlatform } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

// Matching constants
const CONTENT_TYPES: { id: string; icon: string; labelKey: string; color: string }[] = [
    { id: 'Post', icon: 'image', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.post', color: 'bg-blue-500' },
    { id: 'Reel', icon: 'play_circle', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.reel', color: 'bg-pink-500' },
    { id: 'Story', icon: 'auto_stories', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.story', color: 'bg-amber-500' },
    { id: 'Carousel', icon: 'view_carousel', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.carousel', color: 'bg-violet-500' },
    { id: 'Short', icon: 'movie', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.short', color: 'bg-red-500' },
];

const PHASE_COLORS = [
    { bg: 'bg-gradient-to-r from-rose-500 to-pink-500', light: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
    { bg: 'bg-gradient-to-r from-orange-500 to-amber-500', light: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
    { bg: 'bg-gradient-to-r from-emerald-500 to-teal-500', light: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    { bg: 'bg-gradient-to-r from-blue-500 to-indigo-500', light: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
    { bg: 'bg-gradient-to-r from-violet-500 to-purple-500', light: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
];

const phaseToDays = (phase: any): number => {
    const val = phase.durationValue || 1;
    switch (phase.durationUnit) {
        case 'Weeks': return val * 7;
        case 'Months': return val * 30;
        default: return val;
    }
};

interface Post {
    id: string;
    dayOffset: number;
    platform: string;
    contentType: 'Post' | 'Reel' | 'Story' | 'Carousel' | 'Short';
    hook?: string;
    title?: string;
    platforms?: string[];
}

interface ReviewTimelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaignData: any;
    onUpdate: (newPosts: any[]) => void;
}

const SortablePostItem = ({ post, onClick, onDelete, onEdit, isOverlay = false }: { post: Post; onClick?: () => void, onDelete?: () => void, onEdit?: () => void, isOverlay?: boolean }) => {
    const { t } = useLanguage();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: post.id, data: { type: 'Post', post }, disabled: isOverlay });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    const typeInfo = CONTENT_TYPES.find(t => t.id === post.contentType) || CONTENT_TYPES[0];
    const platforms = post.platforms || [post.platform];

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={`group relative bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${isOverlay ? 'scale-105 shadow-xl rotate-2 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 z-50' : ''}`}
        >
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex -space-x-1">
                    {platforms.slice(0, 3).map((p: any) => (
                        <div key={p} className={`size-3.5 rounded ring-1 ring-white dark:ring-slate-800 flex items-center justify-center overflow-hidden ${p === 'LinkedIn' ? 'bg-slate-100' : ''}`}>
                            <PlatformIcon platform={p as SocialPlatform} />
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${typeInfo.color.replace('bg-', 'text-').replace('500', '600')} bg-opacity-10 dark:bg-opacity-20`}>
                        {t(typeInfo.labelKey)}
                    </span>
                    {!isOverlay && (
                        <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
                                className="mr-1 hover:text-emerald-500 text-slate-400"
                            >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                                className="hover:text-red-500 text-slate-400"
                            >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">
                {post.title || post.hook || t('flowStages.reviewTimelineModal.post.untitled')}
            </div>
        </div>
    );
};

const DayColumn = ({ dayIndex, dayNum, phase, posts, onAddPost, onDeletePost, onEditPost }: { dayIndex: number; dayNum: number; phase: any; posts: Post[]; onAddPost: () => void; onDeletePost: (id: string) => void; onEditPost: (post: Post) => void }) => {
    const { t } = useLanguage();
    const { setNodeRef } = useSortable({
        id: `day-${dayIndex}`,
        data: { type: 'Day', dayIndex }
    });

    const isWeekend = (dayNum % 7) === 6 || (dayNum % 7) === 0; // Approx based on dayNum

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col h-full rounded-2xl border overflow-hidden ${isWeekend ? 'bg-slate-50/80 border-slate-100/80 dark:bg-slate-900/20 dark:border-slate-800' : 'bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'}`}
        >
            {/* Header matching Review View */}
            <div className={`p-3 border-b border-slate-100 dark:border-slate-800 ${phase ? phase.color.light : 'bg-slate-50 dark:bg-slate-800/30'}`}>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">{t('flowStages.reviewTimelineModal.dayLabel')}</span>
                    {phase && <div className={`size-2 rounded-full ${phase.color.dot}`} title={phase.name} />}
                </div>
                <div className="flex items-baseline justify-between">
                    <div className="text-xl font-black text-slate-700 dark:text-slate-200">
                        {dayNum}
                    </div>
                    <button
                        onClick={onAddPost}
                        className="size-5 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-emerald-500 hover:border-emerald-200 transition-all"
                    >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 p-2 overflow-y-auto space-y-2">
                <SortableContext items={posts.map(p => p.id)} strategy={verticalListSortingStrategy}>
                    {posts.map(post => (
                        <SortablePostItem
                            key={post.id}
                            post={post}
                            onDelete={() => onDeletePost(post.id)}
                            onEdit={() => onEditPost(post)}
                        />
                    ))}
                </SortableContext>
                {posts.length === 0 && (
                    <div className="h-full flex items-center justify-center cursor-pointer opacity-50 hover:opacity-100 transition-opacity" onClick={onAddPost}>
                        <div className="flex flex-col items-center gap-1">
                            <div className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300">
                                <span className="material-symbols-outlined text-[12px]">add</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{t('flowStages.reviewTimelineModal.actions.add')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const EditPostModal = ({ post, isOpen, onClose, onSave }: { post: Post | null, isOpen: boolean, onClose: () => void, onSave: (post: Post) => void }) => {
    const { t } = useLanguage();
    const [editedPost, setEditedPost] = useState<Post | null>(null);

    useEffect(() => {
        setEditedPost(post);
    }, [post]);

    if (!isOpen || !editedPost) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">{t('flowStages.reviewTimelineModal.edit.title')}</h3>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('flowStages.reviewTimelineModal.edit.hookLabel')}</label>
                        <textarea
                            value={editedPost.hook || ''}
                            onChange={(e) => setEditedPost({ ...editedPost, hook: e.target.value })}
                            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-emerald-500 outline-none transition-all text-sm font-medium h-24 resize-none"
                            placeholder={t('flowStages.reviewTimelineModal.edit.hookPlaceholder')}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('flowStages.reviewTimelineModal.edit.formatLabel')}</label>
                            <select
                                value={editedPost.contentType}
                                onChange={(e) => setEditedPost({ ...editedPost, contentType: e.target.value as any })}
                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-emerald-500 outline-none text-sm font-bold"
                            >
                                {CONTENT_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>{t(type.labelKey)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('flowStages.reviewTimelineModal.edit.platformLabel')}</label>
                            <select
                                value={editedPost.platform}
                                onChange={(e) => setEditedPost({ ...editedPost, platform: e.target.value, platforms: [e.target.value] })}
                                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-emerald-500 outline-none text-sm font-bold"
                            >
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="Twitter">Twitter</option>
                                <option value="Instagram">Instagram</option>
                                <option value="TikTok">TikTok</option>
                                <option value="YouTube">YouTube</option>
                                <option value="Facebook">Facebook</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <Button variant="secondary" onClick={onClose} size="sm">{t('flowStages.reviewTimelineModal.edit.cancel')}</Button>
                    <Button onClick={() => onSave(editedPost)} size="sm" className="bg-emerald-600 text-white">{t('flowStages.reviewTimelineModal.edit.save')}</Button>
                </div>
            </div>
        </div>
    );
};


export const ReviewTimelineModal: React.FC<ReviewTimelineModalProps> = ({
    isOpen,
    onClose,
    campaignData,
    onUpdate
}) => {
    const { t } = useLanguage();
    const [posts, setPosts] = useState<Post[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [editingPost, setEditingPost] = useState<Post | null>(null);

    useEffect(() => {
        if (isOpen && campaignData.posts) {
            // Ensure every post has an ID
            const safePosts = campaignData.posts.map((p: any) => ({
                ...p,
                id: p.id || Math.random().toString(36).substr(2, 9)
            }));
            setPosts(safePosts);
        }
    }, [isOpen, campaignData]);

    const handleCreatePost = (dayIndex: number) => {
        const newPost: Post = {
            id: Math.random().toString(36).substr(2, 9),
            dayOffset: dayIndex,
            platform: 'LinkedIn',
            platforms: ['LinkedIn'],
            contentType: 'Post',
            hook: '',
        };
        setPosts([...posts, newPost]);
        setEditingPost(newPost); // Immedately edit
    };

    const handleUpdatePost = (updatedPost: Post) => {
        setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
        setEditingPost(null);
    };

    const handleDeletePost = (id: string) => {
        if (confirm(t('flowStages.reviewTimelineModal.confirmDelete'))) {
            setPosts(prev => prev.filter(p => p.id !== id));
        }
    };

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        const activePost = posts.find(p => p.id === activeId);
        const overPost = posts.find(p => p.id === overId);

        if (!activePost) return;

        // Dropping over a day column directly
        if (over.data.current?.type === 'Day') {
            const dayIndex = over.data.current.dayIndex;
            if (activePost.dayOffset !== dayIndex) {
                setPosts(prev => prev.map(p => p.id === activeId ? { ...p, dayOffset: dayIndex } : p));
            }
        }
        // Dropping over another post
        else if (overPost && activePost.dayOffset !== overPost.dayOffset) {
            setPosts(prev => prev.map(p => p.id === activeId ? { ...p, dayOffset: overPost.dayOffset } : p));
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        // onUpdate(posts); // We sync only on save/close to avoid too many writes? Or live? PROBABLY live is better UX but prop is 'onUpdate'. Let's sync on modal close or save mostly, but updating local state is key.
    };

    // Prepare phase data
    const phasesWithColors = useMemo(() => {
        return (campaignData.phases || []).map((p: any, i: number) => ({
            ...p,
            color: PHASE_COLORS[i % PHASE_COLORS.length]
        }));
    }, [campaignData.phases]);

    const totalDurationDays = useMemo(() => {
        return (campaignData.phases || []).reduce((acc: number, p: any) => acc + phaseToDays(p), 0);
    }, [campaignData.phases]);

    const totalWeeks = Math.ceil(Math.max(totalDurationDays, 14) / 7);

    // Calculate Week Data
    const weekData = useMemo(() => {
        // Calculate phase ranges
        let currentDay = 0;
        const phaseRanges = phasesWithColors.map((p: any) => {
            const duration = phaseToDays(p);
            const range = {
                id: p.id,
                name: p.name,
                color: p.color,
                start: currentDay,
                end: currentDay + duration,
            };
            currentDay += duration;
            return range;
        });

        const startDay = weekOffset * 7;
        const days = Array.from({ length: 7 }).map((_, i) => {
            const dayNum = startDay + i + 1; // 1-based index for display
            const dayIndex = startDay + i;   // 0-based index for logic

            const phase = phaseRanges.find((p: any) => dayNum > p.start && dayNum <= p.end);

            return {
                dayIndex,
                dayNum,
                phase,
            };
        });

        return { days, phaseRanges };
    }, [phasesWithColors, weekOffset]);


    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { onClose(); onUpdate(posts); }}
            title={t('flowStages.reviewTimelineModal.title')}
            size="full"
        >
            <div className="h-[80vh] flex flex-col bg-slate-50 dark:bg-slate-950">
                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                                disabled={weekOffset === 0}
                                className="size-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <div className="px-4 flex items-center text-sm font-bold text-slate-600 dark:text-slate-300">
                                {t('flowStages.reviewTimelineModal.weekLabel')
                                    .replace('{week}', `${weekOffset + 1}`)
                                    .replace('{total}', `${totalWeeks}`)}
                            </div>
                            <button
                                onClick={() => setWeekOffset(Math.min(totalWeeks - 1, weekOffset + 1))}
                                disabled={weekOffset >= totalWeeks - 1}
                                className="size-8 flex items-center justify-center rounded-md hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 transition-all"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium mr-2">
                            {t('flowStages.reviewTimelineModal.postsTotal').replace('{count}', `${posts.length}`)}
                        </span>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-slate-50 dark:bg-slate-950">
                    <div className="grid grid-cols-7 gap-4 h-full min-w-[1000px]">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragOver={handleDragOver}
                            onDragEnd={handleDragEnd}
                        >
                            {weekData.days.map((day) => (
                                <DayColumn
                                    key={day.dayIndex}
                                    dayIndex={day.dayIndex}
                                    dayNum={day.dayNum}
                                    phase={day.phase}
                                    posts={posts.filter(p => p.dayOffset === day.dayIndex)}
                                    onAddPost={() => handleCreatePost(day.dayIndex)}
                                    onDeletePost={handleDeletePost}
                                    onEditPost={setEditingPost}
                                />
                            ))}

                            <DragOverlay>
                                {activeId && posts.find(p => p.id === activeId) ? (
                                    <SortablePostItem post={posts.find(p => p.id === activeId)!} isOverlay />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-4 px-2">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            {t('flowStages.reviewTimelineModal.legend')}
                        </div>
                        {phasesWithColors.map((phase: any) => (
                            <div key={phase.id} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                <div className={`size-2 rounded-full ${phase.color.dot}`} />
                                {phase.name}
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                        >
                            {t('flowStages.reviewTimelineModal.cancel')}
                        </Button>
                        <Button
                            onClick={() => { onUpdate(posts); onClose(); }}
                            className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-200 dark:shadow-none"
                        >
                            {t('flowStages.reviewTimelineModal.save')}
                        </Button>
                    </div>
                </div>
            </div>

            <EditPostModal
                isOpen={!!editingPost}
                post={editingPost}
                onClose={() => setEditingPost(null)}
                onSave={handleUpdatePost}
            />
        </Modal>
    );
};
