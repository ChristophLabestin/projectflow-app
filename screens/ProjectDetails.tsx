import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProjectById } from '../services/dataService';
import { Project } from '../types';
import { useLanguage } from '../context/LanguageContext';

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
            <div className="flex justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-3xl text-gray-400">progress_activity</span>
            </div>
        );
    }

    if (!project) {
        return <div className="p-4">{t('projectDetails.notFound')}</div>;
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
        <div className="max-w-[900px] mx-auto flex flex-col gap-6 animate-fade-up">
            <div>
                <span className="app-pill w-fit">{t('projectDetails.pill')}</span>
                <h1 className="text-2xl font-display font-bold text-ink">{t('projectDetails.title')}</h1>
                <p className="text-muted text-sm">{t('projectDetails.subtitle')}</p>
            </div>

            <div className="app-card p-6 space-y-5">
                <DetailRow label={t('projectDetails.fields.title')} value={project.title} />
                <DetailRow label={t('projectDetails.fields.description')} value={project.description || t('projectDetails.notSet')} />
                <DetailRow label={t('projectDetails.fields.status')} value={(project.status && statusLabels[project.status]) || project.status || t('projectDetails.unknown')} />
                <DetailRow label={t('projectDetails.fields.priority')} value={(project.priority && priorityLabels[project.priority]) || project.priority || t('tasks.priority.medium')} />
                <DetailRow label={t('projectDetails.fields.startDate')} value={project.startDate || t('projectDetails.notSet')} />
                <DetailRow label={t('projectDetails.fields.dueDate')} value={project.dueDate || t('projectDetails.notSet')} />
            </div>
        </div>
    );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-start justify-between gap-4">
        <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white text-right max-w-[60%] break-words">{value}</span>
    </div>
);
