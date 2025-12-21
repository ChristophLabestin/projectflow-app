import React, { useState, useEffect, useCallback } from 'react';
import { auth, storage } from '../services/firebase';
import { updateUserProfile, getActiveTenantId, subscribeTenantUsers } from '../services/dataService';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Textarea';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

export const Profile = () => {
    const user = auth.currentUser;
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [title, setTitle] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Cropper State
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    useEffect(() => {
        if (!user) return;
        const tenantId = getActiveTenantId();
        if (tenantId) {
            setLoading(true);
            // Quick fetch of current user data from tenant
            // We reuse subscribe but just once or we can make a get function.
            // Reusing subscribe for now as it's available.
            const unsub = subscribeTenantUsers((users) => {
                const me = users.find(u => u.id === user.uid) as any;
                if (me) {
                    setTitle(me.title || '');
                    setBio(me.bio || '');
                }
                setLoading(false);
            }, tenantId);
            return () => unsub();
        }
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setCropImageSrc(reader.result as string);
            };
            reader.readAsDataURL(selectedFile);
        }
        e.target.value = ''; // Reset input
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const showCroppedImage = useCallback(async () => {
        if (!cropImageSrc || !croppedAreaPixels) return;
        try {
            const croppedBlob = await getCroppedImg(cropImageSrc, croppedAreaPixels);
            if (croppedBlob) {
                const newFile = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
                setFile(newFile);
                setPhotoURL(URL.createObjectURL(croppedBlob));
                setCropImageSrc(null); // Close modal
            }
        } catch (e) {
            console.error(e);
        }
    }, [cropImageSrc, croppedAreaPixels]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const newPhoto = await updateUserProfile({
                displayName,
                title,
                bio,
                file: file || undefined
            });
            if (newPhoto) setPhotoURL(newPhoto);
            alert("Profile updated successfully!");
        } catch (e: any) {
            console.error(e);
            alert(`Failed to update profile: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (!user) return <div>Please login.</div>;

    return (
        <div className="max-w-2xl mx-auto p-6 fade-in space-y-6">
            <h1 className="h2 text-[var(--color-text-main)]">My Profile</h1>

            <Card className="p-8 space-y-8">
                {/* Avatar Section */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                        <div className="size-32 rounded-full overflow-hidden border-4 border-[var(--color-surface-bg)] shadow-lg bg-gray-100 dark:bg-gray-800">
                            {photoURL ? (
                                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300">{displayName[0]}</div>
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 p-2 bg-[var(--color-primary)] text-white rounded-full cursor-pointer hover:bg-[var(--color-primary-dark)] shadow transition-colors">
                            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                        </label>
                    </div>
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-[var(--color-text-main)]">{displayName || 'User'}</h2>
                        <p className="text-[var(--color-text-muted)]">{user.email}</p>
                    </div>
                </div>

                {/* Form */}
                <div className="space-y-4 max-w-lg mx-auto w-full">
                    <Input
                        label="Display Name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="How your name appears to others"
                    />

                    <Input
                        label="Job Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Senior Developer"
                    />

                    <Textarea
                        label="Bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell a bit about yourself..."
                        rows={4}
                    />

                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleSave} loading={saving}>Save Changes</Button>
                    </div>
                </div>
            </Card>

            {/* Cropper Modal */}
            {cropImageSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl overflow-hidden w-full max-w-md flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b dark:border-gray-800 flex justify-between items-center">
                            <h3 className="font-bold">Crop Profile Photo</h3>
                            <button onClick={() => setCropImageSrc(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="relative h-64 sm:h-80 bg-black">
                            <Cropper
                                image={cropImageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Zoom</label>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" onClick={() => setCropImageSrc(null)} className="flex-1">Cancel</Button>
                                <Button onClick={showCroppedImage} className="flex-1">Apply Crop</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
