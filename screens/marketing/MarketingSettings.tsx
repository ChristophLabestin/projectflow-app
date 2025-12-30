import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../context/UIContext';
import { RecipientColumn, GroupColumn, MarketingSettings as MarketingSettingsType, SMTPConfig, SMTPSource, RecipientGroup } from '../../types';
import { subscribeRecipientColumns, addRecipientColumn, deleteRecipientColumn } from '../../services/recipientService';
import { subscribeGroupColumns, addGroupColumn, deleteGroupColumn, subscribeGroups } from '../../services/groupService';
import { subscribeMarketingSettings, updateMarketingSettings } from '../../services/marketingSettingsService';
import { auth, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';
import { getTenant } from '../../services/dataService';
import { getActiveTenantId } from '../../services/dataService';
import { BlogConnectionWizard } from './components/BlogConnectionWizard';

// SMTP Source options
const SMTP_OPTIONS: { value: SMTPSource; label: string; description: string }[] = [
    { value: 'projectflow', label: 'ProjectFlow Default', description: 'Use ProjectFlow\'s built-in email delivery' },
    { value: 'workspace', label: 'Workspace SMTP', description: 'Use your workspace\'s global SMTP settings' },
    { value: 'project', label: 'Project SMTP', description: 'Configure project-specific SMTP server' }
];

type MarketingTab = 'data' | 'email' | 'embed' | 'blog' | 'analytics' | 'automation' | 'preferences';

export const MarketingSettings: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { showSuccess, showError } = useToast();
    const [activeTab, setActiveTab] = useState<MarketingTab>('data');

    // Column states
    const [recipientColumns, setRecipientColumns] = useState<RecipientColumn[]>([]);
    const [groupColumns, setGroupColumns] = useState<GroupColumn[]>([]);

    // New column form states
    const [newRecipientColumn, setNewRecipientColumn] = useState({ label: '', key: '', type: 'text' as const });
    const [newGroupColumn, setNewGroupColumn] = useState({ label: '', key: '', type: 'text' as const });
    const [addingRecipientColumn, setAddingRecipientColumn] = useState(false);
    const [addingGroupColumn, setAddingGroupColumn] = useState(false);

    // SMTP states
    const [settings, setSettings] = useState<MarketingSettingsType | null>(null);
    const [smtpSource, setSmtpSource] = useState<SMTPSource>('projectflow');
    const [smtpConfig, setSmtpConfig] = useState<Partial<SMTPConfig>>({
        host: '',
        port: 587,
        user: '',
        pass: '',
        secure: false,
        fromEmail: ''
    });
    const [workspaceSMTP, setWorkspaceSMTP] = useState<SMTPConfig | null>(null);
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);

    // Groups for embed customization
    const [groups, setGroups] = useState<RecipientGroup[]>([]);
    const [embedSelectedGroups, setEmbedSelectedGroups] = useState<string[]>([]);

    // Blog Integration States
    // Generic API Integration
    const [showBlogWizard, setShowBlogWizard] = useState(false);
    const [apiSettings, setApiSettings] = useState<ApiResourceConfig | undefined>(undefined);
    const [savingBlogSettings, setSavingBlogSettings] = useState(false);

    // Load data
    useEffect(() => {
        if (!projectId) return;

        const unsubRecipientCols = subscribeRecipientColumns(projectId, setRecipientColumns);
        const unsubGroupCols = subscribeGroupColumns(projectId, setGroupColumns);
        const unsubGroups = subscribeGroups(projectId, setGroups);
        const unsubSettings = subscribeMarketingSettings(projectId, (s) => {
            setSettings(s);
            if (s) {
                setSmtpSource(s.smtpSource || 'projectflow');
                if (s.smtpConfig) setSmtpConfig(s.smtpConfig);
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
            }
        });

        // Load workspace SMTP
        const loadWorkspaceSMTP = async () => {
            const tenantId = getActiveTenantId();
            if (tenantId) {
                const tenant = await getTenant(tenantId) as { id: string; smtpConfig?: SMTPConfig } | null;
                if (tenant?.smtpConfig) {
                    setWorkspaceSMTP(tenant.smtpConfig);
                }
            }
        };
        loadWorkspaceSMTP();

        return () => {
            unsubRecipientCols();
            unsubGroupCols();
            unsubGroups();
            unsubSettings();
        };
    }, [projectId]);

    // Add recipient column
    const handleAddRecipientColumn = async () => {
        if (!projectId || !newRecipientColumn.label.trim()) return;
        setAddingRecipientColumn(true);
        try {
            const key = newRecipientColumn.key.trim() || newRecipientColumn.label.toLowerCase().replace(/\s+/g, '_');
            await addRecipientColumn(projectId, {
                label: newRecipientColumn.label.trim(),
                key,
                type: newRecipientColumn.type,
                isSystem: false
            });
            setNewRecipientColumn({ label: '', key: '', type: 'text' });
            showSuccess('Column added');
        } catch (e) {
            showError('Failed to add column');
        } finally {
            setAddingRecipientColumn(false);
        }
    };

    // Add group column
    const handleAddGroupColumn = async () => {
        if (!projectId || !newGroupColumn.label.trim()) return;
        setAddingGroupColumn(true);
        try {
            const key = newGroupColumn.key.trim() || newGroupColumn.label.toLowerCase().replace(/\s+/g, '_');
            await addGroupColumn(projectId, {
                label: newGroupColumn.label.trim(),
                key,
                type: newGroupColumn.type,
                isSystem: false
            });
            setNewGroupColumn({ label: '', key: '', type: 'text' });
            showSuccess('Column added');
        } catch (e) {
            showError('Failed to add column');
        } finally {
            setAddingGroupColumn(false);
        }
    };

    // Delete columns
    const handleDeleteRecipientColumn = async (id: string) => {
        if (!projectId) return;
        try {
            await deleteRecipientColumn(projectId, id);
            showSuccess('Column deleted');
        } catch (e) {
            showError('Failed to delete column');
        }
    };

    const handleDeleteGroupColumn = async (id: string) => {
        if (!projectId) return;
        try {
            await deleteGroupColumn(projectId, id);
            showSuccess('Column deleted');
        } catch (e) {
            showError('Failed to delete column');
        }
    };

    // Test SMTP connection
    const handleTestSMTP = async () => {
        if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
            showError('Please fill in all SMTP fields');
            return;
        }
        setTesting(true);
        try {
            const testFn = httpsCallable(functions, 'testSMTPConnection');
            const result = await testFn({
                host: smtpConfig.host,
                port: smtpConfig.port,
                user: smtpConfig.user,
                pass: smtpConfig.pass,
                secure: smtpConfig.secure
            }) as any;

            if (result.data?.success) {
                showSuccess('SMTP connection successful!');
                // Save verified status
                if (projectId) {
                    await updateMarketingSettings(projectId, { smtpVerified: true });
                }
            } else {
                showError(result.data?.error || 'Connection failed', JSON.stringify(result.data, null, 2));
            }
        } catch (e: any) {
            showError(e.message || 'Connection failed', e.stack || JSON.stringify(e));
        } finally {
            setTesting(false);
        }
    };

    // Save SMTP settings
    const handleSaveSMTP = async () => {
        if (!projectId) return;
        setSaving(true);
        try {
            // Build settings object without undefined values (Firebase doesn't accept undefined)
            const settingsData: { smtpSource: SMTPSource; smtpConfig?: SMTPConfig; smtpVerified?: boolean } = {
                smtpSource
            };
            if (smtpSource === 'project') {
                settingsData.smtpConfig = smtpConfig as SMTPConfig;
                if (settings?.smtpVerified !== undefined) {
                    settingsData.smtpVerified = settings.smtpVerified;
                }
            }
            await updateMarketingSettings(projectId, settingsData);
            showSuccess('Settings saved');
        } catch (e: any) {
            console.error('Failed to save settings:', e);
            showError(e?.message || 'Failed to save settings', e.stack || JSON.stringify(e));
        } finally {
            setSaving(false);
        }
    };

    // System columns (always present)
    const systemRecipientColumns = [
        { label: 'Email', key: 'email', type: 'text', isSystem: true },
        { label: 'First Name', key: 'firstName', type: 'text', isSystem: true },
        { label: 'Last Name', key: 'lastName', type: 'text', isSystem: true },
        { label: 'Gender', key: 'gender', type: 'text', isSystem: true },
        { label: 'Status', key: 'status', type: 'text', isSystem: true },
    ];

    const systemGroupColumns = [
        { label: 'Name', key: 'name', type: 'text', isSystem: true },
        { label: 'Description', key: 'description', type: 'text', isSystem: true },
        { label: 'Color', key: 'color', type: 'text', isSystem: true },
    ];

    // Generate embed code safely
    const generateEmbedCode = () => {
        const baseUrl = window.location.origin;
        const pid = projectId || 'YOUR_PROJECT_ID';
        const groupIdsLine = embedSelectedGroups.length > 0
            ? `\n  <input type="hidden" name="groupIds" value="${embedSelectedGroups.join(',')}" />`
            : '';

        return `<!-- ProjectFlow Newsletter Signup Form -->
<form action="${baseUrl}/api/newsletter/subscribe" method="POST" style="max-width: 400px; font-family: system-ui, sans-serif;">
  <input type="hidden" name="token" value="YOUR_API_TOKEN_HERE" />
  <input type="hidden" name="projectId" value="${pid}" />${groupIdsLine}
  <div style="margin-bottom: 12px;">
    <input type="email" name="email" required placeholder="Your email" 
      style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />
  </div>
  <div style="margin-bottom: 12px;">
    <input type="text" name="firstName" placeholder="First name (optional)" 
      style="width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;" />
  </div>
  <button type="submit" 
    style="width: 100%; padding: 12px; background: #4F46E5; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
    Subscribe
  </button>
</form>`;
    };

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

    const NavItem = ({ id, label, icon }: { id: MarketingTab, label: string, icon: string }) => (
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
        <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-up">
            <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Sidebar */}
                <aside className="w-full md:w-56 shrink-0 space-y-1">
                    <h1 className="text-xl font-display font-bold text-[var(--color-text-main)] px-2 mb-4">Marketing Settings</h1>
                    <NavItem id="data" label="Data Models" icon="database" />
                    <NavItem id="email" label="Email Delivery" icon="mail" />
                    <NavItem id="embed" label="Newsletter Embed" icon="code" />
                    <NavItem id="blog" label="Blog Integration" icon="rss_feed" />
                    <NavItem id="analytics" label="Analytics" icon="analytics" />
                    <NavItem id="automation" label="Automation" icon="bolt" />
                    <NavItem id="preferences" label="Preferences" icon="tune" />
                </aside>

                {/* Content */}
                <main className="flex-1 w-full min-w-0 space-y-6">
                    {activeTab === 'data' && (
                        <>

                            {/* Recipient Data Model */}
                            <Card className="p-6">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[var(--color-primary)]">group</span>
                                    Recipient Data Model
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                                    Define what data fields are available for recipients. System columns cannot be deleted.
                                </p>

                                <div className="space-y-2 mb-4">
                                    {/* System columns */}
                                    {systemRecipientColumns.map((col) => (
                                        <div key={col.key} className="flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)]">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">{col.label}</span>
                                                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded">System</span>
                                            </div>
                                            <span className="text-xs text-[var(--color-text-muted)]">{col.type}</span>
                                        </div>
                                    ))}
                                    {/* Custom columns */}
                                    {recipientColumns.filter(c => !c.isSystem).map((col) => (
                                        <div key={col.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)]">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">{col.label}</span>
                                                <span className="text-xs text-[var(--color-text-muted)]">({col.key})</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-[var(--color-text-muted)]">{col.type}</span>
                                                <button
                                                    onClick={() => handleDeleteRecipientColumn(col.id)}
                                                    className="p-1 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add new column */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Input
                                            label="Column Label"
                                            value={newRecipientColumn.label}
                                            onChange={(e) => setNewRecipientColumn(prev => ({ ...prev, label: e.target.value }))}
                                            placeholder="e.g. Company"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="block text-sm font-medium mb-1">Type</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] text-sm"
                                            value={newRecipientColumn.type}
                                            onChange={(e) => setNewRecipientColumn(prev => ({ ...prev, type: e.target.value as any }))}
                                        >
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="boolean">Boolean</option>
                                            <option value="tag">Tag</option>
                                        </select>
                                    </div>
                                    <Button variant="primary" onClick={handleAddRecipientColumn} isLoading={addingRecipientColumn}>
                                        Add
                                    </Button>
                                </div>
                            </Card>

                            {/* Group Data Model */}
                            <Card className="p-6">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[var(--color-primary)]">folder_shared</span>
                                    Group Data Model
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                                    Define what data fields are available for recipient groups.
                                </p>

                                <div className="space-y-2 mb-4">
                                    {/* System columns */}
                                    {systemGroupColumns.map((col) => (
                                        <div key={col.key} className="flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)]">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">{col.label}</span>
                                                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-hover)] px-2 py-0.5 rounded">System</span>
                                            </div>
                                            <span className="text-xs text-[var(--color-text-muted)]">{col.type}</span>
                                        </div>
                                    ))}
                                    {/* Custom columns */}
                                    {groupColumns.filter(c => !c.isSystem).map((col) => (
                                        <div key={col.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-bg)] rounded-lg border border-[var(--color-surface-border)]">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-medium">{col.label}</span>
                                                <span className="text-xs text-[var(--color-text-muted)]">({col.key})</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-[var(--color-text-muted)]">{col.type}</span>
                                                <button
                                                    onClick={() => handleDeleteGroupColumn(col.id)}
                                                    className="p-1 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Add new column */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <Input
                                            label="Column Label"
                                            value={newGroupColumn.label}
                                            onChange={(e) => setNewGroupColumn(prev => ({ ...prev, label: e.target.value }))}
                                            placeholder="e.g. Industry"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="block text-sm font-medium mb-1">Type</label>
                                        <select
                                            className="w-full px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] text-sm"
                                            value={newGroupColumn.type}
                                            onChange={(e) => setNewGroupColumn(prev => ({ ...prev, type: e.target.value as any }))}
                                        >
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="boolean">Boolean</option>
                                            <option value="tag">Tag</option>
                                        </select>
                                    </div>
                                    <Button variant="primary" onClick={handleAddGroupColumn} isLoading={addingGroupColumn}>
                                        Add
                                    </Button>
                                </div>
                            </Card>
                        </>
                    )}

                    {activeTab === 'email' && (
                        <>
                            {/* SMTP Configuration */}
                            <Card className="p-6">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[var(--color-primary)]">mail</span>
                                    Email Delivery (SMTP)
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                                    Choose how emails are sent for this project's marketing campaigns.
                                </p>

                                {/* SMTP Source Selection */}
                                <div className="space-y-3 mb-6">
                                    {SMTP_OPTIONS.map((option) => (
                                        <label
                                            key={option.value}
                                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${smtpSource === option.value
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                                : 'border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/50'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="smtpSource"
                                                value={option.value}
                                                checked={smtpSource === option.value}
                                                onChange={(e) => setSmtpSource(e.target.value as SMTPSource)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium">{option.label}</div>
                                                <div className="text-sm text-[var(--color-text-muted)]">{option.description}</div>
                                                {option.value === 'workspace' && workspaceSMTP && (
                                                    <div className="mt-2 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>
                                                        Configured: {workspaceSMTP.host}
                                                    </div>
                                                )}
                                                {option.value === 'workspace' && !workspaceSMTP && (
                                                    <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px]">warning</span>
                                                        Not configured in workspace settings
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {/* Project SMTP Config */}
                                {smtpSource === 'project' && (
                                    <div className="space-y-4 p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)]">
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="SMTP Host"
                                                value={smtpConfig.host || ''}
                                                onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value, smtpVerified: false }))}
                                                placeholder="smtp.example.com"
                                            />
                                            <Input
                                                label="Port"
                                                type="number"
                                                value={smtpConfig.port?.toString() || '587'}
                                                onChange={(e) => setSmtpConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                                                placeholder="587"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Username"
                                                value={smtpConfig.user || ''}
                                                onChange={(e) => setSmtpConfig(prev => ({ ...prev, user: e.target.value }))}
                                                placeholder="user@example.com"
                                            />
                                            <Input
                                                label="Password"
                                                type="password"
                                                value={smtpConfig.pass || ''}
                                                onChange={(e) => setSmtpConfig(prev => ({ ...prev, pass: e.target.value }))}
                                                placeholder="••••••••"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="From Email"
                                                value={smtpConfig.fromEmail || ''}
                                                onChange={(e) => setSmtpConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                                                placeholder="noreply@example.com"
                                            />
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Secure (TLS)</label>
                                                <div className="flex items-center gap-2 h-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={smtpConfig.secure || false}
                                                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, secure: e.target.checked }))}
                                                        className="w-4 h-4"
                                                    />
                                                    <span className="text-sm text-[var(--color-text-muted)]">Use TLS/SSL</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 pt-2">
                                            <Button variant="secondary" onClick={handleTestSMTP} isLoading={testing}>
                                                <span className="material-symbols-outlined mr-2 text-[18px]">wifi_tethering</span>
                                                Test Connection
                                            </Button>
                                            {settings?.smtpVerified && (
                                                <span className="text-sm text-green-600 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                                    Connection verified
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Save Button */}
                                <div className="flex justify-end mt-6">
                                    <Button variant="primary" onClick={handleSaveSMTP} isLoading={saving}>
                                        Save Settings
                                    </Button>
                                </div>
                            </Card>
                        </>
                    )}

                    {activeTab === 'embed' && (
                        <>
                            {/* Newsletter Embed Form */}
                            <Card className="p-6">
                                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[var(--color-primary)]">code</span>
                                    Newsletter Embed Form
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] mb-4">
                                    Customize and copy this HTML to embed a newsletter signup form on your website. Generate an API token in Settings → API.
                                </p>

                                {/* Customization Options */}
                                {groups.length > 0 && (
                                    <div className="mb-4 p-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg">
                                        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[var(--color-primary)] text-[18px]">tune</span>
                                            Auto-assign to Groups
                                        </h4>
                                        <p className="text-xs text-[var(--color-text-muted)] mb-3">
                                            New subscribers from this form will automatically be added to the selected groups.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {groups.filter(g => g && g.id).map(group => {
                                                const isSelected = embedSelectedGroups.includes(group.id);
                                                return (
                                                    <button
                                                        key={group.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setEmbedSelectedGroups(embedSelectedGroups.filter(id => id !== group.id));
                                                            } else {
                                                                setEmbedSelectedGroups([...embedSelectedGroups, group.id]);
                                                            }
                                                        }}
                                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-all border ${isSelected
                                                            ? 'bg-[var(--color-primary)] text-black border-[var(--color-primary)]'
                                                            : 'bg-[var(--color-surface-card)] text-[var(--color-text-main)] border-[var(--color-surface-border)] hover:border-[var(--color-primary)]'
                                                            }`}
                                                    >
                                                        {isSelected && (
                                                            <span className="material-symbols-outlined text-[14px]">check</span>
                                                        )}
                                                        {group.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="relative mb-4">
                                    <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                                        {generateEmbedCode()}
                                    </pre>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="absolute top-2 right-2"
                                        onClick={() => {
                                            navigator.clipboard.writeText(generateEmbedCode());
                                            showSuccess('Copied to clipboard');
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[16px] mr-1">content_copy</span>
                                        Copy
                                    </Button>
                                </div>

                                <div className="p-4 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg space-y-4">
                                    <h4 className="font-medium text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[var(--color-primary)] text-[18px]">api</span>
                                        API Reference
                                    </h4>

                                    <div className="grid gap-3 text-sm">
                                        <div>
                                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Endpoint</p>
                                            <code className="text-xs bg-zinc-900 text-zinc-100 px-2 py-1 rounded font-mono block">
                                                POST {window.location.origin}/api/newsletter/subscribe
                                            </code>
                                        </div>

                                        <div>
                                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Project ID</p>
                                            <code className="text-xs bg-zinc-900 text-zinc-100 px-2 py-1 rounded font-mono block">
                                                {projectId || 'Not available'}
                                            </code>
                                        </div>

                                        <div>
                                            <p className="text-xs text-[var(--color-text-muted)] mb-1">Request Body (JSON)</p>
                                            <pre className="text-xs bg-zinc-900 text-zinc-100 px-3 py-2 rounded font-mono overflow-x-auto">
                                                {`{
  "token": "pfat_your_api_token",
  "email": "subscriber@example.com",
  "projectId": "${projectId || 'your_project_id'}",
  "firstName": "Optional",
  "lastName": "Optional",
  "groupIds": ["optional_group_id"]
}`}
                                            </pre>
                                        </div>
                                    </div>

                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        <strong>Required:</strong> token, email, projectId • <strong>Optional:</strong> firstName, lastName, groupIds
                                    </p>
                                </div>
                            </Card>
                        </>
                    )}



                    {activeTab === 'blog' && (
                        <div className="space-y-6">
                            {/* We show either the summary card or the wizard */}
                            {!showBlogWizard ? (
                                <Card className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[var(--color-primary)]">api</span>
                                                Content API Integration
                                            </h3>
                                            <p className="text-sm text-[var(--color-text-muted)] mt-1">
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
                                                    <div className="text-sm text-[var(--color-text-muted)]">{apiSettings.baseUrl}</div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)]">
                                                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Resources</div>
                                                    <div className="font-mono text-sm capitalize">
                                                        {Object.keys(apiSettings.resources).join(', ') || 'None'}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-[var(--color-surface-bg)] rounded-xl border border-[var(--color-surface-border)]">
                                                    <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Headers</div>
                                                    <div className="font-mono text-sm truncate" title={apiSettings.headers}>
                                                        {apiSettings.headers !== '{}' ? 'Configured' : 'None'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)]">
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
                    )}

                    {/* Analytics Placeholder */}
                    {activeTab === 'analytics' && (
                        <Card className="p-6">
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-6xl text-[var(--color-text-muted)] mb-4 block">analytics</span>
                                <h3 className="font-semibold text-lg mb-2">Campaign Analytics</h3>
                                <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-4">
                                    Track open rates, click-through rates, conversions, and subscriber growth over time.
                                </p>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    Coming Soon
                                </span>
                            </div>
                        </Card>
                    )}

                    {/* Automation Placeholder */}
                    {activeTab === 'automation' && (
                        <Card className="p-6">
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-6xl text-[var(--color-text-muted)] mb-4 block">bolt</span>
                                <h3 className="font-semibold text-lg mb-2">Email Automation</h3>
                                <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-4">
                                    Create automated email sequences, drip campaigns, and trigger-based workflows.
                                </p>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    Coming Soon
                                </span>
                            </div>
                        </Card>
                    )}

                    {/* Preferences Placeholder */}
                    {activeTab === 'preferences' && (
                        <Card className="p-6">
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-6xl text-[var(--color-text-muted)] mb-4 block">tune</span>
                                <h3 className="font-semibold text-lg mb-2">Marketing Preferences</h3>
                                <p className="text-[var(--color-text-muted)] max-w-md mx-auto mb-4">
                                    Configure unsubscribe pages, preference centers, and compliance settings.
                                </p>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    Coming Soon
                                </span>
                            </div>
                        </Card>
                    )}
                </main>
            </div>
        </div >
    );
};
