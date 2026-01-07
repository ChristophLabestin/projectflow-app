import React, { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Idea } from '../../types';
import { toggleIdeaLike, toggleIdeaDislike } from '../../services/dataService';
import { auth } from '../../services/firebase';
import { Portal } from '../ui/Portal';
import { FlowComments } from './FlowComments';
import { useLanguage } from '../../context/LanguageContext';
import { TYPE_TONES } from './constants';

interface FlowCardProps {
    flow: Idea;
    onClick: (flow: Idea) => void;
    isOverlay?: boolean;
}

export const FlowCard: React.FC<FlowCardProps> = ({ flow, onClick, isOverlay }) => {
    const { t } = useLanguage();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: flow.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const typeTone = TYPE_TONES[flow.type] || TYPE_TONES.default;
    const flowTypeLabels: Record<string, string> = {
        Feature: t('flows.type.feature'),
        Product: t('flows.type.product'),
        Marketing: t('flows.type.marketing'),
        Social: t('flows.type.social'),
        Moonshot: t('flows.type.moonshot'),
        Optimization: t('flows.type.optimization'),
    };

    const impactLabel = t('flows.badges.impactShort');
    const effortLabel = t('flows.badges.effortShort');

    const user = auth.currentUser;
    const initialLiked = (flow.likedBy || []).includes(user?.uid || '');
    const initialDisliked = (flow.dislikedBy || []).includes(user?.uid || '');
    const initialLikeCount = (flow.likedBy || []).length;
    const initialDislikeCount = (flow.dislikedBy || []).length;

    const [liked, setLiked] = useState(initialLiked);
    const [disliked, setDisliked] = useState(initialDisliked);
    const [likeCount, setLikeCount] = useState(initialLikeCount);
    const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);

    useEffect(() => {
        setLiked((flow.likedBy || []).includes(user?.uid || ''));
        setDisliked((flow.dislikedBy || []).includes(user?.uid || ''));
        setLikeCount((flow.likedBy || []).length);
        setDislikeCount((flow.dislikedBy || []).length);
    }, [flow.likedBy, flow.dislikedBy, user?.uid]);

    const [showComments, setShowComments] = useState(false);
    const commentButtonRef = useRef<HTMLButtonElement>(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!flow.projectId) return;

        const wasLiked = liked;
        const wasDisliked = disliked;

        setLiked(!wasLiked);

        if (wasLiked) {
            setLikeCount(prev => Math.max(0, prev - 1));
        } else {
            setLikeCount(prev => prev + 1);
        }

        if (wasDisliked) {
            setDisliked(false);
            setDislikeCount(prev => Math.max(0, prev - 1));
        }

        toggleIdeaLike(flow.id, flow.projectId);
    };

    const handleDislike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!flow.projectId) return;

        const wasDisliked = disliked;
        const wasLiked = liked;

        setDisliked(!wasDisliked);

        if (wasDisliked) {
            setDislikeCount(prev => Math.max(0, prev - 1));
        } else {
            setDislikeCount(prev => prev + 1);
        }

        if (wasLiked) {
            setLiked(false);
            setLikeCount(prev => Math.max(0, prev - 1));
        }

        toggleIdeaDislike(flow.id, flow.projectId);
    };

    const handleCommentClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (showComments) {
            setShowComments(false);
            return;
        }

        if (commentButtonRef.current) {
            const rect = commentButtonRef.current.getBoundingClientRect();
            setPopoverPosition({
                top: rect.bottom + 8,
                left: rect.left
            });
            setShowComments(true);
        }
    };

    useEffect(() => {
        if (!showComments) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Element;
            if (target.closest('.flow-comment-popover')) return;
            if (target.closest('.flow-card__reaction--comment')) return;
            setShowComments(false);
        };
        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [showComments]);

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`flow-card ${isOverlay ? 'flow-card--overlay' : ''} ${isDragging ? 'is-dragging' : ''}`}
                onClick={() => {
                    if (!isDragging) onClick(flow);
                }}
            >
                <div className="flow-card__body">
                    <div className="flow-card__tags">
                        <span className={`flow-tag flow-tag--${typeTone}`}>
                            {flow.type === 'Social'
                                ? (flow.socialType === 'campaign' ? t('flows.badge.campaign') : t('flows.badge.post'))
                                : (flowTypeLabels[flow.type] || flow.type)}
                        </span>
                        {flow.generated && (
                            <span className="flow-tag flow-tag--ai">
                                <span className="material-symbols-outlined">auto_awesome</span>
                                {t('flows.badge.ai')}
                            </span>
                        )}
                    </div>

                    <h4 className="flow-card__title">
                        {flow.title}
                    </h4>

                    {flow.description && (
                        <p className="flow-card__description">{flow.description}</p>
                    )}

                    <div className="flow-card__footer">
                        <div className="flow-card__reactions">
                            <button
                                type="button"
                                className={`flow-card__reaction ${liked ? 'is-active is-like' : ''}`}
                                onClick={handleLike}
                                onPointerDown={(e) => e.stopPropagation()}
                                aria-label={t('flows.reactions.like')}
                            >
                                <span className={`material-symbols-outlined ${liked ? 'filled' : ''}`}>
                                    thumb_up
                                </span>
                                {likeCount > 0 && (
                                    <span className="flow-card__reaction-count">{likeCount}</span>
                                )}
                            </button>

                            <button
                                type="button"
                                className={`flow-card__reaction ${disliked ? 'is-active is-dislike' : ''}`}
                                onClick={handleDislike}
                                onPointerDown={(e) => e.stopPropagation()}
                                aria-label={t('flows.reactions.dislike')}
                            >
                                <span className={`material-symbols-outlined ${disliked ? 'filled' : ''}`}>
                                    thumb_down
                                </span>
                                {dislikeCount > 0 && (
                                    <span className="flow-card__reaction-count">{dislikeCount}</span>
                                )}
                            </button>

                            <button
                                ref={commentButtonRef}
                                type="button"
                                className={`flow-card__reaction flow-card__reaction--comment ${showComments ? 'is-active' : ''}`}
                                onClick={handleCommentClick}
                                onPointerDown={(e) => e.stopPropagation()}
                                aria-label={t('flows.reactions.comments')}
                            >
                                <span className={`material-symbols-outlined ${showComments ? 'filled' : ''}`}>chat_bubble</span>
                                {(flow.comments || 0) > 0 && (
                                    <span className="flow-card__reaction-count">{flow.comments}</span>
                                )}
                            </button>
                        </div>

                        {(flow.impact || flow.effort) && (
                            <div className="flow-card__metrics">
                                {flow.impact && (
                                    <span
                                        className="flow-card__metric"
                                        data-kind="impact"
                                        data-level={flow.impact.toLowerCase()}
                                    >
                                        {impactLabel}:{flow.impact[0]}
                                    </span>
                                )}
                                {flow.effort && (
                                    <span
                                        className="flow-card__metric"
                                        data-kind="effort"
                                        data-level={flow.effort.toLowerCase()}
                                    >
                                        {effortLabel}:{flow.effort[0]}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showComments && (
                <Portal>
                    <div
                        className="flow-comment-popover"
                        style={{
                            top: popoverPosition.top,
                            left: popoverPosition.left,
                            transform: 'translateY(8px)'
                        }}
                    >
                        <div className="flow-comment-popover__header">
                            <h4>{t('flows.comments.title')}</h4>
                            <button
                                type="button"
                                onClick={() => setShowComments(false)}
                                aria-label={t('flows.comments.close')}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flow-comment-popover__body">
                            <FlowComments projectId={flow.projectId || ''} flowId={flow.id} compact />
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
};
