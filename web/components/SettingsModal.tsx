import React, { useState, useEffect } from 'react';
import { remove } from 'firebase/database';
import { collection, query, getDocs, deleteDoc, updateDoc, doc, deleteField } from 'firebase/firestore';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { useToast, useConfirm } from '../context/UIContext';
import { auth, functions, db } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { Tenant, AIUsage, APITokenPermission } from '../types';

import { TwoFactorSetupModal } from './modals/TwoFactorSetupModal';
import {
    multiFactor,
    EmailAuthProvider,
    updatePassword,
    linkWithCredential,
    reauthenticateWithPopup,
    GithubAuthProvider,
    GoogleAuthProvider,
    linkWithPopup,
    sendEmailVerification,
    unlink,
    getMultiFactorResolver,
    MultiFactorResolver
} from 'firebase/auth';
import { format } from 'date-fns';
import { linkWithGithub, resetUserOnboarding } from '../services/dataService';
import { registerPasskey, shouldAutoPrompt } from '../services/passkeyService';
import { Checkbox } from './ui/Checkbox';
import { AnimatePresence } from 'framer-motion';
import { Modal } from './ui/Modal';
import { RoleManagement } from './settings/RoleManagement';
import { TwoFactorChallengeModal } from './modals/TwoFactorChallengeModal';

import { DateFormat, useLanguage } from '../context/LanguageContext';
import { getActiveTenantId } from '../services/domain/authService';
import {
    createWorkspaceApiToken,
    deleteWorkspaceApiToken,
    disconnectGoogleDriveStorage,
    getGoogleDriveStorageAuthUrl,
    getWorkspaceFileStorageConfig,
    getWorkspaceSmtpConfig,
    listWorkspaceApiTokens,
    saveWorkspaceFileStorageConfig,
    saveWorkspaceSmtpConfig,
    testWorkspaceFileStorageConnection,
    type WorkspaceApiToken
} from '../services/domain/adminSettingsService';
import { getTenant, updateTenant } from '../services/domain/workspaceService';
import { getAIUsage, getUserProfile, updateUserData } from '../services/domain/usersService';

type SettingsTab = 'account' | 'preferences' | 'security' | 'general' | 'roles' | 'api' | 'billing' | 'email' | 'integrations' | 'prebeta';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: SettingsTab;
}

type TokenPreset = 'codex-full' | 'read-only' | 'write-no-delete';

const TOKEN_PERMISSION_PRESETS: Record<TokenPreset, APITokenPermission[]> = {
    'codex-full': [
        'projects:read',
        'projects:write',
        'projects:delete',
        'tasks:read',
        'tasks:write',
        'tasks:delete',
        'initiatives:read',
        'initiatives:write',
        'initiatives:delete'
    ],
    'read-only': [
        'projects:read',
        'tasks:read',
        'initiatives:read'
    ],
    'write-no-delete': [
        'projects:read',
        'projects:write',
        'tasks:read',
        'tasks:write',
        'initiatives:read',
        'initiatives:write'
    ]
};

const TOKEN_PRESET_KEYS: { id: TokenPreset; titleKey: string; descriptionKey: string; recommended?: boolean }[] = [
    {
        id: 'codex-full',
        titleKey: 'settings.api.create.presets.codexFull.title',
        descriptionKey: 'settings.api.create.presets.codexFull.description',
        recommended: true
    },
    {
        id: 'read-only',
        titleKey: 'settings.api.create.presets.readOnly.title',
        descriptionKey: 'settings.api.create.presets.readOnly.description'
    },
    {
        id: 'write-no-delete',
        titleKey: 'settings.api.create.presets.writeNoDelete.title',
        descriptionKey: 'settings.api.create.presets.writeNoDelete.description'
    }
];

const TOKEN_PERMISSION_LABEL_KEYS: Record<APITokenPermission, string> = {
    'newsletter:write': 'settings.api.permissions.newsletterWrite',
    'recipients:read': 'settings.api.permissions.recipientsRead',
    'projects:read': 'settings.api.permissions.projectsRead',
    'projects:write': 'settings.api.permissions.projectsWrite',
    'projects:delete': 'settings.api.permissions.projectsDelete',
    'tasks:read': 'settings.api.permissions.tasksRead',
    'tasks:write': 'settings.api.permissions.tasksWrite',
    'tasks:delete': 'settings.api.permissions.tasksDelete',
    'initiatives:read': 'settings.api.permissions.initiativesRead',
    'initiatives:write': 'settings.api.permissions.initiativesWrite',
    'initiatives:delete': 'settings.api.permissions.initiativesDelete'
};

