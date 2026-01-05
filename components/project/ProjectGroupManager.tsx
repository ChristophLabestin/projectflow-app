import React, { useState, useEffect } from 'react';
import { ProjectGroup } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { subscribeProjectGroups, createProjectGroup, updateProjectGroup, deleteProjectGroup } from '../../services/projectGroupService';
import { getProjectMembers, getUserProfile, getActiveTenantId } from '../../services/dataService';
import { auth } from '../../services/firebase';
import { useLanguage } from '../../context/LanguageContext';

interface ProjectGroupManagerProps {
    projectId: string;
    tenantId?: string;
    canManage?: boolean;
}

export const ProjectGroupManager: React.FC<ProjectGroupManagerProps> = ({ projectId, tenantId, canManage = false }) => {
    const [groups, setGroups] = useState<ProjectGroup[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        const unsub = subscribeProjectGroups(projectId, setGroups, tenantId);
        return () => unsub();
    }, [projectId, tenantId]);

    const handleEdit = (group: ProjectGroup) => {
        setEditingGroup(group);
        setIsCreateModalOpen(true);
    };

    const handleDelete = async (groupId: string) => {
        if (confirm(t('projectGroups.confirm.delete'))) {
            await deleteProjectGroup(projectId, groupId, tenantId);
        }
    };

    const handleCloseModal = () => {
        setIsCreateModalOpen(false);
        setEditingGroup(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-main">{t('projectGroups.title')}</h3>
                    <p className="text-sm text-muted">{t('projectGroups.subtitle')}</p>
                </div>
                {canManage && (
                    <Button variant="primary" onClick={() => setIsCreateModalOpen(true)} icon={<span className="material-symbols-outlined">add</span>}>
                        {t('projectGroups.actions.create')}
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map(group => (
                    <div key={group.id} className="p-4 rounded-xl border border-surface bg-card hover:border-primary/50 transition-all group">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="size-4 rounded-full" style={{ backgroundColor: group.color || '#3b82f6' }} />
                                <h4 className="font-bold text-main text-sm">{group.name}</h4>
                            </div>
                            {canManage && (
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(group)} className="p-1 hover:bg-surface-hover rounded text-muted hover:text-primary">
                                        <span className="material-symbols-outlined text-[18px]">edit</span>
                                    </button>
                                    <button onClick={() => handleDelete(group.id)} className="p-1 hover:bg-rose-100 rounded text-muted hover:text-rose-600">
                                        <span className="material-symbols-outlined text-[18px]">delete</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted mb-3 line-clamp-1">{group.description || t('projectGroups.empty.description')}</p>

                        <div className="flex items-center justify-between mt-auto">
                            <div className="flex -space-x-2 overflow-hidden">
                                {group.memberIds.slice(0, 5).map(uid => (
                                    <GroupMemberAvatar key={uid} uid={uid} tenantId={tenantId} />
                                ))}
                                {group.memberIds.length > 5 && (
                                    <div className="size-6 rounded-full bg-surface-hover border-2 border-card flex items-center justify-center text-[8px] font-bold text-muted">
                                        +{group.memberIds.length - 5}
                                    </div>
                                )}
                                {group.memberIds.length === 0 && (
                                    <span className="text-xs text-muted italic">{t('projectGroups.empty.members')}</span>
                                )}
                            </div>
                            <span className="text-[10px] text-subtle font-medium bg-surface-hover px-2 py-0.5 rounded-full">
                                {t('projectGroups.count.members').replace('{count}', String(group.memberIds.length))}
                            </span>
                        </div>
                    </div>
                ))}
                {groups.length === 0 && (
                    <div className="col-span-full border border-dashed border-surface rounded-xl p-8 flex flex-col items-center justify-center text-center text-subtle">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-30">groups</span>
                        <p className="text-sm">{t('projectGroups.empty.groups')}</p>
                    </div>
                )}
            </div>

            {isCreateModalOpen && (
                <GroupFormModal
                    isOpen={isCreateModalOpen}
                    onClose={handleCloseModal}
                    projectId={projectId}
                    tenantId={tenantId}
                    initialData={editingGroup || undefined}
                />
            )}
        </div>
    );
};

const GroupMemberAvatar: React.FC<{ uid: string, tenantId?: string }> = ({ uid, tenantId }) => {
    const [profile, setProfile] = useState<{ displayName: string, photoURL?: string } | null>(null);

    useEffect(() => {
        const fetch = async () => {
            const resolvedTenant = tenantId || getActiveTenantId() || auth.currentUser?.uid;
            // Try fetching from project tenant first
            let p = null;
            if (resolvedTenant) {
                p = await getUserProfile(uid, resolvedTenant);
            }
            // Fallback to user's own profile if possible or public
            if (!p) {
                p = await getUserProfile(uid);
            }
            setProfile(p);
        };
        fetch();
    }, [uid, tenantId]);

    if (!profile) return <div className="size-6 rounded-full bg-slate-200 border-2 border-card animate-pulse" />;

    return (
        <div className="size-6 rounded-full border-2 border-card bg-indigo-100 flex items-center justify-center overflow-hidden" title={profile.displayName}>
            {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="size-full object-cover" />
            ) : (
                <span className="text-[8px] font-bold text-indigo-600">{profile.displayName.charAt(0)}</span>
            )}
        </div>
    );
};

interface GroupFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    tenantId?: string;
    initialData?: ProjectGroup;
}

