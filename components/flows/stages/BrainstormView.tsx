import React, { useState, useEffect, useRef } from 'react';
import { Idea } from '../../../types';
import { Button } from '../../common/Button/Button';
import { TextInput } from '../../common/Input/TextInput';
import { Card } from '../../common/Card/Card';
import { generateKeywordsAI } from '../../../services/geminiService';
import { useLanguage } from '../../../context/LanguageContext';

interface BrainstormViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

export const BrainstormView: React.FC<BrainstormViewProps> = ({ idea, onUpdate }) => {
    const { t } = useLanguage();
    const [keywordInput, setKeywordInput] = useState('');
    const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [dismissedSuggestions, setDismissedSuggestions] = useState<string[]>([]);

    // Animation refs for the "breathing" effect
    const frameRef = useRef<number>();
    const [time, setTime] = useState(0);

    // LocalStorage key based on idea ID
    const storageKey = `brainstorm_suggestions_${idea.id}`;
    const dismissedKey = `brainstorm_dismissed_${idea.id}`;

    // Load cached suggestions and dismissed list on mount
    useEffect(() => {
        if (!idea.id) return;
        try {
            const cached = localStorage.getItem(storageKey);
            const dismissed = localStorage.getItem(dismissedKey);
            if (cached) setSuggestions(JSON.parse(cached));
            // Prefer Firestore data, fallback to localStorage
            if (idea.dismissedSuggestions?.length) {
                setDismissedSuggestions(idea.dismissedSuggestions);
            } else if (dismissed) {
                setDismissedSuggestions(JSON.parse(dismissed));
            }
        } catch (e) {
            console.warn('Failed to load cached suggestions', e);
        }
    }, [idea.id]);

    // Save suggestions to localStorage whenever they change
    useEffect(() => {
        if (!idea.id) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(suggestions));
        } catch (e) {
            console.warn('Failed to cache suggestions', e);
        }
    }, [suggestions, idea.id]);

    // Save dismissed suggestions to localStorage whenever they change
    useEffect(() => {
        if (!idea.id) return;
        try {
            localStorage.setItem(dismissedKey, JSON.stringify(dismissedSuggestions));
        } catch (e) {
            console.warn('Failed to cache dismissed suggestions', e);
        }
    }, [dismissedSuggestions, idea.id]);

    // Initial keywords if not present
    useEffect(() => {
        if (!idea.keywords) {
            onUpdate({ keywords: [] });
        }
    }, []);

    useEffect(() => {
        const animate = () => {
            setTime((prev) => prev + 0.005);
            frameRef.current = requestAnimationFrame(animate);
        };
        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current!);
    }, []);

    const handleAddKeyword = (word: string) => {
        if (!word.trim()) return;
        const currentKeywords = idea.keywords || [];
        if (!currentKeywords.includes(word.trim())) {
            onUpdate({ keywords: [...currentKeywords, word.trim()] });
        }
        setKeywordInput('');
        // Remove from suggestions if added
        setSuggestions((prev) => prev.filter((s) => s !== word));
    };

    const handleDismissSuggestion = (word: string) => {
        setSuggestions((prev) => prev.filter((s) => s !== word));
        const newDismissed = [...dismissedSuggestions, word];
        setDismissedSuggestions(newDismissed);
        onUpdate({ dismissedSuggestions: newDismissed });
    };

    const removeKeyword = (keyword: string) => {
        const currentKeywords = idea.keywords || [];
        onUpdate({ keywords: currentKeywords.filter((k) => k !== keyword) });
    };

    const handleGenerateKeywords = async () => {
        if (!idea.title) return;
        setSuggesting(true);
        try {
            // Combine existing keywords + current suggestions + dismissed to exclude
            const excludeList = [...(idea.keywords || []), ...suggestions, ...dismissedSuggestions];
            const results = await generateKeywordsAI(idea, excludeList);
            // Append new results to existing suggestions instead of replacing
            setSuggestions((prev) => [...prev, ...results.filter((r) => !prev.includes(r))]);
        } catch (e) {
            console.error(e);
        } finally {
            setSuggesting(false);
        }
    };

    // Calculate positions for circular layout with some floaty movement
    const getKeywordPosition = (index: number, total: number) => {
        if (total === 0) return { x: 0, y: 0 };
        // Minimum radius to avoid overlapping with center node (center is ~100px radius)
        const radiusBase = 220;

        // Add subtle movement based on time
        const floatX = Math.sin(time + index) * 8;
        const floatY = Math.cos(time + index * 1.5) * 8;

        // Distribute evenly around the circle
        const distributedAngle = (index / total) * 2 * Math.PI + time * 0.02;

        return {
            x: Math.cos(distributedAngle) * radiusBase + floatX,
            y: Math.sin(distributedAngle) * radiusBase + floatY
        };
    };

    const keywords = idea.keywords || [];

    const missionText = (
        <p className="flow-brainstorm__mission">
            "{t('flowStages.brainstorm.mission.prefix')}{' '}
            <span className="flow-brainstorm__mission-highlight">{t('flowStages.brainstorm.mission.concept')}</span>
            {' '}{t('flowStages.brainstorm.mission.for')}{' '}
            <span className="flow-brainstorm__mission-highlight">{idea.title || t('flowStages.brainstorm.untitled')}</span>
            {' '}{t('flowStages.brainstorm.mission.expandBy')}{' '}
            <span className="flow-brainstorm__mission-highlight">
                {t('flowStages.brainstorm.mission.coreKeywords').replace('{count}', String(keywords.length))}
            </span>
            {' '}{t('flowStages.brainstorm.mission.associations')}{' '}
            <span className="flow-brainstorm__mission-highlight">{t('flowStages.brainstorm.mission.angles')}</span>."
        </p>
    );

    return (
        <div className="flow-brainstorm">
            <div className="flow-brainstorm__container">
                <div className="flow-brainstorm__hero">
                    <div className="flow-brainstorm__hero-glow">
                        <span className="material-symbols-outlined">lightbulb</span>
                    </div>
                    <div className="flow-brainstorm__hero-content">
                        <div className="flow-brainstorm__hero-header">
                            <div className="flow-brainstorm__badge">
                                {t('flowStages.brainstorm.badge')}
                            </div>
                            <h1 className="flow-brainstorm__title">
                                {t('flowStages.brainstorm.title')}
                            </h1>
                        </div>
                        <div className="flow-brainstorm__mission-card">
                            {missionText}
                        </div>
                    </div>
                </div>

                <div className="flow-brainstorm__grid">
                    <div className="flow-brainstorm__sidebar">
                        <Card className="flow-brainstorm__panel">
                            <h3 className="flow-brainstorm__panel-title">{t('flowStages.brainstorm.coreConcept.title')}</h3>
                            <TextInput
                                value={idea.title}
                                onChange={(e) => onUpdate({ title: e.target.value })}
                                placeholder={t('flowStages.brainstorm.coreConcept.placeholder')}
                                className="flow-brainstorm__input"
                                rightElement={<span className="material-symbols-outlined">edit</span>}
                            />
                        </Card>

                        <Card className="flow-brainstorm__panel">
                            <div className="flow-brainstorm__panel-header">
                                <h3 className="flow-brainstorm__panel-title">{t('flowStages.brainstorm.associative.title')}</h3>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleGenerateKeywords}
                                    isLoading={suggesting}
                                    className="flow-brainstorm__ai-button"
                                    icon={<span className="material-symbols-outlined">auto_awesome</span>}
                                >
                                    {t('flowStages.brainstorm.associative.aiSuggest')}
                                </Button>
                            </div>

                            <div className="flow-brainstorm__keyword-stack">
                                <div className="flow-brainstorm__keyword-row">
                                    <TextInput
                                        value={keywordInput}
                                        onChange={(e) => setKeywordInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword(keywordInput)}
                                        placeholder={t('flowStages.brainstorm.keywords.placeholder')}
                                        className="flow-brainstorm__keyword-input"
                                    />
                                    <Button
                                        size="icon"
                                        variant="primary"
                                        className="flow-brainstorm__keyword-add"
                                        onClick={() => handleAddKeyword(keywordInput)}
                                        aria-label={t('common.add')}
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </Button>
                                </div>

                                <div className="flow-brainstorm__keywords">
                                    {keywords.map((keyword) => (
                                        <span key={keyword} className="flow-brainstorm__keyword">
                                            {keyword}
                                            <button type="button" onClick={() => removeKeyword(keyword)} aria-label={t('common.delete')}>
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    {keywords.length === 0 && (
                                        <p className="flow-brainstorm__keywords-empty">{t('flowStages.brainstorm.keywords.empty')}</p>
                                    )}
                                </div>

                                {suggestions.length > 0 && (
                                    <div className="flow-brainstorm__suggestions">
                                        <div className="flow-brainstorm__suggestions-header">
                                            <span>{t('flowStages.brainstorm.keywords.suggested')}</span>
                                            <button type="button" onClick={() => setSuggestions([])}>
                                                {t('flowStages.brainstorm.keywords.clear')}
                                            </button>
                                        </div>
                                        <div className="flow-brainstorm__suggestions-list">
                                            {suggestions.map((suggestion, index) => (
                                                <div key={`${suggestion}-${index}`} className="flow-brainstorm__suggestion">
                                                    <button
                                                        type="button"
                                                        className="flow-brainstorm__suggestion-main"
                                                        onClick={() => handleAddKeyword(suggestion)}
                                                    >
                                                        {suggestion}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="flow-brainstorm__suggestion-dismiss"
                                                        onClick={() => handleDismissSuggestion(suggestion)}
                                                        aria-label={t('common.delete')}
                                                    >
                                                        <span className="material-symbols-outlined">close</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>

                    <div className="flow-brainstorm__main">
                        <Card className="flow-brainstorm__visual">
                            <div className="flow-brainstorm__visual-grid" />

                            <div className="flow-brainstorm__visual-center">
                                <div className="flow-brainstorm__node">
                                    <span className="material-symbols-outlined">lightbulb</span>
                                    <span className="flow-brainstorm__node-title">
                                        {idea.title || t('flowStages.brainstorm.untitled')}
                                    </span>
                                </div>

                                <div className="flow-brainstorm__keyword-cloud">
                                    {keywords.map((keyword, index) => {
                                        const pos = getKeywordPosition(index, keywords.length);
                                        const isActive = hoveredKeyword === keyword;

                                        return (
                                            <React.Fragment key={keyword}>
                                                <svg className="flow-brainstorm__link">
                                                    <line
                                                        x1="50%" y1="50%"
                                                        x2={`calc(50% + ${pos.x}px)`} y2={`calc(50% + ${pos.y}px)`}
                                                    />
                                                </svg>

                                                <div
                                                    className={`flow-brainstorm__keyword-node ${isActive ? 'is-active' : ''}`}
                                                    style={{
                                                        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                                                    }}
                                                    onMouseEnter={() => setHoveredKeyword(keyword)}
                                                    onMouseLeave={() => setHoveredKeyword(null)}
                                                >
                                                    <span>{keyword}</span>
                                                    {isActive && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                removeKeyword(keyword);
                                                            }}
                                                            aria-label={t('common.delete')}
                                                        >
                                                            <span className="material-symbols-outlined">close</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>

                        <div className="flow-brainstorm__footer">
                            <Button
                                className="flow-brainstorm__advance"
                                onClick={() => {
                                    const nextStage = idea.type === 'Social' ? 'Strategy' : 'Refining';
                                    onUpdate({ stage: nextStage });
                                }}
                                icon={<span className="material-symbols-outlined">arrow_forward</span>}
                                iconPosition="right"
                            >
                                {t('flowStages.brainstorm.actions.advance').replace('{stage}', idea.type === 'Social' ? t('flows.stage.strategy') : t('flows.stage.refining'))}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
