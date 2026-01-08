import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Modal } from '../../common/Modal/Modal';
import { Button } from '../../common/Button/Button';
import { TextArea } from '../../common/Input/TextArea';
import { Select } from '../../common/Select/Select';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { SocialPlatform } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { useConfirm } from '../../../context/UIContext';

const CONTENT_TYPES: { id: string; icon: string; labelKey: string }[] = [
    { id: 'Post', icon: 'image', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.post' },
    { id: 'Reel', icon: 'play_circle', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.reel' },
    { id: 'Story', icon: 'auto_stories', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.story' },
    { id: 'Carousel', icon: 'view_carousel', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.carousel' },
    { id: 'Short', icon: 'movie', labelKey: 'flowStages.socialCampaignPlanning.contentTypes.short' },
];

const PHASE_TONES = ['tone-1', 'tone-2', 'tone-3', 'tone-4', 'tone-5'] as const;

const PLATFORM_OPTIONS = [
    { value: 'LinkedIn', labelKey: 'social.platform.linkedin' },
    { value: 'Twitter', labelKey: 'social.platform.twitter' },
    { value: 'Instagram', labelKey: 'social.platform.instagram' },
    { value: 'TikTok', labelKey: 'social.platform.tiktok' },
    { value: 'YouTube', labelKey: 'social.platform.youtube' },
    { value: 'Facebook', labelKey: 'social.platform.facebook' },
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

const SortablePostItem = ({
    post,
    onClick,
    onDelete,
    onEdit,
    isOverlay = false
}: {
    post: Post;
    onClick?: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    isOverlay?: boolean;
}) => {
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
    const className = [
        'review-timeline-modal__post',
        isOverlay ? 'review-timeline-modal__post--overlay' : '',
        isDragging ? 'review-timeline-modal__post--dragging' : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={onClick}
            className={className}
        >
            <div className="review-timeline-modal__post-header">
                <div className="review-timeline-modal__post-platforms">
                    {platforms.slice(0, 3).map((p: any) => (
                        <div
                            key={p}
                            className={`review-timeline-modal__post-platform ${p === 'LinkedIn' ? 'review-timeline-modal__post-platform--linkedin' : ''}`}
                        >
                            <PlatformIcon platform={p as SocialPlatform} />
                        </div>
                    ))}
                </div>
                <div className="review-timeline-modal__post-meta">
                    <span className="review-timeline-modal__type-badge">
                        {t(typeInfo.labelKey)}
                    </span>
                    {!isOverlay && (
                        <div className="review-timeline-modal__post-actions">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEdit && onEdit(); }}
                                className="review-timeline-modal__post-action"
                            >
                                <span className="material-symbols-outlined">edit</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                                className="review-timeline-modal__post-action review-timeline-modal__post-action--danger"
                            >
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="review-timeline-modal__post-title">
                {post.title || post.hook || t('flowStages.reviewTimelineModal.post.untitled')}
            </div>
        </div>
    );
};

const DayColumn = ({
    dayIndex,
    dayNum,
    phase,
    posts,
    onAddPost,
    onDeletePost,
    onEditPost
}: {
    dayIndex: number;
    dayNum: number;
    phase: any;
    posts: Post[];
    onAddPost: () => void;
    onDeletePost: (id: string) => void;
    onEditPost: (post: Post) => void;
}) => {
    const { t } = useLanguage();
    const { setNodeRef } = useSortable({
        id: `day-${dayIndex}`,
        data: { type: 'Day', dayIndex }
    });

    const isWeekend = (dayNum % 7) === 6 || (dayNum % 7) === 0;
    const phaseTone = phase?.tone ? `review-timeline-modal__day-header--${phase.tone}` : '';

    return (
        <div
            ref={setNodeRef}
            className={`review-timeline-modal__day ${isWeekend ? 'review-timeline-modal__day--weekend' : ''}`}
        >
            <div className={`review-timeline-modal__day-header ${phaseTone}`.trim()}>
                <div className="review-timeline-modal__day-header-top">
                    <span className="review-timeline-modal__day-label">
                        {t('flowStages.reviewTimelineModal.dayLabel')}
                    </span>
                    {phase && (
                        <div className={`review-timeline-modal__phase-dot review-timeline-modal__phase-dot--${phase.tone}`} title={phase.name} />
                    )}
                </div>
                <div className="review-timeline-modal__day-header-bottom">
                    <div className="review-timeline-modal__day-number">{dayNum}</div>
                    <button
                        type="button"
                        onClick={onAddPost}
                        className="review-timeline-modal__day-add"
                        aria-label={t('flowStages.reviewTimelineModal.actions.add')}
                    >
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>
            </div>

            <div className="review-timeline-modal__day-posts">
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
                    <button
                        type="button"
                        className="review-timeline-modal__empty"
                        onClick={onAddPost}
                    >
                        <span className="review-timeline-modal__empty-icon">
                            <span className="material-symbols-outlined">add</span>
                        </span>
                        <span className="review-timeline-modal__empty-label">
                            {t('flowStages.reviewTimelineModal.actions.add')}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};

const EditPostModal = ({
    post,
    isOpen,
    onClose,
    onSave
}: {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (post: Post) => void;
}) => {
    const { t } = useLanguage();
    const [editedPost, setEditedPost] = useState<Post | null>(null);

    useEffect(() => {
        setEditedPost(post);
    }, [post]);

    if (!isOpen || !editedPost) return null;

    const formatOptions = CONTENT_TYPES.map((type) => ({
        value: type.id,
        label: t(type.labelKey),
    }));

    const platformOptions = PLATFORM_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
    }));

    const footer = (
        <>
            <Button variant="secondary" size="sm" onClick={onClose}>
                {t('flowStages.reviewTimelineModal.edit.cancel')}
            </Button>
            <Button size="sm" onClick={() => onSave(editedPost)}>
                {t('flowStages.reviewTimelineModal.edit.save')}
            </Button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('flowStages.reviewTimelineModal.edit.title')}
            size="sm"
            footer={footer}
        >
            <div className="review-timeline-modal__edit">
                <TextArea
                    label={t('flowStages.reviewTimelineModal.edit.hookLabel')}
                    value={editedPost.hook || ''}
                    onChange={(e) => setEditedPost({ ...editedPost, hook: e.target.value })}
                    placeholder={t('flowStages.reviewTimelineModal.edit.hookPlaceholder')}
                    className="review-timeline-modal__edit-field"
                />

                <div className="review-timeline-modal__edit-grid">
                    <Select
                        label={t('flowStages.reviewTimelineModal.edit.formatLabel')}
                        value={editedPost.contentType}
                        onChange={(value) => setEditedPost({ ...editedPost, contentType: value as Post['contentType'] })}
                        options={formatOptions}
                        className="review-timeline-modal__edit-field"
                    />
                    <Select
                        label={t('flowStages.reviewTimelineModal.edit.platformLabel')}
                        value={editedPost.platform}
                        onChange={(value) => setEditedPost({
                            ...editedPost,
                            platform: value as string,
                            platforms: [value as string]
                        })}
                        options={platformOptions}
                        className="review-timeline-modal__edit-field"
                    />
                </div>
            </div>
        </Modal>
    );
};

export const ReviewTimelineModal: React.FC<ReviewTimelineModalProps> = ({
    isOpen,
    onClose,
    campaignData,
    onUpdate
}) => {
    const { t } = useLanguage();
    const confirm = useConfirm();
    const [posts, setPosts] = useState<Post[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [editingPost, setEditingPost] = useState<Post | null>(null);

    useEffect(() => {
        if (isOpen && campaignData.posts) {
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
        setEditingPost(newPost);
    };

    const handleUpdatePost = (updatedPost: Post) => {
        setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
        setEditingPost(null);
    };

    const handleDeletePost = async (id: string) => {
        const confirmed = await confirm(
            t('flowStages.reviewTimelineModal.confirmTitle'),
            t('flowStages.reviewTimelineModal.confirmDelete')
        );
        if (!confirmed) return;
        setPosts(prev => prev.filter(p => p.id !== id));
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

        if (over.data.current?.type === 'Day') {
            const dayIndex = over.data.current.dayIndex;
            if (activePost.dayOffset !== dayIndex) {
                setPosts(prev => prev.map(p => p.id === activeId ? { ...p, dayOffset: dayIndex } : p));
            }
        } else if (overPost && activePost.dayOffset !== overPost.dayOffset) {
            setPosts(prev => prev.map(p => p.id === activeId ? { ...p, dayOffset: overPost.dayOffset } : p));
        }
    };

    const handleDragEnd = (_event: DragEndEvent) => {
        setActiveId(null);
    };

    const phasesWithTones = useMemo(() => {
        return (campaignData.phases || []).map((p: any, i: number) => ({
            ...p,
            tone: PHASE_TONES[i % PHASE_TONES.length],
        }));
    }, [campaignData.phases]);

    const totalDurationDays = useMemo(() => {
        return (campaignData.phases || []).reduce((acc: number, p: any) => acc + phaseToDays(p), 0);
    }, [campaignData.phases]);

    const totalWeeks = Math.ceil(Math.max(totalDurationDays, 14) / 7);

    const weekData = useMemo(() => {
        let currentDay = 0;
        const phaseRanges = phasesWithTones.map((p: any) => {
            const duration = phaseToDays(p);
            const range = {
                id: p.id,
                name: p.name,
                tone: p.tone,
                start: currentDay,
                end: currentDay + duration,
            };
            currentDay += duration;
            return range;
        });

        const startDay = weekOffset * 7;
        const days = Array.from({ length: 7 }).map((_, i) => {
            const dayNum = startDay + i + 1;
            const dayIndex = startDay + i;
            const phase = phaseRanges.find((p: any) => dayNum > p.start && dayNum <= p.end);

            return {
                dayIndex,
                dayNum,
                phase,
            };
        });

        return { days, phaseRanges };
    }, [phasesWithTones, weekOffset]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { onClose(); onUpdate(posts); }}
            title={t('flowStages.reviewTimelineModal.title')}
            size="full"
        >
            <div className="review-timeline-modal">
                <div className="review-timeline-modal__toolbar">
                    <div className="review-timeline-modal__nav">
                        <button
                            type="button"
                            onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                            disabled={weekOffset === 0}
                            className="review-timeline-modal__nav-button"
                        >
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="review-timeline-modal__nav-label">
                            {t('flowStages.reviewTimelineModal.weekLabel')
                                .replace('{week}', `${weekOffset + 1}`)
                                .replace('{total}', `${totalWeeks}`)}
                        </div>
                        <button
                            type="button"
                            onClick={() => setWeekOffset(Math.min(totalWeeks - 1, weekOffset + 1))}
                            disabled={weekOffset >= totalWeeks - 1}
                            className="review-timeline-modal__nav-button"
                        >
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                    <div className="review-timeline-modal__count">
                        {t('flowStages.reviewTimelineModal.postsTotal').replace('{count}', `${posts.length}`)}
                    </div>
                </div>

                <div className="review-timeline-modal__body">
                    <div className="review-timeline-modal__grid">
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

                <div className="review-timeline-modal__footer">
                    <div className="review-timeline-modal__legend">
                        <span className="review-timeline-modal__legend-label">
                            {t('flowStages.reviewTimelineModal.legend')}
                        </span>
                        {phasesWithTones.map((phase: any) => (
                            <div key={phase.id} className="review-timeline-modal__legend-item">
                                <span className={`review-timeline-modal__legend-dot review-timeline-modal__legend-dot--${phase.tone}`} />
                                {phase.name}
                            </div>
                        ))}
                    </div>
                    <div className="review-timeline-modal__actions">
                        <Button variant="secondary" onClick={onClose}>
                            {t('flowStages.reviewTimelineModal.cancel')}
                        </Button>
                        <Button onClick={() => { onUpdate(posts); onClose(); }}>
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
