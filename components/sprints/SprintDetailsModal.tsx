import React, { useMemo, useState } from 'react';
import { Sprint, Task, Member } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { format, differenceInDays } from 'date-fns';

interface SprintDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sprint: Sprint | null;
    tasks: Task[];
    currentUserId: string;
    projectMembers?: Member[];
    onEdit: (sprint: Sprint) => void;
    onDelete: (sprintId: string) => void;
    onStart?: (sprintId: string) => void;
    onComplete?: (sprintId: string) => void;
    onAddMember?: (userId: string) => void;
    onRemoveMember?: (userId: string) => void;
    onJoinRequest?: () => void;
    onApproveRequest?: (userId: string) => void;
    onRejectRequest?: (userId: string) => void;
    canManageTeam?: boolean;
}

export const SprintDetailsModal: React.FC<SprintDetailsModalProps> = ({
    isOpen,
    onClose,
    sprint,
    tasks,
    currentUserId,
    projectMembers = [],
    onEdit,
    onDelete,
    onStart,
    onComplete,
    onAddMember,
    onRemoveMember,
    onJoinRequest,
    onApproveRequest,
    onRejectRequest,
    canManageTeam = false
}) => {
    const { t, dateFormat } = useLanguage();
    const [activeTab, setActiveTab] = useState<'overview' | 'team'>('overview');
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

    const stats = useMemo(() => {
        if (!tasks) return { total: 0, completed: 0, progress: 0 };
        const total = tasks.length;
        const completed = tasks.filter(t => t.isCompleted).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, progress };
    }, [tasks]);

    if (!sprint) return null;

    const daysLeft = differenceInDays(new Date(sprint.endDate), new Date());
    const daysUntilStart = differenceInDays(new Date(sprint.startDate), new Date());
    const isOverdue = daysLeft < 0 && sprint.status === 'Active';
    const duration = differenceInDays(new Date(sprint.endDate), new Date(sprint.startDate));

    // Member Helpers
    const isCreator = sprint.createdBy === currentUserId || canManageTeam;
    const isMember = sprint.memberIds?.includes(currentUserId);
    const hasPendingRequest = sprint.joinRequests?.includes(currentUserId);

    // Filter members
    const activeMembers = projectMembers.filter(m => sprint.memberIds?.includes(m.uid));
    const pendingMembers = projectMembers.filter(m => sprint.joinRequests?.includes(m.uid));
    const availableMembers = projectMembers.filter(m => !sprint.memberIds?.includes(m.uid) && !sprint.joinRequests?.includes(m.uid));

    // Status Badge Helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20';
            case 'Completed': return 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20';
            case 'Planning': return 'bg-slate-500 text-white shadow-lg shadow-slate-500/20';
            default: return 'bg-gray-500 text-white';
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            hideHeader={true}
            size="2xl"
            className="!p-0"
            noPadding={true}
        >
            <div className="flex flex-col h-full bg-surface text-main">
                {/* Hero Header */}
                <div className="relative overflow-hidden bg-card border-b border-surface p-8">
                    <div className="absolute top-6 right-6 z-20">
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center p-2 rounded-full text-muted hover:bg-surface-hover hover:text-main transition-colors"
                        >
                            <span className="material-symbols-outlined text-[24px]">close</span>
                        </button>
                    </div>

                    <div className="relative z-10 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${getStatusColor(sprint.status)}`}>
                                {sprint.status}
                            </span>
                            {sprint.autoStart && sprint.status === 'Planning' && (
                                <span className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                                    Auto-start
                                </span>
                            )}
                        </div>

                        <h2 className="text-3xl font-black tracking-tight text-main">{sprint.name}</h2>

                        <div className="flex items-center gap-6 text-sm font-medium text-muted">
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                                {format(new Date(sprint.startDate), dateFormat)} - {format(new Date(sprint.endDate), dateFormat)}
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">schedule</span>
                                {duration} days duration
                            </span>
                        </div>
                    </div>

                    {/* Decorative Background Gradients */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 px-8 border-b border-surface bg-surface">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-main'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`py-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'team' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-main'}`}
                    >
                        Team
                        {(pendingMembers.length > 0 && isCreator) && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar h-[500px]">
                    {activeTab === 'overview' && (
                        <div className="space-y-8">
                            {/* Progress Section */}
                            <div className="bg-card rounded-2xl p-6 border border-surface shadow-sm">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Sprint Progress</h3>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black text-main">{stats.progress}%</span>
                                            <span className="text-sm font-medium text-muted">completed</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-main">{stats.completed} <span className="text-muted">/ {stats.total} Tasks</span></div>
                                    </div>
                                </div>
                                <div className="h-3 w-full bg-surface-hover rounded-full overflow-hidden p-0.5">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out shadow-sm"
                                        style={{ width: `${stats.progress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl border border-surface bg-card">
                                    <div className="flex items-center gap-2 mb-2 text-muted">
                                        <span className="material-symbols-outlined">timer</span>
                                        <span className="text-xs font-bold uppercase tracking-wider">Timeline</span>
                                    </div>
                                    {sprint.status === 'Active' ? (
                                        <div className={`text-lg font-bold ${isOverdue ? 'text-rose-500' : 'text-main'}`}>
                                            {isOverdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`}
                                        </div>
                                    ) : (
                                        <div className="text-lg font-bold text-muted">
                                            {sprint.status === 'Completed' ? 'Sprint Ended' : `Starts in ${daysUntilStart} days`}
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 rounded-2xl border border-surface bg-card">
                                    <div className="flex items-center gap-2 mb-2 text-muted">
                                        <span className="material-symbols-outlined">flag</span>
                                        <span className="text-xs font-bold uppercase tracking-wider">Goal</span>
                                    </div>
                                    <div className="text-sm font-medium text-main line-clamp-2">
                                        {sprint.goal || "No specific goal defined."}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="space-y-8">
                            {/* Actions Header */}
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-main">Sprint Team</h3>
                                <div className="flex gap-2">
                                    {!isMember && !hasPendingRequest && onJoinRequest && (
                                        <Button variant="primary" onClick={onJoinRequest}>Join Sprint</Button>
                                    )}
                                    {hasPendingRequest && (
                                        <Button variant="ghost" disabled>Request Pending</Button>
                                    )}
                                    {isCreator && onAddMember && (
                                        <div className="relative">
                                            <Button variant="outline" onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}>
                                                <span className="material-symbols-outlined text-lg">person_add</span>
                                                Add Member
                                            </Button>
                                            {isAddMemberOpen && (
                                                <div className="absolute top-full right-0 mt-2 w-64 bg-card border border-surface rounded-xl shadow-xl z-50 p-2">
                                                    {availableMembers.length === 0 ? (
                                                        <p className="text-xs text-muted p-2">No available members.</p>
                                                    ) : (
                                                        availableMembers.map(member => (
                                                            <button
                                                                key={member.uid}
                                                                onClick={() => {
                                                                    onAddMember(member.uid);
                                                                    setIsAddMemberOpen(false);
                                                                }}
                                                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover text-left"
                                                            >
                                                                {member.photoURL ? (
                                                                    <img src={member.photoURL} alt={member.displayName} className="w-6 h-6 rounded-full" />
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold">
                                                                        {member.displayName.charAt(0)}
                                                                    </div>
                                                                )}
                                                                <span className="text-sm font-medium text-main truncate">{member.displayName}</span>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pending Requests */}
                            {isCreator && pendingMembers.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Pending Requests</h4>
                                    <div className="space-y-2">
                                        {pendingMembers.map(member => (
                                            <div key={member.uid} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                                                <div className="flex items-center gap-3">
                                                    {member.photoURL ? (
                                                        <img src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">
                                                            {member.displayName.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-bold text-main">{member.displayName}</p>
                                                        <p className="text-xs text-muted">{member.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => onRejectRequest?.(member.uid)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/20 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">close</span>
                                                    </button>
                                                    <button onClick={() => onApproveRequest?.(member.uid)} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors">
                                                        <span className="material-symbols-outlined text-lg">check</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Active Members */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Active Members ({activeMembers.length})</h4>
                                {activeMembers.length === 0 ? (
                                    <div className="text-center py-8 text-muted italic">
                                        No members assigned to this sprint.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {activeMembers.map(member => (
                                            <div key={member.uid} className="flex items-center justify-between p-3 rounded-xl border border-surface bg-card">
                                                <div className="flex items-center gap-3">
                                                    {member.photoURL ? (
                                                        <img src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold">
                                                            {member.displayName.charAt(0)}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-bold text-main">{member.displayName}</p>
                                                            {sprint.createdBy === member.uid && (
                                                                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 px-1.5 py-0.5 rounded">Owner</span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted">{member.email}</p>
                                                    </div>
                                                </div>
                                                {isCreator && member.uid !== sprint.createdBy && onRemoveMember && (
                                                    <button onClick={() => onRemoveMember(member.uid)} className="text-muted hover:text-rose-500 transition-colors p-1">
                                                        <span className="material-symbols-outlined text-lg">remove_circle_outline</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-surface bg-card flex items-center justify-between mt-auto">
                    <Button
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this sprint?')) {
                                onDelete(sprint.id);
                                onClose();
                            }
                        }}
                    >
                        Delete
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => onEdit(sprint)}>
                            Edit Details
                        </Button>
                        {sprint.status === 'Planning' && onStart && (
                            <Button variant="primary" onClick={() => { onStart(sprint.id); onClose(); }} className="px-6 shadow-lg shadow-indigo-500/20">
                                Start Sprint
                            </Button>
                        )}
                        {sprint.status === 'Active' && onComplete && (
                            <Button variant="primary" onClick={() => { onComplete(sprint.id); onClose(); }} className="px-6 shadow-lg shadow-indigo-500/20">
                                Complete Sprint
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
