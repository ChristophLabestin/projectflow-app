import React from 'react';
import { Idea } from '../../../types';
import { Button } from '../../ui/Button';
import { DatePicker } from '../../ui/DatePicker';

interface SocialScheduledViewProps {
    idea: Idea;
    onUpdate: (updates: Partial<Idea>) => void;
}

interface ScheduleData {
    publishDate: string; // ISO string
    checklist: {
        grammar: boolean;
        links: boolean;
        images: boolean;
        approvals: boolean;
    };
    notes: string;
}

export const SocialScheduledView: React.FC<SocialScheduledViewProps> = ({ idea, onUpdate }) => {

    const schedule: ScheduleData = (() => {
        try {
            if (idea.concept && idea.concept.startsWith('{')) {
                const parsed = JSON.parse(idea.concept);
                return {
                    publishDate: parsed.publishDate || '',
                    checklist: parsed.checklist || { grammar: false, links: false, images: false, approvals: false },
                    notes: parsed.scheduleNotes || '',
                    ...parsed
                };
            }
        } catch { }
        return {
            publishDate: '',
            checklist: { grammar: false, links: false, images: false, approvals: false },
            notes: ''
        };
    })();

    const updateSchedule = (updates: Partial<ScheduleData>) => {
        const newData = { ...schedule, ...updates };
        if (updates.notes !== undefined) {
            // @ts-ignore
            newData.scheduleNotes = updates.notes;
        }
        onUpdate({ concept: JSON.stringify(newData) });
    };

    const toggleChecklist = (key: keyof typeof schedule.checklist) => {
        updateSchedule({
            checklist: {
                ...schedule.checklist,
                [key]: !schedule.checklist[key]
            }
        });
    };

    const isReady = schedule.publishDate && Object.values(schedule.checklist).every(Boolean);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Left Col: Scheduling Controls */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 relative">
                <div className="mb-6">
                    <h2 className="text-xl font-extrabold text-[var(--color-text-main)] tracking-tight">Scheduling</h2>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Plan the launch</p>
                    <div className="h-1 w-10 bg-indigo-500 rounded-full mt-3" />
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Publish Date & Time</label>
                        <DatePicker
                            date={schedule.publishDate ? new Date(schedule.publishDate) : undefined}
                            onSelect={(date) => updateSchedule({ publishDate: date ? date.toISOString() : '' })}
                            className="w-full"
                        />
                        {schedule.publishDate && (
                            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium">
                                Scheduled for: {new Date(schedule.publishDate).toLocaleString()}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 block">Notes to Poster</label>
                        <textarea
                            value={schedule.notes}
                            onChange={(e) => updateSchedule({ notes: e.target.value })}
                            placeholder="Any specific instructions for posting?"
                            rows={4}
                            className="w-full text-sm bg-[var(--color-surface-bg)] border border-[var(--color-surface-border)] rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Middle Col: Pre-flight Checklist */}
            <div className="col-span-1 flex flex-col h-full bg-white dark:bg-slate-900/50 rounded-2xl border border-[var(--color-surface-border)] shadow-sm p-6 overflow-hidden">
                <div className="mb-4">
                    <h3 className="font-bold text-[var(--color-text-main)]">Pre-flight Checklist</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Ensure everything is perfect</p>
                </div>

                <div className="space-y-3">
                    {[
                        { key: 'grammar', label: 'Grammar & Copy Editing Check' },
                        { key: 'links', label: 'All Links Working & Verified' },
                        { key: 'images', label: 'Images/Video Assets Correct' },
                        { key: 'approvals', label: 'Stakeholder Approval Received' }
                    ].map(item => (
                        <div
                            key={item.key}
                            onClick={() => toggleChecklist(item.key as keyof typeof schedule.checklist)}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${schedule.checklist[item.key as keyof typeof schedule.checklist]
                                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                                : 'bg-[var(--color-surface-bg)] border-[var(--color-surface-border)] hover:border-[var(--color-text-muted)]'
                                }`}
                        >
                            <div className={`size-5 rounded flex items-center justify-center border transition-colors ${schedule.checklist[item.key as keyof typeof schedule.checklist]
                                ? 'bg-emerald-500 border-emerald-500 text-white'
                                : 'border-[var(--color-text-muted)] bg-white dark:bg-slate-800'
                                }`}>
                                {schedule.checklist[item.key as keyof typeof schedule.checklist] && <span className="material-symbols-outlined text-[16px]">check</span>}
                            </div>
                            <span className={`text-sm font-medium ${schedule.checklist[item.key as keyof typeof schedule.checklist]
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-[var(--color-text-main)]'
                                }`}>{item.label}</span>
                        </div>
                    ))}
                </div>

                <div className="mt-auto pt-6">
                    <Button
                        disabled={!isReady}
                        className={`w-full h-12 text-base justify-center gap-2 transition-all rounded-xl ${isReady
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg'
                            : 'bg-[var(--color-surface-disabled)] text-[var(--color-text-disabled)] cursor-not-allowed'
                            }`}
                        // Advance to Posted (Live)
                        onClick={() => onUpdate({ stage: 'Posted' })}
                    >
                        <span>Post Now</span>
                        <span className="material-symbols-outlined">send</span>
                    </Button>
                    {!isReady && <p className="text-[10px] text-center text-rose-500 mt-2">Complete checklist and set date to post</p>}
                </div>
            </div>

            {/* Right Col: Read Only Summary */}
            <div className="col-span-1 lg:col-span-1 flex flex-col h-full bg-[var(--color-surface-paper)] rounded-2xl border border-[var(--color-surface-border)] shadow-inner p-6 overflow-hidden opacity-90">
                <div className="mb-4 pb-4 border-b border-[var(--color-surface-border)]">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wide">Preview</span>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed text-[var(--color-text-main)] whitespace-pre-wrap">
                    {
                        // @ts-ignore
                        schedule.copy || <span className="text-[var(--color-text-muted)] italic">No copy draft found...</span>
                    }
                </div>
            </div>
        </div>
    );
};
