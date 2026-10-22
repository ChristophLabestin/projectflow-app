import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../context/UIContext';
import { ApiResourceConfig } from '../../types';
import { subscribeMarketingSettings, updateMarketingSettings } from '../../services/marketingSettingsService';
import { BlogConnectionWizard } from './components/BlogConnectionWizard';

export const MarketingSettings: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { showSuccess, showError } = useToast();

    // Generic API Integration for the external blog
    const [showBlogWizard, setShowBlogWizard] = useState(false);
    const [apiSettings, setApiSettings] = useState<ApiResourceConfig | undefined>(undefined);
    const [savingBlogSettings, setSavingBlogSettings] = useState(false);

    useEffect(() => {
        if (!projectId) return;

        return subscribeMarketingSettings(projectId, (s) => {
            if (!s) return;
            if (s.apiIntegration) {
                setApiSettings(s.apiIntegration);
            } else if (s.blogIntegration) {
                // Migration fallback for UI if only old settings exist
                setApiSettings({
                    baseUrl: '',
                    headers: s.blogIntegration.headers || '{}',
                    resources: {
                        posts: {
                            endpoints: {
                                list: { path: s.blogIntegration.getEndpoint || '', method: 'GET' },
                                create: { path: s.blogIntegration.endpoint || '', method: 'POST' },
                                update: { path: '', method: 'PUT' },
                                delete: { path: '', method: 'DELETE' }
                            }
                        }
                    }
                });
            }
        });
    }, [projectId]);

    const handleSaveApiSettings = async (newSettings: ApiResourceConfig) => {
        if (!projectId) return;
        setSavingBlogSettings(true);
        try {
            await updateMarketingSettings(projectId, {
                apiIntegration: newSettings
            });
            setApiSettings(newSettings);
            setShowBlogWizard(false);
            showSuccess('API integration settings saved');
        } catch (e) {
            showError('Failed to save settings');
        } finally {
            setSavingBlogSettings(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-up">
            <h1 className="text-xl font-display font-bold text-main mb-6">Blog Integration</h1>
            <div className="space-y-6">
                        {/* We show either the summary card or the wizard */}
                        {!showBlogWizard ? (
                            <Card className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">api</span>
                                            Content API Integration
                                        </h3>
                                        <p className="text-sm text-muted mt-1">
                                            Connect to any external REST API to check sync status and configure resources like Posts and Categories.
                                        </p>
                                    </div>
                                    <Button variant={apiSettings ? "secondary" : "primary"} onClick={() => setShowBlogWizard(true)}>
                                        {apiSettings ? 'Reconfigure' : 'Setup Integration'}
                                    </Button>
                                </div>

                                {apiSettings ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 p-4 bg-green-500/5 rounded-xl border border-green-500/20">
                                            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-green-500">check_circle</span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-green-500">Active Connection</div>
                                                <div className="text-sm text-muted">{apiSettings.baseUrl}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-1">Resources</div>
                                                <div className="font-mono text-sm capitalize">
                                                    {Object.keys(apiSettings.resources).join(', ') || 'None'}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-1">Headers</div>
                                                <div className="font-mono text-sm truncate" title={apiSettings.headers}>
                                                    {apiSettings.headers !== '{}' ? 'Configured' : 'None'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Languages */}
                                        {apiSettings.supportedLanguages && apiSettings.supportedLanguages.length > 0 && (
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-2">Multi-Language Support</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {apiSettings.supportedLanguages.map(lang => (
                                                        <span
                                                            key={lang}
                                                            className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                                        >
                                                            {lang.toUpperCase()}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Data Model Fields */}
                                        {apiSettings.dataModel && (
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-2">Configured Data Model Fields</div>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {['id', 'title', 'slug', 'content', 'excerpt', 'coverImage', 'language', 'author', 'category', 'tags', 'status', 'publishedAt', 'url'].map(field => {
                                                        const fieldLower = field.toLowerCase();
                                                        const aliases: Record<string, string[]> = {
                                                            content: ['body', 'html', 'text'],
                                                            excerpt: ['description', 'summary'],
                                                            coverImage: ['image', 'thumbnail', 'featuredimage'],
                                                            language: ['locale', 'lang'],
                                                            publishedAt: ['createdat', 'date']
                                                        };
                                                        const allKeys = [fieldLower, ...(aliases[field] || [])];
                                                        const isDetected = allKeys.some(k =>
                                                            new RegExp(`["']?${k}["']?\\s*[?]?\\s*:`, 'i').test(apiSettings.dataModel || '')
                                                        );
                                                        return (
                                                            <span
                                                                key={field}
                                                                className={`px-2 py-0.5 rounded text-xs font-medium ${isDetected
                                                                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                                                        : 'bg-surface-hover text-muted opacity-50'
                                                                    }`}
                                                            >
                                                                {isDetected && '✓ '}{field}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted bg-surface rounded-xl border border-dashed border-surface">
                                        <span className="material-symbols-outlined text-4xl mb-3 opacity-50">hub</span>
                                        <h3 className="font-medium mb-1">No API Connected</h3>
                                        <p className="text-sm max-w-xs mx-auto mb-4">
                                            Connect to your CMS or custom backend to sync posts and categories.
                                        </p>
                                        <Button variant="primary" onClick={() => setShowBlogWizard(true)}>
                                            Start Setup Wizard
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <BlogConnectionWizard
                                initialSettings={apiSettings}
                                onSave={handleSaveApiSettings}
                                onCancel={() => setShowBlogWizard(false)}
                            />
                        )}
            </div>
        </div>
    );
};
