import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '../common/Button/Button';
import { Card } from '../common/Card/Card';
import { Select, type SelectOption } from '../common/Select/Select';
import { TextArea } from '../common/Input/TextArea';
import { TextInput } from '../common/Input/TextInput';
import { executeFinanceOperation, previewFinanceOperation, retryFinanceOperationRun } from '../../services/finance-v2/functionsService';
import type {
    FinanceOperationPreview,
    FinanceOperationRun,
    FinanceOperationType,
} from '../../types';

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

const periodScopeOperations = new Set<FinanceOperationType>([
    'reconciliation_suggest',
    'reconciliation_confirm',
    'tax_build_report',
    'export_datev',
    'period_close',
    'period_reopen',
]);

const operationRequiresPeriodRange = (operationType: FinanceOperationType) => operationType === 'reports_build_bundle';
const operationRequiresSyncConnection = (operationType: FinanceOperationType) => operationType === 'sync_run';
const operationNeedsStructuredPayload = (operationType: FinanceOperationType) => operationType === 'reconciliation_confirm';

const buildPeriodKeyNow = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

interface FinanceOperationWizardProps {
    tenantId: string | null;
    operationType: FinanceOperationType;
    canExecute: boolean;
    canRetry: boolean;
    canApproveHighRisk: boolean;
    selectedRun: FinanceOperationRun | null;
    payloadSeed?: Record<string, unknown>;
    payloadSeedId?: string;
    onRunCreated: (runId: string) => void;
    t: (key: string) => string;
    showError: (title: string, message?: string) => void;
    showSuccess: (message: string) => void;
}

type WizardStep = 'scope' | 'preview' | 'confirm' | 'result';

const parsePayloadText = (
    rawText: string,
    t: (key: string) => string,
): { payload: Record<string, unknown>; error: string | null } => {
    const trimmed = rawText.trim();
    if (!trimmed) {
        return { payload: {}, error: null };
    }

    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { payload: {}, error: t('finance.functions.wizard.validation.payloadObject') };
        }
        return { payload: parsed as Record<string, unknown>, error: null };
    } catch {
        return { payload: {}, error: t('finance.functions.wizard.validation.payloadJson') };
    }
};

const normalizePayloadString = (payload: Record<string, unknown>) => {
    if (!payload || Object.keys(payload).length === 0) return '';
    return JSON.stringify(payload, null, 2);
};

