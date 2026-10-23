import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Navigate, useLocation, useNavigate, useParams, Outlet } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { GlobalToast } from './components/ui/GlobalToast';
import { OfflineBanner } from './components/OfflineBanner';
import { GlobalConfirmationModal } from './components/ui/GlobalConfirmationModal';
import { Dashboard } from './screens/Dashboard';
import { ProjectsList } from './screens/ProjectsList';
import { Tasks } from './screens/Tasks';
import { Brainstorming } from './screens/Brainstorming';
import { isCoraStudioEnabled } from './config/features';
import { AuthAction } from './screens/AuthAction';
import { Login } from './screens/Login';
import { Calendar } from './screens/Calendar';
import { Team } from './screens/Team';
import { AcceptInvite } from './screens/AcceptInvite';
import { Profile } from './screens/Profile';
import { Notifications } from './screens/Notifications';
import { MediaLibraryPage } from './screens/MediaLibraryPage';
import { PersonalTasksPage } from './screens/PersonalTasksPage';
import { NotFound } from './screens/NotFound';
import { PersonalTaskDetailPage } from './screens/PersonalTaskDetailPage';
import { auth } from './services/firebase';
import { PinnedTasksModal } from './components/PinnedTasksModal';
import { DesktopBridge } from './components/desktop/DesktopBridge';
import { DesktopTitleBar } from './components/desktop/DesktopTitleBar';
import { QuickAccessWindow } from './screens/QuickAccessWindow';
import { QuickCaptureWindow } from './screens/QuickCaptureWindow';
import { DesktopDayWindow } from './screens/DesktopDayWindow';
import { DesktopTrayPanel } from './screens/DesktopTrayPanel';
import { DesktopAuthHandoff } from './screens/DesktopAuthHandoff';
import { OAuthConsent } from './screens/OAuthConsent';
import { SettingsUrlOpener } from './components/settings/SettingsUrlOpener';
import { DESKTOP_QUICK_ACCESS_PATH, desktopWindowKind, isDesktop } from './services/desktop';
import { ErrorPage } from './screens/ErrorPage';
import { HelpCenterDrawer } from './components/help/HelpCenterDrawer';
import { HelpCenterFloatingButton } from './components/help/HelpCenterFloatingButton';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useLanguage } from './context/LanguageContext';
import LegalPage from './screens/LegalPage';
import { LegalConsentGate } from './components/legal/LegalConsentGate';
import { DownloadPage } from './screens/DownloadPage';
import { useModuleAccess } from './hooks/useModuleAccess';
import { useAuth } from './context/AuthContext';
import { useUIState } from './context/UIContext';

// Style guide is a dev-only tool; lazy-loaded so it never ships in the main bundle.
const LegalAdmin = React.lazy(() => import('./screens/LegalAdmin').then((module) => ({ default: module.LegalAdmin })));
const StyleGuidePage = React.lazy(() => import('./screens/StyleGuidePage').then((module) => ({ default: module.StyleGuidePage })));

/** Old project sub-routes now live inside the overview (query params pick the view). */
const LegacyProjectRedirect = ({ query }: { query: string }) => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const [key, value] = query.split('=');
    params.set(key, value);
    return <Navigate to={`/project/${id}?${params.toString()}`} replace />;
};

