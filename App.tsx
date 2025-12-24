import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { GlobalToast } from './components/ui/GlobalToast';
import { GlobalConfirmationModal } from './components/ui/GlobalConfirmationModal';
import { Dashboard } from './screens/Dashboard';
import { ProjectsList } from './screens/ProjectsList';
import { Tasks } from './screens/Tasks';
import { Brainstorming } from './screens/Brainstorming';
import { CreateProjectWizard } from './screens/CreateProjectWizard';
import { ProjectOverview } from './screens/ProjectOverview';
import { ProjectTasks } from './screens/ProjectTasks';
import { ProjectDetails } from './screens/ProjectDetails';
import { ProjectTaskDetail } from './screens/ProjectTaskDetail';
import { ProjectIssueDetail } from './screens/ProjectIssueDetail';
import { ProjectActivity } from './screens/ProjectActivity';
import { ProjectIdeas } from './screens/ProjectIdeas';
import { ProjectIssues } from './screens/ProjectIssues';
import { ProjectMindmap } from './screens/ProjectMindmap';
import { ProjectMilestones } from './screens/ProjectMilestones';
import { Login } from './screens/Login';
import { Calendar } from './screens/Calendar';
import { Team } from './screens/Team';
import { InviteLanding } from './screens/InviteLanding';
import { ProjectInviteLanding } from './screens/ProjectInviteLanding';
import { JoinProjectViaLink } from './screens/JoinProjectViaLink';
import { JoinWorkspaceViaLink } from './screens/JoinWorkspaceViaLink';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { Notifications } from './screens/Notifications';
import { MediaLibraryPage } from './screens/MediaLibraryPage';
import { PersonalTasksPage } from './screens/PersonalTasksPage';
import { PersonalTaskDetailPage } from './screens/PersonalTaskDetailPage';
import { SocialLayout } from './screens/social/SocialLayout';
import { SocialDashboard } from './screens/social/SocialDashboard';
import { CampaignList } from './screens/social/CampaignList';
import { PostList } from './screens/social/PostList';
import { SocialCalendar } from './screens/social/SocialCalendar';
import { SocialSettings } from './screens/social/SocialSettings';
import { SocialAssets } from './screens/social/SocialAssets';
import { CreateSocialPost } from './screens/social/CreateSocialPost';
import { MarketingLayout } from './screens/marketing/MarketingLayout';
import { MarketingDashboard } from './screens/marketing/MarketingDashboard';
import { PaidAdsList } from './screens/marketing/PaidAdsList';
import { EmailMarketingList } from './screens/marketing/EmailMarketingList';
import { CreateEmailPage } from './screens/marketing/CreateEmailPage';
import { EmailBuilderPage } from './screens/marketing/EmailBuilderPage';
import { RecipientList } from './screens/marketing/RecipientList';
import { MarketingSettings } from './screens/marketing/MarketingSettings';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUIState } from './context/UIContext';
import { ReleaseToDosModal } from './components/ReleaseToDosModal';
import { PinnedTasksModal } from './components/PinnedTasksModal';
import { PinnedTasksProvider } from './context/PinnedTasksContext';

const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();

    if (!auth) {
        return <div className="p-10 text-center">Firebase Authentication is not available.</div>;
    }

    if (!auth.currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <>{children}</>;
};

const App = () => {
    const [user, setUser] = useState<any>(null);
    const { isReleaseModalOpen, setReleaseModalOpen } = useUIState();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!auth) {
            setError("Firebase Configuration Error: Auth service failed to initialize.");
            setLoading(false);
            return;
        }

        try {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (err: any) {
            console.error("Auth State Change Error:", err);
            setError(err.message || "Failed to connect to authentication service.");
            setLoading(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[var(--color-surface-bg)]">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-4xl animate-spin text-[var(--color-primary)]">progress_activity</span>
                    <span className="text-sm font-semibold text-[var(--color-text-muted)]">Connecting to workspace...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 p-4 bg-[var(--color-surface-bg)]">
                <div className="p-6 text-center space-y-3 bg-white rounded-2xl shadow-xl border border-red-100 max-w-md">
                    <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
                    <p className="text-rose-600 font-bold text-center">{error}</p>
                    <p className="text-[var(--color-text-muted)] text-sm text-center">Please check the console for more details.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <GlobalToast />
            <GlobalConfirmationModal />
            {window.location.hostname === 'localhost' && (
                <ReleaseToDosModal
                    isOpen={isReleaseModalOpen}
                    onClose={() => setReleaseModalOpen(false)}
                />
            )}
            <BrowserRouter>
                <PinnedTasksModal />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/invite/:tenantId" element={<InviteLanding />} />
                    <Route path="/invite-project/:projectId" element={<ProjectInviteLanding />} />
                    <Route path="/join/:inviteLinkId" element={<JoinProjectViaLink />} />
                    <Route path="/join-workspace/:inviteLinkId" element={<JoinWorkspaceViaLink />} />

                    <Route element={user ? <RequireAuth><AppLayout /></RequireAuth> : <Navigate to="/login" replace />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route path="/projects" element={<ProjectsList />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/brainstorm" element={<Brainstorming />} />
                        <Route path="/create" element={<CreateProjectWizard />} />
                        <Route path="/team" element={<Team />} />
                        <Route path="/media" element={<MediaLibraryPage />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/personal-tasks" element={<PersonalTasksPage />} />
                        <Route path="/personal-tasks/:taskId" element={<PersonalTaskDetailPage />} />

                        <Route path="/project/:id">
                            <Route index element={<ProjectOverview />} />
                            <Route path="tasks" element={<ProjectTasks />} />
                            <Route path="tasks/:taskId" element={<ProjectTaskDetail />} />
                            <Route path="details" element={<ProjectDetails />} />
                            <Route path="activity" element={<ProjectActivity />} />
                            <Route path="ideas" element={<ProjectIdeas />} />
                            <Route path="issues" element={<ProjectIssues />} />
                            <Route path="issues/:issueId" element={<ProjectIssueDetail />} />
                            <Route path="mindmap" element={<ProjectMindmap />} />
                            <Route path="milestones" element={<ProjectMilestones />} />
                            <Route path="social" element={<SocialLayout />}>
                                <Route index element={<SocialDashboard />} />
                                <Route path="campaigns" element={<CampaignList />} />
                                <Route path="posts" element={<PostList />} />
                                <Route path="calendar" element={<SocialCalendar />} />
                                <Route path="settings" element={<SocialSettings />} />
                                <Route path="assets" element={<SocialAssets />} />
                            </Route>
                            <Route path="social/create" element={<CreateSocialPost />} />
                            <Route path="social/edit/:postId" element={<CreateSocialPost />} />

                            <Route path="marketing" element={<MarketingLayout />}>
                                <Route index element={<MarketingDashboard />} />
                                <Route path="ads" element={<PaidAdsList />} />
                                <Route path="email" element={<EmailMarketingList />} />
                                <Route path="email/create" element={<CreateEmailPage />} />
                                <Route path="email/builder" element={<EmailBuilderPage />} />
                                <Route path="recipients" element={<RecipientList />} />
                                <Route path="settings" element={<MarketingSettings />} />
                            </Route>
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </>
    );
};

export default App;
