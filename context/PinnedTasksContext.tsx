import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Task } from '../types';
import { auth } from '../services/firebase';
import { getUserProfile, updateUserData, getActiveTenantId } from '../services/dataService';
import { onAuthStateChanged } from 'firebase/auth';

export interface PinnedItem {
    id: string;
    type: 'task' | 'issue' | 'personal-task';
    title: string;
    projectId: string;
    tenantId?: string;
    // Cache some display info to avoid instant fetching slightly
    priority?: Task['priority'];
    isCompleted?: boolean;
}

interface PinnedTasksContextType {
    pinnedItems: PinnedItem[];
    focusItemId: string | null;
    isModalOpen: boolean;
    toggleModal: () => void;
    pinItem: (item: PinnedItem) => void;
    unpinItem: (itemId: string) => void;
    isPinned: (itemId: string) => boolean;
    setFocusItem: (itemId: string | null) => void;
    isLoading: boolean;
}

const PinnedTasksContext = createContext<PinnedTasksContextType | undefined>(undefined);

export const PinnedTasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
    const [focusItemId, setFocusItemState] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasFetchedRef = useRef(false);

    // Load pinned items from Firebase on auth state change
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && !hasFetchedRef.current) {
                hasFetchedRef.current = true;
                setIsLoading(true);
                try {
                    const profile = await getUserProfile(user.uid);
                    if (profile?.pinnedItems) {
                        setPinnedItems(profile.pinnedItems);
                    }
                    if (profile?.focusItemId) {
                        setFocusItemState(profile.focusItemId);
                    }
                } catch (e) {
                    console.error("Failed to load pinned items from Firebase", e);
                } finally {
                    setIsLoading(false);
                }
            } else if (!user) {
                // User logged out - reset state
                setPinnedItems([]);
                setFocusItemState(null);
                hasFetchedRef.current = false;
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Debounced save to Firebase
    const saveToFirebase = useCallback((items: PinnedItem[], focusId: string | null) => {
        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce saves to avoid too many writes
        saveTimeoutRef.current = setTimeout(async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                await updateUserData(user.uid, {
                    pinnedItems: items,
                    focusItemId: focusId
                });
            } catch (e) {
                console.error("Failed to save pinned items to Firebase", e);
            }
        }, 500); // 500ms debounce
    }, []);

    const pinItem = useCallback((item: PinnedItem) => {
        setPinnedItems(prev => {
            if (prev.some(i => i.id === item.id)) return prev;
            const newItems = [...prev, item];
            saveToFirebase(newItems, focusItemId);
            return newItems;
        });
    }, [focusItemId, saveToFirebase]);

    const unpinItem = useCallback((itemId: string) => {
        setPinnedItems(prev => {
            const newItems = prev.filter(i => i.id !== itemId);
            const newFocusId = focusItemId === itemId ? null : focusItemId;
            if (focusItemId === itemId) {
                setFocusItemState(null);
            }
            saveToFirebase(newItems, newFocusId);
            return newItems;
        });
    }, [focusItemId, saveToFirebase]);

    const setFocusItem = useCallback((itemId: string | null) => {
        setFocusItemState(itemId);
        saveToFirebase(pinnedItems, itemId);
    }, [pinnedItems, saveToFirebase]);

    const isPinned = useCallback((itemId: string) => {
        return pinnedItems.some(i => i.id === itemId);
    }, [pinnedItems]);

    const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), []);

    // Keyboard Shortcut Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Command + Shift + F to toggle modal
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyF') {
                e.preventDefault();
                toggleModal();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleModal]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    return (
        <PinnedTasksContext.Provider value={{
            pinnedItems,
            focusItemId,
            isModalOpen,
            toggleModal,
            pinItem,
            unpinItem,
            isPinned,
            setFocusItem,
            isLoading
        }}>
            {children}
        </PinnedTasksContext.Provider>
    );
};

export const usePinnedTasks = () => {
    const context = useContext(PinnedTasksContext);
    if (context === undefined) {
        throw new Error('usePinnedTasks must be used within a PinnedTasksProvider');
    }
    return context;
};
