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
    // Enhanced markdown parser for headers, lists, bold, and inline formatting
    const renderMarkdown = (text: string) => {
        if (!text) return null;

        // Clean up excessive newlines (more than 2 consecutive)
        const cleanedText = text.replace(/\n{3,}/g, '\n\n').trim();

        // Helper to parse inline formatting (bold)
        const parseInline = (line: string) => {
            const parts = line.split(/(\*\*.*?\*\*)/g);
            return parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
                }
                return part;
            });
        };

        const lines = cleanedText.split('\n');
        const elements: React.ReactNode[] = [];
        let skipNext = false;

        lines.forEach((line, index) => {
            if (skipNext) {
                skipNext = false;
                return;
            }

            const trimmedLine = line.trim();

            // Skip completely empty lines (don't add breaks for them)
            if (trimmedLine === '') {
                // Only add spacing if next line has content
                if (index < lines.length - 1 && lines[index + 1].trim() !== '') {
                    elements.push(<div key={`space-${index}`} className="h-2" />);
                }
                return;
            }

            // H1 with emoji support
            if (trimmedLine.startsWith('# ')) {
                elements.push(
                    <h1 key={index} className="text-xl font-bold mt-6 mb-3 text-[var(--color-text-main)] flex items-center gap-2">
                        {parseInline(trimmedLine.replace('# ', ''))}
                    </h1>
                );
                return;
            }

            // H2 with emoji (section headers like 📊, 🚨, etc.)
            if (trimmedLine.startsWith('## ') || /^[📊🚨📅🏗🐛💡✅⚠️🔥]/.test(trimmedLine)) {
                const content = trimmedLine.startsWith('## ') ? trimmedLine.replace('## ', '') : trimmedLine;
                elements.push(
                    <h2 key={index} className="text-lg font-bold mt-5 mb-2 text-[var(--color-text-main)] border-b border-[var(--color-surface-border)] pb-2">
                        {parseInline(content)}
                    </h2>
                );
                return;
            }

            // H3
            if (trimmedLine.startsWith('### ')) {
                elements.push(
                    <h3 key={index} className="text-base font-semibold mt-4 mb-2 text-[var(--color-text-main)]">
                        {parseInline(trimmedLine.replace('### ', ''))}
                    </h3>
                );
                return;
            }

            // Numbered list items
            if (/^\d+\.\s/.test(trimmedLine)) {
                elements.push(
                    <div key={index} className="flex gap-2 ml-2 mb-2">
                        <span className="text-[var(--color-primary)] font-bold shrink-0">{trimmedLine.match(/^\d+/)?.[0]}.</span>
                        <p className="text-[var(--color-text-main)] leading-relaxed">{parseInline(trimmedLine.replace(/^\d+\.\s/, ''))}</p>
                    </div>
                );
                return;
            }

            // Bullet list items (- or *)
            if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                elements.push(
                    <div key={index} className="flex gap-2 ml-2 mb-1.5 items-baseline">
                        <span className="text-[var(--color-primary)]">•</span>
                        <p className="text-[var(--color-text-main)] leading-relaxed flex-1">{parseInline(trimmedLine.replace(/^[-*]\s/, ''))}</p>
                    </div>
                );
                return;
            }

            // Regular paragraph
            elements.push(
                <p key={index} className="mb-2 text-[var(--color-text-main)] leading-relaxed">
                    {parseInline(trimmedLine)}
                </p>
            );
        });

        return elements;
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
