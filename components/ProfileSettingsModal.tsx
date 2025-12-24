import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { useToast } from '../context/UIContext';
import { auth } from '../services/firebase';
import { updateUserProfile, linkWithGithub, updateUserData } from '../services/dataService';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

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
    };
    onUpdate: (newData: any) => void;
}

type TabId = 'general' | 'integrations' | 'skills' | 'account';

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

    // Media State
    const [photoURL, setPhotoURL] = useState(initialData.photoURL);
    const [coverURL, setCoverURL] = useState(initialData.coverURL);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);

    // Integrations State
    const [githubLinked, setGithubLinked] = useState(false);
    const [linkingGithub, setLinkingGithub] = useState(false);

    // Cropper State
    const [cropType, setCropType] = useState<'avatar' | 'cover' | null>(null);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    useEffect(() => {
        if (isOpen) {
            setDisplayName(initialData.displayName);
            setTitle(initialData.title);
            setBio(initialData.bio);
            setAddress(initialData.address);
            setSkills(initialData.skills);
            setPhotoURL(initialData.photoURL);
            setCoverURL(initialData.coverURL);
        }
    }, [isOpen, initialData]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCropImageSrc(reader.result as string);
                setCropType(type);
            };
            reader.readAsDataURL(selectedFile);
        }
        e.target.value = ''; // Reset input
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCropApply = useCallback(async () => {
        if (!cropImageSrc || !croppedAreaPixels || !cropType) return;
        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
            if (croppedBlob) {
                const newFile = new File([croppedBlob], `${cropType}.jpg`, { type: "image/jpeg" });
                if (cropType === 'avatar') {
                    setAvatarFile(newFile);
                    setPhotoURL(URL.createObjectURL(croppedBlob));
                } else {
                    setCoverFile(newFile);
                    setCoverURL(URL.createObjectURL(croppedBlob));
                }
                setCropImageSrc(null);
                setCropType(null);
            }
        } catch (e) {
            console.error(e);
        }
    }, [cropImageSrc, croppedAreaPixels, cropType]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await updateUserProfile({
                displayName,
                title,
                bio,
                address,
                skills,
                file: avatarFile || undefined,
                coverFile: coverFile || undefined
            });

            onUpdate({
                displayName,
                title,
                bio,
                address,
                skills,
                photoURL: result.photoURL,
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

    const handleLinkGithub = async () => {
        setLinkingGithub(true);
        try {
            const token = await linkWithGithub();
            await updateUserData(auth.currentUser!.uid, { githubToken: token });
            setGithubLinked(true);
            showSuccess("GitHub connected!");
        } catch (e: any) {
            showError(e.message);
        } finally {
            setLinkingGithub(false);
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

    const NavItem = ({ id, label, icon }: { id: TabId, label: string, icon: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === id
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
        >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            {label}
        </button>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile" size="xl">
            <div className="flex h-[600px] -m-6">
                {/* Sidebar */}
                <aside className="w-64 border-r border-[var(--color-surface-border)] p-4 flex flex-col gap-1 bg-[var(--color-surface-bg)]/50">
                    <NavItem id="general" label="General" icon="person" />
                    <NavItem id="integrations" label="Integrations" icon="extension" />
                    <NavItem id="skills" label="Skills & Focus" icon="psychology" />
                    <NavItem id="account" label="Media & Account" icon="monochrome_photos" />

                    <div className="mt-auto p-4">
                        <Button onClick={handleSave} loading={saving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                            Save Changes
                        </Button>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto p-10 bg-white dark:bg-[var(--color-surface-card)]">
                    {activeTab === 'general' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-1">General Information</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">Update your profile details and contact information.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                rows={5}
                            />
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-1">Integrations</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">Connect your favorite tools to your profile.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="p-6 rounded-2xl border border-[var(--color-surface-border)] flex items-center justify-between group hover:border-indigo-500/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 bg-black text-white rounded-xl flex items-center justify-center">
                                            <span className="material-symbols-outlined text-2xl">terminal</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold">GitHub</h4>
                                            <p className="text-xs text-[var(--color-text-muted)]">Showcase your contributions and sync activity.</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant={githubLinked ? 'secondary' : 'primary'}
                                        onClick={handleLinkGithub}
                                        loading={linkingGithub}
                                        className="rounded-full px-6"
                                    >
                                        {githubLinked ? 'Connected' : 'Connect'}
                                    </Button>
                                </div>

                                <div className="p-6 rounded-2xl border border-[var(--color-surface-border)] flex items-center justify-between opacity-50 grayscale">
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold italic">f</div>
                                        <div>
                                            <h4 className="font-bold">Figma</h4>
                                            <p className="text-xs text-[var(--color-text-muted)]">Display your design portfolio and latest files.</p>
                                        </div>
                                    </div>
                                    <Button disabled className="rounded-full px-6">Coming Soon</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'skills' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-1">Skills & Expertise</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">Add skills to help others find your expertise.</p>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-2">
                                    <Input
                                        value={newSkill}
                                        onChange={(e) => setNewSkill(e.target.value)}
                                        placeholder="Add a skill (e.g. React, UI Design)"
                                        onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                                        className="flex-1"
                                    />
                                    <Button onClick={addSkill} className="bg-indigo-600 text-white rounded-xl px-6">Add</Button>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {skills.map(skill => (
                                        <div key={skill} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl text-sm font-bold border border-indigo-100 dark:border-indigo-800/50">
                                            {skill}
                                            <button onClick={() => removeSkill(skill)} className="hover:text-rose-500 transition-colors">
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {skills.length === 0 && (
                                        <p className="text-sm text-[var(--color-text-subtle)] italic">No skills added yet.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'account' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-1">Media Assets</h3>
                                <p className="text-sm text-[var(--color-text-muted)]">Manage your profile visibility and visual assets.</p>
                            </div>

                            <div className="space-y-8">
                                <div className="flex flex-col gap-4">
                                    <label className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Profile Picture</label>
                                    <div className="flex items-center gap-6">
                                        <div className="size-24 rounded-2xl overflow-hidden border-2 border-[var(--color-surface-border)] shadow-sm bg-gray-50 flex items-center justify-center">
                                            {photoURL ? (
                                                <img src={photoURL} className="w-full h-full object-cover" alt="Avatar Preview" />
                                            ) : (
                                                <span className="material-symbols-outlined text-4xl text-gray-300">person</span>
                                            )}
                                        </div>
                                        <label className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer hover:bg-indigo-700 transition-colors inline-block">
                                            Change Photo
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <label className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Cover Image</label>
                                    <div className="space-y-4">
                                        <div className="h-40 w-full rounded-2xl overflow-hidden border-2 border-[var(--color-surface-border)] shadow-sm bg-gray-50 flex items-center justify-center relative">
                                            {coverURL ? (
                                                <img src={coverURL} className="w-full h-full object-cover" alt="Cover Preview" />
                                            ) : (
                                                <span className="material-symbols-outlined text-6xl text-gray-200">image</span>
                                            )}
                                            <div className="absolute inset-0 bg-black/5 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="text-white font-bold bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm">Preview</span>
                                            </div>
                                        </div>
                                        <label className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl cursor-pointer hover:bg-indigo-700 transition-colors inline-block">
                                            Update Cover
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'cover')} />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Cropper Modal - Nested */}
            {cropImageSrc && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
                    <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl scale-in">
                        <div className="p-6 border-b dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <h3 className="font-bold text-2xl">Crop {cropType === 'avatar' ? 'Avatar' : 'Cover Image'}</h3>
                                <p className="text-sm text-gray-500">Position and zoom to perfect your view.</p>
                            </div>
                            <button onClick={() => { setCropImageSrc(null); setCropType(null); }} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="relative h-96 bg-black">
                            <Cropper
                                image={cropImageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={cropType === 'avatar' ? 1 : 16 / 5}
                                cropShape={cropType === 'avatar' ? 'round' : 'rect'}
                                showGrid={true}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <div className="p-8 space-y-8 bg-gray-50 dark:bg-gray-800/50">
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-bold text-gray-500 uppercase tracking-widest">Adjust Zoom</label>
                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-xs font-black">{zoom.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.01}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                            <div className="flex gap-4">
                                <Button variant="secondary" onClick={() => { setCropImageSrc(null); setCropType(null); }} className="flex-1 rounded-2xl h-14 font-bold text-lg">Discard</Button>
                                <Button onClick={handleCropApply} className="flex-1 rounded-2xl h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg shadow-xl shadow-indigo-500/20">Apply Adjustment</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