export const FinanceOperationWizard = ({
    tenantId,
    operationType,
    canExecute,
    canRetry,
    canApproveHighRisk,
    selectedRun,
    payloadSeed,
    payloadSeedId,
    onRunCreated,
    t,
    showError,
    showSuccess,
}: FinanceOperationWizardProps) => {
    const [step, setStep] = useState<WizardStep>('scope');
    const [periodKey, setPeriodKey] = useState(buildPeriodKeyNow());
    const [periodKeyFrom, setPeriodKeyFrom] = useState(buildPeriodKeyNow());
    const [periodKeyTo, setPeriodKeyTo] = useState(buildPeriodKeyNow());
    const [connectionId, setConnectionId] = useState('');
    const [payloadText, setPayloadText] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [preview, setPreview] = useState<FinanceOperationPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [executeLoading, setExecuteLoading] = useState(false);
    const [lastExecution, setLastExecution] = useState<{ runId: string; status: string } | null>(null);

    useEffect(() => {
        const safeSeed = payloadSeed || {};
        setPeriodKey(String(safeSeed.periodKey || buildPeriodKeyNow()));
        setPeriodKeyFrom(String(safeSeed.periodKeyFrom || buildPeriodKeyNow()));
        setPeriodKeyTo(String(safeSeed.periodKeyTo || safeSeed.periodKeyFrom || buildPeriodKeyNow()));
        setConnectionId(String(safeSeed.connectionId || ''));
        setPayloadText(normalizePayloadString(safeSeed));
        setValidationError(null);
        setPreview(null);
        setLastExecution(null);
        setStep('scope');
    }, [operationType, payloadSeed, payloadSeedId]);

    const operationTypeOptions = useMemo<SelectOption[]>(() => {
        return [
            { label: 'bank_import', value: 'bank_import' },
            { label: 'reconciliation_suggest', value: 'reconciliation_suggest' },
            { label: 'reconciliation_confirm', value: 'reconciliation_confirm' },
            { label: 'tax_build_report', value: 'tax_build_report' },
            { label: 'reports_build_bundle', value: 'reports_build_bundle' },
            { label: 'export_datev', value: 'export_datev' },
            { label: 'period_close', value: 'period_close' },
            { label: 'period_reopen', value: 'period_reopen' },
            { label: 'sync_run', value: 'sync_run' },
        ];
    }, []);

    const buildPayload = () => {
        const parsed = parsePayloadText(payloadText, t);
        if (parsed.error) {
            return { payload: {}, error: parsed.error };
        }

        const basePayload: Record<string, unknown> = {};

        if (periodScopeOperations.has(operationType)) {
            basePayload.periodKey = periodKey;
        }

        if (operationRequiresPeriodRange(operationType)) {
            basePayload.periodKeyFrom = periodKeyFrom;
            basePayload.periodKeyTo = periodKeyTo;
        }

        if (operationRequiresSyncConnection(operationType)) {
            basePayload.connectionId = connectionId;
        }

        return {
            payload: {
                ...basePayload,
                ...parsed.payload,
            },
            error: null,
        };
    };

    const validatePayload = () => {
        const { payload, error } = buildPayload();
        if (error) {
            return { payload: {}, error };
        }

        if (periodScopeOperations.has(operationType) && !PERIOD_PATTERN.test(periodKey)) {
            return { payload: {}, error: t('finance.functions.wizard.validation.period') };
        }

        if (operationRequiresPeriodRange(operationType)) {
            if (!PERIOD_PATTERN.test(periodKeyFrom) || !PERIOD_PATTERN.test(periodKeyTo)) {
                return { payload: {}, error: t('finance.functions.wizard.validation.periodRange') };
            }
            if (periodKeyFrom > periodKeyTo) {
                return { payload: {}, error: t('finance.functions.wizard.validation.periodOrder') };
            }
        }

        if (operationRequiresSyncConnection(operationType) && !String(payload.connectionId || '').trim()) {
            return { payload: {}, error: t('finance.functions.wizard.validation.connection') };
        }

        if (operationNeedsStructuredPayload(operationType) && !payloadText.trim()) {
            return { payload: {}, error: t('finance.functions.wizard.validation.structuredPayload') };
        }

        return { payload, error: null };
    };

    const handlePreview = async () => {
        if (!tenantId) return;

        const { payload, error } = validatePayload();
        if (error) {
            setValidationError(error);
            return;
        }

        setValidationError(null);
        setPreviewLoading(true);
        try {
            const nextPreview = await previewFinanceOperation({
                tenantId,
                operationType,
                payload,
            });
            setPreview(nextPreview);
            setStep('preview');
        } catch (previewError: any) {
            showError(t('finance.functions.wizard.previewError'), previewError?.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleExecute = async () => {
        if (!tenantId || !canExecute) return;

        const { payload, error } = validatePayload();
        if (error) {
            setValidationError(error);
            return;
        }
        if (!preview) {
            setValidationError(t('finance.functions.wizard.validation.previewFirst'));
            return;
        }
        if (!preview.canExecute && !preview.requiresConfirmation) {
            setValidationError(t('finance.functions.wizard.validation.blocked'));
            return;
        }
        if (preview.risk === 'high' && !canApproveHighRisk) {
            setValidationError(t('finance.functions.wizard.validation.highRiskPermission'));
            return;
        }

        setValidationError(null);
        setExecuteLoading(true);
        try {
            const response = await executeFinanceOperation({
                tenantId,
                operationType,
                payload,
                confirm: true,
                idempotencyKey: `${operationType}:${Date.now()}`,
            });
            setLastExecution({
                runId: response.runId,
                status: response.status,
            });
            onRunCreated(response.runId);
            setStep('result');
            showSuccess(t('finance.functions.wizard.executeSuccess'));
        } catch (executeError: any) {
            showError(t('finance.functions.wizard.executeError'), executeError?.message);
        } finally {
            setExecuteLoading(false);
        }
    };

    const handleRetryRun = async () => {
        if (!tenantId || !selectedRun || !canRetry) return;

        setExecuteLoading(true);
        try {
            const response = await retryFinanceOperationRun({
                tenantId,
                runId: selectedRun.id,
                confirm: true,
            });
            onRunCreated(response.runId);
            setLastExecution({
                runId: response.runId,
                status: response.status,
            });
            setStep('result');
            showSuccess(t('finance.functions.wizard.retrySuccess'));
        } catch (retryError: any) {
            showError(t('finance.functions.wizard.retryError'), retryError?.message);
        } finally {
            setExecuteLoading(false);
        }
    };

    return (
        <Card className="finance-panel finance-panel--expanded">
            <div className="finance-panel__header">
                <div>
                    <h3 className="h4">{t('finance.functions.wizard.title')}</h3>
                    <p className="text-muted">{t('finance.functions.wizard.subtitle')}</p>
                </div>
                <Select
                    label={t('finance.functions.wizard.operation')}
                    value={operationType}
                    options={operationTypeOptions}
                    onChange={() => {
                        // The operation is controlled by parent catalog.
                    }}
                    disabled
                />
            </div>

            <div className="finance-functions-wizard-steps" role="tablist" aria-label={t('finance.functions.wizard.steps')}>
                {(['scope', 'preview', 'confirm', 'result'] as WizardStep[]).map((wizardStep) => (
                    <button
                        key={wizardStep}
                        type="button"
                        className={`finance-functions-wizard-step ${step === wizardStep ? 'finance-functions-wizard-step--active' : ''}`}
                        onClick={() => setStep(wizardStep)}
                    >
                        {t(`finance.functions.wizard.step.${wizardStep}`)}
                    </button>
                ))}
            </div>

            {step === 'scope' && (
                <div className="finance-functions-wizard-grid">
                    {periodScopeOperations.has(operationType) && (
                        <TextInput
                            label={t('finance.functions.wizard.periodKey')}
                            value={periodKey}
                            onChange={(event) => setPeriodKey(event.target.value)}
                            placeholder="YYYY-MM"
                            disabled={!canExecute}
                        />
                    )}

                    {operationRequiresPeriodRange(operationType) && (
                        <>
                            <TextInput
                                label={t('finance.functions.wizard.periodFrom')}
                                value={periodKeyFrom}
                                onChange={(event) => setPeriodKeyFrom(event.target.value)}
                                placeholder="YYYY-MM"
                                disabled={!canExecute}
                            />
                            <TextInput
                                label={t('finance.functions.wizard.periodTo')}
                                value={periodKeyTo}
                                onChange={(event) => setPeriodKeyTo(event.target.value)}
                                placeholder="YYYY-MM"
                                disabled={!canExecute}
                            />
                        </>
                    )}

                    {operationRequiresSyncConnection(operationType) && (
                        <TextInput
                            label={t('finance.functions.wizard.connectionId')}
                            value={connectionId}
                            onChange={(event) => setConnectionId(event.target.value)}
                            disabled={!canExecute}
                        />
                    )}

                    <TextArea
                        label={t('finance.functions.wizard.payload')}
                        value={payloadText}
                        onChange={(event) => setPayloadText(event.target.value)}
                        rows={8}
                        helpText={t('finance.functions.wizard.payloadHelp')}
                        disabled={!canExecute}
                    />
                </div>
            )}

            {step === 'preview' && (
                <div className="finance-functions-preview">
                    {!preview ? (
                        <div className="finance-empty">{t('finance.functions.wizard.previewEmpty')}</div>
                    ) : (
                        <>
                            <div className="finance-functions-preview__meta">
                                <span className={`finance-pill finance-pill--${preview.canExecute ? 'succeeded' : 'failed'}`}>
                                    {preview.canExecute ? t('finance.functions.wizard.previewReady') : t('finance.functions.wizard.previewBlocked')}
                                </span>
                                <span className={`finance-pill finance-pill--${preview.risk}`}>{preview.risk}</span>
                                <span className={`finance-pill finance-pill--${preview.requiresConfirmation ? 'awaiting_confirmation' : 'succeeded'}`}>
                                    {preview.requiresConfirmation ? t('finance.functions.wizard.previewNeedsConfirmation') : t('finance.functions.wizard.previewNoConfirmation')}
                                </span>
                            </div>

                            {(preview.blockingChecks || []).length > 0 && (
                                <div className="finance-functions-preview__list">
                                    <h4 className="h5">{t('finance.functions.wizard.blockingChecks')}</h4>
                                    <ul>
                                        {preview.blockingChecks.map((item) => (
                                            <li key={item.key}>
                                                <strong>{item.blocking ? t('finance.functions.wizard.blocking') : t('finance.functions.wizard.nonBlocking')}</strong>
                                                {`: ${item.message} (${item.count})`}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {(preview.warnings || []).length > 0 && (
                                <div className="finance-functions-preview__list">
                                    <h4 className="h5">{t('finance.functions.wizard.warnings')}</h4>
                                    <ul>
                                        {preview.warnings.map((warning, index) => (
                                            <li key={`${warning}-${index}`}>{warning}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="finance-functions-preview__payload">
                                <h4 className="h5">{t('finance.functions.wizard.estimatedImpact')}</h4>
                                <pre>{JSON.stringify(preview.estimatedImpact || {}, null, 2)}</pre>
                            </div>
                        </>
                    )}
                </div>
            )}

            {step === 'confirm' && (
                <div className="finance-functions-confirm">
                    <p className="text-muted">{t('finance.functions.wizard.confirmCopy')}</p>
                    <div className="finance-functions-preview__payload">
                        <pre>{JSON.stringify(buildPayload().payload, null, 2)}</pre>
                    </div>
                </div>
            )}

            {step === 'result' && (
                <div className="finance-functions-result">
                    {lastExecution ? (
                        <div className="finance-functions-result__summary">
                            <span>{`${t('finance.functions.run.id')}: ${lastExecution.runId}`}</span>
                            <span>{`${t('finance.functions.run.status')}: ${lastExecution.status}`}</span>
                        </div>
                    ) : (
                        <div className="finance-empty">{t('finance.functions.wizard.resultEmpty')}</div>
                    )}

                    {selectedRun?.status === 'failed' && canRetry && (
                        <Button
                            variant="secondary"
                            onClick={() => void handleRetryRun()}
                            isLoading={executeLoading}
                        >
                            {t('finance.functions.wizard.retry')}
                        </Button>
                    )}
                </div>
            )}

            {validationError && <p className="finance-functions-wizard__error">{validationError}</p>}

            <div className="finance-functions-wizard-actions">
                <Button
                    variant="ghost"
                    onClick={() => setStep('scope')}
                >
                    {t('finance.functions.wizard.backToScope')}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => void handlePreview()}
                    isLoading={previewLoading}
                    disabled={!canExecute || !tenantId}
                >
                    {t('finance.functions.wizard.preview')}
                </Button>
                <Button
                    variant="primary"
                    onClick={() => {
                        if (step !== 'confirm') {
                            setStep('confirm');
                            return;
                        }
                        void handleExecute();
                    }}
                    isLoading={executeLoading}
                    disabled={!canExecute || !tenantId}
                >
                    {step === 'confirm' ? t('finance.functions.wizard.execute') : t('finance.functions.wizard.goToConfirm')}
                </Button>
            </div>
        </Card>
    );
};
