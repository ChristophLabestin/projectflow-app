import { Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { remove } from 'firebase/database';
import { collection, query, getDocs, deleteDoc, doc } from 'firebase/firestore';
import ReactDOM from 'react-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { useToast, useConfirm } from '../context/UIContext';
import { getActiveTenantId, getTenant, updateTenant, getAIUsage, getTenantSecret, updateTenantSecret, createAPIToken, getAPITokens, deleteAPIToken, updateUserData } from '../services/dataService';
import { auth, functions, db } from '../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { Tenant, AIUsage, APITokenPermission } from '../types';

import { TwoFactorSetupModal } from '../components/modals/TwoFactorSetupModal';
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
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';
import { registerPasskey, shouldAutoPrompt, setAutoPrompt } from '../services/passkeyService';
import { Checkbox } from '../components/ui/Checkbox';

type SettingsTab = 'account' | 'preferences' | 'security' | 'general' | 'billing' | 'email' | 'integrations' | 'prebeta';

import { DateFormat, useLanguage } from '../context/LanguageContext';

export const Settings = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');
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

    // Pre-Beta State
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

    // Derived status for indicator
    // Blank: (!useCustomSmtp || (!smtpHost && !smtpUser && !smtpPass))
    // Orange: (hasCredentials && connectionStatus === null)
    // Green: (connectionStatus === 'success')
    // Red: (connectionStatus === 'error')

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
        loadAccountStatus();
    }, [activeTab]);

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
        setConnectionStatus(null); // Reset before test
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

    // Helper to save verified status to Firebase
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
        // Update saved config so changes are tracked from this point
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

                    // Check for Secure SMTP Config (overrides basic config if present)
                    const smtpSecret = await getTenantSecret(id, 'smtp');
                    if (smtpSecret) {
                        setSmtpHost(smtpSecret.host || '');
                        setSmtpPort(smtpSecret.port || 587);
                        setSmtpUser(smtpSecret.user || '');
                        setSmtpPass(smtpSecret.pass || '');
                        setUseCustomSmtp(smtpSecret.useCustom || false);
                        setSmtpFromEmail(smtpSecret.fromEmail || '');
                        // Load verified status
                        if (smtpSecret.verified === true) {
                            setConnectionStatus('success');
                        }
                        // Save for change detection
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
                // GitHub token logic removed - moved to Profile Settings
            }
        };

        const load2FAStatus = () => {
            const user = auth.currentUser;
            if (user) {
                const enrolledFactors = multiFactor(user).enrolledFactors;
                setTwoFactorEnabled(enrolledFactors.length > 0);
            }
        };

        loadSettings();
        loadAIUsage();
        load2FAStatus();
    }, []);

    // Load API tokens when API tab is active
    useEffect(() => {
        if (activeTab === 'api') {
            loadAPITokens();
        }
    }, [activeTab]);

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

        if (activeTab === 'security') {
            loadPasskeys();
        }
    }, [activeTab]);

    const handleRegisterPasskey = async () => {
        setRegisteringPasskey(true);
        try {
            await registerPasskey();
            showSuccess(t('settings.security.passkeys.toast.added'));
            // Reload
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
            await loadAPITokens();
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
            await loadAPITokens();
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

            // Save SMTP Settings securely
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

            // Clear all local storage keys related to onboarding
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

    if (loading) {
        return <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">{t('settings.loading')}</div>;
    }

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
            console.error("Failed to save Pre-Beta settings", e);
            showError(e.message || t('settings.general.errors.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'prebeta':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* 
                         * PRE-BETA SETTINGS
                         * TODO: Remove this entire case and the 'prebeta' option from SettingsTab type before Release 1.0.
                         * This is a temporary measure to allow users to bring their own API keys during pre-beta testing.
                         * For production, we will use the system key and enforce billing limits.
                         */}
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.prebeta.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.prebeta.subtitle')}</p>
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

                        <Card className="p-6 space-y-6 max-w-2xl">
                            <div className="space-y-4">
                                <Input
                                    label={t('settings.prebeta.apiKey.label')}
                                    type="password"
                                    value={geminiApiKey}
                                    onChange={(e) => setGeminiApiKey(e.target.value)}
                                    placeholder={t('settings.prebeta.apiKey.placeholder')}
                                />
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {t('settings.prebeta.apiKey.helperPrefix')}{' '}
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
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
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    {t('settings.prebeta.tokenLimit.helper')}
                                </p>
                            </div>

                            <div className="pt-4 flex justify-end border-t border-[var(--color-surface-border)]">
                                <Button onClick={handleSavePreBeta} loading={saving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
                        </Card>
                    </div>
                );
            case 'preferences':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.preferences.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.preferences.subtitle')}</p>
                        </div>

                        <Card className="p-6 space-y-6 max-w-2xl">
                            {/* Language Settings */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-[var(--color-text-main)] block">
                                    {t('settings.preferences.language.label')}
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                            ${language === 'en'
                                                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'}
                                        `}
                                    >
                                        <div className="size-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                                            EN
                                        </div>
                                        <div>
                                            <div className={`font-medium ${language === 'en' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>{t('language.english')}</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">{t('settings.preferences.language.englishTag')}</div>
                                        </div>
                                        {language === 'en' && (
                                            <span className="material-symbols-outlined text-[var(--color-primary)] ml-auto">check_circle</span>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setLanguage('de')}
                                        className={`
                                            flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                            ${language === 'de'
                                                ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]'
                                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:bg-[var(--color-surface-hover)]'}
                                        `}
                                    >
                                        <div className="size-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs shrink-0">
                                            DE
                                        </div>
                                        <div>
                                            <div className={`font-medium ${language === 'de' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>{t('language.german')}</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">{t('settings.preferences.language.germanTag')}</div>
                                        </div>
                                        {language === 'de' && (
                                            <span className="material-symbols-outlined text-[var(--color-primary)] ml-auto">check_circle</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <hr className="border-[var(--color-surface-border)]" />

                            {/* Date Format Settings */}
                            <div className="space-y-3">
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
                                <p className="text-[10px] text-[var(--color-text-muted)] ml-1">
                                    {t('settings.preferences.dateFormat.helper')}
                                </p>
                            </div>
                        </Card>
                    </div>
                );
            case 'general':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.general.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.general.subtitle')}</p>
                        </div>
                        <Card className="p-6 space-y-4 max-w-2xl">
                            <Input
                                label={t('settings.general.fields.teamName')}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('settings.general.fields.teamNamePlaceholder')}
                            />
                            <Textarea
                                label={t('settings.general.fields.description')}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t('settings.general.fields.descriptionPlaceholder')}
                                rows={3}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label={t('settings.general.fields.website')}
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder={t('settings.general.fields.websitePlaceholder')}
                                />
                                <Input
                                    label={t('settings.general.fields.contactEmail')}
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder={t('settings.general.fields.contactEmailPlaceholder')}
                                />
                            </div>
                            <div className="pt-4 flex justify-end border-t border-[var(--color-surface-border)]">
                                <Button onClick={handleSave} loading={saving}>
                                    {t('common.saveChanges')}
                                </Button>
                            </div>
                        </Card>
                        <Card className="p-6 max-w-2xl">
                            <div className="flex items-start justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-[var(--color-text-main)]">{t('settings.general.onboarding.title')}</div>
                                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                        {t('settings.general.onboarding.description')}
                                    </p>
                                </div>
                                <Button variant="secondary" onClick={handleRestartOnboarding}>
                                    {t('settings.general.onboarding.action')}
                                </Button>
                            </div>
                        </Card>
                        <Card className="p-6 max-w-2xl">
                            <div className="flex items-start justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-[var(--color-text-main)]">{t('settings.general.team.title')}</div>
                                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                        {t('settings.general.team.description')}
                                    </p>
                                </div>
                                <Link to="/team">
                                    <Button variant="secondary">
                                        {t('settings.general.team.action')}
                                    </Button>
                                </Link>
                            </div>
                        </Card>
                    </div>
                );
            case 'billing':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.billing.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.billing.subtitle')}</p>
                        </div>
                        <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                            <div className="size-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-2">
                                <span className="material-symbols-outlined text-3xl">credit_card</span>
                            </div>
                            <h3 className="text-lg font-bold">{t('settings.billing.plan.title')}</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm">{t('settings.billing.plan.description')}</p>

                            {aiUsage && (
                                <div className="w-full max-w-md pt-6 border-t border-[var(--color-surface-border)] mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">auto_awesome</span>
                                            {t('settings.billing.aiUsage.title')}
                                        </div>
                                        <span className="text-xs font-mono font-bold">
                                            {aiUsage.tokensUsed.toLocaleString()} / {aiUsage.tokenLimit.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-[var(--color-surface-border)]">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${(aiUsage.tokensUsed / aiUsage.tokenLimit) > 0.9 ? 'bg-rose-500' : 'bg-[var(--color-primary)]'
                                                }`}
                                            style={{ width: `${Math.min(100, (aiUsage.tokensUsed / aiUsage.tokenLimit) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2 italic mb-4">
                                        {t('settings.billing.aiUsage.resetNotice')}
                                    </p>

                                    {/* Image Usage */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <span className="material-symbols-outlined text-[18px] text-amber-500">image</span>
                                            {t('settings.billing.imageUsage.title')}
                                        </div>
                                        <span className="text-xs font-mono font-bold">
                                            {/* Default to 0/50 if undefined */}
                                            {aiUsage.imagesUsed || 0} / {aiUsage.imageLimit || 50}
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-[var(--color-surface-border)]">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${((aiUsage.imagesUsed || 0) / (aiUsage.imageLimit || 50)) > 0.9 ? 'bg-rose-500' : 'bg-amber-500'}`}
                                            style={{ width: `${Math.min(100, ((aiUsage.imagesUsed || 0) / (aiUsage.imageLimit || 50)) * 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2 italic">
                                        {t('settings.billing.imageUsage.resetNotice')}
                                    </p>
                                </div>
                            )}

                            <div className="pt-4">
                                <Button disabled className="opacity-50">{t('settings.billing.actions.manage')}</Button>
                            </div>
                        </Card>
                    </div>
                );
            case 'security':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.security.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.security.subtitle')}</p>
                        </div>
                        <Card className="divide-y divide-[var(--color-surface-border)]">
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-[var(--color-text-main)]">{t('settings.security.twoFactor.title')}</p>
                                        {twoFactorEnabled && (
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check</span> {t('settings.security.twoFactor.enabled')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--color-text-muted)]">{t('settings.security.twoFactor.description')}</p>
                                </div>
                                <div>
                                    {!twoFactorEnabled ? (
                                        <Button size="sm" onClick={() => setShowTwoFactorModal(true)}>
                                            {t('settings.security.twoFactor.actions.enable')}
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" disabled title={t('settings.security.twoFactor.manageDisabledTitle')}>
                                            {t('settings.security.twoFactor.actions.manage')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-[var(--color-text-main)]">{t('settings.security.sso.title')}</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">{t('settings.security.sso.description')}</p>
                                </div>
                                <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold uppercase text-gray-500">
                                    {t('settings.security.sso.badge')}
                                </div>
                            </div>

                            {/* Passkeys Section */}
                            <div className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-[var(--color-text-main)]">{t('settings.security.passkeys.title')}</p>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-1.5 py-0.5 rounded">{t('settings.security.passkeys.beta')}</span>
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)]">{t('settings.security.passkeys.description')}</p>
                                    </div>
                                    <Button size="sm" onClick={handleRegisterPasskey} isLoading={registeringPasskey}>
                                        <span className="material-symbols-outlined text-[18px] mr-1">fingerprint</span>
                                        {t('settings.security.passkeys.actions.add')}
                                    </Button>
                                </div>

                                {/* Auto-Prompt Toggle */}
                                <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-hover)] rounded-lg">
                                    <Checkbox
                                        checked={autoPromptEnabled}
                                        onChange={(checked) => {
                                            setAutoPromptEnabled(checked);
                                            setAutoPrompt(checked);
                                            if (checked) {
                                                showSuccess(t('settings.security.passkeys.autoPrompt.enabled'));
                                            } else {
                                                showSuccess(t('settings.security.passkeys.autoPrompt.disabled'));
                                            }
                                        }}
                                        id="auto-prompt-toggle"
                                    />
                                    <label htmlFor="auto-prompt-toggle" className="cursor-pointer">
                                        <p className="text-sm font-medium text-[var(--color-text-main)]">{t('settings.security.passkeys.autoPrompt.label')}</p>
                                        <p className="text-[10px] text-[var(--color-text-muted)]">{t('settings.security.passkeys.autoPrompt.description')}</p>
                                    </label>
                                </div>

                                {passkeys.length > 0 && (
                                    <div className="space-y-2 pt-2">
                                        {passkeys.map(passkey => (
                                            <div key={passkey.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-hover)] rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                                                        <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-[var(--color-text-main)]">{passkey.label || 'Passkey'}</p>
                                                        <p className="text-[10px] text-[var(--color-text-muted)]">
                                                            {t('settings.security.passkeys.addedDate').replace('{date}', passkey.createdAt ? format(passkey.createdAt.toDate(), dateFormat) : 'Unknown')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => handleDeletePasskey(passkey.id, passkey.label)}
                                                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                );
            case 'email':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.email.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.email.subtitle')}</p>
                        </div>
                        <Card className="p-6 space-y-6 max-w-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-[var(--color-text-main)]">{t('settings.email.smtp.title')}</h3>
                                        {useCustomSmtp && (
                                            <div className="flex items-center gap-2">
                                                <div className={`size-2.5 rounded-full shrink-0 ${connectionStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                                    connectionStatus === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                                                        (smtpHost || smtpUser || smtpPass) ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' :
                                                            'bg-zinc-300 dark:bg-zinc-600'
                                                    }`} />
                                                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                                                    {connectionStatus === 'success' ? t('settings.email.smtp.status.verified') :
                                                        connectionStatus === 'error' ? t('settings.email.smtp.status.failed') :
                                                            (smtpHost || smtpUser || smtpPass) ? t('settings.email.smtp.status.notVerified') :
                                                                t('settings.email.smtp.status.noConfig')}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.email.smtp.description')}</p>
                                </div>
                                <div
                                    className={`switch-track ${useCustomSmtp ? 'active' : ''}`}
                                    onClick={() => setUseCustomSmtp(!useCustomSmtp)}
                                >
                                    <div className="switch-handle" />
                                </div>
                            </div>


                            {/* Connection Status Indicator */}


                            {
                                useCustomSmtp && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label={t('settings.email.smtp.fields.host')}
                                                value={smtpHost}
                                                onChange={(e) => setSmtpHost(e.target.value)}
                                                placeholder={t('settings.email.smtp.fields.hostPlaceholder')}
                                            />
                                            <Input
                                                label={t('settings.email.smtp.fields.port')}
                                                type="number"
                                                value={smtpPort}
                                                onChange={(e) => setSmtpPort(Number(e.target.value))}
                                                placeholder={t('settings.email.smtp.fields.portPlaceholder')}
                                            />
                                        </div>
                                        <Input
                                            label={t('settings.email.smtp.fields.username')}
                                            value={smtpUser}
                                            onChange={(e) => setSmtpUser(e.target.value)}
                                            placeholder={t('settings.email.smtp.fields.usernamePlaceholder')}
                                        />
                                        <Input
                                            label={t('settings.email.smtp.fields.password')}
                                            type="password"
                                            value={smtpPass}
                                            onChange={(e) => setSmtpPass(e.target.value)}
                                            placeholder={t('settings.email.smtp.fields.passwordPlaceholder')}
                                        />
                                        <Input
                                            label={t('settings.email.smtp.fields.fromEmail')}
                                            value={smtpFromEmail}
                                            onChange={(e) => setSmtpFromEmail(e.target.value)}
                                            placeholder={t('settings.email.smtp.fields.fromEmailPlaceholder')}
                                        />
                                    </div>
                                )
                            }

                            {
                                !useCustomSmtp && (
                                    <div className="bg-[var(--color-surface-hover)] p-4 rounded-lg flex gap-3 text-sm text-[var(--color-text-muted)]">
                                        <span className="material-symbols-outlined text-[var(--color-primary)]">info</span>
                                        <p>{t('settings.email.smtp.defaultInfo')}</p>
                                    </div>
                                )
                            }

                            <div className="pt-4 flex justify-between border-t border-[var(--color-surface-border)]">
                                {useCustomSmtp ? (
                                    <Button
                                        onClick={handleTestConnection}
                                        isLoading={testingConnection}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 shadow-sm hover:shadow active:scale-95 transition-all"
                                    >
                                        {t('settings.email.smtp.actions.test')}
                                    </Button>
                                ) : <div />}
                                <Button onClick={handleSave} loading={saving}>
                                    {t('settings.email.actions.save')}
                                </Button>
                            </div>
                        </Card >
                    </div >
                );

            case 'integrations':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.api.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.api.subtitle')}</p>
                        </div>

                        {/* Token Generation */}
                        <Card className="p-6 space-y-4">
                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-primary)]">key</span>
                                {t('settings.api.tokens.title')}
                            </h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                {t('settings.api.tokens.description')}
                            </p>

                            {/* Create Token */}
                            <div className="flex gap-3">
                                <Input
                                    placeholder={t('settings.api.tokens.placeholder')}
                                    value={newTokenName}
                                    onChange={(e) => setNewTokenName(e.target.value)}
                                    className="flex-1"
                                />
                                <Button onClick={handleCreateToken} loading={creatingToken} className="whitespace-nowrap">
                                    {t('settings.api.tokens.actions.generate')}
                                </Button>
                            </div>

                            {/* Token List */}
                            <div className="border-t border-[var(--color-surface-border)] pt-4 mt-4">
                                {loadingTokens ? (
                                    <p className="text-sm text-[var(--color-text-muted)]">{t('settings.api.tokens.loading')}</p>
                                ) : apiTokens.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)] italic">{t('settings.api.tokens.empty')}</p>
                                ) : (
                                    <div className="space-y-3">
                                        {apiTokens.map(token => (
                                            <div key={token.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-hover)] rounded-lg">
                                                <div>
                                                    <p className="font-medium text-[var(--color-text-main)]">{token.name}</p>
                                                    <p className="text-xs text-[var(--color-text-muted)] font-mono">
                                                        {token.tokenPrefix}••••••••
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteToken(token.id, token.name)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                );
            case 'account':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('settings.account.title')}</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">{t('settings.account.subtitle')}</p>
                        </div>

                        <Card className="divide-y divide-[var(--color-surface-border)]">
                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="font-semibold text-[var(--color-text-main)]">{t('settings.account.signIn.title')}</h3>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('settings.account.signIn.subtitle')}</p>
                                </div>

                                <div className="space-y-3">
                                    {/* Email/Password */}
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)]/30">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                                                <span className="material-symbols-outlined text-[24px]">mail</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-sm font-medium text-[var(--color-text-main)]">{t('settings.account.emailPassword.title')}</p>
                                                    {emailVerified ? (
                                                        <span className="material-symbols-outlined text-[14px] text-emerald-500" title={t('settings.account.emailVerification.verifiedTitle')}>verified</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px] text-amber-500" title={t('settings.account.emailVerification.unverifiedTitle')}>warning</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">{auth.currentUser?.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!emailVerified && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleSendVerification}
                                                    isLoading={sendingVerification}
                                                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                                >
                                                    {t('settings.account.emailVerification.resend')}
                                                </Button>
                                            )}
                                            {providers.includes('password') ? (
                                                <>
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[12px]">check</span> {t('settings.account.methods.linked')}
                                                    </span>
                                                    <Button size="sm" variant="ghost" onClick={() => { setShowSetPassword(!showSetPassword); setIsChangingPassword(true); }}>
                                                        {showSetPassword ? t('settings.account.password.actions.cancel') : t('settings.account.password.actions.change')}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => { setShowSetPassword(!showSetPassword); setIsChangingPassword(false); }}>
                                                    {showSetPassword ? t('settings.account.password.actions.cancel') : t('settings.account.password.actions.set')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {showSetPassword && (
                                        <div className="p-4 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <Input
                                                    type="password"
                                                    label={isChangingPassword ? t('settings.account.password.fields.new') : t('settings.account.password.fields.set')}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder={t('settings.account.password.fields.placeholder')}
                                                />
                                                <Input
                                                    type="password"
                                                    label={t('settings.account.password.fields.confirm')}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder={t('settings.account.password.fields.placeholder')}
                                                />
                                            </div>
                                            <div className="flex justify-end">
                                                <Button size="sm" onClick={handleUpdatePassword} isLoading={settingPassword} disabled={!newPassword || newPassword !== confirmPassword}>
                                                    {isChangingPassword ? t('settings.account.password.actions.update') : t('settings.account.password.actions.setAccount')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* GitHub */}
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)]/30">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <img src="https://www.svgrepo.com/show/512317/github-142.svg" className="w-6 h-6 dark:invert" alt="GitHub" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-[var(--color-text-main)]">{t('settings.account.github.title')}</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">{t('settings.account.oauth')}</p>
                                            </div>
                                        </div>
                                        {providers.includes('github.com') ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check</span> {t('settings.account.methods.linked')}
                                            </span>
                                        ) : (
                                            <Button size="sm" variant="outline" onClick={handleConnectGithub} isLoading={connectingGithub}>
                                                {t('settings.account.github.connect')}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Google */}
                                    <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-paper)]/30">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-[var(--color-text-main)]">{t('settings.account.google.title')}</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">{t('settings.account.oauth')}</p>
                                            </div>
                                        </div>
                                        {providers.includes('google.com') ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check</span> {t('settings.account.methods.linked')}
                                            </span>
                                        ) : (
                                            <Button size="sm" variant="outline" onClick={handleConnectGoogle} isLoading={connectingGoogle}>
                                                {t('settings.account.google.connect')}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl mt-4">
                                    <div className="flex gap-3">
                                        <span className="material-symbols-outlined text-blue-500 text-[20px]">info</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            {t('settings.account.linkedAccounts.notePrefix')} <strong>{t('settings.account.linkedAccounts.noteEmphasis')}</strong> {t('settings.account.linkedAccounts.noteSuffix')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
        }
    };

    const NavItem = ({ id, label, icon }: { id: SettingsTab, label: string, icon: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === id
                ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-main)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'
                }`}
        >
            <span className={`material-symbols-outlined text-[20px] ${activeTab === id ? 'text-[var(--color-primary)]' : ''}`}>{icon}</span>
            {label}
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-up min-h-screen">
            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Sidebar */}
                <aside className="w-full md:w-64 shrink-0 space-y-1">
                    <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)] px-2 mb-6">{t('settings.title')}</h1>

                    {/* PRE-BETA Section */}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)] px-3 pt-2 pb-2">
                        {t('settings.sections.prebeta')}
                    </div>
                    <NavItem id="prebeta" label={t('settings.tabs.prebeta')} icon="science" />

                    {/* Personal Settings */}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)] px-3 pt-2 pb-2">
                        {t('settings.sections.personal')}
                    </div>
                    <NavItem id="account" label={t('settings.tabs.account')} icon="account_circle" />
                    <NavItem id="preferences" label={t('settings.tabs.preferences')} icon="tune" />
                    <NavItem id="security" label={t('settings.tabs.security')} icon="security" />

                    {/* Workspace Settings */}
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-subtle)] px-3 pt-6 pb-2">
                        {t('settings.sections.workspace')}
                    </div>
                    <NavItem id="general" label={t('settings.tabs.general')} icon="settings" />
                    <NavItem id="billing" label={t('settings.tabs.billing')} icon="credit_card" />
                    <NavItem id="email" label={t('settings.tabs.email')} icon="mail" />
                    <NavItem id="integrations" label={t('settings.tabs.integrations')} icon="key" />
                </aside>

                {/* Content */}
                <main className="flex-1 w-full min-w-0">
                    {!emailVerified && (
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-300">
                                    <span className="material-symbols-outlined">mark_email_unread</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-[var(--color-text-main)]">{t('settings.account.emailVerification.bannerTitle')}</h4>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                        {t('settings.account.emailVerification.bannerSubtitle')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleSendVerification}
                                    isLoading={sendingVerification}
                                >
                                    {t('settings.account.emailVerification.resend')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCheckVerification}
                                    isLoading={loading}
                                >
                                    {t('settings.account.emailVerification.actions.verified')}
                                </Button>
                            </div>
                        </div>
                    )}
                    {renderContent()}
                </main>
            </div>

            {/* Token Created Modal - rendered via portal to document.body */}
            {showNewTokenModal && generatedToken && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => {
                            setShowNewTokenModal(false);
                            setGeneratedToken(null);
                        }}
                    />
                    {/* Modal */}
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-xl w-full p-6 relative border border-[var(--color-surface-border)]">
                        <div className="flex items-center gap-3 text-emerald-500 mb-4">
                            <span className="material-symbols-outlined text-3xl">check_circle</span>
                            <h3 className="text-xl font-bold text-[var(--color-text-main)]">{t('settings.api.tokens.modal.title')}</h3>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 rounded-lg mb-6">
                            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-2">
                                {t('settings.api.tokens.modal.warning')}
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-white dark:bg-zinc-800 px-3 py-2 rounded text-sm font-mono break-all border border-[var(--color-surface-border)]">
                                    {generatedToken}
                                </code>
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={() => copyToClipboard(generatedToken)}
                                    className={`shrink-0 transition-colors ${copiedToken ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : ''}`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {copiedToken ? 'check' : 'content_copy'}
                                    </span>
                                </Button>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                onClick={() => {
                                    setShowNewTokenModal(false);
                                    setGeneratedToken(null);
                                }}
                            >
                                {t('settings.api.tokens.modal.done')}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <TwoFactorSetupModal
                isOpen={showTwoFactorModal}
                onClose={() => {
                    setShowTwoFactorModal(false);
                    // Refresh 2FA Status
                    if (auth.currentUser) {
                        const enrolledFactors = multiFactor(auth.currentUser).enrolledFactors;
                        setTwoFactorEnabled(enrolledFactors.length > 0);
                    }
                }}
            />
        </div>
    );
};
