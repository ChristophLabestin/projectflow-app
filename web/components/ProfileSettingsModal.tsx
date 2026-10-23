import { useLanguage } from '../context/LanguageContext';
import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { useToast } from '../context/UIContext';
import { auth } from '../services/firebase';
import { updateUserProfile } from '../services/domain/usersService';
import { getCachedTenantId } from '../services/internal/workspaceDataCore';
import { MediaLibrary } from './MediaLibrary/MediaLibraryModal';
import { PrivacySettings, PrivacyScope } from '../types';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: {
        displayName: string;
        title: string;
        bio: string;
        address: string;
        photoURL: string;
        photoFileId?: string;
        photoFileTenantId?: string;
        coverURL: string;
        coverFileId?: string;
        coverFileTenantId?: string;
        skills: string[];
        privacySettings?: PrivacySettings;
    };
    onUpdate: (newData: any) => void;
}

type TabId = 'general' | 'privacy' | 'skills';

const SCOPES: { value: PrivacyScope; label: string; icon: string; description: string }[] = [
    { value: 'public', label: 'profileSettings.scope.public', icon: 'public', description: 'profileSettings.scope.public.desc' },
    { value: 'members', label: 'profileSettings.scope.members', icon: 'group', description: 'profileSettings.scope.members.desc' },
    { value: 'guests', label: 'profileSettings.scope.guests', icon: 'person_outline', description: 'profileSettings.scope.guests.desc' },
    { value: 'private', label: 'profileSettings.scope.private', icon: 'lock', description: 'profileSettings.scope.private.desc' }
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, initialData, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [saving, setSaving] = useState(false);
    const { showSuccess, showError } = useToast();
    const { t } = useLanguage();

    // Form State
    const [displayName, setDisplayName] = useState(initialData.displayName);
    const [title, setTitle] = useState(initialData.title);
    const [bio, setBio] = useState(initialData.bio);
    const [address, setAddress] = useState(initialData.address);
    const [skills, setSkills] = useState<string[]>(initialData.skills);
    const [newSkill, setNewSkill] = useState('');

    // Privacy State
    const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(initialData.privacySettings || {
        email: 'members',
        bio: 'public',
        skills: 'public',
        address: 'members',
        stats: 'members'
    });

    // Media State
    const [photoURL, setPhotoURL] = useState(initialData.photoURL);
    const [photoFileId, setPhotoFileId] = useState(initialData.photoFileId || '');
    const [photoFileTenantId, setPhotoFileTenantId] = useState(initialData.photoFileTenantId || '');
    const [coverURL, setCoverURL] = useState(initialData.coverURL);
    const [coverFileId, setCoverFileId] = useState(initialData.coverFileId || '');
    const [coverFileTenantId, setCoverFileTenantId] = useState(initialData.coverFileTenantId || '');
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);
    const [mediaTarget, setMediaTarget] = useState<'avatar' | 'cover' | null>(null);


    useEffect(() => {
        if (isOpen) {
            setDisplayName(initialData.displayName);
            setTitle(initialData.title);
            setBio(initialData.bio);
            setAddress(initialData.address);
            setSkills(initialData.skills);
            setPhotoURL(initialData.photoURL);
            setPhotoFileId(initialData.photoFileId || '');
            setPhotoFileTenantId(initialData.photoFileTenantId || '');
            setCoverURL(initialData.coverURL);
            setCoverFileId(initialData.coverFileId || '');
            setCoverFileTenantId(initialData.coverFileTenantId || '');
            if (initialData.privacySettings) {
                setPrivacySettings(initialData.privacySettings);
            }

        }
    }, [isOpen, initialData]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateUserProfile({
                displayName,
                title,
                bio,
                address,
                skills,
                privacySettings,
                photoURL: photoURL !== initialData.photoURL ? photoURL : undefined,
                photoFileId: photoFileId !== initialData.photoFileId ? photoFileId : undefined,
                photoFileTenantId: photoFileTenantId !== initialData.photoFileTenantId ? photoFileTenantId : undefined,
                coverURL: coverURL !== initialData.coverURL ? coverURL : undefined,
                coverFileId: coverFileId !== initialData.coverFileId ? coverFileId : undefined,
                coverFileTenantId: coverFileTenantId !== initialData.coverFileTenantId ? coverFileTenantId : undefined,
            });

            onUpdate({
                displayName,
                title,
                bio,
                address,
                skills,
                privacySettings,
                photoURL: result.photoURL || photoURL,
                photoFileId,
                photoFileTenantId,
                coverURL: result.coverURL || coverURL,
                coverFileId,
                coverFileTenantId
            });

            showSuccess(t('profileSettings.saved'));
            onClose();
        } catch (e: any) {
            console.error(e);
            showError(t('profileSettings.saveFailed').replace('{error}', e.message));
        } finally {
            setSaving(false);
        }
    };


    const addSkill = () => {
        if (newSkill.trim() && !skills.includes(newSkill.trim())) {
            setSkills([...skills, newSkill.trim()]);
            setNewSkill('');
        }
    };

    const removeSkill = (skill: string) => {
        setSkills(skills.filter(s => s !== skill));
    };

    const updatePrivacy = (key: keyof PrivacySettings, value: PrivacyScope) => {
        setPrivacySettings(prev => ({ ...prev, [key]: value }));
    };

    const tabs: { id: TabId; label: string; icon: string }[] = [
        { id: 'general', label: t('profileSettings.tab.general'), icon: 'person' },
        { id: 'privacy', label: t('profileSettings.tab.privacy'), icon: 'lock' },
        { id: 'skills', label: t('profileSettings.tab.skills'), icon: 'psychology' },
    ];

    const PrivacySelect = ({ label, value, onChange }: { label: string, value: PrivacyScope, onChange: (val: PrivacyScope) => void }) => (
        <div className="flex items-center justify-between p-4 bg-surface-hover/30 border border-surface rounded-xl">
            <span className="font-medium text-main">{label}</span>
            <div className="flex items-center gap-2">
                <select
                    value={value || 'public'}
                    onChange={(e) => onChange(e.target.value as PrivacyScope)}
                    className="bg-transparent text-sm font-bold text-main focus:outline-none cursor-pointer border-none text-right"
                >
                    {SCOPES.map(scope => (
                        <option key={scope.value} value={scope.value}>{t(scope.label)}</option>
                    ))}
                </select>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-main mb-1">{t('profileSettings.general.title')}</h3>
                            <p className="text-sm text-muted">{t('profileSettings.general.subtitle')}</p>
                        </div>
                        <div className="space-y-4">
                            {/* Visual Assets Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-surface">
                                {/* Profile Picture */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-main">{t('profileSettings.avatar.label')}</label>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="size-20 rounded-full overflow-hidden border-2 border-surface shadow-sm bg-surface-hover flex items-center justify-center cursor-pointer group relative"
                                            onClick={() => { setMediaTarget('avatar'); setShowMediaLibrary(true); }}
                                        >
                                            {photoURL ? (
                                                <>
                                                    <img src={photoURL} className="w-full h-full object-cover" alt={t('profileSettings.avatar.alt')} />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-white text-[20px]">edit</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="material-symbols-outlined text-3xl text-muted">person</span>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => { setMediaTarget('avatar'); setShowMediaLibrary(true); }}>
                                            Change Photo
                                        </Button>
                                    </div>
                                </div>

                                {/* Cover Image */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-main">{t('profileSettings.cover.label')}</label>
                                    <div
                                        className="h-20 w-full rounded-xl overflow-hidden border border-surface shadow-sm bg-surface-hover flex items-center justify-center relative cursor-pointer group"
                                        onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                                    >
                                        {coverURL ? (
                                            <>
                                                <img src={coverURL} className="w-full h-full object-cover" alt={t('profileSettings.cover.alt')} />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-white text-xs font-medium flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">edit</span> {t('profileSettings.cover.change')}
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-muted scale-75">
                                                <span className="material-symbols-outlined text-2xl">image</span>
                                                <span className="text-xs">{t('profileSettings.cover.upload')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label={t('profileSettings.displayName')}
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder={t('profileSettings.displayName.placeholder')}
                                />
                                <Input
                                    label={t('profileSettings.jobTitle')}
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('profileSettings.jobTitle.placeholder')}
                                />
                            </div>
                            <Input
                                label={t('profileSettings.address')}
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder={t('profileSettings.address.placeholder')}
                                icon="location_on"
                            />
                            <Textarea
                                label={t('profileSettings.bio')}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder={t('profileSettings.bio.placeholder')}
                                rows={4}
                            />
                        </div>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-main mb-1">{t('profileSettings.privacy.title')}</h3>
                            <p className="text-sm text-muted">{t('profileSettings.privacy.subtitle')}</p>
                        </div>

                        <div className="space-y-2">
                            <PrivacySelect
                                label={t('profileSettings.privacy.email')}
                                value={privacySettings.email}
                                onChange={(val) => updatePrivacy('email', val)}
                            />
                            <PrivacySelect
                                label={t('profileSettings.privacy.bio')}
                                value={privacySettings.bio}
                                onChange={(val) => updatePrivacy('bio', val)}
                            />
                            <PrivacySelect
                                label={t('profileSettings.privacy.skills')}
                                value={privacySettings.skills}
                                onChange={(val) => updatePrivacy('skills', val)}
                            />
                            <PrivacySelect
                                label={t('profileSettings.privacy.location')}
                                value={privacySettings.address}
                                onChange={(val) => updatePrivacy('address', val)}
                            />
                            <PrivacySelect
                                label={t('profileSettings.privacy.stats')}
                                value={privacySettings.stats}
                                onChange={(val) => updatePrivacy('stats', val)}
                            />
                        </div>

                        <div className="p-4 bg-primary/10 rounded-xl text-xs text-primary">
                            <strong>{t('profileSettings.privacy.noteLabel')}</strong> {t('profileSettings.privacy.note')}
                        </div>
                    </div>
                );
            case 'skills':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-main mb-1">{t('profileSettings.skills.title')}</h3>
                            <p className="text-sm text-muted">{t('profileSettings.skills.subtitle')}</p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                placeholder={t('profileSettings.skills.placeholder')}
                                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                                className="flex-1"
                            />
                            <Button onClick={addSkill} variant="primary">{t('common.add')}</Button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {skills.map(skill => (
                                <div key={skill} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium border border-primary/20">
                                    {skill}
                                    <button type="button" aria-label={t('common.remove')} onClick={() => removeSkill(skill)} className="hover:text-error transition-colors flex items-center">
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {skills.length === 0 && (
                                <p className="text-sm text-muted italic">{t('profileSettings.skills.empty')}</p>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={t('profileSettings.modal.title')} size="xl">
                <div className="flex h-[600px] -m-6">
                    {/* Sidebar */}
                    <div className="w-64 shrink-0 bg-surface-hover/30 border-r border-surface p-4 flex flex-col gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                                        ${activeTab === tab.id
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted hover:bg-surface-hover hover:text-main'}
                                    `}
                            >
                                <span className={`material-symbols-outlined text-[20px] ${activeTab === tab.id ? 'fill' : ''}`}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            {renderContent()}
                        </div>
                        {/* Footer */}
                        <div className="shrink-0 p-4 border-t border-surface flex items-center justify-end gap-3 bg-surface-paper">
                            <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                            <Button variant="primary" onClick={handleSave} isLoading={saving}>{t('profileSettings.save')}</Button>
                        </div>
                    </div>
                </div>
            </Modal>

            <MediaLibrary
                isOpen={showMediaLibrary}
                onClose={() => setShowMediaLibrary(false)}
                projectId="uncategorized"
                collectionType="user"
                userId={auth.currentUser?.uid}
                tenantId={getCachedTenantId()}
                onSelect={(asset) => {
                    if (mediaTarget === 'avatar') {
                        setPhotoURL(asset.url);
                        setPhotoFileId(asset.managedFileId || '');
                        setPhotoFileTenantId(asset.managedTenantId || auth.currentUser?.uid || '');
                    } else if (mediaTarget === 'cover') {
                        setCoverURL(asset.url);
                        setCoverFileId(asset.managedFileId || '');
                        setCoverFileTenantId(asset.managedTenantId || auth.currentUser?.uid || '');
                    }
                    setShowMediaLibrary(false);
                }}
                circularCrop={mediaTarget === 'avatar'}
            />
        </>
    );
};
