import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FocusItemType, Task, UserFocusLastAction, UserFocusState, UserFocusStatus } from '../types';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile, updateUserData } from '../services/domain/usersService';

export interface PinnedItem {
    id: string;
    type: FocusItemType;
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
    focusItem: PinnedItem | null;
    focusState: UserFocusState | null;
    isModalOpen: boolean;
    toggleModal: () => void;
    pinItem: (item: PinnedItem) => void;
    unpinItem: (itemId: string) => void;
    isPinned: (itemId: string) => boolean;
    setFocusItem: (itemId: string | null) => void;
    startFocusItem: (item: PinnedItem) => void;
    snoozeFocusItem: (minutes?: number) => void;
    blockFocusItem: () => void;
    completeFocusItem: (itemId?: string) => void;
    clearFocusItem: (lastAction?: UserFocusLastAction) => void;
    isLoading: boolean;
}

const PinnedTasksContext = createContext<PinnedTasksContextType | undefined>(undefined);

const compactRecord = <T extends Record<string, unknown>>(value: T): Partial<T> => (
    Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as Partial<T>
);

const serializePinnedItem = (item: PinnedItem) => compactRecord({
    id: item.id,
    type: item.type,
    title: item.title,
    projectId: item.projectId,
    tenantId: item.tenantId,
    priority: item.priority,
    isCompleted: item.isCompleted
}) as PinnedItem;

const isSupportedPinnedItem = (item: PinnedItem) => item.type !== 'issue';

const serializeFocusState = (state: UserFocusState) => compactRecord({
    itemId: state.itemId,
    itemType: state.itemType,
    title: state.title,
    projectId: state.projectId,
    tenantId: state.tenantId,
    status: state.status,
    startedAt: state.startedAt,
    snoozedUntil: state.snoozedUntil,
    blockedAt: state.blockedAt,
    updatedAt: state.updatedAt,
    lastAction: state.lastAction
}) as UserFocusState;

