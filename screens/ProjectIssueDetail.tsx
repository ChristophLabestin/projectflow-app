import React, { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { getProjectById, subscribeProjectIssues, updateIssue, deleteIssue, addTask, getIssueById, getUserProfile, subscribeTenantUsers } from '../services/dataService';
import { Issue, Project } from '../types';
import { usePinnedTasks } from '../context/PinnedTasksContext';
import { CommentSection } from '../components/CommentSection';
import { MultiAssigneeSelector } from '../components/MultiAssigneeSelector';
import { fetchCommitsReferencingIssue, GithubCommit } from '../services/githubService';
import { toMillis, timeAgo } from '../utils/time';
import { auth } from '../services/firebase';
import { EditIssueModal } from '../components/EditIssueModal';
import { format } from 'date-fns';
import { useLanguage } from '../context/LanguageContext';
import { Badge } from '../components/common/Badge/Badge';
import { Button } from '../components/common/Button/Button';
import { Card } from '../components/common/Card/Card';
import { Modal } from '../components/common/Modal/Modal';
import { ConfirmModal } from '../components/common/Modal/ConfirmModal';
import { Select, type SelectOption } from '../components/common/Select/Select';

export const ProjectIssueDetail = () => {
    const { id, issueId } = useParams<{ id: string; issueId: string }>();
    const { dateFormat, dateLocale, t } = useLanguage();
    const navigate = useNavigate();
    const [issue, setIssue] = useState<Issue | null>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [convertLoading, setConvertLoading] = useState(false);
    const [relatedCommits, setRelatedCommits] = useState<GithubCommit[]>([]);
    const [loadingCommits, setLoadingCommits] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [commentCount, setCommentCount] = useState(0);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [copiedId, setCopiedId] = useState(false);

    const priorityLabels = useMemo(() => ({
        Low: t('tasks.priority.low'),
        Medium: t('tasks.priority.medium'),
        High: t('tasks.priority.high'),
        Urgent: t('tasks.priority.urgent'),
    }), [t]);

    const statusLabels = useMemo(() => ({
        Open: t('projectIssues.status.open'),
        'In Progress': t('projectIssues.status.inProgress'),
        Resolved: t('projectIssues.status.resolved'),
        Closed: t('projectIssues.status.closed'),
    }), [t]);

    const statusOptions = useMemo<SelectOption[]>(() => ([
        { value: 'Open', label: statusLabels.Open },
        { value: 'In Progress', label: statusLabels['In Progress'] },
        { value: 'Resolved', label: statusLabels.Resolved },
        { value: 'Closed', label: statusLabels.Closed },
    ]), [statusLabels]);

    const isProjectOwner = useMemo(() => {
        return project?.ownerId === auth.currentUser?.uid;
    }, [project?.ownerId]);

    const { setTaskTitle } = useOutletContext<{ setTaskTitle: (title: string) => void }>();

    const loadIssue = async () => {
        if (!id || !issueId) return;
        try {
            const proj = await getProjectById(id);
            setProject(proj);
            const tId = proj?.tenantId;
            const directIssue = await getIssueById(issueId, id, tId);
            if (directIssue) {
                setIssue(directIssue);
                setLoading(false);
            }
        } catch (err) {
            console.error("Failed to load issue", err);
        }
    };

    useEffect(() => {
        if (!id || !issueId) return;

        let mounted = true;
        let unsub: (() => void) | undefined;

        const load = async () => {
            try {
                // First get the project to find the correct tenant
                const proj = await getProjectById(id);
                if (!mounted) return;
                setProject(proj);

                const tId = proj?.tenantId;

                // Subscribe to issues with the correct tenant
                unsub = subscribeProjectIssues(id, (issues) => {
                    if (!mounted) return;
                    const found = issues.find(i => i.id === issueId);
                    setIssue(found || null);
                    setLoading(false);
                }, tId);

                // Fallback: if subscription doesn't find it immediately (e.g. cold start), try direct fetch
                if (!issue) {
                    const directIssue = await getIssueById(issueId, id, tId);
                    if (mounted && directIssue) {
                        setIssue(directIssue);
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error("Failed to load issue detail", err);
                if (mounted) setLoading(false);
            }
        };

        load();

        return () => {
            mounted = false;
            if (unsub) unsub();
        };
    }, [id, issueId]);

    useEffect(() => {
        if (issue) {
            setTaskTitle(issue.title);
        }
    }, [issue, setTaskTitle]);

    useEffect(() => {
        if (!project?.tenantId) return;
        const unsub = subscribeTenantUsers((users) => {
            setAllUsers(users);
        }, project.tenantId);
        return () => unsub();
    }, [project?.tenantId]);

    useEffect(() => {
        if (issue?.githubIssueNumber && project?.githubRepo) {
            const fetchCommits = async () => {
                setLoadingCommits(true);
                try {
                    const user = auth.currentUser;
                    let token = project.githubToken;
                    if (!token && user?.uid) {
                        const profile = await getUserProfile(user.uid, project.tenantId);
                        token = profile?.githubToken;
                    }

                    const commits = await fetchCommitsReferencingIssue(
                        project.githubRepo!,
                        token,
                        issue.githubIssueNumber!
                    );
                    setRelatedCommits(commits);
                } catch (err) {
                    console.error("Failed to fetch related commits", err);
                } finally {
                    setLoadingCommits(false);
                }
            };
            fetchCommits();
        }
    }, [issue?.githubIssueNumber, project?.githubRepo]);

    const handleUpdateStatus = async (newStatus: Issue['status']) => {
        if (!issue || !id) return;
        await updateIssue(issue.id, { status: newStatus }, id, project?.tenantId);
    };

    const handleUpdateField = async (field: keyof Issue, value: any) => {
        if (!issue || !id) return;
        await updateIssue(issue.id, { [field]: value }, id, project?.tenantId);
    };

    const handleUpdateAssignees = async (ids: string[]) => {
        if (!issue || !id) return;
        const primaryId = ids.length > 0 ? ids[0] : '';
        await updateIssue(issue.id, { assigneeIds: ids, assigneeId: primaryId }, id, project?.tenantId);
    };

    const handleDelete = async () => {
        if (!issue || !id) return;
        setDeleting(true);
        try {
            await deleteIssue(issue.id, id, project?.tenantId);
            navigate(`/project/${id}/issues`);
        } catch (err) {
            console.error('Failed to delete issue', err);
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleConvertToTask = async () => {
        if (!issue || !id) return;
        setConvertLoading(true);
        try {
            const taskId = await addTask(
                id,
                issue.title,
                undefined,
                issue.assignee,
                issue.priority,
                {
                    description: `[From Issue] ${issue.description}`,
                    status: 'Open',
                    assigneeId: issue.assigneeId,
                    assigneeIds: issue.assigneeIds,
                    linkedIssueId: issue.id
                },
                project?.tenantId
            );

            await updateIssue(issue.id, {
                status: 'Closed',
                linkedTaskId: taskId
            }, id, project?.tenantId);

            navigate(`/project/${id}/tasks`);
        } catch (e) {
            console.error(e);
        } finally {
            setConvertLoading(false);
            setShowConvertModal(false);
        }
    };

    const { pinItem, unpinItem, isPinned } = usePinnedTasks();

    if (loading) {
        return (
            <div className="issue-detail__loading">
                <span className="material-symbols-outlined issue-detail__loading-icon">progress_activity</span>
            </div>
        );
    }

    if (!issue) {
        return (
            <div className="issue-detail__empty">
                <h3 className="issue-detail__empty-title">{t('issueDetail.notFound.title')}</h3>
                <Button variant="secondary" onClick={() => navigate(`/project/${id}/issues`)}>
                    {t('issueDetail.notFound.action')}
                </Button>
            </div>
        );
    }

    const statusValue = issue.status || 'Open';
    const priorityValue = issue.priority || 'Medium';
    const statusKey = statusValue.toLowerCase().replace(' ', '-');
    const priorityKey = priorityValue.toLowerCase();
    const statusLabel = statusLabels[statusValue] || statusValue;
    const priorityLabel = priorityLabels[priorityValue] || priorityValue;
    const assigneeIds = issue.assigneeIds || (issue.assigneeId ? [issue.assigneeId] : []);
    const reporter = issue.ownerId
        ? allUsers.find(u => (u as any).id === issue.ownerId || u.uid === issue.ownerId)
        : null;

    return (
        <div className="issue-detail">
            {isEditModalOpen && issue && (
                <EditIssueModal
                    issue={issue}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onUpdate={loadIssue}
                />
            )}

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title={t('issueDetail.confirm.delete.title')}
                message={t('issueDetail.confirm.delete.message').replace('{title}', issue.title)}
                confirmLabel={t('issueDetail.confirm.delete.confirm')}
                cancelLabel={t('common.cancel')}
                variant="danger"
                isLoading={deleting}
            />

            {showConvertModal && (
                <Modal
                    isOpen={showConvertModal}
                    onClose={() => setShowConvertModal(false)}
                    size="md"
                    title={t('issueDetail.convert.title')}
                >
                    <div className="issue-detail__convert">
                        <p className="issue-detail__convert-description">{t('issueDetail.convert.description')}</p>
                        <div className="issue-detail__convert-card">
                            <p className="issue-detail__convert-title">{issue.title}</p>
                            <div className="issue-detail__convert-meta">
                                <span className="material-symbols-outlined">group</span>
                                {assigneeIds.length > 0
                                    ? t('issueDetail.convert.assignees').replace('{count}', String(assigneeIds.length))
                                    : t('issueDetail.convert.assigneeFallback').replace('{name}', issue.assignee || t('assignees.unassigned'))}
                            </div>
                        </div>
                        <div className="issue-detail__convert-actions">
                            <Button variant="ghost" onClick={() => setShowConvertModal(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleConvertToTask} isLoading={convertLoading}>
                                {t('issueDetail.convert.action')}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            <header className="issue-detail__hero">
                <div className="issue-detail__hero-glow" />
                <div className="issue-detail__hero-content">
                    <div className="issue-detail__hero-layout">
                        <div className="issue-detail__hero-main">
                            <div className="issue-detail__badges">
                                {project && (
                                    <Link to={`/project/${project.id}`} className="issue-detail__project-link">
                                        <span className="issue-detail__project-dot" />
                                        <span className="issue-detail__project-text">{project.title}</span>
                                        <span className="material-symbols-outlined issue-detail__project-icon">arrow_forward</span>
                                    </Link>
                                )}
                                <span className="issue-detail__status-pill" data-status={statusKey}>
                                    <span className="material-symbols-outlined issue-detail__status-icon">
                                        {getIssueStatusIcon(statusValue)}
                                    </span>
                                    {statusLabel}
                                </span>
                                <span className="issue-detail__priority-pill" data-priority={priorityKey}>
                                    <span className="material-symbols-outlined issue-detail__priority-icon">
                                        {getIssuePriorityIcon(priorityValue)}
                                    </span>
                                    {priorityLabel}
                                </span>
                            </div>

                            <h1 className="issue-detail__title">{issue.title}</h1>

                            <div className="issue-detail__meta-row">
                                <div className="issue-detail__meta-card">
                                    <span className="material-symbols-outlined issue-detail__meta-icon">calendar_today</span>
                                    <div className="issue-detail__meta-body">
                                        <span className="issue-detail__meta-label">{t('issueDetail.hero.reported')}</span>
                                        <span className="issue-detail__meta-value">
                                            {issue.createdAt ? format(new Date(toMillis(issue.createdAt)), dateFormat, { locale: dateLocale }) : '-'}
                                        </span>
                                    </div>
                                </div>
                                <div className="issue-detail__assignees">
                                    <span className="issue-detail__assignees-divider" />
                                    <div className="issue-detail__assignee-stack">
                                        {assigneeIds.filter(id => id).map((uid, i) => {
                                            const user = allUsers.find(u => (u as any).id === uid || u.uid === uid);
                                            return (
                                                <img
                                                    key={uid + i}
                                                    src={user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                                    alt=""
                                                    className="issue-detail__assignee"
                                                    title={user?.displayName || t('projectIssues.assignee.unknown')}
                                                />
                                            );
                                        })}
                                        {assigneeIds.length === 0 && (
                                            <div className="issue-detail__assignee issue-detail__assignee--placeholder">
                                                <span className="material-symbols-outlined">person</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="issue-detail__actions">
                            <div className="issue-detail__action-toolbar">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="issue-detail__action-button"
                                    data-state={isPinned(issue.id) ? 'pinned' : 'default'}
                                    onClick={() => {
                                        if (isPinned(issue.id)) {
                                            unpinItem(issue.id);
                                        } else {
                                            pinItem({
                                                id: issue.id,
                                                type: 'issue',
                                                title: issue.title,
                                                projectId: id!,
                                                priority: issue.priority,
                                            });
                                        }
                                    }}
                                    icon={<span className="material-symbols-outlined issue-detail__action-icon">push_pin</span>}
                                >
                                    {isPinned(issue.id) ? t('issueDetail.actions.pinned') : t('issueDetail.actions.pin')}
                                </Button>
                                <span className="issue-detail__action-divider" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="issue-detail__action-button"
                                    onClick={() => setIsEditModalOpen(true)}
                                    icon={<span className="material-symbols-outlined issue-detail__action-icon">edit</span>}
                                >
                                    {t('issueDetail.actions.edit')}
                                </Button>
                                <span className="issue-detail__action-divider" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="issue-detail__action-button issue-detail__action-button--danger"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    icon={<span className="material-symbols-outlined issue-detail__action-icon">delete</span>}
                                >
                                    {t('issueDetail.actions.delete')}
                                </Button>
                            </div>

                            <Button
                                variant="primary"
                                onClick={() => setShowConvertModal(true)}
                                size="lg"
                                className="issue-detail__convert-button"
                                icon={<span className="material-symbols-outlined">task_alt</span>}
                            >
                                {t('issueDetail.actions.convert')}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="issue-detail__layout">
                <div className="issue-detail__main">
                    <section className="issue-detail__section">
                        <h3 className="issue-detail__section-title">
                            <span className="material-symbols-outlined issue-detail__section-icon">description</span>
                            {t('issueDetail.section.description')}
                        </h3>
                        <Card className="issue-detail__card issue-detail__card--roomy">
                            {issue.description ? (
                                <div className="prose issue-detail__description-text">
                                    <p className="issue-detail__description-paragraph">{issue.description}</p>
                                </div>
                            ) : (
                                <p className="issue-detail__empty-text">{t('issueDetail.description.empty')}</p>
                            )}
                        </Card>
                    </section>

                    <section className="issue-detail__section">
                        <h3 className="issue-detail__section-title">
                            <span className="material-symbols-outlined issue-detail__section-icon">chat</span>
                            {t('issueDetail.section.discussion').replace('{count}', String(commentCount))}
                        </h3>
                        <Card className="issue-detail__card issue-detail__card--roomy">
                            <CommentSection
                                projectId={id!}
                                targetId={issueId!}
                                targetType="issue"
                                tenantId={project?.tenantId}
                                isProjectOwner={isProjectOwner}
                                targetTitle={issue?.title}
                                hideHeader={true}
                                onCountChange={setCommentCount}
                            />
                        </Card>
                    </section>
                </div>

                <aside className="issue-detail__sidebar">
                    {issue.githubIssueNumber && (
                        <Card className="issue-detail__card issue-detail__card--flush issue-detail__github-card">
                            <div className="issue-detail__github-header">
                                <div className="issue-detail__github-title">
                                    <span className="material-symbols-outlined">terminal</span>
                                    <span>{t('issueDetail.github.title')}</span>
                                </div>
                                <Badge variant="success" className="issue-detail__github-badge">
                                    {t('issueDetail.github.synced')}
                                </Badge>
                            </div>
                            <div className="issue-detail__github-body">
                                <div className="issue-detail__github-section">
                                    <p className="issue-detail__github-label">{t('issueDetail.github.linkedIssue')}</p>
                                    <a
                                        href={issue.githubIssueUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="issue-detail__github-link"
                                    >
                                        <div className="issue-detail__github-link-body">
                                            <div className="issue-detail__github-link-icon">
                                                <span className="material-symbols-outlined">open_in_new</span>
                                            </div>
                                            <div>
                                                <p className="issue-detail__github-link-title">{t('issueDetail.github.issueLabel').replace('{number}', String(issue.githubIssueNumber))}</p>
                                                <p className="issue-detail__github-link-subtitle">{t('issueDetail.github.view')}</p>
                                            </div>
                                        </div>
                                        <span className="material-symbols-outlined issue-detail__github-link-arrow">chevron_right</span>
                                    </a>
                                </div>

                                <div className="issue-detail__github-section">
                                    <div className="issue-detail__github-meta">
                                        <p className="issue-detail__github-label">{t('issueDetail.github.relatedCommits')}</p>
                                        <span className="issue-detail__github-count">
                                            {t('issueDetail.github.found').replace('{count}', String(relatedCommits.length))}
                                        </span>
                                    </div>

                                    {loadingCommits ? (
                                        <div className="issue-detail__github-loading">
                                            <span className="material-symbols-outlined">progress_activity</span>
                                            <span>{t('issueDetail.github.searching')}</span>
                                        </div>
                                    ) : relatedCommits.length > 0 ? (
                                        <div className="issue-detail__github-list">
                                            {relatedCommits.map(commit => (
                                                <a
                                                    key={commit.sha}
                                                    href={commit.html_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="issue-detail__github-item"
                                                >
                                                    <p className="issue-detail__github-item-title">{commit.commit.message}</p>
                                                    <div className="issue-detail__github-item-meta">
                                                        <div className="issue-detail__github-author">
                                                            {commit.author?.avatar_url && (
                                                                <img src={commit.author.avatar_url} className="issue-detail__github-avatar" alt="" />
                                                            )}
                                                            <span>@{commit.author?.login || t('issueDetail.github.unknown')}</span>
                                                        </div>
                                                        <div className="issue-detail__github-sha">
                                                            <span>{commit.sha.slice(0, 7)}</span>
                                                            <span>{timeAgo(commit.commit.author.date)}</span>
                                                        </div>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="issue-detail__github-empty">
                                            {t('issueDetail.github.empty')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    )}

                    <Card className="issue-detail__card">
                        <div className="issue-detail__card-header">
                            <span className="material-symbols-outlined issue-detail__card-icon">timelapse</span>
                            <span className="issue-detail__card-label">{t('issueDetail.sidebar.status')}</span>
                        </div>
                        <div className="issue-detail__card-body">
                            <Select
                                value={statusValue}
                                onChange={(value) => handleUpdateStatus(value as Issue['status'])}
                                options={statusOptions}
                                className="issue-detail__select"
                            />
                        </div>
                    </Card>

                    <Card className="issue-detail__card issue-detail__assignee-card">
                        <div className="issue-detail__card-header">
                            <span className="material-symbols-outlined issue-detail__card-icon">group</span>
                            <span className="issue-detail__card-label">{t('issueDetail.sidebar.assignees')}</span>
                        </div>
                        <div className="issue-detail__card-body">
                            <MultiAssigneeSelector
                                projectId={id!}
                                assigneeIds={assigneeIds}
                                onChange={handleUpdateAssignees}
                            />
                        </div>
                    </Card>

                    <Card className="issue-detail__card">
                        <div className="issue-detail__card-header">
                            <span className="material-symbols-outlined issue-detail__card-icon">flag</span>
                            <span className="issue-detail__card-label">{t('issueDetail.sidebar.priority')}</span>
                        </div>
                        <div className="issue-detail__card-body">
                            <div className="issue-detail__priority-list">
                                {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => {
                                    const isSelected = (issue.priority || 'Medium') === p;
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => handleUpdateField('priority', p)}
                                            className={`issue-detail__priority-option ${isSelected ? 'is-selected' : ''}`}
                                            data-priority={p.toLowerCase()}
                                        >
                                            <span className="issue-detail__priority-option-label">
                                                <span className="material-symbols-outlined issue-detail__priority-option-icon">{getIssuePriorityIcon(p)}</span>
                                                {priorityLabels[p]}
                                            </span>
                                            {isSelected && <span className="material-symbols-outlined issue-detail__priority-option-check">check</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>

                    <Card className="issue-detail__card issue-detail__card--roomy">
                        <h3 className="issue-detail__details-title">{t('issueDetail.details.title')}</h3>
                        <div className="issue-detail__details-body">
                            <div className="issue-detail__detail-row">
                                <span className="issue-detail__detail-label">{t('issueDetail.details.id')}</span>
                                <div className="issue-detail__detail-value">
                                    <button
                                        type="button"
                                        className="issue-detail__id-button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(issue.id);
                                            setCopiedId(true);
                                            setTimeout(() => setCopiedId(false), 2000);
                                        }}
                                    >
                                        <span className="issue-detail__id-text">{issue.id}</span>
                                        <span className="material-symbols-outlined issue-detail__id-icon">
                                            {copiedId ? 'check_circle' : 'content_copy'}
                                        </span>
                                    </button>
                                    {copiedId && (
                                        <span className="issue-detail__copy-toast">{t('issueDetail.details.copied')}</span>
                                    )}
                                </div>
                            </div>

                            <div className="issue-detail__detail-row">
                                <span className="issue-detail__detail-label">{t('issueDetail.details.reported')}</span>
                                <div className="issue-detail__detail-meta">
                                    <span className="issue-detail__detail-date">
                                        {issue.createdAt ? format(new Date(toMillis(issue.createdAt)), dateFormat, { locale: dateLocale }) : '-'}
                                    </span>
                                </div>
                            </div>

                            {issue.ownerId && (
                                <div className="issue-detail__detail-row">
                                    <span className="issue-detail__detail-label">{t('issueDetail.details.reporter')}</span>
                                    <div className="issue-detail__detail-user">
                                        <img
                                            src={reporter?.photoURL || 'https://www.gravatar.com/avatar/?d=mp'}
                                            className="issue-detail__detail-avatar"
                                            alt=""
                                        />
                                        <span className="issue-detail__detail-user-name">
                                            {reporter?.displayName || t('issueDetail.details.unknownUser')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="issue-detail__detail-row">
                                <span className="issue-detail__detail-label">{t('issueDetail.details.status')}</span>
                                <span className="issue-detail__detail-status" data-status={statusKey}>
                                    {statusLabel}
                                </span>
                            </div>

                            {issue.linkedTaskId && (
                                <div className="issue-detail__detail-row issue-detail__detail-row--stack">
                                    <span className="issue-detail__detail-label">{t('issueDetail.details.relatedTask')}</span>
                                    <Link to={`/project/${id}/tasks/${issue.linkedTaskId}`} className="issue-detail__detail-link">
                                        <span className="material-symbols-outlined issue-detail__detail-link-icon">task_alt</span>
                                        <span className="issue-detail__detail-link-text">{t('issueDetail.details.relatedTaskAction')}</span>
                                    </Link>
                                </div>
                            )}

                            {(issue.status === 'Resolved' || issue.status === 'Closed') && (issue.completedBy || issue.completedAt) && (
                                <div className="issue-detail__detail-row issue-detail__detail-row--stack">
                                    <span className="issue-detail__detail-label">{t('issueDetail.details.completed')}</span>
                                    <div className="issue-detail__detail-meta">
                                        {issue.completedAt && (
                                            <span className="issue-detail__detail-date">
                                                {format(new Date(toMillis(issue.completedAt)), dateFormat, { locale: dateLocale })}
                                            </span>
                                        )}
                                        {issue.completedBy && (
                                            <span className="issue-detail__detail-by">
                                                {t('issueDetail.details.by').replace('{name}', allUsers.find(u => (u as any).id === issue.completedBy || u.uid === issue.completedBy)?.displayName || t('issueDetail.details.unknownUser'))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
};

const getIssueStatusIcon = (status?: Issue['status']) => {
    if (status === 'Resolved' || status === 'Closed') return 'check_circle';
    if (status === 'In Progress') return 'sync';
    if (status === 'Open') return 'error_outline';
    return 'circle';
};

const getIssuePriorityIcon = (priority?: Issue['priority']) => {
    if (priority === 'Urgent') return 'error';
    if (priority === 'High') return 'keyboard_double_arrow_up';
    if (priority === 'Medium') return 'drag_handle';
    return 'keyboard_arrow_down';
};
