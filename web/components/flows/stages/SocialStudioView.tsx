import React, { useState, useEffect } from 'react';
import { Idea, SocialPlatform } from '../../../types';
import { Button } from '../../common/Button/Button';
import { Card } from '../../common/Card/Card';
import { TextArea } from '../../common/Input/TextArea';
import { PlatformIcon } from '../../../screens/social/components/PlatformIcon';
import { refineSocialContentAI } from '../../../services/geminiService';
import { MediaLibrary } from '../../MediaLibrary/MediaLibraryModal';
import { CaptionPresetPicker } from '../../../screens/social/components/CaptionPresetPicker';
import { useLanguage } from '../../../context/LanguageContext';

interface SocialStudioViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ContentDraft {
    copy: string;
    assets: string[];
    status: 'draft' | 'ready';
    lastRefined?: string;
}

interface StudioData {
    concepts: Record<string, { hook: string; contentBody: string; visualCue: string; format: string }>;
    drafts: Record<string, ContentDraft>;
    activeDraftPlatform: string | null;
}

export const SocialStudioView: React.FC<SocialStudioViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [isRefining, setIsRefining] = useState(false);
    const [showMediaLibrary, setShowMediaLibrary] = useState(false);

    const studioData: StudioData = (() => {
        try {
            const parsed = idea.concept ? JSON.parse(idea.concept) : {};
            return {
                concepts: parsed.concepts || {},
                drafts: parsed.drafts || {},
                activeDraftPlatform: parsed.activeDraftPlatform || null,
            };
        } catch {
            return { concepts: {}, drafts: {}, activeDraftPlatform: null };
        }
    })();

    useEffect(() => {
        const platforms = Object.keys(studioData.concepts);
        if (platforms.length > 0 && !studioData.activeDraftPlatform) {
            onUpdate({ concept: JSON.stringify({ ...studioData, activeDraftPlatform: platforms[0] }) });
        }
    }, []);

    const updateStudioData = (updates: Partial<StudioData>) => {
        const currentParsed = idea.concept ? JSON.parse(idea.concept) : {};
        const newData = { ...currentParsed, ...updates };
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const platforms = Object.keys(studioData.concepts) as SocialPlatform[];
    const activePlatform = studioData.activeDraftPlatform || (platforms.length > 0 ? platforms[0] : null);

    const activeConcept = activePlatform ? studioData.concepts[activePlatform] : null;
    const activeDraft = activePlatform ? (studioData.drafts[activePlatform] || {
        copy: activeConcept ? `${activeConcept.hook}\n\n${activeConcept.contentBody}` : '',
        assets: [],
        status: 'draft'
    }) : null;

    const handleUpdateDraft = (copy: string) => {
        if (!activePlatform) return;
        const newDrafts = {
            ...studioData.drafts,
            [activePlatform]: { ...activeDraft!, copy }
        };
        updateStudioData({ drafts: newDrafts });
    };

    const handleUpdateAssets = (newAssets: string[]) => {
        if (!activePlatform) return;
        const newDrafts = {
            ...studioData.drafts,
            [activePlatform]: { ...activeDraft!, assets: newAssets }
        };
        updateStudioData({ drafts: newDrafts });
    };

    const handleMarkReady = () => {
        if (!activePlatform) return;
        const newDrafts = {
            ...studioData.drafts,
            [activePlatform]: { ...activeDraft!, status: activeDraft?.status === 'ready' ? 'draft' : 'ready' }
        } as Record<string, ContentDraft>;
        updateStudioData({ drafts: newDrafts });
    };

    const handleAIRefine = async (customInstruction?: string) => {
        if (!activeDraft || !activePlatform || isRefining) return;
        setIsRefining(true);
        try {
            const tone = (idea.concept && JSON.parse(idea.concept).tone) || 'Professional';
            const refined = await refineSocialContentAI(activeDraft.copy, activePlatform, tone, customInstruction);
            handleUpdateDraft(refined);
        } catch (e) {
            console.error(e);
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="flow-social-studio">
            <div className="flow-social-studio__container">
                <div className="flow-social-studio__hero">
                    <div className="flow-social-studio__hero-glow">
                        <span className="material-symbols-outlined">movie_edit</span>
                    </div>
                    <div className="flow-social-studio__hero-content">
                        <div className="flow-social-studio__hero-header">
                            <div className="flow-social-studio__badge">
                                {t('flowStages.socialStudio.hero.badge')}
                            </div>
                            <h1 className="flow-social-studio__title">{t('flowStages.socialStudio.hero.title')}</h1>
                        </div>
                        <p className="flow-social-studio__subtitle">{t('flowStages.socialStudio.hero.subtitle')}</p>
                    </div>
                    <div className="flow-social-studio__hero-action">
                        <Button
                            onClick={() => onUpdate({ stage: 'Distribution' })}
                            className="flow-social-studio__advance"
                            icon={<span className="material-symbols-outlined">arrow_forward</span>}
                            iconPosition="right"
                        >
                            {t('flowStages.socialStudio.actions.advance')}
                        </Button>
                    </div>
                </div>

                <div className="flow-social-studio__grid">
                    <div className="flow-social-studio__main">
                        <div className="flow-social-studio__tabs">
                            {platforms.map((platform) => {
                                const isActive = activePlatform === platform;
                                const isReady = studioData.drafts[platform]?.status === 'ready';
                                return (
                                    <button
                                        key={platform}
                                        type="button"
                                        className={`flow-social-studio__tab ${isActive ? 'is-active' : ''}`}
                                        onClick={() => updateStudioData({ activeDraftPlatform: platform })}
                                    >
                                        <div className="flow-social-studio__tab-icon"><PlatformIcon platform={platform} /></div>
                                        <span>{platform}</span>
                                        {isReady && <span className="material-symbols-outlined flow-social-studio__tab-ready">check_circle</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <Card className="flow-social-studio__editor">
                            {activePlatform && activeDraft ? (
                                <>
                                    <div className="flow-social-studio__editor-header">
                                        <div>
                                            <h3>
                                                <span className="material-symbols-outlined">edit_note</span>
                                                {activePlatform} {t('flowStages.socialStudio.editor.draftLabel')}
                                            </h3>
                                            <p>{t('flowStages.socialStudio.editor.formatLabel')} {studioData.concepts[activePlatform]?.format}</p>
                                        </div>
                                        <div className="flow-social-studio__editor-actions">
                                            <CaptionPresetPicker
                                                projectId={idea.projectId!}
                                                platform={activePlatform}
                                                onApply={(caption, hashtags) => {
                                                    const current = activeDraft.copy || '';
                                                    const separator = current && caption ? '\n\n' : '';
                                                    const tagSep = (current || caption) && hashtags ? '\n\n' : '';
                                                    const tags = hashtags ? hashtags.join(' ') : '';
                                                    handleUpdateDraft(`${current}${separator}${caption}${tagSep}${tags}`);
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleAIRefine()}
                                                isLoading={isRefining}
                                                icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                            >
                                                {t('flowStages.socialStudio.editor.autoRefine')}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="flow-social-studio__editor-grid">
                                        <div className="flow-social-studio__copy">
                                            <div className="flow-social-studio__hook">
                                                <span>{t('flowStages.socialStudio.editor.hookLabel')}</span>
                                                <p>"{studioData.concepts[activePlatform]?.hook}"</p>
                                            </div>
                                            <TextArea
                                                value={activeDraft.copy}
                                                onChange={(e) => handleUpdateDraft(e.target.value)}
                                                placeholder={t('flowStages.socialStudio.editor.copyPlaceholder')}
                                                className="flow-social-studio__copy-field"
                                            />
                                        </div>

                                        <div className="flow-social-studio__assets">
                                            <div className="flow-social-studio__visual">
                                                <span>{t('flowStages.socialStudio.editor.visualCueLabel')}</span>
                                                <p>"{studioData.concepts[activePlatform]?.visualCue}"</p>
                                            </div>

                                            <div className="flow-social-studio__asset-box">
                                                {activeDraft.assets.length > 0 ? (
                                                    <div className="flow-social-studio__asset-grid">
                                                        {activeDraft.assets.map((url, index) => (
                                                            <div key={index} className="flow-social-studio__asset">
                                                                {url.match(/\.(mp4|mov|webm)$/i) ? (
                                                                    <video src={`${url}#t=0.001`} />
                                                                ) : (
                                                                    <img src={url} alt={t('flowStages.socialStudio.editor.assetAlt')} />
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleUpdateAssets(activeDraft.assets.filter((_, idx) => idx !== index))}
                                                                >
                                                                    <span className="material-symbols-outlined">close</span>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            className="flow-social-studio__asset-add"
                                                            onClick={() => setShowMediaLibrary(true)}
                                                        >
                                                            <span className="material-symbols-outlined">add</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flow-social-studio__asset-empty">
                                                        <span className="material-symbols-outlined">image</span>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => setShowMediaLibrary(true)}
                                                        >
                                                            {t('flowStages.socialStudio.editor.upload')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flow-social-studio__editor-empty">
                                    <span className="material-symbols-outlined">movie_edit</span>
                                    <p>{t('flowStages.socialStudio.editor.empty')}</p>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="flow-social-studio__sidebar">
                        <Card className="flow-social-studio__queue">
                            <h3>
                                <span className="material-symbols-outlined">queue_music</span>
                                {t('flowStages.socialStudio.queue.title')}
                            </h3>
                            <div className="flow-social-studio__queue-list">
                                {platforms.map((platform) => {
                                    const ready = studioData.drafts[platform]?.status === 'ready';
                                    const format = studioData.concepts[platform]?.format;
                                    const hasContent = studioData.drafts[platform]?.copy || studioData.drafts[platform]?.assets.length > 0;

                                    return (
                                        <div key={platform} className={`flow-social-studio__queue-item ${activePlatform === platform ? 'is-active' : ''}`}>
                                            <div className="flow-social-studio__queue-main">
                                                <div className="flow-social-studio__queue-icon">
                                                    <PlatformIcon platform={platform} />
                                                </div>
                                                <div>
                                                    <span>{platform}</span>
                                                    <span className="flow-social-studio__queue-format">{format}</span>
                                                </div>
                                            </div>
                                            <div className="flow-social-studio__queue-status">
                                                <span className={`flow-social-studio__queue-pill ${ready ? 'is-ready' : hasContent ? 'is-progress' : 'is-empty'}`}>
                                                    {ready
                                                        ? t('flowStages.socialStudio.queue.status.ready')
                                                        : hasContent
                                                            ? t('flowStages.socialStudio.queue.status.inProgress')
                                                            : t('flowStages.socialStudio.queue.status.empty')}
                                                </span>
                                                {activePlatform === platform && (
                                                    <button
                                                        type="button"
                                                        className="flow-social-studio__queue-toggle"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleMarkReady();
                                                        }}
                                                    >
                                                        {ready ? t('flowStages.socialStudio.queue.actions.markDraft') : t('flowStages.socialStudio.queue.actions.markReady')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flow-social-studio__queue-hint">
                                {t('flowStages.socialStudio.queue.hint')}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {showMediaLibrary && (
                <MediaLibrary
                    isOpen={showMediaLibrary}
                    onClose={() => setShowMediaLibrary(false)}
                    projectId={idea.projectId!}
                    onSelect={(asset) => {
                        const currentAssets = activeDraft?.assets || [];
                        handleUpdateAssets([...currentAssets, asset.url]);
                        setShowMediaLibrary(false);
                    }}
                />
            )}
        </div>
    );
};
