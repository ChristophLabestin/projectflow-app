import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { subscribeCaptionPresets, createCaptionPreset, updateCaptionPreset, deleteCaptionPreset } from '../../../services/dataService';
import { CaptionPreset, SocialPlatform } from '../../../types';
import { useToast, useConfirm } from '../../../context/UIContext';
import { AICaptionGenerator } from './AICaptionGenerator';
import { generateSocialHashtags } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface CaptionPresetManagerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectPreset?: (preset: CaptionPreset) => void;
}

const PLATFORMS: (SocialPlatform | 'All')[] = ['All', 'Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'X', 'YouTube'];

const PLATFORM_ICONS: Record<SocialPlatform | 'All', string> = {
    'All': 'public',
    'Instagram': 'photo_camera',
    'Facebook': 'facebook',
    'LinkedIn': 'business_center',
    'TikTok': 'music_note',
    'X': 'tag',
    'YouTube': 'play_circle'
};

export const CaptionPresetManager: React.FC<CaptionPresetManagerProps> = ({ isOpen, onClose, onSelectPreset }) => {
    const { id: projectId } = useParams<{ id: string }>();
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();
    const { t } = useLanguage();

    const [presets, setPresets] = useState<CaptionPreset[]>([]);
    const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingPreset, setEditingPreset] = useState<CaptionPreset | null>(null);
    const [loading, setLoading] = useState(false);
    const [showAIGenerator, setShowAIGenerator] = useState(false);
    const [generatingHashtags, setGeneratingHashtags] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formPlatform, setFormPlatform] = useState<SocialPlatform | 'All'>('All');
    const [formHashtags, setFormHashtags] = useState('');
    const [formCategory, setFormCategory] = useState('');

    useEffect(() => {
        if (!projectId || !isOpen) return;
        const unsub = subscribeCaptionPresets(projectId, setPresets);
        return () => unsub();
    }, [projectId, isOpen]);

    const resetForm = () => {
        setFormName('');
        setFormContent('');
        setFormPlatform('All');
        setFormHashtags('');
        setFormCategory('');
        setIsCreating(false);
        setEditingPreset(null);
    };

    const handleEdit = (preset: CaptionPreset) => {
        setEditingPreset(preset);
        setFormName(preset.name);
        setFormContent(preset.content);
        setFormPlatform(preset.platform);
        setFormHashtags(preset.hashtags?.join(' ') || '');
        setFormCategory(preset.category || '');
        setIsCreating(true);
    };

    const handleSave = async () => {
        if (!projectId || !formName.trim() || !formContent.trim()) return;
        setLoading(true);
        try {
            const data = {
                name: formName.trim(),
                content: formContent.trim(),
                platform: formPlatform,
                hashtags: formHashtags.split(' ').filter(h => h.startsWith('#')),
                category: formCategory.trim() || undefined,
                projectId
            };

            if (editingPreset) {
                await updateCaptionPreset(projectId, editingPreset.id, data);
                showSuccess(t('social.captionPresetManager.toast.updated'));
            } else {
                await createCaptionPreset(projectId, data);
                showSuccess(t('social.captionPresetManager.toast.created'));
            }
            resetForm();
        } catch (error) {
            console.error(error);
            showError(t('social.captionPresetManager.toast.saveError'));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (preset: CaptionPreset) => {
        if (!projectId) return;
        const confirmed = await confirm(
            t('social.captionPresetManager.deleteConfirm.title'),
            t('social.captionPresetManager.deleteConfirm.message').replace('{name}', preset.name)
        );
        if (confirmed) {
            try {
                await deleteCaptionPreset(projectId, preset.id);
                showSuccess(t('social.captionPresetManager.toast.deleted'));
            } catch (error) {
                showError(t('social.captionPresetManager.toast.deleteError'));
            }
        }
    };

    // Filter presets
    const filteredPresets = presets.filter(p => {
        const matchesPlatform = selectedPlatform === 'All' || p.platform === selectedPlatform || p.platform === 'All';
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.content.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesPlatform && matchesSearch;
    });

    // Group by category
    const groupedPresets = filteredPresets.reduce((acc, preset) => {
        const cat = preset.category || t('social.captionPresetManager.category.uncategorized');
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(preset);
        return acc;
    }, {} as Record<string, CaptionPreset[]>);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-4xl h-[80vh] bg-card rounded-2xl shadow-2xl border border-surface flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-surface flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-main">{t('social.captionPresetManager.title')}</h2>
                        <p className="text-sm text-muted">{t('social.captionPresetManager.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Preset List */}
                    <div className="w-2/3 border-r border-surface flex flex-col">
                        {/* Platform Tabs & Search */}
                        <div className="p-4 border-b border-surface space-y-3">
                            {/* Platform Pills */}
                            <div className="flex flex-wrap gap-2">
                                {PLATFORMS.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setSelectedPlatform(p)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all
                                            ${selectedPlatform === p
                                                ? 'bg-primary text-on-primary shadow-lg shadow-[var(--color-primary)]/20'
                                                : 'bg-surface-hover text-muted hover:text-main'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">{PLATFORM_ICONS[p]}</span>
                                        {p === 'All' ? t('social.captionPresetManager.platform.all') : p}
                                    </button>
                                ))}
                            </div>
                            {/* Search */}
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[18px]">search</span>
                                <input
                                    type="text"
                                    placeholder={t('social.captionPresetManager.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-surface border border-surface rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                                />
                            </div>
                        </div>

                        {/* Presets List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {Object.keys(groupedPresets).length === 0 ? (
                                <div className="text-center py-12 text-muted">
                                    <span className="material-symbols-outlined text-4xl mb-2">description</span>
                                    <p>{t('social.captionPresetManager.empty.title')}</p>
                                    <p className="text-sm">{t('social.captionPresetManager.empty.subtitle')}</p>
                                </div>
                            ) : (
                                Object.entries(groupedPresets).map(([category, categoryPresets]) => (
                                    <div key={category}>
                                        <h3 className="text-xs font-semibold text-muted uppercase mb-2">{category}</h3>
                                        <div className="space-y-2">
                                            {categoryPresets.map(preset => (
                                                <div
                                                    key={preset.id}
                                                    className="p-4 bg-surface border border-surface rounded-xl hover:border-primary/50 transition-all group cursor-pointer"
                                                    onClick={() => onSelectPreset?.(preset)}
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-[16px] text-muted">
                                                                {PLATFORM_ICONS[preset.platform]}
                                                            </span>
                                                            <span className="font-semibold text-main">{preset.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleEdit(preset); }}
                                                                className="p-1.5 rounded-lg hover:bg-surface-hover text-muted"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(preset); }}
                                                                className="p-1.5 rounded-lg hover:bg-red-50 text-muted hover:text-red-600"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-muted line-clamp-2">{preset.content}</p>
                                                    {preset.hashtags && preset.hashtags.length > 0 && (
                                                        <p className="text-xs text-primary mt-2 truncate">{preset.hashtags.join(' ')}</p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Right: Create/Edit Form */}
                    <div className="w-1/3 p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-main">
                                {editingPreset ? t('social.captionPresetManager.form.editTitle') : t('social.captionPresetManager.form.newTitle')}
                            </h3>
                            {(isCreating || editingPreset) && (
                                <button onClick={resetForm} className="text-xs text-muted hover:text-main">
                                    {t('social.captionPresetManager.form.cancel')}
                                </button>
                            )}
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto">
                            <Input
                                label={t('social.captionPresetManager.form.nameLabel')}
                                placeholder={t('social.captionPresetManager.form.namePlaceholder')}
                                value={formName}
                                onChange={e => setFormName(e.target.value)}
                            />

                            <Select
                                label={t('social.captionPresetManager.form.platformLabel')}
                                value={formPlatform}
                                onChange={e => setFormPlatform(e.target.value as SocialPlatform | 'All')}
                            >
                                {PLATFORMS.map(p => (
                                    <option key={p} value={p}>{p === 'All' ? t('social.captionPresetManager.platform.all') : p}</option>
                                ))}
                            </Select>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-semibold text-muted uppercase">{t('social.captionPresetManager.form.captionLabel')}</label>
                                    <button
                                        onClick={() => setShowAIGenerator(true)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                                        {t('social.captionPresetManager.form.aiAssist')}
                                    </button>
                                </div>
                                <Textarea
                                    value={formContent}
                                    onChange={e => setFormContent(e.target.value)}
                                    placeholder={t('social.captionPresetManager.form.captionPlaceholder')}
                                    className="min-h-[120px]"
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-muted uppercase">{t('social.captionPresetManager.form.hashtagsLabel')}</label>
                                    <button
                                        onClick={async () => {
                                            if (!formContent) return;
                                            setGeneratingHashtags(true);
                                            try {
                                                const tags = await generateSocialHashtags(formContent, formPlatform === 'All' ? 'Instagram' : formPlatform);
                                                setFormHashtags(tags);
                                            } catch (error) {
                                                console.error(error);
                                                showError(t('social.captionPresetManager.form.hashtagsError'));
                                            } finally {
                                                setGeneratingHashtags(false);
                                            }
                                        }}
                                        disabled={generatingHashtags || !formContent}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">{generatingHashtags ? 'hourglass_top' : 'auto_awesome'}</span>
                                        {generatingHashtags ? t('social.captionPresetManager.form.generating') : t('social.captionPresetManager.form.generate')}
                                    </button>
                                </div>
                                <Input
                                    placeholder={t('social.captionPresetManager.form.hashtagsPlaceholder')}
                                    value={formHashtags}
                                    onChange={e => setFormHashtags(e.target.value)}
                                />
                            </div>

                            <Input
                                label={t('social.captionPresetManager.form.categoryLabel')}
                                placeholder={t('social.captionPresetManager.form.categoryPlaceholder')}
                                value={formCategory}
                                onChange={e => setFormCategory(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 mt-4 border-t border-surface">
                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={handleSave}
                                disabled={!formName.trim() || !formContent.trim()}
                                isLoading={loading}
                            >
                                {editingPreset ? t('social.captionPresetManager.form.update') : t('social.captionPresetManager.form.create')}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <AICaptionGenerator
                isOpen={showAIGenerator}
                onClose={() => setShowAIGenerator(false)}
                onGenerate={(text) => setFormContent(prev => prev + (prev ? '\n\n' : '') + text)}
                platform={formPlatform === 'All' ? 'Instagram' : formPlatform}
            />
        </div>
    );
};
