import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { useToast } from '../../../context/UIContext';
import { ApiResourceConfig, ApiEndpoint } from '../../../types';

interface BlogConnectionWizardProps {
    initialSettings?: ApiResourceConfig;
    onSave: (settings: ApiResourceConfig) => Promise<void>;
    onCancel: () => void;
}

type WizardStep = 'welcome' | 'base_auth' | 'resources' | 'validation' | 'completion';
type ResourceType = 'posts' | 'categories';

const DEFAULT_RESOURCES: ResourceType[] = ['posts', 'categories'];

export const BlogConnectionWizard: React.FC<BlogConnectionWizardProps> = ({ initialSettings, onSave, onCancel }) => {
    const { showSuccess, showError } = useToast();
    const [step, setStep] = useState<WizardStep>('welcome');

    // Core Config
    const [baseUrl, setBaseUrl] = useState(initialSettings?.baseUrl || '');
    const [headers, setHeaders] = useState(initialSettings?.headers || '{}');

    // Resources Config
    const [resources, setResources] = useState<ApiResourceConfig['resources']>(initialSettings?.resources || {
        posts: { endpoints: {} },
        categories: { endpoints: {} }
    });

    const [activeResourceTab, setActiveResourceTab] = useState<ResourceType>('posts');

    // Validation State
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Per-Resource Test Status
    const [resourceTestStatus, setResourceTestStatus] = useState<Record<ResourceType, 'idle' | 'testing' | 'success' | 'error'>>({
        posts: 'idle',
        categories: 'idle'
    });

    // Helpers
    const updateEndpoint = (resource: string, type: keyof ApiResourceConfig['resources'][string]['endpoints'], field: keyof ApiEndpoint, value: string) => {
        setResources(prev => {
            const res = prev[resource] || { endpoints: {} };
            const defaultMethods: Record<string, string> = {
                list: 'GET',
                get: 'GET',
                create: 'POST',
                update: 'PUT',
                delete: 'DELETE'
            };
            const endpoint = res.endpoints[type] || { path: '', method: defaultMethods[type] || 'GET' };

            return {
                ...prev,
                [resource]: {
                    ...res,
                    endpoints: {
                        ...res.endpoints,
                        [type]: {
                            ...endpoint,
                            [field]: value
                        }
                    }
                }
            };
        });
    };

    const handleNext = () => {
        if (step === 'welcome') setStep('base_auth');
        else if (step === 'base_auth') {
            if (!baseUrl) {
                showError('Base URL is required');
                return;
            }
            try {
                JSON.parse(headers);
            } catch (e) {
                showError('Headers must be valid JSON');
                return;
            }
            setStep('resources');
        }
        else if (step === 'resources') setStep('validation');
    };

    const handleBack = () => {
        if (step === 'base_auth') setStep('welcome');
        else if (step === 'resources') setStep('base_auth');
        else if (step === 'validation') setStep('resources');
    };

    const testResource = async (resource: ResourceType) => {
        const endpoint = resources[resource]?.endpoints?.list;
        if (!endpoint?.path) {
            showError(`Please configure the List endpoint for ${resource}`);
            return;
        }

        setResourceTestStatus(prev => ({ ...prev, [resource]: 'testing' }));

        const url = endpoint.path.startsWith('http') ? endpoint.path : `${baseUrl}${endpoint.path}`;
        let parsedHeaders = {};
        try {
            parsedHeaders = JSON.parse(headers);
        } catch (e) {
            showError('Invalid Headers JSON');
            setResourceTestStatus(prev => ({ ...prev, [resource]: 'error' }));
            return;
        }

        try {
            const res = await fetch(url, {
                method: endpoint.method,
                headers: { ...parsedHeaders, 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                showSuccess(`${resource.charAt(0).toUpperCase() + resource.slice(1)} endpoint verified!`);
                setResourceTestStatus(prev => ({ ...prev, [resource]: 'success' }));
            } else {
                const body = await res.text();
                const detailedError = `Status: ${res.status} ${res.statusText}\nBody: ${body}\nURL: ${url}`;
                showError(`Failed to verify ${resource} endpoint`, detailedError);
                setResourceTestStatus(prev => ({ ...prev, [resource]: 'error' }));
            }
        } catch (e: any) {
            const detailedError = `Error: ${e.message}\nThis might be a CORS issue if your API is not configured to allow requests from ${window.location.origin}.`;
            showError(`Network error while testing ${resource} endpoint`, detailedError);
            setResourceTestStatus(prev => ({ ...prev, [resource]: 'error' }));
        }
    };

    const runValidation = async () => {
        setTestingConnection(true);
        setConnectionStatus('idle');
        setConnectionError(null);

        try {
            // Validate Base URL
            try {
                new URL(baseUrl);
            } catch (e) {
                throw new Error('Invalid Base URL');
            }

            // Test Posts List Endpoint
            const postsList = resources['posts']?.endpoints?.list;
            if (postsList?.path) {
                const url = postsList.path.startsWith('http') ? postsList.path : `${baseUrl}${postsList.path}`;
                const parsedHeaders = JSON.parse(headers);

                try {
                    const res = await fetch(url, {
                        method: postsList.method,
                        headers: { ...parsedHeaders, 'Content-Type': 'application/json' }
                    });

                    if (!res.ok) {
                        console.warn('Validation warning: Posts endpoint returned', res.status);
                    }
                } catch (e) {
                    console.warn('Network error during validation (CORS likely)', e);
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
            setConnectionStatus('success');
        } catch (e: any) {
            setConnectionStatus('error');
            setConnectionError(e.message || 'Validation failed');
            showError('Validation failed', e.message || 'Unknown error');
        } finally {
            setTestingConnection(false);
        }
    };

    const handleFinalSave = async () => {
        try {
            await onSave({
                baseUrl,
                headers,
                resources
            });
            setStep('completion');
        } catch (e) {
            showError('Failed to save configuration');
        }
    };

    return (
        <Card className="max-w-4xl mx-auto overflow-hidden flex flex-col min-h-[600px] border-0 shadow-2xl bg-[var(--color-surface-card)]">
            {/* Header */}
            <div className="bg-[var(--color-surface-bg)] border-b border-[var(--color-surface-border)] p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <span className="material-symbols-outlined text-sm">api</span>
                        </span>
                        API Integration Setup
                    </h2>
                    <Button variant="ghost" size="sm" onClick={onCancel}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </Button>
                </div>

                {/* Progress */}
                <div className="flex items-center justify-center gap-2">
                    {(['welcome', 'base_auth', 'resources', 'validation'] as WizardStep[]).map((s, idx) => {
                        const isActive = s === step;
                        return (
                            <div key={s} className={`h-2 rounded-full transition-all ${isActive ? 'w-12 bg-[var(--color-primary)]' : 'w-2 bg-[var(--color-surface-border)]'}`} />
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-y-auto">
                {step === 'welcome' && (
                    <div className="flex flex-col items-center text-center space-y-6 animate-fade-up">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-[var(--color-primary)]/20">
                            <span className="material-symbols-outlined text-4xl text-white">hub</span>
                        </div>
                        <h3 className="text-2xl font-bold">Connect Your Content API</h3>
                        <p className="text-[var(--color-text-muted)] max-w-lg text-lg">
                            Configure a generic REST client to manage your blog posts and categories externally.
                        </p>
                    </div>
                )}

                {step === 'base_auth' && (
                    <div className="space-y-6 animate-fade-up max-w-2xl mx-auto">
                        <h3 className="text-lg font-bold">Base Configuration</h3>

                        <Input
                            label="Base URL"
                            placeholder="https://api.example.com/v1"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            helperText="Root URL for your API"
                        />

                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Global Headers (JSON)</label>
                            <textarea
                                className="w-full h-40 bg-zinc-900 text-zinc-100 font-mono text-xs p-4 rounded-xl border border-[var(--color-surface-border)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none"
                                value={headers}
                                onChange={(e) => setHeaders(e.target.value)}
                                placeholder={`{\n  "Authorization": "Bearer ...",\n  "Content-Type": "application/json"\n}`}
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {step === 'resources' && (
                    <div className="space-y-6 animate-fade-up">
                        <h3 className="text-lg font-bold">Resource Configuration</h3>

                        {/* Tabs */}
                        <div className="flex border-b border-[var(--color-surface-border)]">
                            {DEFAULT_RESOURCES.map(res => (
                                <button
                                    key={res}
                                    onClick={() => setActiveResourceTab(res)}
                                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeResourceTab === res
                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {res.charAt(0).toUpperCase() + res.slice(1)}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)]">
                            <div className="flex items-center gap-3">
                                <span className={`material-symbols-outlined ${resourceTestStatus[activeResourceTab] === 'success' ? 'text-green-500' : 'text-[var(--color-text-muted)]'}`}>
                                    {resourceTestStatus[activeResourceTab] === 'success' ? 'check_circle' :
                                        resourceTestStatus[activeResourceTab] === 'testing' ? 'progress_activity' : 'info'}
                                </span>
                                <div>
                                    <div className="text-sm font-medium">Endpoint Verification</div>
                                    <p className="text-xs text-[var(--color-text-muted)]">Test the list endpoint before proceeding</p>
                                </div>
                            </div>
                            <Button
                                variant={resourceTestStatus[activeResourceTab] === 'success' ? 'secondary' : 'primary'}
                                size="sm"
                                onClick={() => testResource(activeResourceTab)}
                                isLoading={resourceTestStatus[activeResourceTab] === 'testing'}
                            >
                                {resourceTestStatus[activeResourceTab] === 'success' ? 'Test Again' : 'Test Endpoint'}
                            </Button>
                        </div>

                        <div className="mt-6 space-y-8">
                            {['list', 'create', 'update', 'delete'].map((action) => {
                                const endpoint = resources[activeResourceTab]?.endpoints?.[action as keyof typeof resources['posts']['endpoints']] || { path: '', method: 'GET' };

                                return (
                                    <div key={action} className="grid grid-cols-[100px_1fr_120px] gap-4 items-start">
                                        <div className="pt-3 text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                                            {action}
                                        </div>
                                        <Input
                                            placeholder={action === 'list' ? '/posts' : action === 'update' ? '/posts/:id' : '/posts'}
                                            value={endpoint.path}
                                            onChange={(e) => updateEndpoint(activeResourceTab, action as any, 'path', e.target.value)}
                                        />
                                        <select
                                            className="h-[42px] px-3 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg text-sm focus:border-[var(--color-primary)] outline-none"
                                            value={endpoint.method}
                                            onChange={(e) => updateEndpoint(activeResourceTab, action as any, 'method', e.target.value)}
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                            <option value="PUT">PUT</option>
                                            <option value="DELETE">DELETE</option>
                                            <option value="PATCH">PATCH</option>
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 bg-[var(--color-surface-bg)] rounded-lg text-xs text-[var(--color-text-muted)] mt-4">
                            <p><strong>Tip:</strong> Use <code>:id</code> as a placeholder for resource IDs in Update/Delete/Get paths.</p>
                        </div>
                    </div>
                )}

                {step === 'validation' && (
                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] animate-fade-up">
                        {connectionStatus === 'idle' && !testingConnection && (
                            <div className="text-center">
                                <Button variant="primary" size="lg" onClick={runValidation}>
                                    Validate Configuration
                                </Button>
                            </div>
                        )}

                        {testingConnection && (
                            <div className="text-center">
                                <span className="material-symbols-outlined animate-spin text-4xl text-[var(--color-primary)] mb-4">progress_activity</span>
                                <p>Testing connection to {baseUrl}...</p>
                            </div>
                        )}

                        {connectionStatus === 'success' && (
                            <div className="text-center">
                                <span className="material-symbols-outlined text-5xl text-green-500 mb-4">check_circle</span>
                                <h3 className="text-xl font-bold mb-2">Validated!</h3>
                                <Button variant="primary" onClick={handleFinalSave}>Save Configuration</Button>
                            </div>
                        )}

                        {connectionStatus === 'error' && (
                            <div className="text-center text-red-500">
                                <span className="material-symbols-outlined text-5xl mb-4">error</span>
                                <p className="mb-4">{connectionError}</p>
                                <Button variant="secondary" onClick={() => setStep('resources')}>Adjust Settings</Button>
                            </div>
                        )}
                    </div>
                )}

                {step === 'completion' && (
                    <div className="flex flex-col items-center justify-center h-full animate-fade-up">
                        <span className="material-symbols-outlined text-5xl text-[var(--color-primary)] mb-4">celebration</span>
                        <h3 className="text-2xl font-bold mb-6">Setup Complete</h3>
                        <Button variant="primary" onClick={onCancel}>Done</Button>
                    </div>
                )}
            </div>

            {/* Footer */}
            {step !== 'completion' && (
                <div className="p-6 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)] flex justify-between">
                    {step !== 'welcome' ? (
                        <Button variant="ghost" onClick={handleBack}>Back</Button>
                    ) : <div></div>}

                    {step !== 'validation' && (
                        <Button
                            variant="primary"
                            onClick={handleNext}
                            disabled={step === 'resources' && (resourceTestStatus.posts !== 'success' || resourceTestStatus.categories !== 'success')}
                        >
                            Next
                        </Button>
                    )}
                </div>
            )}
        </Card>
    );
};
