import React, { useState, useEffect, useRef } from 'react';
import { Comment } from '../types';
import { addComment, subscribeComments, deleteComment } from '../services/dataService';
import { auth } from '../services/firebase';
import { toMillis } from '../utils/time';
import { Button } from './ui/Button';

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
}

export const CommentSection: React.FC<CommentSectionProps> = ({ projectId, targetId, targetType }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const user = auth.currentUser;
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = subscribeComments(projectId, targetId, (data) => {
            setComments(data);
            setLoading(false);
            // Scroll to bottom on initial load or new comment? 
            // scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
        return () => unsubscribe();
    }, [projectId, targetId]);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        try {
            await addComment(projectId, targetId, targetType, newComment.trim());
            setNewComment('');
        } catch (e) {
            console.error('Failed to add comment', e);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (confirm('Delete this comment?')) {
            await deleteComment(commentId, projectId);
        }
    };

    if (loading) return <div className="text-xs text-[var(--color-text-subtle)]">Loading comments...</div>;

    return (
        <div className="flex flex-col h-full bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] overflow-hidden">
            <div className="p-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-card)]">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">chat</span>
                    Comments ({comments.length})
                </h3>
            </div>

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
                                    {user?.uid === comment.userId && (
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
                    <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg p-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] resize-none min-h-[40px] max-h-[120px]"
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
                                ? 'bg-[var(--color-primary)] text-white hover:opacity-90'
                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] cursor-not-allowed'}
                        `}
                    >
                        <span className="material-symbols-outlined text-[20px]">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
