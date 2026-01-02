import React, { useEffect, useState, useMemo } from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Navigate, useLocation, Outlet } from 'react-router-dom';
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
import { ProjectSprints } from './screens/ProjectSprints';
import { ProjectDetails } from './screens/ProjectDetails';
import { ProjectTaskDetail } from './screens/ProjectTaskDetail';
import { ProjectIssueDetail } from './screens/ProjectIssueDetail';
import { ProjectActivity } from './screens/ProjectActivity';
import { ProjectFlows } from './screens/ProjectFlows';
import { FlowDetail } from './screens/FlowDetail';
import { ProjectIssues } from './screens/ProjectIssues';
import { ProjectMilestones } from './screens/ProjectMilestones';
import { AuthAction } from './screens/AuthAction';
import { Login } from './screens/Login';
import { Calendar } from './screens/Calendar';
import { Team } from './screens/Team';
import { InviteLanding } from './screens/InviteLanding';
import { ProjectInviteLanding } from './screens/ProjectInviteLanding';
import { JoinProjectViaLink } from './screens/JoinProjectViaLink';
import { JoinWorkspaceViaLink } from './screens/JoinWorkspaceViaLink';
import { Profile } from './screens/Profile';

import { Notifications } from './screens/Notifications';
import { MediaLibraryPage } from './screens/MediaLibraryPage';
import { PersonalTasksPage } from './screens/PersonalTasksPage';
import { PersonalTaskDetailPage } from './screens/PersonalTaskDetailPage';
import { SocialLayout } from './screens/social/SocialLayout';
import { SocialDashboard } from './screens/social/SocialDashboard';
import { CampaignList } from './screens/social/CampaignList';
import { CampaignDetailView } from './screens/social/CampaignDetailView';
import { PostList } from './screens/social/PostList';
import { SocialCalendar } from './screens/social/SocialCalendar';
import { SocialSettings } from './screens/social/SocialSettings';
import { SocialAssets } from './screens/social/SocialAssets';
import { CreateSocialPost } from './screens/social/CreateSocialPost';
import { CreateCampaignPage } from './screens/social/CreateCampaignPage';
import { SocialCampaignReviewPage } from './screens/social/SocialCampaignReviewPage';
import { SocialApprovalsPage } from './screens/social/SocialApprovalsPage';
import { SocialPostArchive } from './screens/social/SocialPostArchive';
import { MarketingLayout } from './screens/marketing/MarketingLayout';
import { MarketingDashboard } from './screens/marketing/MarketingDashboard';
import { PaidAdsList } from './screens/marketing/PaidAdsList';
import { AdCampaignDetail } from './screens/marketing/AdCampaignDetail';
import { CreateAdCampaignPage } from './screens/marketing/CreateAdCampaignPage';
import { EmailMarketingList } from './screens/marketing/EmailMarketingList';
import { CreateEmailPage } from './screens/marketing/CreateEmailPage';
import { EmailBuilderPage } from './screens/marketing/EmailBuilderPage';
import { RecipientList } from './screens/marketing/RecipientList';
import { MarketingSettings } from './screens/marketing/MarketingSettings';
import { BlogList } from './screens/marketing/BlogList';
import { BlogEditor } from './screens/marketing/BlogEditor';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUIState } from './context/UIContext';
import { PinnedTasksModal } from './components/PinnedTasksModal';
import { PinnedTasksProvider } from './context/PinnedTasksContext';
import { ErrorPage } from './screens/ErrorPage';
import { HelpCenterDrawer } from './components/help/HelpCenterDrawer';
import { HelpCenterFloatingButton } from './components/help/HelpCenterFloatingButton';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useLanguage } from './context/LanguageContext';
import LegalPage from './screens/LegalPage';
import { useModuleAccess } from './hooks/useModuleAccess';
import { AccountingPlaceholder } from './screens/AccountingPlaceholder';

const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();
    const { t } = useLanguage();

    if (!auth) {
        return <div className="p-10 text-center">{t('app.error.authUnavailable')}</div>;
    }

    if (!auth.currentUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <>{children}</>;
};

const RequireModuleAccess = ({ module, children }: { module: string; children?: React.ReactNode }) => {
    const { hasAccess } = useModuleAccess(module);
    const { t } = useLanguage();

    if (!hasAccess) {
        // Redirect or show access denied. 
        // Redirecting to project overview or showing a friendly message.
        // Since we are inside a route, returning <Navigate> works best.
        // But we need the project ID to redirect to project root.
        // We can just go UP one level '..', but safe is redirecting to '/projects' if standalone,
        // or just render a "Not Allowed" message.
        // Let's render a simple Access Denied message to match "not be able to navigate to the pages ... by entering the URL"
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-400 mb-4">lock</span>
                <h2 className="text-xl font-bold mb-2">{t('app.error.accessDenied')}</h2>
                <p className="text-gray-500 max-w-sm">You do not have access to this module.</p>
            </div>
        );
    }
    return <>{children}</>;
};

// Root Layout Component to host global modals dependent on Router
const RootLayout = () => {
    const location = useLocation();
    const isPublicRoute = /^(\/login|\/register|\/invite|\/invite-project|\/join|\/join-workspace|\/auth\/action|\/legal)/.test(location.pathname);

    return (
        <>
            <GlobalToast />
            <GlobalConfirmationModal />
            <PinnedTasksModal />
            <HelpCenterDrawer />
            {isPublicRoute && (
                <div className="fixed top-4 right-4 z-[90]">
                    <LanguageSwitcher />
                </div>
            )}
            {isPublicRoute && <HelpCenterFloatingButton />}
            <Outlet />
        </>
    );
};

