
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { subscribeSocialAssets, createSocialAsset, deleteSocialAsset } from '../../services/dataService';
import { SocialAsset } from '../../types';
import { Button } from '../../components/ui/Button';
import { auth } from '../../services/firebase';
import { useConfirm } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';

export const SocialAssets = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const [assets, setAssets] = useState<SocialAsset[]>([]);
    const [uploading, setUploading] = useState(false);
    const confirm = useConfirm();
    const { t } = useLanguage();

    // File Input Ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeSocialAssets(projectId, (data) => setAssets(data));
        return () => unsub();
    }, [projectId]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !projectId || !auth.currentUser) return;

        setUploading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Url = reader.result as string;

                // Determine file type
                const type = file.type.startsWith('image/') ? 'image' : 'video';

                await createSocialAsset(projectId, {
                    projectId,
                    url: base64Url,
                    storagePath: 'local/storage', // Placeholder for real storage path
                    type,
                    filename: file.name,
                    mimeType: file.type,
                    size: file.size,
                    width: 0,
                    height: 0,
                    tags: [],
                    createdBy: auth.currentUser!.uid,
                    createdAt: new Date().toISOString()
                } as any);

                setUploading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Upload failed", error);
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!projectId) return;
        if (await confirm(t('social.assets.confirmDelete.title'), t('social.assets.confirmDelete.message'))) {
            await deleteSocialAsset(projectId, id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="h2 mb-2">{t('social.assets.title')}</h1>
                    <p className="text-[var(--color-text-muted)]">{t('social.assets.subtitle')}</p>
                </div>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                />

                <Button
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                    isLoading={uploading}
                    icon={<span className="material-symbols-outlined">upload</span>}
                >
                    {t('social.assets.upload')}
                </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {assets.length === 0 && (
                    <div className="col-span-full p-10 text-center text-[var(--color-text-muted)] bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl">
                        {t('social.assets.empty')}
                    </div>
                )}
                {assets.map(asset => (
                    <div key={asset.id} className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-[var(--color-surface-border)]">
                        {asset.type === 'image' ? (
                            <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-4xl">movie</span>
                            </div>
                        )}

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                onClick={() => window.open(asset.url, '_blank')}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-sm transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </button>
                            <button
                                onClick={() => handleDelete(asset.id)}
                                className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white backdrop-blur-sm transition-colors"
                            >
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
