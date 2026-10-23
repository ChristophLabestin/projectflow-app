// Flow editor (/flows/new, /flows/:flowId): vertical step builder Wenn → Falls → Dann, preview,
// dry run and (package 3) run log. Concept: brain/plans/flows-concept.md §4.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useLanguage } from '../../context/LanguageContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { Button } from '../../components/common/Button/Button';
import { Select } from '../../components/common/Select/Select';
import { TextInput } from '../../components/common/Input/TextInput';
import { Checkbox } from '../../components/common/Checkbox/Checkbox';
import { EmptyState } from '../../components/common/EmptyState/EmptyState';
import { Skeleton } from '../../components/common/Skeleton/Skeleton';
import { SettingsSwitch } from '../../components/settings/SettingsSwitch';
import {
    ActionEditor,
    ConditionsEditor,
    TriggerEditor,
    availableActions,
    defaultActionConfig,
    type FlowEditorOptions,
} from '../../components/flows/FlowStepEditors';
import { FlowPreviewPanel } from '../../components/flows/FlowPreviewPanel';
import { FlowTemplateGallery } from '../../components/flows/FlowTemplateGallery';
import { FlowRunLog } from '../../components/flows/FlowRunLog';
import {
    ACTION_ICONS,
    TASKLESS_TRIGGERS,
    TRIGGER_ICONS,
    actionSentence,
    triggerSentence,
    validateFlow,
} from '../../components/flows/flowText';
import { getFlowTemplate } from '../../config/flowTemplates';
import {
    deleteFlow,
    flowErrorMessage,
    runFlow,
    saveFlow,
    setFlowEnabled,
    subscribeFlow,
    type Flow,
    type FlowAction,
    type FlowDefinition,
} from '../../services/domain/automationsService';
import { useFlowContext } from './useFlowContext';
import './flows.scss';

const emptyDraft = (projectId: string | null): FlowDefinition => ({
    name: '',
    description: '',
    scope: projectId ? 'project' : 'workspace',
    projectId,
    enabled: true,
    trigger: { type: 'task.created', config: {} },
    conditions: { op: 'and', groups: [] },
    actions: [],
    allowAutomationTrigger: false,
    templateId: null,
});

const toDefinition = (flow: Flow): FlowDefinition => ({
    name: flow.name,
    description: flow.description,
    scope: flow.scope,
    projectId: flow.projectId,
    enabled: flow.enabled,
    trigger: flow.trigger,
    conditions: flow.conditions,
    actions: flow.actions,
    allowAutomationTrigger: flow.allowAutomationTrigger,
    order: flow.order,
    templateId: flow.templateId,
});

const nextActionId = (actions: FlowAction[]) => {
    let index = actions.length + 1;
    while (actions.some((action) => action.id === `a${index}`)) index++;
    return `a${index}`;
};

const StepCard: React.FC<{
    kind: 'when' | 'if' | 'then';
    icon: string;
    title: string;
    summary: string;
    t: (key: string) => string;
    actions?: React.ReactNode;
    children: React.ReactNode;
}> = ({ kind, icon, title, summary, t, actions, children }) => (
    <section className={`flow-step flow-step--${kind}`}>
        <header className="flow-step__header">
            <span className="flow-step__kind">{t(`flows.step.${kind}`)}</span>
            <span className="flow-step__icon material-symbols-outlined" aria-hidden="true">{icon}</span>
            <div className="flow-step__titles">
                <h3>{title}</h3>
                <p>{summary}</p>
            </div>
            {actions && <div className="flow-step__actions">{actions}</div>}
        </header>
        <div className="flow-step__body">{children}</div>
    </section>
);

