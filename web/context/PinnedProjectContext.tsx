import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getProjectById } from '../services/dataService';
import { Project } from '../types';

interface PinnedProjectContextType {
    pinnedProjectId: string | null;
    pinnedProject: Project | null;
    isLoading: boolean;
    pinProject: (projectId: string) => Promise<void>;
    unpinProject: () => Promise<void>;
}

const PinnedProjectContext = createContext<PinnedProjectContextType | undefined>(undefined);

export const PinnedProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pinnedProjectId, setPinnedProjectId] = useState<string | null>(null);
    const [pinnedProject, setPinnedProject] = useState<Project | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [user, setUser] = useState(auth.currentUser);

    // Track Auth State
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            setUser(u);
        });
        return () => unsubscribe();
    }, []);

    // 1. Listen to User Profile for pinnedProjectId changes
    useEffect(() => {
        if (!user) {
            setPinnedProjectId(null);
            setPinnedProject(null);
            setIsLoading(false);
            return;
        }

        // We need to find the tenant first to find the user doc. 
        // Assuming we rely on the current active tenant or check all?
        // Actually, user profile is stored under `tenants/{tenantId}/users/{uid}`.
        // We might be in a specific tenant context. 
        // However, the `AppLayout` or `Sidebar` usually knows the tenant. 
        // But `dataService` methods like `subscribeProject` handle tenant resolution. 
        // Let's try to find the user document. Ideally, we should pass tenantId to this provider or rely on a global tenant context.
        // Since we don't have a global tenant context easily accessible here without potentially circular deps or complexity,
        // and the user might switch tenants... a pinned project is likely per-tenant.
        // Let's assume we maintain pinned project per tenant effectively by listening to the current user's doc in the current tenant.
        // Use `localStorage` for active tenant?

        const tenantId = localStorage.getItem('activeTenantId') || user.uid;

        const unsub = onSnapshot(doc(db, 'tenants', tenantId, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const pid = data.pinnedProjectId || null;
                setPinnedProjectId(pid);
                if (!pid) setPinnedProject(null);
            } else {
                setPinnedProjectId(null);
            }
            // Don't set loading false here, wait for project fetch if needed
            if (!snap.data()?.pinnedProjectId) setIsLoading(false);
        });

        return () => unsub();
    }, [user]);

    // 2. Fetch/Subscribe to Project Data when pinnedProjectId changes
    useEffect(() => {
        if (!pinnedProjectId) {
            setPinnedProject(null);
            return;
        }

        let mounted = true;

        // We fetch the project details. 
        // We could subscribe to it for real-time progress updates.
        const loadProject = async () => {
            try {
                const p = await getProjectById(pinnedProjectId);
                if (mounted) {
                    setPinnedProject(p);
                    setIsLoading(false);
                }

                // Real-time listener for the project itself (progress, title updates)
                if (p) {
                    const unsubProject = onSnapshot(doc(db, 'tenants', p.tenantId, 'projects', p.id), (snap) => {
                        if (mounted && snap.exists()) {
                            setPinnedProject({ id: snap.id, tenantId: p.tenantId, ...snap.data() } as Project);
                        }
                    });
                    return unsubProject;
                }
            } catch (e) {
                console.error("Failed to load pinned project", e);
                if (mounted) setIsLoading(false);
            }
        };

        const cleanupPromise = loadProject();

        return () => {
            mounted = false;
            cleanupPromise.then(unsub => unsub && unsub());
        };
    }, [pinnedProjectId]);

    const pinProject = async (projectId: string) => {
        if (!user) return;
        const tenantId = localStorage.getItem('activeTenantId') || user.uid;
        try {
            await updateDoc(doc(db, 'tenants', tenantId, 'users', user.uid), {
                pinnedProjectId: projectId
            });
            // State update will happen via snapshot listener
        } catch (e) {
            console.error("Failed to pin project", e);
        }
    };

    const unpinProject = async () => {
        if (!user) return;
        const tenantId = localStorage.getItem('activeTenantId') || user.uid;
        try {
            await updateDoc(doc(db, 'tenants', tenantId, 'users', user.uid), {
                pinnedProjectId: null // or deleteField()
            });
        } catch (e) {
            console.error("Failed to unpin project", e);
        }
    };

    return (
        <PinnedProjectContext.Provider value={{
            pinnedProjectId,
            pinnedProject,
            isLoading,
            pinProject,
            unpinProject
        }}>
            {children}
        </PinnedProjectContext.Provider>
    );
};

export const usePinnedProject = () => {
    const context = useContext(PinnedProjectContext);
    if (!context) {
        throw new Error('usePinnedProject must be used within a PinnedProjectProvider');
    }
    return context;
};