const hasDestructiveScope = (permissions: APITokenPermission[]) =>
    permissions.includes('projects:delete') || permissions.includes('tasks:delete') || permissions.includes('initiatives:delete');

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = 'account' }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
    const { language, setLanguage, dateFormat, setDateFormat, t, settingsTranslationsReady, loadSettingsTranslations } = useLanguage();
    const [tenant, setTenant] = useState<Partial<Tenant>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const [aiUsage, setAiUsage] = useState<AIUsage | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [website, setWebsite] = useState('');
    const [contactEmail, setContactEmail] = useState('');

    // Pre-Alpha State
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [geminiTokenLimit, setGeminiTokenLimit] = useState(10000000); // 10M Default

    // SMTP State
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [useCustomSmtp, setUseCustomSmtp] = useState(false);
    const [smtpFromEmail, setSmtpFromEmail] = useState('');

    // Test Connection State
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
    // Saved credentials for change detection
    const [savedSmtpConfig, setSavedSmtpConfig] = useState<{
        host: string; port: number; user: string; pass: string; fromEmail: string;
    } | null>(null);

    // File Storage State
    const [storageActiveProvider, setStorageActiveProvider] = useState<'firebase' | 's3' | 'googleDrive'>('firebase');
    const [storageResolvedProvider, setStorageResolvedProvider] = useState<'firebase' | 's3' | 'googleDrive'>('firebase');
    const [storageFallbackReason, setStorageFallbackReason] = useState<string | null>(null);
    const [storageS3Endpoint, setStorageS3Endpoint] = useState('');
    const [storageS3Region, setStorageS3Region] = useState('us-east-1');
    const [storageS3Bucket, setStorageS3Bucket] = useState('');
    const [storageS3PathPrefix, setStorageS3PathPrefix] = useState('');
    const [storageS3ForcePathStyle, setStorageS3ForcePathStyle] = useState(false);
    const [storageS3AccessKeyId, setStorageS3AccessKeyId] = useState('');
    const [storageS3SecretAccessKey, setStorageS3SecretAccessKey] = useState('');
    const [storageDriveConnected, setStorageDriveConnected] = useState(false);
    const [storageDriveFolderId, setStorageDriveFolderId] = useState('');
    const [storageDriveFolderName, setStorageDriveFolderName] = useState('');
    const [storageDriveEmail, setStorageDriveEmail] = useState('');
    const [storageLoading, setStorageLoading] = useState(false);
    const [storageSaving, setStorageSaving] = useState(false);
    const [storageTesting, setStorageTesting] = useState(false);
    const [storageConnectingDrive, setStorageConnectingDrive] = useState(false);
    const [storageStatusMessage, setStorageStatusMessage] = useState('');

    // API Token State
    const [apiTokens, setApiTokens] = useState<WorkspaceApiToken[]>([]);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const [creatingToken, setCreatingToken] = useState(false);
    const [newTokenName, setNewTokenName] = useState('');
    const [tokenPreset, setTokenPreset] = useState<TokenPreset>('codex-full');
    const [showNewTokenModal, setShowNewTokenModal] = useState(false);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState(false);

    // Security State
    const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [passkeys, setPasskeys] = useState<any[]>([]);
    const [registeringPasskey, setRegisteringPasskey] = useState(false);
    const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
    const [editingPasskeyLabel, setEditingPasskeyLabel] = useState('');
    const [savingPasskeyLabel, setSavingPasskeyLabel] = useState(false);
    const [autoPromptEnabled, setAutoPromptEnabled] = useState(shouldAutoPrompt());

    // Account Management State
    const [githubLinked, setGithubLinked] = useState(false);
    const [connectingGithub, setConnectingGithub] = useState(false);
    const [disconnectingGithub, setDisconnectingGithub] = useState(false);
    const [githubMfaResolver, setGithubMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [showGithubMfaModal, setShowGithubMfaModal] = useState(false);
    const [connectingGoogle, setConnectingGoogle] = useState(false);
    const [providers, setProviders] = useState<string[]>([]);
    const [showSetPassword, setShowSetPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [settingPassword, setSettingPassword] = useState(false);
    const [emailVerified, setEmailVerified] = useState(true);
    const [sendingVerification, setSendingVerification] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset state or reload when opened if needed
            setActiveTab(initialTab);
            void loadSettingsTranslations();
        }
    }, [initialTab, isOpen, loadSettingsTranslations]);

    useEffect(() => {
        // Reset verification status when credentials change from saved values
        if (savedSmtpConfig && (
            smtpHost !== savedSmtpConfig.host ||
            smtpPort !== savedSmtpConfig.port ||
            smtpUser !== savedSmtpConfig.user ||
            smtpPass !== savedSmtpConfig.pass ||
            smtpFromEmail !== savedSmtpConfig.fromEmail
        )) {
            if (connectionStatus !== null) {
                setConnectionStatus(null);
            }
        }
    }, [smtpHost, smtpPort, smtpUser, smtpPass, smtpFromEmail, savedSmtpConfig]);

    useEffect(() => {
        const loadAccountStatus = async () => {
            const user = auth.currentUser;
            if (user) {
                setProviders(user.providerData.map(p => p.providerId));
                setEmailVerified(user.emailVerified);
                try {
                    const profile = await getUserProfile(user.uid);
                    if (profile?.githubToken) {
                        setGithubLinked(true);
                    }
                    if (profile?.geminiConfig) {
                        setGeminiApiKey(profile.geminiConfig.apiKey || '');
                        setGeminiTokenLimit(profile.geminiConfig.tokenLimit || 10000000);
                    }
                } catch (e) {
                    console.error("Failed to load account status", e);
                }
            }
        };
        if (isOpen) {
            loadAccountStatus();
        }
    }, [isOpen, activeTab]);

    const handleConnectGithub = async () => {
        const user = auth.currentUser;
        if (!user) return;
        setConnectingGithub(true);
        try {
            const token = await linkWithGithub();
            await updateUserData(user.uid, { githubToken: token });
            setGithubLinked(true);
            setProviders(user.providerData.map(p => p.providerId));
            showSuccess(t('settings.account.github.connected'));
        } catch (e: any) {
            console.error('Failed to link GitHub', e);
            showError(e.message || t('settings.account.github.error'));
        } finally {
            setConnectingGithub(false);
        }
    };

    const getGithubMfaResolver = (error: any): MultiFactorResolver => {
        const serverResponse = error.customData?._serverResponse || error.customData?.serverResponse;
        if (!serverResponse) {
            return getMultiFactorResolver(auth, error);
        }

        return getMultiFactorResolver(auth, {
            code: 'auth/multi-factor-auth-required',
            message: error.message,
            name: 'FirebaseError',
            operationType: 'reauthenticate',
            customData: {
                operationType: 'reauthenticate',
                _serverResponse: serverResponse,
                serverResponse,
                appName: error.customData?.appName
            },
            user: auth.currentUser
        } as any);
    };

    const handleDisconnectGithub = async (skipConfirm = false) => {
        const user = auth.currentUser;
        if (!user) return;

        if (!skipConfirm) {
            const confirmed = await confirm({
                title: t('settings.account.github.disconnectConfirmTitle'),
                message: t('settings.account.github.disconnectConfirmMessage'),
                confirmText: t('settings.account.github.disconnectConfirm'),
                variant: 'danger'
            });
            if (!confirmed) return;
        }

        setDisconnectingGithub(true);
        try {
            const currentProviders = user.providerData.map(p => p.providerId);
            const hasGithubAuthProvider = currentProviders.includes('github.com');
            if (!githubLinked && hasGithubAuthProvider && currentProviders.length <= 1) {
                showError(t('settings.account.github.disconnectOnlyProvider'));
                return;
            }

            const canUnlinkAuthProvider = currentProviders.includes('github.com') && currentProviders.length > 1;
            if (canUnlinkAuthProvider) {
                await unlink(user, 'github.com');
            }

            if (githubLinked) {
                await updateDoc(doc(db, 'users', user.uid), { githubToken: deleteField() });
            }

            await user.reload();
            setGithubLinked(false);
            setProviders(auth.currentUser?.providerData.map(p => p.providerId) || []);
            showSuccess(
                canUnlinkAuthProvider
                    ? t('settings.account.github.disconnected')
                    : t('settings.account.github.tokenDisconnected')
            );
        } catch (e: any) {
            console.error('Failed to disconnect GitHub', e);
            if (e.code === 'auth/multi-factor-auth-required') {
                try {
                    setGithubMfaResolver(getGithubMfaResolver(e));
                    setShowGithubMfaModal(true);
                } catch (resolverError: any) {
                    console.error('Failed to prepare GitHub MFA resolver', resolverError);
                    showError(resolverError.message || t('settings.account.github.disconnectError'));
                }
            } else {
                showError(e.message || t('settings.account.github.disconnectError'));
            }
        } finally {
            setDisconnectingGithub(false);
        }
    };

    const handleGithubMfaSuccess = async () => {
        setShowGithubMfaModal(false);
        setGithubMfaResolver(null);
        await handleDisconnectGithub(true);
    };

    const handleConnectGoogle = async () => {
        const user = auth.currentUser;
        if (!user) return;
        setConnectingGoogle(true);
        try {
            const currentProviders = user.providerData.map(p => p.providerId);
            try {
                const provider = new GoogleAuthProvider();
                await linkWithPopup(user, provider);
            } catch (linkError: any) {
                if (linkError.code === 'auth/requires-recent-login') {
                    if (currentProviders.includes('github.com')) {
                        await reauthenticateWithPopup(user, new GithubAuthProvider());
                    } else if (currentProviders.includes('google.com')) {
                        await reauthenticateWithPopup(user, new GoogleAuthProvider());
                    }
                    await linkWithPopup(user, new GoogleAuthProvider());
                } else {
                    throw linkError;
                }
            }
            setProviders(user.providerData.map(p => p.providerId));
            showSuccess(t('settings.account.google.connected'));
        } catch (e: any) {
            console.error('Failed to link Google', e);
            showError(e.message || t('settings.account.google.error'));
        } finally {
            setConnectingGoogle(false);
        }
    };

    const handleUpdatePassword = async () => {
        const user = auth.currentUser;
        if (!user || !newPassword) return;
        if (newPassword !== confirmPassword) {
            showError(t('settings.account.password.errors.mismatch'));
            return;
        }
        if (newPassword.length < 6) {
            showError(t('settings.account.password.errors.tooShort'));
            return;
        }

        setSettingPassword(true);
        try {
            if (isChangingPassword) {
                // User already has a password, use updatePassword
                try {
                    await updatePassword(user, newPassword);
                } catch (updateError: any) {
                    if (updateError.code === 'auth/requires-recent-login') {
                        // Re-authenticate with OAuth providers if available
                        const currentProviders = user.providerData.map(p => p.providerId);
                        if (currentProviders.includes('github.com')) {
                            await reauthenticateWithPopup(user, new GithubAuthProvider());
                        } else if (currentProviders.includes('google.com')) {
                            await reauthenticateWithPopup(user, new GoogleAuthProvider());
                        } else {
                            // If they only have password, they'd need to re-auth with password
                            // For now we'll throw, as we don't have an "old password" field yet
                            throw updateError;
                        }
                        await updatePassword(user, newPassword);
                    } else {
                        throw updateError;
                    }
                }
            } else {
                if (!user.email) {
                    showError(t('settings.account.password.errors.noEmail'));
                    return;
                }
                const credential = EmailAuthProvider.credential(user.email, newPassword);
                try {
                    await linkWithCredential(user, credential);
                } catch (linkError: any) {
                    if (linkError.code === 'auth/requires-recent-login') {
                        const currentProviders = user.providerData.map(p => p.providerId);
                        if (currentProviders.includes('github.com')) {
                            await reauthenticateWithPopup(user, new GithubAuthProvider());
                        } else if (currentProviders.includes('google.com')) {
                            await reauthenticateWithPopup(user, new GoogleAuthProvider());
                        }
                        await linkWithCredential(user, credential);
                    } else {
                        throw linkError;
                    }
                }
            }

            setProviders(user.providerData.map(p => p.providerId));
            setShowSetPassword(false);
            setIsChangingPassword(false);
            setNewPassword('');
            setConfirmPassword('');
            showSuccess(isChangingPassword
                ? t('settings.account.password.success.updated')
                : t('settings.account.password.success.set'));
        } catch (e: any) {
            console.error('Failed to update password', e);
            if (e.code === 'auth/requires-recent-login' && isChangingPassword && !providers.some(p => p.includes('google') || p.includes('github'))) {
                showError(t('settings.account.password.errors.reauth'));
            } else {
                showError(e.message || t('settings.account.password.errors.updateFailed'));
            }
        } finally {
            setSettingPassword(false);
        }
    };

    const handleTestConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            const testFn = httpsCallable(functions, 'testSMTPConnection');
            const result = await testFn({
                host: smtpHost,
                port: smtpPort,
                user: smtpUser,
                pass: smtpPass,
                secure: smtpPort === 465
            }) as any;

            if (result.data.success) {
                showSuccess(t('settings.email.smtp.test.success').replace('{message}', result.data.message));
                setConnectionStatus('success');
                await saveVerifiedStatus(true);
            } else {
                const errorMessage = result.data.error || t('settings.email.smtp.test.unknownError');
                showError(t('settings.email.smtp.test.failed').replace('{error}', errorMessage));
                setConnectionStatus('error');
            }
        } catch (error: any) {
            console.error(error);
            showError(t('settings.email.smtp.test.failed').replace('{error}', error.message));
            setConnectionStatus('error');
        } finally {
            setTestingConnection(false);
        }
    };

    const saveVerifiedStatus = async (verified: boolean) => {
        const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
        if (!id) return;
        await saveWorkspaceSmtpConfig(id, {
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            pass: smtpPass,
            useCustom: useCustomSmtp,
            fromEmail: smtpFromEmail,
            verified
        });
        setSavedSmtpConfig({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass, fromEmail: smtpFromEmail });
    };

    const applyStorageConfig = (config: Awaited<ReturnType<typeof getWorkspaceFileStorageConfig>>) => {
        if (!config) {
            setStorageActiveProvider('firebase');
            setStorageResolvedProvider('firebase');
            setStorageFallbackReason(null);
            setStorageS3Endpoint('');
            setStorageS3Region('us-east-1');
            setStorageS3Bucket('');
            setStorageS3PathPrefix('');
            setStorageS3ForcePathStyle(false);
            setStorageS3AccessKeyId('');
            setStorageS3SecretAccessKey('');
            setStorageDriveConnected(false);
            setStorageDriveFolderId('');
            setStorageDriveFolderName('');
            setStorageDriveEmail('');
            return;
        }

        setStorageActiveProvider(config.activeProvider);
        setStorageResolvedProvider(config.resolvedProvider);
        setStorageFallbackReason(config.fallbackReason);
        setStorageS3Endpoint(config.providers.s3.endpoint || '');
        setStorageS3Region(config.providers.s3.region || 'us-east-1');
        setStorageS3Bucket(config.providers.s3.bucket || '');
        setStorageS3PathPrefix(config.providers.s3.pathPrefix || '');
        setStorageS3ForcePathStyle(Boolean(config.providers.s3.forcePathStyle));
        setStorageS3AccessKeyId('');
        setStorageS3SecretAccessKey('');
        setStorageDriveConnected(Boolean(config.providers.googleDrive.connected));
        setStorageDriveFolderId(config.providers.googleDrive.folderId || '');
        setStorageDriveFolderName(config.providers.googleDrive.folderName || '');
        setStorageDriveEmail(config.providers.googleDrive.email || '');
    };

    const loadStorageConfig = async (id: string) => {
        setStorageLoading(true);
        try {
            const config = await getWorkspaceFileStorageConfig(id);
            applyStorageConfig(config);
        } catch (error) {
            console.error('Failed to load workspace file storage config', error);
            setStorageStatusMessage(t('settings.storage.errors.loadFailed'));
        } finally {
            setStorageLoading(false);
        }
    };

    const handleSaveStorageConfig = async () => {
        const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
        if (!id) return;

        setStorageSaving(true);
        setStorageStatusMessage('');
        try {
            const updated = await saveWorkspaceFileStorageConfig(id, {
                activeProvider: storageActiveProvider,
                s3Config: {
                    endpoint: storageS3Endpoint.trim(),
                    region: storageS3Region.trim(),
                    bucket: storageS3Bucket.trim(),
                    pathPrefix: storageS3PathPrefix.trim(),
                    forcePathStyle: storageS3ForcePathStyle,
                    accessKeyId: storageS3AccessKeyId.trim(),
                    secretAccessKey: storageS3SecretAccessKey.trim(),
                },
                googleDriveConfig: {
                    folderId: storageDriveFolderId.trim(),
                    folderName: storageDriveFolderName.trim(),
                },
            });

            applyStorageConfig(updated);
            setStorageStatusMessage(t('settings.storage.saved'));
            showSuccess(t('settings.storage.saved'));
        } catch (error: any) {
            console.error('Failed to save workspace file storage config', error);
            const message = error?.message || t('settings.storage.errors.saveFailed');
            setStorageStatusMessage(message);
            showError(message);
        } finally {
            setStorageSaving(false);
        }
    };

    const handleTestStorageConnection = async () => {
        const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
        if (!id) return;

        setStorageTesting(true);
        setStorageStatusMessage('');
        try {
            const response = await testWorkspaceFileStorageConnection(
                id,
                storageActiveProvider,
                storageActiveProvider === 's3'
                    ? {
                        endpoint: storageS3Endpoint.trim(),
                        region: storageS3Region.trim(),
                        bucket: storageS3Bucket.trim(),
                        pathPrefix: storageS3PathPrefix.trim(),
                        forcePathStyle: storageS3ForcePathStyle,
                        accessKeyId: storageS3AccessKeyId.trim(),
                        secretAccessKey: storageS3SecretAccessKey.trim(),
                    }
                    : undefined,
            );
            setStorageStatusMessage(response.message);
            showSuccess(response.message);
            await loadStorageConfig(id);
        } catch (error: any) {
            console.error('Failed to test storage connection', error);
            const message = error?.message || t('settings.storage.errors.testFailed');
            setStorageStatusMessage(message);
            showError(message);
        } finally {
            setStorageTesting(false);
        }
    };

    const openCenteredPopup = (url: string, name: string) => {
        const width = 620;
        const height = 720;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        const popup = window.open(url, name, `width=${width},height=${height},top=${top},left=${left}`);
        if (!popup) {
            throw new Error(t('settings.storage.errors.popupBlocked'));
        }
        return popup;
    };

    const waitForPopupMessage = (popup: Window, successType: string) => new Promise<void>((resolve, reject) => {
        let completed = false;

        const cleanup = () => {
            window.removeEventListener('message', handleMessage);
            clearInterval(closePoll);
            clearTimeout(timeout);
        };

        const fail = (message: string) => {
            if (completed) return;
            completed = true;
            cleanup();
            reject(new Error(message));
        };

        const succeed = () => {
            if (completed) return;
            completed = true;
            cleanup();
            resolve();
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.source !== popup) return;
            if (event.data?.type === successType) {
                succeed();
            }
        };

        const closePoll = window.setInterval(() => {
            if (popup.closed) {
                fail(t('settings.storage.errors.popupClosed'));
            }
        }, 500);

        const timeout = window.setTimeout(() => {
            fail(t('settings.storage.errors.popupTimeout'));
        }, 120_000);

        window.addEventListener('message', handleMessage);
    });

    const handleConnectGoogleDriveStorage = async () => {
        const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
        if (!id) return;

        setStorageConnectingDrive(true);
        setStorageStatusMessage('');
        try {
            const { url } = await getGoogleDriveStorageAuthUrl(id);
            const popup = openCenteredPopup(url, 'google_drive_storage_auth');
            await waitForPopupMessage(popup, 'GOOGLE_DRIVE_STORAGE_CONNECTED');
            await loadStorageConfig(id);
            setStorageStatusMessage(t('settings.storage.googleDrive.connected'));
            showSuccess(t('settings.storage.googleDrive.connected'));
        } catch (error: any) {
            console.error('Failed to connect Google Drive storage', error);
            const message = error?.message || t('settings.storage.errors.driveConnectFailed');
            setStorageStatusMessage(message);
            showError(message);
        } finally {
            setStorageConnectingDrive(false);
        }
    };

    const handleDisconnectGoogleDriveStorage = async () => {
        const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
        if (!id) return;

        setStorageConnectingDrive(true);
        setStorageStatusMessage('');
        try {
            const updated = await disconnectGoogleDriveStorage(id);
            applyStorageConfig(updated);
            setStorageStatusMessage(t('settings.storage.googleDrive.disconnected'));
            showSuccess(t('settings.storage.googleDrive.disconnected'));
        } catch (error: any) {
            console.error('Failed to disconnect Google Drive storage', error);
            const message = error?.message || t('settings.storage.errors.driveDisconnectFailed');
            setStorageStatusMessage(message);
            showError(message);
        } finally {
            setStorageConnectingDrive(false);
        }
    };

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const id = getActiveTenantId() || auth.currentUser?.uid;
                if (!id) return;
                setTenantId(id);

                const data = await getTenant(id) as Tenant;
                if (data) {
                    setTenant(data);
                    setName(data.name || '');
                    setDescription(data.description || '');
                    setWebsite(data.website || '');
                    setContactEmail(data.contactEmail || '');

                    const smtpSecret = await getWorkspaceSmtpConfig(id);
                    if (smtpSecret) {
                        setSmtpHost(smtpSecret.host || '');
                        setSmtpPort(smtpSecret.port || 587);
                        setSmtpUser(smtpSecret.user || '');
                        setSmtpPass(smtpSecret.pass || '');
                        setUseCustomSmtp(smtpSecret.useCustom || false);
                        setSmtpFromEmail(smtpSecret.fromEmail || '');
                        if (smtpSecret.verified === true) {
                            setConnectionStatus('success');
                        }
                        setSavedSmtpConfig({
                            host: smtpSecret.host || '',
                            port: smtpSecret.port || 587,
                            user: smtpSecret.user || '',
                            pass: smtpSecret.pass || '',
                            fromEmail: smtpSecret.fromEmail || ''
                        });
                    }

                    await loadStorageConfig(id);

                }
            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setLoading(false);
            }
        };

        const loadAIUsage = async () => {
            const user = auth.currentUser;
            if (user) {
                const usage = await getAIUsage(user.uid);
                setAiUsage(usage);
            }
        };

        const load2FAStatus = () => {
            const user = auth.currentUser;
            if (user) {
                const enrolledFactors = multiFactor(user).enrolledFactors;
                setTwoFactorEnabled(enrolledFactors.length > 0);
            }
        };

        if (isOpen) {
            loadSettings();
            loadAIUsage();
            load2FAStatus();
        }
    }, [isOpen]);

    useEffect(() => {
        const loadAPITokens = async () => {
            setLoadingTokens(true);
            try {
                const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
                if (!id) return;
                const tokens = await listWorkspaceApiTokens(id);
                setApiTokens(tokens);
            } catch (error) {
                console.error('Failed to load API tokens', error);
            } finally {
                setLoadingTokens(false);
            }
        };

        if (isOpen && activeTab === 'api') {
            loadAPITokens();
        }
    }, [isOpen, activeTab, tenantId]);

    useEffect(() => {
        const loadPasskeys = async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const q = query(collection(db, 'users', user.uid, 'passkeys'));
                const snapshot = await getDocs(q);
                setPasskeys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (e) {
                console.error("Failed to load passkeys", e);
            }
        };

        if (isOpen && activeTab === 'security') {
            loadPasskeys();
        }
    }, [isOpen, activeTab]);

    const handleRegisterPasskey = async () => {
        setRegisteringPasskey(true);
        try {
            await registerPasskey();
            showSuccess(t('settings.security.passkeys.toast.added'));
            const user = auth.currentUser;
            if (user) {
                const q = query(collection(db, 'users', user.uid, 'passkeys'));
                const snapshot = await getDocs(q);
                setPasskeys(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        } catch (e: any) {
            showError(e.message || t('settings.security.passkeys.toast.error'));
        } finally {
            setRegisteringPasskey(false);
        }
    };

    const handleDeletePasskey = async (id: string, label: string) => {
        if (!await confirm(t('settings.security.passkeys.delete.title'), t('settings.security.passkeys.delete.message').replace('{label}', label || 'Unknown'))) return;
        try {
            const user = auth.currentUser;
            if (!user) return;
            await deleteDoc(doc(db, 'users', user.uid, 'passkeys', id));
            setPasskeys(prev => prev.filter(p => p.id !== id));
            showSuccess(t('settings.security.passkeys.toast.deleted'));
        } catch (e) {
            console.error(e);
            showError(t('settings.security.passkeys.toast.deleteError'));
        }
    };

    const startRenamePasskey = (id: string, currentLabel: string) => {
        setEditingPasskeyId(id);
        setEditingPasskeyLabel(currentLabel || '');
    };

    const cancelRenamePasskey = () => {
        setEditingPasskeyId(null);
        setEditingPasskeyLabel('');
    };

    const handleRenamePasskey = async (id: string) => {
        const newLabel = editingPasskeyLabel.trim();
        if (!newLabel) {
            showError(t('settings.security.passkeys.rename.errors.empty'));
            return;
        }
        const user = auth.currentUser;
        if (!user) return;
        setSavingPasskeyLabel(true);
        try {
            await updateDoc(doc(db, 'users', user.uid, 'passkeys', id), { label: newLabel });
            setPasskeys(prev => prev.map(p => (p.id === id ? { ...p, label: newLabel } : p)));
            showSuccess(t('settings.security.passkeys.rename.toast.renamed'));
            cancelRenamePasskey();
        } catch (e) {
            console.error(e);
            showError(t('settings.security.passkeys.rename.errors.failed'));
        } finally {
            setSavingPasskeyLabel(false);
        }
    };

    const selectedTokenPermissions = TOKEN_PERMISSION_PRESETS[tokenPreset];

    const toDateValue = (value: unknown): Date | null => {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return value;
        }

        if (typeof value === 'string' || typeof value === 'number') {
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        if (typeof value === 'object') {
            const firestoreLike = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
            if (typeof firestoreLike.toDate === 'function') {
                return firestoreLike.toDate();
            }

            if (typeof firestoreLike.seconds === 'number') {
                return new Date(firestoreLike.seconds * 1000);
            }

            if (typeof firestoreLike._seconds === 'number') {
                return new Date(firestoreLike._seconds * 1000);
            }
        }

        return null;
    };

    const formatTokenDate = (value: unknown): string => {
        const parsed = toDateValue(value);
        return parsed ? format(parsed, 'PPP') : t('settings.api.list.unknownDate');
    };

    const permissionLabel = (permission: string) =>
        t(TOKEN_PERMISSION_LABEL_KEYS[permission as APITokenPermission] || permission, permission);

    const handleCreateToken = async () => {
        if (!newTokenName.trim()) {
            showError(t('settings.api.errors.tokenNameRequired'));
            return;
        }
        setCreatingToken(true);
        try {
            const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
            if (!id) {
                throw new Error('Workspace not found');
            }

            const result = await createWorkspaceApiToken(
                id,
                newTokenName.trim(),
                selectedTokenPermissions
            );
            setGeneratedToken(result.token);
            setShowNewTokenModal(true);
            setNewTokenName('');
            // reload tokens
            const tokens = await listWorkspaceApiTokens(id);
            setApiTokens(tokens);
        } catch (error: any) {
            console.error('Failed to create token', error);
            showError(error.message || t('settings.api.errors.createFailed'));
        } finally {
            setCreatingToken(false);
        }
    };

    const handleDeleteToken = async (tokenId: string, tokenName: string) => {
        const confirmed = await confirm(
            t('settings.api.confirm.deleteTitle'),
            t('settings.api.confirm.deleteMessage').replace('{name}', tokenName)
        );
        if (!confirmed) return;

        try {
            const id = tenantId || getActiveTenantId() || auth.currentUser?.uid;
            if (!id) {
                throw new Error('Workspace not found');
            }
            await deleteWorkspaceApiToken(id, tokenId);
            showSuccess(t('settings.api.toast.deleted'));
            const tokens = await listWorkspaceApiTokens(id);
            setApiTokens(tokens);
        } catch (error) {
            showError(t('settings.api.errors.deleteFailed'));
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        } catch (error) {
            showError(t('settings.api.errors.copyFailed'));
        }
    };

    const handleSave = async () => {
        if (!tenantId) return;
        setSaving(true);
        try {
            await updateTenant(tenantId, {
                name,
                description,
                website,
                contactEmail
            });

            await saveWorkspaceSmtpConfig(tenantId, {
                host: smtpHost,
                port: smtpPort,
                user: smtpUser,
                pass: smtpPass,
                useCustom: useCustomSmtp,
                fromEmail: smtpFromEmail
            });

            showSuccess(t('settings.general.toast.saved'));
        } catch (error) {
            console.error("Failed to save settings", error);
            showError(t('settings.general.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const handleSavePreBeta = async () => {
        const user = auth.currentUser;
        if (!user) return;
        setSaving(true);
        try {
            await updateUserData(user.uid, {
                geminiConfig: {
                    apiKey: geminiApiKey,
                    tokenLimit: geminiTokenLimit
                }
            });
            showSuccess(t('settings.prebeta.saved'));
        } catch (e: any) {
            console.error("Failed to save Pre-Alpha settings", e);
            showError(e.message || t('settings.general.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const handleRestartOnboarding = async () => {
        const user = auth.currentUser;
        if (!user) {
            showError(t('settings.general.onboarding.errors.authRequired'));
            return;
        }
        const approved = await confirm(
            t('settings.general.onboarding.confirm.title'),
            t('settings.general.onboarding.confirm.message')
        );
        if (!approved) return;

        try {
            await resetUserOnboarding(user.uid);
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('onboarding_')) {
                    localStorage.removeItem(key);
                }
            });
            showSuccess(t('settings.general.onboarding.toast.restarted'));
        } catch (error) {
            console.error('Failed to reset onboarding', error);
            showError(t('settings.general.onboarding.errors.restartFailed'));
        }
    };

    const handleSendVerification = async () => {
        if (!auth.currentUser) return;
        setSendingVerification(true);
        try {
            await sendEmailVerification(auth.currentUser);
            showSuccess(t('settings.account.emailVerification.sent'));
        } catch (error: any) {
            showError(error.message);
        } finally {
            setSendingVerification(false);
        }
    };

    const handleCheckVerification = async () => {
        if (!auth.currentUser) return;
        setLoading(true);
        try {
            await auth.currentUser.reload();
            setEmailVerified(auth.currentUser.emailVerified);
            if (auth.currentUser.emailVerified) {
                showSuccess(t('settings.account.emailVerification.verified'));
            } else {
                showError(t('settings.account.emailVerification.stillUnverified'));
            }
        } catch (error: any) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const tabs: { id: SettingsTab; label: string; icon: string }[] = [
        { id: 'account', label: t('settings.tabs.account'), icon: 'person' },
        { id: 'preferences', label: t('settings.tabs.preferences'), icon: 'tune' },
        { id: 'security', label: t('settings.tabs.security'), icon: 'security' },
        { id: 'general', label: t('settings.tabs.general'), icon: 'settings' },
        { id: 'roles', label: 'Roles', icon: 'badge' },
        { id: 'api', label: 'API Keys', icon: 'key' } as any,
        { id: 'prebeta', label: t('settings.tabs.prebeta'), icon: 'science' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'roles':
                return <RoleManagement />;
            case 'prebeta':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-display font-bold text-main">{t('settings.prebeta.title')}</h2>
                            <p className="text-muted text-sm mt-1">{t('settings.prebeta.subtitle')}</p>
                        </div>
                        <div className="space-y-6 max-w-4xl">
                            <div className="p-6 rounded-2xl bg-warning/10 text-warning text-sm shadow-sm">
                                <div className="flex items-start gap-4">
                                    <span className="material-symbols-outlined text-2xl shrink-0">warning</span>
                                    <div className="space-y-1.5">
                                        <p className="font-bold text-base">{t('settings.prebeta.notice.title')}</p>
                                        <p className="opacity-90">{t('settings.prebeta.notice.body')}</p>
                                    </div>
                                </div>
                            </div>
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-main">{t('settings.prebeta.title')} Configuration</h3>
                                <div className="space-y-5">
                                    <div>
                                        <Input
                                            label={t('settings.prebeta.apiKey.label')}
                                            type="password"
                                            value={geminiApiKey}
                                            onChange={(e) => setGeminiApiKey(e.target.value)}
                                            placeholder={t('settings.prebeta.apiKey.placeholder')}
                                        />
                                        <p className="text-xs text-muted mt-2">
                                            {t('settings.prebeta.apiKey.helperPrefix')}{' '}
                                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                                                {t('settings.prebeta.apiKey.helperLink')}
                                            </a>
                                            {t('settings.prebeta.apiKey.helperSuffix')}
                                        </p>
                                    </div>
                                    <div>
                                        <Input
                                            label={t('settings.prebeta.tokenLimit.label')}
                                            type="number"
                                            value={geminiTokenLimit}
                                            onChange={(e) => setGeminiTokenLimit(parseInt(e.target.value) || 0)}
                                            placeholder={t('settings.prebeta.tokenLimit.placeholder')}
                                        />
                                        <p className="text-xs text-muted mt-2">
                                            {t('settings.prebeta.tokenLimit.helper')}
                                        </p>
                                    </div>
                                </div>
                            </section>
                            <div className="pt-4 flex justify-end">
                                <Button onClick={handleSavePreBeta} loading={saving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            case 'preferences':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-display font-bold text-main">{t('settings.preferences.title')}</h2>
                            <p className="text-muted text-sm mt-1">{t('settings.preferences.subtitle')}</p>
                        </div>
                        <div className="space-y-6 max-w-4xl">
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-main">{t('settings.preferences.language.label')}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`
                                            flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200
                                            ${language === 'en'
                                                ? 'bg-primary/5 shadow-sm'
                                                : 'bg-surface hover:bg-surface-hover hover:shadow-sm'}
                                        `}
                                    >
                                        <div className="size-10 rounded-full bg-surface-hover flex items-center justify-center font-bold text-sm shrink-0">
                                            EN
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-bold ${language === 'en' ? 'text-primary' : 'text-main'}`}>{t('language.english')}</div>
                                            <div className="text-xs text-muted mt-0.5">{t('settings.preferences.language.englishTag')}</div>
                                        </div>
                                        {language === 'en' && (
                                            <span className="material-symbols-outlined text-primary ml-auto text-xl">check_circle</span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setLanguage('de')}
                                        className={`
                                            flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200
                                            ${language === 'de'
                                                ? 'bg-primary/5 shadow-sm'
                                                : 'bg-surface hover:bg-surface-hover hover:shadow-sm'}
                                        `}
                                    >
                                        <div className="size-10 rounded-full bg-surface-hover flex items-center justify-center font-bold text-sm shrink-0">
                                            DE
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-bold ${language === 'de' ? 'text-primary' : 'text-main'}`}>{t('language.german')}</div>
                                            <div className="text-xs text-muted mt-0.5">{t('settings.preferences.language.germanTag')}</div>
                                        </div>
                                        {language === 'de' && (
                                            <span className="material-symbols-outlined text-primary ml-auto text-xl">check_circle</span>
                                        )}
                                    </button>
                                </div>
                            </section>

                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-5">
                                <h3 className="text-lg font-bold text-main">Regional formatting</h3>
                                <div>
                                    <Select
                                        label={t('settings.preferences.dateFormat.label')}
                                        value={dateFormat}
                                        onChange={(e) => setDateFormat(e.target.value as DateFormat)}
                                        className="max-w-md"
                                    >
                                        {[
                                            'MM/dd/yyyy',
                                            'dd/MM/yyyy',
                                            'dd.MM.yyyy',
                                            'yyyy-MM-dd',
                                            'yyyy/MM/dd',
                                            'd. MMM yyyy',
                                            'MMM d, yyyy',
                                            'MMMM d, yyyy',
                                            'd MMMM yyyy'
                                        ].map((fmt) => (
                                            <option key={fmt} value={fmt}>
                                                {fmt} — ({format(new Date(2025, 11, 28), fmt)})
                                            </option>
                                        ))}
                                    </Select>
                                    <p className="text-xs text-muted mt-2 ml-1">
                                        {t('settings.preferences.dateFormat.helper')}
                                    </p>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'general':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-display font-bold text-main">{t('settings.general.title')}</h2>
                            <p className="text-muted text-sm mt-1">{t('settings.general.subtitle')}</p>
                        </div>

                        <div className="space-y-6 max-w-4xl">
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-main">{t('settings.general.company.title')}</h3>
                                <div className="space-y-5">
                                    <Input
                                        label={t('settings.general.company.name')}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={t('settings.general.company.namePlaceholder')}
                                    />
                                    <Textarea
                                        label={t('settings.general.company.description')}
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t('settings.general.company.descriptionPlaceholder')}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <Input
                                            label={t('settings.general.company.website')}
                                            value={website}
                                            onChange={(e) => setWebsite(e.target.value)}
                                            placeholder="https://"
                                        />
                                        <Input
                                            label={t('settings.general.company.contactEmail')}
                                            value={contactEmail}
                                            onChange={(e) => setContactEmail(e.target.value)}
                                            placeholder="contact@company.com"
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-main">{t('settings.general.smtp.title')}</h3>
                                <div className="space-y-5">
                                    <div className="flex items-center justify-between bg-surface-hover p-4 rounded-xl">
                                        <label className="text-sm font-medium text-main cursor-pointer" onClick={() => setUseCustomSmtp(!useCustomSmtp)}>
                                            {t('settings.general.smtp.useCustom')}
                                        </label>
                                        <Checkbox
                                            checked={useCustomSmtp}
                                            onChange={(checked) => setUseCustomSmtp(checked)}
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {useCustomSmtp && (
                                            <div className="space-y-5 pt-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    <Input
                                                        label={t('settings.general.smtp.host')}
                                                        value={smtpHost}
                                                        onChange={(e) => setSmtpHost(e.target.value)}
                                                        placeholder="smtp.example.com"
                                                    />
                                                    <Input
                                                        label={t('settings.general.smtp.port')}
                                                        type="number"
                                                        value={smtpPort}
                                                        onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                                                        placeholder="587"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                    <Input
                                                        label={t('settings.general.smtp.user')}
                                                        value={smtpUser}
                                                        onChange={(e) => setSmtpUser(e.target.value)}
                                                        placeholder="user@example.com"
                                                    />
                                                    <Input
                                                        label={t('settings.general.smtp.pass')}
                                                        type="password"
                                                        value={smtpPass}
                                                        onChange={(e) => setSmtpPass(e.target.value)}
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                                <Input
                                                    label={t('settings.general.smtp.fromEmail')}
                                                    value={smtpFromEmail}
                                                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                                                    placeholder="noreply@example.com"
                                                    hint={t('settings.general.smtp.fromEmailHint')}
                                                />

                                                <div className="flex items-center gap-4 pt-2">
                                                    <Button
                                                        variant="secondary"
                                                        onClick={handleTestConnection}
                                                        loading={testingConnection}
                                                        className="w-full sm:w-auto"
                                                    >
                                                        {t('settings.email.smtp.testConnection')}
                                                    </Button>

                                                    {connectionStatus === 'success' && (
                                                        <span className="flex items-center gap-1.5 text-emerald-500 text-sm font-medium animate-fade-in">
                                                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                            {t('settings.email.smtp.verified')}
                                                        </span>
                                                    )}

                                                    {connectionStatus === 'error' && (
                                                        <span className="flex items-center gap-1.5 text-rose-500 text-sm font-medium animate-fade-in">
                                                            <span className="material-symbols-outlined text-[18px]">error</span>
                                                            {t('settings.email.smtp.failed')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </section>

                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-main">{t('settings.storage.title')}</h3>
                                <div className="space-y-5">
                                    <Select
                                        label={t('settings.storage.provider.label')}
                                        value={storageActiveProvider}
                                        onChange={(e) => setStorageActiveProvider(e.target.value as 'firebase' | 's3' | 'googleDrive')}
                                    >
                                        <option value="firebase">{t('settings.storage.provider.firebase')}</option>
                                        <option value="s3">{t('settings.storage.provider.s3')}</option>
                                        <option value="googleDrive">{t('settings.storage.provider.googleDrive')}</option>
                                    </Select>

                                    {(storageResolvedProvider !== storageActiveProvider) && (
                                        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-600 font-medium">
                                            {t('settings.storage.fallbackWarning')
                                                .replace('{requested}', storageActiveProvider)
                                                .replace('{resolved}', storageResolvedProvider)}
                                            {storageFallbackReason ? ` (${storageFallbackReason})` : ''}
                                        </div>
                                    )}

                                    {storageActiveProvider === 's3' && (
                                        <div className="space-y-5 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <Input
                                                    label={t('settings.storage.s3.endpoint')}
                                                    value={storageS3Endpoint}
                                                    onChange={(e) => setStorageS3Endpoint(e.target.value)}
                                                    placeholder="https://s3.amazonaws.com"
                                                />
                                                <Input
                                                    label={t('settings.storage.s3.region')}
                                                    value={storageS3Region}
                                                    onChange={(e) => setStorageS3Region(e.target.value)}
                                                    placeholder="us-east-1"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <Input
                                                    label={t('settings.storage.s3.bucket')}
                                                    value={storageS3Bucket}
                                                    onChange={(e) => setStorageS3Bucket(e.target.value)}
                                                    placeholder="my-bucket"
                                                />
                                                <Input
                                                    label={t('settings.storage.s3.pathPrefix')}
                                                    value={storageS3PathPrefix}
                                                    onChange={(e) => setStorageS3PathPrefix(e.target.value)}
                                                    placeholder="projectflow"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <Input
                                                    label={t('settings.storage.s3.accessKeyId')}
                                                    value={storageS3AccessKeyId}
                                                    onChange={(e) => setStorageS3AccessKeyId(e.target.value)}
                                                    placeholder={t('settings.storage.s3.keepExistingHint')}
                                                />
                                                <Input
                                                    label={t('settings.storage.s3.secretAccessKey')}
                                                    type="password"
                                                    value={storageS3SecretAccessKey}
                                                    onChange={(e) => setStorageS3SecretAccessKey(e.target.value)}
                                                    placeholder={t('settings.storage.s3.keepExistingHint')}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between bg-surface-hover p-4 rounded-xl">
                                                <label className="text-sm font-medium text-main cursor-pointer" onClick={() => setStorageS3ForcePathStyle(!storageS3ForcePathStyle)}>
                                                    {t('settings.storage.s3.forcePathStyle')}
                                                </label>
                                                <Checkbox
                                                    checked={storageS3ForcePathStyle}
                                                    onChange={(checked) => setStorageS3ForcePathStyle(checked)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {storageActiveProvider === 'googleDrive' && (
                                        <div className="space-y-4 pt-2">
                                            <div className="text-sm font-medium text-muted bg-surface-hover p-4 rounded-xl">
                                                {storageDriveConnected
                                                    ? t('settings.storage.googleDrive.connectedAs').replace('{email}', storageDriveEmail || t('settings.storage.googleDrive.unknownAccount'))
                                                    : t('settings.storage.googleDrive.notConnected')}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <Input
                                                    label={t('settings.storage.googleDrive.folderId')}
                                                    value={storageDriveFolderId}
                                                    onChange={(e) => setStorageDriveFolderId(e.target.value)}
                                                    placeholder={t('settings.storage.googleDrive.autoFolderHint')}
                                                />
                                                <Input
                                                    label={t('settings.storage.googleDrive.folderName')}
                                                    value={storageDriveFolderName}
                                                    onChange={(e) => setStorageDriveFolderName(e.target.value)}
                                                    placeholder="ProjectFlow Workspace"
                                                />
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    variant="secondary"
                                                    onClick={handleConnectGoogleDriveStorage}
                                                    loading={storageConnectingDrive}
                                                >
                                                    {t('settings.storage.googleDrive.connect')}
                                                </Button>
                                                {storageDriveConnected && (
                                                    <Button
                                                        variant="ghost"
                                                        onClick={handleDisconnectGoogleDriveStorage}
                                                        loading={storageConnectingDrive}
                                                    >
                                                        {t('settings.storage.googleDrive.disconnect')}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 pt-2">
                                        <Button
                                            variant="secondary"
                                            onClick={handleTestStorageConnection}
                                            loading={storageTesting}
                                            disabled={storageLoading}
                                        >
                                            {t('settings.storage.test')}
                                        </Button>
                                        <Button
                                            onClick={handleSaveStorageConfig}
                                            loading={storageSaving}
                                            disabled={storageLoading}
                                        >
                                            {t('settings.storage.save')}
                                        </Button>
                                    </div>
                                    {storageStatusMessage && (
                                        <p className="text-sm text-muted bg-surface-hover p-3 rounded-xl">{storageStatusMessage}</p>
                                    )}
                                </div>
                            </section>

                            <section className="flex items-center justify-between p-6 bg-surface-card shadow-sm rounded-2xl">
                                <div>
                                    <h3 className="font-bold text-main">{t('settings.general.onboarding.title')}</h3>
                                    <p className="text-sm text-muted mt-1 max-w-sm">{t('settings.general.onboarding.description')}</p>
                                </div>
                                <Button variant="secondary" onClick={handleRestartOnboarding}>
                                    {t('settings.general.onboarding.button')}
                                </Button>
                            </section>

                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-surface pb-2 z-10">
                                <Button onClick={handleSave} loading={saving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            case 'account':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-display font-bold text-main">{t('settings.account.title')}</h2>
                            <p className="text-muted text-sm mt-1">{t('settings.account.subtitle')}</p>
                        </div>

                        <div className="space-y-6 max-w-4xl">
                            {/* Email Verification */}
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-bold text-main flex items-center gap-3 text-lg">
                                            {t('settings.account.emailVerification.title')}
                                            {emailVerified ? (
                                                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-medium tracking-wide">
                                                    {t('settings.account.emailVerification.verified')}
                                                </span>
                                            ) : (
                                                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 font-medium tracking-wide">
                                                    {t('settings.account.emailVerification.unverified')}
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-sm text-muted mt-1">{auth.currentUser?.email}</p>
                                    </div>
                                    {!emailVerified && (
                                        <div className="flex flex-col gap-2">
                                            <Button
                                                size="sm"
                                                onClick={handleSendVerification}
                                                loading={sendingVerification}
                                            >
                                                {t('settings.account.emailVerification.sendButton')}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleCheckVerification}
                                            >
                                                {t('settings.account.emailVerification.checkButton')}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Connected Accounts */}
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-5">
                                <h3 className="text-lg font-bold text-main">{t('settings.account.connected.title')}</h3>
                                <div className="space-y-3">
                                    {/* GitHub */}
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-hover transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
                                                <i className="devicon-github-original text-2xl"></i>
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-main">GitHub</div>
                                                <div className="text-xs text-muted mt-0.5">
                                                    {githubLinked
                                                        ? t('settings.account.connected.connected')
                                                        : providers.includes('github.com')
                                                            ? t('settings.account.github.loginLinked')
                                                            : t('settings.account.connected.notConnected')}
                                                </div>
                                            </div>
                                        </div>
                                        {githubLinked || providers.includes('github.com') ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                                                onClick={handleDisconnectGithub}
                                                loading={disconnectingGithub}
                                            >
                                                {t('settings.account.github.disconnect')}
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" size="sm" onClick={handleConnectGithub} loading={connectingGithub}>
                                                {t('settings.account.connected.connect')}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Google */}
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface-hover transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                                                <img src="https://www.google.com/favicon.ico" alt="Google" className="size-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-main">Google</div>
                                                <div className="text-xs text-muted mt-0.5">
                                                    {providers.includes('google.com')
                                                        ? t('settings.account.connected.connected')
                                                        : t('settings.account.connected.notConnected')}
                                                </div>
                                            </div>
                                        </div>
                                        {providers.includes('google.com') ? (
                                            <Button variant="ghost" disabled size="sm" className="text-emerald-500">
                                                <span className="material-symbols-outlined mr-1 text-lg">check_circle</span>
                                                {t('settings.account.connected.linked')}
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" size="sm" onClick={handleConnectGoogle} loading={connectingGoogle}>
                                                {t('settings.account.connected.connect')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Password Management */}
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-main">{t('settings.account.password.title')}</h3>
                                        <p className="text-sm text-muted mt-1">
                                            {providers.includes('password')
                                                ? t('settings.account.password.description.manage')
                                                : t('settings.account.password.description.set')}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            setShowSetPassword(!showSetPassword);
                                            setIsChangingPassword(providers.includes('password'));
                                        }}
                                    >
                                        {providers.includes('password') ? t('settings.account.password.changeButton') : t('settings.account.password.setButton')}
                                    </Button>
                                </div>

                                {showSetPassword && (
                                    <div className="bg-surface-hover p-6 rounded-2xl mt-6 animate-fade-in space-y-5">
                                        <Input
                                            label={t('settings.account.password.newPassword')}
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="••••••••"
                                        />
                                        <Input
                                            label={t('settings.account.password.confirmPassword')}
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="••••••••"
                                        />
                                        <div className="flex justify-end gap-3 pt-2">
                                            <Button variant="ghost" onClick={() => setShowSetPassword(false)}>
                                                {t('common.cancel')}
                                            </Button>
                                            <Button onClick={handleUpdatePassword} loading={settingPassword}>
                                                {isChangingPassword ? t('settings.account.password.updateButton') : t('settings.account.password.setConfirmButton')}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            case 'security':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-display font-bold text-main">{t('settings.security.title')}</h2>
                            <p className="text-muted text-sm mt-1">{t('settings.security.subtitle')}</p>
                        </div>

                        <div className="space-y-6 max-w-4xl">
                            {/* Two Factor Auth */}
                            <section className="flex items-center justify-between p-6 bg-surface-card shadow-sm rounded-2xl">
                                <div>
                                    <h3 className="font-bold text-main text-lg">{t('settings.security.2fa.title')}</h3>
                                    <p className="text-sm text-muted mt-1">
                                        {twoFactorEnabled
                                            ? t('settings.security.2fa.enabled')
                                            : t('settings.security.2fa.disabled')}
                                    </p>
                                </div>
                                <Button
                                    variant={twoFactorEnabled ? 'secondary' : 'primary'}
                                    onClick={() => setShowTwoFactorModal(true)}
                                >
                                    {twoFactorEnabled
                                        ? t('settings.security.2fa.manageButton')
                                        : t('settings.security.2fa.enableButton')}
                                </Button>
                            </section>

                            {/* Passkeys */}
                            <section className="p-6 bg-surface-card shadow-sm rounded-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-lg font-bold text-main">{t('settings.security.passkeys.title')}</h3>
                                        <p className="text-sm text-muted mt-1">
                                            {t('settings.security.passkeys.description')}
                                        </p>
                                    </div>
                                    <Button onClick={handleRegisterPasskey} loading={registeringPasskey}>
                                        <span className="material-symbols-outlined mr-2">fingerprint</span>
                                        {t('settings.security.passkeys.addButton')}
                                    </Button>
                                </div>

                                {passkeys.length > 0 ? (
                                    <div className="space-y-3">
                                        {passkeys.map((key) => (
                                            <div key={key.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-hover transition-colors">
                                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                                    <div className="size-10 shrink-0 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-xl">passkey</span>
                                                    </div>
                                                    {editingPasskeyId === key.id ? (
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <Input
                                                                value={editingPasskeyLabel}
                                                                onChange={(e) => setEditingPasskeyLabel(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') { e.preventDefault(); handleRenamePasskey(key.id); }
                                                                    if (e.key === 'Escape') { e.preventDefault(); cancelRenamePasskey(); }
                                                                }}
                                                                placeholder={t('settings.security.passkeys.rename.placeholder')}
                                                                autoFocus
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-sm text-main truncate">{key.label || 'Passkey'}</div>
                                                            <div className="text-xs text-muted mt-0.5">
                                                                {t('settings.security.passkeys.created')}: {key.createdAt?.toDate ? format(key.createdAt.toDate(), 'PPP') : 'Unknown'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {editingPasskeyId === key.id ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                loading={savingPasskeyLabel}
                                                                onClick={() => handleRenamePasskey(key.id)}
                                                                aria-label={t('settings.security.passkeys.rename.save')}
                                                            >
                                                                <span className="material-symbols-outlined">check</span>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={savingPasskeyLabel}
                                                                onClick={cancelRenamePasskey}
                                                                aria-label={t('common.cancel')}
                                                            >
                                                                <span className="material-symbols-outlined">close</span>
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => startRenamePasskey(key.id, key.label)}
                                                                aria-label={t('settings.security.passkeys.rename.action')}
                                                            >
                                                                <span className="material-symbols-outlined">edit</span>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                                                                onClick={() => handleDeletePasskey(key.id, key.label)}
                                                                aria-label={t('settings.security.passkeys.delete.title')}
                                                            >
                                                                <span className="material-symbols-outlined">delete</span>
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center rounded-2xl border-2 border-dashed border-surface bg-surface-hover/30">
                                        <span className="material-symbols-outlined text-4xl text-muted mb-3 opacity-50">fingerprint</span>
                                        <p className="text-sm text-muted font-medium">{t('settings.security.passkeys.empty')}</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            case 'api':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="mb-8">
                            <h2 className="text-2xl font-display font-bold text-main">{t('settings.api.title')}</h2>
                            <p className="text-muted text-sm mt-1">{t('settings.api.subtitle')}</p>
                        </div>

                        <div className="space-y-6 max-w-4xl">
                            {/* Create Token Section */}
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm space-y-6">
                                <h3 className="font-bold text-main text-lg">{t('settings.api.create.title')}</h3>
                                <div className="space-y-6">
                                    <Input
                                        value={newTokenName}
                                        onChange={(e) => setNewTokenName(e.target.value)}
                                        placeholder={t('settings.api.create.placeholder')}
                                        className="w-full max-w-md"
                                    />

                                    <div className="space-y-3">
                                        <label className="text-xs uppercase tracking-wider text-muted font-bold">
                                            {t('settings.api.create.presetLabel')}
                                        </label>
                                        <div className="grid gap-3 md:grid-cols-3">
                                            {TOKEN_PRESET_KEYS.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => setTokenPreset(preset.id)}
                                                    className={`rounded-xl p-4 text-left transition-all duration-200 ${
                                                        tokenPreset === preset.id
                                                            ? 'bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                                                            : 'bg-surface hover:bg-surface-hover shadow-sm'
                                                    }`}
                                                >
                                                    <div className="font-bold text-sm text-main">
                                                        {t(preset.titleKey)}
                                                        {preset.recommended && (
                                                            <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                                                {t('settings.api.create.presets.recommended')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted mt-1.5 leading-relaxed">{t(preset.descriptionKey)}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {selectedTokenPermissions.map((permission) => (
                                            <span
                                                key={permission}
                                                className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                                            >
                                                {permissionLabel(permission)}
                                            </span>
                                        ))}
                                    </div>

                                    {hasDestructiveScope(selectedTokenPermissions) && (
                                        <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 font-medium">
                                            {t('settings.api.create.destructiveWarning')}
                                        </div>
                                    )}

                                    <div className="flex justify-end pt-2">
                                        <Button onClick={handleCreateToken} loading={creatingToken}>
                                            {t('settings.api.create.button')}
                                        </Button>
                                    </div>
                                </div>
                            </section>

                            {/* Token List */}
                            <section className="p-6 rounded-2xl bg-surface-card shadow-sm">
                                <h3 className="text-lg font-bold text-main mb-6">{t('settings.api.list.title')}</h3>
                                {loadingTokens ? (
                                    <div className="flex justify-center p-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                ) : apiTokens.length > 0 ? (
                                    <div className="space-y-3">
                                        {apiTokens.map((token) => (
                                            <div key={token.id} className="flex items-center justify-between p-4 rounded-xl bg-surface-hover transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="font-bold text-sm text-main">{token.name}</div>
                                                        <div className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold tracking-wide">
                                                            {token.tokenPrefix}...
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted mt-1.5">
                                                        {t('settings.api.list.created')}: {formatTokenDate(token.createdAt)} • {t('settings.api.list.lastUsed')}: {token.lastUsedAt ? formatTokenDate(token.lastUsedAt) : t('settings.api.list.neverUsed')}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {(token.permissions || []).map((permission) => (
                                                            <span
                                                                key={`${token.id}-${permission}`}
                                                                className="rounded-full bg-surface-card px-2.5 py-1 text-[10px] font-medium text-muted shadow-sm"
                                                            >
                                                                {permissionLabel(permission)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                                                    onClick={() => handleDeleteToken(token.id, token.name)}
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center rounded-2xl border-2 border-dashed border-surface bg-surface-hover/30">
                                        <span className="material-symbols-outlined text-4xl text-muted mb-3 opacity-50">key_off</span>
                                        <p className="text-sm text-muted font-medium">{t('settings.api.list.empty')}</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <React.Fragment>
            <Modal isOpen={isOpen} onClose={onClose} title={settingsTranslationsReady ? (t('settings.title') || 'Settings') : 'Settings'} size="4xl">
                {isOpen && !settingsTranslationsReady ? (
                    <div className="flex h-[80vh] items-center justify-center">
                        <span className="material-symbols-outlined animate-spin text-3xl text-muted">progress_activity</span>
                    </div>
                ) : (
                    <div className="flex h-[80vh] -m-6 rounded-b-2xl overflow-hidden bg-surface-bg">
                        {/* Sidebar */}
                        <div className="w-64 shrink-0 bg-surface-hover/30 p-4 flex flex-col gap-1 overflow-y-auto">
                            <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2 px-3 pt-2">
                                Configuration
                            </div>
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200
                                        ${activeTab === tab.id
                                            ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                                            : 'text-muted hover:bg-surface-card hover:text-main'}
                                    `}
                                >
                                    <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? 'fill' : ''}`}>{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex flex-col min-w-0 bg-surface-bg">
                            <div className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin">
                                {renderContent()}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Generated Token Modal */}
            <Modal
                isOpen={showNewTokenModal}
                onClose={() => {
                    setShowNewTokenModal(false);
                    setGeneratedToken(null);
                }}
                title={t('settings.api.successModal.title')}
            >
                <div className="space-y-4">
                    <div className="text-sm text-muted">
                        {t('settings.api.successModal.message')}
                    </div>

                    <div className="p-4 rounded-lg bg-surface-hover border border-surface break-all font-mono text-sm relative group">
                        {generatedToken}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" onClick={() => generatedToken && copyToClipboard(generatedToken)}>
                                {copiedToken ? t('settings.api.successModal.copied') : t('settings.api.successModal.copy')}
                            </Button>
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-start gap-2">
                        <span className="material-symbols-outlined text-lg">warning</span>
                        <span>{t('settings.api.successModal.warning')}</span>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button onClick={() => {
                            setShowNewTokenModal(false);
                            setGeneratedToken(null);
                        }}>
                            {t('common.done')}
                        </Button>
                    </div>
                </div>
            </Modal>

            <TwoFactorSetupModal
                isOpen={showTwoFactorModal}
                onClose={() => setShowTwoFactorModal(false)}
            />

            <TwoFactorChallengeModal
                isOpen={showGithubMfaModal}
                onClose={() => {
                    setShowGithubMfaModal(false);
                    setGithubMfaResolver(null);
                }}
                resolver={githubMfaResolver}
                onSuccess={handleGithubMfaSuccess}
            />
        </React.Fragment>
    );
};
