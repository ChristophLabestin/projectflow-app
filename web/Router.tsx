import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Navigate, useLocation, Outlet } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { GlobalToast } from './components/ui/GlobalToast';
import { GlobalConfirmationModal } from './components/ui/GlobalConfirmationModal';
import { Dashboard } from './screens/Dashboard';
import { ProjectsList } from './screens/ProjectsList';
import { Tasks } from './screens/Tasks';
import { Brainstorming } from './screens/Brainstorming';
import { CreateProjectWizard } from './screens/CreateProjectWizard';
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
import { StyleGuidePage } from './screens/StyleGuidePage';
import { PersonalTaskDetailPage } from './screens/PersonalTaskDetailPage';
import { auth } from './services/firebase';
import { PinnedTasksModal } from './components/PinnedTasksModal';
import { ErrorPage } from './screens/ErrorPage';
import { HelpCenterDrawer } from './components/help/HelpCenterDrawer';
import { HelpCenterFloatingButton } from './components/help/HelpCenterFloatingButton';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useLanguage } from './context/LanguageContext';
import LegalPage from './screens/LegalPage';
import { useModuleAccess } from './hooks/useModuleAccess';
import { useAuth } from './context/AuthContext';

const ProjectOverview = React.lazy(() => import('./screens/ProjectOverview').then((module) => ({ default: module.ProjectOverview })));
const ProjectTasks = React.lazy(() => import('./screens/ProjectTasks').then((module) => ({ default: module.ProjectTasks })));
const ProjectSprints = React.lazy(() => import('./screens/ProjectSprints').then((module) => ({ default: module.ProjectSprints })));
const ProjectDetails = React.lazy(() => import('./screens/ProjectDetails').then((module) => ({ default: module.ProjectDetails })));
const ProjectTaskDetail = React.lazy(() => import('./screens/ProjectTaskDetail').then((module) => ({ default: module.ProjectTaskDetail })));
const ProjectIssueDetail = React.lazy(() => import('./screens/ProjectIssueDetail').then((module) => ({ default: module.ProjectIssueDetail })));
const ProjectActivity = React.lazy(() => import('./screens/ProjectActivity').then((module) => ({ default: module.ProjectActivity })));
const ProjectFlows = React.lazy(() => import('./screens/ProjectFlows').then((module) => ({ default: module.ProjectFlows })));
const FlowDetail = React.lazy(() => import('./screens/FlowDetail').then((module) => ({ default: module.FlowDetail })));
const ProjectIssues = React.lazy(() => import('./screens/ProjectIssues').then((module) => ({ default: module.ProjectIssues })));
const ProjectMilestones = React.lazy(() => import('./screens/ProjectMilestones').then((module) => ({ default: module.ProjectMilestones })));
const SocialLayout = React.lazy(() => import('./screens/social/SocialLayout').then((module) => ({ default: module.SocialLayout })));
const SocialDashboard = React.lazy(() => import('./screens/social/SocialDashboard').then((module) => ({ default: module.SocialDashboard })));
const CampaignList = React.lazy(() => import('./screens/social/CampaignList').then((module) => ({ default: module.CampaignList })));
const CampaignDetailView = React.lazy(() => import('./screens/social/CampaignDetailView').then((module) => ({ default: module.CampaignDetailView })));
const PostList = React.lazy(() => import('./screens/social/PostList').then((module) => ({ default: module.PostList })));
const SocialCalendar = React.lazy(() => import('./screens/social/SocialCalendar').then((module) => ({ default: module.SocialCalendar })));
const SocialSettings = React.lazy(() => import('./screens/social/SocialSettings').then((module) => ({ default: module.SocialSettings })));
const SocialAssets = React.lazy(() => import('./screens/social/SocialAssets').then((module) => ({ default: module.SocialAssets })));
const CreateSocialPost = React.lazy(() => import('./screens/social/CreateSocialPost').then((module) => ({ default: module.CreateSocialPost })));
const CreateCampaignPage = React.lazy(() => import('./screens/social/CreateCampaignPage').then((module) => ({ default: module.CreateCampaignPage })));
const SocialCampaignReviewPage = React.lazy(() => import('./screens/social/SocialCampaignReviewPage').then((module) => ({ default: module.SocialCampaignReviewPage })));
const SocialApprovalsPage = React.lazy(() => import('./screens/social/SocialApprovalsPage').then((module) => ({ default: module.SocialApprovalsPage })));
const SocialPostArchive = React.lazy(() => import('./screens/social/SocialPostArchive').then((module) => ({ default: module.SocialPostArchive })));
const MarketingLayout = React.lazy(() => import('./screens/marketing/MarketingLayout').then((module) => ({ default: module.MarketingLayout })));
const MarketingDashboard = React.lazy(() => import('./screens/marketing/MarketingDashboard').then((module) => ({ default: module.MarketingDashboard })));
const PaidAdsList = React.lazy(() => import('./screens/marketing/PaidAdsList').then((module) => ({ default: module.PaidAdsList })));
const AdCampaignDetail = React.lazy(() => import('./screens/marketing/AdCampaignDetail').then((module) => ({ default: module.AdCampaignDetail })));
const CreateAdCampaignPage = React.lazy(() => import('./screens/marketing/CreateAdCampaignPage').then((module) => ({ default: module.CreateAdCampaignPage })));
const EmailMarketingList = React.lazy(() => import('./screens/marketing/EmailMarketingList').then((module) => ({ default: module.EmailMarketingList })));
const CreateEmailPage = React.lazy(() => import('./screens/marketing/CreateEmailPage').then((module) => ({ default: module.CreateEmailPage })));
const EmailBuilderPage = React.lazy(() => import('./screens/marketing/EmailBuilderPage').then((module) => ({ default: module.EmailBuilderPage })));
const RecipientList = React.lazy(() => import('./screens/marketing/RecipientList').then((module) => ({ default: module.RecipientList })));
const MarketingSettings = React.lazy(() => import('./screens/marketing/MarketingSettings').then((module) => ({ default: module.MarketingSettings })));
const BlogList = React.lazy(() => import('./screens/marketing/BlogList').then((module) => ({ default: module.BlogList })));
const BlogEditor = React.lazy(() => import('./screens/marketing/BlogEditor').then((module) => ({ default: module.BlogEditor })));
const AccountingPlaceholder = React.lazy(() => import('./screens/AccountingPlaceholder').then((module) => ({ default: module.AccountingPlaceholder })));
const FinanceTracking = React.lazy(() => import('./screens/FinanceTracking').then((module) => ({ default: module.FinanceTracking })));

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
    const { hasAccess, isLoading } = useModuleAccess(module);
    const { t, socialTranslationsReady, loadSocialTranslations } = useLanguage();

    useEffect(() => {
        if (module === 'social') {
            void loadSocialTranslations();
        }
    }, [loadSocialTranslations, module]);

    if (isLoading || (module === 'social' && !socialTranslationsReady)) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-400 mb-4">hourglass_top</span>
                <h2 className="text-xl font-bold mb-2">{t('app.loading.moduleAccess')}</h2>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-400 mb-4">lock</span>
                <h2 className="text-xl font-bold mb-2">{t('app.error.accessDenied')}</h2>
                <p className="text-gray-500 max-w-sm">{t('app.error.moduleAccessMessage')}</p>
            </div>
        );
    }
    return <>{children}</>;
};

