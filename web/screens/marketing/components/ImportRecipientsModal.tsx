import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../context/UIContext';
import { batchImportRecipients, addRecipientColumn, subscribeRecipientColumns } from '../../../services/recipientService';
import { RecipientColumn } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';

interface ImportRecipientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export const ImportRecipientsModal: React.FC<ImportRecipientsModalProps> = ({ isOpen, onClose, projectId }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [file, setFile] = useState<File | null>(null);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvData, setCsvData] = useState<any[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // csvHeader -> systemKey
    const [newFields, setNewFields] = useState<Record<string, string>>({}); // systemKey -> label
    const [pendingNewFieldHeader, setPendingNewFieldHeader] = useState<string | null>(null);
    const [pendingNewFieldLabel, setPendingNewFieldLabel] = useState('');
    const [existingColumns, setExistingColumns] = useState<RecipientColumn[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showSuccess, showError } = useToast();
    const { t } = useLanguage();

    // Load existing columns when modal opens
    React.useEffect(() => {
        if (!isOpen) {
            // Reset state
            setStep(1);
            setFile(null);
            setCsvHeaders([]);
            setCsvData([]);
            setColumnMapping({});
            setNewFields({});
            setPendingNewFieldHeader(null);
            setPendingNewFieldLabel('');
            return;
        }

        const unsub = subscribeRecipientColumns(projectId, (cols) => {
            setExistingColumns(cols);
        });

        return () => unsub();
    }, [isOpen, projectId]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file: File) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.meta.fields) {
                    setCsvHeaders(results.meta.fields);
                    setCsvData(results.data);

                    // Auto-map columns
                    const initialMapping: Record<string, string> = {};
                    results.meta.fields.forEach(header => {
                        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

                        // Check against existing columns
                        const match = existingColumns.find(col => {
                            const normalizedCol = col.label.toLowerCase().replace(/[^a-z0-9]/g, '');
                            return normalizedCol === normalizedHeader || col.key === normalizedHeader;
                        });

                        if (match) {
                            initialMapping[header] = match.key;
                        }
                    });
                    setColumnMapping(initialMapping);
                    setStep(2);
                }
            },
            error: (err) => {
                showError(t('marketing.importRecipients.errors.parseFailed').replace('{message}', err.message));
            }
        });
    };

    const handleMappingChange = (header: string, value: string) => {
        if (value === 'NEW_FIELD') {
            setPendingNewFieldHeader(header);
            setPendingNewFieldLabel(header);
        } else {
            setColumnMapping(prev => ({ ...prev, [header]: value }));
        }
    };

    const handleCreateNewField = () => {
        if (!pendingNewFieldHeader) return;
        const label = pendingNewFieldLabel.trim();
        if (!label) return;

        const baseKey = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom_field';
        const existingKeys = new Set([
            ...existingColumns.map((column) => column.key),
            ...Object.keys(newFields)
        ]);

        let uniqueKey = baseKey;
        let suffix = 1;
        while (existingKeys.has(uniqueKey)) {
            uniqueKey = `${baseKey}_${suffix}`;
            suffix += 1;
        }

        setNewFields(prev => ({ ...prev, [uniqueKey]: label }));
        setColumnMapping(prev => ({ ...prev, [pendingNewFieldHeader]: uniqueKey }));
        setPendingNewFieldHeader(null);
        setPendingNewFieldLabel('');
    };

    const cancelCreateNewField = () => {
        setPendingNewFieldHeader(null);
        setPendingNewFieldLabel('');
    };

    const handleImport = async () => {
        setIsImporting(true);
        try {
            // 1. Create new columns first
            for (const [key, label] of Object.entries(newFields)) {
                // Check if already exists (race condition check)
                if (!existingColumns.find(c => c.key === key)) {
                    await addRecipientColumn(projectId, {
                        label,
                        key,
                        type: 'text',
                        isSystem: false
                    });
                }
            }

            // 2. Transform data
            const recipientsToImport = csvData.map(row => {
                const recipient: any = {
                    projectId,
                    email: '', // Required
                    status: 'Subscribed',
                    source: 'Import',
                    customFields: {}
                };

                Object.entries(columnMapping).forEach(([header, systemKey]) => {
                    if (!systemKey || systemKey === 'SKIP') return;

                    const value = row[header];
                    if (!value) return;

                    if (systemKey === 'email') recipient.email = value;
                    else if (systemKey === 'firstName') recipient.firstName = value;
                    else if (systemKey === 'lastName') recipient.lastName = value;
                    else if (systemKey === 'status') recipient.status = ['Subscribed', 'Unsubscribed', 'Bounced'].includes(value) ? value : 'Subscribed';
                    else if (systemKey === 'tags') recipient.tags = value.split(',').map((t: string) => t.trim());
                    else {
                        // Custom field
                        recipient.customFields[systemKey] = value;
                    }
                });

                return recipient;
            }).filter(r => r.email); // Must have email

            if (recipientsToImport.length === 0) {
                showError(t('marketing.importRecipients.errors.noValidRecipients'));
                setIsImporting(false);
                return;
            }

            // 3. Batch insert
            const count = await batchImportRecipients(projectId, recipientsToImport);
            showSuccess(t('marketing.importRecipients.toast.success').replace('{count}', String(count)));
            onClose();

        } catch (e) {
            console.error(e);
            showError(t('marketing.importRecipients.errors.importFailed'));
        } finally {
            setIsImporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full border border-surface flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-surface">
                    <h2 className="text-xl font-bold">{t('marketing.importRecipients.title')}</h2>
                    <button onClick={onClose} className="text-muted hover:text-main">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-surface rounded-xl bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <span className="material-symbols-outlined text-4xl text-muted mb-2">upload_file</span>
                            <p className="font-medium">{t('marketing.importRecipients.upload.title')}</p>
                            <p className="text-sm text-muted">{t('marketing.importRecipients.upload.hint')}</p>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted">{t('marketing.importRecipients.mapping.description')}</p>

                            {pendingNewFieldHeader && (
                                <div className="rounded-xl border border-primary/40 bg-surface p-3 space-y-2">
                                    <p className="text-sm font-medium">
                                        {t('marketing.importRecipients.mapping.createFieldFor').replace('{header}', pendingNewFieldHeader)}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={pendingNewFieldLabel}
                                            onChange={(event) => setPendingNewFieldLabel(event.target.value)}
                                            placeholder={t('marketing.importRecipients.mapping.fieldLabelPlaceholder')}
                                            className="flex-1"
                                            autoFocus
                                        />
                                        <Button variant="ghost" onClick={cancelCreateNewField}>{t('common.cancel')}</Button>
                                        <Button variant="primary" onClick={handleCreateNewField} disabled={!pendingNewFieldLabel.trim()}>
                                            {t('marketing.importRecipients.mapping.addField')}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-12 gap-4 font-bold text-xs uppercase tracking-wider text-muted border-b border-surface pb-2">
                                <div className="col-span-4">{t('marketing.importRecipients.mapping.columns.csvHeader')}</div>
                                <div className="col-span-4">{t('marketing.importRecipients.mapping.columns.preview')}</div>
                                <div className="col-span-4">{t('marketing.importRecipients.mapping.columns.mapTo')}</div>
                            </div>

                            <div className="space-y-2">
                                {csvHeaders.map(header => (
                                    <div key={header} className="grid grid-cols-12 gap-4 items-center text-sm">
                                        <div className="col-span-4 font-medium truncate" title={header}>{header}</div>
                                        <div className="col-span-4 text-muted truncate" title={csvData[0]?.[header]}>{csvData[0]?.[header] || '-'}</div>
                                        <div className="col-span-4">
                                            <select
                                                className="w-full bg-surface border border-surface rounded px-2 py-1.5 outline-none"
                                                value={columnMapping[header] || ''}
                                                onChange={(e) => handleMappingChange(header, e.target.value)}
                                            >
                                                <option value="">{t('marketing.importRecipients.mapping.options.selectField')}</option>
                                                <option value="SKIP">{t('marketing.importRecipients.mapping.options.skipColumn')}</option>
                                                <optgroup label={t('marketing.importRecipients.mapping.options.systemFields')}>
                                                    {existingColumns.filter(c => c.isSystem).map(col => (
                                                        <option key={col.key} value={col.key}>{col.label}</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label={t('marketing.importRecipients.mapping.options.customFields')}>
                                                    {existingColumns.filter(c => !c.isSystem).map(col => (
                                                        <option key={col.key} value={col.key}>{col.label}</option>
                                                    ))}
                                                </optgroup>
                                                <option value="NEW_FIELD">{t('marketing.importRecipients.mapping.options.createNewField')}</option>
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-surface flex justify-end gap-3 bg-surface rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
                    {step === 2 && (
                        <Button variant="primary" onClick={handleImport} isLoading={isImporting} disabled={Boolean(pendingNewFieldHeader)}>
                            {t('marketing.importRecipients.actions.import').replace('{count}', String(csvData.length))}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
