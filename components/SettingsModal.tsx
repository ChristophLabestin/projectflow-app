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

import { DateFormat, useLanguage } from '../context/LanguageContext';
import { WorkspaceRolesTab } from './settings/WorkspaceRolesTab';

type SettingsTab = 'account' | 'preferences' | 'security' | 'general' | 'billing' | 'email' | 'integrations' | 'prebeta' | 'roles';

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
        { id: 'security', label: t('settings.tabs.security'), icon: 'lock_person' },
        { id: 'roles', label: t('settings.tabs.roles'), icon: 'shield_person' },
        { id: 'general', label: t('settings.tabs.general'), icon: 'settings' },
        { id: 'api', label: t('settings.tabs.api') || 'API Keys', icon: 'key' } as any,
        { id: 'prebeta', label: t('settings.tabs.prebeta'), icon: 'science' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'prebeta':
                return (
                    <div className="animate-fade-in space-y-8">
                        <header className="pb-6">
                            <h2 className="text-2xl font-bold text-[var(--color-text-main)] mb-1">
                                {t('settings.prebeta.title')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-muted)] font-medium">
                                {t('settings.prebeta.subtitle')}
                            </p>
                        </header>

                        <div className="space-y-5">
                            <section className="notice-card">
                                <div className="content-wrapper">
                                    <div className="icon-box">
                                        <span className="material-symbols-outlined text-[20px]">info</span>
                                    </div>
                                    <div>
                                        <h3 className="title">{t('settings.prebeta.noticeTitle')}</h3>
                                        <p className="text">
                                            {t('settings.prebeta.notice')}
                                        </p>
                                    </div>
                                </div>
                            </section>

                            <section className="settings-section-card">
                                <header className="settings-section-header">
                                    <div className="icon-box">
                                        <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                    </div>
                                    <h3>
                                        {t('settings.prebeta.aiConfigTitle')}
                                    </h3>
                                </header>
                                <div className="space-y-6">
                                    <div className="max-w-2xl">
                                        <Input
                                            label={t('settings.prebeta.geminiKeyLabel')}
                                            type="password"
                                            value={geminiApiKey}
                                            onChange={(e) => setGeminiApiKey(e.target.value)}
                                            placeholder="AIza..."
                                            className="settings-input"
                                        />
                                        <p className="mt-4 text-xs font-black text-[var(--color-text-main)] opacity-50 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">info</span>
                                            {t('settings.prebeta.geminiKeyHelp')}
                                        </p>
                                    </div>

                                    <div className="pt-6 flex justify-end">
                                        <Button
                                            onClick={handleSavePreBeta}
                                            loading={saving}
                                            className="btn-save"
                                        >
                                            {t('common.saveChanges')}
                                        </Button>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'preferences':
                return (
                    <div className="animate-fade-in space-y-8">
                        <header className="pb-6">
                            <h2 className="text-2xl font-black text-[var(--color-text-main)] mb-1">
                                {t('settings.preferences.title')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-main)] font-bold opacity-70">
                                {t('settings.preferences.subtitle')}
                            </p>
                        </header>

                        <div className="space-y-6">
                            <section className="settings-section-card">
                                <h3 className="text-[11px] font-black text-[var(--color-text-main)] uppercase tracking-[0.25em] mb-6 opacity-40 px-1">
                                    {t('settings.preferences.language.label')}
                                </h3>
                                <div className="card-grid">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`language-btn ${language === 'en' ? 'active' : 'inactive'}`}
                                    >
                                        <span className="flag">🇺🇸</span>
                                        <span className="label">{t('language.english')}</span>
                                        {language === 'en' && <span className="material-symbols-outlined check-icon ml-auto">check_circle</span>}
                                    </button>

                                    <button
                                        onClick={() => setLanguage('de')}
                                        className={`language-btn ${language === 'de' ? 'active' : 'inactive'}`}
                                    >
                                        <span className="flag">🇩🇪</span>
                                        <span className="label">{t('language.german', 'Deutsch')}</span>
                                        {language === 'de' && <span className="material-symbols-outlined check-icon ml-auto">check_circle</span>}
                                    </button>
                                </div>
                            </section>

                            <section className="settings-section-card">
                                <label className="text-[11px] font-black text-[var(--color-text-main)] uppercase tracking-[0.25em] mb-6 block opacity-40 px-1">
                                    {t('settings.preferences.ui.dateFormat')}
                                </label>
                                <div className="max-w-xl">
                                    <select
                                        value={dateFormat}
                                        onChange={(e) => handleDateFormatChange(e.target.value)}
                                        className="settings-input w-full px-6 cursor-pointer"
                                    >
                                        <option value="MMM d, yyyy">Jan 20, 2024</option>
                                        <option value="dd/MM/yyyy">20/01/2024</option>
                                        <option value="MM/dd/yyyy">01/20/2024</option>
                                        <option value="yyyy-MM-dd">2024-01-20</option>
                                    </select>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'roles':
                return (
                    <div className="animate-fade-in flex flex-col h-full">
                        <header className="pb-10 shrink-0">
                            <h2 className="text-3xl font-black text-[var(--color-text-main)] mb-1 tracking-tight">
                                {t('settings.tabs.roles')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-main)] font-bold opacity-70">
                                {t('settings.roles.subtitle', 'Configure workspace-wide roles and their associated permissions.')}
                            </p>
                        </header>

                        <div className="flex-1 min-h-0 min-w-0">
                            <WorkspaceRolesTab
                                tenant={tenant}
                                isOwner={tenantId === auth.currentUser?.uid}
                                onUpdate={() => {
                                    const loadTenant = async () => {
                                        if (tenantId) {
                                            const data = await getTenant(tenantId);
                                            if (data) setTenant(data);
                                        }
                                    };
                                    loadTenant();
                                }}
                            />
                        </div>
                    </div>
                );
            case 'general':
                return (
                    <div className="settings-tab-content">
                        <header className="settings-header">
                            <h2>
                                {t('settings.tabs.general')}
                            </h2>
                            <p>
                                {t('settings.general.subtitle', 'Manage your workspace information and system settings.')}
                            </p>
                        </header>

                        <div className="flex flex-col gap-6">
                            <section className="settings-section-card">
                                <header className="settings-section-header">
                                    <div className="icon-box">
                                        <span className="material-symbols-outlined text-[20px]">business</span>
                                    </div>
                                    <h3>
                                        {t('settings.general.company.title')}
                                    </h3>
                                </header>
                                <div className="settings-input-group">
                                    <Input
                                        label={t('settings.general.company.name')}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="settings-input"
                                    />
                                    <Input
                                        label={t('settings.general.company.website')}
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                        className="settings-input"
                                    />
                                </div>
                            </section>

                            <section className="settings-section-card">
                                <header className="settings-section-header">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-4">
                                            <div className="icon-box">
                                                <span className="material-symbols-outlined text-[20px]">mail</span>
                                            </div>
                                            <div>
                                                <h3>
                                                    {t('settings.general.smtp.title')}
                                                </h3>
                                                <p className="text-[11px] text-[var(--color-text-main)] font-black opacity-40 mt-0.5">
                                                    {t('settings.general.smtp.subtitle')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${connectionStatus === 'success' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                                            <div className={`size-1.5 rounded-full ${connectionStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                                            {connectionStatus === 'success' ? t('status.healthy') : t('status.disconnected', 'Disconnected')}
                                        </div>
                                    </div>
                                </header>

                                <div className="grid grid-cols-2 gap-6">
                                    <Input label={t('settings.email.smtp.host')} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} className="settings-input" />
                                    <Input label={t('settings.email.smtp.port')} value={smtpPort.toString()} onChange={(e) => setSmtpPort(parseInt(e.target.value))} className="settings-input" />
                                    <Input label={t('settings.email.smtp.user')} value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} className="settings-input" />
                                    <Input label={t('settings.email.smtp.pass')} type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} className="settings-input" />
                                </div>

                                <div className="mt-8 flex items-center justify-between">
                                    <Button variant="ghost" size="sm" onClick={handleTestConnection} loading={testingConnection} className="font-black hover:bg-[var(--color-surface-paper)] px-5 h-10 rounded-xl text-[10px] uppercase tracking-widest opacity-60">
                                        {t('settings.general.smtp.test')}
                                    </Button>

                                    <Button
                                        onClick={handleSave}
                                        loading={saving}
                                        className="btn-save"
                                    >
                                        {t('common.saveChanges')}
                                    </Button>
                                </div>
                            </section>

                            <section className="notice-card bg-rose-500/[0.03] dark:bg-rose-500/[0.02]">
                                <div className="flex items-center justify-between">
                                    <div className="content-wrapper">
                                        <div className="icon-box bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                            <span className="material-symbols-outlined text-[20px]">restart_alt</span>
                                        </div>
                                        <div>
                                            <h4 className="title text-rose-600 dark:text-rose-400">{t('settings.general.onboarding.title')}</h4>
                                            <p className="text text-[11px] opacity-40">{t('settings.general.onboarding.description')}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={handleRestartOnboarding} className="font-black text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 px-6 h-10 rounded-xl ring-1 ring-rose-500/20">
                                        {t('settings.general.onboarding.button')}
                                    </Button>
                                </div>
                            </section>
                        </div>
                    </div>
                );
            case 'account':
                return (
                    <div className="animate-fade-in space-y-6">
                        <header className="pb-4">
                            <h2 className="text-2xl font-black text-[var(--color-text-main)] mb-1">
                                {t('settings.tabs.account')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-main)] font-bold opacity-70">
                                {t('settings.account.subtitle')}
                            </p>
                        </header>

                        <div className="space-y-5">
                            <section className="settings-section-card">
                                <header className="settings-section-header">
                                    <div className="icon-box">
                                        <span className="material-symbols-outlined text-[20px]">person</span>
                                    </div>
                                    <h3>
                                        {t('settings.account.profile.title')}
                                    </h3>
                                </header>
                                <div className="card-grid">
                                    <Input
                                        label={t('settings.account.profile.displayName')}
                                        value={auth.currentUser?.displayName || ''}
                                        disabled
                                        className="settings-input"
                                    />
                                    <Input
                                        label={t('settings.account.profile.email')}
                                        value={auth.currentUser?.email || ''}
                                        disabled
                                        className="settings-input"
                                    />
                                </div>
                            </section>

                            <section className="settings-section-card">
                                <header className="settings-section-header">
                                    <div className="icon-box">
                                        <span className="material-symbols-outlined text-[20px]">link</span>
                                    </div>
                                    <h3>
                                        {t('settings.account.connected.title')}
                                    </h3>
                                </header>
                                <div className="card-grid">
                                    <div className="connected-account">
                                        <div className="provider-info text-slate-900 dark:text-white">
                                            <div className="logo-box dark">
                                                <svg className="size-6 fill-current" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                                            </div>
                                            <span className="name">GitHub</span>
                                        </div>
                                        <span className="status-badge connected">{t('settings.account.connected.status')}</span>
                                    </div>

                                    <div className="connected-account">
                                        <div className="provider-info text-slate-900 dark:text-white">
                                            <div className="logo-box">
                                                <svg className="size-6" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                                            </div>
                                            <span className="name">Google</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]">{t('settings.account.connected.action', 'Connect')}</Button>
                                    </div>
                                </div>
                            </section>

                            <section className="settings-section-card">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-inner">
                                            <span className="material-symbols-outlined text-[20px]">shield</span>
                                        </div>
                                        <h3 className="text-[13px] font-black text-[var(--color-text-main)] uppercase tracking-widest opacity-90">
                                            {t('settings.security.password.title', 'Password & Security')}
                                        </h3>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowSetPassword(!showSetPassword);
                                            setIsChangingPassword(providers.includes('password'));
                                        }}
                                        className="font-black underline decoration-[3px] underline-offset-8 text-[var(--color-primary)] hover:opacity-80 transition-all"
                                    >
                                        {providers.includes('password') ? t('settings.security.password.change') : t('settings.security.password.set')}
                                    </Button>
                                </div>

                                {showSetPassword && (
                                    <div className="space-y-6 animate-in slide-in-from-top-4">
                                        <div className="grid grid-cols-2 gap-8 p-8 rounded-[32px] bg-[var(--color-surface-paper)] shadow-inner ring-1 ring-[var(--color-border-main)]/10">
                                            <Input label={t('settings.security.password.new')} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="settings-input" />
                                            <Input label={t('settings.security.password.confirm')} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="settings-input" />
                                        </div>
                                        <div className="flex justify-end gap-4 px-1">
                                            <Button variant="ghost" size="sm" onClick={() => setShowSetPassword(false)} className="font-black px-8">{t('settings.security.password.cancel')}</Button>
                                            <Button size="sm" onClick={handleUpdatePassword} loading={settingPassword} className="btn-save">{t('settings.security.password.update')}</Button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            case 'security':
                return (
                    <div className="animate-fade-in space-y-8">
                        <header className="pb-6">
                            <h2 className="text-2xl font-black text-[var(--color-text-main)] mb-1">
                                {t('settings.security.title')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-main)] font-bold opacity-70">
                                {t('settings.security.subtitle')}
                            </p>
                        </header>

                        <div className="space-y-6">
                            <section className="settings-section-card">
                                <div className="flex items-center justify-between gap-8">
                                    <div className="flex items-center gap-5">
                                        <div className="size-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                                            <span className="material-symbols-outlined text-3xl">verified_user</span>
                                        </div>
                                        <div>
                                            <div className="text-[13px] font-black text-[var(--color-text-main)] mb-1 opacity-90">{t('settings.security.2fa.title')}</div>
                                            <div className="flex items-center gap-2">
                                                <div className={`size-2 rounded-full ${twoFactorEnabled ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'}`} />
                                                <div className={`text-[10px] font-black uppercase tracking-widest ${twoFactorEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {twoFactorEnabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setShowTwoFactorModal(true)} className="h-12 px-6 rounded-xl font-black border-transparent hover:bg-[var(--color-surface-bg)] hover:shadow-lg transition-all text-sm ring-1 ring-[var(--color-border-main)]/10">
                                        {t('settings.security.2fa.configure', 'Configure 2FA')}
                                    </Button>
                                </div>
                            </section>

                            <section className="settings-section-card">
                                <h3 className="text-[11px] font-black text-[var(--color-text-main)] uppercase tracking-[0.25em] mb-6 opacity-40 px-1">{t('settings.security.passkeys.title')}</h3>
                                {passkeys.length > 0 ? (
                                    <div className="passkey-list">
                                        {passkeys.map((key) => (
                                            <div key={key.id} className="passkey-item group">
                                                <div className="key-info">
                                                    <div className="icon-box">
                                                        <span className="material-symbols-outlined text-[20px]">passkey</span>
                                                    </div>
                                                    <span className="label">{key.label || 'Passkey'}</span>
                                                </div>
                                                <button onClick={() => handleDeletePasskey(key.id, key.label)} className="delete-btn">
                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state-box">
                                        <div className="icon">
                                            <span className="material-symbols-outlined text-3xl text-[var(--color-text-muted)] opacity-40">key_off</span>
                                        </div>
                                        <p className="text-[10px] text-[var(--color-text-main)] font-black uppercase tracking-widest opacity-40">{t('settings.security.passkeys.empty')}</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            case 'api':
                return (
                    <div className="animate-fade-in space-y-6">
                        <header className="pb-4">
                            <h2 className="text-2xl font-black text-[var(--color-text-main)] mb-1">
                                {t('settings.tabs.api')}
                            </h2>
                            <p className="text-sm text-[var(--color-text-main)] font-bold opacity-70">
                                {t('settings.api.subtitle')}
                            </p>
                        </header>

                        <div className="space-y-5">
                            <section className="settings-section-card">
                                <div className="settings-section-header justify-between">
                                    <div className="flex items-center gap-5">
                                        <div className="icon-box">
                                            <span className="material-symbols-outlined text-[20px]">key</span>
                                        </div>
                                        <div>
                                            <h3>
                                                {t('settings.api.list.title')}
                                            </h3>
                                            <p className="text-[11px] text-[var(--color-text-main)] font-black opacity-40">
                                                {t('settings.api.list.subtitle')}
                                            </p>
                                        </div>
                                    </div>
                                    <Button onClick={() => setShowNewTokenModal(true)} className="btn-save shadow-none h-10 px-6">
                                        {t('settings.api.list.button')}
                                    </Button>
                                </div>

                                {loadingTokens ? (
                                    <div className="flex justify-center p-12">
                                        <div className="size-10 rounded-full border-4 border-[var(--color-primary)]/10 border-t-[var(--color-primary)] animate-spin" />
                                    </div>
                                ) : apiTokens.length > 0 ? (
                                    <div className="api-token-list">
                                        {apiTokens.map((token) => (
                                            <div key={token.id} className="token-item group">
                                                <div className="token-info">
                                                    <div className="token-icon">
                                                        <span className="material-symbols-outlined text-[20px]">password</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-[12px] font-black text-[var(--color-text-main)] mb-1 opacity-90">{token.name}</div>
                                                        <div className="token-meta">
                                                            <code>{token.tokenPrefix}...</code>
                                                            <span className="date">
                                                                {token.createdAt ? t('settings.api.list.created').replace('{date}', format(token.createdAt.toDate?.() || new Date(token.createdAt), 'MMM d, yyyy')) : t('settings.api.list.recently')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteToken(token.id, token.name)} className="delete-btn">
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state-box">
                                        <div className="icon">
                                            <span className="material-symbols-outlined text-[24px]">key_off</span>
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('settings.api.list.empty')}</p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <React.Fragment>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                size="4xl"
                noPadding
                glass
                hideHeader
                borderless
            >
                <div className="settings-modal-container">
                    {/* Sidebar */}
                    <div className="settings-sidebar">
                        <div className="settings-nav-header">
                            <h3>
                                {t('settings.nav.header', 'System Settings')}
                            </h3>
                            <div className="divider" />
                        </div>

                        <nav className="settings-nav">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                                    className={`
                                        settings-nav-item
                                        ${activeTab === tab.id ? 'active' : ''}
                                    `}
                                >
                                    <div className="icon-box">
                                        <span className="material-symbols-outlined text-[20px] block">{tab.icon}</span>
                                    </div>
                                    <span className="truncate flex-1 text-left">{tab.label}</span>
                                    {activeTab === tab.id && (
                                        <div className="active-indicator" />
                                    )}
                                </button>
                            ))}
                        </nav>

                        <div className="mt-auto px-1 pt-6 border-t border-black/5 dark:border-white/5">
                            <button
                                onClick={onClose}
                                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-[13px] font-black transition-all group text-rose-500 hover:bg-rose-500/10 active:scale-95"
                            >
                                <div className="p-2 rounded-xl bg-rose-500/10 transition-all group-hover:scale-110">
                                    <span className="material-symbols-outlined text-[20px] block">logout</span>
                                </div>
                                <span>{t('common.exit', 'Exit Settings')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="settings-content-wrapper">
                        <div className="settings-scroll-area">
                            <div className="settings-container-max">
                                {renderContent()}
                            </div>
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
                glass
            >
                <div className="token-modal-content">
                    <div className="text-sm text-[var(--color-text-main)] font-bold opacity-70">
                        {t('settings.api.successModal.message')}
                    </div>

                    <div className="token-display-box group">
                        <span>{generatedToken}</span>
                        <div className="copy-btn-wrapper">
                            <Button size="sm" onClick={() => generatedToken && copyToClipboard(generatedToken)} className="h-10 bg-[var(--color-surface-paper)] border-none ring-1 ring-[var(--color-border-main)]/10 font-black shadow-xl rounded-xl">
                                {copiedToken ? t('common.copied', 'Copied!') : t('settings.api.newToken.copy')}
                            </Button>
                        </div>
                    </div>

                    <div className="warning-box">
                        <span className="material-symbols-outlined">warning</span>
                        <span>{t('settings.api.newToken.warning')}</span>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={() => {
                            setShowNewTokenModal(false);
                            setGeneratedToken(null);
                        }} className="btn-save shadow-2xl">
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
