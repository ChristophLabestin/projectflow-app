import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
    subscribeIntegrations,
    connectIntegration,
    disconnectIntegration,
    subscribeCaptionPresets,
    deleteCaptionPreset,
    subscribeSocialStrategy,
    updateSocialStrategy,
    syncSocialStrategyPlatforms
} from '../../services/dataService';
import { SocialIntegration, SocialPlatform, CaptionPreset, SocialStrategy } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast, useConfirm } from '../../context/UIContext';
import { CaptionPresetManager } from './components/CaptionPresetManager';
import { PlatformIcon } from './components/PlatformIcon';
import { format } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import { getMultiFactorResolver, MultiFactorResolver, unlink, FacebookAuthProvider } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { TwoFactorChallengeModal } from '../../components/modals/TwoFactorChallengeModal';

const PLATFORMS: { id: SocialPlatform; name: string; color: string }[] = [
    { id: 'Instagram', name: 'Instagram', color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' },
    { id: 'Facebook', name: 'Facebook', color: 'bg-blue-600' },
    { id: 'LinkedIn', name: 'LinkedIn', color: 'bg-blue-700' },
    { id: 'X', name: 'X (Twitter)', color: 'bg-black' },
    { id: 'TikTok', name: 'TikTok', color: 'bg-black' },
    { id: 'YouTube', name: 'YouTube', color: 'bg-red-600' },
];

type SettingsTab = 'accounts' | 'presets' | 'strategy' | 'danger';

export const SocialSettings = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');
    const [integrations, setIntegrations] = useState<SocialIntegration[]>([]);
    const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
    const [presets, setPresets] = useState<CaptionPreset[]>([]);
    const [strategy, setStrategy] = useState<SocialStrategy | null>(null);
    const [showPresetManager, setShowPresetManager] = useState(false);
    const { showError, showSuccess, showToast } = useToast();
    const confirm = useConfirm();
    const { t, dateLocale, dateFormat } = useLanguage();

    // MFA State
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [pendingPlatform, setPendingPlatform] = useState<SocialPlatform | null>(null);

    useEffect(() => {
        if (!projectId) return;
        const unsubIntegrations = subscribeIntegrations(projectId, setIntegrations);
        const unsubPresets = subscribeCaptionPresets(projectId, setPresets);
        const unsubStrategy = subscribeSocialStrategy(projectId, setStrategy);
        return () => {
            unsubIntegrations();
            unsubPresets();
            unsubStrategy();
        };
    }, [projectId]);

    const handleConnect = async (platform: SocialPlatform) => {
        if (!projectId) return;
        setConnecting(platform);
        try {
            await connectIntegration(projectId, platform);
            showSuccess(t('social.settings.accounts.toast.connected').replace('{platform}', platform));
        } catch (error: any) {
            console.error("Connection error:", error);
            console.log("Error code:", error.code);
            console.log("Error full:", JSON.stringify(error, null, 2));
            console.log("Error customData details:", JSON.stringify(error.customData, null, 2));
            console.log("Auth instance:", auth);

            if (error.code === 'auth/multi-factor-auth-required') {
                try {
                    const resolver = getMultiFactorResolver(auth, error);
                    console.log("Resolver created:", resolver);
                    setMfaResolver(resolver);
                    setPendingPlatform(platform);
                    setShowMfaModal(true);
                } catch (resolverError) {
                    console.error("Failed to get multi-factor resolver:", resolverError);
                    showError("MFA Error: " + (resolverError as Error).message);
                }
            } else if (error.code === 'auth/credential-already-in-use') {
                showError("This Facebook account is already connected to another ProjectFlow user. Please log in with Facebook to access that account, or use a different Facebook account.");
            } else {
                showError(error.message || t('social.settings.accounts.toast.failedConnect').replace('{platform}', platform));
            }
        } finally {
            setConnecting(null);
        }
    };

    const handleMfaSuccess = async () => {
        if (pendingPlatform) {
            // Retry connection
            await handleConnect(pendingPlatform);
        }
    };

    const handleDisconnect = async (integrationId: string) => {
        if (!projectId) return;
        const confirmed = await confirm(
            t('social.settings.accounts.disconnectConfirm.title'),
            t('social.settings.accounts.disconnectConfirm.message')
        );
        if (confirmed) {
            try {
                await disconnectIntegration(projectId, integrationId);
                showToast(t('social.settings.accounts.toast.disconnected'), "info");
            } catch (error) {
                showError(t('social.settings.accounts.toast.disconnectError'));
            }
        }
    };

    const handleUnlinkProvider = async (providerId: string) => {
        if (!auth.currentUser) return;
        const confirmed = await confirm(
            "Unlink Authentication?",
            "This will remove the Facebook/Instagram link from your Firebase account. Use this only if you are stuck."
        );
        if (confirmed) {
            try {
                // Find the provider object
                const provider = auth.currentUser.providerData.find(p => p.providerId === providerId);
                // We actually need to unlink by providerId string
                await unlink(auth.currentUser, providerId);
                showSuccess("Unlinked successfully. You can now try connecting again.");
                // Force refresh
                window.location.reload();
            } catch (error: any) {
                console.error("Unlink failed", error);
                showError("Unlink failed: " + error.message);
            }
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

    const handleUpdateStrategy = async (updates: Partial<SocialStrategy>) => {
        if (!projectId) return;
        try {
            await updateSocialStrategy(projectId, updates);
        } catch (error) {
            showError(t('social.settings.strategy.toast.updateError'));
        }
    };

    const toggleDefaultPlatform = (platform: SocialPlatform) => {
        const current = strategy?.defaultPlatforms || PLATFORMS.map(p => p.id);
        if (current.includes(platform)) {
            const newPlatforms = current.filter(p => p !== platform);
            handleUpdateStrategy({ defaultPlatforms: newPlatforms });
            // Clean up existing ideas
            syncSocialStrategyPlatforms(projectId!, platform).catch(console.error);
        } else {
            handleUpdateStrategy({ defaultPlatforms: [...current, platform] });
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'accounts':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('social.settings.accounts.title')}</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('social.settings.accounts.subtitle')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            {PLATFORMS.map(platform => {
                                const integration = integrations.find(i => i.platform === platform.id);
                                const isConnected = !!integration;

                                // Check for Auth/DB mismatch for Facebook/Instagram
                                const isAuthLinked = (platform.id === 'Facebook' || platform.id === 'Instagram') &&
                                    auth.currentUser?.providerData.some(p => p.providerId === 'facebook.com');

                                const needsSync = !isConnected && isAuthLinked;

                                return (
                                    <div key={platform.id} className="group relative overflow-hidden bg-[var(--color-surface-card)] p-6 rounded-2xl border border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50 transition-all">
                                        <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 bg-gradient-to-br ${platform.color} rounded-full -mr-16 -mt-16 group-hover:scale-125 transition-transform`} />

                                        <div className="relative z-10 flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="size-14 shrink-0 transition-transform group-hover:scale-110 duration-500">
                                                    <PlatformIcon platform={platform.id} className="size-full shadow-lg" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg text-[var(--color-text-main)]">{platform.name}</h3>
                                                    {isConnected ? (
                                                        <div className="space-y-1 mt-1">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
                                                                <span className="material-symbols-outlined text-[14px]">verified</span>
                                                                @{integration.username}
                                                            </div>
                                                            <div className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                                {t('social.settings.accounts.connectedOn')
                                                                    .replace('{date}', format(new Date(integration.connectedAt), dateFormat, { locale: dateLocale }))}
                                                            </div>
                                                        </div>
                                                    ) : needsSync ? (
                                                        <div className="space-y-1 mt-1">
                                                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                                                                <span className="material-symbols-outlined text-[14px]">sync_problem</span>
                                                                Auth Connected (Setup Incomplete)
                                                            </div>
                                                            <p className="text-[10px] text-[var(--color-text-muted)]">
                                                                Facebook is linked to your account, but we missed the final setup step.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">{t('social.settings.accounts.notConnected')}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {isConnected ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                    onClick={() => handleDisconnect(integration.id)}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">logout</span>
                                                </Button>
                                            ) : needsSync ? (
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => handleConnect(platform.id)}
                                                        isLoading={connecting === platform.id}
                                                    >
                                                        Complete Setup
                                                    </Button>
                                                    <button
                                                        onClick={() => handleUnlinkProvider('facebook.com')}
                                                        className="text-[10px] text-rose-500 hover:underline text-right"
                                                    >
                                                        Force Unlink
                                                    </button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleConnect(platform.id)}
                                                    isLoading={connecting === platform.id}
                                                    icon={<span className="material-symbols-outlined text-[18px]">add</span>}
                                                >
                                                    {t('social.settings.accounts.connect')}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'presets':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('social.settings.presets.title')}</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">{t('social.settings.presets.subtitle')}</p>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowPresetManager(true)}
                                icon={<span className="material-symbols-outlined">add</span>}
                            >
                                {t('social.settings.presets.newPreset')}
                            </Button>
                        </div>

                        <div className="pt-4">
                            {presets.length === 0 ? (
                                <div className="p-20 text-center bg-[var(--color-surface-card)] rounded-2xl border border-dashed border-[var(--color-surface-border)]">
                                    <span className="material-symbols-outlined text-4xl mb-4 text-[var(--color-text-muted)]">bookmark_add</span>
                                    <h3 className="font-bold text-lg mb-1">{t('social.settings.presets.empty.title')}</h3>
                                    <p className="text-[var(--color-text-muted)] mb-6">{t('social.settings.presets.empty.subtitle')}</p>
                                    <Button variant="secondary" onClick={() => setShowPresetManager(true)}>{t('social.settings.presets.empty.action')}</Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                                    {presets.map(preset => (
                                        <div key={preset.id} className="group bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl p-5 hover:border-[var(--color-primary)]/50 transition-all flex flex-col h-full shadow-sm hover:shadow-xl">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="size-10">
                                                    <PlatformIcon platform={preset.platform === 'All' ? 'Instagram' : preset.platform} className={`size-full ${preset.platform === 'All' ? 'opacity-50 grayscale' : ''}`} />
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                                                        onClick={async () => {
                                                            if (await confirm(t('social.settings.presets.deleteConfirm.title'), t('social.settings.presets.deleteConfirm.message'))) {
                                                                await deleteCaptionPreset(projectId!, preset.id);
                                                                showToast(t('social.settings.presets.toast.deleted'), "info");
                                                            }
                                                        }}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <h4 className="font-black text-lg text-[var(--color-text-main)] mb-2 line-clamp-1">{preset.name}</h4>
                                            <p className="text-sm text-[var(--color-text-muted)] line-clamp-3 mb-4 flex-1">{preset.content}</p>
                                            <div className="flex items-center gap-2 mt-auto pt-4 border-t border-[var(--color-surface-border)]">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${preset.platform === 'All' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {preset.platform}
                                                </span>
                                                {preset.hashtags && preset.hashtags.length > 0 && (
                                                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                                                        {t('social.settings.presets.tagsCount').replace('{count}', String(preset.hashtags.length))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'strategy':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">{t('social.settings.strategy.title')}</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('social.settings.strategy.subtitle')}</p>
                        </div>

                        <div className="pt-4">
                            <Card className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <label className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('social.settings.strategy.defaultPlatforms')}</label>
                                        <div className="flex flex-wrap gap-3">
                                            {PLATFORMS.map(p => {
                                                const isActive = strategy?.defaultPlatforms
                                                    ? strategy.defaultPlatforms.includes(p.id)
                                                    : true; // Default to all selected if no strategy yet
                                                return (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => toggleDefaultPlatform(p.id)}
                                                        className={`size-12 rounded-xl border-2 transition-all flex items-center justify-center overflow-hidden p-0.5 ${isActive
                                                            ? 'border-[var(--color-primary)] grayscale-0 shadow-md scale-110'
                                                            : 'border-[var(--color-surface-border)] grayscale hover:grayscale-[0.5]'
                                                            }`}
                                                    >
                                                        <PlatformIcon platform={p.id} className="size-full" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest">{t('social.settings.strategy.preferredTone')}</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'Professional', label: t('social.settings.strategy.tones.professional') },
                                                { id: 'Witty', label: t('social.settings.strategy.tones.witty') },
                                                { id: 'Minimalist', label: t('social.settings.strategy.tones.minimalist') },
                                                { id: 'Inspirational', label: t('social.settings.strategy.tones.inspirational') },
                                                { id: 'Casual', label: t('social.settings.strategy.tones.casual') },
                                                { id: 'Educational', label: t('social.settings.strategy.tones.educational') }
                                            ].map(tone => (
                                                <button
                                                    key={tone.id}
                                                    onClick={() => handleUpdateStrategy({ preferredTone: tone.id })}
                                                    className={`px-4 py-2 text-xs font-bold border rounded-lg transition-all ${strategy?.preferredTone === tone.id
                                                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                                                        : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
                                                        }`}
                                                >
                                                    {tone.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-[var(--color-surface-border)]">
                                    <div className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)]">{t('social.settings.strategy.hashtagLimits.title')}</h3>
                                        <p className="text-sm text-[var(--color-text-muted)]">{t('social.settings.strategy.hashtagLimits.subtitle')}</p>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                        {PLATFORMS.map(platform => {
                                            const limit = strategy?.hashtagLimits?.[platform.id] ?? (['Instagram', 'TikTok'].includes(platform.id) ? 5 : 30);
                                            return (
                                                <div key={platform.id} className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <PlatformIcon platform={platform.id} className="size-5" />
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{platform.id}</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={limit}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value);
                                                            const newLimits = { ...strategy?.hashtagLimits, [platform.id]: isNaN(val) ? 0 : val };
                                                            handleUpdateStrategy({ hashtagLimits: newLimits });
                                                        }}
                                                        className="w-full px-3 py-2 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)] text-[var(--color-text-main)] text-sm focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
                                                        min="0"
                                                        max="100"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-[var(--color-surface-border)]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-[var(--color-text-main)]">{t('social.settings.strategy.brandPillars.title')}</h3>
                                            <p className="text-sm text-[var(--color-text-muted)]">{t('social.settings.strategy.brandPillars.subtitle')}</p>
                                        </div>
                                    </div>
                                    <textarea
                                        value={strategy?.brandPillars || ''}
                                        onChange={(e) => handleUpdateStrategy({ brandPillars: e.target.value })}
                                        placeholder={t('social.settings.strategy.brandPillars.placeholder')}
                                        className="w-full p-6 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)] text-[var(--color-text-main)] text-sm resize-none focus:ring-1 focus:ring-[var(--color-primary)] outline-none min-h-[120px]"
                                    />
                                </div>
                            </Card>
                        </div>
                    </div>
                );
            case 'danger':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-rose-600">{t('social.settings.danger.title')}</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">{t('social.settings.danger.subtitle')}</p>
                        </div>

                        <div className="pt-4">
                            <Card className="divide-y divide-[var(--color-surface-border)]">
                                <div className="p-6 flex items-center justify-between gap-6">
                                    <div>
                                        <h3 className="font-bold text-[var(--color-text-main)]">{t('social.settings.danger.reset.title')}</h3>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('social.settings.danger.reset.description')}</p>
                                    </div>
                                    <Button variant="ghost" className="text-rose-600 hover:bg-rose-100 font-bold border border-rose-200">{t('social.settings.danger.reset.action')}</Button>
                                </div>

                                <div className="p-6 flex items-center justify-between gap-6">
                                    <div>
                                        <h3 className="font-bold text-[var(--color-text-main)]">{t('social.settings.danger.cleanup.title')}</h3>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('social.settings.danger.cleanup.description')}</p>
                                    </div>
                                    <Button variant="ghost" className="text-rose-600 hover:bg-rose-100 font-bold border border-rose-200">{t('social.settings.danger.cleanup.action')}</Button>
                                </div>
                            </Card>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-up min-h-screen">
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <aside className="w-full md:w-64 shrink-0 space-y-1">
                    <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)] px-2 mb-6">{t('social.settings.title')}</h1>
                    <NavItem id="accounts" label={t('social.settings.nav.accounts')} icon="api" />
                    <NavItem id="presets" label={t('social.settings.nav.presets')} icon="content_copy" />
                    <NavItem id="strategy" label={t('social.settings.nav.strategy')} icon="psychology" />
                    <NavItem id="danger" label={t('social.settings.nav.danger')} icon="warning" />
                </aside>

                <main className="flex-1 w-full min-w-0">
                    {renderContent()}
                </main>
            </div>

            <CaptionPresetManager
                isOpen={showPresetManager}
                onClose={() => setShowPresetManager(false)}
            />

            <TwoFactorChallengeModal
                isOpen={showMfaModal}
                onClose={() => {
                    setShowMfaModal(false);
                    setMfaResolver(null);
                    setPendingPlatform(null);
                }}
                resolver={mfaResolver}
                onSuccess={handleMfaSuccess}
            />
        </div>
    );
};
