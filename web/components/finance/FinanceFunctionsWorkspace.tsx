import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../common/Button/Button';
import { Card } from '../common/Card/Card';
import { Select, type SelectOption } from '../common/Select/Select';
import { FinanceOperationRunTimeline } from './FinanceOperationRunTimeline';
import { FinanceOperationWizard } from './FinanceOperationWizard';
import { FinanceOperationTemplatesPanel } from './FinanceOperationTemplatesPanel';
import { FinanceOpsAssistantPanel } from './FinanceOpsAssistantPanel';
import {
    subscribeFinanceOperationApprovals,
    subscribeFinanceOperationRuns,
    recommendFinanceOperations,
} from '../../services/finance-v2/functionsService';
import {
    deleteFinanceOperationTemplate,
    subscribeFinanceOperationTemplates,
    upsertFinanceOperationTemplate,
} from '../../services/finance-v2/operationTemplateService';
import type {
    FinanceOperationApproval,
    FinanceOperationRecommendation,
    FinanceOperationRun,
    FinanceOperationType,
    FinanceOperationTemplate,
} from '../../types';

type FunctionsView = 'operate' | 'runs' | 'approvals' | 'templates' | 'insights';

const allOperationTypes: FinanceOperationType[] = [
    'bank_import',
    'reconciliation_suggest',
    'reconciliation_confirm',
    'tax_build_report',
    'reports_build_bundle',
    'export_datev',
    'period_close',
    'period_reopen',
    'sync_run',
];

const operationTypeSet = new Set<FinanceOperationType>(allOperationTypes);

const parseOperationType = (value?: string | null): FinanceOperationType | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase() as FinanceOperationType;
    return operationTypeSet.has(normalized) ? normalized : null;
};

const activeStatuses = new Set(['queued', 'validating', 'awaiting_confirmation', 'running']);

interface FinanceFunctionsWorkspaceProps {
    tenantId: string | null;
    routeOperationType?: string;
    canViewFunctions: boolean;
    canExecuteFunctions: boolean;
    canRetryFunctionRuns: boolean;
    canManageFunctionTemplates: boolean;
    canApproveHighRiskFunctions: boolean;
    t: (key: string) => string;
    showError: (title: string, message?: string) => void;
    showSuccess: (message: string) => void;
}

