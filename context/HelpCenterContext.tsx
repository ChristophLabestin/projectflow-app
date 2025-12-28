import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type HelpCenterTarget = {
    pageId?: string;
    sectionId?: string;
    searchQuery?: string;
};

interface HelpCenterContextType {
    isOpen: boolean;
    activePageId: string;
    activeSectionId: string | null;
    searchQuery: string;
    openHelpCenter: (target?: HelpCenterTarget) => void;
    closeHelpCenter: () => void;
    toggleHelpCenter: (target?: HelpCenterTarget) => void;
    setActivePage: (pageId: string) => void;
    setActiveSection: (sectionId: string | null) => void;
    setSearchQuery: (query: string) => void;
}

const HelpCenterContext = createContext<HelpCenterContextType | undefined>(undefined);

export const HelpCenterProvider = ({ children }: { children: React.ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activePageId, setActivePageId] = useState('getting-started');
    const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const openHelpCenter = useCallback((target?: HelpCenterTarget) => {
        setIsOpen(true);

        if (target?.pageId) {
            setActivePageId(target.pageId);
        }

        if (target?.sectionId) {
            setActiveSectionId(target.sectionId);
        } else if (target?.pageId) {
            setActiveSectionId(null);
        }

        if (target?.searchQuery !== undefined) {
            setSearchQuery(target.searchQuery);
        } else {
            setSearchQuery('');
        }
    }, []);

    const closeHelpCenter = useCallback(() => {
        setIsOpen(false);
    }, []);

    const toggleHelpCenter = useCallback((target?: HelpCenterTarget) => {
        if (isOpen) {
            closeHelpCenter();
            return;
        }
        openHelpCenter(target);
    }, [closeHelpCenter, isOpen, openHelpCenter]);

    const setActivePage = useCallback((pageId: string) => {
        setActivePageId(pageId);
        setActiveSectionId(null);
    }, []);

    const setActiveSection = useCallback((sectionId: string | null) => {
        setActiveSectionId(sectionId);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }

            if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
                e.preventDefault();
                toggleHelpCenter();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleHelpCenter]);

    const value = useMemo(() => ({
        isOpen,
        activePageId,
        activeSectionId,
        searchQuery,
        openHelpCenter,
        closeHelpCenter,
        toggleHelpCenter,
        setActivePage,
        setActiveSection,
        setSearchQuery
    }), [activePageId, activeSectionId, closeHelpCenter, isOpen, openHelpCenter, searchQuery, setActivePage, setActiveSection, setSearchQuery, toggleHelpCenter]);

    return (
        <HelpCenterContext.Provider value={value}>
            {children}
        </HelpCenterContext.Provider>
    );
};

export const useHelpCenter = () => {
    const context = useContext(HelpCenterContext);
    if (!context) {
        throw new Error('useHelpCenter must be used within a HelpCenterProvider');
    }
    return context;
};
