import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProjectById } from '../services/dataService';
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

    return (
        <div className="project-details animate-fade-up">
            <div className="project-details__header">
                <Badge variant="neutral" className="project-details__pill">{t('projectDetails.pill')}</Badge>
                <h1 className="project-details__title">{t('projectDetails.title')}</h1>
                <p className="project-details__subtitle">{t('projectDetails.subtitle')}</p>
            </div>

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
