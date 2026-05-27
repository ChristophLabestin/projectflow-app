import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import '../src/styles/components/_project-details.scss';
import { getProjectById } from '../services/domain/projectsService';
import { Project } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { Badge } from '../components/common/Badge/Badge';
import { Card, CardBody } from '../components/common/Card/Card';

export const ProjectDetails = () => {
    const { t } = useLanguage();
    const { id } = useParams<{ id: string }>();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const p = await getProjectById(id);
                setProject(p);
            } catch (error) {
                console.error('Failed to load project details', error);
            } finally {
                setLoading(false);
            }
        })();
    }, [id]);

    if (loading) {
        return (
            <div className="project-details__loading">
                <span className="material-symbols-outlined project-details__loading-icon">progress_activity</span>
            </div>
        );
    }

    if (!project) {
        return <div className="project-details__empty">{t('projectDetails.notFound')}</div>;
    }

    const statusLabels: Record<string, string> = {
        Active: t('dashboard.projectStatus.active'),
        Completed: t('dashboard.projectStatus.completed'),
        Canceled: t('dashboard.projectStatus.canceled'),
        Planning: t('dashboard.projectStatus.planning'),
        'On Hold': t('dashboard.projectStatus.onHold'),
        Brainstorming: t('dashboard.projectStatus.brainstorming')
    };

    const priorityLabels: Record<string, string> = {
        Urgent: t('tasks.priority.urgent'),
        High: t('tasks.priority.high'),
        Medium: t('tasks.priority.medium'),
        Low: t('tasks.priority.low')
    };

    const memberCount = Array.isArray(project.members) ? project.members.length : 0;
    const moduleCount = project.modules?.length || 0;
    const summaryCards = useMemo(() => [
        {
            key: 'status',
            label: t('projectDetails.workbench.status'),
            value: (project.status && statusLabels[project.status]) || project.status || t('projectDetails.unknown')
        },
        {
            key: 'team',
            label: t('projectDetails.workbench.team'),
            value: `${memberCount}`
        },
        {
            key: 'modules',
            label: t('projectDetails.workbench.modules'),
            value: `${moduleCount}`
        }
    ], [memberCount, moduleCount, project.status, statusLabels, t]);

    return (
        <div className="project-details animate-fade-up">
            <div className="project-details__header">
                <Badge variant="neutral" className="project-details__pill">{t('projectDetails.pill')}</Badge>
                <h1 className="project-details__title">{t('projectDetails.title')}</h1>
                <p className="project-details__subtitle">{t('projectDetails.subtitle')}</p>
            </div>

            <div className="project-details__workbench">
                {summaryCards.map((card) => (
                    <Card key={card.key}>
                        <CardBody className="project-details__workbench-card">
                            <span className="project-details__workbench-label">{card.label}</span>
                            <span className="project-details__workbench-value">{card.value}</span>
                        </CardBody>
                    </Card>
                ))}
            </div>

            <Card>
                <CardBody className="project-details__actions">
                    <Link to={`/project/${project.id}`} className="project-details__action-link">
                        {t('projectDetails.actions.openProject')}
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                    <Link to="/team" className="project-details__action-link">
                        {t('projectDetails.actions.manageTeam')}
                        <span className="material-symbols-outlined">groups</span>
                    </Link>
                </CardBody>
            </Card>

            <Card>
                <CardBody className="project-details__list">
                    <DetailRow label={t('projectDetails.fields.title')} value={project.title} />
                    <DetailRow label={t('projectDetails.fields.description')} value={project.description || t('projectDetails.notSet')} />
                    <DetailRow label={t('projectDetails.fields.status')} value={(project.status && statusLabels[project.status]) || project.status || t('projectDetails.unknown')} />
                    <DetailRow label={t('projectDetails.fields.priority')} value={(project.priority && priorityLabels[project.priority]) || project.priority || t('tasks.priority.medium')} />
                    <DetailRow label={t('projectDetails.fields.startDate')} value={project.startDate || t('projectDetails.notSet')} />
                    <DetailRow label={t('projectDetails.fields.dueDate')} value={project.dueDate || t('projectDetails.notSet')} />
                </CardBody>
            </Card>
        </div>
    );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="detail-row">
        <span className="detail-row__label">{label}</span>
        <span className="detail-row__value">{value}</span>
    </div>
);
