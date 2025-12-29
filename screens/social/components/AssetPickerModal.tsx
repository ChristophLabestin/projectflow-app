
import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SocialAsset } from '../../../types';
import { subscribeSocialAssets } from '../../../services/dataService';
import { useParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';

interface AssetPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: SocialAsset) => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const [assets, setAssets] = useState<SocialAsset[]>([]);
    const { t } = useLanguage();

    useEffect(() => {
        if (!projectId || !isOpen) return;
        const unsub = subscribeSocialAssets(projectId, (data) => setAssets(data));
        return () => unsub();
    }, [projectId, isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('social.assetPicker.title')} maxWidth="max-w-4xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
                {assets.length === 0 && (
                    <div className="col-span-full text-center py-10 text-[var(--color-text-muted)]">
                        {t('social.assetPicker.empty')}
                    </div>
                )}
                {assets.map(asset => (
                    <div
                        key={asset.id}
                        className="group relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-[var(--color-surface-border)] cursor-pointer hover:ring-2 ring-[var(--color-primary)] transition-all"
                        onClick={() => {
                            onSelect(asset);
                            onClose();
                        }}
                    >
                        {asset.type === 'image' ? (
                            <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)]">
                                <span className="material-symbols-outlined text-4xl">movie</span>
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                ))}
            </div>
        </Modal>
    );
};
