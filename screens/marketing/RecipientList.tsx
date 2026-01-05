import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Recipient, RecipientColumn, RecipientGroup } from '../../types';
import { subscribeRecipients, subscribeRecipientColumns, deleteRecipient } from '../../services/recipientService';
import { subscribeGroups } from '../../services/groupService';
import { useToast, useConfirm } from '../../context/UIContext';
import { Button } from '../../components/ui/Button';

// Modals
import { ImportRecipientsModal } from './components/ImportRecipientsModal';
import { ExternalSourceModal } from './components/ExternalSourceModal';
import { ManualAddRecipientModal } from './components/ManualAddRecipientModal';
import { EditRecipientModal } from './components/EditRecipientModal';
import { ImportGroupsModal } from './components/ImportGroupsModal';
import { GroupManagementPanel } from './components/GroupManagementPanel';

export const RecipientList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [columns, setColumns] = useState<RecipientColumn[]>([]);
    const [groups, setGroups] = useState<RecipientGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    // Modals
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isExternalModalOpen, setExternalModalOpen] = useState(false);
    const [isManualModalOpen, setManualModalOpen] = useState(false);
    const [isGroupModalOpen, setGroupModalOpen] = useState(false);
    const [isImportGroupsModalOpen, setImportGroupsModalOpen] = useState(false);
    const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

    useEffect(() => {
        if (!projectId) return;

        const unsubRecipients = subscribeRecipients(projectId, (data) => {
            setRecipients(data);
            setLoading(false);
        });

        const unsubColumns = subscribeRecipientColumns(projectId, (data) => {
            setColumns(data);
        });

        const unsubGroups = subscribeGroups(projectId, (data) => {
            setGroups(data);
        });

        return () => {
            unsubRecipients();
            unsubColumns();
            unsubGroups();
        };
    }, [projectId]);

    const handleDelete = async (id: string) => {
        const confirmed = await confirm('Delete Recipient', 'Are you sure you want to delete this recipient?');
        if (!confirmed) return;
        if (!projectId) return;
        try {
            await deleteRecipient(projectId, id);
            showSuccess('Recipient deleted successfully');
        } catch (e) {
            showError('Failed to delete recipient');
        }
    };

    // Filter by search and group
    const filteredRecipients = recipients.filter(r => {
        const matchesSearch = r.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.firstName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.lastName?.toLowerCase().includes(searchTerm.toLowerCase()));

        let matchesGroup = true;
        if (selectedGroupFilter === 'ungrouped') {
            matchesGroup = !r.groupIds?.length;
        } else if (selectedGroupFilter !== 'all') {
            matchesGroup = r.groupIds?.includes(selectedGroupFilter) ?? false;
        }

        return matchesSearch && matchesGroup;
    });

    // Dynamic Columns for Table
    const customColumns = columns.filter(c => !c.isSystem).slice(0, 3);

    // Helper to get group name by id
    const getGroupNames = (groupIds?: string[]) => {
        if (!groupIds?.length) return [];
        return groups.filter(g => groupIds.includes(g.id));
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="h3 mb-1">Recipients</h2>
                    <p className="text-muted">Manage your audience, import contacts, and organize into groups.</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Button variant="secondary" onClick={() => setGroupModalOpen(true)}>
                        <span className="material-symbols-outlined mr-2">folder_shared</span>
                        Groups{groups.length > 0 && ` (${groups.length})`}
                    </Button>
                    <Button variant="secondary" onClick={() => setExternalModalOpen(true)}>
                        <span className="material-symbols-outlined mr-2">database</span>
                        Connect DB
                    </Button>
                    <Button variant="primary" onClick={() => setImportModalOpen(true)}>
                        <span className="material-symbols-outlined mr-2">upload</span>
                        Import CSV
                    </Button>
                    <Button variant="primary" onClick={() => setManualModalOpen(true)}>
                        <span className="material-symbols-outlined mr-2">person_add</span>
                        Add
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-4 bg-card p-3 rounded-xl border border-surface">
                <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted">search</span>
                    <input
                        type="text"
                        placeholder="Search by email or name..."
                        className="w-full pl-10 pr-4 py-2 bg-surface border border-surface rounded-lg focus:outline-none focus:border-primary text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Group Filter */}
                {groups.length > 0 && (
                    <select
                        className="px-3 py-2 bg-surface border border-surface rounded-lg focus:outline-none focus:border-primary text-sm"
                        value={selectedGroupFilter}
                        onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    >
                        <option value="all">All Groups</option>
                        <option value="ungrouped">Ungrouped</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                )}

                <div className="text-sm text-muted">
                    {filteredRecipients.length} recipients
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-card border border-surface rounded-xl relative">
                <table className="w-full text-sm text-left">
                    <thead className="bg-surface text-muted border-b border-surface sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 font-medium">Email</th>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">Groups</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            {customColumns.map(col => (
                                <th key={col.id} className="px-4 py-3 font-medium">{col.label}</th>
                            ))}
                            <th className="px-4 py-3 font-medium">Source</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface-border)]">
                        {filteredRecipients.map(recipient => {
                            const recipientGroups = getGroupNames(recipient.groupIds);
                            return (
                                <tr key={recipient.id} className="hover:bg-surface-hover transition-colors group">
                                    <td className="px-4 py-3 font-medium text-main">
                                        {recipient.email}
                                    </td>
                                    <td className="px-4 py-3">
                                        {recipient.firstName} {recipient.lastName}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {recipientGroups.length > 0 ? (
                                                recipientGroups.slice(0, 2).map(g => (
                                                    <span
                                                        key={g.id}
                                                        className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
                                                        style={{ backgroundColor: g.color || '#6366f1' }}
                                                    >
                                                        {g.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                            {recipientGroups.length > 2 && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-hover text-muted">
                                                    +{recipientGroups.length - 2}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${recipient.status === 'Subscribed' ? 'bg-green-100 text-green-700' :
                                            recipient.status === 'Bounced' ? 'bg-red-100 text-red-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {recipient.status}
                                        </span>
                                    </td>
                                    {customColumns.map(col => (
                                        <td key={col.id} className="px-4 py-3 text-muted">
                                            {recipient.customFields?.[col.key]?.toString() || '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-muted">
                                        {recipient.source}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditingRecipient(recipient)}
                                                className="p-1.5 text-muted hover:text-primary hover:bg-surface-hover rounded transition-colors"
                                                title="Edit"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(recipient.id)}
                                                className="p-1.5 text-muted hover:text-red-500 hover:bg-surface-hover rounded transition-colors"
                                                title="Delete"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredRecipients.length === 0 && (
                            <tr>
                                <td colSpan={7 + customColumns.length} className="px-4 py-8 text-center text-muted">
                                    No recipients found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            <ImportRecipientsModal
                isOpen={isImportModalOpen}
                onClose={() => setImportModalOpen(false)}
                projectId={projectId!}
            />

            <ExternalSourceModal
                isOpen={isExternalModalOpen}
                onClose={() => setExternalModalOpen(false)}
                projectId={projectId!}
            />

            <ManualAddRecipientModal
                isOpen={isManualModalOpen}
                onClose={() => setManualModalOpen(false)}
                projectId={projectId!}
            />

            <GroupManagementPanel
                isOpen={isGroupModalOpen}
                onClose={() => setGroupModalOpen(false)}
                projectId={projectId!}
                onImportClick={() => {
                    setGroupModalOpen(false);
                    setImportGroupsModalOpen(true);
                }}
            />

            <ImportGroupsModal
                isOpen={isImportGroupsModalOpen}
                onClose={() => setImportGroupsModalOpen(false)}
                projectId={projectId!}
            />

            <EditRecipientModal
                isOpen={!!editingRecipient}
                onClose={() => setEditingRecipient(null)}
                projectId={projectId!}
                recipient={editingRecipient}
            />
        </div>
    );
};

