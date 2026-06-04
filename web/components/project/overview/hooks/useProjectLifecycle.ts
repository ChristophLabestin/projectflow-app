import { useState } from 'react';
import type { Project, ProjectStatus } from '../../../../types';
import { updateProjectFields } from '../../../../services/domain/projectAdminService';
import { auth } from '../../../../services/firebase';
import type { ConfirmationRequest } from '../../../../context/UIContext';

const PAUSED: ProjectStatus = 'On Hold';
const CANCELED: ProjectStatus = 'Canceled';
const COMPLETED: ProjectStatus = 'Completed';

type ConfirmFn = (title: string | ConfirmationRequest, message?: string) => Promise<boolean>;

const resolveResumeStatus = (status?: ProjectStatus): ProjectStatus => {
    if (status && status !== PAUSED && status !== CANCELED) return status;
    return 'Active';
};

export type ProjectLifecycle = {
    busy: boolean;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    cancel: () => Promise<void>;
    complete: () => Promise<void>;
};

/**
 * Lifecycle transitions (pause / resume / cancel / complete) for the overview,
 * mirroring the legacy handlers. Cancel and complete are confirmed.
 */
export const useProjectLifecycle = (
    project: Project | null,
    setProject: React.Dispatch<React.SetStateAction<Project | null>>,
    confirm: ConfirmFn,
    t: (key: string, fallback?: string) => string
): ProjectLifecycle => {
    const [busy, setBusy] = useState(false);

    const apply = async (updates: Partial<Project>, action: string) => {
        if (!project) return;
        setBusy(true);
        try {
            await updateProjectFields(project.id, updates, { action, target: 'Project', type: 'status' }, project.tenantId);
            setProject((prev) => (prev ? { ...prev, ...updates } : prev));
        } catch (error) {
            console.error('Lifecycle transition failed:', error);
        } finally {
            setBusy(false);
        }
    };

    const pause = async () => {
        if (!project || project.status === PAUSED || project.status === CANCELED) return;
        const pausedAt = new Date().toISOString();
        await apply({
            status: PAUSED,
            pausedAt,
            pausedBy: auth.currentUser?.uid || '',
            pausedFromStatus: project.status,
            lastPauseStartedAt: pausedAt
        }, `Paused project "${project.title}"`);
    };

    const resume = async () => {
        if (!project || project.status !== PAUSED) return;
        await apply({
            status: resolveResumeStatus(project.pausedFromStatus),
            pausedAt: '',
            pausedBy: '',
            lastResumedAt: new Date().toISOString()
        }, `Resumed project "${project.title}"`);
    };

    const cancel = async () => {
        if (!project || project.status === CANCELED) return;
        const confirmed = await confirm({
            title: t('projectOverview.cancel.confirmTitle', 'Cancel project?'),
            message: t('projectOverview.cancel.confirmBody', 'This will cancel {project}.').replace('{project}', project.title),
            confirmText: t('projectOverview.cancel.confirm', 'Cancel project'),
            cancelText: t('common.cancel', 'Back'),
            variant: 'danger'
        });
        if (!confirmed) return;
        const canceledAt = new Date().toISOString();
        await apply({
            status: CANCELED,
            canceledAt,
            canceledBy: auth.currentUser?.uid || '',
            canceledFromStatus: project.status,
            lastCanceledAt: canceledAt,
            pausedAt: '',
            pausedBy: ''
        }, `Canceled project "${project.title}"`);
    };

    const complete = async () => {
        if (!project || project.status === COMPLETED) return;
        const confirmed = await confirm({
            title: t('projectOverview.v2.complete.confirmTitle', 'Mark project complete?'),
            message: t('projectOverview.v2.complete.confirmBody', 'This marks {project} as completed.').replace('{project}', project.title),
            confirmText: t('projectOverview.v2.complete.confirm', 'Complete'),
            cancelText: t('common.cancel', 'Back')
        });
        if (!confirmed) return;
        await apply({ status: COMPLETED }, `Completed project "${project.title}"`);
    };

    return { busy, pause, resume, cancel, complete };
};
