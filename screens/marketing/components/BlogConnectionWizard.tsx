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

type WizardStep = 'welcome' | 'base_auth' | 'resources' | 'data_model' | 'validation' | 'completion';
type ResourceType = 'posts' | 'categories';

const DEFAULT_RESOURCES: ResourceType[] = ['posts', 'categories'];

const DEFAULT_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'German' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'pl', name: 'Polish' },
    { code: 'ja', name: 'Japanese' },
    { code: 'zh', name: 'Chinese' },
];

// Helper to detect if a data model contains a language field
const detectLanguageField = (dataModel: string): boolean => {
    if (!dataModel) return false;
    // Check for common patterns: language: string, locale: string, lang: string
    const patterns = [
        /language\s*[?]?\s*:\s*(string|'[a-z]{2}')/i,
        /locale\s*[?]?\s*:\s*(string|'[a-z]{2}')/i,
        /lang\s*[?]?\s*:\s*(string|'[a-z]{2}')/i,
        /"language"\s*:/i,
        /"locale"\s*:/i,
    ];
    return patterns.some(pattern => pattern.test(dataModel));
};

// Known BlogPost fields that the application can map
const KNOWN_FIELDS = [
    { key: 'id', label: 'ID', required: true },
    { key: 'title', label: 'Title', required: true },
    { key: 'slug', label: 'Slug', required: false },
    { key: 'content', label: 'Content', required: true, aliases: ['body', 'html', 'text'] },
    { key: 'excerpt', label: 'Excerpt', required: false, aliases: ['description', 'summary'] },
    { key: 'coverImage', label: 'Cover Image', required: false, aliases: ['image', 'thumbnail', 'featuredImage'] },
    { key: 'language', label: 'Language', required: false, aliases: ['locale', 'lang'] },
    { key: 'author', label: 'Author', required: false },
    { key: 'category', label: 'Category', required: false },
    { key: 'tags', label: 'Tags', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'publishedAt', label: 'Published Date', required: false, aliases: ['createdAt', 'date'] },
    { key: 'url', label: 'URL', required: false },
];

// Parse data model and detect which fields are present
const parseDataModel = (dataModel: string): { isValid: boolean; detectedFields: string[]; error?: string } => {
    if (!dataModel.trim()) {
        return { isValid: true, detectedFields: [] }; // Empty is valid (optional)
    }

    // Check if it looks like a TypeScript interface or JSON
    const isTypeScript = /interface\s+\w+/i.test(dataModel) || /type\s+\w+\s*=/i.test(dataModel);
    const isJson = dataModel.trim().startsWith('{');

    if (!isTypeScript && !isJson) {
        return {
            isValid: false,
            detectedFields: [],
            error: 'Data model should be a TypeScript interface or JSON object'
        };
    }

    // Detect fields present in the data model
    const detectedFields: string[] = [];
    const contentLower = dataModel.toLowerCase();

    for (const field of KNOWN_FIELDS) {
        const allKeys = [field.key, ...(field.aliases || [])];
        for (const key of allKeys) {
            // Check for various patterns: key:, "key":, key?:, 'key':
            const patterns = [
                new RegExp(`["']?${key}["']?\\s*[?]?\\s*:`, 'i'),
            ];
            if (patterns.some(p => p.test(contentLower))) {
                detectedFields.push(field.key);
                break;
            }
        }
    }

    // Check for required fields
    const missingRequired = KNOWN_FIELDS
        .filter(f => f.required && !detectedFields.includes(f.key))
        .map(f => f.label);

    if (missingRequired.length > 0 && detectedFields.length > 0) {
        return {
            isValid: false,
            detectedFields,
            error: `Missing required fields: ${missingRequired.join(', ')}`
        };
    }

    return { isValid: true, detectedFields };
};

