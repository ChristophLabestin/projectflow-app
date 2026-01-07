import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Comment } from '../../types';
import { getIdeaComments, addIdeaComment } from '../../services/dataService';
import { auth } from '../../services/firebase';
import { Button } from '../common/Button/Button';
import { TextArea } from '../common/Input/TextArea';
import { useLanguage } from '../../context/LanguageContext';

interface FlowCommentsProps {
    projectId: string;
    flowId: string;
    compact?: boolean;
}

export const FlowComments: React.FC<FlowCommentsProps> = ({ projectId, flowId, compact }) => {
    const { t, dateLocale, dateFormat } = useLanguage();
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
        return format(date, `${dateFormat} p`, { locale: dateLocale });
    };

    return (
        <div className={`flow-comments ${compact ? 'flow-comments--compact' : ''}`}>
            {!compact && (
                <div className="flow-comments__header">
                    <h3>
                        <span className="material-symbols-outlined">chat</span>
                        {t('flows.comments.title')}
                    </h3>
                    <span className="flow-comments__count">
                        {t('flows.comments.count').replace('{count}', String(comments.length))}
                    </span>
                </div>
            )}

            {/* Comment List */}
            <div className="flow-comments__list">
                {loading ? (
                    <div className="flow-comments__state">{t('flows.comments.loading')}</div>
                ) : comments.length === 0 ? (
                    <div className="flow-comments__empty">
                        <p>{t('flows.comments.empty')}</p>
                    </div>
                ) : (
                    comments.map(comment => (
                        <div key={comment.id} className="flow-comments__item">
                            <div className="flow-comments__avatar">
                                {comment.userPhotoURL ? (
                                    <img src={comment.userPhotoURL} alt={comment.userDisplayName} />
                                ) : (
                                    <div className="flow-comments__avatar-fallback">
                                        {(comment.userDisplayName || t('user.fallbackInitial')).charAt(0)}
                                    </div>
                                )}
                            </div>
                            <div className="flow-comments__content">
                                <div className="flow-comments__content-header">
                                    <span>{comment.userDisplayName || t('user.fallbackName')}</span>
                                    <span className="flow-comments__timestamp">
                                        {formatDate(comment.createdAt)}
                                    </span>
                                </div>
                                <p>{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Comment Input */}
            <div className="flow-comments__composer">
                <div className="flow-comments__avatar flow-comments__avatar--self">
                    <span>{auth.currentUser?.displayName?.[0] || t('user.fallbackInitial')}</span>
                </div>
                <form onSubmit={handleSubmit} className="flow-comments__form">
                    <TextArea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder={t('flows.comments.placeholder')}
                        rows={3}
                        className="flow-comments__field"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />
                    <div className="flow-comments__actions">
                        <span>{t('flows.comments.hint')}</span>
                        <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            disabled={!newComment.trim() || submitting}
                            isLoading={submitting}
                        >
                            {t('flows.comments.submit')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