const RoutePending = () => {
    const { t } = useLanguage();

    return (
        <div className="flex flex-col items-center justify-center h-full p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-gray-400 mb-4">progress_activity</span>
            <h2 className="text-xl font-bold mb-2">{t('app.loading.connecting')}</h2>
        </div>
    );
};

const withRouteSuspense = (children: React.ReactNode) => (
    <Suspense fallback={<RoutePending />}>
        {children}
    </Suspense>
);

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

export const AppRouter = () => {
    const { t } = useLanguage();
    const { user, isAuthReady } = useAuth();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!auth) {
            setError(t('app.error.authInit'));
        }
    }, [t]);

    const router = useMemo(() => {
        if (!isAuthReady) return null;

        return createBrowserRouter(
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

                    <Route
                        path="/ui"
                        element={
                            <RequireAuth>
                                <StyleGuidePage />
                            </RequireAuth>
                        }
                    />

                    {/* Authenticated Routes Block */}
                    <Route element={<AuthenticatedLayout user={user} />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route path="/projects" element={<ProjectsList />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/finance" element={withRouteSuspense(<FinanceTracking />)} />
                        <Route path="/finance/:financeSection" element={withRouteSuspense(<FinanceTracking />)} />
                        <Route path="/brainstorm" element={<Brainstorming />} />
                        <Route path="/create" element={<CreateProjectWizard />} />
                        <Route path="/team" element={<Team />} />
                        <Route path="/media" element={<MediaLibraryPage />} />
                        <Route path="/profile" element={<Profile />} />

                        <Route path="/personal-tasks" element={<PersonalTasksPage />} />
                        <Route path="/personal-tasks/:taskId" element={<PersonalTaskDetailPage />} />

                        <Route path="/project/:id">
                            <Route index element={withRouteSuspense(<ProjectOverview />)} />
                            <Route path="tasks" element={withRouteSuspense(<ProjectTasks />)} />
                            <Route path="tasks/:taskId" element={withRouteSuspense(<ProjectTaskDetail />)} />
                            <Route path="details" element={withRouteSuspense(<ProjectDetails />)} />
                            <Route path="activity" element={withRouteSuspense(<ProjectActivity />)} />
                            <Route path="flows" element={withRouteSuspense(<ProjectFlows />)} />
                            <Route path="flows/:flowId" element={withRouteSuspense(<FlowDetail />)} />
                            <Route path="ideas" element={withRouteSuspense(<ProjectFlows />)} />
                            <Route path="ideas/:flowId" element={withRouteSuspense(<FlowDetail />)} />
                            <Route path="issues" element={withRouteSuspense(<ProjectIssues />)} />
                            <Route path="issues/:issueId" element={withRouteSuspense(<ProjectIssueDetail />)} />
                            <Route path="milestones" element={withRouteSuspense(<ProjectMilestones />)} />
                            <Route
                                path="sprints"
                                element={
                                    <RequireModuleAccess module="sprints">
                                        {withRouteSuspense(<ProjectSprints />)}
                                    </RequireModuleAccess>
                                }
                            />

                            <Route
                                path="social"
                                element={
                                    <RequireModuleAccess module="social">
                                        {withRouteSuspense(<SocialLayout />)}
                                    </RequireModuleAccess>
                                }
                            >
                                <Route index element={withRouteSuspense(<SocialDashboard />)} />
                                <Route path="campaigns" element={withRouteSuspense(<CampaignList />)} />
                                <Route path="campaigns/create" element={withRouteSuspense(<CreateCampaignPage />)} />
                                <Route path="campaigns/edit/:campaignId" element={withRouteSuspense(<CreateCampaignPage />)} />
                                <Route path="campaigns/:campaignId" element={withRouteSuspense(<CampaignDetailView />)} />
                                <Route path="review/:ideaId" element={withRouteSuspense(<SocialCampaignReviewPage />)} />

                                <Route path="posts" element={withRouteSuspense(<PostList />)} />
                                <Route path="calendar" element={withRouteSuspense(<SocialCalendar />)} />
                                <Route path="settings" element={withRouteSuspense(<SocialSettings />)} />
                                <Route path="assets" element={withRouteSuspense(<SocialAssets />)} />
                            </Route>
                            <Route
                                path="social/create"
                                element={
                                    <RequireModuleAccess module="social">
                                        {withRouteSuspense(<CreateSocialPost />)}
                                    </RequireModuleAccess>
                                }
                            />
                            <Route
                                path="social/edit/:postId"
                                element={
                                    <RequireModuleAccess module="social">
                                        {withRouteSuspense(<CreateSocialPost />)}
                                    </RequireModuleAccess>
                                }
                            />
                            <Route
                                path="social/approvals"
                                element={
                                    <RequireModuleAccess module="social">
                                        {withRouteSuspense(<SocialApprovalsPage />)}
                                    </RequireModuleAccess>
                                }
                            />
                            <Route
                                path="social/archive"
                                element={
                                    <RequireModuleAccess module="social">
                                        {withRouteSuspense(<SocialPostArchive />)}
                                    </RequireModuleAccess>
                                }
                            />

                            <Route
                                path="marketing"
                                element={
                                    <RequireModuleAccess module="marketing">
                                        {withRouteSuspense(<MarketingLayout />)}
                                    </RequireModuleAccess>
                                }
                            >
                                <Route index element={withRouteSuspense(<MarketingDashboard />)} />
                                <Route path="ads" element={withRouteSuspense(<PaidAdsList />)} />
                                <Route path="ads/create" element={withRouteSuspense(<CreateAdCampaignPage />)} />
                                <Route path="ads/:campaignId" element={withRouteSuspense(<AdCampaignDetail />)} />
                                <Route path="ads/:campaignId/edit" element={withRouteSuspense(<CreateAdCampaignPage />)} />
                                <Route path="email" element={withRouteSuspense(<EmailMarketingList />)} />
                                <Route path="email/create" element={withRouteSuspense(<CreateEmailPage />)} />
                                <Route path="email/builder" element={withRouteSuspense(<EmailBuilderPage />)} />
                                <Route path="recipients" element={withRouteSuspense(<RecipientList />)} />
                                <Route path="blog" element={withRouteSuspense(<BlogList />)} />
                                <Route path="blog/create" element={withRouteSuspense(<BlogEditor />)} />
                                <Route path="blog/:blogId" element={withRouteSuspense(<BlogEditor />)} />
                                <Route path="settings" element={withRouteSuspense(<MarketingSettings />)} />
                            </Route>

                            <Route
                                path="accounting"
                                element={
                                    <RequireModuleAccess module="accounting">
                                        {withRouteSuspense(<AccountingPlaceholder />)}
                                    </RequireModuleAccess>
                                }
                            />
                        </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            )
        );
    }, [isAuthReady, user]);

    if (!isAuthReady || !router) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-surface">
                <div className="flex flex-col items-center gap-4">
                    <span className="material-symbols-outlined text-4xl animate-spin text-primary">progress_activity</span>
                    <span className="text-sm font-semibold text-muted">{t('app.loading.connecting')}</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 p-4 bg-surface">
                <div className="p-6 text-center space-y-3 bg-white rounded-2xl shadow-xl border border-red-100 max-w-md">
                    <span className="material-symbols-outlined text-4xl text-rose-500">error</span>
                    <p className="text-rose-600 font-bold text-center">{error}</p>
                    <p className="text-muted text-sm text-center">{t('app.error.checkConsole')}</p>
                </div>
            </div>
        );
    }

    return <RouterProvider router={router} />;
};