export const BlogConnectionWizard: React.FC<BlogConnectionWizardProps> = ({ initialSettings, onSave, onCancel }) => {
    const { showSuccess, showError } = useToast();
    const [step, setStep] = useState<WizardStep>('welcome');

    // Core Config
    const [baseUrl, setBaseUrl] = useState(initialSettings?.baseUrl || '');
    const [headers, setHeaders] = useState(initialSettings?.headers || '{}');

    // Data Model Config
    const [dataModel, setDataModel] = useState(initialSettings?.dataModel || '');
    const [hasLanguageField, setHasLanguageField] = useState(false);
    const [supportedLanguages, setSupportedLanguages] = useState<string[]>(initialSettings?.supportedLanguages || []);
    const [dataModelValidation, setDataModelValidation] = useState<{ isValid: boolean; detectedFields: string[]; error?: string }>({ isValid: true, detectedFields: [] });

    // Detect language field and validate when data model changes
    useEffect(() => {
        const hasLang = detectLanguageField(dataModel);
        setHasLanguageField(hasLang);
        if (!hasLang) {
            setSupportedLanguages([]);
        }
        // Validate the data model
        setDataModelValidation(parseDataModel(dataModel));
    }, [dataModel]);

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
        else if (step === 'resources') setStep('data_model');
        else if (step === 'data_model') {
            // Validate data model if provided
            if (dataModel.trim() && !dataModelValidation.isValid) {
                showError(dataModelValidation.error || 'Invalid data model format');
                return;
            }
            // If language field detected but no languages selected, show warning
            if (hasLanguageField && supportedLanguages.length === 0) {
                showError('Please select at least one language to enable multi-language support');
                return;
            }
            setStep('validation');
        }
    };

    const handleBack = () => {
        if (step === 'base_auth') setStep('welcome');
        else if (step === 'resources') setStep('base_auth');
        else if (step === 'data_model') setStep('resources');
        else if (step === 'validation') setStep('data_model');
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
                dataModel: dataModel || undefined,
                supportedLanguages: supportedLanguages.length > 0 ? supportedLanguages : undefined,
                resources
            });
            setStep('completion');
        } catch (e) {
            showError('Failed to save configuration');
        }
    };

    const toggleLanguage = (code: string) => {
        setSupportedLanguages(prev =>
            prev.includes(code)
                ? prev.filter(l => l !== code)
                : [...prev, code]
        );
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
                    {(['welcome', 'base_auth', 'resources', 'data_model', 'validation'] as WizardStep[]).map((s, idx) => {
                        const isActive = s === step;
                        const isPast = (['welcome', 'base_auth', 'resources', 'data_model', 'validation'] as WizardStep[]).indexOf(s) < (['welcome', 'base_auth', 'resources', 'data_model', 'validation'] as WizardStep[]).indexOf(step);
                        return (
                            <div key={s} className={`h-2 rounded-full transition-all ${isActive ? 'w-12 bg-[var(--color-primary)]' : isPast ? 'w-2 bg-[var(--color-primary)]/50' : 'w-2 bg-[var(--color-surface-border)]'}`} />
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

                {step === 'data_model' && (
                    <div className="space-y-6 animate-fade-up max-w-2xl mx-auto">
                        <div>
                            <h3 className="text-lg font-bold mb-2">Data Model (Optional)</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Define your blog post structure. If your API supports multiple languages, include a <code className="bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded text-xs">language</code> field.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium">Post Interface / Schema</label>
                            <textarea
                                className="w-full h-64 bg-zinc-900 text-zinc-100 font-mono text-xs p-4 rounded-xl border border-[var(--color-surface-border)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none"
                                value={dataModel}
                                onChange={(e) => setDataModel(e.target.value)}
                                placeholder={`interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  coverImage?: string;
  language?: string;  // Add this for multi-language support
  author: {
    name: string;
    avatar?: string;
  };
  category: {
    name: string;
    slug: string;
  };
  tags?: string[];
  status: 'draft' | 'published';
  publishedAt?: string;
}`}
                                spellCheck={false}
                            />
                            <p className="text-xs text-[var(--color-text-muted)]">
                                This helps ProjectFlow understand how to map data to your API.
                            </p>
                        </div>

                        {/* Validation Status & Detected Fields */}
                        {dataModel.trim() && (
                            <div className={`p-4 rounded-xl border ${dataModelValidation.isValid
                                    ? 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)]'
                                    : 'bg-red-500/5 border-red-500/20'
                                }`}>
                                {dataModelValidation.error ? (
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-red-500 shrink-0">error</span>
                                        <div>
                                            <div className="font-medium text-red-500">Invalid Data Model</div>
                                            <div className="text-sm text-red-400">{dataModelValidation.error}</div>
                                        </div>
                                    </div>
                                ) : dataModelValidation.detectedFields.length > 0 ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-green-500 text-lg">check_circle</span>
                                            <span className="font-medium text-green-600 dark:text-green-400">
                                                Valid Data Model — {dataModelValidation.detectedFields.length} fields detected
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {KNOWN_FIELDS.map(field => {
                                                const isDetected = dataModelValidation.detectedFields.includes(field.key);
                                                return (
                                                    <span
                                                        key={field.key}
                                                        className={`px-2 py-1 rounded text-xs font-medium ${isDetected
                                                                ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                                                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] border border-transparent opacity-50'
                                                            }`}
                                                    >
                                                        {isDetected && <span className="mr-1">✓</span>}
                                                        {field.label}
                                                        {field.required && !isDetected && <span className="ml-1 text-red-400">*</span>}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)]">
                                            Fields marked with * are required for full functionality.
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        )}
                        {hasLanguageField && (
                            <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/20 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-green-500">translate</span>
                                    </div>
                                    <div>
                                        <div className="font-medium text-green-600 dark:text-green-400">Language Field Detected!</div>
                                        <div className="text-sm text-[var(--color-text-muted)]">
                                            Multi-language support is available. Select the languages you want to support.
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {DEFAULT_LANGUAGES.map(lang => {
                                        const isSelected = supportedLanguages.includes(lang.code);
                                        return (
                                            <button
                                                key={lang.code}
                                                type="button"
                                                onClick={() => toggleLanguage(lang.code)}
                                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${isSelected
                                                    ? 'bg-[var(--color-primary)] text-white dark:text-black border-[var(--color-primary)]'
                                                    : 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] border-[var(--color-surface-border)] hover:border-[var(--color-primary)]'
                                                    }`}
                                            >
                                                {isSelected && <span className="mr-1">✓</span>}
                                                {lang.name} ({lang.code})
                                            </button>
                                        );
                                    })}
                                </div>

                                {supportedLanguages.length > 0 && (
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        Selected: {supportedLanguages.join(', ')}
                                    </p>
                                )}
                            </div>
                        )}

                        {!hasLanguageField && dataModel && (
                            <div className="p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)]">
                                <div className="flex items-start gap-3">
                                    <span className="material-symbols-outlined text-[var(--color-text-muted)]">info</span>
                                    <div className="text-sm text-[var(--color-text-muted)]">
                                        <strong>Tip:</strong> To enable multi-language support, add a <code className="bg-[var(--color-surface-hover)] px-1 rounded">language: string</code> field to your data model.
                                    </div>
                                </div>
                            </div>
                        )}
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
