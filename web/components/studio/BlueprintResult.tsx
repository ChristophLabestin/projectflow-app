import React from 'react';
import { ProjectBlueprint } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../common/Button/Button';
import { Card, CardBody } from '../common/Card/Card';
import { Badge } from '../common/Badge/Badge';

interface BlueprintResultProps {
    blueprint: ProjectBlueprint;
    onConvert: (blueprint: ProjectBlueprint) => void;
    isConverting: boolean;
}

export const BlueprintResult: React.FC<BlueprintResultProps> = ({
    blueprint, onConvert, isConverting
}) => {
    const { t } = useLanguage();
    const getPriorityClass = (priority: string) => {
        if (priority === 'High') return 'high';
        if (priority === 'Medium') return 'medium';
        if (priority === 'Low') return 'low';
        return 'medium';
    };

    return (
        <div className="ai-studio-blueprint animate-fade-in">
            <div className="ai-studio-blueprint__header">
                <div className="ai-studio-blueprint__title">
                    <span className="ai-studio-blueprint__label">{t('aiStudio.blueprint.conceptLabel')}</span>
                    <h2 className="ai-studio-blueprint__heading">{blueprint.title}</h2>
                </div>
                <Button
                    onClick={() => onConvert(blueprint)}
                    isLoading={isConverting}
                    icon={<span className="material-symbols-outlined">rocket_launch</span>}
                    iconPosition="right"
                    className="ai-studio-blueprint__action"
                >
                    {isConverting ? t('aiStudio.blueprint.launching') : t('aiStudio.blueprint.convert')}
                </Button>
            </div>

            <div className="ai-studio-blueprint__grid">
                <div className="ai-studio-blueprint__main">
                    <Card className="ai-studio-blueprint__card">
                        <CardBody className="ai-studio-blueprint__card-body">
                            <h3 className="ai-studio-blueprint__card-title">
                                <span className="material-symbols-outlined">description</span>
                                {t('aiStudio.blueprint.vision')}
                            </h3>
                            <p className="ai-studio-blueprint__text">{blueprint.description}</p>

                            <div className="ai-studio-blueprint__audience">
                                <h4>{t('aiStudio.blueprint.audience')}</h4>
                                <p>{blueprint.targetAudience}</p>
                            </div>
                        </CardBody>
                    </Card>

                    <div className="ai-studio-blueprint__milestones">
                        <h3 className="ai-studio-blueprint__card-title">
                            <span className="material-symbols-outlined">flag</span>
                            {t('aiStudio.blueprint.milestones')}
                        </h3>
                        <div className="ai-studio-blueprint__milestone-list">
                            {blueprint.milestones.map((ms, idx) => (
                                <div key={idx} className="ai-studio-blueprint__milestone">
                                    <span className="ai-studio-blueprint__milestone-dot" aria-hidden="true" />
                                    <div className="ai-studio-blueprint__milestone-body">
                                        <h4>{ms.title}</h4>
                                        <p>{ms.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ai-studio-blueprint__aside">
                    <Card className="ai-studio-blueprint__card ai-studio-blueprint__card--backlog">
                        <CardBody className="ai-studio-blueprint__card-body">
                            <div className="ai-studio-blueprint__section-label">
                                {t('aiStudio.blueprint.backlog')}
                            </div>
                            <div className="ai-studio-blueprint__task-list">
                                {blueprint.initialTasks.map((task, idx) => (
                                    <div key={idx} className="ai-studio-blueprint__task">
                                        <span className={`ai-studio-priority-dot ai-studio-priority-dot--${getPriorityClass(task.priority)}`} />
                                        <span className="ai-studio-blueprint__task-title">{task.title}</span>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>

                    {blueprint.suggestedTechStack && (
                        <Card className="ai-studio-blueprint__card">
                            <CardBody className="ai-studio-blueprint__card-body">
                                <div className="ai-studio-blueprint__section-label">
                                    {t('aiStudio.blueprint.stack')}
                                </div>
                                <div className="ai-studio-blueprint__stack">
                                    {blueprint.suggestedTechStack.map((tech, idx) => (
                                        <Badge key={idx} variant="neutral" className="ai-studio-blueprint__stack-tag">
                                            {tech}
                                        </Badge>
                                    ))}
                                </div>
                            </CardBody>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