const GroupFormModal: React.FC<GroupFormModalProps> = ({ isOpen, onClose, projectId, tenantId, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [color, setColor] = useState(initialData?.color || '#3b82f6');
    const [selectedMembers, setSelectedMembers] = useState<string[]>(initialData?.memberIds || []);
    const { t } = useLanguage();

    // Member selection state
    const [availableMembers, setAvailableMembers] = useState<{ uid: string, displayName: string, email?: string, photoURL?: string }[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadMembers = async () => {
            const memberIds = await getProjectMembers(projectId, tenantId);
            // Also include current user if not in list
            if (auth.currentUser && !memberIds.includes(auth.currentUser.uid)) {
                memberIds.push(auth.currentUser.uid);
            }

            const profiles = await Promise.all(memberIds.map(async (uid) => {
                const resolvedTenant = tenantId || getActiveTenantId();
                let p = resolvedTenant ? await getUserProfile(uid, resolvedTenant) : null;
                if (!p) p = await getUserProfile(uid);

                return {
                    uid,
                    displayName: p?.displayName || t('projectGroups.unknownUser'),
                    email: p?.email,
                    photoURL: p?.photoURL
                };
            }));
            setAvailableMembers(profiles);
            setLoadingMembers(false);
        };
        loadMembers();
    }, [projectId, tenantId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSaving(true);
        try {
            if (initialData) {
                await updateProjectGroup(projectId, initialData.id, {
                    name, description, color, memberIds: selectedMembers
                }, tenantId);
            } else {
                await createProjectGroup(projectId, {
                    name, description, color, memberIds: selectedMembers
                }, tenantId);
            }
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const toggleMember = (uid: string) => {
        if (selectedMembers.includes(uid)) {
            setSelectedMembers(selectedMembers.filter(id => id !== uid));
        } else {
            setSelectedMembers([...selectedMembers, uid]);
        }
    };

    const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t('projectGroups.modal.editTitle') : t('projectGroups.modal.createTitle')}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label={t('projectGroups.modal.fields.name')} value={name} onChange={(e) => setName(e.target.value)} required placeholder={t('projectGroups.modal.fields.namePlaceholder')} />
                <Input label={t('projectGroups.modal.fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('projectGroups.modal.fields.descriptionPlaceholder')} />

                <div>
                    <label className="text-sm font-medium text-main mb-2 block">{t('projectGroups.modal.fields.color')}</label>
                    <div className="flex flex-wrap gap-2">
                        {colors.map(c => (
                            <button
                                type="button"
                                key={c}
                                onClick={() => setColor(c)}
                                className={`size-8 rounded-full border-2 transition-transform ${color === c ? 'border-[var(--color-text-main)] scale-110' : 'border-transparent hover:scale-105'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-main mb-2 block">
                        {t('projectGroups.modal.fields.members').replace('{count}', String(selectedMembers.length))}
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-surface rounded-xl p-2 bg-surface space-y-1">
                        {loadingMembers ? (
                            <div className="flex items-center justify-center p-4"><span className="material-symbols-outlined animate-spin">progress_activity</span></div>
                        ) : availableMembers.map(member => (
                            <div
                                key={member.uid}
                                onClick={() => toggleMember(member.uid)}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedMembers.includes(member.uid) ? 'bg-primary/10' : 'hover:bg-surface-hover'}`}
                            >
                                <div className={`size-4 rounded border flex items-center justify-center transition-colors ${selectedMembers.includes(member.uid) ? 'bg-primary border-primary' : 'border-muted'}`}>
                                    {selectedMembers.includes(member.uid) && <span className="material-symbols-outlined text-[10px] text-white">check</span>}
                                </div>
                                <div className="size-6 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                    {member.photoURL ? <img src={member.photoURL} className="size-full object-cover" /> : <div className="flex items-center justify-center h-full text-[10px]">{member.displayName[0]}</div>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className={`text-sm font-medium truncate ${selectedMembers.includes(member.uid) ? 'text-primary' : 'text-main'}`}>{member.displayName}</p>
                                    <p className="text-xs text-subtle truncate">{member.email}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    <Button type="submit" variant="primary" disabled={!name.trim() || saving}>
                        {saving ? t('common.saving') : (initialData ? t('common.saveChanges') : t('projectGroups.actions.create'))}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