const FlowEditorView = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { flowId } = useParams<{ flowId: string }>();
    const [searchParams] = useSearchParams();
    const isNew = !flowId;
    const ctx = useFlowContext();
    const { tenantId, names, projects, members, canManage, isAdmin } = ctx;

    const [flow, setFlow] = useState<Flow | null | undefined>(isNew ? null : undefined);
    const [draft, setDraft] = useState<FlowDefinition | null>(null);
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sideTab, setSideTab] = useState<'preview' | 'log'>(searchParams.get('tab') === 'log' ? 'log' : 'preview');
    const [pickedTemplate, setPickedTemplate] = useState(Boolean(searchParams.get('template')) || searchParams.get('blank') === '1');

    // New flow: from template (?template=…&projectId=…) or blank.
    useEffect(() => {
        if (!isNew || draft) return;
        const projectId = searchParams.get('projectId');
        const template = getFlowTemplate(searchParams.get('template'));
        if (!pickedTemplate) return;
        if (template) {
            setDraft({
                ...template.build(projectId, t),
                name: t(`flows.templates.${template.id}.title`),
                description: t(`flows.templates.${template.id}.description`),
                templateId: template.id,
            });
        } else {
            setDraft(emptyDraft(projectId));
        }
    }, [isNew, draft, searchParams, pickedTemplate, t]);

    // Existing flow: live doc; the draft is taken once (and again after saving).
    useEffect(() => {
        if (isNew || !tenantId || !flowId) return undefined;
        return subscribeFlow(tenantId, flowId, (next) => {
            setFlow(next);
            setDraft((current) => current || (next ? toDefinition(next) : null));
        }, () => setFlow(null));
    }, [isNew, tenantId, flowId]);

    const update = useCallback((patch: Partial<FlowDefinition>) => {
        setDraft((current) => (current ? { ...current, ...patch } : current));
        setDirty(true);
        setError(null);
    }, []);

    const backTo = searchParams.get('back') || (draft?.scope === 'project' && draft.projectId ? `/project/${draft.projectId}/flows` : '/flows');

    const opts: FlowEditorOptions = useMemo(() => ({
        t,
        members,
        projects,
        workspaceScope: draft?.scope !== 'project',
    }), [t, members, projects, draft?.scope]);

    const validate = useCallback(() => (draft ? validateFlow(draft) : 'flows.error.name'), [draft]);

    if (ctx.isGuest) {
        return <EmptyState title={t('flows.noAccess')} icon={<span className="material-symbols-outlined">lock</span>} />;
    }
    if (!tenantId || flow === undefined || (!isNew && !draft && flow)) {
        return <div className="flows-page"><Skeleton className="flows-skeleton" /></div>;
    }
    if (!isNew && flow === null) {
        return (
            <div className="flows-page">
                <EmptyState title={t('flows.notFound')} icon={<span className="material-symbols-outlined">search_off</span>}
                    actions={<Link to="/flows"><Button variant="secondary">{t('flows.backToList')}</Button></Link>} />
            </div>
        );
    }

    if (isNew && !draft) {
        return (
            <div className="flows-page">
                <div className="flows-page__content">
                    <header className="flows-page__header">
                        <div>
                            <Link to={backTo} className="flows-back"><span className="material-symbols-outlined">arrow_back</span>{t('flows.backToList')}</Link>
                            <h1>{t('flows.new')}</h1>
                            <p>{t('flows.templates.subtitle')}</p>
                        </div>
                    </header>
                    <FlowTemplateGallery t={t} onPick={(templateId) => {
                        const params = new URLSearchParams(searchParams);
                        if (templateId) params.set('template', templateId);
                        else params.set('blank', '1');
                        navigate(`/flows/new?${params.toString()}`, { replace: true });
                        setPickedTemplate(true);
                    }} />
                </div>
            </div>
        );
    }

    if (!draft) return null;
    const editable = canManage(draft.scope);
    const taskless = TASKLESS_TRIGGERS.has(draft.trigger.type);

    const save = async () => {
        const invalid = validateFlow(draft);
        if (invalid) {
            setError(t(invalid));
            return;
        }
        setSaving(true);
        try {
            const result = await saveFlow(tenantId, draft, flowId || null);
            setDirty(false);
            showSuccess(t('flows.saved'));
            if (isNew) navigate(`/flows/${result.id}`, { replace: true });
        } catch (err) {
            setError(flowErrorMessage(err) || t('flows.error.save'));
        } finally {
            setSaving(false);
        }
    };

    const toggleEnabled = async (enabled: boolean) => {
        if (!flowId || dirty) {
            update({ enabled });
            return;
        }
        try {
            await setFlowEnabled(tenantId, flowId, enabled);
            setDraft({ ...draft, enabled });
        } catch (err) {
            showError(flowErrorMessage(err) || t('flows.error.save'));
        }
    };

    const remove = async () => {
        if (!flowId) return;
        const ok = await confirm({ title: t('flows.delete.title'), message: t('flows.delete.message'), confirmText: t('flows.delete.confirm'), variant: 'danger' });
        if (!ok) return;
        try {
            await deleteFlow(tenantId, flowId);
            navigate(backTo, { replace: true });
        } catch (err) {
            showError(flowErrorMessage(err) || t('flows.error.delete'));
        }
    };

    const runNow = async (target?: { taskId: string; projectId: string }) => {
        if (!flowId) return;
        setRunning(true);
        try {
            const result = await runFlow(tenantId, flowId, target);
            if (result.status === 'failed') showError(t('flows.run.failed'));
            else showSuccess(t('flows.run.done'));
            setSideTab('log');
        } catch (err) {
            showError(flowErrorMessage(err) || t('flows.run.failed'));
        } finally {
            setRunning(false);
        }
    };

    const setAction = (index: number, action: FlowAction | null) => {
        const actions = draft.actions.slice();
        if (action) actions[index] = action;
        else actions.splice(index, 1);
        update({ actions });
    };
    const moveAction = (index: number, delta: number) => {
        const actions = draft.actions.slice();
        const [item] = actions.splice(index, 1);
        actions.splice(index + delta, 0, item);
        update({ actions });
    };
    const addAction = (at: number) => {
        const type = availableActions(draft.trigger.type)[0];
        const actions = draft.actions.slice();
        actions.splice(at, 0, { id: nextActionId(actions), type, config: defaultActionConfig(type, null, t) });
        update({ actions });
    };

    const scopeOptions = [
        ...(isAdmin ? [{ value: '', label: t('flows.scope.workspace') }] : []),
        ...projects.map((project) => ({ value: project.id, label: project.title })),
    ];
    const conditionCount = draft.conditions.groups.reduce((sum, group) => sum + group.rules.length, 0);
    const canRunWithoutTask = !draft.actions.some((a) => ['set_field', 'assign', 'set_status', 'comment', 'add_label', 'remove_label', 'move', 'ai'].includes(a.type) || a.config?.asSubtask);

    return (
        <div className="flows-page flows-page--editor">
            <div className="flow-editor">
                <header className="flow-editor__header">
                    <Link to={backTo} className="flows-back"><span className="material-symbols-outlined">arrow_back</span>{t('flows.backToList')}</Link>
                    <div className="flow-editor__title-row">
                        <input
                            className="flow-editor__name"
                            value={draft.name}
                            placeholder={t('flows.namePlaceholder')}
                            aria-label={t('flows.name')}
                            disabled={!editable}
                            onChange={(e) => update({ name: e.target.value })}
                        />
                        <div className="flow-editor__toolbar">
                            <label className="flow-editor__switch">
                                <SettingsSwitch checked={draft.enabled} label={t('flows.enabled')} disabled={!editable} onChange={(v) => void toggleEnabled(v)} />
                                <span>{draft.enabled ? t('flows.state.active') : t('flows.state.off')}</span>
                            </label>
                            {!isNew && editable && canRunWithoutTask && (
                                <Button size="sm" variant="secondary" isLoading={running} onClick={() => void runNow()} disabled={dirty}
                                    icon={<span className="material-symbols-outlined">play_arrow</span>}>
                                    {t('flows.run.now')}
                                </Button>
                            )}
                            {!isNew && editable && (
                                <Button size="sm" variant="ghost" onClick={() => void remove()} aria-label={t('flows.delete.title')}
                                    icon={<span className="material-symbols-outlined">delete</span>} />
                            )}
                            {editable && (
                                <Button size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty && !isNew}>
                                    {isNew ? t('flows.create') : t('flows.save')}
                                </Button>
                            )}
                        </div>
                    </div>
                    {flow?.pausedReason && (
                        <div className="flow-banner flow-banner--warning" role="status">
                            <span className="material-symbols-outlined">pause_circle</span>
                            <span>{t(`flows.paused.${flow.pausedReason}`)}{flow.stats.lastError ? ` – ${flow.stats.lastError}` : ''}</span>
                        </div>
                    )}
                    {!editable && <div className="flow-banner" role="status">{t('flows.readOnly')}</div>}
                    {error && <div className="flow-banner flow-banner--error" role="alert">{error}</div>}
                </header>

                <div className="flow-editor__layout">
                    <div className={`flow-editor__steps ${editable ? '' : 'is-readonly'}`.trim()}>
                        <div className="flow-scope">
                            <span className="material-symbols-outlined" aria-hidden="true">{draft.scope === 'project' ? 'folder' : 'workspaces'}</span>
                            <Select
                                value={draft.projectId || ''}
                                options={scopeOptions}
                                placeholder={t('flows.project.pick')}
                                disabled={!editable}
                                onChange={(v) => update({ scope: v ? 'project' : 'workspace', projectId: v ? String(v) : null })}
                                className="flow-scope__select"
                            />
                            <span className="flow-hint">{t(draft.scope === 'project' ? 'flows.scope.projectHint' : 'flows.scope.workspaceHint')}</span>
                        </div>

                        <StepCard kind="when" t={t} icon={TRIGGER_ICONS[draft.trigger.type] || 'bolt'} title={t('flows.step.whenTitle')}
                            summary={triggerSentence(draft.trigger, t, names)}>
                            <TriggerEditor opts={opts} trigger={draft.trigger} onChange={(trigger) => update({ trigger })} />
                        </StepCard>

                        <div className="flow-connector" aria-hidden="true" />

                        <StepCard kind="if" t={t} icon="filter_alt" title={t('flows.step.ifTitle')}
                            summary={conditionCount ? t('flows.condition.count').replace('{count}', String(conditionCount)) : t('flows.condition.always')}>
                            <ConditionsEditor opts={opts} conditions={draft.conditions} taskless={taskless}
                                commentTrigger={draft.trigger.type === 'comment.created'} onChange={(conditions) => update({ conditions })} />
                        </StepCard>

                        {draft.actions.map((action, index) => (
                            <React.Fragment key={action.id}>
                                <div className="flow-connector" aria-hidden="true">
                                    {editable && (
                                        <button type="button" className="flow-connector__add" onClick={() => addAction(index)} aria-label={t('flows.step.insert')}>
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                    )}
                                </div>
                                <StepCard kind="then" t={t} icon={ACTION_ICONS[action.type] || 'bolt'} title={`${t('flows.step.thenTitle')} ${index + 1}`}
                                    summary={actionSentence(action, t, names)}
                                    actions={editable ? (
                                        <>
                                            <button type="button" className="flow-icon-button" disabled={index === 0} onClick={() => moveAction(index, -1)} aria-label={t('flows.step.up')}>
                                                <span className="material-symbols-outlined">arrow_upward</span>
                                            </button>
                                            <button type="button" className="flow-icon-button" disabled={index === draft.actions.length - 1} onClick={() => moveAction(index, 1)} aria-label={t('flows.step.down')}>
                                                <span className="material-symbols-outlined">arrow_downward</span>
                                            </button>
                                            <button type="button" className="flow-icon-button" onClick={() => setAction(index, null)} aria-label={t('flows.step.remove')}>
                                                <span className="material-symbols-outlined">delete</span>
                                            </button>
                                        </>
                                    ) : undefined}>
                                    <ActionEditor opts={opts} action={action} triggerType={draft.trigger.type} onChange={(next) => setAction(index, next)} />
                                </StepCard>
                            </React.Fragment>
                        ))}

                        <div className="flow-connector" aria-hidden="true" />
                        {editable && (
                            <button type="button" className="flow-add-step" onClick={() => addAction(draft.actions.length)}
                                disabled={draft.actions.length >= 10}>
                                <span className="material-symbols-outlined">add</span>
                                {draft.actions.length ? t('flows.step.add') : t('flows.step.addFirst')}
                            </button>
                        )}

                        <details className="flow-advanced">
                            <summary>{t('flows.advanced.title')}</summary>
                            <div className="flow-fields">
                                <div className="flow-field flow-field--wide">
                                    <TextInput label={t('flows.advanced.description')} value={draft.description}
                                        onChange={(e) => update({ description: e.target.value })} />
                                </div>
                                <Checkbox label={t('flows.advanced.chain')} checked={draft.allowAutomationTrigger}
                                    onChange={(e) => update({ allowAutomationTrigger: e.target.checked })} />
                                <p className="flow-hint">{t('flows.advanced.chainHint')}</p>
                            </div>
                        </details>
                    </div>

                    <aside className="flow-editor__side">
                        {!isNew && (
                            <div className="flow-tabs" role="tablist">
                                {(['preview', 'log'] as const).map((tab) => (
                                    <button key={tab} type="button" role="tab" aria-selected={sideTab === tab}
                                        className={`flow-tabs__tab ${sideTab === tab ? 'is-active' : ''}`.trim()} onClick={() => setSideTab(tab)}>
                                        {t(`flows.tab.${tab}`)}
                                    </button>
                                ))}
                            </div>
                        )}
                        {sideTab === 'log' && flowId && flow ? (
                            <FlowRunLog t={t} tenantId={tenantId} flow={flow} names={names} canRetry={editable} />
                        ) : (
                            <FlowPreviewPanel t={t} tenantId={tenantId} draft={draft} names={names} validate={validate}
                                onRunOnTask={!isNew && editable && !dirty ? (target) => void runNow(target) : undefined} />
                        )}
                    </aside>
                </div>
            </div>
        </div>
    );
};

/** Keyed by flow id so switching between flows starts with a fresh draft. */
export const FlowEditor = () => {
    const { flowId } = useParams<{ flowId: string }>();
    return <FlowEditorView key={flowId || 'new'} />;
};

export default FlowEditor;
