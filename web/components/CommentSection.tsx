import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Comment } from '../types';
import { addComment, subscribeComments, deleteComment, subscribeTenantUsers } from '../services/dataService';
import { getProjectMembers } from '../services/domain/projectsService';
import { getUserProfile } from '../services/domain/usersService';
import { auth } from '../services/firebase';
import { toMillis } from '../utils/time';
import { Button } from './ui/Button';
import { getProjectGroups } from '../services/projectGroupService';
import { useArrowReplacement } from '../hooks/useArrowReplacement';
import { getWorkspaceRoles } from '../services/rolesService';
import { useLanguage } from '../context/LanguageContext';
import { initialOf } from '../utils/initials';
import { resolveActiveTenantId } from '../services/domain/authService';
import { subscribeParentFiles, uploadFiles, type FileItem } from '../services/filesService';
import { FileRow } from './files/FileRow';
import { useFileDrop, useThumbnailUrls } from './files/fileHooks';
import { useFileActions } from './files/useFileActions';
import { useUploadFeedback } from './files/FileAttachments';
import { AiFieldAssist } from './ai/AiFieldAssist';

// Simple time formatter if date-fns is not available or to reduce deps
const timeAgo = (date: any, t: (key: string) => string) => {
    const millis = toMillis(date);
    if (!millis) return '';
    const now = Date.now();
    const diff = now - millis;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('comments.justNow');
    if (minutes < 60) return t('comments.minutesAgo').replace('{n}', String(minutes));
    if (hours < 24) return t('comments.hoursAgo').replace('{n}', String(hours));
    return t('comments.daysAgo').replace('{n}', String(days));
};

