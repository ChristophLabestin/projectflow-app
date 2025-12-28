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
            showSuccess(`Successfully connected to ${platform} `);
        } catch (error: any) {
            showError(error.message || `Failed to connect to ${platform} `);
        } finally {
            setConnecting(null);
        }
    };

    const handleDisconnect = async (integrationId: string) => {
        if (!projectId) return;
        const confirmed = await confirm(
            "Disconnect Account",
            "Are you sure you want to disconnect this account? Scheduled posts might fail."
        );
        if (confirmed) {
            try {
                await disconnectIntegration(projectId, integrationId);
                showToast("Account disconnected", "info");
            } catch (error) {
                showError("Failed to disconnect account");
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
            showError("Failed to update strategy");
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
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Platform Integrations</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">Connect your social accounts for direct publishing.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            {PLATFORMS.map(platform => {
                                const integration = integrations.find(i => i.platform === platform.id);
                                const isConnected = !!integration;

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
                                                                Connected {format(new Date(integration.connectedAt), 'MMM d, yyyy')}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-[var(--color-text-muted)] font-medium mt-1">Not yet connected</p>
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
                                            ) : (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleConnect(platform.id)}
                                                    isLoading={connecting === platform.id}
                                                    icon={<span className="material-symbols-outlined text-[18px]">add</span>}
                                                >
                                                    Connect
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
                                <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Caption & Format Presets</h2>
                                <p className="text-sm text-[var(--color-text-muted)]">Save templates and hashtags for different platforms.</p>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowPresetManager(true)}
                                icon={<span className="material-symbols-outlined">add</span>}
                            >
                                New Preset
                            </Button>
                        </div>

                        <div className="pt-4">
                            {presets.length === 0 ? (
                                <div className="p-20 text-center bg-[var(--color-surface-card)] rounded-2xl border border-dashed border-[var(--color-surface-border)]">
                                    <span className="material-symbols-outlined text-4xl mb-4 text-[var(--color-text-muted)]">bookmark_add</span>
                                    <h3 className="font-bold text-lg mb-1">No presets found</h3>
                                    <p className="text-[var(--color-text-muted)] mb-6">Create templates to speed up your posting workflow.</p>
                                    <Button variant="secondary" onClick={() => setShowPresetManager(true)}>Create First Preset</Button>
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
                                                            if (await confirm("Delete Preset", "Delete this preset forever?")) {
                                                                await deleteCaptionPreset(projectId!, preset.id);
                                                                showToast("Preset deleted", "info");
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
                                                        {preset.hashtags.length} Tags
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
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Social Strategy & Brain</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">Configure how AI generates content for this project.</p>
                        </div>

                        <div className="pt-4">
                            <Card className="p-8 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <label className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest">Default Platforms</label>
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
                                        <label className="text-xs font-black text-[var(--color-text-muted)] uppercase tracking-widest">Preferred Tone</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {['Professional', 'Witty', 'Minimalist', 'Inspirational', 'Casual', 'Educational'].map(tone => (
                                                <button
                                                    key={tone}
                                                    onClick={() => handleUpdateStrategy({ preferredTone: tone })}
                                                    className={`px-4 py-2 text-xs font-bold border rounded-lg transition-all ${strategy?.preferredTone === tone
                                                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                                                        : 'border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/50'
                                                        }`}
                                                >
                                                    {tone}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-[var(--color-surface-border)]">
                                    <div className="mb-4">
                                        <h3 className="font-bold text-[var(--color-text-main)]">Hashtag Limits</h3>
                                        <p className="text-sm text-[var(--color-text-muted)]">Set the maximum number of hashtags for each platform.</p>
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
                                            <h3 className="font-bold text-[var(--color-text-main)]">Brand Pillars & Context</h3>
                                            <p className="text-sm text-[var(--color-text-muted)]">Provide high-level context that the social AI should always consider.</p>
                                        </div>
                                    </div>
                                    <textarea
                                        value={strategy?.brandPillars || ''}
                                        onChange={(e) => handleUpdateStrategy({ brandPillars: e.target.value })}
                                        placeholder="e.g. Focus on sustainable tech, community growing, and long-form educational threads about local agriculture..."
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
                            <h2 className="text-xl font-display font-bold text-rose-600">Danger Zone</h2>
                            <p className="text-sm text-[var(--color-text-muted)]">Irreversible actions related to the social module.</p>
                        </div>

                        <div className="pt-4">
                            <Card className="divide-y divide-[var(--color-surface-border)]">
                                <div className="p-6 flex items-center justify-between gap-6">
                                    <div>
                                        <h3 className="font-bold text-[var(--color-text-main)]">Reset Social Module</h3>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-1">This will permanently delete all social posts, campaigns, and integrations for this project.</p>
                                    </div>
                                    <Button variant="ghost" className="text-rose-600 hover:bg-rose-100 font-bold border border-rose-200">Reset Module</Button>
                                </div>

                                <div className="p-6 flex items-center justify-between gap-6">
                                    <div>
                                        <h3 className="font-bold text-[var(--color-text-main)]">Deep Clean Assets</h3>
                                        <p className="text-sm text-[var(--color-text-muted)] mt-1">Free up storage by deleting all social-related assets that aren't attached to a published post.</p>
                                    </div>
                                    <Button variant="ghost" className="text-rose-600 hover:bg-rose-100 font-bold border border-rose-200">Deep Clean</Button>
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
                    <h1 className="text-2xl font-display font-bold text-[var(--color-text-main)] px-2 mb-6">Social Settings</h1>
                    <NavItem id="accounts" label="Accounts" icon="api" />
                    <NavItem id="presets" label="Presets" icon="content_copy" />
                    <NavItem id="strategy" label="Strategy" icon="psychology" />
                    <NavItem id="danger" label="Danger Zone" icon="warning" />
                </aside>

                <main className="flex-1 w-full min-w-0">
                    {renderContent()}
                </main>
            </div>

            <CaptionPresetManager
                isOpen={showPresetManager}
                onClose={() => setShowPresetManager(false)}
            />
        </div>
    );
};
