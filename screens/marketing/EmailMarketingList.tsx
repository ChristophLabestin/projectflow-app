import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link } from 'react-router-dom';
import { subscribeEmailCampaigns, subscribeAudiences } from '../../services/marketingService';
import { getEmailTemplateDrafts, deleteEmailTemplate, getProjectById } from '../../services/dataService';
import { EmailCampaign, MarketingAudience, EmailTemplate } from '../../types';
import { CreateMarketingCampaignModal } from './components/CreateMarketingCampaignModal';
import { auth } from '../../services/firebase';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/UIContext';

export const EmailMarketingList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [audiences, setAudiences] = useState<MarketingAudience[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [project, setProject] = useState<any>(null);
    const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { showError } = useToast();

    // Filter & Sort State
    const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');
    const [filterUsage, setFilterUsage] = useState<'all' | 'used' | 'unused'>('all');
    const [sortBy, setSortBy] = useState<'updatedAt' | 'name'>('updatedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Helper to get stats for a template
    const getTemplateStats = (templateId: string) => {
        const usageCount = campaigns.filter(c => c.templateId === templateId).length;
        const lastCampaign = campaigns
            .filter(c => c.templateId === templateId)
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0];

        return { usageCount, lastCampaign };
    };

    // Derived filtered & sorted templates
    const processedTemplates = templates
        .filter(t => {
            if (filterStatus !== 'all' && t.status !== filterStatus) return false;

            if (filterUsage !== 'all') {
                const stats = getTemplateStats(t.id);
                if (filterUsage === 'used' && stats.usageCount === 0) return false;
                if (filterUsage === 'unused' && stats.usageCount > 0) return false;
            }
            return true;
        })
        .sort((a, b) => {
            let valA, valB;
            if (sortBy === 'name') {
                valA = (a.name || '').toLowerCase();
                valB = (b.name || '').toLowerCase();
            } else {
                valA = a.updatedAt?.seconds || 0;
                valB = b.updatedAt?.seconds || 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    useEffect(() => {
        if (!projectId) return;

        const init = async () => {
            // Load project info first to ensure we have correct tenantId
            const proj = await getProjectById(projectId);
            setProject(proj);

            if (proj?.tenantId) {
                loadTemplates(proj.tenantId);
            } else {
                loadTemplates(); // Fallback to implicit resolution
            }
        };

        init();

        const unsubCampaigns = subscribeEmailCampaigns(projectId, (data) => setCampaigns(data));
        const unsubAudiences = subscribeAudiences(projectId, (data) => setAudiences(data));

        return () => {
            unsubCampaigns();
            unsubAudiences();
        };
    }, [projectId]);

    const loadTemplates = async (specificTenantId?: string) => {
        if (!projectId || !auth.currentUser) return;
        try {
            // Use specific tenant ID if available (from project), otherwise undefined (implicit)
            const tenantIdToUse = specificTenantId || project?.tenantId;
            const data = await getEmailTemplateDrafts(projectId, tenantIdToUse);
            setTemplates(data);
            setLoading(false);
        } catch (e) {
            console.error("Failed to load templates", e);
            setLoading(false);
        }
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete || !projectId) return;
        setIsDeleting(true);
        console.log("Deleting template:", templateToDelete.id, "Project:", projectId, "Tenant:", project?.tenantId);
        try {
            await deleteEmailTemplate(projectId, templateToDelete.id, project?.tenantId);
            setTemplates(prev => prev.filter(t => t.id !== templateToDelete.id));
            setTemplateToDelete(null);
            console.log("Template deleted successfully");
        } catch (e) {
            console.error("Failed to delete template", e);
            showError("Failed to delete template");
        } finally {
            setIsDeleting(false);
        }
    };

    const totalSent = campaigns.reduce((acc, c) => acc + c.stats.sent, 0);
    const avgOpenRate = campaigns.length > 0
        ? (campaigns.reduce((acc, c) => acc + (c.stats.sent > 0 ? (c.stats.opened / c.stats.sent) * 100 : 0), 0) / campaigns.length)
        : 0;

    return (
        <div className="space-y-6">
            <CreateMarketingCampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                type="email"
                projectId={projectId!}
            />

            {templateToDelete && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-[var(--color-surface-border)] animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-4 text-center">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)]">Delete Template?</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">
                                Are you sure you want to delete <strong>"{templateToDelete.name || 'Unnamed Template'}"</strong>?
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="ghost" onClick={() => setTemplateToDelete(null)}>Cancel</Button>
                                <Button variant="danger" onClick={confirmDeleteTemplate} isLoading={isDeleting}>Delete</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="h3 mb-1">Email Marketing</h2>
                    <p className="text-[var(--color-text-muted)]">Manage newsletters, automated campaigns, and design templates.</p>
                </div>
                <div className="flex gap-3">
                    <Link to="create">
                        <button
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold rounded-lg hover:opacity-90 transition-opacity"
                        >
                            <span className="material-symbols-outlined">add</span>
                            Create Campaign
                        </button>
                    </Link>
                    <Link to="builder">
                        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-paper)] border border-[var(--color-surface-border)] text-[var(--color-text-main)] font-bold rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
                            <span className="material-symbols-outlined">design_services</span>
                            New Template
                        </button>
                    </Link>
                </div>
            </div>

            {/* Tabs & View Toggle */}
            <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center border-b border-[var(--color-surface-border)] gap-4">
                <div className="flex">
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'campaigns'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                    >
                        Campaigns
                    </button>
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates'
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                            : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                    >
                        Templates
                    </button>
                </div>

                {activeTab === 'templates' && (
                    <div className="flex flex-wrap items-center gap-3 mb-2 sm:mb-0">
                        {/* Filters */}
                        <div className="flex items-center gap-2 text-sm">
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-2 py-1.5 focus:border-[var(--color-primary)] focus:outline-none"
                            >
                                <option value="all">All Status</option>
                                <option value="published">Published</option>
                                <option value="draft">Draft</option>
                            </select>

                            <select
                                value={filterUsage}
                                onChange={(e) => setFilterUsage(e.target.value as any)}
                                className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-2 py-1.5 focus:border-[var(--color-primary)] focus:outline-none"
                            >
                                <option value="all">All Usage</option>
                                <option value="used">Used</option>
                                <option value="unused">Unused</option>
                            </select>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-2 py-1.5 focus:border-[var(--color-primary)] focus:outline-none"
                            >
                                <option value="updatedAt">Last Updated</option>
                                <option value="name">Name</option>
                            </select>

                            <button
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] rounded hover:bg-[var(--color-surface-hover)]"
                                title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                </span>
                            </button>
                        </div>

                        <div className="h-6 w-px bg-[var(--color-surface-border)] mx-1 hidden sm:block"></div>

                        <div className="flex items-center gap-1 bg-[var(--color-surface-hover)] p-1 rounded-lg">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                                    ? 'bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                title="Grid View"
                            >
                                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                                    ? 'bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                title="List View"
                            >
                                <span className="material-symbols-outlined text-[20px]">view_list</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main List */}
                <div className="lg:col-span-2 space-y-4">

                    {activeTab === 'campaigns' && (
                        <>
                            <h3 className="h4 sr-only">Campaigns</h3>
                            {campaigns.map(campaign => (
                                <div key={campaign.id} className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-5 hover:border-[var(--color-primary)] transition-colors group">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-lg group-hover:text-[var(--color-primary)] transition-colors">{campaign.name}</h4>
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${campaign.status === 'Sent' ? 'bg-green-100 text-green-700' :
                                                    campaign.status === 'Draft' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {campaign.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--color-text-muted)]">{campaign.subject}</p>
                                        </div>
                                        <div className="text-right text-xs text-[var(--color-text-muted)]">
                                            {campaign.sentAt && new Date(campaign.sentAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    {campaign.status === 'Sent' && (
                                        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-surface-border)] mt-4">
                                            <div>
                                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Sent</p>
                                                <p className="font-semibold">{campaign.stats.sent.toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Open Rate</p>
                                                <p className="font-semibold flex items-center gap-1">
                                                    {((campaign.stats.opened / campaign.stats.sent) * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Click Rate</p>
                                                <p className="font-semibold">
                                                    {((campaign.stats.clicked / campaign.stats.sent) * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {campaigns.length === 0 && (
                                <div className="p-8 text-center bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)] text-[var(--color-text-muted)]">
                                    No email campaigns found.
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'templates' && (
                        <>
                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {processedTemplates.map(template => (
                                        <div key={template.id} className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-4 hover:border-[var(--color-primary)] transition-colors group flex flex-col justify-between h-full relative">
                                            <div className="mb-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${template.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {template.status}
                                                    </span>

                                                    {/* Direct Delete Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTemplateToDelete(template);
                                                        }}
                                                        className="text-[var(--color-text-muted)] hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete Template"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </div>
                                                <h4 className="font-bold text-lg mb-1">{template.name || 'Unnamed Template'}</h4>
                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                    Last updated: {template.updatedAt?.seconds ? new Date(template.updatedAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                                                </p>
                                            </div>

                                            <div className="flex gap-2 mt-auto">
                                                <Link to={`builder?templateId=${template.id}`} className="flex-1">
                                                    <button className="w-full py-2 bg-[var(--color-surface-hover)] text-[var(--color-text-main)] font-semibold rounded hover:bg-[var(--color-surface-border)] transition-colors text-sm">
                                                        Edit
                                                    </button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-[var(--color-surface-bg)] text-[var(--color-text-muted)] border-b border-[var(--color-surface-border)]">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Template</th>
                                                <th className="px-4 py-3 font-medium">Status</th>
                                                <th className="px-4 py-3 font-medium">Usage</th>
                                                <th className="px-4 py-3 font-medium">Last Updated</th>
                                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-surface-border)]">
                                            {processedTemplates.map(template => {
                                                const stats = getTemplateStats(template.id);
                                                return (
                                                    <tr key={template.id} className="hover:bg-[var(--color-surface-hover)] transition-colors group">
                                                        <td className="px-4 py-3 font-medium text-[var(--color-text-main)]">
                                                            <div className="flex flex-col">
                                                                <span className="text-base">{template.name || 'Unnamed Template'}</span>
                                                                {stats.lastCampaign && (
                                                                    <span className="text-[10px] text-[var(--color-text-muted)]">
                                                                        Last used in: {stats.lastCampaign.name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${template.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {template.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-[var(--color-text-muted)]">
                                                            {stats.usageCount > 0 ? (
                                                                <span className="flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[16px]">campaign</span>
                                                                    {stats.usageCount} campaigns
                                                                </span>
                                                            ) : (
                                                                <span className="text-[var(--color-text-subtle)] italic">Unused</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-[var(--color-text-muted)]">
                                                            {template.updatedAt?.seconds ? new Date(template.updatedAt.seconds * 1000).toLocaleDateString() : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <Link to={`builder?templateId=${template.id}`}>
                                                                    <button className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)] rounded transition-colors" title="Edit">
                                                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                                                    </button>
                                                                </Link>

                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setTemplateToDelete(template);
                                                                    }}
                                                                    className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-[var(--color-surface-hover)] rounded transition-colors"
                                                                    title="Delete"
                                                                >
                                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {templates.length === 0 && (
                                <div className="p-8 text-center bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)] text-[var(--color-text-muted)]">
                                    No templates found. Create one to get started!
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Sidebar Stats & Audiences */}
                <div className="space-y-6">
                    <div className="bg-[var(--color-surface-card)] p-5 rounded-xl border border-[var(--color-surface-border)]">
                        <h3 className="h5 mb-4">Performance</h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Total Emails Sent</p>
                                <p className="text-2xl font-bold">{totalSent.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)] uppercase font-bold tracking-wider">Avg. Open Rate</p>
                                <p className="text-2xl font-bold text-blue-500">{avgOpenRate.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface-card)] p-5 rounded-xl border border-[var(--color-surface-border)]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="h5">Audiences</h3>
                            <button className="text-[var(--color-primary)] text-sm font-bold hover:underline">Manage</button>
                        </div>
                        <ul className="space-y-3">
                            {audiences.map(audience => (
                                <li key={audience.id} className="flex justify-between items-center text-sm">
                                    <span className="font-medium">{audience.name}</span>
                                    <span className="bg-[var(--color-surface-hover)] px-2 py-1 rounded-full text-xs text-[var(--color-text-muted)]">
                                        {audience.count.toLocaleString()}
                                    </span>
                                </li>
                            ))}
                            {audiences.length === 0 && (
                                <li className="text-[var(--color-text-muted)] text-sm italic">No audiences defined.</li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
