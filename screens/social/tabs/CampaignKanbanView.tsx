
import React from 'react';
import { SocialPost, SocialPostStatus } from '../../../types';
import { SocialPostCard } from '../components/SocialPostCard';
import { ReviewPostModal } from '../components/ReviewPostModal';
import { MultiPlatformFanOutModal } from '../components/MultiPlatformFanOutModal'; // Added this import
import { useDraggable, useDroppable, DndContext, DragOverlay, DragEndEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useLanguage } from '../../../context/LanguageContext';

// --- Local DnD Wrappers ---
const DraggablePostCard = ({ post, children }: { post: SocialPost; children: React.ReactNode }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: post.id,
        data: { post }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : undefined,
        opacity: isDragging ? 0.8 : 1,
    } : undefined;

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="touch-none mb-3">
            {/* mb-3 for gap in column */}
            {children}
        </div>
    );
};

const DroppableColumn = ({ id, title, icon, color, count, children, className }: { id: string; title: string; icon: string; color: string; count: number; children: React.ReactNode; className?: string }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const { t } = useLanguage();
    return (
        <div className={`flex flex-col min-w-[300px] w-full md:w-[340px] shrink-0 h-full ${className} `}>
            {/* Header */}
            <div className={`flex items-center justify-between mb-3 px-1 sticky top-0 z-20 ${isOver ? 'scale-105' : ''} transition-transform`}>
                <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[20px]`} style={{ color: color }}>{icon}</span>
                    <h3 className="font-bold text-sm text-main uppercase tracking-wide">{title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-surface-hover text-[10px] font-bold text-muted">
                    {count}
                </span>
            </div>

            {/* Drop Zone */}
            <div
                ref={setNodeRef}
                className={`flex-1 rounded-xl p-2 transition-colors border border-transparent overflow-y-auto custom-scrollbar ${isOver ? 'bg-surface-hover/50 border-primary/20' : 'bg-surface/30'} `}
            >
                <div className="space-y-0 h-full"> {/* Space handled by draggable wrapper mb-3 */}
                    {children}
                    {count === 0 && (
                        <div className="h-32 border border-dashed border-surface rounded-xl flex items-center justify-center text-muted bg-card/30 opacity-60">
                            <span className="text-xs">{t('social.kanban.dropHere')}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


interface CampaignKanbanViewProps {
    posts: SocialPost[];
    onUpdateStatus: (postId: string, newStatus: string) => void;
    onEditPost: (post: SocialPost) => void;
    onDeletePost: (post: SocialPost, e: React.MouseEvent) => void;
    onReviewAction?: (post: SocialPost, action: 'approve' | 'reject', reason?: string) => Promise<void>;
    onSplitPost?: (originalPost: SocialPost, newPosts: Partial<SocialPost>[]) => Promise<void>;
    onRevertDraft?: (draftPost: SocialPost) => Promise<void>;
}

export const CampaignKanbanView: React.FC<CampaignKanbanViewProps> = ({ posts, onUpdateStatus, onEditPost, onDeletePost, onReviewAction, onSplitPost, onRevertDraft }) => {
    const { t } = useLanguage();
    const [activeDragItem, setActiveDragItem] = React.useState<SocialPost | null>(null);
    const [reviewPost, setReviewPost] = React.useState<SocialPost | null>(null);
    const [fanOutPost, setFanOutPost] = React.useState<SocialPost | null>(null);

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
        let newStatus = over.id as string;

        // Helper: If dropping on a card, find its status/container
        // Note: usage of dnd-kit metadata would be better, but we can look it up
        if (newStatus !== 'Ideas' &&
            newStatus !== 'Draft' &&
            newStatus !== 'In Review' &&
            newStatus !== 'Scheduled' &&
            newStatus !== 'Published') {

            // It's likely a card ID. Find which list it belongs to.
            const overPost = posts.find(p => p.id === newStatus);
            if (overPost) {
                if (overPost.isConcept) newStatus = 'Ideas';
                else newStatus = overPost.status;
            }
        }

        // Don't update if same status
        // Note: We need to check special logic for "Ideas" column (isConcept=true) vs others
        const post = posts.find(p => p.id === postId);
        if (!post) return;

        if (newStatus === 'Ideas') {
            if (post.isConcept) return; // Already concept
            // Dragging a Draft back to Ideas -> Revert
            if (onRevertDraft) {
                onRevertDraft(post);
                return;
            }
        } else {
            if (post.status === newStatus && !post.isConcept) return; // Already in status
        }

        onUpdateStatus(postId, newStatus);
    };

    // Filter Posts for Columns (Exclude Archived)
    const ideas = posts.filter(p => p.isConcept && p.status !== 'Archived');
    const drafts = posts.filter(p => !p.isConcept && p.status === 'Draft');
    const inReview = posts.filter(p => !p.isConcept && p.status === 'In Review');
    const scheduled = posts.filter(p => !p.isConcept && p.status === 'Scheduled');
    const published = posts.filter(p => !p.isConcept && p.status === 'Published');


    return (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full flex overflow-x-auto pb-4 gap-4 px-6 md:px-8">
                {/* 1. Flows / Backlog */}
                <DroppableColumn id="Ideas" title={t('social.kanban.columns.flows')} icon="lightbulb" color="#6366f1" count={ideas.length} className="bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl p-2">
                    {ideas.map(post => (
                        <DraggablePostCard key={post.id} post={post}>
                            <SocialPostCard
                                post={post}
                                onClick={() => {
                                    if (onSplitPost) {
                                        setFanOutPost(post);
                                    } else {
                                        onEditPost(post);
                                    }
                                }}
                                onDelete={(e) => onDeletePost(post, e)}
                                onSplit={onSplitPost ? (e) => setFanOutPost(post) : undefined}
                                showStatus={false}
                                className="w-full"
                            />
                        </DraggablePostCard>
                    ))}
                </DroppableColumn>

                {/* 2. Drafting */}
                <DroppableColumn id="Draft" title={t('social.kanban.columns.drafting')} icon="edit_note" color="#64748b" count={drafts.length}>
                    {drafts.map(post => (
                        <DraggablePostCard key={post.id} post={post}>
                            <SocialPostCard
                                post={post}
                                onClick={() => onEditPost(post)}
                                onDelete={(e) => onDeletePost(post, e)}
                                showStatus={false}
                                className="w-full"
                            />
                        </DraggablePostCard>
                    ))}
                </DroppableColumn>

                {/* 3. In Review */}
                <DroppableColumn id="In Review" title={t('social.kanban.columns.inReview')} icon="rate_review" color="#f59e0b" count={inReview.length}>
                    {inReview.map(post => (
                        <DraggablePostCard key={post.id} post={post}>
                            <SocialPostCard
                                post={post}
                                onClick={() => setReviewPost(post)}
                                onDelete={(e) => onDeletePost(post, e)}
                                showStatus={false}
                                className="w-full"
                            />
                        </DraggablePostCard>
                    ))}
                </DroppableColumn>

                {/* 4. Scheduled */}
                <DroppableColumn id="Scheduled" title={t('social.kanban.columns.scheduled')} icon="event" color="#f97316" count={scheduled.length}>
                    {scheduled.map(post => (
                        <DraggablePostCard key={post.id} post={post}>
                            <SocialPostCard
                                post={post}
                                onClick={() => onEditPost(post)}
                                onDelete={(e) => onDeletePost(post, e)}
                                showStatus={true}
                                className="w-full"
                            />
                        </DraggablePostCard>
                    ))}
                </DroppableColumn>

                {/* 5. Published */}
                <DroppableColumn id="Published" title={t('social.kanban.columns.published')} icon="rocket_launch" color="#10b981" count={published.length}>
                    {published.map(post => (
                        <DraggablePostCard key={post.id} post={post}>
                            <SocialPostCard
                                post={post}
                                onClick={() => onEditPost(post)}
                                onDelete={(e) => onDeletePost(post, e)}
                                showStatus={false} // Implied by column
                                className="w-full opacity-90 hover:opacity-100"
                            />
                        </DraggablePostCard>
                    ))}
                </DroppableColumn>
            </div>

            <DragOverlay>
                {activeDragItem ? (
                    <SocialPostCard
                        post={activeDragItem}
                        className="w-[340px] shadow-2xl opacity-90 rotate-2 cursor-grabbing"
                    />
                ) : null}
            </DragOverlay>

            {reviewPost && (
                <ReviewPostModal
                    post={reviewPost}
                    isOpen={!!reviewPost}
                    onClose={() => setReviewPost(null)}
                    onApprove={async (p) => {
                        if (onReviewAction) await onReviewAction(p, 'approve');
                        setReviewPost(null);
                    }}
                    onReject={async (p, reason) => {
                        if (onReviewAction) await onReviewAction(p, 'reject', reason);
                        setReviewPost(null);
                    }}
                />
            )}

            {fanOutPost && onSplitPost && (
                <MultiPlatformFanOutModal
                    post={fanOutPost}
                    isOpen={!!fanOutPost}
                    onClose={() => setFanOutPost(null)}
                    onSubmit={onSplitPost}
                />
            )}
        </DndContext>
    );
};
