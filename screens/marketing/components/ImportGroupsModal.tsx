import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../context/UIContext';
import { batchImportGroups } from '../../../services/groupService';

interface ImportGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export const ImportGroupsModal: React.FC<ImportGroupsModalProps> = ({ isOpen, onClose, projectId }) => {
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [importing, setImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showSuccess, showError } = useToast();

    if (!isOpen) return null;

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
                if (results.data.length > 0) {
                    const parsedHeaders = Object.keys(results.data[0] as object);
                    setHeaders(parsedHeaders);
                    setData(results.data as Record<string, string>[]);

                    // Auto-map common fields
                    const autoMapping: Record<string, string> = {};
                    parsedHeaders.forEach(h => {
                        const lower = h.toLowerCase();
                        if (lower.includes('name') && !lower.includes('desc')) autoMapping[h] = 'name';
                        else if (lower.includes('desc')) autoMapping[h] = 'description';
                        else if (lower.includes('color') || lower.includes('colour')) autoMapping[h] = 'color';
                    });
                    setMapping(autoMapping);
                    setStep('mapping');
                }
            },
            error: (err) => {
                showError('Failed to parse CSV: ' + err.message);
            }
        });
    };

    const handleMappingChange = (header: string, value: string) => {
        setMapping(prev => {
            const newMapping = { ...prev };
            if (value === '') {
                delete newMapping[header];
            } else {
                newMapping[header] = value;
            }
            return newMapping;
        });
    };

    const handleImport = async () => {
        // Validate: at least name must be mapped
        const nameField = Object.entries(mapping).find(([_, v]) => v === 'name')?.[0];
        if (!nameField) {
            showError('Please map a column to "Name"');
            return;
        }

        setImporting(true);
        try {
            const groups = data.map(row => {
                const group: any = {};
                Object.entries(mapping).forEach(([header, field]) => {
                    if (row[header]) {
                        group[field] = row[header];
                    }
                });
                return group;
            }).filter(g => g.name); // Only import rows with a name

            const count = await batchImportGroups(projectId, groups);
            showSuccess(`Successfully imported ${count} groups`);
            onClose();
            // Reset state
            setStep('upload');
            setFile(null);
            setHeaders([]);
            setData([]);
            setMapping({});
        } catch (error) {
            console.error(error);
            showError('Failed to import groups');
        } finally {
            setImporting(false);
        }
    };

    const targetFields = [
        { value: 'name', label: 'Name (Required)' },
        { value: 'description', label: 'Description' },
        { value: 'color', label: 'Color' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-xl w-full max-w-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="h4">Import Groups</h2>
                    <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="space-y-4">
                        <p className="text-[var(--color-text-muted)]">
                            Upload a CSV file with your groups. The file should have columns for name, and optionally description and color.
                        </p>
                        <div
                            className="border-2 border-dashed border-[var(--color-surface-border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--color-primary)] transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)] mb-2">upload_file</span>
                            <p className="font-medium">Click to upload CSV</p>
                            <p className="text-sm text-[var(--color-text-muted)]">or drag and drop</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Step 2: Mapping */}
                {step === 'mapping' && (
                    <div className="space-y-4">
                        <p className="text-[var(--color-text-muted)]">
                            Map your CSV columns to group fields. Found {data.length} rows.
                        </p>
                        <div className="space-y-3">
                            {headers.map(header => (
                                <div key={header} className="flex items-center gap-4">
                                    <span className="w-1/3 text-sm font-medium truncate">{header}</span>
                                    <span className="material-symbols-outlined text-[var(--color-text-muted)]">arrow_forward</span>
                                    <select
                                        className="flex-1 px-3 py-2 bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] text-sm"
                                        value={mapping[header] || ''}
                                        onChange={(e) => handleMappingChange(header, e.target.value)}
                                    >
                                        <option value="">Skip this column</option>
                                        {targetFields.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {/* Preview */}
                        <div className="mt-4">
                            <h4 className="font-medium mb-2">Preview (first 3 rows)</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[var(--color-surface-bg)]">
                                            {Object.values(mapping).map((field, i) => (
                                                <th key={i} className="px-3 py-2 text-left">{field}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="border-t border-[var(--color-surface-border)]">
                                                {Object.entries(mapping).map(([header, _], j) => (
                                                    <td key={j} className="px-3 py-2">{row[header]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setStep('upload')}>
                                Back
                            </Button>
                            <Button variant="primary" onClick={handleImport} isLoading={importing}>
                                Import {data.length} Groups
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
