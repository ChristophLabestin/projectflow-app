import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ThemeProvider } from './context/ThemeContext';
import { Dashboard } from './screens/Dashboard';
import { ProjectsList } from './screens/ProjectsList';
import { Tasks } from './screens/Tasks';
import { Brainstorming } from './screens/Brainstorming';
import { CreateProjectSelect } from './screens/CreateProjectSelect';
import { CreateProjectForm } from './screens/CreateProjectForm';
import { ProjectOverview } from './screens/ProjectOverview';
import { ProjectTasks } from './screens/ProjectTasks';
import { ProjectDetails } from './screens/ProjectDetails';
import { ProjectTaskDetail } from './screens/ProjectTaskDetail';
import { ProjectIssueDetail } from './screens/ProjectIssueDetail';
import { ProjectActivity } from './screens/ProjectActivity';
import { ProjectIdeas } from './screens/ProjectIdeas';
import { ProjectIssues } from './screens/ProjectIssues';
import { ProjectMindmap } from './screens/ProjectMindmap';
import { Login } from './screens/Login';
import { Calendar } from './screens/Calendar';
import { Team } from './screens/Team';
import { InviteLanding } from './screens/InviteLanding';
import { ProjectInviteLanding } from './screens/ProjectInviteLanding';
import { Profile } from './screens/Profile';
import { Settings } from './screens/Settings';
import { auth } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const RequireAuth = ({ children }: { children?: React.ReactNode }) => {
    const location = useLocation();

    // Safety check if auth failed to load
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
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <HashRouter>
                <Routes>
                    <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
                    <Route path="/invite/:tenantId" element={<InviteLanding />} />
                    <Route path="/invite-project/:projectId" element={<ProjectInviteLanding />} />

                    {/* Main App with Protected Routes */}
                    <Route element={user ? <RequireAuth><AppLayout /></RequireAuth> : <Navigate to="/login" replace />}>
                        {/* Global Routes */}
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/projects" element={<ProjectsList />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/calendar" element={<Calendar />} />
                        <Route path="/brainstorm" element={<Brainstorming />} />
                        <Route path="/create" element={<CreateProjectSelect />} />
                        <Route path="/create/form" element={<CreateProjectForm />} />
                        <Route path="/create/form" element={<CreateProjectForm />} />
                        <Route path="/team" element={<Team />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />

                        {/* Project Specific Routes */}
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
                        </Route>
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </HashRouter>
        </ThemeProvider>
    );
};

export default App;
