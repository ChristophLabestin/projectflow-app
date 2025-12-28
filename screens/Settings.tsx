import { Link } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { useToast, useConfirm } from '../context/UIContext';
import { getActiveTenantId, getTenant, updateTenant, getAIUsage, getTenantSecret, updateTenantSecret, createAPIToken, getAPITokens, deleteAPIToken, updateUserData } from '../services/dataService';
import { auth, functions } from '../services/firebase';
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
import { getUserProfile, linkWithGithub } from '../services/dataService';
import { MediaLibrary } from '../components/MediaLibrary/MediaLibraryModal';

type SettingsTab = 'general' | 'preferences' | 'members' | 'billing' | 'security' | 'email' | 'api' | 'account';

import { DateFormat, useLanguage } from '../context/LanguageContext';

export const Settings = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
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
            showSuccess("GitHub connected!");
        } catch (e: any) {
            console.error('Failed to link GitHub', e);
            showError(e.message || "Failed to connect GitHub");
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
            showSuccess("Google account connected!");
        } catch (e: any) {
            console.error('Failed to link Google', e);
            showError(e.message || "Failed to connect Google");
        } finally {
            setConnectingGoogle(false);
        }
    };

    const handleUpdatePassword = async () => {
        const user = auth.currentUser;
        if (!user || !newPassword) return;
        if (newPassword !== confirmPassword) {
            showError("Passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            showError("Password must be at least 6 characters");
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
                    showError("Your account does not have an email associated with it. Please add an email to your profile first.");
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
            showSuccess(isChangingPassword ? "Password updated successfully!" : "Password set successfully! You can now sign in with your email and password.");
        } catch (e: any) {
            console.error('Failed to update password', e);
            if (e.code === 'auth/requires-recent-login' && isChangingPassword && !providers.some(p => p.includes('google') || p.includes('github'))) {
                showError("For security, please sign out and sign back in to change your password.");
            } else {
                showError(e.message || "Failed to update password");
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
                showSuccess("Connection Successful: " + result.data.message);
                setConnectionStatus('success');
                await saveVerifiedStatus(true);
            } else {
                showError("Connection Failed: " + (result.data.error || "Unknown error"));
                setConnectionStatus('error');
            }
        } catch (error: any) {
            console.error(error);
            showError("Test Failed: " + error.message);
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

    const handleCreateToken = async () => {
        if (!newTokenName.trim()) {
            showError('Please enter a token name');
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
            showError(error.message || 'Failed to create token');
        } finally {
            setCreatingToken(false);
        }
    };

    const handleDeleteToken = async (tokenId: string, tokenName: string) => {
        const confirmed = await confirm(
            'Delete API Token',
            `Are you sure you want to delete the token "${tokenName}"? This action cannot be undone.`
        );
        if (!confirmed) return;

        try {
            await deleteAPIToken(tokenId);
            showSuccess('Token deleted');
            await loadAPITokens();
        } catch (error) {
            showError('Failed to delete token');
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedToken(true);
            setTimeout(() => setCopiedToken(false), 2000);
        } catch (error) {
            showError('Failed to copy');
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

            showSuccess("Settings saved successfully!");
        } catch (error) {
            console.error("Failed to save settings", error);
            showError("Failed to save settings. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleRestartOnboarding = async () => {
        const user = auth.currentUser;
        if (!user) {
            showError('You must be signed in to restart onboarding.');
            return;
        }
        const approved = await confirm(
            'Restart dashboard onboarding?',
            'We will show the welcome tour again the next time you visit the dashboard.'
        );
        if (!approved) return;

        try {
            await updateUserData(user.uid, {
                'preferences.onboarding.dashboard': null
            });
            try {
                localStorage.removeItem('onboarding_dashboard_v1');
            } catch {
                // Ignore storage failures
            }
            showSuccess('Dashboard onboarding will show again on your next visit.');
        } catch (error) {
            console.error('Failed to reset onboarding', error);
            showError('Failed to restart onboarding. Please try again.');
        }
    };
    const handleSendVerification = async () => {
        if (!auth.currentUser) return;
        setSendingVerification(true);
        try {
            await sendEmailVerification(auth.currentUser);
            showSuccess('Verification email sent!');
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
                showSuccess('Email verified!');
            } else {
                showError('Email still unverified. Please check your inbox.');
            }
        } catch (error: any) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">Loading settings...</div>;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'preferences':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Preferences</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Customize your ProjectFlow experience.</p>
                        </div>

                        <Card className="p-6 space-y-6 max-w-2xl">
                            {/* Language Settings */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-[var(--color-text-main)] block">
                                    Language / Sprache
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
                                            <div className={`font-medium ${language === 'en' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>English</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">Default</div>
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
                                            <div className={`font-medium ${language === 'de' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>Deutsch</div>
                                            <div className="text-xs text-[var(--color-text-muted)]">German</div>
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
                                    label="Date Format"
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
                                    Choose how dates are displayed across the application.
                                </p>
                            </div>
                        </Card>
                    </div>
                );
            case 'general':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">General Settings</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Manage your workspace's public profile and details.</p>
                        </div>
                        <Card className="p-6 space-y-4 max-w-2xl">
                            <Input
                                label="Team Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Acme Corp"
                            />
                            <Textarea
                                label="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What does your team do?"
                                rows={3}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Website"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    placeholder="https://example.com"
                                />
                                <Input
                                    label="Contact Email"
                                    value={contactEmail}
                                    onChange={(e) => setContactEmail(e.target.value)}
                                    placeholder="admin@example.com"
                                />
                            </div>
                            <div className="pt-4 flex justify-end border-t border-[var(--color-surface-border)]">
                                <Button onClick={handleSave} loading={saving}>
                                    Save Changes
                                </Button>
                            </div>
                        </Card>
                        <Card className="p-6 max-w-2xl">
                            <div className="flex items-start justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-[var(--color-text-main)]">Onboarding</div>
                                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                        Restart the dashboard tour to revisit each feature and walkthrough step.
                                    </p>
                                </div>
                                <Button variant="secondary" onClick={handleRestartOnboarding}>
                                    Restart onboarding
                                </Button>
                            </div>
                        </Card>
                    </div>
                );
            case 'billing':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Billing & Plans</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Manage subscription and billing details.</p>
                        </div>
                        <Card className="p-8 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                            <div className="size-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-500 mb-2">
                                <span className="material-symbols-outlined text-3xl">credit_card</span>
                            </div>
                            <h3 className="text-lg font-bold">Personal License</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm">You are currently on the Personal plan (€29.99/month). Enjoy full access to AI Studio and advanced project features.</p>

                            {aiUsage && (
                                <div className="w-full max-w-md pt-6 border-t border-[var(--color-surface-border)] mt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <span className="material-symbols-outlined text-[18px] text-[var(--color-primary)]">auto_awesome</span>
                                            AI Usage this month
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
                                        Token usage resets at the beginning of each calendar month.
                                    </p>

                                    {/* Image Usage */}
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2 font-semibold text-sm">
                                            <span className="material-symbols-outlined text-[18px] text-amber-500">image</span>
                                            Image Generations
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
                                        Image generation limit resets monthly.
                                    </p>
                                </div>
                            )}

                            <div className="pt-4">
                                <Button disabled className="opacity-50">Manage Subscription</Button>
                            </div>
                        </Card>
                    </div>
                );
            case 'security':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Security</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Audit logs and security controls.</p>
                        </div>
                        <Card className="divide-y divide-[var(--color-surface-border)]">
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-[var(--color-text-main)]">Two-Factor Authentication</p>
                                        {twoFactorEnabled && (
                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check</span> Enabled
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--color-text-muted)]">Secure your account with an authenticator app.</p>
                                </div>
                                <div>
                                    {!twoFactorEnabled ? (
                                        <Button size="sm" onClick={() => setShowTwoFactorModal(true)}>
                                            Enable 2FA
                                        </Button>
                                    ) : (
                                        <Button variant="outline" size="sm" disabled title="Disabling 2FA is currently managed via support">
                                            Manage
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-[var(--color-text-main)]">Single Sign-On (SSO)</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">Enable SAML/OIDC authentication.</p>
                                </div>
                                <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-bold uppercase text-gray-500">
                                    Enterprise
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            case 'email':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Email Settings</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Configure how system emails and campaigns are sent.</p>
                        </div>
                        <Card className="p-6 space-y-6 max-w-2xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-[var(--color-text-main)]">Custom SMTP Server</h3>
                                        {useCustomSmtp && (
                                            <div className="flex items-center gap-2">
                                                <div className={`size-2.5 rounded-full shrink-0 ${connectionStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                                                    connectionStatus === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                                                        (smtpHost || smtpUser || smtpPass) ? 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.4)]' :
                                                            'bg-zinc-300 dark:bg-zinc-600'
                                                    }`} />
                                                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                                                    {connectionStatus === 'success' ? 'Verified' :
                                                        connectionStatus === 'error' ? 'Failed' :
                                                            (smtpHost || smtpUser || smtpPass) ? 'Not Verified' :
                                                                'No Config'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-[var(--color-text-muted)]">Use your own mail server instead of ProjectFlow's default.</p>
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
                                                label="SMTP Host"
                                                value={smtpHost}
                                                onChange={(e) => setSmtpHost(e.target.value)}
                                                placeholder="smtp.example.com"
                                            />
                                            <Input
                                                label="Port"
                                                type="number"
                                                value={smtpPort}
                                                onChange={(e) => setSmtpPort(Number(e.target.value))}
                                                placeholder="587"
                                            />
                                        </div>
                                        <Input
                                            label="Username"
                                            value={smtpUser}
                                            onChange={(e) => setSmtpUser(e.target.value)}
                                            placeholder="user@example.com"
                                        />
                                        <Input
                                            label="Password"
                                            type="password"
                                            value={smtpPass}
                                            onChange={(e) => setSmtpPass(e.target.value)}
                                            placeholder="••••••••"
                                        />
                                        <Input
                                            label="From Email Address"
                                            value={smtpFromEmail}
                                            onChange={(e) => setSmtpFromEmail(e.target.value)}
                                            placeholder="marketing@example.com"
                                        />
                                    </div>
                                )
                            }

                            {
                                !useCustomSmtp && (
                                    <div className="bg-[var(--color-surface-hover)] p-4 rounded-lg flex gap-3 text-sm text-[var(--color-text-muted)]">
                                        <span className="material-symbols-outlined text-[var(--color-primary)]">info</span>
                                        <p>Emails will be sent using ProjectFlow's high-reputation delivery servers. A generic "via projectflow.io" signer might appear.</p>
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
                                        Test Connection
                                    </Button>
                                ) : <div />}
                                <Button onClick={handleSave} loading={saving}>
                                    Save Email Settings
                                </Button>
                            </div>
                        </Card >
                    </div >
                );
            case 'members':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Team Members</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Manage access and roles.</p>
                        </div>
                        <Card className="p-8 text-center text-[var(--color-text-muted)]">
                            <p>Members management is located in the dedicated Team page.</p>
                            <Link to="/team" className="text-[var(--color-primary)] font-bold mt-2 inline-block hover:underline">Go to Team Page</Link>
                        </Card>
                    </div>
                );
            case 'api':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">API & Integrations</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Generate API tokens for newsletter signups and external integrations.</p>
                        </div>

                        {/* Token Generation */}
                        <Card className="p-6 space-y-4">
                            <h3 className="font-bold text-[var(--color-text-main)] flex items-center gap-2">
                                <span className="material-symbols-outlined text-[var(--color-primary)]">key</span>
                                API Tokens
                            </h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Create tokens to authenticate newsletter signup forms and external API integrations.
                            </p>

                            {/* Create Token */}
                            <div className="flex gap-3">
                                <Input
                                    placeholder="Token name (e.g., Website Newsletter)"
                                    value={newTokenName}
                                    onChange={(e) => setNewTokenName(e.target.value)}
                                    className="flex-1"
                                />
                                <Button onClick={handleCreateToken} loading={creatingToken} className="whitespace-nowrap">
                                    Generate Token
                                </Button>
                            </div>

                            {/* Token List */}
                            <div className="border-t border-[var(--color-surface-border)] pt-4 mt-4">
                                {loadingTokens ? (
                                    <p className="text-sm text-[var(--color-text-muted)]">Loading tokens...</p>
                                ) : apiTokens.length === 0 ? (
                                    <p className="text-sm text-[var(--color-text-muted)] italic">No API tokens created yet.</p>
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
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Account Settings</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Manage your authentication and sign-in methods.</p>
                        </div>

                        <Card className="divide-y divide-[var(--color-surface-border)]">
                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="font-semibold text-[var(--color-text-main)]">Sign-in Methods</h3>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Configure how you access your account.</p>
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
                                                    <p className="text-sm font-medium text-[var(--color-text-main)]">Email & Password</p>
                                                    {emailVerified ? (
                                                        <span className="material-symbols-outlined text-[14px] text-emerald-500" title="Verified Account">verified</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px] text-amber-500" title="Email Unverified">warning</span>
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
                                                    Resend Verification
                                                </Button>
                                            )}
                                            {providers.includes('password') ? (
                                                <>
                                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[12px]">check</span> Linked
                                                    </span>
                                                    <Button size="sm" variant="ghost" onClick={() => { setShowSetPassword(!showSetPassword); setIsChangingPassword(true); }}>
                                                        {showSetPassword ? 'Cancel' : 'Change'}
                                                    </Button>
                                                </>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => { setShowSetPassword(!showSetPassword); setIsChangingPassword(false); }}>
                                                    {showSetPassword ? 'Cancel' : 'Set Password'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {showSetPassword && (
                                        <div className="p-4 rounded-xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <Input
                                                    type="password"
                                                    label={isChangingPassword ? "New Password" : "Set Password"}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                />
                                                <Input
                                                    type="password"
                                                    label="Confirm Password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <div className="flex justify-end">
                                                <Button size="sm" onClick={handleUpdatePassword} isLoading={settingPassword} disabled={!newPassword || newPassword !== confirmPassword}>
                                                    {isChangingPassword ? 'Update Password' : 'Set Account Password'}
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
                                                <p className="text-sm font-medium text-[var(--color-text-main)]">GitHub</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">OAuth Integration</p>
                                            </div>
                                        </div>
                                        {providers.includes('github.com') ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check</span> Linked
                                            </span>
                                        ) : (
                                            <Button size="sm" variant="outline" onClick={handleConnectGithub} isLoading={connectingGithub}>
                                                Connect GitHub
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
                                                <p className="text-sm font-medium text-[var(--color-text-main)]">Google</p>
                                                <p className="text-[10px] text-[var(--color-text-muted)]">OAuth Integration</p>
                                            </div>
                                        </div>
                                        {providers.includes('google.com') ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">check</span> Linked
                                            </span>
                                        ) : (
                                            <Button size="sm" variant="outline" onClick={handleConnectGoogle} isLoading={connectingGoogle}>
                                                Connect Google
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl mt-4">
                                    <div className="flex gap-3">
                                        <span className="material-symbols-outlined text-blue-500 text-[20px]">info</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            Linking social accounts (GitHub/Google) will <strong>not</strong> remove your existing password.
                                            You will still be able to sign in using your email and password as long as they are linked.
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
                    <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)] px-2 mb-6">Settings</h1>
                    <NavItem id="general" label="General" icon="settings" />
                    <NavItem id="preferences" label="Preferences" icon="tune" />
                    <NavItem id="members" label="Members" icon="group" />
                    <NavItem id="billing" label="Billing" icon="credit_card" />
                    <NavItem id="email" label="Email" icon="mail" />
                    <NavItem id="api" label="API" icon="key" />
                    <NavItem id="security" label="Security" icon="security" />
                    <NavItem id="account" label="Account" icon="account_circle" />
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
                                    <h4 className="text-sm font-bold text-[var(--color-text-main)]">Email not verified</h4>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                        Please verify your email address to access all security features.
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
                                    Resend Verification
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCheckVerification}
                                    isLoading={loading}
                                >
                                    I've Verified
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
                            <h3 className="text-xl font-bold text-[var(--color-text-main)]">Token Created!</h3>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4 rounded-lg mb-6">
                            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-2">
                                ⚠️ Copy this token now. You won't be able to see it again!
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
                                Done
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
