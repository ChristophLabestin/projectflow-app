import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import {
    subscribeToNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
} from '../services/notificationService';
import { respondToJoinRequest } from '../services/dataService';
import { Button } from './ui/Button';
import { Notification } from '../types';
import { useToast } from '../context/UIContext';

interface NotificationDropdownProps {
    position?: 'topbar' | 'sidebar';
}

export const NotificationDropdown = ({ position = 'topbar' }: NotificationDropdownProps) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const user = auth.currentUser;
    const unreadCount = notifications.filter(n => !n.read).length;

    // Subscribe to notifications
    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
            setNotifications(notifs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markNotificationAsRead(notification.id);
        }

        // Navigate to the relevant item
        let path = '';
        if (notification.taskId && notification.projectId) {
            path = `/project/${notification.projectId}/tasks/${notification.taskId}`;
        } else if (notification.issueId && notification.projectId) {
            path = `/project/${notification.projectId}/issues/${notification.issueId}`;
        } else if (notification.projectId) {
            path = `/project/${notification.projectId}`;
        }

        if (path) {
            navigate(path);
            setIsOpen(false);
        }
    };

    const handleMarkAllAsRead = async () => {
        if (!user) return;
        await markAllNotificationsAsRead(user.uid);
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'task_assigned':
            case 'subtask_assigned':
                return 'task_alt';
            case 'issue_assigned':
                return 'bug_report';
            case 'comment_added':
            case 'comment_mention':
                return 'comment';
            case 'project_invite':
            case 'project_shared':
            case 'project_join_request':
            case 'project_join_request_accepted':
                return 'folder_shared';
            case 'project_join_request_denied':
                return 'block';
            default:
                return 'notifications';
        }
    };

    const handleJoinResponse = async (e: React.MouseEvent, notification: Notification, accept: boolean) => {
        e.stopPropagation();
        if (!notification.projectId || !notification.actorId) return;

        try {
            await respondToJoinRequest(
                notification.id,
                notification.projectId,
                notification.actorId,
                accept,
                notification.tenantId
            );
        } catch (error) {
            console.error(error);
            showToast(`Failed to respond: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
    };

    // Get notification accent color based on type
    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'task_assigned':
            case 'subtask_assigned':
                return 'from-blue-500 to-indigo-500';
            case 'issue_assigned':
                return 'from-rose-500 to-pink-500';
            case 'comment_added':
            case 'comment_mention':
                return 'from-violet-500 to-purple-500';
            case 'project_invite':
            case 'project_shared':
            case 'project_join_request':
            case 'project_join_request_accepted':
                return 'from-emerald-500 to-teal-500';
            case 'project_join_request_denied':
                return 'from-gray-500 to-slate-500';
            default:
                return 'from-gray-400 to-gray-500';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button - Enhanced */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    size-9 rounded-xl flex items-center justify-center transition-all duration-300 relative
                    ${isOpen
                        ? 'bg-[var(--color-primary)] text-white dark:text-black shadow-lg scale-95'
                        : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}
                `}
            >
                <span className={`material-symbols-outlined text-[20px] transition-transform duration-300 ${isOpen ? 'rotate-12' : ''}`}>
                    {unreadCount > 0 ? 'notifications_active' : 'notifications'}
                </span>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-gradient-to-br from-rose-500 to-pink-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-rose-500/30 animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel - Premium Redesign */}
            {isOpen && (
                <div className={`absolute ${position === 'sidebar'
                    ? 'left-full bottom-0 ml-3'
                    : 'right-0 mt-2'
                    } w-[340px] bg-[var(--color-surface-card)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in`}
                >
                    {/* Header - Gradient Design */}
                    <div className="relative px-5 py-4 bg-gradient-to-r from-[var(--color-surface-card)] to-[var(--color-surface-bg)] border-b border-[var(--color-surface-border)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                    <span className="material-symbols-outlined text-white text-[22px]">notifications</span>
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-bold text-[var(--color-text-main)]">
                                        Notifications
                                    </h3>
                                    <p className="text-[11px] text-[var(--color-text-muted)]">
                                        {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                                    </p>
                                </div>
                            </div>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-[11px] font-bold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notifications List - Enhanced */}
                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <div className="size-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
                                <p className="text-xs text-[var(--color-text-muted)]">Loading notifications...</p>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <div className="size-20 rounded-2xl bg-gradient-to-br from-[var(--color-surface-hover)] to-[var(--color-surface-bg)] flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-[40px] text-[var(--color-text-subtle)]">
                                        inbox
                                    </span>
                                </div>
                                <h4 className="text-sm font-bold text-[var(--color-text-main)] mb-1">You're all caught up!</h4>
                                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                    No new notifications. We'll let you know when something needs your attention.
                                </p>
                            </div>
                        ) : (
                            <div className="py-2">
                                {notifications.slice(0, 15).map((notification, index) => (
                                    <div
                                        key={notification.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`
                                            group relative mx-2 mb-1 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200
                                            ${!notification.read
                                                ? 'bg-gradient-to-r from-indigo-50/80 to-transparent dark:from-indigo-900/20 dark:to-transparent'
                                                : 'hover:bg-[var(--color-surface-hover)]'}
                                        `}
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        {/* Colored accent bar for unread */}
                                        {!notification.read && (
                                            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b ${getNotificationColor(notification.type)}`} />
                                        )}

                                        <div className="flex items-start gap-3">
                                            {/* Icon with gradient background */}
                                            <div className={`
                                                flex-shrink-0 size-9 rounded-xl flex items-center justify-center transition-all duration-200
                                                ${!notification.read
                                                    ? `bg-gradient-to-br ${getNotificationColor(notification.type)} text-white shadow-md`
                                                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] group-hover:bg-[var(--color-surface-border)]'}
                                            `}>
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {getNotificationIcon(notification.type)}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`text-[13px] leading-snug ${!notification.read
                                                        ? 'font-semibold text-[var(--color-text-main)]'
                                                        : 'text-[var(--color-text-main)]'
                                                        }`}>
                                                        {notification.title}
                                                    </p>
                                                    <span className="text-[10px] text-[var(--color-text-subtle)] shrink-0 mt-0.5">
                                                        {formatTime(notification.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
                                                    {notification.message}
                                                </p>

                                                {/* Join Request Actions */}
                                                {notification.type === 'project_join_request' && !notification.read && (
                                                    <div className="flex items-center gap-2 mt-3">
                                                        <button
                                                            onClick={(e) => handleJoinResponse(e, notification, true)}
                                                            className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-lg hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-[1.02]"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleJoinResponse(e, notification, false)}
                                                            className="flex-1 flex items-center justify-center gap-1.5 h-8 bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] text-xs font-bold rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400 transition-all duration-200"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                                            Decline
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]/50">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/notifications');
                                }}
                                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors py-1.5 rounded-lg hover:bg-[var(--color-surface-hover)]"
                            >
                                View all notifications
                                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
