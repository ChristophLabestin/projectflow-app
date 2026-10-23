import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';
import { ApiResourceConfig } from '../../types';
import { subscribeMarketingSettings, updateMarketingSettings } from '../../services/marketingSettingsService';
import { BlogConnectionWizard } from './components/BlogConnectionWizard';

export const MarketingSettings: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { showSuccess, showError } = useToast();
    const { t } = useLanguage();

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
            showSuccess(t('marketing.settings.saved'));
        } catch (e) {
            showError(t('marketing.settings.saveFailed'));
        } finally {
            setSavingBlogSettings(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-up">
            <h1 className="text-xl font-display font-bold text-main mb-6">{t('marketing.settings.title')}</h1>
            <div className="space-y-6">
                        {/* We show either the summary card or the wizard */}
                        {!showBlogWizard ? (
                            <Card className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="font-semibold text-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">api</span>
                                            {t('marketing.settings.api.title')}
                                        </h3>
                                        <p className="text-sm text-muted mt-1">
                                            {t('marketing.settings.api.subtitle')}
                                        </p>
                                    </div>
                                    <Button variant={apiSettings ? "secondary" : "primary"} onClick={() => setShowBlogWizard(true)}>
                                        {apiSettings ? t('marketing.settings.reconfigure') : t('marketing.settings.setup')}
                                    </Button>
                                </div>

                                {apiSettings ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3 p-4 bg-success/5 rounded-xl border border-success/20">
                                            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-success">check_circle</span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-success">{t('marketing.settings.active')}</div>
                                                <div className="text-sm text-muted">{apiSettings.baseUrl}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-1">{t('marketing.settings.resources')}</div>
                                                <div className="font-mono text-sm capitalize">
                                                    {Object.keys(apiSettings.resources).join(', ') || t('marketing.settings.none')}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-1">{t('marketing.settings.headers')}</div>
                                                <div className="font-mono text-sm truncate" title={apiSettings.headers}>
                                                    {apiSettings.headers !== '{}' ? t('marketing.settings.configured') : t('marketing.settings.none')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Languages */}
                                        {apiSettings.supportedLanguages && apiSettings.supportedLanguages.length > 0 && (
                                            <div className="p-4 bg-surface rounded-xl border border-surface">
                                                <div className="text-xs text-muted uppercase tracking-wider mb-2">{t('marketing.settings.multiLanguage')}</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {apiSettings.supportedLanguages.map(lang => (
                                                        <span
                                                            key={lang}
                                                            className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
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
                                                <div className="text-xs text-muted uppercase tracking-wider mb-2">{t('marketing.settings.dataModelFields')}</div>
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
                                                                        ? 'bg-success/10 text-success'
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
                                        <h3 className="font-medium mb-1">{t('marketing.settings.noApi')}</h3>
                                        <p className="text-sm max-w-xs mx-auto mb-4">
                                            {t('marketing.settings.noApiHint')}
                                        </p>
                                        <Button variant="primary" onClick={() => setShowBlogWizard(true)}>
                                            {t('marketing.settings.startWizard')}
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
