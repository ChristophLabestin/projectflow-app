import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoadingTrack } from '@pf/brand';
import { EnrollMfaScreen, LoginScreen, NoAccessScreen } from './auth/AuthScreens';
import { SessionProvider, useSession } from './auth/session';
import { Layout } from './shell/Layout';
import { UiProvider } from './ui/Overlay';

const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) => lazy(() => loader().then((m) => ({ default: m[name] })));
const AuditLog = named(() => import('./screens/AuditLog'), 'AuditLog');
const Crashes = named(() => import('./screens/Crashes'), 'Crashes');
const CrashDetail = named(() => import('./screens/CrashDetail'), 'CrashDetail');
const LegalOverview = named(() => import('./screens/Legal'), 'LegalOverview');
const LegalEditor = named(() => import('./screens/Legal'), 'LegalEditor');
const Onboarding = named(() => import('./screens/Onboarding'), 'Onboarding');
const BlogList = named(() => import('./screens/Blog'), 'BlogList');
const BlogEditor = named(() => import('./screens/Blog'), 'BlogEditor');
const Leads = named(() => import('./screens/Leads'), 'Leads');
const Overview = named(() => import('./screens/Overview'), 'Overview');
const UsersScreen = named(() => import('./screens/Users'), 'UsersScreen');
const WorkspacesScreen = named(() => import('./screens/Workspaces'), 'WorkspacesScreen');
const AiScreen = named(() => import('./screens/Ai'), 'AiScreen');
const SystemScreen = named(() => import('./screens/System'), 'SystemScreen');
const NewsletterScreen = named(() => import('./screens/Newsletter'), 'NewsletterScreen');
const CampaignEditor = named(() => import('./screens/Campaign'), 'CampaignEditor');
const EmailScreen = named(() => import('./screens/Email'), 'EmailScreen');
const McpAccess = named(() => import('./screens/McpAccess'), 'McpAccess');
const McpConsent = named(() => import('./screens/McpConsent'), 'McpConsent');

const Splash: React.FC<{ text?: string }> = ({ text }) => <div className="ac-splash"><div style={{ display: 'grid', gap: 12, justifyItems: 'center' }}><LoadingTrack />{text}</div></div>;

const Gate: React.FC = () => {
    const { phase } = useSession();
    if (phase === 'loading') return <Splash />;
    if (phase === 'signed-out') return <LoginScreen />;
    if (phase === 'no-access') return <NoAccessScreen />;
    if (phase === 'enroll-mfa') return <EnrollMfaScreen />;
    if (phase === 'starting') return <Splash text="Admin-Sitzung wird geprüft …" />;
    return (
        <Suspense fallback={<Splash />}>
            <Routes>
                <Route element={<Layout />}>
                    <Route index element={<Overview />} />
                    <Route path="users" element={<UsersScreen />} />
                    <Route path="workspaces" element={<WorkspacesScreen />} />
                    <Route path="ai" element={<AiScreen />} />
                    <Route path="system" element={<SystemScreen />} />
                    <Route path="email" element={<EmailScreen />} />
                    <Route path="mcp-access" element={<McpAccess />} />
                    <Route path="oauth/consent" element={<McpConsent />} />
                    <Route path="audit" element={<AuditLog />} />
                    <Route path="crashes" element={<Crashes />} />
                    <Route path="crashes/:id" element={<CrashDetail />} />
                    <Route path="legal" element={<LegalOverview />} />
                    <Route path="legal/:type" element={<LegalEditor />} />
                    <Route path="onboarding" element={<Onboarding />} />
                    <Route path="blog" element={<BlogList />} />
                    <Route path="blog/:id" element={<BlogEditor />} />
                    <Route path="leads" element={<Leads />} />
                    <Route path="newsletter" element={<NewsletterScreen />} />
                    <Route path="newsletter/campaigns/:id" element={<CampaignEditor />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </Suspense>
    );
};

export const App: React.FC = () => (
    <BrowserRouter>
        <UiProvider>
            <SessionProvider>
                <Gate />
            </SessionProvider>
        </UiProvider>
    </BrowserRouter>
);