interface CommentSectionProps {
    projectId: string;
    targetId: string;
    targetType: 'task' | 'initiative';
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
    const { t } = useLanguage();
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
    const user = auth.currentUser;
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Attachments: pending files go up after the comment exists (parent = the comment).
    const resolvedTenantId = resolveActiveTenantId(tenantId) || '';
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [sending, setSending] = useState(false);
    const [commentFiles, setCommentFiles] = useState<FileItem[]>([]);
    const reportFailures = useUploadFeedback();
    useEffect(() => {
        if (!resolvedTenantId) return undefined;
        return subscribeParentFiles({ tenantId: resolvedTenantId, projectId, rootId: targetId }, (files) => (
            setCommentFiles(files.filter((file) => file.parent.type === 'comment' && file.status === 'ready'))
        ));
    }, [resolvedTenantId, projectId, targetId]);
    const commentThumbs = useThumbnailUrls(resolvedTenantId, commentFiles);
    const fileActions = useFileActions({ tenantId: resolvedTenantId, files: commentFiles });
    const composerDrop = useFileDrop((files) => setPendingFiles((prev) => [...prev, ...files]), sending);

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
        if (!newComment.trim() && !pendingFiles.length) return;
        const content = newComment.trim();
        const files = pendingFiles;
        setSending(true);
        try {
            // Mention (`@Name`) and comment notifications are created server-side by onCommentCreated.
            const commentId = await addComment(projectId, targetId, targetType, content, tenantId);
            setNewComment('');
            setPendingFiles([]);
            if (files.length && resolvedTenantId) {
                const failures = await uploadFiles({
                    tenantId: resolvedTenantId,
                    parent: { type: 'comment', id: commentId, projectId, rootType: targetType, rootId: targetId, title: targetTitle },
                    files,
                });
                reportFailures(failures);
            }
        } catch (e) {
            console.error('Failed to add comment', e);
        } finally {
            setSending(false);
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

    const enhancedHandleInput = useArrowReplacement(handleInput);

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

    if (loading) return <div className="text-sm text-[var(--color-text-muted)] animate-pulse py-4">{t('comments.loading')}</div>;

    return (
        <div className="flex flex-col gap-6">
            {!hideHeader && (
                <div className="pb-2 border-b border-[var(--color-surface-border)]">
                    <h3 className="text-base font-bold flex items-center gap-2 text-[var(--color-text-main)]">
                        <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">chat</span>
                        {t('comments.heading').replace('{count}', String(comments.length))}
                    </h3>
                </div>
            )}

            <div className="flex flex-col gap-6">
                {comments.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-[var(--color-text-muted)] text-sm font-medium">
                        <span className="material-symbols-outlined text-[18px]">forum</span>
                        {t('taskDetail.comments.empty')}
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-4 group">
                            <div
                                className="size-9 rounded-full bg-cover bg-center shrink-0 ring-1 ring-[var(--color-surface-border)]"
                                style={{
                                    backgroundImage: comment.userPhotoURL
                                        ? `url("${comment.userPhotoURL}")`
                                        : 'none',
                                    backgroundColor: 'var(--color-surface-hover)'
                                }}
                            >
                                {!comment.userPhotoURL && (
                                    <div className="flex items-center justify-center w-full h-full text-[12px] font-bold text-[var(--color-text-subtle)]">
                                        {initialOf(comment.userDisplayName, 'U')}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[var(--color-text-main)] truncate">
                                        {comment.userDisplayName}
                                    </span>
                                    <span className="text-[12px] font-medium text-[var(--color-text-subtle)]">
                                        {timeAgo(comment.createdAt, t)}
                                    </span>
                                    {(isProjectOwner || user?.uid === comment.userId) && (
                                        <button aria-label={t('comments.delete')}
                                            onClick={() => handleDelete(comment.id)}
                                            className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-error transition-opacity"
                                            title={t('comments.delete')}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    )}
                                </div>
                                <div className="text-[15px] leading-relaxed text-[var(--color-text-main)] whitespace-pre-wrap">
                                    {(() => {
                                        const sortedTargets = [...mentionTargets].sort((a, b) => b.name.length - a.name.length);
                                        if (sortedTargets.length === 0) return comment.content;

                                        const names = sortedTargets.map(t => t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
                                        const regex = new RegExp(`(@(?:${names})(?:\\s|[.,!?;:]|$))`, 'g');

                                        return comment.content.split(regex).map((part, i) => {
                                            if (part.startsWith('@')) {
                                                return <span key={i} className="font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-1 py-0.5 rounded-md">{part}</span>;
                                            }
                                            return part;
                                        });
                                    })()}
                                </div>
                                {commentFiles.some((file) => file.parent.id === comment.id) && (
                                    <div className="comment-files">
                                        {commentFiles.filter((file) => file.parent.id === comment.id).map((file) => (
                                            <FileRow
                                                key={file.id}
                                                file={file}
                                                thumbUrl={commentThumbs[file.id]}
                                                options={fileActions.optionsFor(file)}
                                                onAction={(value) => void fileActions.handleAction(file, value)}
                                                onOpen={() => void fileActions.handleAction(file, 'preview')}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={scrollRef} />
            </div>

            <div className="relative mt-2">
                {mentionMenuOpen && filteredTargets.length > 0 && (
                    <div className="absolute bottom-[calc(100%+8px)] left-0 w-64 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 max-h-48 overflow-y-auto">
                        <div className="p-1">
                            {filteredTargets.map((target, idx) => (
                                <button
                                    key={target.id}
                                    onClick={() => insertMention(target)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left ${idx === mentionIndex ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)]'}`}
                                >
                                    {target.type === 'user' ? (
                                        <div className="size-5 rounded-full bg-[var(--color-surface-hover)] overflow-hidden shrink-0">
                                            {target.photoURL ? <img src={target.photoURL} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center text-[10px] font-bold">{target.name[0]}</div>}
                                        </div>
                                    ) : target.type === 'group' ? (
                                        <div className="size-5 rounded bg-primary/15 text-primary flex items-center justify-center shrink-0">
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
                                    {target.type === 'group' && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">{t('comments.group')}</span>}
                                    {target.type === 'role' && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">{t('comments.role')}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div
                    className="comment-composer flex flex-col gap-2 p-1.5 border border-[var(--color-surface-border)] rounded-xl bg-[var(--color-surface-hover)] transition-colors focus-within:border-[var(--color-surface-border-hover)] focus-within:bg-[var(--color-surface-card)]"
                    data-dragging={composerDrop.isDragging ? 'true' : 'false'}
                    {...composerDrop.dropProps}
                    onPaste={composerDrop.onPaste}
                >
                    <AiFieldAssist textareaRef={textareaRef} value={newComment} onApply={setNewComment} field="comment" itemTitle={targetTitle !== 'item' ? targetTitle : undefined}>
                        <textarea
                            ref={textareaRef}
                            value={newComment}
                            onChange={enhancedHandleInput}
                            placeholder={t('comments.placeholder')}
                            className="flex-1 min-h-[44px] max-h-[160px] p-2.5 text-[15px] bg-transparent border-0 outline-none focus:ring-0 focus:outline-none resize-none w-full text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]"
                            rows={1}
                            onKeyDown={handleKeyDown}
                        />
                    </AiFieldAssist>
                    {pendingFiles.length > 0 && (
                        <div className="comment-composer__pending">
                            {pendingFiles.map((file, index) => (
                                <span key={`${file.name}-${index}`} className="comment-composer__chip motion-pop-in">
                                    <span className="material-symbols-outlined" aria-hidden="true">draft</span>
                                    <span className="comment-composer__chip-name">{file.name}</span>
                                    <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))} aria-label={t('files.comment.remove').replace('{name}', file.name)}>
                                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex justify-between items-center px-2 pb-1">
                        <div className="flex items-center gap-1">
                            <button type="button" className="comment-composer__attach" onClick={composerDrop.openPicker} aria-label={t('files.comment.attach')} title={t('files.comment.attach')}>
                                <span className="material-symbols-outlined" aria-hidden="true">attach_file</span>
                            </button>
                            {composerDrop.input}
                        </div>
                        <button
                            onClick={handleAddComment}
                            disabled={sending || (!newComment.trim() && !pendingFiles.length)}
                            className={`
                                h-8 px-4 rounded-md flex items-center justify-center transition-all text-sm font-bold
                                ${(newComment.trim() || pendingFiles.length) && !sending
                                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)] hover:opacity-90 shadow-sm'
                                    : 'bg-[var(--color-surface-card)] text-[var(--color-text-muted)] cursor-not-allowed'}
                            `}
                        >
                            {t('common.send')}
                        </button>
                    </div>
                </div>
            </div>

            {fileActions.modals}
            {commentToDelete && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)] animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">{t('comments.deleteTitle')}</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {t('comments.deleteBody')}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost" onClick={() => setCommentToDelete(null)}>{t('common.cancel')}</Button>
                                <Button variant="danger" onClick={confirmDelete}>{t('common.delete')}</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