const ProjectOverview = React.lazy(() => import('./screens/ProjectOverview').then((module) => ({ default: module.ProjectOverview })));
const ProjectTasks = React.lazy(() => import('./screens/ProjectTasks').then((module) => ({ default: module.ProjectTasks })));
const ProjectSprints = React.lazy(() => import('./screens/ProjectSprints').then((module) => ({ default: module.ProjectSprints })));
const ProjectDetails = React.lazy(() => import('./screens/ProjectDetails').then((module) => ({ default: module.ProjectDetails })));
const ProjectTaskDetail = React.lazy(() => import('./screens/ProjectTaskDetail').then((module) => ({ default: module.ProjectTaskDetail })));
const ProjectInitiatives = React.lazy(() => import('./screens/ProjectInitiatives').then((module) => ({ default: module.ProjectInitiatives })));
const ProjectInitiativeDetail = React.lazy(() => import('./screens/ProjectInitiativeDetail').then((module) => ({ default: module.ProjectInitiativeDetail })));
const PublicInitiativeFeedbackPage = React.lazy(() => import('./screens/PublicInitiativeFeedbackPage').then((module) => ({ default: module.PublicInitiativeFeedbackPage })));
const ProjectInvoices = React.lazy(() => import('./screens/ProjectInvoices').then((module) => ({ default: module.ProjectInvoices })));
const ProjectEffort = React.lazy(() => import('./screens/ProjectEffort').then((module) => ({ default: module.ProjectEffort })));
const ProjectActivity = React.lazy(() => import('./screens/ProjectActivity').then((module) => ({ default: module.ProjectActivity })));
const ProjectMilestones = React.lazy(() => import('./screens/ProjectMilestones').then((module) => ({ default: module.ProjectMilestones })));
const OnboardingInsights = React.lazy(() => import('./screens/OnboardingInsights').then((module) => ({ default: module.OnboardingInsights })));
const MarketingLayout = React.lazy(() => import('./screens/marketing/MarketingLayout').then((module) => ({ default: module.MarketingLayout })));
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
    const { t } = useLanguage();

    if (isLoading) {
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

const CreateProjectModalRoute = () => {
    const navigate = useNavigate();
    const { openProjectCreateModal } = useUIState();

    useEffect(() => {
        openProjectCreateModal();
        navigate('/projects', { replace: true });
    }, [navigate, openProjectCreateModal]);

    return null;
};

// Root Layout Component to host global modals dependent on Router
const RootLayout = () => {
    const location = useLocation();
    const isPublicRoute = /^(\/login|\/register|\/invite|\/auth\/action|\/legal|\/feedback|\/download|\/desktop\/auth)/.test(location.pathname);

    // Desktop utility windows (Quick Access pop-out, Quick Capture, day window): only their own content,
    // none of the global overlays (no second Quick Access modal, help, banners, bridge).
    const windowKind = desktopWindowKind();
    const isUtilityWindow = windowKind === 'quick-access' || windowKind === 'capture' || windowKind === 'day' || windowKind === 'tray';
    if (isUtilityWindow && location.pathname.startsWith('/desktop/')) {
        return (
            <>
                <GlobalToast />
                <GlobalConfirmationModal />
                <Outlet />
            </>
        );
    }

    return (
        <>
            {isDesktop() && <DesktopTitleBar mode={isPublicRoute ? 'overlay' : 'inline'} />}
            {windowKind === 'main' && <DesktopBridge />}
            <GlobalToast />
            <OfflineBanner />
            <GlobalConfirmationModal />
            <PinnedTasksModal />
            <HelpCenterDrawer />
            {isPublicRoute && (
                <div className="public-route-language-switcher fixed top-4 right-4 z-[90]">
                    <LanguageSwitcher />
                </div>
            )}
            {isPublicRoute && <HelpCenterFloatingButton />}
            <Outlet />
        </>
    );
};

// Auth Protected Layout
// Reads the user from context so the router itself never has to be rebuilt
// on sign-in/sign-out (that remounted the whole tree and made login flicker).
const AuthenticatedLayout = () => {
    const location = useLocation();
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return (
        <RequireAuth>
            <LegalConsentGate>
                <AppLayout />
                <SettingsUrlOpener />
            </LegalConsentGate>
        </RequireAuth>
    );
};

export const AppRouter = () => {
    const { t } = useLanguage();
    const { isAuthReady } = useAuth();
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
                    <Route path="/download" element={<DownloadPage />} />
                    <Route path="/invite/:tenantId/:inviteId" element={<AcceptInvite />} />
                    <Route path="/feedback/initiative/:token" element={withRouteSuspense(<PublicInitiativeFeedbackPage />)} />
                    {/* Desktop utility windows show workspace data too: they must not bypass the consent gate. */}
                    <Route path={DESKTOP_QUICK_ACCESS_PATH} element={<LegalConsentGate><QuickAccessWindow /></LegalConsentGate>} />
                    <Route path="/desktop/capture" element={<LegalConsentGate><QuickCaptureWindow /></LegalConsentGate>} />
                    <Route path="/desktop/day" element={<LegalConsentGate><DesktopDayWindow /></LegalConsentGate>} />
                    <Route path="/desktop/tray" element={<LegalConsentGate><DesktopTrayPanel /></LegalConsentGate>} />
                    <Route path="/desktop/auth" element={<DesktopAuthHandoff />} />
                    {/* Consent first, then authorize: the gate keeps ?request=… (it never navigates). /desktop/auth stays ungated: it only hands a sign-in code to the desktop app, whose windows are gated. */}
                    <Route path="/oauth/consent" element={<LegalConsentGate><OAuthConsent /></LegalConsentGate>} />
                    {/* Public project intake was removed; old share links land on the app start. */}
                    <Route path="/feedback/project/:token" element={<Navigate to="/" replace />} />

                    {import.meta.env.DEV && (
                        <Route
                            path="/ui"
                            element={
                                <RequireAuth>
                                    {withRouteSuspense(<StyleGuidePage />)}
                                </RequireAuth>
                            }
                        />
                    )}

                    {/* Authenticated Routes Block */}
                    <Route element={<AuthenticatedLayout />}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/notifications" element={<Notifications />} />
                        <Route path="/insights/onboarding" element={withRouteSuspense(<OnboardingInsights />)} />
                        <Route path="/admin/legal" element={withRouteSuspense(<LegalAdmin />)} />
                        <Route path="/projects" element={<ProjectsList />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/finance" element={withRouteSuspense(<FinanceTracking />)} />
                        <Route path="/finance/:financeSection/:financeOperationType" element={withRouteSuspense(<FinanceTracking />)} />
                        <Route path="/finance/:financeSection" element={withRouteSuspense(<FinanceTracking />)} />
                        <Route path="/brainstorm" element={isCoraStudioEnabled() ? <Brainstorming /> : <Navigate to="/" replace />} />
                        <Route path="/create" element={<CreateProjectModalRoute />} />
                        <Route path="/team" element={<Team />} />
                        <Route path="/workspace" element={<Navigate to="/" replace />} />
                        <Route path="/media" element={<MediaLibraryPage />} />
                        <Route path="/profile" element={<Profile />} />

                        <Route path="/personal-tasks" element={<PersonalTasksPage />} />
                        <Route path="/personal-tasks/:taskId" element={<PersonalTaskDetailPage />} />

                        <Route path="/project/:id">
                            <Route index element={withRouteSuspense(<ProjectOverview />)} />
                            <Route path="tasks" element={withRouteSuspense(<ProjectTasks />)} />
                            <Route path="tasks/:taskId" element={withRouteSuspense(<ProjectTaskDetail />)} />
                            <Route path="initiatives" element={withRouteSuspense(<ProjectInitiatives />)} />
                            <Route path="initiatives/:initiativeId" element={withRouteSuspense(<ProjectInitiativeDetail />)} />
                            <Route path="team" element={<LegacyProjectRedirect query="view=people" />} />
                            <Route path="roadmap" element={<LegacyProjectRedirect query="view=roadmap" />} />
                            <Route path="timeline" element={<LegacyProjectRedirect query="view=timeline" />} />
                            <Route path="board" element={<LegacyProjectRedirect query="view=board" />} />
                            <Route path="settings" element={<LegacyProjectRedirect query="settings=general" />} />
                            <Route path="intake" element={<Navigate to=".." relative="path" replace />} />
                            <Route path="invoices" element={withRouteSuspense(<ProjectInvoices />)} />
                            <Route path="effort" element={withRouteSuspense(<ProjectEffort />)} />
                            <Route path="details" element={withRouteSuspense(<ProjectDetails />)} />
                            <Route path="activity" element={withRouteSuspense(<ProjectActivity />)} />
                            {/* The Codex view was removed; keep old links working. */}
                            <Route path="codex" element={<Navigate to=".." relative="path" replace />} />
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
                                path="marketing"
                                element={
                                    <RequireModuleAccess module="marketing">
                                        {withRouteSuspense(<MarketingLayout />)}
                                    </RequireModuleAccess>
                                }
                            >
                                <Route index element={<Navigate to="blog" replace />} />
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

                    <Route path="*" element={<NotFound />} />
                </Route>
            )
        );
    }, [isAuthReady]);

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
