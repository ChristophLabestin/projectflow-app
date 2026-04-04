import React, { useMemo, useState } from 'react';

import { Button } from '../common/Button/Button';
import { Card } from '../common/Card/Card';
import { Checkbox } from '../common/Checkbox/Checkbox';
import { Select, type SelectOption } from '../common/Select/Select';
import { TextArea } from '../common/Input/TextArea';
import { TextInput } from '../common/Input/TextInput';
import type { FinanceOperationTemplate, FinanceOperationType } from '../../types';

interface FinanceOperationTemplatesPanelProps {
    templates: FinanceOperationTemplate[];
    canManageTemplates: boolean;
    onSaveTemplate: (input: {
        templateId?: string;
        template: {
            name: string;
            operationType: FinanceOperationType;
            defaultPayload: Record<string, unknown>;
            isShared: boolean;
        };
    }) => Promise<void>;
    onDeleteTemplate: (templateId: string) => Promise<void>;
    onUseTemplate: (operationType: FinanceOperationType, payload: Record<string, unknown>) => void;
    t: (key: string) => string;
}

const parseTemplatePayload = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid-payload');
    }
    return parsed as Record<string, unknown>;
};

const operationTypeOptions: SelectOption[] = [
    { value: 'bank_import', label: 'bank_import' },
    { value: 'reconciliation_suggest', label: 'reconciliation_suggest' },
    { value: 'reconciliation_confirm', label: 'reconciliation_confirm' },
    { value: 'tax_build_report', label: 'tax_build_report' },
    { value: 'reports_build_bundle', label: 'reports_build_bundle' },
    { value: 'export_datev', label: 'export_datev' },
    { value: 'period_close', label: 'period_close' },
    { value: 'period_reopen', label: 'period_reopen' },
    { value: 'sync_run', label: 'sync_run' },
];

export const FinanceOperationTemplatesPanel = ({
    templates,
    canManageTemplates,
    onSaveTemplate,
    onDeleteTemplate,
    onUseTemplate,
    t,
}: FinanceOperationTemplatesPanelProps) => {
    const [templateId, setTemplateId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [operationType, setOperationType] = useState<FinanceOperationType>('reconciliation_suggest');
    const [isShared, setIsShared] = useState(false);
    const [payloadText, setPayloadText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const templateCountLabel = useMemo(() => `${templates.length} ${t('finance.functions.templates.count')}`, [templates.length, t]);

    const loadTemplateIntoEditor = (template: FinanceOperationTemplate) => {
        setTemplateId(template.id);
        setName(template.name);
        setOperationType(template.operationType);
        setIsShared(Boolean(template.isShared));
        setPayloadText(JSON.stringify(template.defaultPayload || {}, null, 2));
        setError(null);
    };

    const resetEditor = () => {
        setTemplateId(null);
        setName('');
        setOperationType('reconciliation_suggest');
        setIsShared(false);
        setPayloadText('');
        setError(null);
    };

    const handleSaveTemplate = async () => {
        if (!canManageTemplates) return;
        const safeName = name.trim();
        if (!safeName) {
            setError(t('finance.functions.templates.validation.name'));
            return;
        }

        let payload: Record<string, unknown>;
        try {
            payload = parseTemplatePayload(payloadText);
        } catch {
            setError(t('finance.functions.templates.validation.payload'));
            return;
        }

        setError(null);
        setSaving(true);
        try {
            await onSaveTemplate({
                templateId: templateId || undefined,
                template: {
                    name: safeName,
                    operationType,
                    defaultPayload: payload,
                    isShared,
                },
            });
            resetEditor();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="finance-functions-templates">
            <Card className="finance-panel">
                <div className="finance-panel__header">
                    <div>
                        <h3 className="h4">{t('finance.functions.templates.title')}</h3>
                        <p className="text-muted">{t('finance.functions.templates.subtitle')}</p>
                    </div>
                    <span className="finance-calc-simple__scenario-count">{templateCountLabel}</span>
                </div>

                <div className="finance-functions-templates__form">
                    <TextInput
                        label={t('finance.functions.templates.name')}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        disabled={!canManageTemplates}
                    />
                    <Select
                        label={t('finance.functions.templates.operation')}
                        value={operationType}
                        options={operationTypeOptions}
                        onChange={(value) => setOperationType(value as FinanceOperationType)}
                        disabled={!canManageTemplates}
                    />
                    <Checkbox
                        label={t('finance.functions.templates.shared')}
                        checked={isShared}
                        onChange={(event) => setIsShared(event.target.checked)}
                        disabled={!canManageTemplates}
                    />
                    <TextArea
                        label={t('finance.functions.templates.payload')}
                        value={payloadText}
                        onChange={(event) => setPayloadText(event.target.value)}
                        rows={8}
                        disabled={!canManageTemplates}
                    />
                </div>

                {error && <p className="finance-functions-wizard__error">{error}</p>}

                <div className="finance-functions-templates__actions">
                    <Button variant="ghost" onClick={resetEditor}>
                        {t('finance.functions.templates.reset')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => void handleSaveTemplate()}
                        disabled={!canManageTemplates}
                        isLoading={saving}
                    >
                        {templateId ? t('finance.functions.templates.update') : t('finance.functions.templates.save')}
                    </Button>
                </div>
            </Card>

            <Card className="finance-panel finance-panel--expanded">
                <div className="finance-panel__header">
                    <h3 className="h4">{t('finance.functions.templates.saved')}</h3>
                </div>
                {templates.length === 0 ? (
                    <div className="finance-empty">{t('finance.functions.templates.empty')}</div>
                ) : (
                    <div className="finance-functions-templates__list">
                        {templates.map((template) => (
                            <div className="finance-functions-templates__item" key={template.id}>
                                <div>
                                    <strong>{template.name}</strong>
                                    <p className="text-muted">{template.operationType}</p>
                                </div>
                                <div className="finance-functions-templates__item-actions">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onUseTemplate(template.operationType, template.defaultPayload || {})}
                                    >
                                        {t('finance.functions.templates.use')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => loadTemplateIntoEditor(template)}
                                    >
                                        {t('finance.functions.templates.edit')}
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={() => void onDeleteTemplate(template.id)}
                                        disabled={!canManageTemplates}
                                    >
                                        {t('finance.functions.templates.delete')}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};