export const FinanceFunctionsWorkspace = ({
    tenantId,
    routeOperationType,
    canViewFunctions,
    canExecuteFunctions,
    canRetryFunctionRuns,
    canManageFunctionTemplates,
    canApproveHighRiskFunctions,
    t,
    showError,
    showSuccess,
}: FinanceFunctionsWorkspaceProps) => {
    const navigate = useNavigate();

    const [activeView, setActiveView] = useState<FunctionsView>('operate');
    const [activeOperationType, setActiveOperationType] = useState<FinanceOperationType>('reconciliation_suggest');
    const [operationRuns, setOperationRuns] = useState<FinanceOperationRun[]>([]);
    const [operationApprovals, setOperationApprovals] = useState<FinanceOperationApproval[]>([]);
    const [operationTemplates, setOperationTemplates] = useState<FinanceOperationTemplate[]>([]);
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [recommendations, setRecommendations] = useState<FinanceOperationRecommendation[]>([]);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);
    const [payloadSeed, setPayloadSeed] = useState<Record<string, unknown> | undefined>(undefined);
    const [payloadSeedId, setPayloadSeedId] = useState('seed-0');
    const [runsFilterStatus, setRunsFilterStatus] = useState<string>('all');

    useEffect(() => {
        const routeType = parseOperationType(routeOperationType);
        if (!routeType) return;
        setActiveOperationType(routeType);
    }, [routeOperationType]);

    useEffect(() => {
        if (!tenantId || !canViewFunctions) {
            setOperationRuns([]);
            setOperationApprovals([]);
            setOperationTemplates([]);
            return;
        }

        const unsubscribeRuns = subscribeFinanceOperationRuns(setOperationRuns, tenantId);
        const unsubscribeApprovals = subscribeFinanceOperationApprovals(setOperationApprovals, tenantId);
        const unsubscribeTemplates = subscribeFinanceOperationTemplates(setOperationTemplates, tenantId);

        return () => {
            unsubscribeRuns();
            unsubscribeApprovals();
            unsubscribeTemplates();
        };
    }, [tenantId, canViewFunctions]);

    useEffect(() => {
        if (selectedRunId && operationRuns.some((run) => run.id === selectedRunId)) {
            return;
        }
        if (operationRuns.length === 0) {
            setSelectedRunId(null);
            return;
        }
        setSelectedRunId(operationRuns[0].id);
    }, [selectedRunId, operationRuns]);

    const selectedRun = useMemo(
        () => operationRuns.find((run) => run.id === selectedRunId) || null,
        [operationRuns, selectedRunId],
    );

    const filteredRuns = useMemo(() => {
        if (runsFilterStatus === 'all') return operationRuns;
        return operationRuns.filter((run) => run.status === runsFilterStatus);
    }, [operationRuns, runsFilterStatus]);

    const activeRuns = useMemo(
        () => operationRuns.filter((run) => activeStatuses.has(run.status)),
        [operationRuns],
    );

    const statusOptions = useMemo<SelectOption[]>(
        () => [
            { value: 'all', label: t('finance.functions.runs.filter.all') },
            { value: 'queued', label: 'queued' },
            { value: 'validating', label: 'validating' },
            { value: 'awaiting_confirmation', label: 'awaiting_confirmation' },
            { value: 'running', label: 'running' },
            { value: 'succeeded', label: 'succeeded' },
            { value: 'failed', label: 'failed' },
            { value: 'canceled', label: 'canceled' },
        ],
        [t],
    );

    const refreshRecommendations = async () => {
        if (!tenantId || !canViewFunctions) return;
        setLoadingRecommendations(true);
        try {
            const result = await recommendFinanceOperations({ tenantId });
            setRecommendations(result.recommendations || []);
        } catch (error: any) {
            showError(t('finance.functions.ai.error'), error?.message);
        } finally {
            setLoadingRecommendations(false);
        }
    };

    useEffect(() => {
        void refreshRecommendations();
    }, [tenantId, canViewFunctions]);

    const updateOperationType = (operationType: FinanceOperationType) => {
        setActiveOperationType(operationType);
        navigate(`/finance/functions/${operationType}`);
    };

    const handleUsePayloadSeed = (operationType: FinanceOperationType, payload: Record<string, unknown>) => {
        updateOperationType(operationType);
        setPayloadSeed(payload);
        setPayloadSeedId(`seed-${Date.now()}`);
        setActiveView('operate');
    };

    const handleSaveTemplate = async (input: {
        templateId?: string;
        template: {
            name: string;
            operationType: FinanceOperationType;
            defaultPayload: Record<string, unknown>;
            isShared: boolean;
        };
    }) => {
        if (!tenantId) return;
        try {
            await upsertFinanceOperationTemplate({
                tenantId,
                templateId: input.templateId,
                template: input.template,
            });
            showSuccess(t('finance.functions.templates.savedToast'));
        } catch (error: any) {
            showError(t('finance.functions.templates.error'), error?.message);
        }
    };

    const handleDeleteTemplate = async (templateId: string) => {
        if (!tenantId) return;
        try {
            await deleteFinanceOperationTemplate({
                tenantId,
                templateId,
            });
            showSuccess(t('finance.functions.templates.deletedToast'));
        } catch (error: any) {
            showError(t('finance.functions.templates.error'), error?.message);
        }
    };

    const formatDateTime = (value: unknown) => {
        if (!value) return '-';
        const timestamp = value as { seconds?: number; toDate?: () => Date };
        try {
            if (timestamp && typeof timestamp.toDate === 'function') {
                return timestamp.toDate().toLocaleString();
            }
            if (typeof timestamp.seconds === 'number') {
                return new Date(timestamp.seconds * 1000).toLocaleString();
            }
            const date = new Date(String(value));
            if (Number.isNaN(date.getTime())) return '-';
            return date.toLocaleString();
        } catch {
            return '-';
        }
    };

    const workspaceTabs: Array<{ id: FunctionsView; label: string }> = [
        { id: 'operate', label: t('finance.functions.tabs.operate') },
        { id: 'runs', label: t('finance.functions.tabs.runs') },
        { id: 'approvals', label: t('finance.functions.tabs.approvals') },
        { id: 'templates', label: t('finance.functions.tabs.templates') },
        { id: 'insights', label: t('finance.functions.tabs.insights') },
    ];

    if (!canViewFunctions) {
        return (
            <Card className="finance-panel finance-panel--expanded">
                <div className="finance-empty">{t('finance.functions.permissions.viewOnly')}</div>
            </Card>
        );
    }

    return (
        <div className="finance-functions-workspace">
            <div className="finance-functions-layout">
                <Card className="finance-panel finance-functions-catalog">
                    <div className="finance-panel__header">
                        <div>
                            <h3 className="h4">{t('finance.functions.catalog.title')}</h3>
                            <p className="text-muted">{t('finance.functions.catalog.subtitle')}</p>
                        </div>
                    </div>
                    <div className="finance-functions-catalog__groups">
                        {allOperationTypes.map((operationType) => (
                            <button
                                type="button"
                                key={operationType}
                                className={`finance-functions-catalog__item ${activeOperationType === operationType ? 'finance-functions-catalog__item--active' : ''}`}
                                onClick={() => updateOperationType(operationType)}
                            >
                                <strong>{operationType}</strong>
                                <span>{t(`finance.functions.operation.${operationType}`)}</span>
                            </button>
                        ))}
                    </div>
                </Card>

                <div className="finance-functions-main">
                    <Card className="finance-panel">
                        <div className="finance-functions-tabs" role="tablist" aria-label={t('finance.functions.tabs.label')}>
                            {workspaceTabs.map((tab) => (
                                <button
                                    type="button"
                                    key={tab.id}
                                    className={`finance-functions-tabs__item ${activeView === tab.id ? 'finance-functions-tabs__item--active' : ''}`}
                                    onClick={() => setActiveView(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </Card>

                    {activeView === 'operate' && (
                        <FinanceOperationWizard
                            tenantId={tenantId}
                            operationType={activeOperationType}
                            canExecute={canExecuteFunctions}
                            canRetry={canRetryFunctionRuns}
                            canApproveHighRisk={canApproveHighRiskFunctions}
                            selectedRun={selectedRun}
                            payloadSeed={payloadSeed}
                            payloadSeedId={payloadSeedId}
                            onRunCreated={(runId) => {
                                setSelectedRunId(runId);
                                setActiveView('runs');
                            }}
                            t={t}
                            showError={showError}
                            showSuccess={showSuccess}
                        />
                    )}

                    {activeView === 'runs' && (
                        <div className="finance-functions-runs">
                            <Card className="finance-panel">
                                <div className="finance-panel__header">
                                    <h3 className="h4">{t('finance.functions.runs.title')}</h3>
                                    <Select
                                        label={t('finance.functions.runs.filter.label')}
                                        value={runsFilterStatus}
                                        options={statusOptions}
                                        onChange={(value) => setRunsFilterStatus(String(value))}
                                    />
                                </div>
                                {filteredRuns.length === 0 ? (
                                    <div className="finance-empty">{t('finance.functions.runs.empty')}</div>
                                ) : (
                                    <div className="finance-functions-runs-list">
                                        {filteredRuns.map((run) => (
                                            <button
                                                key={run.id}
                                                type="button"
                                                className={`finance-functions-runs-list__item ${selectedRunId === run.id ? 'finance-functions-runs-list__item--active' : ''}`}
                                                onClick={() => setSelectedRunId(run.id)}
                                            >
                                                <strong>{run.operationType}</strong>
                                                <span>{run.id}</span>
                                                <span className={`finance-pill finance-pill--${run.status}`}>{run.status}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Card>
                            <FinanceOperationRunTimeline run={selectedRun} formatDateTime={formatDateTime} t={t} />
                        </div>
                    )}

                    {activeView === 'approvals' && (
                        <Card className="finance-panel finance-panel--expanded">
                            <div className="finance-panel__header">
                                <h3 className="h4">{t('finance.functions.approvals.title')}</h3>
                            </div>
                            {operationApprovals.length === 0 ? (
                                <div className="finance-empty">{t('finance.functions.approvals.empty')}</div>
                            ) : (
                                <div className="finance-functions-approvals-list">
                                    {operationApprovals.map((approval) => (
                                        <div className="finance-functions-approvals-list__item" key={approval.id}>
                                            <div>
                                                <strong>{approval.operationType}</strong>
                                                <p className="text-muted">{approval.runId}</p>
                                            </div>
                                            <div className="finance-functions-approvals-list__actions">
                                                <span className={`finance-pill finance-pill--${approval.status}`}>{approval.status}</span>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedRunId(approval.runId);
                                                        setActiveView('runs');
                                                    }}
                                                >
                                                    {t('finance.functions.approvals.openRun')}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    )}

                    {activeView === 'templates' && (
                        <FinanceOperationTemplatesPanel
                            templates={operationTemplates}
                            canManageTemplates={canManageFunctionTemplates}
                            onSaveTemplate={handleSaveTemplate}
                            onDeleteTemplate={handleDeleteTemplate}
                            onUseTemplate={handleUsePayloadSeed}
                            t={t}
                        />
                    )}

                    {activeView === 'insights' && (
                        <FinanceOpsAssistantPanel
                            recommendations={recommendations}
                            loading={loadingRecommendations}
                            enabled={canViewFunctions}
                            onRefresh={refreshRecommendations}
                            onUseRecommendation={(recommendation) => handleUsePayloadSeed(recommendation.operationType, recommendation.suggestedPayload)}
                            t={t}
                        />
                    )}
                </div>
            </div>

            <Card className="finance-panel finance-functions-tray">
                <div className="finance-panel__header">
                    <h3 className="h5">{t('finance.functions.tray.title')}</h3>
                </div>
                {activeRuns.length === 0 ? (
                    <div className="finance-empty">{t('finance.functions.tray.empty')}</div>
                ) : (
                    <div className="finance-functions-tray__list">
                        {activeRuns.map((run) => (
                            <button
                                type="button"
                                key={run.id}
                                className="finance-functions-tray__item"
                                onClick={() => {
                                    setSelectedRunId(run.id);
                                    setActiveView('runs');
                                }}
                            >
                                <strong>{run.operationType}</strong>
                                <span className={`finance-pill finance-pill--${run.status}`}>{run.status}</span>
                            </button>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
