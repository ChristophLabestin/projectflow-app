
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeIntegrations, connectIntegration, disconnectIntegration, subscribeCaptionPresets } from '../../services/dataService';
import { SocialIntegration, SocialPlatform, CaptionPreset } from '../../types';
import { Button } from '../../components/ui/Button';
import { useToast, useConfirm } from '../../context/UIContext';
import { CaptionPresetManager } from './components/CaptionPresetManager';

const PLATFORMS: { id: SocialPlatform; name: string; icon: string; color: string }[] = [
    { id: 'Instagram', name: 'Instagram', icon: 'photo_camera', color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500' },
    { id: 'Facebook', name: 'Facebook', icon: 'facebook', color: 'bg-blue-600' },
    { id: 'LinkedIn', name: 'LinkedIn', icon: 'business_center', color: 'bg-blue-700' },
    { id: 'X', name: 'X (Twitter)', icon: 'tag', color: 'bg-black' },
    { id: 'TikTok', name: 'TikTok', icon: 'music_note', color: 'bg-black' },
];

export const SocialSettings = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [integrations, setIntegrations] = useState<SocialIntegration[]>([]);
    const [connecting, setConnecting] = useState<SocialPlatform | null>(null);
    const [presets, setPresets] = useState<CaptionPreset[]>([]);
    const [showPresetManager, setShowPresetManager] = useState(false);
    const { showToast, showError, showSuccess } = useToast();
    const confirm = useConfirm();

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeIntegrations(projectId, (data) => setIntegrations(data));
        return () => unsub();
    }, [projectId]);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeCaptionPresets(projectId, setPresets);
        return () => unsub();
    }, [projectId]);

    const handleConnect = async (platform: SocialPlatform) => {
        if (!projectId) return;
        setConnecting(platform);
        try {
            await connectIntegration(projectId, platform);
            showSuccess(`Successfully connected to ${platform}`);
        } catch (error: any) {
            console.error("Failed to connect", error);
            showError(error.message || `Failed to connect to ${platform}`);
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
                console.error("Failed to disconnect", error);
                showError("Failed to disconnect account");
            }
        }
    };

    // Count presets per platform
    const presetCounts = presets.reduce((acc, p) => {
        acc[p.platform] = (acc[p.platform] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="h2 mb-2">Social Settings</h1>
                <p className="text-[var(--color-text-muted)]">Manage your connected social media accounts and presets.</p>
            </div>

            {/* Connected Accounts */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-[var(--color-text-main)]">Connected Accounts</h2>
                <div className="grid gap-4">
                    {PLATFORMS.map(platform => {
                        const integration = integrations.find(i => i.platform === platform.id);
                        const isConnected = !!integration;

                        return (
                            <div key={platform.id} className="flex items-center justify-between p-5 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className={`size-12 rounded-xl flex items-center justify-center text-white ${platform.color}`}>
                                        {platform.id === 'X' ? <span className="font-bold text-xl">X</span> : <span className="material-symbols-outlined text-2xl">{platform.icon}</span>}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">{platform.name}</h3>
                                        {isConnected ? (
                                            <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                Connected as {integration.username}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-[var(--color-text-muted)]">Not connected</p>
                                        )}
                                    </div>
                                </div>

                                {isConnected ? (
                                    <Button
                                        variant="ghost"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => handleDisconnect(integration.id)}
                                    >
                                        Disconnect
                                    </Button>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleConnect(platform.id)}
                                        isLoading={connecting === platform.id}
                                    >
                                        Connect
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Caption Presets */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-[var(--color-text-main)]">Caption Presets</h2>
                <div className="p-5 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-2xl">bookmark</span>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Saved Presets</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">
                                    {presets.length === 0
                                        ? 'No presets saved yet'
                                        : `${presets.length} preset${presets.length === 1 ? '' : 's'} saved`
                                    }
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            onClick={() => setShowPresetManager(true)}
                        >
                            <span className="material-symbols-outlined text-[16px] mr-1">settings</span>
                            Manage Presets
                        </Button>
                    </div>

                    {/* Platform breakdown */}
                    {presets.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[var(--color-surface-border)] flex flex-wrap gap-2">
                            {Object.entries(presetCounts).map(([platform, count]) => (
                                <span
                                    key={platform}
                                    className="px-3 py-1 bg-[var(--color-surface-hover)] rounded-full text-xs font-medium text-[var(--color-text-muted)]"
                                >
                                    {platform}: {count}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Preset Manager Modal */}
            <CaptionPresetManager
                isOpen={showPresetManager}
                onClose={() => setShowPresetManager(false)}
            />
        </div>
    );
};
