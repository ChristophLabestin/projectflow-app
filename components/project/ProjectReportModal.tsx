import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ProjectReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: string | null;
    isLoading: boolean;
    onGenerate: () => void;
    lastUpdated?: Date;
}

export const ProjectReportModal: React.FC<ProjectReportModalProps> = ({
    isOpen,
    onClose,
    report,
    isLoading,
    onGenerate,
    lastUpdated
}) => {
    // Basic markdown parser for headers and lists
    const renderMarkdown = (text: string) => {
        if (!text) return null;

        return text.split('\n').map((line, index) => {
            if (line.startsWith('# ')) {
                return <h1 key={index} className="text-2xl font-bold mt-6 mb-4 text-[var(--color-text-main)]">{line.replace('# ', '')}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={index} className="text-lg font-bold mt-5 mb-3 text-[var(--color-text-main)] border-b border-[var(--color-surface-border)] pb-2">{line.replace('## ', '')}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={index} className="text-base font-bold mt-4 mb-2 text-[var(--color-text-main)]">{line.replace('### ', '')}</h3>;
            }
            if (line.startsWith('- ')) {
                return <li key={index} className="ml-4 mb-1 text-[var(--color-text-main)]">{line.replace('- ', '')}</li>;
            }
            if (line.startsWith('* ')) {
                return <li key={index} className="ml-4 mb-1 text-[var(--color-text-main)]">{line.replace('* ', '')}</li>;
            }
            if (line.trim() === '') {
                return <br key={index} />;
            }

            // Bold text parsing (**text**)
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return (
                <p key={index} className="mb-2 text-[var(--color-text-main)] leading-relaxed">
                    {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={i}>{part.slice(2, -2)}</strong>;
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Project Intelligence Report" size="xl">
            <div className="flex flex-col h-[70vh]">
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                            <div className="size-12 rounded-full border-4 border-[var(--color-primary)]/30 border-t-[var(--color-primary)] animate-spin" />
                            <p className="text-[var(--color-text-muted)] animate-pulse">Generating comprehensive analysis...</p>
                        </div>
                    ) : report ? (
                        <div className="prose dark:prose-invert max-w-none">
                            {lastUpdated && (
                                <p className="text-xs text-[var(--color-text-muted)] mb-6 italic">
                                    Generated on {lastUpdated.toLocaleString()}
                                </p>
                            )}
                            {renderMarkdown(report)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
                            <div className="size-16 bg-[var(--color-primary)]/10 rounded-full flex items-center justify-center mb-4">
                                <span className="material-symbols-outlined text-3xl text-[var(--color-primary)]">auto_awesome</span>
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">Generate Project Report</h3>
                            <p className="text-[var(--color-text-muted)] mb-6">
                                Create a comprehensive status report analyzing tasks, milestones, issues, and team activity to get tailored recommendations.
                            </p>
                            <Button onClick={onGenerate} icon={<span className="material-symbols-outlined">bolt</span>}>
                                Generate Analysis
                            </Button>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-[var(--color-surface-border)] flex justify-between bg-[var(--color-surface-paper)]">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    {!isLoading && report && (
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(report)}>
                                Copy to Clipboard
                            </Button>
                            <Button onClick={onGenerate} icon={<span className="material-symbols-outlined">refresh</span>}>
                                Regenerate
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
