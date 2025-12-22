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

export const NotificationDropdown = () => {
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

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="size-9 rounded-full hover:bg-[var(--color-surface-hover)] flex items-center justify-center text-[var(--color-text-muted)] transition-colors relative"
            >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-[var(--color-text)]">
                                Notifications
                                {unreadCount > 0 && (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                                        {unreadCount}
                                    </span>
                                )}
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <span className="material-symbols-outlined text-[48px] text-[var(--color-text-muted)] opacity-50">
                                    notifications_off
                                </span>
                                <p className="text-sm text-[var(--color-text-muted)] mt-2">
                                    No notifications yet
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--color-surface-border)]">
                                {notifications.slice(0, 20).map((notification) => (
                                    <div
                                        key={notification.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleNotificationClick(notification)}
                                        className={`w-full text-left px-4 py-3 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${!notification.read
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-[var(--color-surface-bg)] text-[var(--color-text-muted)]'
                                                }`}>
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {getNotificationIcon(notification.type)}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm ${!notification.read
                                                    ? 'font-semibold text-[var(--color-text)]'
                                                    : 'text-[var(--color-text)]'
                                                    }`}>
                                                    {notification.title}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                                                    {notification.message}
                                                </p>
                                                {notification.type === 'project_join_request' && !notification.read && (
                                                    <div className="flex items-center gap-2 mt-3 mb-1">
                                                        <Button
                                                            size="xs"
                                                            variant="primary"
                                                            onClick={(e) => handleJoinResponse(e, notification, true)}
                                                            className="bg-emerald-500 hover:bg-emerald-600 border-emerald-500 text-white min-w-[70px]"
                                                        >
                                                            Accept
                                                        </Button>
                                                        <Button
                                                            size="xs"
                                                            variant="utility"
                                                            onClick={(e) => handleJoinResponse(e, notification, false)}
                                                            className="hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 border-transparent min-w-[70px]"
                                                        >
                                                            Deny
                                                        </Button>
                                                    </div>
                                                )}
                                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                                    {formatTime(notification.createdAt)}
                                                </p>
                                            </div>

                                            {/* Unread indicator */}
                                            {!notification.read && (
                                                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                            <button className="text-xs text-blue-500 hover:text-blue-600 transition-colors w-full text-center">
                                View all notifications
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
