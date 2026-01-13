import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Comment, Member, ProjectGroup } from '../types';
import { addComment, subscribeComments, deleteComment, getProjectMembers, subscribeTenantUsers, getUserProfile, getMembersWithRole } from '../services/dataService';
import { auth } from '../services/firebase';
import { toMillis } from '../utils/time';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { getProjectGroups } from '../services/projectGroupService';
import { getWorkspaceRoles } from '../services/rolesService';
import { notifyMention } from '../services/notificationService';
import { useToast } from '../context/UIContext';

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
    targetTitle?: string; // Descriptive title for notifications
    tenantId?: string;
    isProjectOwner?: boolean;
    hideHeader?: boolean;
    onCountChange?: (count: number) => void;
}

interface MentionTarget {
    id: string;
    name: string;
    type: 'user' | 'group' | 'role';
    photoURL?: string;
    email?: string;
    memberIds?: string[]; // For groups
    color?: string; // For roles
}

export const CommentSection: React.FC<CommentSectionProps> = ({
    projectId,
    targetId,
    targetType,
    targetTitle = 'item', // Fallback
    tenantId,
    isProjectOwner = false,
    hideHeader = false,
    onCountChange
}) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
    const user = auth.currentUser;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { showToast } = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Mention State
    const [mentionTargets, setMentionTargets] = useState<MentionTarget[]>([]);
    const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0); // For keyboard nav

    // Load Data
    useEffect(() => {
        let mounted = true;

        const loadMentions = async () => {
            // 1. Fetch Users
            try {
                const memberIds = await getProjectMembers(projectId, tenantId);
                const targets: MentionTarget[] = [];

                // Fetch profiles
                const profilePromises = memberIds.map(uid => getUserProfile(uid, tenantId));
                const profiles = await Promise.all(profilePromises);

                profiles.forEach((profile, idx) => {
                    const uid = memberIds[idx];
                    targets.push({
                        id: uid,
                        name: profile?.displayName || profile?.email?.split('@')[0] || 'User',
                        type: 'user',
                        photoURL: profile?.photoURL,
                        email: profile?.email
                    });
                });

                try {
                    const groups = await getProjectGroups(projectId, tenantId);
                    groups.forEach(g => {
                        targets.push({
                            id: g.id,
                            name: g.name,
                            type: 'group',
                            photoURL: undefined,
                            memberIds: g.memberIds
                        });
                    });
                } catch (e) {
                    console.error("Failed to load groups for mentions", e);
                }

                // 3. Fetch Workspace Roles
                try {
                    const roles = await getWorkspaceRoles(tenantId);
                    roles.forEach(role => {
                        targets.push({
                            id: role.id,
                            name: role.name,
                            type: 'role',
                            color: role.color,
                            memberIds: [] // Resolved at notification time
                        });
                    });
                } catch (e) {
                    console.error("Failed to load roles for mentions", e);
                }

                if (mounted) {
                    setMentionTargets(targets);
                }
            } catch (e) {
                console.error("Failed to load mention targets", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        const unsubscribeComments = subscribeComments(projectId, targetId, (data) => {
            if (mounted) {
                setComments(data);
                // setLoading(false); // setLoading is now handled by loadMentions finally block
                if (onCountChange) onCountChange(data.length);
            }
        }, tenantId);

        // Sub to tenant users for real-time updates if possible
        let unsubUsers: (() => void) | undefined;
        if (tenantId) {
            unsubUsers = subscribeTenantUsers((users) => {
                // Update users in targets. Complex to merge with groups, let's just re-fetch or reliance on initial load + generic updates is often okay for comments.
                // For now, let's stick to initial load + refresh on mount to keep it simple, as we don't have a unified 'MentionService'.
                // We'll call loadMentions here.
                loadMentions();
            }, tenantId);
        } else {
            loadMentions();
        }

        return () => {
            mounted = false;
            unsubscribeComments();
            if (unsubUsers) unsubUsers();
        };
    }, [projectId, targetId, tenantId, onCountChange]);

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        const content = newComment.trim();
        try {
            const commentId = await addComment(projectId, targetId, targetType, content, tenantId);
            setNewComment('');

            // Handle Mentions and Notifications
            const mentionedUserIds = new Set<string>();
            const rolesToResolve: string[] = [];

            // Match against known targets names explicitly, prioritizing longer names to avoid partial matches
            const sortedTargets = [...mentionTargets].sort((a, b) => b.name.length - a.name.length);

            sortedTargets.forEach(target => {
                const escapedName = target.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // Regex to match @Name followed by space, punctuation, or end of string.
                const regex = new RegExp(`@${escapedName}(\\s|[.,!?;:]|$)`, 'i');

                if (regex.test(content)) {
                    if (target.type === 'user') {
                        mentionedUserIds.add(target.id);
                    } else if (target.type === 'group' && target.memberIds) {
                        target.memberIds.forEach(uid => mentionedUserIds.add(uid));
                    } else if (target.type === 'role') {
                        // Role members will be resolved below
                        rolesToResolve.push(target.id);
                    }
                }
            });

            // Resolve role members
            for (const roleId of rolesToResolve) {
                const roleMembers = await getMembersWithRole(projectId, roleId, tenantId);
                roleMembers.forEach(uid => mentionedUserIds.add(uid));
            }

            // Send Notifications
            const currentUserId = auth.currentUser?.uid;
            for (const userId of mentionedUserIds) {
                if (userId === currentUserId) {
                    continue;
                }

                await notifyMention(
                    userId,
                    targetTitle || (targetType.charAt(0).toUpperCase() + targetType.slice(1)),
                    targetType,
                    projectId,
                    targetId,
                    commentId,
                    tenantId
                );
                showToast(`Sent mention notification to user`, 'success');
            }

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

    // Mention Logic
    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setNewComment(val);

        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const match = textBeforeCursor.match(/@(\w*)$/);

        if (match) {
            setMentionMenuOpen(true);
            setMentionQuery(match[1]);
            setMentionIndex(0);
        } else {
            setMentionMenuOpen(false);
        }
    };

    const insertMention = (target: MentionTarget) => {
        if (!textareaRef.current) return;

        const cursor = textareaRef.current.selectionStart;
        const text = newComment;
        const textBeforeCursor = text.slice(0, cursor);
        const textAfterCursor = text.slice(cursor);

        const match = textBeforeCursor.match(/@(\w*)$/);
        if (match) {
            const start = match.index!;
            const newText = text.slice(0, start) + `@${target.name} ` + textAfterCursor;
            setNewComment(newText);
            setMentionMenuOpen(false);

            // Restore focus and cursor (approximate)
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    const newCursorPos = start + target.name.length + 2; // +2 for @ and space
                    textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        }
    };

    // Filter targets
    const filteredTargets = mentionTargets.filter(t =>
        t.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionMenuOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(i => (i + 1) % filteredTargets.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(i => (i - 1 + filteredTargets.length) % filteredTargets.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredTargets[mentionIndex]) {
                    insertMention(filteredTargets[mentionIndex]);
                }
            } else if (e.key === 'Escape') {
                setMentionMenuOpen(false);
            }
        } else {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
            }
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
                                    {(() => {
                                        // Match against known target names
                                        const sortedTargets = [...mentionTargets].sort((a, b) => b.name.length - a.name.length);
                                        if (sortedTargets.length === 0) return comment.content;

                                        const names = sortedTargets.map(t => t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                                        const regex = new RegExp(`(@(?:${names})(?:\\s|[.,!?;:]|$))`, 'g');

                                        return comment.content.split(regex).map((part, i) => {
                                            if (part.startsWith('@')) {
                                                return <span key={i} className="font-bold text-indigo-600 dark:text-indigo-400">{part}</span>;
                                            }
                                            return part;
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={scrollRef} />
            </div>

            <div className="p-3 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-card)] relative">
                {/* Mention Popover */}
                {mentionMenuOpen && filteredTargets.length > 0 && (
                    <div className="absolute bottom-full left-3 mb-2 w-64 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto">
                        <div className="p-1">
                            {filteredTargets.map((target, idx) => (
                                <button
                                    key={target.id}
                                    onClick={() => insertMention(target)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${idx === mentionIndex ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)]'}`}
                                >
                                    {target.type === 'user' ? (
                                        <div className="size-5 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                            {target.photoURL ? <img src={target.photoURL} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center text-[8px] font-bold">{target.name[0]}</div>}
                                        </div>
                                    ) : target.type === 'group' ? (
                                        <div className="size-5 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-[12px]">groups</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="size-5 rounded flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: (target.color || '#6366f1') + '20', color: target.color || '#6366f1' }}
                                        >
                                            <span className="material-symbols-outlined text-[12px]">shield_person</span>
                                        </div>
                                    )}
                                    <span className="truncate flex-1 font-medium">{target.name}</span>
                                    {target.type === 'group' && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Group</span>}
                                    {target.type === 'role' && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Role</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex items-end gap-2">
                    <Textarea
                        ref={textareaRef}
                        value={newComment}
                        onChange={handleInput}
                        placeholder="Write a comment... (Type @ to mention)"
                        className="flex-1 min-h-[40px] max-h-[120px] py-2.5 resize-none"
                        rows={1}
                        onKeyDown={handleKeyDown}
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
