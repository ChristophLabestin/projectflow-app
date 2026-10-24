// Flow editor (/flows/:flowId, /flows/new/edit) inside the Flows shell: tabs Aufbau / Testen / Protokoll,
// collapsible steps Wenn → Falls → Dann with tile pickers. Concept: brain/plans/flows-concept.md §4.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
    ActionPicker,
    ConditionsEditor,
    TriggerEditor,
    defaultActionConfig,
    type FlowEditorOptions,
} from '../../components/flows/FlowStepEditors';
import { FlowPreviewPanel } from '../../components/flows/FlowPreviewPanel';
import { FlowRunLog } from '../../components/flows/FlowRunLog';
import {
    ACTION_ICONS,
    TASKLESS_TRIGGERS,
    TASK_ACTIONS,
    TRIGGER_ICONS,
    actionSentence,
    triggerSentence,
    validateAction,
    validateFlow,
} from '../../components/flows/flowText';
import { getFlowTemplate } from '../../config/flowTemplates';
import { planErrorMessage } from '../../services/billingService';
import {
    deleteFlow,
    flowErrorMessage,
    runFlow,
    saveFlow,
    setFlowEnabled,
    subscribeFlow,
    type Flow,
    type FlowAction,
    type FlowActionType,
    type FlowDefinition,
} from '../../services/domain/automationsService';
import { useFlowsOutlet } from './FlowsLayout';

type Tab = 'build' | 'test' | 'log';

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

/** Collapsible step: the header reads as a sentence; click to edit. */
const StepCard: React.FC<{
    kind: 'when' | 'if' | 'then';
    icon: string;
    title: string;
    summary: string;
    open: boolean;
    onToggle: () => void;
    t: (key: string) => string;
    tools?: React.ReactNode;
    incomplete?: boolean;
    children: React.ReactNode;
}> = ({ kind, icon, title, summary, open, onToggle, t, tools, incomplete, children }) => (
    <section className={`flow-step flow-step--${kind} ${open ? 'is-open' : ''} ${incomplete ? 'is-incomplete' : ''}`.trim()}>
        <header className="flow-step__header">
            <button type="button" className="flow-step__toggle" aria-expanded={open} onClick={onToggle}>
                <span className="flow-step__kind">{t(`flows.step.${kind}`)}</span>
                <span className="flow-step__icon material-symbols-outlined" aria-hidden="true">{icon}</span>
                <span className="flow-step__titles">
                    <span className="flow-step__title">{title}</span>
                    <span className="flow-step__summary">{summary}</span>
                </span>
                {incomplete && <span className="flow-step__badge">{t('flows.step.incomplete')}</span>}
                <span className="flow-step__chevron material-symbols-outlined" aria-hidden="true">{open ? 'expand_less' : 'expand_more'}</span>
            </button>
            {tools && <div className="flow-step__actions">{tools}</div>}
        </header>
        {open && <div className="flow-step__body">{children}</div>}
    </section>
);

