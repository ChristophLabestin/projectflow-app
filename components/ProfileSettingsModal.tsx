import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { useToast } from '../context/UIContext';
import { auth } from '../services/firebase';
import { updateUserProfile, linkWithGithub, updateUserData, getUserProfile } from '../services/dataService';
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
        coverURL: string;
        skills: string[];
        privacySettings?: PrivacySettings;
    };
    onUpdate: (newData: any) => void;
}

type TabId = 'general' | 'privacy' | 'skills';

const SCOPES: { value: PrivacyScope; label: string; icon: string; description: string }[] = [
    { value: 'public', label: 'Public', icon: 'public', description: 'Visible to everyone' },
    { value: 'members', label: 'Workspace Members', icon: 'group', description: 'Visible to workspace members only' },
    { value: 'guests', label: 'Workspace Guests', icon: 'person_outline', description: 'Visible to members and guests' },
    { value: 'private', label: 'Private (Just You)', icon: 'lock', description: 'Visible only to you' }
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, initialData, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<TabId>('general');
    const [saving, setSaving] = useState(false);
    const { showSuccess, showError } = useToast();

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
    const [coverURL, setCoverURL] = useState(initialData.coverURL);
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
            setCoverURL(initialData.coverURL);
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
                coverURL: coverURL !== initialData.coverURL ? coverURL : undefined,
            });

            onUpdate({
                displayName,
                title,
                bio,
                address,
                skills,
                privacySettings,
                photoURL: result.photoURL || photoURL,
                coverURL: result.coverURL || coverURL
            });

            showSuccess("Profile updated successfully!");
            onClose();
        } catch (e: any) {
            console.error(e);
            showError(`Failed to update profile: ${e.message}`);
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
        { id: 'general', label: 'General Info', icon: 'person' },
        { id: 'privacy', label: 'Privacy', icon: 'lock' },
        { id: 'skills', label: 'Skills & Focus', icon: 'psychology' },
    ];

    const PrivacySelect = ({ label, value, onChange }: { label: string, value: PrivacyScope, onChange: (val: PrivacyScope) => void }) => (
        <div className="flex items-center justify-between p-4 bg-[var(--color-surface-hover)]/30 border border-[var(--color-surface-border)] rounded-xl">
            <span className="font-medium text-[var(--color-text-main)]">{label}</span>
            <div className="flex items-center gap-2">
                <select
                    value={value || 'public'}
                    onChange={(e) => onChange(e.target.value as PrivacyScope)}
                    className="bg-transparent text-sm font-bold text-[var(--color-text-main)] focus:outline-none cursor-pointer border-none text-right"
                >
                    {SCOPES.map(scope => (
                        <option key={scope.value} value={scope.value}>{scope.label}</option>
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
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">General Information</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">Update your profile details and visual assets.</p>
                        </div>
                        <div className="space-y-4">
                            {/* Visual Assets Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[var(--color-surface-border)]">
                                {/* Profile Picture */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--color-text-main)]">Profile Picture</label>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="size-20 rounded-full overflow-hidden border-2 border-[var(--color-surface-border)] shadow-sm bg-[var(--color-surface-hover)] flex items-center justify-center cursor-pointer group relative"
                                            onClick={() => { setMediaTarget('avatar'); setShowMediaLibrary(true); }}
                                        >
                                            {photoURL ? (
                                                <>
                                                    <img src={photoURL} className="w-full h-full object-cover" alt="Avatar" />
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-white text-[20px]">edit</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="material-symbols-outlined text-3xl text-[var(--color-text-muted)]">person</span>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => { setMediaTarget('avatar'); setShowMediaLibrary(true); }}>
                                            Change Photo
                                        </Button>
                                    </div>
                                </div>

                                {/* Cover Image */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[var(--color-text-main)]">Cover Image</label>
                                    <div
                                        className="h-20 w-full rounded-xl overflow-hidden border border-[var(--color-surface-border)] shadow-sm bg-[var(--color-surface-hover)] flex items-center justify-center relative cursor-pointer group"
                                        onClick={() => { setMediaTarget('cover'); setShowMediaLibrary(true); }}
                                    >
                                        {coverURL ? (
                                            <>
                                                <img src={coverURL} className="w-full h-full object-cover" alt="Cover" />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="text-white text-xs font-medium flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[16px]">edit</span> Change
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-[var(--color-text-muted)] scale-75">
                                                <span className="material-symbols-outlined text-2xl">image</span>
                                                <span className="text-xs">Upload Cover</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Display Name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                />
                                <Input
                                    label="Job Title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Creative Lead"
                                />
                            </div>
                            <Input
                                label="Location / Address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="e.g. San Francisco, CA"
                                icon={<span className="material-symbols-outlined text-sm">location_on</span>}
                            />
                            <Textarea
                                label="Short Bio"
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Tell the world about yourself..."
                                rows={4}
                            />
                        </div>
                    </div>
                );
            case 'privacy':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">Privacy Settings</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">Control who can see different parts of your profile.</p>
                        </div>

                        <div className="space-y-2">
                            <PrivacySelect
                                label="Email Address"
                                value={privacySettings.email}
                                onChange={(val) => updatePrivacy('email', val)}
                            />
                            <PrivacySelect
                                label="Bio & About"
                                value={privacySettings.bio}
                                onChange={(val) => updatePrivacy('bio', val)}
                            />
                            <PrivacySelect
                                label="Skills & Expertise"
                                value={privacySettings.skills}
                                onChange={(val) => updatePrivacy('skills', val)}
                            />
                            <PrivacySelect
                                label="Location"
                                value={privacySettings.address}
                                onChange={(val) => updatePrivacy('address', val)}
                            />
                            <PrivacySelect
                                label="Statistics (Projects, Teams)"
                                value={privacySettings.stats}
                                onChange={(val) => updatePrivacy('stats', val)}
                            />
                        </div>

                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl text-xs text-blue-600 dark:text-blue-400">
                            <strong>Note:</strong> Your Display Name and Profile Picture are always public to your workspace members to ensure you can be identified in tasks and comments.
                        </div>
                    </div>
                );
            case 'skills':
                return (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-1">Skills & Expertise</h3>
                            <p className="text-sm text-[var(--color-text-muted)]">Add skills to help others find your expertise.</p>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newSkill}
                                onChange={(e) => setNewSkill(e.target.value)}
                                placeholder="Add a skill (e.g. React, UI Design)"
                                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                                className="flex-1"
                            />
                            <Button onClick={addSkill} variant="primary">Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {skills.map(skill => (
                                <div key={skill} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg text-sm font-medium border border-[var(--color-primary)]/20">
                                    {skill}
                                    <button onClick={() => removeSkill(skill)} className="hover:text-rose-500 transition-colors flex items-center">
                                        <span className="material-symbols-outlined text-[16px]">close</span>
                                    </button>
                                </div>
                            ))}
                            {skills.length === 0 && (
                                <p className="text-sm text-[var(--color-text-muted)] italic">No skills added yet.</p>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="xl">
                <div className="flex h-[600px] -m-6">
                    {/* Sidebar */}
                    <div className="w-64 shrink-0 bg-[var(--color-surface-hover)]/30 border-r border-[var(--color-surface-border)] p-4 flex flex-col gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                                        ${activeTab === tab.id
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-main)]'}
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
                        <div className="shrink-0 p-4 border-t border-[var(--color-surface-border)] flex items-center justify-end gap-3 bg-[var(--color-surface-paper)]">
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave} isLoading={saving}>Save Changes</Button>
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
                tenantId={auth.currentUser?.uid}
                onSelect={(asset) => {
                    if (mediaTarget === 'avatar') {
                        setPhotoURL(asset.url);
                    } else if (mediaTarget === 'cover') {
                        setCoverURL(asset.url);
                    }
                    setShowMediaLibrary(false);
                }}
                circularCrop={mediaTarget === 'avatar'}
            />
        </>
    );
};