// Auth Protected Layout
const AuthenticatedLayout = ({ user }: { user: any }) => {
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <RequireAuth>
            <AppLayout />
        </RequireAuth>
    );
};

const App = () => {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!auth) {
            setError(t('app.error.authInit'));
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
            setError(err.message || t('app.error.authConnection'));
            setLoading(false);
        }
    }, [t]);

    const router = useMemo(() => createBrowserRouter(
        createRoutesFromElements(
            <Route element={<RootLayout />} errorElement={<ErrorPage />}>
                {/* Public / Auth-Action Routes - Higher priority siblings */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Login />} />
                <Route path="/auth/action" element={<AuthAction />} />
                <Route path="/legal/:type" element={<LegalPage />} />
                <Route path="/invite/:tenantId" element={<InviteLanding />} />
                <Route path="/invite-project/:projectId" element={<ProjectInviteLanding />} />
                <Route path="/join/:inviteLinkId" element={<JoinProjectViaLink />} />
                <Route path="/join-workspace/:inviteLinkId" element={<JoinWorkspaceViaLink />} />

                {/* Authenticated Routes Block */}
                <Route element={<AuthenticatedLayout user={user} />}>
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

                    <Route path="/personal-tasks" element={<PersonalTasksPage />} />
                    <Route path="/personal-tasks/:taskId" element={<PersonalTaskDetailPage />} />

                    <Route path="/project/:id">
                        <Route index element={<ProjectOverview />} />
                        <Route path="tasks" element={<ProjectTasks />} />
                        <Route path="tasks/:taskId" element={<ProjectTaskDetail />} />
                        <Route path="details" element={<ProjectDetails />} />
                        <Route path="activity" element={<ProjectActivity />} />
                        <Route path="flows" element={<ProjectFlows />} />
                        <Route path="flows/:flowId" element={<FlowDetail />} />
                        <Route path="ideas" element={<ProjectFlows />} />
                        <Route path="ideas/:flowId" element={<FlowDetail />} />
                        <Route path="issues" element={<ProjectIssues />} />
                        <Route path="issues/:issueId" element={<ProjectIssueDetail />} />
                        <Route path="milestones" element={<ProjectMilestones />} />
                        <Route path="sprints" element={
                            <RequireModuleAccess module="sprints">
                                <ProjectSprints />
                            </RequireModuleAccess>
                        } />

                        <Route path="social" element={
                            <RequireModuleAccess module="social">
                                <SocialLayout />
                            </RequireModuleAccess>
                        }>
                            <Route index element={<SocialDashboard />} />
                            <Route path="campaigns" element={<CampaignList />} />
                            <Route path="campaigns/create" element={<CreateCampaignPage />} />
                            <Route path="campaigns/edit/:campaignId" element={<CreateCampaignPage />} />
                            <Route path="campaigns/:campaignId" element={<CampaignDetailView />} />
                            <Route path="review/:ideaId" element={<SocialCampaignReviewPage />} />

                            <Route path="posts" element={<PostList />} />
                            <Route path="calendar" element={<SocialCalendar />} />
                            <Route path="settings" element={<SocialSettings />} />
                            <Route path="assets" element={<SocialAssets />} />
                        </Route>
                        <Route path="social/create" element={
                            <RequireModuleAccess module="social">
                                <CreateSocialPost />
                            </RequireModuleAccess>
                        } />
                        <Route path="social/edit/:postId" element={
                            <RequireModuleAccess module="social">
                                <CreateSocialPost />
                            </RequireModuleAccess>
                        } />
                        <Route path="social/approvals" element={
                            <RequireModuleAccess module="social">
                                <SocialApprovalsPage />
                            </RequireModuleAccess>
                        } />
                        <Route path="social/archive" element={
                            <RequireModuleAccess module="social">
                                <SocialPostArchive />
                            </RequireModuleAccess>
                        } />

                        <Route path="marketing" element={
                            <RequireModuleAccess module="marketing">
                                <MarketingLayout />
                            </RequireModuleAccess>
                        }>
                            <Route index element={<MarketingDashboard />} />
                            <Route path="ads" element={<PaidAdsList />} />
                            <Route path="ads/create" element={<CreateAdCampaignPage />} />
                            <Route path="ads/:campaignId" element={<AdCampaignDetail />} />
                            <Route path="ads/:campaignId/edit" element={<CreateAdCampaignPage />} />
                            <Route path="email" element={<EmailMarketingList />} />
                            <Route path="email/create" element={<CreateEmailPage />} />
                            <Route path="email/builder" element={<EmailBuilderPage />} />
                            <Route path="recipients" element={<RecipientList />} />
                            <Route path="blog" element={<BlogList />} />
                            <Route path="blog/create" element={<BlogEditor />} />
                            <Route path="blog/:blogId" element={<BlogEditor />} />
                            <Route path="settings" element={<MarketingSettings />} />
                        </Route>

                        <Route path="accounting" element={
                            <RequireModuleAccess module="accounting">
                                <AccountingPlaceholder />
                            </RequireModuleAccess>
                        } />

                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        )
    ), [user]); // Only recreate if user identity changes

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[var(--color-surface-bg)]">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-4xl animate-spin text-[var(--color-primary)]">progress_activity</span>
                    <span className="text-sm font-semibold text-[var(--color-text-muted)]">{t('app.loading.connecting')}</span>
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
                    <p className="text-[var(--color-text-muted)] text-sm text-center">{t('app.error.checkConsole')}</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <RouterProvider router={router} />
        </>
    );
};

export default App;
