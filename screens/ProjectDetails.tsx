import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProjectById } from '../services/dataService';
import { Project } from '../types';

export const ProjectDetails = () => {
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
        return <div className="p-4">Project not found.</div>;
    }

    return (
        <div className="max-w-[900px] mx-auto flex flex-col gap-6 animate-fade-up">
            <div>
                <span className="app-pill w-fit">Details</span>
                <h1 className="text-2xl font-display font-bold text-ink">Project Details</h1>
                <p className="text-muted text-sm">Key metadata for this project.</p>
            </div>

            <div className="app-card p-6 space-y-5">
                <DetailRow label="Title" value={project.title} />
                <DetailRow label="Description" value={project.description || 'Not set'} />
                <DetailRow label="Status" value={project.status || 'Unknown'} />
                <DetailRow label="Priority" value={project.priority || 'Medium'} />
                <DetailRow label="Start Date" value={project.startDate || 'Not set'} />
                <DetailRow label="Due Date" value={project.dueDate || 'Not set'} />
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
