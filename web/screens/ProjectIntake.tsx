import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';

import type { Project, ProjectSubmission, ProjectSubmissionStatus } from '../types';
import { Button } from '../components/common/Button/Button';
import { ProjectIntakeModal } from '../components/ProjectIntakeModal';
import { getProjectById } from '../services/domain/projectsService';
import {
    convertSubmissionToTask,
    deleteProjectSubmission,
    getPublicProjectIntakeUrl,
    subscribeProjectSubmissions,
    updateProjectSubmissionStatus,
} from '../services/projectIntakeService';
import { getIntakeCategoryIcon } from '../utils/projectIntakeBuilder';
import { useLanguage } from '../context/LanguageContext';
import { useProjectPermissions } from '../hooks/useProjectPermissions';
import { useToast, useConfirm } from '../context/UIContext';

const STATUS_ORDER: ProjectSubmissionStatus[] = ['new', 'reviewed', 'accepted', 'archived'];

const statusToneClass = (status: ProjectSubmissionStatus) => {
    switch (status) {
        case 'new': return 'is-new';
        case 'reviewed': return 'is-reviewed';
        case 'accepted': return 'is-accepted';
        case 'archived': return 'is-archived';
        default: return 'is-neutral';
    }
};

export const ProjectIntake = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string | null) => void }>();
    const { t } = useLanguage();
    const { showSuccess, showError } = useToast();
    const confirm = useConfirm();

    const [project, setProject] = useState<Project | null>(null);
    const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | ProjectSubmissionStatus>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showConfig, setShowConfig] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const { can, hasPermission } = useProjectPermissions(project);
    const canManage = can('canManageTasks') || hasPermission('project.tasks.create');

    useEffect(() => {
        setTaskTitle(t('nav.intake'));
        return () => setTaskTitle(null);
    }, [setTaskTitle, t]);

    useEffect(() => {
        if (!id) return;
        let unsub = () => undefined as void;

        void getProjectById(id).then((nextProject) => {
            setProject(nextProject);
            if (!nextProject) {
                setLoading(false);
                return;
            }
            unsub = subscribeProjectSubmissions(
                nextProject.tenantId || '',
                id,
                (items) => {
                    setSubmissions(items);
                    setLoading(false);
                },
                () => setLoading(false),
            );
        }).catch((error) => {
            console.error('Failed to load intake project', error);
            setLoading(false);
        });

        return () => unsub();
    }, [id]);

    const tenantId = project?.tenantId || '';
    const intakeForm = project?.intakeForm;
    const intakeEnabled = intakeForm?.enabled === true;

    const categories = useMemo(() => {
        const map = new Map<string, string>();
        (intakeForm?.categories || []).forEach((category) => map.set(category.id, category.label));
        submissions.forEach((submission) => {
            if (!map.has(submission.categoryId)) map.set(submission.categoryId, submission.categoryLabel);
        });
        return Array.from(map.entries()).map(([catId, label]) => ({ id: catId, label }));
    }, [intakeForm?.categories, submissions]);

    const counts = useMemo(() => {
        const result: Record<string, number> = { all: submissions.length };
        STATUS_ORDER.forEach((status) => {
            result[status] = submissions.filter((submission) => submission.status === status).length;
        });
        return result;
    }, [submissions]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return submissions.filter((submission) => {
            if (statusFilter !== 'all' && submission.status !== statusFilter) return false;
            if (categoryFilter !== 'all' && submission.categoryId !== categoryFilter) return false;
            if (!term) return true;
            const haystack = [
                submission.title,
                submission.description,
                submission.submitter?.name,
                submission.submitter?.email,
                submission.submitter?.company,
                ...(submission.fields || []).map((field) => field.value),
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }, [submissions, statusFilter, categoryFilter, search]);

    const selected = useMemo(
        () => filtered.find((submission) => submission.id === selectedId)
            || submissions.find((submission) => submission.id === selectedId)
            || null,
        [filtered, submissions, selectedId],
    );

    const handleCopyLink = async () => {
        if (!intakeForm?.token) return;
        const url = getPublicProjectIntakeUrl(intakeForm.token);
        try {
            await navigator.clipboard.writeText(url);
            showSuccess(t('intake.inbox.linkCopied'));
        } catch {
            showError(url);
        }
    };

    const handleStatusChange = async (submission: ProjectSubmission, status: ProjectSubmissionStatus) => {
        if (!tenantId) return;
        setBusyId(submission.id);
        try {
            await updateProjectSubmissionStatus(tenantId, submission.projectId, submission.id, status);
        } catch (error) {
            console.error('Failed to update submission status', error);
            showError(t('intake.inbox.actionError'));
        } finally {
            setBusyId(null);
        }
    };

    const handleConvert = async (submission: ProjectSubmission) => {
        if (!tenantId) return;
        if (submission.linkedTaskId) {
            navigate(`/project/${submission.projectId}/tasks/${submission.linkedTaskId}`);
            return;
        }
        setBusyId(submission.id);
        try {
            const taskId = await convertSubmissionToTask(submission, tenantId);
            showSuccess(t('intake.inbox.convertedToTask'));
            if (taskId) navigate(`/project/${submission.projectId}/tasks/${taskId}`);
        } catch (error) {
            console.error('Failed to convert submission to task', error);
            showError(t('intake.inbox.actionError'));
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (submission: ProjectSubmission) => {
        if (!tenantId) return;
        const ok = await confirm({
            title: t('intake.inbox.deleteTitle'),
            message: t('intake.inbox.deleteMessage'),
            confirmText: t('common.delete'),
            variant: 'danger',
        });
        if (!ok) return;
        setBusyId(submission.id);
        try {
            await deleteProjectSubmission(tenantId, submission.projectId, submission.id);
            if (selectedId === submission.id) setSelectedId(null);
        } catch (error) {
            console.error('Failed to delete submission', error);
            showError(t('intake.inbox.actionError'));
        } finally {
            setBusyId(null);
        }
    };

    if (loading) {
        return (
            <div className="project-intake project-intake--loading">
                <span className="material-symbols-outlined project-intake__spinner">progress_activity</span>
            </div>
        );
    }

    return (
        <div className="project-intake">
            <header className="project-intake__header">
                <div className="project-intake__header-text">
                    <h1>{t('intake.inbox.title')}</h1>
                    <p>{t('intake.inbox.subtitle')}</p>
                </div>
                <div className="project-intake__header-actions">
                    <span className={`project-intake__status-pill ${intakeEnabled ? 'is-live' : 'is-off'}`}>
                        <span className="material-symbols-outlined">{intakeEnabled ? 'public' : 'lock'}</span>
                        {intakeEnabled ? t('intake.inbox.live') : t('intake.inbox.off')}
                    </span>
                    {intakeEnabled && intakeForm?.token && (
                        <Button variant="secondary" onClick={handleCopyLink}>
                            <span className="material-symbols-outlined">link</span>
                            {t('intake.inbox.shareLink')}
                        </Button>
                    )}
                    {canManage && (
                        <Button variant="primary" onClick={() => setShowConfig(true)}>
                            <span className="material-symbols-outlined">settings</span>
                            {t('intake.inbox.configure')}
                        </Button>
                    )}
                </div>
            </header>

            <div className="project-intake__toolbar">
                <div className="project-intake__status-tabs">
                    <button
                        type="button"
                        className={`project-intake__status-tab ${statusFilter === 'all' ? 'is-active' : ''}`}
                        onClick={() => setStatusFilter('all')}
                    >
                        {t('intake.status.all')} <span>{counts.all}</span>
                    </button>
                    {STATUS_ORDER.map((status) => (
                        <button
                            key={status}
                            type="button"
                            className={`project-intake__status-tab ${statusFilter === status ? 'is-active' : ''}`}
                            onClick={() => setStatusFilter(status)}
                        >
                            {t(`intake.status.${status}`)} <span>{counts[status] || 0}</span>
                        </button>
                    ))}
                </div>
                <div className="project-intake__search">
                    <span className="material-symbols-outlined">search</span>
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('intake.inbox.searchPlaceholder')}
                    />
                </div>
            </div>

            {categories.length > 1 && (
                <div className="project-intake__category-tabs">
                    <button
                        type="button"
                        className={`project-intake__category-chip ${categoryFilter === 'all' ? 'is-active' : ''}`}
                        onClick={() => setCategoryFilter('all')}
                    >
                        {t('intake.inbox.allCategories')}
                    </button>
                    {categories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            className={`project-intake__category-chip ${categoryFilter === category.id ? 'is-active' : ''}`}
                            onClick={() => setCategoryFilter(category.id)}
                        >
                            <span className="material-symbols-outlined">{getIntakeCategoryIcon(category.id)}</span>
                            {category.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="project-intake__body">
                <div className="project-intake__list">
                    {filtered.length === 0 ? (
                        <div className="project-intake__empty">
                            <span className="material-symbols-outlined">inbox</span>
                            <h2>{intakeEnabled ? t('intake.inbox.emptyTitle') : t('intake.inbox.disabledTitle')}</h2>
                            <p>{intakeEnabled ? t('intake.inbox.emptyHint') : t('intake.inbox.disabledHint')}</p>
                            {!intakeEnabled && canManage && (
                                <Button variant="primary" onClick={() => setShowConfig(true)}>
                                    {t('intake.inbox.enableCta')}
                                </Button>
                            )}
                        </div>
                    ) : (
                        filtered.map((submission) => (
                            <button
                                key={submission.id}
                                type="button"
                                className={`project-intake__card ${selectedId === submission.id ? 'is-selected' : ''}`}
                                onClick={() => setSelectedId(submission.id)}
                            >
                                <div className="project-intake__card-top">
                                    <span className="project-intake__card-category">
                                        <span className="material-symbols-outlined">{getIntakeCategoryIcon(submission.categoryId)}</span>
                                        {submission.categoryLabel}
                                    </span>
                                    <span className={`project-intake__badge ${statusToneClass(submission.status)}`}>
                                        {t(`intake.status.${submission.status}`)}
                                    </span>
                                </div>
                                <strong className="project-intake__card-title">{submission.title}</strong>
                                {submission.description && (
                                    <p className="project-intake__card-snippet">{submission.description}</p>
                                )}
                                <div className="project-intake__card-meta">
                                    {submission.submitter?.name && (
                                        <span><span className="material-symbols-outlined">person</span>{submission.submitter.name}</span>
                                    )}
                                    {(submission.attachments?.length || 0) > 0 && (
                                        <span><span className="material-symbols-outlined">attach_file</span>{submission.attachments?.length}</span>
                                    )}
                                    {submission.linkedTaskId && (
                                        <span className="project-intake__linked"><span className="material-symbols-outlined">task_alt</span>{t('intake.inbox.hasTask')}</span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>

                {selected && (
                    <aside className="project-intake__detail">
                        <div className="project-intake__detail-head">
                            <span className="project-intake__card-category">
                                <span className="material-symbols-outlined">{getIntakeCategoryIcon(selected.categoryId)}</span>
                                {selected.categoryLabel}
                            </span>
                            <button type="button" className="project-intake__detail-close" onClick={() => setSelectedId(null)}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <h2 className="project-intake__detail-title">{selected.title}</h2>

                        {selected.submitter && (selected.submitter.name || selected.submitter.email || selected.submitter.company) && (
                            <div className="project-intake__submitter">
                                {selected.submitter.name && <span><span className="material-symbols-outlined">person</span>{selected.submitter.name}</span>}
                                {selected.submitter.email && <a href={`mailto:${selected.submitter.email}`}><span className="material-symbols-outlined">mail</span>{selected.submitter.email}</a>}
                                {selected.submitter.company && <span><span className="material-symbols-outlined">apartment</span>{selected.submitter.company}</span>}
                            </div>
                        )}

                        <div className="project-intake__fields">
                            {(selected.fields || []).map((field) => (
                                <div key={field.fieldId} className="project-intake__field-row">
                                    <span className="project-intake__field-label">{field.label}</span>
                                    {field.type === 'url'
                                        ? <a href={field.value} target="_blank" rel="noreferrer noopener">{field.value}</a>
                                        : <p>{field.value}</p>}
                                </div>
                            ))}
                        </div>

                        {(selected.attachments?.length || 0) > 0 && (
                            <div className="project-intake__attachments-block">
                                <span className="project-intake__field-label">{t('intake.inbox.attachments')}</span>
                                <div className="project-intake__attachment-grid">
                                    {(selected.attachments || []).map((attachment) => (
                                        <a
                                            key={attachment.downloadUrl}
                                            href={attachment.downloadUrl}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            className="project-intake__attachment"
                                        >
                                            {attachment.mimeType.startsWith('image/')
                                                ? <img src={attachment.downloadUrl} alt={attachment.fileName} />
                                                : <span className="material-symbols-outlined">description</span>}
                                            <span className="project-intake__attachment-name">{attachment.fileName}</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {canManage && (
                            <div className="project-intake__detail-actions">
                                <div className="project-intake__status-select">
                                    <label>{t('intake.inbox.statusLabel')}</label>
                                    <select
                                        value={selected.status}
                                        disabled={busyId === selected.id}
                                        onChange={(event) => handleStatusChange(selected, event.target.value as ProjectSubmissionStatus)}
                                    >
                                        {STATUS_ORDER.map((status) => (
                                            <option key={status} value={status}>{t(`intake.status.${status}`)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="project-intake__action-buttons">
                                    <Button
                                        variant="primary"
                                        onClick={() => handleConvert(selected)}
                                        isLoading={busyId === selected.id}
                                    >
                                        <span className="material-symbols-outlined">{selected.linkedTaskId ? 'open_in_new' : 'add_task'}</span>
                                        {selected.linkedTaskId ? t('intake.inbox.openTask') : t('intake.inbox.convertToTask')}
                                    </Button>
                                    <Button variant="ghost" onClick={() => handleDelete(selected)}>
                                        <span className="material-symbols-outlined">delete</span>
                                        {t('common.delete')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </aside>
                )}
            </div>

            {showConfig && project && (
                <ProjectIntakeModal
                    isOpen={showConfig}
                    onClose={() => setShowConfig(false)}
                    project={project}
                    onSaved={(updated) => setProject((current) => (current ? { ...current, intakeForm: updated } : current))}
                />
            )}
        </div>
    );
};