const FlowEditorView = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const confirm = useConfirm();
    const { showError, showSuccess } = useToast();
    const { flowId } = useParams<{ flowId: string }>();
    const [searchParams] = useSearchParams();
    const isNew = !flowId;
    const { ctx, flows } = useFlowsOutlet();
    const { tenantId, names, projects, members, canManage, isAdmin } = ctx;
    const navState = (location.state || null) as { draft?: FlowDefinition; warnings?: string[] } | null;

    const initialNewDraft = useMemo((): FlowDefinition | null => {
        if (!isNew) return null;
        if (navState?.draft) return navState.draft;
        const projectId = searchParams.get('projectId');
        const template = getFlowTemplate(searchParams.get('template'));
        if (template) {
            return {
                ...template.build(projectId, t),
                name: t(`flows.templates.${template.id}.title`),
                description: t(`flows.templates.${template.id}.description`),
                templateId: template.id,
            };
        }
        return searchParams.get('blank') === '1' ? emptyDraft(projectId) : null;
        // Only on mount: later edits live in `draft`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [flow, setFlow] = useState<Flow | null | undefined>(isNew ? null : undefined);
    const [draft, setDraft] = useState<FlowDefinition | null>(initialNewDraft);
    const [dirty, setDirty] = useState(isNew);
    const [saving, setSaving] = useState(false);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>((['build', 'test', 'log'].includes(searchParams.get('tab') || '') ? searchParams.get('tab') : 'build') as Tab);
    // Which step is open: 'trigger' | 'conditions' | action id. New blank flows start at the trigger.
    const [open, setOpen] = useState<string | null>(isNew && !initialNewDraft?.actions.length ? 'trigger' : null);
    const [pickerAt, setPickerAt] = useState<number | null>(null);
    const fromTextWarnings = isNew ? navState?.warnings || null : null;

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

    const opts: FlowEditorOptions = useMemo(() => ({
        t,
        members,
        projects,
        workspaceScope: draft?.scope !== 'project',
    }), [t, members, projects, draft?.scope]);

    const validate = useCallback(() => (draft ? validateFlow(draft) : 'flows.error.name'), [draft]);

    if (isNew && !draft) return <Navigate to={`/flows/new${location.search}`} replace />;
    if (!tenantId || flow === undefined || (!isNew && !draft && flow)) return <Skeleton className="flows-skeleton" />;
    if (!isNew && flow === null) {
        return (
            <EmptyState title={t('flows.notFound')} icon={<span className="material-symbols-outlined">search_off</span>}
                actions={<Link to="/flows"><Button variant="secondary">{t('flows.backToList')}</Button></Link>} />
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
            setError(planErrorMessage(err, t) || flowErrorMessage(err) || t('flows.error.save'));
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
            showError(planErrorMessage(err, t) || flowErrorMessage(err) || t('flows.error.save'));
        }
    };

    const remove = async () => {
        if (!flowId) return;
        const ok = await confirm({ title: t('flows.delete.title'), message: t('flows.delete.message'), confirmText: t('flows.delete.confirm'), variant: 'danger' });
        if (!ok) return;
        try {
            await deleteFlow(tenantId, flowId);
            navigate('/flows', { replace: true });
        } catch (err) {
            showError(planErrorMessage(err, t) || flowErrorMessage(err) || t('flows.error.delete'));
        }
    };

    const runNow = async (target?: { taskId: string; projectId: string }) => {
        if (!flowId) return;
        setRunning(true);
        try {
            const result = await runFlow(tenantId, flowId, target);
            if (result.status === 'failed') showError(t('flows.run.failed'));
            else showSuccess(t('flows.run.done'));
            setTab('log');
        } catch (err) {
            showError(planErrorMessage(err, t) || flowErrorMessage(err) || t('flows.run.failed'));
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
    const insertAction = (at: number, type: FlowActionType) => {
        const actions = draft.actions.slice();
        const id = nextActionId(actions);
        actions.splice(at, 0, { id, type, config: defaultActionConfig(type, null, t) });
        update({ actions });
        setPickerAt(null);
        setOpen(id);
    };

    const scopeOptions = [
        ...(isAdmin ? [{ value: '', label: t('flows.scope.workspace') }] : []),
        ...projects.map((project) => ({ value: project.id, label: project.title })),
    ];
    const conditionCount = draft.conditions.groups.reduce((sum, group) => sum + group.rules.length, 0);
    const canRunWithoutTask = !draft.actions.some((a) => TASK_ACTIONS.has(a.type) || a.config?.asSubtask);
    const actionProblem = (action: FlowAction) => validateAction(action, draft) !== null;
    const toggle = (key: string) => setOpen((current) => (current === key ? null : key));
    const sameNameCount = (flows || []).filter((f) => f.id !== flowId && f.name.trim().toLowerCase() === draft.name.trim().toLowerCase()).length;

    const picker = (at: number) => (
        <ActionPicker t={t} triggerType={draft.trigger.type} onPick={(type) => insertAction(at, type)} onCancel={() => setPickerAt(null)} />
    );

    return (
        <div className="flow-editor">
            <header className="flow-editor__header">
                <div className="flow-editor__crumbs">
                    <Link to={draft.scope === 'project' && draft.projectId ? `/project/${draft.projectId}/flows` : '/flows'}>{t('nav.flows')}</Link>
                    <span aria-hidden="true">/</span>
                    <span>{draft.scope === 'project' && draft.projectId ? names.project(draft.projectId) : t('flows.scope.workspace')}</span>
                </div>
                <div className="flow-editor__title-row">
                    <input
                        className="flow-editor__name"
                        value={draft.name}
                        placeholder={t('flows.namePlaceholder')}
                        aria-label={t('flows.name')}
                        disabled={!editable}
                        autoFocus={isNew && !draft.name}
                        onChange={(e) => update({ name: e.target.value })}
                    />
                    <div className="flow-editor__toolbar">
                        <label className={`flow-editor__switch ${draft.enabled ? 'is-on' : ''}`.trim()}>
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
                            <Button size="sm" variant="ghost" onClick={() => void remove()} aria-label={t('flows.delete.title')} title={t('flows.delete.title')}
                                icon={<span className="material-symbols-outlined">delete</span>} />
                        )}
                        {editable && (
                            <Button size="sm" onClick={() => void save()} isLoading={saving} disabled={!dirty}>
                                {isNew ? t('flows.create') : dirty ? t('flows.save') : t('flows.savedState')}
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
                {fromTextWarnings && (
                    <div className="flow-banner flow-banner--ai" role="status">
                        <span className="material-symbols-outlined">auto_awesome</span>
                        <span>
                            {t('flows.fromText.review')}
                            {fromTextWarnings.length > 0 && ` ${fromTextWarnings.map((warning) => t(`flows.fromText.warning.${warning}`)).join(' ')}`}
                        </span>
                    </div>
                )}
                {!editable && <div className="flow-banner" role="status">{t('flows.readOnly')}</div>}
                {sameNameCount > 0 && <div className="flow-banner" role="status">{t('flows.duplicateName')}</div>}
                {error && <div className="flow-banner flow-banner--error" role="alert">{error}</div>}
                <div className="flow-tabs" role="tablist">
                    {(['build', 'test', 'log'] as Tab[]).filter((key) => key !== 'log' || !isNew).map((key) => (
                        <button key={key} type="button" role="tab" aria-selected={tab === key}
                            className={`flow-tabs__tab ${tab === key ? 'is-active' : ''}`.trim()} onClick={() => setTab(key)}>
                            <span className="material-symbols-outlined" aria-hidden="true">{key === 'build' ? 'account_tree' : key === 'test' ? 'science' : 'history'}</span>
                            {t(`flows.tab.${key}`)}
                            {key === 'log' && flow?.stats.lastStatus === 'failed' && <span className="flow-tabs__alert" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            </header>

            {tab === 'build' && (
                <div className={`flow-editor__steps ${editable ? '' : 'is-readonly'}`.trim()}>
                    <div className="flow-scope">
                        <span className="flow-scope__label">{t('flows.scope.appliesTo')}</span>
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
                        summary={triggerSentence(draft.trigger, t, names)} open={open === 'trigger'} onToggle={() => toggle('trigger')}>
                        <TriggerEditor opts={opts} trigger={draft.trigger} onChange={(trigger) => update({ trigger })} />
                    </StepCard>

                    <div className="flow-connector" aria-hidden="true" />

                    <StepCard kind="if" t={t} icon="filter_alt" title={t('flows.step.ifTitle')}
                        summary={conditionCount ? t('flows.condition.count').replace('{count}', String(conditionCount)) : t('flows.condition.always')}
                        open={open === 'conditions'} onToggle={() => toggle('conditions')}>
                        <ConditionsEditor opts={opts} conditions={draft.conditions} taskless={taskless}
                            commentTrigger={draft.trigger.type === 'comment.created'} onChange={(conditions) => update({ conditions })} />
                    </StepCard>

                    {draft.actions.map((action, index) => (
                        <React.Fragment key={action.id}>
                            <div className="flow-connector" aria-hidden={pickerAt !== index}>
                                {editable && pickerAt !== index && draft.actions.length < 10 && (
                                    <button type="button" className="flow-connector__add" onClick={() => setPickerAt(index)} aria-label={t('flows.step.insert')}>
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                )}
                            </div>
                            {pickerAt === index && <>{picker(index)}<div className="flow-connector" aria-hidden="true" /></>}
                            <StepCard kind="then" t={t} icon={ACTION_ICONS[action.type] || 'bolt'}
                                title={`${t('flows.step.thenTitle')} ${index + 1} · ${t(`flows.action.${action.type}`)}`}
                                summary={actionSentence(action, t, names)} open={open === action.id} onToggle={() => toggle(action.id)}
                                incomplete={actionProblem(action)}
                                tools={editable ? (
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
                    {editable && draft.actions.length < 10 && (pickerAt === draft.actions.length || draft.actions.length === 0
                        ? picker(draft.actions.length)
                        : (
                            <button type="button" className="flow-add-step" onClick={() => setPickerAt(draft.actions.length)}>
                                <span className="material-symbols-outlined">add</span>
                                {t('flows.step.add')}
                            </button>
                        ))}

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
            )}

            {tab === 'test' && (
                <FlowPreviewPanel t={t} tenantId={tenantId} draft={draft} names={names} validate={validate}
                    onRunOnTask={!isNew && editable && !dirty ? (target) => void runNow(target) : undefined} />
            )}

            {tab === 'log' && flowId && flow && (
                <FlowRunLog t={t} tenantId={tenantId} flow={flow} names={names} canRetry={editable} />
            )}
        </div>
    );
};

/** Keyed by flow id so switching flows in the sidebar starts with a fresh draft. */
export const FlowEditor = () => {
    const { flowId } = useParams<{ flowId: string }>();
    return <FlowEditorView key={flowId || 'new'} />;
};

export default FlowEditor;
