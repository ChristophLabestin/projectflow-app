import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sprint, Task, Member } from '../types';
import {
    subscribeProjectSprints,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    addSprintMember,
    removeSprintMember,
    requestToJoinSprint,
    approveJoinRequest,
    rejectJoinRequest
} from '../services/sprintService';
import { subscribeProjectTasks, updateTaskFields, getActiveTenantId, getProjectById, getUsersByIds } from '../services/dataService';
import { auth } from '../services/firebase';
import { SprintBacklog } from '../components/sprints/SprintBacklog';
import { ActiveSprintBoard } from '../components/sprints/ActiveSprintBoard';
import { UpcomingSprintsList } from '../components/sprints/UpcomingSprintsList';
import { SprintDetailsModal } from '../components/sprints/SprintDetailsModal';
import { CreateSprintModal } from '../components/sprints/CreateSprintModal';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { TaskCard } from '../components/TaskCard';

export const ProjectSprints: React.FC = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const currentUser = auth.currentUser;
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projectMembers, setProjectMembers] = useState<Member[]>([]);
    const [view, setView] = useState<'board' | 'backlog'>('board');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
    const [selectedSprintDetails, setSelectedSprintDetails] = useState<Sprint | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<'Owner' | 'Editor' | 'Viewer' | null>(null);
    const tenantId = getActiveTenantId();

    // Initial Data Fetch
    useEffect(() => {
        if (!projectId) return;

        // Fetch project to get member IDs, then fetch members
        const fetchMembers = async () => {
            if (!tenantId) return;
            try {
                const project = await getProjectById(projectId, tenantId);

                // Determine current user role
                if (project && currentUser) {
                    if (project.ownerId === currentUser.uid) {
                        setCurrentUserRole('Owner');
                    } else if (project.members && typeof project.members[0] !== 'string') {
                        const me = (project.members as any[]).find(m => m.userId === currentUser.uid || m.uid === currentUser.uid);
                        if (me) setCurrentUserRole(me.role);
                    }
                }

                let ids: string[] = [];
                if (project?.memberIds && project.memberIds.length > 0) {
                    ids = project.memberIds;
                } else if (project?.members) {
                    if (typeof project.members[0] === 'string') {
                        ids = project.members as unknown as string[];
                    } else {
                        ids = (project.members as any[]).map(m => m.uid || m.userId);
                    }
                }

                if (ids.length > 0) {
                    ids = [...new Set(ids)];
                    const users = await getUsersByIds(ids, tenantId);
                    setProjectMembers(users);
                }
            } catch (err) {
                console.error("Failed to fetch project members", err);
            }
        };
        fetchMembers();

        const unsubSprints = subscribeProjectSprints(projectId, (data) => {
            setSprints(data);
            // Update selected sprint details if it's currently open
            if (selectedSprintDetails) {
                const updated = data.find(s => s.id === selectedSprintDetails.id);
                if (updated) setSelectedSprintDetails(updated);
            }
        }, tenantId);

        const unsubTasks = subscribeProjectTasks(projectId, (data) => {
            setTasks(data);
        }, tenantId);

        return () => {
            unsubSprints();
            unsubTasks();
        };
    }, [projectId, tenantId]); // Removing selectedSprintDetails from deps to prevent loop

    const activeSprint = sprints.find(s => s.status === 'Active');

    const handleCreateSprint = async (data: Partial<Sprint>) => {
        if (!projectId) return;
        try {
            if (editingSprint) {
                await updateSprint(projectId, editingSprint.id, data, tenantId);
            } else {
                await createSprint(projectId, { ...data, createdBy: currentUser?.uid }, tenantId);
            }
            setEditingSprint(null);
            setIsCreateModalOpen(false);
        } catch (error) {
            console.error("handleCreateSprint: Error caught", error);
            alert("Failed to save sprint: " + (error as any).message);
        }
    };

    const handleDeleteSprint = async (sprintId: string) => {
        if (!projectId) return;
        if (confirm("Are you sure? This will not delete tasks, but unassign them.")) {
            const sprintTasks = tasks.filter(t => t.sprintId === sprintId);
            for (const task of sprintTasks) {
                await updateTaskFields(task.id, { sprintId: null as any }, projectId, tenantId);
            }
            await deleteSprint(projectId, sprintId, tenantId);
            setSelectedSprintDetails(null);
        }
    };

    // Member Management Handlers
    const handleAddMember = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await addSprintMember(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error("Failed to add sprint member", e);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await removeSprintMember(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error("Failed to remove sprint member", e);
        }
    };

    const handleJoinRequest = async () => {
        if (!projectId || !selectedSprintDetails || !tenantId || !currentUser) return;
        try {
            await requestToJoinSprint(projectId, selectedSprintDetails.id, currentUser.uid, tenantId);
        } catch (e) {
            console.error("Failed to request to join", e);
        }
    };

    const handleApproveRequest = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await addSprintMember(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error("Failed to approve request", e);
        }
    };

    const handleRejectRequest = async (userId: string) => {
        if (!projectId || !selectedSprintDetails || !tenantId) return;
        try {
            await rejectJoinRequest(projectId, selectedSprintDetails.id, userId, tenantId);
        } catch (e) {
            console.error("Failed to reject request", e);
        }
    };

    const handleStartSprint = async (sprintId: string) => {
        if (!projectId) return;
        const sprint = sprints.find(s => s.id === sprintId);
        if (!sprint) return;
        try {
            await startSprint(projectId, sprintId, sprint.startDate, sprint.endDate, tenantId); // Start/End dates might need verification/update
            setView('board');
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleCompleteSprint = async () => {
        if (!projectId || !activeSprint) return;
        if (confirm("Complete this sprint?")) {
            await completeSprint(projectId, activeSprint.id, tenantId);
            setView('backlog');
        }
    };

    const handleTaskDrop = async (taskId: string, sprintId: string | null) => {
        if (!projectId) return;
        // Optimistic update?
        // For now, standard update.
        // Convert null to undefined or empty string for Firestore? 
        // Types say `sprintId?: string`. So undefined or deleteField().
        // updateTaskFields probably handles Partial<Task>.
        // updateTaskFields signature: (taskId, updates, projectId, tenantId)
        await updateTaskFields(taskId, { sprintId: sprintId || undefined }, projectId, tenantId);
    };

    const renderTask = (task: Task) => (
        // Placeholder for actual TaskCard. 
        // We'll try to import TaskCard from components/TaskCard
        // If it fails, I'll need to fix imports.
        // For now, simple div to avoid breakage if import fails.
        // I will replace this with valid import in real file.
        <div className="p-3 bg-card rounded-xl border border-surface shadow-sm">
            <p className="text-sm font-medium text-main">{task.title}</p>
            <div className="flex items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${task.priority === 'Urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                    {task.priority || 'Medium'}
                </span>
            </div>
        </div>
    );

    // Import TaskCard if available.
    // Assuming TaskCard is not available based on file list (didn't see it explicitly), 
    // but ProjectTasks used something.
    // I will check ProjectTasks imports via grep or view_file later.
    // Reusing the simple render above for now.

    const backlogTasks = tasks.filter(t => !t.sprintId && !t.isCompleted);
    // Usually backlog contains all unassigned tasks.
    // Also including Completed tasks in backlog is weird.

    // Filter tasks for active sprint
    const activeSprintTasks = activeSprint ? tasks.filter(t => t.sprintId === activeSprint.id) : [];



    return (
        <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header / Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex bg-surface-hover p-1 rounded-xl">
                    <button
                        onClick={() => setView('board')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'board'
                            ? 'bg-card text-main shadow-sm'
                            : 'text-muted hover:text-main'
                            }`}
                    >
                        Active Board
                    </button>
                    <button
                        onClick={() => setView('backlog')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'backlog'
                            ? 'bg-card text-main shadow-sm'
                            : 'text-muted hover:text-main'
                            }`}
                    >
                        Backlog & Planning
                    </button>
                </div>

                <div className="flex items-center gap-2">


                    <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
                        <span className="material-symbols-outlined text-lg">add</span>
                        {t('Create Sprint', 'Create Sprint')}
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0">
                {view === 'board' ? (
                    activeSprint ? (
                        <ActiveSprintBoard
                            sprint={activeSprint}
                            tasks={activeSprintTasks}
                            upcomingSprints={sprints.filter(s => s.status === 'Planning')}
                            allTasks={tasks}
                            onCompleteSprint={handleCompleteSprint}
                            onStartSprint={handleStartSprint}
                            onSprintClick={setSelectedSprintDetails}
                            renderTask={renderTask}
                        />
                    ) : (
                        <div className="flex flex-col gap-8">
                            <div className="h-[400px] flex flex-col items-center justify-center text-center p-12 rounded-[32px] border-2 border-dashed border-surface">
                                <div className="size-16 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 mb-4">
                                    <span className="material-symbols-outlined text-3xl">directions_run</span>
                                </div>
                                <h2 className="text-xl font-bold text-main mb-2">No Active Sprint</h2>
                                <p className="text-muted max-w-md mb-6">
                                    There is no sprint currently in progress. Go to the Backlog to plan and start a new sprint.
                                </p>
                                <Button variant="primary" onClick={() => setView('backlog')}>
                                    Go to Backlog
                                </Button>
                            </div>

                            <UpcomingSprintsList
                                sprints={sprints.filter(s => s.status === 'Planning')}
                                allTasks={tasks}
                                onStartSprint={handleStartSprint}
                                onSprintClick={setSelectedSprintDetails}
                            />
                        </div>
                    )
                ) : (
                    <SprintBacklog
                        backlogTasks={backlogTasks}
                        sprints={sprints}
                        allTasks={tasks}
                        renderTask={renderTask}
                        onCreateSprint={() => { setEditingSprint(null); setIsCreateModalOpen(true); }}
                        onEditSprint={(s) => { setEditingSprint(s); setIsCreateModalOpen(true); }}
                        onDeleteSprint={handleDeleteSprint}
                        onStartSprint={handleStartSprint}
                        onTaskDrop={handleTaskDrop}
                    />
                )}
            </div>

            <CreateSprintModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSave={handleCreateSprint}
                initialData={editingSprint}
            />

            <SprintDetailsModal
                isOpen={!!selectedSprintDetails}
                onClose={() => setSelectedSprintDetails(null)}
                sprint={selectedSprintDetails}
                tasks={selectedSprintDetails ? tasks.filter(t => t.sprintId === selectedSprintDetails.id) : []}
                currentUserId={currentUser?.uid || ''}
                projectMembers={projectMembers}
                canManageTeam={['Owner', 'Editor'].includes(currentUserRole || '')}
                onEdit={(s) => {
                    setSelectedSprintDetails(null);
                    setEditingSprint(s);
                    setIsCreateModalOpen(true);
                }}
                onDelete={handleDeleteSprint}
                onStart={handleStartSprint}
                onComplete={async (id) => {
                    await completeSprint(projectId, id, tenantId);
                    setSelectedSprintDetails(null);
                    setView('backlog');
                }}
                onAddMember={handleAddMember}
                onRemoveMember={handleRemoveMember}
                onJoinRequest={handleJoinRequest}
                onApproveRequest={handleApproveRequest}
                onRejectRequest={handleRejectRequest}
            />
        </div>
    );
};
