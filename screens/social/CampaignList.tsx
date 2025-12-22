
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeCampaigns } from '../../services/dataService';
import { SocialCampaign } from '../../types';
import { SocialCampaignModal } from './components/SocialCampaignModal';

export const CampaignList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<SocialCampaign | undefined>(undefined);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeCampaigns(projectId, (data) => {
            setCampaigns(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    const handleCreate = () => {
        setEditingCampaign(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (campaign: SocialCampaign) => {
        setEditingCampaign(campaign);
        setIsModalOpen(true);
    };

    if (loading) return <div>Loading campaigns...</div>;

    return (
        <div className="space-y-6">
            <SocialCampaignModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                campaign={editingCampaign}
            />

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="h2 mb-1">Campaigns</h1>
                    <p className="text-[var(--color-text-muted)]">Manage your social media campaigns.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white dark:text-black font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined">add</span>
                    <span>New Campaign</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(c => (
                    <div
                        key={c.id}
                        className="group bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-5 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => handleEdit(c)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${c.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {c.status}
                            </span>
                            <span className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity material-symbols-outlined">edit</span>
                        </div>
                        <h3 className="h4 mb-1">{c.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-4">
                            <span className="material-symbols-outlined text-base">calendar_today</span>
                            <span>{new Date(c.startDate || '').toLocaleDateString()}</span>
                        </div>
                        <div className="pt-4 border-t border-[var(--color-surface-border)] text-sm text-[var(--color-text-muted)]">
                            {c.toneOfVoice || "No tone defined"}
                        </div>
                    </div>
                ))}

                {campaigns.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)]">
                        <p>No campaigns yet. Create one to get started!</p>
                    </div>
                )}
            </div>
        </div>
    );
};
