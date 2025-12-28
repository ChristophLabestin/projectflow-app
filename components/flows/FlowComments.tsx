import React, { useState, useEffect } from 'react';
import { Comment } from '../../types';
import { getIdeaComments, addIdeaComment } from '../../services/dataService';
import { auth } from '../../services/firebase';
import { Button } from '../ui/Button';

interface FlowCommentsProps {
    projectId: string;
    flowId: string;
    compact?: boolean;
}

export const FlowComments: React.FC<FlowCommentsProps> = ({ projectId, flowId, compact }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadComments();
    }, [projectId, flowId]);

    const loadComments = async () => {
        try {
            const data = await getIdeaComments(projectId, flowId);
            setComments(data);
        } catch (e) {
            console.error("Failed to load comments", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setSubmitting(true);
        try {
            await addIdeaComment(projectId, flowId, newComment.trim());
            setNewComment('');
            // Reload comments to see new one
            await loadComments();
        } catch (e) {
            console.error("Failed to add comment", e);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        }).format(date);
    };

    return (
        <div className={compact ? "" : "mt-8 pt-8 border-t border-[var(--color-surface-border)]"}>
            {!compact && (
                <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">chat</span>
                    Discussion
                    <span className="text-sm font-normal text-[var(--color-text-muted)] ml-2">({comments.length})</span>
                </h3>
            )}

            {/* Comment List */}
            <div className="space-y-4 mb-6">
                {loading ? (
                    <div className="text-center py-4 text-[var(--color-text-muted)]">Loading comments...</div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-8 bg-[var(--color-surface-paper)] rounded-xl border border-[var(--color-surface-border)] border-dashed">
                        <p className="text-[var(--color-text-muted)] text-sm">No comments yet. Start the discussion!</p>
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flex gap-3 group">
                            <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-surface-hover)] overflow-hidden">
                                {comment.userPhotoURL ? (
                                    <img src={comment.userPhotoURL} alt={comment.userDisplayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)]">
                                        {comment.userDisplayName[0]}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="bg-[var(--color-surface-paper)] rounded-xl p-3 border border-[var(--color-surface-border)]">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-[var(--color-text-main)]">
                                            {comment.userDisplayName}
                                        </span>
                                        <span className="text-[10px] text-[var(--color-text-muted)]">
                                            {formatDate(comment.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-main)] whitespace-pre-wrap leading-relaxed">
                                        {comment.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Comment Input */}
            <div className="flex gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-xs">
                    {auth.currentUser?.displayName?.[0] || 'U'}
                </div>
                <form onSubmit={handleSubmit} className="flex-1">
                    <div className="relative">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            className="w-full bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] rounded-xl p-3 text-sm min-h-[80px] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all resize-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <div className="absolute bottom-2 right-2 flex items-center gap-2">
                            <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:inline">Press Enter to send</span>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={!newComment.trim() || submitting}
                                loading={submitting}
                            >
                                Comment
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
