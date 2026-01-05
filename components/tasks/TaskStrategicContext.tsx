import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Idea } from '../../types';
import { getIdeaById } from '../../services/dataService';
import { Button } from '../ui/Button';
import { AnalysisDashboard } from '../flows/AnalysisDashboard';

interface TaskStrategicContextProps {
    projectId: string;
    convertedIdeaId: string;
    ideaData?: Idea; // Optional: Pass data directly if already fetched
}

export const TaskStrategicContext: React.FC<TaskStrategicContextProps> = ({ projectId, convertedIdeaId, ideaData }) => {
    const navigate = useNavigate();
    const [fetchedIdea, setFetchedIdea] = useState<Idea | null>(null);
    const [loading, setLoading] = useState(!ideaData);
    const [viewMode, setViewMode] = useState<'analysis' | 'brief'>('analysis');

    const idea = ideaData || fetchedIdea;

    useEffect(() => {
        if (ideaData) {
            setLoading(false);
            return;
        }

        const loadIdea = async () => {
            if (!convertedIdeaId || !projectId) return;
            setLoading(true);
            try {
                const data = await getIdeaById(convertedIdeaId, projectId);
                if (data) {
                    setFetchedIdea(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadIdea();
    }, [convertedIdeaId, projectId, ideaData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <span className="material-symbols-outlined text-subtle animate-spin text-3xl">progress_activity</span>
            </div>
        );
    }

    if (!idea) {
        return (
            <div className="p-8 text-center text-muted">
                <span className="material-symbols-outlined text-4xl mb-2">link_off</span>
                <p>Strategic context not found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-surface rounded-xl border border-surface overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-surface bg-surface-paper flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                        <span className="material-symbols-outlined">lightbulb</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-main">Strategic Context</h3>
                        <p className="text-[10px] text-muted">Originating Flow logic & analysis</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center p-1 bg-surface rounded-lg border border-surface">
                        <button
                            onClick={() => setViewMode('analysis')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'analysis' ? 'bg-surface-hover text-main shadow-sm' : 'text-muted hover:text-main'}`}
                        >
                            Analysis
                        </button>
                        <button
                            onClick={() => setViewMode('brief')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'brief' ? 'bg-surface-hover text-main shadow-sm' : 'text-muted hover:text-main'}`}
                        >
                            Concept Brief
                        </button>
                    </div>

                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(`/project/${projectId}/flows/${idea.id}`, '_blank')}
                        icon={<span className="material-symbols-outlined">open_in_new</span>}
                    >
                        View Flow
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-surface-paper">
                {viewMode === 'analysis' && (
                    <div className="h-full">
                        {/* We reuse the AnalysisDashboard but strip the "run" controls usually by not passing onRunAnalysis */}
                        <AnalysisDashboard
                            analysis={idea.riskWinAnalysis}
                            loading={false}
                        />
                        {(!idea.riskWinAnalysis) && (
                            <div className="p-12 text-center text-muted">
                                <p>No CORA analysis available for this flow.</p>
                            </div>
                        )}
                    </div>
                )}

                {viewMode === 'brief' && (
                    <div className="p-8 max-w-4xl mx-auto">
                        {idea.concept ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <h1>{idea.title}</h1>
                                <div dangerouslySetInnerHTML={{ __html: idea.concept }} />
                            </div>
                        ) : (
                            <div className=" h-full flex flex-col items-center justify-center opacity-40 select-none py-20">
                                <span className="material-symbols-outlined text-6xl mb-4">draft</span>
                                <p className="text-lg italic font-serif">No concept brief drafted.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
