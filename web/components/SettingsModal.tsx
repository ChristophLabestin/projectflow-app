import React, { useState, useEffect } from 'react';
import { remove } from 'firebase/database';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { useToast, useConfirm } from '../context/UIContext';
import { getActiveTenantId, getTenant, updateTenant, getAIUsage, getTenantSecret, updateTenantSecret, createAPIToken, getAPITokens, deleteAPIToken, updateUserData } from '../services/dataService';
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
    sendEmailVerification
} from 'firebase/auth';
import { format } from 'date-fns';
import { getUserProfile, linkWithGithub, resetUserOnboarding } from '../services/dataService';
import { registerPasskey, shouldAutoPrompt } from '../services/passkeyService';
import { Checkbox } from './ui/Checkbox';
import { AnimatePresence } from 'framer-motion';
import { Modal } from './ui/Modal';
import { RoleManagement } from './settings/RoleManagement';

import { DateFormat, useLanguage } from '../context/LanguageContext';

type SettingsTab = 'account' | 'preferences' | 'security' | 'general' | 'roles' | 'api' | 'billing' | 'email' | 'integrations' | 'prebeta';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialTab = 'account' }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
    const { language, setLanguage, dateFormat, setDateFormat, t } = useLanguage();
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

    // API Token State
    const [apiTokens, setApiTokens] = useState<any[]>([]);
    const [loadingTokens, setLoadingTokens] = useState(false);
    const [creatingToken, setCreatingToken] = useState(false);
    const [newTokenName, setNewTokenName] = useState('');
    const [showNewTokenModal, setShowNewTokenModal] = useState(false);
    const [generatedToken, setGeneratedToken] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState(false);

    // Security State
    const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
    const [passkeys, setPasskeys] = useState<any[]>([]);
    const [registeringPasskey, setRegisteringPasskey] = useState(false);
    const [autoPromptEnabled, setAutoPromptEnabled] = useState(shouldAutoPrompt());

    // Account Management State
    const [githubLinked, setGithubLinked] = useState(false);
    const [connectingGithub, setConnectingGithub] = useState(false);
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
        }
    }, [isOpen, initialTab]);

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
        await updateTenantSecret(id, 'smtp', {
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
                    if (data.smtpConfig) {
                        setSmtpHost(data.smtpConfig.host || '');
                        setSmtpPort(data.smtpConfig.port || 587);
                        setSmtpUser(data.smtpConfig.user || '');
                        setSmtpPass(data.smtpConfig.pass || '');
                        setUseCustomSmtp(data.smtpConfig.useCustom || false);
                        setSmtpFromEmail(data.smtpConfig.fromEmail || '');
                    }

                    const smtpSecret = await getTenantSecret(id, 'smtp');
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
                const tokens = await getAPITokens();
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
    }, [isOpen, activeTab]);

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

    const handleCreateToken = async () => {
        if (!newTokenName.trim()) {
            showError(t('settings.api.errors.tokenNameRequired'));
            return;
        }
        setCreatingToken(true);
        try {
            const result = await createAPIToken(
                newTokenName.trim(),
                ['newsletter:write'] as APITokenPermission[]
            );
            setGeneratedToken(result.token);
            setShowNewTokenModal(true);
            setNewTokenName('');
            // reload tokens
            const tokens = await getAPITokens();
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
            await deleteAPIToken(tokenId);
            showSuccess(t('settings.api.toast.deleted'));
            const tokens = await getAPITokens();
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

            await updateTenantSecret(tenantId, 'smtp', {
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
                        <div>
                            <h2 className="text-xl font-display font-bold text-main">{t('settings.prebeta.title')}</h2>
                            <p className="text-muted text-sm">{t('settings.prebeta.subtitle')}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-sm">
                            <div className="flex items-start gap-3">
                                <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">warning</span>
                                <div className="space-y-1">
                                    <p className="font-bold">{t('settings.prebeta.notice.title')}</p>
                                    <p>{t('settings.prebeta.notice.body')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-8 max-w-4xl">
                            <section className="space-y-4">
                                <Input
                                    label={t('settings.prebeta.apiKey.label')}
                                    type="password"
                                    value={geminiApiKey}
                                    onChange={(e) => setGeminiApiKey(e.target.value)}
                                    placeholder={t('settings.prebeta.apiKey.placeholder')}
                                />
                                <p className="text-xs text-muted">
                                    {t('settings.prebeta.apiKey.helperPrefix')}{' '}
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                        {t('settings.prebeta.apiKey.helperLink')}
                                    </a>
                                    {t('settings.prebeta.apiKey.helperSuffix')}
                                </p>
                                <div className="pt-2"></div>
                                <Input
                                    label={t('settings.prebeta.tokenLimit.label')}
                                    type="number"
                                    value={geminiTokenLimit}
                                    onChange={(e) => setGeminiTokenLimit(parseInt(e.target.value) || 0)}
                                    placeholder={t('settings.prebeta.tokenLimit.placeholder')}
                                />
                                <p className="text-xs text-muted">
                                    {t('settings.prebeta.tokenLimit.helper')}
                                </p>
                            </section>
                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-surface pb-2 z-10 border-t border-surface">
                                <Button onClick={handleSavePreBeta} loading={saving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
                        </div >
                    </div >
                );
            case 'preferences':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-main">{t('settings.preferences.title')}</h2>
                            <p className="text-muted text-sm">{t('settings.preferences.subtitle')}</p>
                        </div>
                        <div className="space-y-8">
                            <section className="space-y-3">
                                <label className="text-sm font-bold text-main block">
                                    {t('settings.preferences.language.label')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                            ${language === 'en'
                                                ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                                : 'bg-surface border-surface hover:bg-surface-hover'}
                                        `}
                                    >
                                        <div className="size-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                                            EN
                                        </div>
                                        <div>
                                            <div className={`font-medium ${language === 'en' ? 'text-primary' : 'text-main'}`}>{t('language.english')}</div>
                                            <div className="text-xs text-muted">{t('settings.preferences.language.englishTag')}</div>
                                        </div>
                                        {language === 'en' && (
                                            <span className="material-symbols-outlined text-primary ml-auto">check_circle</span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setLanguage('de')}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                            ${language === 'de'
                                                ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                                : 'bg-surface border-surface hover:bg-surface-hover'}
                                        `}
                                    >
                                        <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0">
                                            DE
                                        </div>
                                        <div>
                                            <div className={`font-medium ${language === 'de' ? 'text-primary' : 'text-main'}`}>{t('language.german')}</div>
                                            <div className="text-xs text-muted">{t('settings.preferences.language.germanTag')}</div>
                                        </div>
                                        {language === 'de' && (
                                            <span className="material-symbols-outlined text-primary ml-auto">check_circle</span>
                                        )}
                                    </button>
                                </div>
                            </section>

                            <section className="space-y-3">
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
                                <p className="text-[10px] text-muted ml-1">
                                    {t('settings.preferences.dateFormat.helper')}
                                </p>
                            </section>
                        </div>
                    </div>
                );
            case 'general':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-main">{t('settings.general.title')}</h2>
                            <p className="text-muted text-sm">{t('settings.general.subtitle')}</p>
                        </div>

                        <div className="space-y-8">
                            <section>
                                <h3 className="text-lg font-bold text-main mb-4 pb-2 border-b border-surface">{t('settings.general.company.title')}</h3>
                                <div className="space-y-4">
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                            <section>
                                <h3 className="text-lg font-bold text-main mb-4 pb-2 border-b border-surface">{t('settings.general.smtp.title')}</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-main">{t('settings.general.smtp.useCustom')}</label>
                                        <Checkbox
                                            checked={useCustomSmtp}
                                            onChange={(checked) => setUseCustomSmtp(checked)}
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {useCustomSmtp && (
                                            <div className="space-y-4 pt-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                                                <div className="flex items-center gap-3 pt-2">
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

                            <section className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-surface">
                                <div>
                                    <h3 className="font-bold text-main text-sm">{t('settings.general.onboarding.title')}</h3>
                                    <p className="text-xs text-muted mt-1 max-w-sm">{t('settings.general.onboarding.description')}</p>
                                </div>
                                <Button variant="secondary" onClick={handleRestartOnboarding}>
                                    {t('settings.general.onboarding.button')}
                                </Button>

                            </section>

                            <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-surface pb-2 z-10 border-t border-surface">
                                <Button onClick={handleSave} loading={saving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
                        </div >
                    </div >
                );
            case 'account':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-main">{t('settings.account.title')}</h2>
                            <p className="text-muted text-sm">{t('settings.account.subtitle')}</p>
                        </div>

                        <div className="space-y-8">
                            {/* Email Verification */}
                            <section>
                                <div className="p-4 rounded-xl bg-surface-hover border border-surface">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-bold text-main flex items-center gap-2">
                                                {t('settings.account.emailVerification.title')}
                                                {emailVerified ? (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium border border-emerald-500/20">
                                                        {t('settings.account.emailVerification.verified')}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium border border-amber-500/20">
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
                                </div>
                            </section>

                            {/* Connected Accounts */}
                            <section>
                                <h3 className="text-lg font-bold text-main mb-4 pb-2 border-b border-surface">{t('settings.account.connected.title')}</h3>
                                <div className="space-y-3">
                                    {/* GitHub */}
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-surface bg-surface">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
                                                <i className="devicon-github-original text-2xl"></i>
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-main">GitHub</div>
                                                <div className="text-xs text-muted">
                                                    {providers.includes('github.com') || githubLinked
                                                        ? t('settings.account.connected.connected')
                                                        : t('settings.account.connected.notConnected')}
                                                </div>
                                            </div>
                                        </div>
                                        {providers.includes('github.com') || githubLinked ? (
                                            <Button variant="ghost" disabled size="sm" className="text-emerald-500">
                                                <span className="material-symbols-outlined mr-1 text-lg">check</span>
                                                {t('settings.account.connected.linked')}
                                            </Button>
                                        ) : (
                                            <Button variant="secondary" size="sm" onClick={handleConnectGithub} loading={connectingGithub}>
                                                {t('settings.account.connected.connect')}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Google */}
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-surface bg-surface">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                                                <img src="https://www.google.com/favicon.ico" alt="Google" className="size-5" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-main">Google</div>
                                                <div className="text-xs text-muted">
                                                    {providers.includes('google.com')
                                                        ? t('settings.account.connected.connected')
                                                        : t('settings.account.connected.notConnected')}
                                                </div>
                                            </div>
                                        </div>
                                        {providers.includes('google.com') ? (
                                            <Button variant="ghost" disabled size="sm" className="text-emerald-500">
                                                <span className="material-symbols-outlined mr-1 text-lg">check</span>
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
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-main">{t('settings.account.password.title')}</h3>
                                        <p className="text-xs text-muted">
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
                                    <div className="bg-surface-hover p-4 rounded-xl border border-surface animate-fade-in space-y-4">
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
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="ghost" size="sm" onClick={() => setShowSetPassword(false)}>
                                                {t('common.cancel')}
                                            </Button>
                                            <Button onClick={handleUpdatePassword} loading={settingPassword} size="sm">
                                                {isChangingPassword ? t('settings.account.password.updateButton') : t('settings.account.password.setConfirmButton')}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div >
                    </div >
                );
            case 'security':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-main">{t('settings.security.title')}</h2>
                            <p className="text-muted text-sm">{t('settings.security.subtitle')}</p>
                        </div>

                        <div className="space-y-8">
                            {/* Two Factor Auth */}
                            <section className="flex items-center justify-between p-4 bg-surface-hover rounded-xl border border-surface">
                                <div>
                                    <h3 className="font-bold text-main">{t('settings.security.2fa.title')}</h3>
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
                            <section>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-main">{t('settings.security.passkeys.title')}</h3>
                                        <p className="text-xs text-muted mt-1">
                                            {t('settings.security.passkeys.description')}
                                        </p>
                                    </div>
                                    <Button onClick={handleRegisterPasskey} loading={registeringPasskey}>
                                        <span className="material-symbols-outlined mr-2">fingerprint</span>
                                        {t('settings.security.passkeys.addButton')}
                                    </Button>
                                </div>

                                {passkeys.length > 0 ? (
                                    <div className="space-y-2">
                                        {passkeys.map((key) => (
                                            <div key={key.id} className="flex items-center justify-between p-3 rounded-lg border border-surface bg-surface">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-lg">passkey</span>
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-sm text-main">{key.label || 'Passkey'}</div>
                                                        <div className="text-xs text-muted">
                                                            {t('settings.security.passkeys.created')}: {key.createdAt?.toDate ? format(key.createdAt.toDate(), 'PPP') : 'Unknown'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10"
                                                    onClick={() => handleDeletePasskey(key.id, key.label)}
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center rounded-xl border border-dashed border-surface bg-surface/50">
                                        <span className="material-symbols-outlined text-3xl text-muted mb-2">fingerprint</span>
                                        <p className="text-sm text-muted">{t('settings.security.passkeys.empty')}</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            case 'api': // Should match the id in tabs array, even if TS complains about SettingsTab type not including it yet
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-main">{t('settings.api.title')}</h2>
                            <p className="text-muted text-sm">{t('settings.api.subtitle')}</p>
                        </div>

                        <div className="space-y-8 max-w-4xl">
                            {/* Create Token Section */}
                            <section className="p-4 rounded-xl bg-surface-hover border border-surface space-y-4">
                                <h3 className="font-bold text-main">{t('settings.api.create.title')}</h3>
                                <div className="flex gap-2">
                                    <Input
                                        value={newTokenName}
                                        onChange={(e) => setNewTokenName(e.target.value)}
                                        placeholder={t('settings.api.create.placeholder')}
                                        className="flex-1"
                                    />
                                    <Button onClick={handleCreateToken} loading={creatingToken}>
                                        {t('settings.api.create.button')}
                                    </Button>
                                </div>
                            </section>

                            {/* Token List */}
                            <section>
                                <h3 className="text-lg font-bold text-main mb-4 pb-2 border-b border-surface">{t('settings.api.list.title')}</h3>
                                {loadingTokens ? (
                                    <div className="flex justify-center p-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                ) : apiTokens.length > 0 ? (
                                    <div className="space-y-3">
                                        {apiTokens.map((token) => (
                                            <div key={token.id} className="flex items-center justify-between p-4 rounded-xl border border-surface bg-surface">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-bold text-sm text-main">{token.name}</div>
                                                        <div className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                            {token.prefix}...
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-muted mt-1">
                                                        {t('settings.api.list.created')}: {format(new Date(token.createdAt), 'PPP')} • {t('settings.api.list.lastUsed')}: {token.lastUsedAt ? format(new Date(token.lastUsedAt), 'PPP') : t('settings.api.list.neverUsed')}
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
                                    <div className="p-8 text-center rounded-xl border border-dashed border-surface bg-surface/50">
                                        <span className="material-symbols-outlined text-3xl text-muted mb-2">key_off</span>
                                        <p className="text-sm text-muted">{t('settings.api.list.empty')}</p>
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
            <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title') || 'Settings'} size="4xl">
                <div className="flex h-[80vh] -m-6">
                    {/* Sidebar */}
                    <div className="w-64 shrink-0 bg-surface-hover/50 border-r border-surface p-4 flex flex-col gap-1 overflow-y-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                                    ${activeTab === tab.id
                                        ? 'bg-primary text-on-primary shadow-md shadow-primary/20'
                                        : 'text-muted hover:bg-surface-hover hover:text-main'}
                                `}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? 'fill' : ''}`}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 bg-surface">
                        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin">
                            {renderContent()}
                        </div>
                    </div>
                </div>
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
                                {copiedToken ? 'Copied!' : 'Copy'}
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
        </React.Fragment>
    );
};
