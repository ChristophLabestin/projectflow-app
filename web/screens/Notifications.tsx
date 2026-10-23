import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { useNotifications } from '../hooks/useNotifications';
import { getNotificationPath, type NotificationFilter } from '../utils/notificationPresentation';
import { NotificationList } from '../components/notifications/NotificationList';
import { NotificationFilterTabs, NotificationOtherWorkspaces, NotificationState } from '../components/notifications/NotificationCenterParts';
import {
    getWebNotificationDiagnostics,
    registerWebPushToken,
    sendTestNotification,
    subscribeToNotificationDeliveryLogs
} from '../services/notificationService';
import type { NotificationDeliveryLog, WebNotificationDiagnostics } from '../services/notificationService';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { Notification } from '../types';
import { useToast } from '../context/UIContext';
import { useLanguage } from '../context/LanguageContext';
import { format } from 'date-fns';
import './notifications.scss';

export const Notifications = () => {
    const [filter, setFilter] = useState<NotificationFilter>('all');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [diagnostics, setDiagnostics] = useState<WebNotificationDiagnostics | null>(null);
    const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);
    const [registeringPush, setRegisteringPush] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [deliveryLogs, setDeliveryLogs] = useState<NotificationDeliveryLog[]>([]);
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { t, dateFormat, dateLocale } = useLanguage();
    const { user } = useAuth();
    const { activeWorkspaceId, switchWorkspace } = useWorkspace();
    const { notifications, unreadCount, loading, error, otherUnread, setRead, markAllRead, remove, removeAll } = useNotifications();
    const visible = filter === 'unread' ? notifications.filter((notification) => !notification.read) : notifications;

    const loadDiagnostics = useCallback(async () => {
        setDiagnosticsLoading(true);
        try {
            setDiagnostics(await getWebNotificationDiagnostics());
        } catch (error) {
            console.warn('Failed to load web notification diagnostics', error);
        } finally {
            setDiagnosticsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDiagnostics();
    }, [loadDiagnostics]);

    useEffect(() => {
        if (!user) {
            setDeliveryLogs([]);
            return;
        }

        return subscribeToNotificationDeliveryLogs(user.uid, setDeliveryLogs, activeWorkspaceId || undefined);
    }, [user, activeWorkspaceId]);

    const handleRegisterWebPush = async () => {
        setRegisteringPush(true);
        try {
            const nextDiagnostics = await registerWebPushToken();
            setDiagnostics(nextDiagnostics);
            showToast(t('notifications.toast.webPushEnabled'), 'success');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('notifications.error.unknown');
            showToast(t('notifications.toast.webPushError').replace('{error}', errorMessage), 'error');
            await loadDiagnostics();
        } finally {
            setRegisteringPush(false);
        }
    };

    const handleSendTestNotification = async () => {
        setSendingTest(true);
        try {
            const result = await sendTestNotification();
            showToast(
                t('notifications.toast.testQueued').replace('{count}', String(result.fcmTokenCount)),
                'success'
            );
            await loadDiagnostics();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('notifications.error.unknown');
            showToast(t('notifications.toast.testError').replace('{error}', errorMessage), 'error');
        } finally {
            setSendingTest(false);
        }
    };

    const run = async (action: () => Promise<unknown>, errorKey: string) => {
        try {
            await action();
            return true;
        } catch (actionError) {
            console.error(actionError);
            showToast(t(errorKey), 'error');
            return false;
        }
    };

    const handleOpen = (notification: Notification) => {
        if (!notification.read) void run(() => setRead(notification, true), 'notifications.toast.updateError');
        const path = getNotificationPath(notification);
        if (path) navigate(path);
    };

    const formatDeliveryTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return format(date, `${dateFormat} HH:mm`, { locale: dateLocale });
    };

    const getPermissionLabel = (permission?: WebNotificationDiagnostics['permission']) => {
        switch (permission) {
            case 'granted':
                return t('notifications.diagnostics.permission.granted');
            case 'denied':
                return t('notifications.diagnostics.permission.denied');
            case 'default':
                return t('notifications.diagnostics.permission.default');
            case 'unsupported':
                return t('notifications.diagnostics.permission.unsupported');
            default:
                return t('notifications.diagnostics.status.unknown');
        }
    };

    const renderDiagnosticStatus = (isReady?: boolean) => (
        <span className={`notifications-diagnostic-status ${isReady ? 'is-ready' : 'is-blocked'}`}>
            <span className="material-symbols-outlined">
                {isReady ? 'check_circle' : 'error'}
            </span>
            {isReady ? t('notifications.diagnostics.status.ready') : t('notifications.diagnostics.status.needsSetup')}
        </span>
    );

    const getDeliveryChannelLabel = (channel: NotificationDeliveryLog['channel']) => {
        switch (channel) {
            case 'email':
                return t('notifications.diagnostics.deliveryLog.channel.email');
            case 'fcm':
                return t('notifications.diagnostics.deliveryLog.channel.fcm');
            default:
                return channel;
        }
    };

    const getDeliveryStatusLabel = (status: NotificationDeliveryLog['status']) => {
        switch (status) {
            case 'sent':
                return t('notifications.diagnostics.deliveryLog.status.sent');
            case 'failed':
                return t('notifications.diagnostics.deliveryLog.status.failed');
            case 'skipped':
                return t('notifications.diagnostics.deliveryLog.status.skipped');
            default:
                return status;
        }
    };

    const handleClearAll = async () => {
        if (await run(removeAll, 'notifications.toast.clearError')) {
            showToast(t('notifications.toast.clearAll'), 'success');
        }
        setShowClearConfirm(false);
    };

    return (
        <div className="notifications-page">
            {/* Header */}
            <div className="notifications-header">
                <div>
                    <h1 className="notifications-title">{t('notifications.title')}</h1>
                    <p className="notifications-subtitle">
                        {t('notifications.page.subtitle')}
                    </p>
                </div>
                <div className="notifications-actions">
                    {notifications.length > 0 && (
                        <Button
                            variant="ghost"
                            onClick={() => setShowClearConfirm(true)}
                            className="notifications-action notifications-action--danger"
                        >
                            <span className="material-symbols-outlined notifications-action__icon">delete_sweep</span>
                            {t('notifications.actions.clearAll')}
                        </Button>
                    )}
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            onClick={() => void run(markAllRead, 'notifications.toast.updateError')}
                            className="notifications-action"
                        >
                            <span className="material-symbols-outlined notifications-action__icon">done_all</span>
                            {t('notifications.actions.markAllRead')}
                        </Button>
                    )}
                </div>
            </div>


            <ConfirmModal
                isOpen={showClearConfirm}
                onClose={() => setShowClearConfirm(false)}
                onConfirm={handleClearAll}
                title={t('notifications.clearConfirm.title')}
                message={t('notifications.clearConfirm.message')}
                confirmLabel={t('notifications.clearConfirm.confirm')}
                cancelLabel={t('notifications.clearConfirm.cancel')}
                variant="danger"
            />

            {/* Notifications List */}
            <div className="notifications-toolbar">
                <NotificationFilterTabs value={filter} unreadCount={unreadCount} onChange={setFilter} />
            </div>

            <Card padding="none" className="notifications-card">
                <NotificationOtherWorkspaces
                    items={otherUnread}
                    onSwitch={(tenantId) => void run(() => switchWorkspace(tenantId, '/notifications'), 'notifications.toast.switchError')}
                />
                {loading ? (
                    <NotificationState kind="loading" />
                ) : error ? (
                    <NotificationState kind="error" />
                ) : visible.length === 0 ? (
                    <NotificationState kind={filter === 'unread' && notifications.length > 0 ? 'emptyUnread' : 'empty'} />
                ) : (
                    <NotificationList
                        notifications={visible}
                        onOpen={handleOpen}
                        onToggleRead={(notification) => void run(() => setRead(notification, !notification.read), 'notifications.toast.updateError')}
                        onDelete={(notification) => void run(() => remove(notification), 'notifications.toast.deleteError')}
                    />
                )}
            </Card>

            {/* Delivery diagnostics are a setup tool: collapsed below the inbox. */}
            <details className="notifications-delivery">
                <summary className="notifications-delivery__summary">
                    <span className="material-symbols-outlined" aria-hidden="true">settings_alert</span>
                    {t('notifications.delivery.summary')}
                    <span className="material-symbols-outlined notifications-delivery__chevron" aria-hidden="true">expand_more</span>
                </summary>
                <Card padding="none" className="notifications-diagnostics-card">
                    <div className="notifications-diagnostics">
                        <div className="notifications-diagnostics__header">
                            <div>
                                <p className="notifications-diagnostics__eyebrow">{t('notifications.diagnostics.eyebrow')}</p>
                                <h2>{t('notifications.diagnostics.title')}</h2>
                                <p>{t('notifications.diagnostics.subtitle')}</p>
                            </div>
                            <div className="notifications-diagnostics__actions">
                                <Button
                                    variant="secondary"
                                    onClick={loadDiagnostics}
                                    disabled={diagnosticsLoading || registeringPush || sendingTest}
                                    className="notifications-action"
                                >
                                    <span className="material-symbols-outlined notifications-action__icon">refresh</span>
                                    {t('notifications.diagnostics.refresh')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={handleRegisterWebPush}
                                    loading={registeringPush}
                                    disabled={registeringPush || sendingTest}
                                    className="notifications-action"
                                >
                                    <span className="material-symbols-outlined notifications-action__icon">notifications_active</span>
                                    {t('notifications.diagnostics.enableWebPush')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handleSendTestNotification}
                                    loading={sendingTest}
                                    disabled={sendingTest || registeringPush}
                                    className="notifications-action"
                                >
                                    <span className="material-symbols-outlined notifications-action__icon">send</span>
                                    {t('notifications.diagnostics.sendTest')}
                                </Button>
                            </div>
                        </div>

                        <div className="notifications-diagnostics__grid" aria-busy={diagnosticsLoading}>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.browser')}</span>
                                {renderDiagnosticStatus(diagnostics?.browserNotificationsSupported)}
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.serviceWorker')}</span>
                                {renderDiagnosticStatus(diagnostics?.serviceWorkerSupported)}
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.pushManager')}</span>
                                {renderDiagnosticStatus(diagnostics?.pushManagerSupported)}
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.firebaseMessaging')}</span>
                                {renderDiagnosticStatus(diagnostics?.firebaseMessagingSupported)}
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.permission')}</span>
                                <strong>{getPermissionLabel(diagnostics?.permission)}</strong>
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.vapid')}</span>
                                {renderDiagnosticStatus(diagnostics?.vapidKeyConfigured)}
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.token')}</span>
                                {renderDiagnosticStatus(diagnostics?.tokenRegistered)}
                            </div>
                            <div className="notifications-diagnostic-row">
                                <span>{t('notifications.diagnostics.lastSync')}</span>
                                <strong>{diagnostics?.lastTokenSyncAt || t('notifications.diagnostics.never')}</strong>
                            </div>
                        </div>

                        {diagnostics?.lastTokenError && (
                            <p className="notifications-diagnostics__error">
                                {t('notifications.diagnostics.lastError').replace('{error}', diagnostics.lastTokenError)}
                            </p>
                        )}

                        <div className="notifications-delivery-log">
                            <div className="notifications-delivery-log__header">
                                <h3>{t('notifications.diagnostics.deliveryLog.title')}</h3>
                                <span>{deliveryLogs.length}</span>
                            </div>
                            {deliveryLogs.length === 0 ? (
                                <p className="notifications-delivery-log__empty">
                                    {t('notifications.diagnostics.deliveryLog.empty')}
                                </p>
                            ) : (
                                <div className="notifications-delivery-log__list">
                                    {deliveryLogs.map((log) => (
                                        <div className="notifications-delivery-log__item" key={log.id}>
                                            <div className="notifications-delivery-log__meta">
                                                <span className={`notifications-delivery-log__status is-${log.status}`}>
                                                    {getDeliveryStatusLabel(log.status)}
                                                </span>
                                                <strong>{getDeliveryChannelLabel(log.channel)}</strong>
                                                <span>{formatDeliveryTime(log.createdAt)}</span>
                                            </div>
                                            <p>{log.reason}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </details>
        </div>
    );
};
