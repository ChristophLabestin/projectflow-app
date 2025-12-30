import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { usePinnedProject } from './PinnedProjectContext';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
    show: boolean;
    message: string;
    type: ToastType;
    details?: string;
    action?: {
        label: string;
        path: string;
    };
}

interface ConfirmationState {
    show: boolean;
    title: string;
    message: string;
    resolve: ((value: boolean) => void) | null;
}

interface UIContextType {
    showToast: (message: string, type?: ToastType, action?: { label: string; path: string }, details?: string) => void;
    confirm: (title: string, message: string) => Promise<boolean>;

    // State for components to consume
    toast: ToastState;
    closeToast: () => void;
    confirmation: ConfirmationState;
    closeConfirmation: (result: boolean) => void;
    isReleaseModalOpen: boolean;
    setReleaseModalOpen: (open: boolean) => void;

    // Global Task Create Modal
    isTaskCreateModalOpen: boolean;
    taskCreateProjectId: string | null;
    openTaskCreateModal: (projectId?: string) => void;
    closeTaskCreateModal: () => void;

    // Global Idea Create Modal
    isIdeaCreateModalOpen: boolean;
    ideaCreateProjectId: string | null;
    openIdeaCreateModal: (projectId?: string) => void;
    closeIdeaCreateModal: () => void;

    // Global Issue Create Modal
    isIssueCreateModalOpen: boolean;
    issueCreateProjectId: string | null;
    openIssueCreateModal: (projectId?: string) => void;
    closeIssueCreateModal: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
    const { pinnedProject } = usePinnedProject();

    const [toast, setToast] = useState<ToastState>({
        show: false,
        message: '',
        type: 'info',
    });

    const [confirmation, setConfirmation] = useState<ConfirmationState>({
        show: false,
        title: '',
        message: '',
        resolve: null,
    });

    const [isReleaseModalOpen, setReleaseModalOpen] = useState(false);

    // Task Modal State
    const [isTaskCreateModalOpen, setTaskCreateModalOpen] = useState(false);
    const [taskCreateProjectId, setTaskCreateProjectId] = useState<string | null>(null);

    // Idea Modal State
    const [isIdeaCreateModalOpen, setIdeaCreateModalOpen] = useState(false);
    const [ideaCreateProjectId, setIdeaCreateProjectId] = useState<string | null>(null);

    // Issue Modal State
    const [isIssueCreateModalOpen, setIssueCreateModalOpen] = useState(false);
    const [issueCreateProjectId, setIssueCreateProjectId] = useState<string | null>(null);

    // Task Modal Functions
    const openTaskCreateModal = useCallback((projectId?: string) => {
        setTaskCreateProjectId(projectId || null);
        setTaskCreateModalOpen(true);
    }, []);

    const closeTaskCreateModal = useCallback(() => {
        setTaskCreateModalOpen(false);
        setTaskCreateProjectId(null);
    }, []);

    // Idea Modal Functions
    const openIdeaCreateModal = useCallback((projectId?: string) => {
        setIdeaCreateProjectId(projectId || null);
        setIdeaCreateModalOpen(true);
    }, []);

    const closeIdeaCreateModal = useCallback(() => {
        setIdeaCreateModalOpen(false);
        setIdeaCreateProjectId(null);
    }, []);

    // Issue Modal Functions
    const openIssueCreateModal = useCallback((projectId?: string) => {
        setIssueCreateProjectId(projectId || null);
        setIssueCreateModalOpen(true);
    }, []);

    const closeIssueCreateModal = useCallback(() => {
        setIssueCreateModalOpen(false);
        setIssueCreateProjectId(null);
    }, []);

    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input/textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            // Only trigger if we have a pinned project
            if (!pinnedProject) return;

            // Option/Alt + T = Toggle Task Modal
            if (e.altKey && e.code === 'KeyT' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                if (isTaskCreateModalOpen) {
                    closeTaskCreateModal();
                } else {
                    openTaskCreateModal(pinnedProject.id);
                }
            }

            // Option/Alt + I = Toggle Idea Modal
            if (e.altKey && e.code === 'KeyI' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                if (isIdeaCreateModalOpen) {
                    closeIdeaCreateModal();
                } else {
                    openIdeaCreateModal(pinnedProject.id);
                }
            }

            // Option/Alt + B = Toggle Bug/Issue Modal
            if (e.altKey && e.code === 'KeyB' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                if (isIssueCreateModalOpen) {
                    closeIssueCreateModal();
                } else {
                    openIssueCreateModal(pinnedProject.id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [pinnedProject, isTaskCreateModalOpen, isIdeaCreateModalOpen, isIssueCreateModalOpen, openTaskCreateModal, closeTaskCreateModal, openIdeaCreateModal, closeIdeaCreateModal, openIssueCreateModal, closeIssueCreateModal]);

    const showToast = useCallback((message: string, type: ToastType = 'info', action?: { label: string; path: string }, details?: string) => {
        // Intercept Pre-Beta Missing Key Error
        if (message.includes('Pre-Beta: You must set your own Gemini API Key')) {
            action = { label: 'Go to Settings', path: '/settings?tab=prebeta' };
        }

        setToast({ show: true, message, type, action, details });
        // Auto hide after 8 seconds
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 8000);
    }, []);

    const closeToast = useCallback(() => {
        setToast(prev => ({ ...prev, show: false }));
    }, []);

    const confirm = useCallback((title: string, message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmation({
                show: true,
                title,
                message,
                resolve,
            });
        });
    }, []);

    const closeConfirmation = useCallback((result: boolean) => {
        if (confirmation.resolve) {
            confirmation.resolve(result);
        }
        setConfirmation({
            show: false,
            title: '',
            message: '',
            resolve: null,
        });
    }, [confirmation]);

    return (
        <UIContext.Provider value={{
            showToast,
            confirm,
            toast,
            closeToast,
            confirmation,
            closeConfirmation,
            isReleaseModalOpen,
            setReleaseModalOpen,
            isTaskCreateModalOpen,
            taskCreateProjectId,
            openTaskCreateModal,
            closeTaskCreateModal,
            isIdeaCreateModalOpen,
            ideaCreateProjectId,
            openIdeaCreateModal,
            closeIdeaCreateModal,
            isIssueCreateModalOpen,
            issueCreateProjectId,
            openIssueCreateModal,
            closeIssueCreateModal
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useToast must be used within a UIProvider');
    return {
        showToast: context.showToast,
        showError: (msg: string, details?: string) => context.showToast(msg, 'error', undefined, details),
        showSuccess: (msg: string) => context.showToast(msg, 'success'),
        showInfo: (msg: string) => context.showToast(msg, 'info'),
    };
};

export const useConfirm = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useConfirm must be used within a UIProvider');
    return context.confirm;
};

// Internal hook for the UI components themselves
export const useUIState = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUIState must be used within a UIProvider');
    return context;
};

export const useUI = useUIState;
