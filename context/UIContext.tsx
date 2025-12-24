import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastState {
    show: boolean;
    message: string;
    type: ToastType;
}

interface ConfirmationState {
    show: boolean;
    title: string;
    message: string;
    resolve: ((value: boolean) => void) | null;
}

interface UIContextType {
    showToast: (message: string, type?: ToastType) => void;
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
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
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

    const [isTaskCreateModalOpen, setTaskCreateModalOpen] = useState(false);
    const [taskCreateProjectId, setTaskCreateProjectId] = useState<string | null>(null);

    const openTaskCreateModal = useCallback((projectId?: string) => {
        setTaskCreateProjectId(projectId || null);
        setTaskCreateModalOpen(true);
    }, []);

    const closeTaskCreateModal = useCallback(() => {
        setTaskCreateModalOpen(false);
        setTaskCreateProjectId(null);
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        setToast({ show: true, message, type });
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
            closeTaskCreateModal
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
        showError: (msg: string) => context.showToast(msg, 'error'),
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
