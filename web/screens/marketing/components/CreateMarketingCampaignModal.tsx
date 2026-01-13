import React, { useState } from 'react';
import { createAdCampaign, createEmailCampaign } from '../../../services/marketingService';
import { MarketingChannel } from '../../../types';

interface CreateMarketingCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'ad' | 'email';
    projectId: string;
    onSuccess?: () => void;
}

export const CreateMarketingCampaignModal: React.FC<CreateMarketingCampaignModalProps> = ({
    isOpen,
    onClose,
    type,
    projectId,
    onSuccess
}) => {
    const [name, setName] = useState('');
    const [platform, setPlatform] = useState('Google');
    const [objective, setObjective] = useState('Traffic');
    const [budgetDaily, setBudgetDaily] = useState('50');

    // Email specific
    const [subject, setSubject] = useState('');
    const [senderName, setSenderName] = useState('');

    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (type === 'ad') {
                await createAdCampaign({
                    projectId,
                    name,
                    platform: platform as any,
                    objective: objective as any,
                    status: 'Enabled',
                    budgetDaily: Number(budgetDaily),
                    spend: 0,
                    metrics: {
                        impressions: 0,
                        clicks: 0,
                        ctr: 0,
                        cpc: 0,
                        conversions: 0,
                        costPerConversion: 0,
                        roas: 0
                    },
                    startDate: new Date().toISOString()
                });
            } else {
                await createEmailCampaign({
                    projectId,
                    name,
                    subject,
                    senderName,
                    status: 'draft',
                    stats: { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
                });
            }
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-surface rounded-xl w-full max-w-md shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="h4">
                        {type === 'ad' ? 'New Ad Campaign' : 'New Email Campaign'}
                    </h2>
                    <button onClick={onClose} className="text-muted hover:text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Campaign Name</label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 rounded-lg bg-surface border border-surface"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    {type === 'ad' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Platform</label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface"
                                    value={platform}
                                    onChange={e => setPlatform(e.target.value)}
                                >
                                    <option value="Google">Google Ads</option>
                                    <option value="Meta">Meta Ads</option>
                                    <option value="LinkedIn">LinkedIn Ads</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Objective</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg bg-surface border border-surface"
                                        value={objective}
                                        onChange={e => setObjective(e.target.value)}
                                    >
                                        <option value="Traffic">Traffic</option>
                                        <option value="Leads">Leads</option>
                                        <option value="Sales">Sales</option>
                                        <option value="Brand Awareness">Awareness</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Daily Budget</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-muted">$</span>
                                        <input
                                            type="number"
                                            className="w-full pl-6 pr-3 py-2 rounded-lg bg-surface border border-surface"
                                            value={budgetDaily}
                                            onChange={e => setBudgetDaily(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {type === 'email' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Subject Line</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Sender Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg bg-surface border border-surface"
                                    value={senderName}
                                    onChange={e => setSenderName(e.target.value)}
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted hover:text-main transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-bold bg-primary text-on-primary rounded-lg hover:opacity-90 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Campaign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
