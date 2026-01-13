import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, onIdTokenChanged } from 'firebase/auth';
import { auth } from '../services/firebase';

interface AuthContextType {
    user: User | null;
    isAuthReady: boolean;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isAuthReady: false,
    isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const initRef = useRef(false);

    useEffect(() => {
        if (!auth) {
            setIsAuthReady(true);
            return;
        }

        // Use onIdTokenChanged - fires when token actually changes
        // This is more reliable than onAuthStateChanged for Firestore auth sync
        const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
            // Prevent double processing from StrictMode
            if (initRef.current && !currentUser && user) {
                // StrictMode cleanup - skip resetting to null if we have a user
                return;
            }

            if (currentUser) {
                try {
                    // Force get the token to ensure it's cached and propagated
                    await currentUser.getIdToken(true);

                    // Delay to allow Firestore SDK to sync with the new token
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (err) {
                    console.warn("Token refresh failed:", err);
                }
            }

            setUser(currentUser);
            setIsAuthReady(true);
            initRef.current = true;
        });

        return () => unsubscribe();
    }, []);

    const value: AuthContextType = {
        user,
        isAuthReady,
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
