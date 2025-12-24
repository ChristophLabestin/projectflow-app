import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Comment } from '../types';
import { addComment, subscribeComments, deleteComment } from '../services/dataService';
import { auth } from '../services/firebase';
import { toMillis } from '../utils/time';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';

// Simple time formatter if date-fns is not available or to reduce deps
const timeAgo = (date: any) => {
    const millis = toMillis(date);
    if (!millis) return '';
    const now = Date.now();
    const diff = now - millis;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

interface CommentSectionProps {
    projectId: string;
    targetId: string;
    targetType: 'task' | 'issue' | 'idea';
    tenantId?: string;
    isProjectOwner?: boolean;
    hideHeader?: boolean;
    onCountChange?: (count: number) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ projectId, targetId, targetType, tenantId, isProjectOwner = false, hideHeader = false, onCountChange }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
    const user = auth.currentUser;
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeComments(projectId, targetId, (data) => {
            setComments(data);
            setLoading(false);
            if (onCountChange) onCountChange(data.length);
        }, tenantId);
        return () => unsubscribe();
    }, [projectId, targetId, tenantId, onCountChange]);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            await addComment(projectId, targetId, targetType, newComment.trim(), tenantId);
            setNewComment('');
        } catch (e) {
            console.error('Failed to add comment', e);
        }
    };

    const handleDelete = (commentId: string) => {
        setCommentToDelete(commentId);
    };

    const confirmDelete = async () => {
        if (commentToDelete) {
            await deleteComment(commentToDelete, projectId, tenantId);
            setCommentToDelete(null);
        }
    };

    if (loading) return <div className="text-xs text-[var(--color-text-subtle)]">Loading comments...</div>;

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden">
            {!hideHeader && (
                <div className="p-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)]">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">chat</span>
                        Comments ({comments.length})
                    </h3>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                {comments.length === 0 ? (
                    <div className="text-center py-8 text-[var(--color-text-subtle)] text-sm">
                        No comments yet. Be the first to start the discussion!
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-3 group">
                            <div
                                className="size-8 rounded-full bg-cover bg-center border border-[var(--color-surface-border)] shrink-0"
                                style={{
                                    backgroundImage: comment.userPhotoURL
                                        ? `url("${comment.userPhotoURL}")`
                                        : 'none',
                                    backgroundColor: '#e5e7eb' // Fallback color
                                }}
                            >
                                {!comment.userPhotoURL && (
                                    <div className="flex items-center justify-center w-full h-full text-[10px] font-bold text-gray-500">
                                        {(comment.userDisplayName || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold text-[var(--color-text-main)] truncate">
                                        {comment.userDisplayName}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-text-subtle)]">
                                        {timeAgo(comment.createdAt)}
                                    </span>
                                    {(isProjectOwner || user?.uid === comment.userId) && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-rose-500 transition-opacity"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    )}
                                </div>
                                <div className="text-sm text-[var(--color-text-main)] whitespace-pre-wrap rounded-lg bg-[var(--color-surface-hover)] p-2.5">
                                    {comment.content}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={scrollRef} />
            </div>

            <div className="p-3 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-card)]">
                <div className="flex items-end gap-2">

                    <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 min-h-[40px] max-h-[120px] py-2.5 resize-none"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddComment();
                            }
                        }}
                    />
                    <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className={`
                            p-2 rounded-lg flex items-center justify-center transition-colors
                            ${newComment.trim()
                                ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90'
                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed'}
                        `}
                    >
                        <span className="material-symbols-outlined text-[20px]">send</span>
                    </button>
                </div>
            </div>
            {
                commentToDelete && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)] animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-4 text-center">
                                <h3 className="text-lg font-bold text-[var(--color-text-main)]">Delete Comment?</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    This action cannot be undone.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="ghost" onClick={() => setCommentToDelete(null)}>Cancel</Button>
                                    <Button variant="danger" onClick={confirmDelete}>Delete</Button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
};
