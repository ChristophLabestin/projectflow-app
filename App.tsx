import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { ProjectsList } from './screens/ProjectsList';
import { Tasks } from './screens/Tasks';
import { Brainstorming } from './screens/Brainstorming';
import { CreateProjectSelect } from './screens/CreateProjectSelect';
import { CreateProjectForm } from './screens/CreateProjectForm';
import { ProjectOverview } from './screens/ProjectOverview';
import { ProjectLayout } from './components/ProjectLayout';
import { ProjectTasks } from './screens/ProjectTasks';
import { ProjectDetails } from './screens/ProjectDetails';
import { ProjectTaskDetail } from './screens/ProjectTaskDetail';
import { ProjectActivity } from './screens/ProjectActivity';
import { ProjectIdeas } from './screens/ProjectIdeas';
import { ProjectMindmap } from './screens/ProjectMindmap';
import { Login } from './screens/Login';
import { Team } from './screens/Team';
import { InviteLanding } from './screens/InviteLanding';
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

// Routes using the standard Layout (Global Sidebar)
const MainLayoutRoutes = () => (
    <Layout>
        <Routes>
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth><ProjectsList /></RequireAuth>} />
            <Route path="/tasks" element={<RequireAuth><Tasks /></RequireAuth>} />
            <Route path="/brainstorm" element={<RequireAuth><Brainstorming /></RequireAuth>} />
            <Route path="/create" element={<RequireAuth><CreateProjectSelect /></RequireAuth>} />
            <Route path="/create/form" element={<RequireAuth><CreateProjectForm /></RequireAuth>} />
            <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
        </Routes>
    </Layout>
);

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
            <div className="h-screen w-full flex items-center justify-center bg-white dark:bg-black">
                <span className="material-symbols-outlined text-4xl animate-spin text-gray-400">progress_activity</span>
            </div>
        );
    }

    if (error) {
        return (
             <div className="h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-black gap-4 p-4">
                <span className="material-symbols-outlined text-4xl text-red-500">error</span>
                <p className="text-red-500 font-bold text-center">{error}</p>
                <p className="text-gray-500 text-sm text-center">Please check the console for more details.</p>
            </div>
        );
    }

    return (
        <HashRouter>
            <Routes>
                <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
                <Route path="/invite/:tenantId" element={<InviteLanding />} />
                
                {/* Project workspace */}
                <Route path="/project/:id/*" element={user ? <RequireAuth><ProjectLayout /></RequireAuth> : <Navigate to="/login" replace />}>
                    <Route index element={<ProjectOverview />} />
                    <Route path="tasks" element={<ProjectTasks />} />
                    <Route path="tasks/:taskId" element={<ProjectTaskDetail />} />
                    <Route path="details" element={<ProjectDetails />} />
                    <Route path="activity" element={<ProjectActivity />} />
                    <Route path="ideas" element={<ProjectIdeas />} />
                    <Route path="mindmap" element={<ProjectMindmap />} />
                </Route>
                
                {/* Fallback to Main Routes for root and others */}
                <Route path="/*" element={user ? <MainLayoutRoutes /> : <Navigate to="/login" replace />} />
            </Routes>
        </HashRouter>
    );
};

export default App;
