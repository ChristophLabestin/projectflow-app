
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { subscribeCampaigns, deleteCampaign } from '../../services/dataService';
import { SocialCampaign } from '../../types';
import { useConfirm, useToast } from '../../context/UIContext';
import { format } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import { getSocialCampaignStatusLabel } from '../../utils/socialLocalization';

export const CampaignList = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const confirm = useConfirm();
    const { showSuccess, showError } = useToast();
    const { t, dateLocale, dateFormat } = useLanguage();

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeCampaigns(projectId, (data) => {
            setCampaigns(data);
            setLoading(false);
        });
        return () => unsub();
    }, [projectId]);

    const handleCreate = () => {
        navigate('create');
    };

    const handleEdit = (e: React.MouseEvent, campaign: SocialCampaign) => {
        e.stopPropagation();
        navigate(`edit/${campaign.id}`);
    };

    const handleDelete = async (e: React.MouseEvent, campaign: SocialCampaign) => {
        e.stopPropagation();
        if (!projectId) return;

        const confirmed = await confirm(
            t('social.campaignList.confirmDelete.title'),
            t('social.campaignList.confirmDelete.message').replace('{name}', campaign.name)
        );

        if (confirmed) {
            try {
                await deleteCampaign(projectId, campaign.id);
                showSuccess(t('social.campaignList.toast.deleted'));
            } catch (error) {
                console.error("Failed to delete campaign", error);
                showError(t('social.campaignList.toast.deleteError'));
            }
        }
    };

    if (loading) return <div>{t('social.campaignList.loading')}</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="h2 mb-1">{t('social.campaignList.title')}</h1>
                    <p className="text-[var(--color-text-muted)]">{t('social.campaignList.subtitle')}</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-[var(--color-primary-text)] font-bold rounded-lg hover:opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined">add</span>
                    <span>{t('social.campaignList.newCampaign')}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map(c => (
                    <div
                        key={c.id}
                        className="group bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl p-5 hover:shadow-md transition-all cursor-pointer"
                        onClick={() => navigate(`${c.id}`)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${c.status === 'Active' ? 'bg-green-100 text-green-700' :
                                c.status === 'Planning' ? 'bg-blue-100 text-blue-700' :
                                    c.status === 'Completed' ? 'bg-purple-100 text-purple-700' :
                                        c.status === 'Paused' ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-700'
                                }`}>
                                {getSocialCampaignStatusLabel(c.status, t)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    className="text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] p-1 rounded-full"
                                    onClick={(e) => handleEdit(e, c)}
                                    title={t('social.campaignList.editTitle')}
                                >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                </button>
                                {(c.status === 'Planning' || c.status === 'Backlog') && (
                                    <button
                                        className="text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-500 p-1 rounded-full"
                                        onClick={(e) => handleDelete(e, c)}
                                        title={t('social.campaignList.deleteTitle')}
                                    >
                                        <span className="material-symbols-outlined text-base">delete</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <h3 className="h4 mb-1">{c.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-4">
                            <span className="material-symbols-outlined text-base">calendar_today</span>
                            <span>{c.startDate ? format(new Date(c.startDate), dateFormat, { locale: dateLocale }) : t('social.campaignList.tbd')}</span>
                        </div>
                        <div className="pt-4 border-t border-[var(--color-surface-border)] text-sm text-[var(--color-text-muted)]">
                            {c.toneOfVoice || t('social.campaignList.noTone')}
                        </div>
                    </div>
                ))}

                {campaigns.length === 0 && (
                    <div className="col-span-full py-12 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-bg)] rounded-xl border border-dashed border-[var(--color-surface-border)]">
                        <p>{t('social.campaignList.empty')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
