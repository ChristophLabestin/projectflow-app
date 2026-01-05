import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Idea } from '../../types';
import { toggleIdeaLike, toggleIdeaDislike } from '../../services/dataService';
import { auth } from '../../services/firebase';
import { useState, useEffect } from 'react';
import { Portal } from '../ui/Portal';
import { FlowComments } from './FlowComments';
import { useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface FlowCardProps {
    flow: Idea;
    onClick: (flow: Idea) => void;
    isOverlay?: boolean;
}



const TYPE_COLORS: Record<string, string> = {
    'Feature': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    'Product': 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    'Task': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'Marketing': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    'Admin': 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
    'UI': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    'UX': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    'Architecture': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    'Research': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    'default': 'bg-primary/10 text-main',
};

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

    // Compact type colors
    const typeColor = TYPE_COLORS[flow.type] || TYPE_COLORS['default'];
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

    // --- Optimistic UI State ---
    const user = auth.currentUser;
    const initialLiked = (flow.likedBy || []).includes(user?.uid || '');
    const initialDisliked = (flow.dislikedBy || []).includes(user?.uid || '');
    const initialLikeCount = (flow.likedBy || []).length;
    const initialDislikeCount = (flow.dislikedBy || []).length;

    const [liked, setLiked] = useState(initialLiked);
    const [disliked, setDisliked] = useState(initialDisliked);
    const [likeCount, setLikeCount] = useState(initialLikeCount);
    const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);

    // Sync if prop changes (e.g. from manual refresh)
    useEffect(() => {
        setLiked((flow.likedBy || []).includes(user?.uid || ''));
        setDisliked((flow.dislikedBy || []).includes(user?.uid || ''));
        setLikeCount((flow.likedBy || []).length);
        setDislikeCount((flow.dislikedBy || []).length);
    }, [flow.likedBy, flow.dislikedBy, user?.uid]);

    // --- Comment Popover State ---
    const [showComments, setShowComments] = useState(false);
    const commentButtonRef = useRef<HTMLButtonElement>(null);
    const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!flow.projectId) return;

        const wasLiked = liked;
        const wasDisliked = disliked;

        // Toggle Like
        setLiked(!wasLiked);

        // Update counts
        if (wasLiked) {
            setLikeCount(prev => Math.max(0, prev - 1));
        } else {
            setLikeCount(prev => prev + 1);
        }

        // If it was disliked, remove dislike
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

        // Toggle Dislike
        setDisliked(!wasDisliked);

        // Update counts
        if (wasDisliked) {
            setDislikeCount(prev => Math.max(0, prev - 1));
        } else {
            setDislikeCount(prev => prev + 1);
        }

        // If it was liked, remove like
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

        // Calculate Position
        if (commentButtonRef.current) {
            const rect = commentButtonRef.current.getBoundingClientRect();
            // Position: bottom-right of button, unless too close to screen edge
            setPopoverPosition({
                top: rect.bottom + 8,
                left: rect.left
            });
            setShowComments(true);
        }
    };

    // Close popover when clicking outside
    useEffect(() => {
        if (!showComments) return;
        const handleClickOutside = (e: MouseEvent) => {
            // If click is not in popover (we need a ref for modal content, but simplified: global click closes it)
            // Ideally we check if target is inside popover.
            // For now, let's look for a specific class or assume any click outside the button closes it.
            // actually, if we click IN the popover we shouldn't close.
            const target = e.target as Element;
            if (target.closest('.flow-comment-popover')) return;
            if (target.closest('.comment-trigger-btn')) return; // Check button ref
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
                className="touch-none group/card block" /* Changed to block to simplify */
                onClick={(e) => {
                    if (!isDragging) onClick(flow);
                }}
            >
                <div className={`
                    relative bg-surface-paper rounded-xl
                    border border-surface
                    shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-none
                    transition-all duration-200 ease-out
                    hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_16px_-4px_rgba(0,0,0,0.3)]
                    hover:-translate-y-0.5 hover:border-primary/30
                    ${isOverlay ? 'shadow-2xl scale-105 rotate-2 cursor-grabbing ring-1 ring-primary' : 'cursor-grab active:cursor-grabbing'}
                `}>
                    <div className="p-3 flex flex-col gap-2">
                        {/* Header: Title & AI Badge */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                {/* Tags Row */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeColor}`}>
                                        {flow.type === 'Social'
                                            ? (flow.socialType === 'campaign' ? t('flows.badge.campaign') : t('flows.badge.post'))
                                            : (flowTypeLabels[flow.type] || flow.type)}
                                    </span>
                                    {flow.generated && (
                                        <span className="text-[9px] font-medium text-indigo-500 bg-indigo-500/5 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <span className="material-symbols-outlined text-[10px]">auto_awesome</span>
                                            {t('flows.badge.ai')}
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-semibold text-main text-sm leading-snug line-clamp-2 group-hover/card:text-primary transition-colors">
                                    {flow.title}
                                </h4>
                            </div>
                        </div>

                        {/* Description */}
                        {flow.description && (
                            <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                                {flow.description}
                            </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1">
                                {/* Like/Dislike Buttons */}
                                <button
                                    className={`flex items-center gap-1 p-1 rounded hover:bg-surface-hover transition-colors ${liked
                                        ? 'text-emerald-500'
                                        : 'text-subtle hover:text-main'
                                        }`}
                                    onClick={handleLike}
                                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${liked ? 'filled' : ''}`}>
                                        thumb_up
                                    </span>
                                    {likeCount > 0 && (
                                        <span className="text-[10px] font-medium">{likeCount}</span>
                                    )}
                                </button>

                                <button
                                    className={`flex items-center gap-1 justify-center p-1 rounded hover:bg-surface-hover transition-colors ${disliked
                                        ? 'text-rose-500'
                                        : 'text-subtle hover:text-main'
                                        }`}
                                    onClick={handleDislike}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${disliked ? 'filled' : ''}`}>
                                        thumb_down
                                    </span>
                                    {dislikeCount > 0 && (
                                        <span className="text-[10px] font-medium">{dislikeCount}</span>
                                    )}
                                </button>

                                {/* Comments Button */}
                                <button
                                    ref={commentButtonRef}
                                    className={`comment-trigger-btn flex items-center gap-1 p-1 rounded hover:bg-surface-hover transition-colors ml-1 ${showComments ? 'text-primary bg-primary/10' : 'text-subtle hover:text-main'
                                        }`}
                                    onClick={handleCommentClick}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <span className={`material-symbols-outlined text-[14px] ${showComments ? 'filled' : ''}`}>chat_bubble</span>
                                    {(flow.comments || 0) > 0 && (
                                        <span className="text-[10px] font-medium">{flow.comments}</span>
                                    )}
                                </button>
                            </div>

                            {/* Impact/Effort */}
                            {(flow.impact || flow.effort) && (
                                <div className="flex items-center gap-1">
                                    {flow.impact && (
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${flow.impact === 'High' ? 'bg-emerald-500/10 text-emerald-600' :
                                            flow.impact === 'Medium' ? 'bg-amber-500/10 text-amber-600' :
                                                'bg-slate-500/10 text-slate-500'
                                            }`}>
                                            {impactLabel}:{flow.impact[0]}
                                        </span>
                                    )}
                                    {flow.effort && (
                                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${flow.effort === 'High' ? 'bg-rose-500/10 text-rose-600' :
                                            flow.effort === 'Medium' ? 'bg-amber-500/10 text-amber-600' :
                                                'bg-emerald-500/10 text-emerald-600'
                                            }`}>
                                            {effortLabel}:{flow.effort[0]}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hovering Comment Window */}
            {showComments && (
                <Portal>
                    <div
                        className="flow-comment-popover fixed z-50 w-80 bg-surface-paper rounded-xl border border-surface shadow-xl animate-in fade-in zoom-in-95 duration-100 p-4"
                        style={{
                            top: popoverPosition.top,
                            left: popoverPosition.left,
                            // Adjust if going off screen (simplified collision detection)
                            transform: 'translateY(8px)'
                        }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3 border-b border-surface pb-2">
                            <h4 className="text-xs font-bold text-main">{t('flows.comments.title')}</h4>
                            <button onClick={() => setShowComments(false)} className="text-muted hover:text-main">
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>

                        {/* Use the compact comments view inside a scrollable container. */}
                        <div className="max-h-64 overflow-y-auto">
                            <FlowComments projectId={flow.projectId || ''} flowId={flow.id} compact />
                        </div>
                    </div>
                </Portal>
            )}
        </>
    );
};
