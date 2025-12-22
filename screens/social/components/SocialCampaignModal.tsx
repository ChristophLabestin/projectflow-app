
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';
import { SocialCampaign } from '../../../types';
import { createCampaign, updateCampaign } from '../../../services/dataService';
import { useParams } from 'react-router-dom';

interface SocialCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaign?: SocialCampaign;
}

export const SocialCampaignModal: React.FC<SocialCampaignModalProps> = ({ isOpen, onClose, campaign }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const [name, setName] = useState('');
    const [goal, setGoal] = useState('');
    const [toneOfVoice, setToneOfVoice] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (campaign) {
            setName(campaign.name);
            setGoal(campaign.goal || '');
            setToneOfVoice(campaign.toneOfVoice || '');
            setStartDate(campaign.startDate || '');
            setEndDate(campaign.endDate || '');
        } else {
            setName('');
            setGoal('');
            setToneOfVoice('');
            setStartDate('');
            setEndDate('');
        }
    }, [campaign, isOpen]);

    const handleSubmit = async () => {
        if (!projectId || !name) return;
        setLoading(true);
        try {
            const data: any = {
                name,
                goal,
                toneOfVoice,
                startDate: startDate || null,
                endDate: endDate || null,
                projectId
            };

            if (campaign) {
                await updateCampaign(projectId, campaign.id, data);
            } else {
                data.status = 'Planning'; // Default status
                await createCampaign(projectId, data);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save campaign", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={campaign ? 'Edit Campaign' : 'New Campaign'}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} isLoading={loading} disabled={!name}>
                        {campaign ? 'Save Changes' : 'Create Campaign'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <Input label="Campaign Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Sale 2025" autoFocus />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Start Date</label>
                        <input
                            type="date"
                            className="w-full h-11 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl px-4 text-sm text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">End Date</label>
                        <input
                            type="date"
                            className="w-full h-11 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-xl px-4 text-sm text-[var(--color-text-main)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <Input label="Goal" value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Increase brand awareness" />
                <Input label="Tone of Voice" value={toneOfVoice} onChange={e => setToneOfVoice(e.target.value)} placeholder="e.g. Casual, Professional, Witty" />
            </div>
        </Modal>
    );
};
