import React, { useState, useEffect, useRef } from 'react';
import { subscribeCaptionPresets } from '../../../services/dataService';
import { CaptionPreset, SocialPlatform } from '../../../types';
import { CaptionPresetManager } from './CaptionPresetManager';
import { useLanguage } from '../../../context/LanguageContext';

interface CaptionPresetPickerProps {
    projectId: string;
    platform: SocialPlatform;
    onApply: (caption: string, hashtags?: string[]) => void;
}

const PLATFORM_ICONS: Record<SocialPlatform | 'All', string> = {
    'All': 'public',
    'Instagram': 'photo_camera',
    'Facebook': 'facebook',
    'LinkedIn': 'business_center',
    'TikTok': 'music_note',
    'X': 'tag',
    'YouTube': 'play_circle'
};

export const CaptionPresetPicker: React.FC<CaptionPresetPickerProps> = ({ projectId, platform, onApply }) => {
    const [presets, setPresets] = useState<CaptionPreset[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showManager, setShowManager] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        if (!projectId) return;
        const unsub = subscribeCaptionPresets(projectId, setPresets);
        return () => unsub();
    }, [projectId]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Filter presets for current platform (include 'All' platform presets)
    const filteredPresets = presets.filter(p => p.platform === platform || p.platform === 'All');

    const handleSelectPreset = (preset: CaptionPreset) => {
        onApply(preset.content, preset.hashtags);
        setIsOpen(false);
    };

    const handleOpenManager = () => {
        setIsOpen(false);
        setShowManager(true);
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-3 py-1.5 bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                >
                    <span className="material-symbols-outlined text-[14px]">bookmark</span>
                    {t('social.captionPresetPicker.label')}
                    {filteredPresets.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full text-[10px] font-bold">
                            {filteredPresets.length}
                        </span>
                    )}
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-[var(--color-surface-border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-[var(--color-text-muted)]">{PLATFORM_ICONS[platform]}</span>
                                <span className="text-sm font-semibold text-[var(--color-text-main)]">
                                    {t('social.captionPresetPicker.title').replace('{platform}', platform)}
                                </span>
                            </div>
                            <button
                                onClick={handleOpenManager}
                                className="text-xs text-[var(--color-primary)] hover:underline"
                            >
                                {t('social.captionPresetPicker.manageAll')}
                            </button>
                        </div>

                        {/* Presets List */}
                        <div className="max-h-64 overflow-y-auto">
                            {filteredPresets.length === 0 ? (
                                <div className="p-6 text-center text-[var(--color-text-muted)]">
                                    <span className="material-symbols-outlined text-3xl mb-2">description</span>
                                    <p className="text-sm">{t('social.captionPresetPicker.empty').replace('{platform}', platform)}</p>
                                    <button
                                        onClick={handleOpenManager}
                                        className="mt-2 text-xs text-[var(--color-primary)] hover:underline"
                                    >
                                        {t('social.captionPresetPicker.createOne')}
                                    </button>
                                </div>
                            ) : (
                                filteredPresets.map(preset => (
                                    <button
                                        key={preset.id}
                                        onClick={() => handleSelectPreset(preset)}
                                        className="w-full px-4 py-3 text-left hover:bg-[var(--color-surface-hover)] transition-colors border-b border-[var(--color-surface-border)] last:border-b-0"
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            {preset.platform === 'All' && (
                                                <span className="material-symbols-outlined text-[12px] text-[var(--color-text-muted)]">public</span>
                                            )}
                                            <span className="font-medium text-sm text-[var(--color-text-main)]">{preset.name}</span>
                                            {preset.category && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--color-surface-hover)] rounded text-[var(--color-text-muted)]">
                                                    {preset.category}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{preset.content}</p>
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        {filteredPresets.length > 0 && (
                            <div className="px-4 py-2 border-t border-[var(--color-surface-border)] bg-[var(--color-surface-bg)]">
                                <p className="text-[10px] text-[var(--color-text-muted)] text-center">
                                    {t('social.captionPresetPicker.hint')}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full Manager Modal */}
            <CaptionPresetManager
                isOpen={showManager}
                onClose={() => setShowManager(false)}
                onSelectPreset={(preset) => {
                    onApply(preset.content, preset.hashtags);
                    setShowManager(false);
                }}
            />
        </>
    );
};
