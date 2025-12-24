import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../context/UIContext';
import { batchImportRecipients, subscribeRecipientColumns } from '../../../services/recipientService';
import { RecipientColumn } from '../../../types';

interface ExternalSourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export const ExternalSourceModal: React.FC<ExternalSourceModalProps> = ({ isOpen, onClose, projectId }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [url, setUrl] = useState('');
    const [method, setMethod] = useState<'GET' | 'POST'>('GET');
    const [headers, setHeaders] = useState('{\n  "Authorization": "Bearer token"\n}');
    const [isLoading, setIsLoading] = useState(false);
    const [fetchedData, setFetchedData] = useState<any[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [existingColumns, setExistingColumns] = useState<RecipientColumn[]>([]);
    const { showSuccess, showError } = useToast();

    // Load columns
    React.useEffect(() => {
        if (!isOpen) {
            reset();
            return;
        }
        const unsub = subscribeRecipientColumns(projectId, setExistingColumns);
        return () => unsub();
    }, [isOpen, projectId]);

    const reset = () => {
        setStep(1);
        setUrl('');
        setFetchedData([]);
        setColumnMapping({});
        setIsLoading(false);
    };

    const handleTestConnection = async () => {
        setIsLoading(true);
        try {
            // Validate headers
            let headerObj = {};
            try {
                headerObj = JSON.parse(headers);
            } catch (e) {
                showError("Invalid JSON in headers");
                setIsLoading(false);
                return;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headerObj
                }
            });

            if (!res.ok) throw new Error(`Status ${res.status}`);

            const data = await res.json();

            // Normalize: Ensure we have an array
            let list = Array.isArray(data) ? data : (data.users || data.data || data.results || []);

            if (!Array.isArray(list) || list.length === 0) {
                showError("Could not find a list of objects in the response. Ensure the API returns a JSON array or an object containing an array.");
                setIsLoading(false);
                return;
            }

            setFetchedData(list);
            setStep(2);
            showSuccess(`Successfully fetched ${list.length} records.`);

            // Map columns mock-up based on first item
            const firstItem = list[0];
            const keys = Object.keys(firstItem);
            const initialMap: Record<string, string> = {};
            keys.forEach(k => {
                // Try match
                const match = existingColumns.find(c => c.key === k || c.label.toLowerCase() === k.toLowerCase());
                if (match) initialMap[k] = match.key;
            });
            setColumnMapping(initialMap);

        } catch (e: any) {
            console.error(e);
            showError("Connection failed: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        setIsLoading(true);
        try {
            const recipientsToImport = fetchedData.map(item => {
                const r: any = {
                    projectId,
                    email: '',
                    status: 'Subscribed',
                    source: 'External',
                    customFields: {}
                };

                Object.entries(columnMapping).forEach(([sourceKey, targetKey]) => {
                    if (!targetKey || targetKey === 'SKIP') return;
                    const val = item[sourceKey];
                    if (!val) return;

                    if (targetKey === 'email') r.email = val;
                    else if (targetKey === 'firstName') r.firstName = val;
                    else if (targetKey === 'lastName') r.lastName = val;
                    else if (targetKey === 'status') r.status = val;
                    else r.customFields[targetKey] = val;
                });
                return r;
            }).filter(r => r.email);

            if (recipientsToImport.length === 0) {
                showError("No valid records found (Email required).");
                setIsLoading(false);
                return;
            }

            await batchImportRecipients(projectId, recipientsToImport);
            showSuccess("Import complete!");
            onClose();
        } catch (e) {
            showError("Import failed");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-2xl max-w-2xl w-full border border-[var(--color-surface-border)] flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-6 border-b border-[var(--color-surface-border)]">
                    <h2 className="text-xl font-bold">Connect External Database</h2>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {step === 1 && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">API Endpoint URL</label>
                                <div className="flex gap-2">
                                    <select
                                        value={method}
                                        onChange={(e) => setMethod(e.target.value as any)}
                                        className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2"
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                    </select>
                                    <input
                                        type="url"
                                        placeholder="https://api.myservice.com/users"
                                        className="flex-1 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 w-full"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Headers (JSON)</label>
                                <textarea
                                    className="w-full h-32 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2 font-mono text-xs"
                                    value={headers}
                                    onChange={(e) => setHeaders(e.target.value)}
                                />
                            </div>

                            <div className="bg-[var(--color-surface-hover)] p-4 rounded-lg text-sm text-[var(--color-text-muted)]">
                                <p><strong>Note:</strong> ensure CORS is enabled on the target server if calling directly from the browser, or use a proxy.</p>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-sm text-[var(--color-text-muted)]">Found {fetchedData.length} records. Map the fields to import.</p>

                            {fetchedData.length > 0 && Object.keys(fetchedData[0]).map(key => (
                                <div key={key} className="grid grid-cols-2 gap-4 items-center">
                                    <div className="text-sm font-medium">{key} <span className="text-xs text-[var(--color-text-muted)] font-normal">({typeof fetchedData[0][key]})</span></div>
                                    <select
                                        value={columnMapping[key] || ''}
                                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded px-2 py-1.5 w-full text-sm"
                                    >
                                        <option value="">Select Field...</option>
                                        <option value="SKIP">Skip</option>
                                        {existingColumns.map(col => (
                                            <option key={col.key} value={col.key}>{col.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-[var(--color-surface-border)] flex justify-end gap-3 bg-[var(--color-surface-bg)] rounded-b-2xl">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    {step === 1 ? (
                        <Button variant="primary" onClick={handleTestConnection} isLoading={isLoading}>
                            Test Connection
                        </Button>
                    ) : (
                        <Button variant="primary" onClick={handleImport} isLoading={isLoading}>
                            Import Records
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