export const PinnedTasksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
    const [focusItemId, setFocusItemState] = useState<string | null>(null);
    const [focusState, setFocusState] = useState<UserFocusState | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hasFetchedRef = useRef(false);

    const buildFocusState = useCallback((
        item: PinnedItem,
        status: UserFocusStatus,
        overrides: Partial<UserFocusState> = {}
    ): UserFocusState => {
        const now = new Date().toISOString();
        const shouldPreserveStartedAt = focusState?.itemId === item.id;
        return {
            itemId: item.id,
            itemType: item.type,
            title: item.title,
            projectId: item.projectId || undefined,
            tenantId: item.tenantId,
            status,
            startedAt: overrides.startedAt || (shouldPreserveStartedAt ? focusState?.startedAt : undefined) || now,
            updatedAt: now,
            lastAction: status === 'active' ? 'started' : status,
            ...overrides
        };
    }, [focusState?.startedAt]);

    const getFallbackFocusState = useCallback((items: PinnedItem[], itemId?: string | null) => {
        if (!itemId) return null;
        const item = items.find((candidate) => candidate.id === itemId);
        return item ? buildFocusState(item, 'active') : null;
    }, [buildFocusState]);

    // Load pinned items from Firebase on auth state change
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && !hasFetchedRef.current) {
                hasFetchedRef.current = true;
                setIsLoading(true);
                try {
                    const profile = await getUserProfile(user.uid);
                    const nextPinnedItems = ((profile?.pinnedItems || []) as PinnedItem[]).filter(isSupportedPinnedItem);
                    const rawFocusItemId = profile?.focusItemId || profile?.focusState?.itemId || null;
                    const nextFocusItemId = nextPinnedItems.some(item => item.id === rawFocusItemId) ? rawFocusItemId : null;
                    const nextFocusState = nextFocusItemId && profile?.focusState?.itemType !== 'issue'
                        ? profile.focusState
                        : getFallbackFocusState(nextPinnedItems, nextFocusItemId);
                    setPinnedItems(nextPinnedItems);
                    setFocusItemState(nextFocusItemId);
                    setFocusState(nextFocusState);
                } catch (e) {
                    console.error("Failed to load pinned items from Firebase", e);
                } finally {
                    setIsLoading(false);
                }
            } else if (!user) {
                // User logged out - reset state
                setPinnedItems([]);
                setFocusItemState(null);
                setFocusState(null);
                hasFetchedRef.current = false;
                setIsLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    // Debounced save to Firebase
    const saveToFirebase = useCallback((items: PinnedItem[], focusId: string | null, nextFocusState: UserFocusState | null) => {
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
                    pinnedItems: items.filter(isSupportedPinnedItem).map(serializePinnedItem),
                    focusItemId: nextFocusState?.itemType === 'issue' ? null : focusId,
                    focusState: nextFocusState && nextFocusState.itemType !== 'issue' ? serializeFocusState(nextFocusState) : null
                });
            } catch (e) {
                console.error("Failed to save pinned items to Firebase", e);
            }
        }, 500); // 500ms debounce
    }, []);

    const pinItem = useCallback((item: PinnedItem) => {
        setPinnedItems(prev => {
            if (!isSupportedPinnedItem(item) || prev.some(i => i.id === item.id)) return prev;
            const newItems = [...prev, item];
            saveToFirebase(newItems, focusItemId, focusState);
            return newItems;
        });
    }, [focusItemId, focusState, saveToFirebase]);

    const unpinItem = useCallback((itemId: string) => {
        setPinnedItems(prev => {
            const newItems = prev.filter(i => i.id !== itemId);
            const newFocusId = focusItemId === itemId ? null : focusItemId;
            const nextFocusState = focusItemId === itemId ? null : focusState;
            if (focusItemId === itemId) {
                setFocusItemState(null);
                setFocusState(null);
            }
            saveToFirebase(newItems, newFocusId, nextFocusState);
            return newItems;
        });
    }, [focusItemId, focusState, saveToFirebase]);

    const setFocusItem = useCallback((itemId: string | null) => {
        setPinnedItems(prev => {
            const nextFocusState = getFallbackFocusState(prev, itemId);
            setFocusItemState(itemId);
            setFocusState(nextFocusState);
            saveToFirebase(prev, itemId, nextFocusState);
            return prev;
        });
    }, [getFallbackFocusState, saveToFirebase]);

    const startFocusItem = useCallback((item: PinnedItem) => {
        setPinnedItems(prev => {
            if (!isSupportedPinnedItem(item)) return prev;
            const newItems = prev.some(i => i.id === item.id)
                ? prev.map((candidate) => candidate.id === item.id ? { ...candidate, ...item } : candidate)
                : [...prev, item];
            const nextFocusState = buildFocusState(item, 'active', {
                lastAction: focusState?.itemId === item.id ? 'resumed' : 'started',
                snoozedUntil: undefined,
                blockedAt: undefined
            });
            setFocusItemState(item.id);
            setFocusState(nextFocusState);
            saveToFirebase(newItems, item.id, nextFocusState);
            return newItems;
        });
    }, [buildFocusState, focusState?.itemId, saveToFirebase]);

    const updateCurrentFocus = useCallback((status: UserFocusStatus, overrides: Partial<UserFocusState> = {}) => {
        setPinnedItems(prev => {
            const currentItemId = focusItemId || focusState?.itemId || null;
            const item = currentItemId ? prev.find((candidate) => candidate.id === currentItemId) : null;
            if (!item) return prev;
            const nextFocusState = buildFocusState(item, status, overrides);
            setFocusItemState(item.id);
            setFocusState(nextFocusState);
            saveToFirebase(prev, item.id, nextFocusState);
            return prev;
        });
    }, [buildFocusState, focusItemId, focusState?.itemId, saveToFirebase]);

    const snoozeFocusItem = useCallback((minutes = 60) => {
        const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        updateCurrentFocus('snoozed', {
            snoozedUntil,
            blockedAt: undefined,
            lastAction: 'snoozed'
        });
    }, [updateCurrentFocus]);

    const blockFocusItem = useCallback(() => {
        updateCurrentFocus('blocked', {
            blockedAt: new Date().toISOString(),
            snoozedUntil: undefined,
            lastAction: 'blocked'
        });
    }, [updateCurrentFocus]);

    const clearFocusItem = useCallback((lastAction: UserFocusLastAction = 'cleared') => {
        void lastAction;
        setFocusItemState(null);
        setFocusState(null);
        saveToFirebase(pinnedItems, null, null);
    }, [pinnedItems, saveToFirebase]);

    const completeFocusItem = useCallback((itemId?: string) => {
        setPinnedItems(prev => {
            const completedId = itemId || focusItemId || focusState?.itemId || null;
            const nextItems = completedId ? prev.filter((item) => item.id !== completedId) : prev;
            const clearsActiveFocus = Boolean(completedId && (focusItemId === completedId || focusState?.itemId === completedId));
            const nextFocusId = clearsActiveFocus ? null : focusItemId;
            const nextFocusState = clearsActiveFocus ? null : focusState;
            setFocusItemState(nextFocusId);
            setFocusState(nextFocusState);
            saveToFirebase(nextItems, nextFocusId, nextFocusState);
            return nextItems;
        });
    }, [focusItemId, focusState, saveToFirebase]);

    const isPinned = useCallback((itemId: string) => {
        return pinnedItems.some(i => i.id === itemId);
    }, [pinnedItems]);

    const toggleModal = useCallback(() => setIsModalOpen(prev => !prev), []);
    const focusItem = useMemo(() => {
        const resolvedId = focusItemId || focusState?.itemId || null;
        if (!resolvedId) return null;
        const pinned = pinnedItems.find((item) => item.id === resolvedId);
        if (pinned) return pinned;
        if (focusState?.itemId && focusState.title && focusState.itemType) {
            return {
                id: focusState.itemId,
                type: focusState.itemType,
                title: focusState.title,
                projectId: focusState.projectId || '',
                tenantId: focusState.tenantId
            } satisfies PinnedItem;
        }
        return null;
    }, [focusItemId, focusState, pinnedItems]);

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
            focusItem,
            focusState,
            isModalOpen,
            toggleModal,
            pinItem,
            unpinItem,
            isPinned,
            setFocusItem,
            startFocusItem,
            snoozeFocusItem,
            blockFocusItem,
            completeFocusItem,
            clearFocusItem,
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
