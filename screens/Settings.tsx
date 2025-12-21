import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Textarea';
import { getActiveTenantId, getTenant, updateTenant } from '../services/dataService';
import { auth } from '../services/firebase';
import { Tenant } from '../types';

type SettingsTab = 'general' | 'members' | 'integrations' | 'billing' | 'security';

export const Settings = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [tenant, setTenant] = useState<Partial<Tenant>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [website, setWebsite] = useState('');
    const [contactEmail, setContactEmail] = useState('');

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
                }
            } catch (error) {
                console.error("Failed to load settings", error);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();
    }, []);

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
            alert("Settings saved successfully!");
        } catch (error) {
            console.error("Failed to save settings", error);
            alert("Failed to save settings. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="h-full flex items-center justify-center text-[var(--color-text-muted)]">Loading settings...</div>;
    }

    const renderContent = () => {
        switch (activeTab) {
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
                    </div>
                );
            case 'integrations':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Integrations</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Connect your workspace with third-party tools.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['Slack', 'GitHub', 'Notion', 'Google Drive', 'Figma', 'Linear'].map(app => (
                                <Card key={app} className="p-4 flex items-center justify-between opacity-75">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center font-bold text-gray-500">
                                            {app[0]}
                                        </div>
                                        <span className="font-semibold text-[var(--color-text-main)]">{app}</span>
                                    </div>
                                    <Button variant="secondary" size="sm" disabled>Connect</Button>
                                </Card>
                            ))}
                        </div>
                        <p className="text-center text-xs text-[var(--color-text-muted)] pt-8">More integrations coming soon.</p>
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
                            <h3 className="text-lg font-bold">Free Plan</h3>
                            <p className="text-[var(--color-text-muted)] max-w-sm">You are currently on the free tier. Upgrade to unlock unlimited projects and advanced storage.</p>
                            <Button disabled className="opacity-50">Upgrade Plan (Coming Soon)</Button>
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
                                    <p className="font-semibold text-[var(--color-text-main)]">Two-Factor Authentication</p>
                                    <p className="text-xs text-[var(--color-text-muted)]">Require 2FA for all team members.</p>
                                </div>
                                <div className="w-10 h-6 bg-[var(--color-surface-hover)] rounded-full border border-[var(--color-surface-border)] relative cursor-not-allowed">
                                    <div className="absolute left-1 top-1 size-4 bg-[var(--color-text-muted)] rounded-full opacity-50"></div>
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
            case 'members':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h2 className="text-xl font-display font-bold text-[var(--color-text-main)]">Team Members</h2>
                            <p className="text-[var(--color-text-muted)] text-sm">Manage access and roles.</p>
                        </div>
                        <Card className="p-8 text-center text-[var(--color-text-muted)]">
                            <p>Members management is located in the dedicated Team page.</p>
                            <a href="#/team" className="text-[var(--color-primary)] font-bold mt-2 inline-block hover:underline">Go to Team Page</a>
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
                    <NavItem id="members" label="Members" icon="group" />
                    <NavItem id="integrations" label="Integrations" icon="extension" />
                    <NavItem id="billing" label="Billing" icon="credit_card" />
                    <NavItem id="security" label="Security" icon="security" />
                </aside>

                {/* Content */}
                <main className="flex-1 w-full min-w-0">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};
