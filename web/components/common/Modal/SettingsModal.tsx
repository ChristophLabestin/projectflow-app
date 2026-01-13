import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from '../Button/Button';
import './settings-modal.scss';

export interface SettingsTab {
    id: string;
    label: string;
    icon?: React.ReactNode;
    content: React.ReactNode;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    tabs: SettingsTab[];
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    title = 'Settings',
    tabs,
}) => {
    const [activeTabId, setActiveTabId] = useState(tabs[0]?.id);

    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl" title={title}>
            <div className="settings-layout">
                <aside className="settings-layout__sidebar">
                    <nav className="settings-nav">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                className={`settings-nav__item ${activeTabId === tab.id ? 'settings-nav__item--active' : ''}`}
                                onClick={() => setActiveTabId(tab.id)}
                            >
                                {tab.icon && <span className="settings-nav__icon">{tab.icon}</span>}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </aside>
                <main className="settings-layout__content">
                    <div className="settings-content-header">
                        <h3>{activeTab?.label}</h3>
                    </div>
                    <div className="settings-content-body">
                        {activeTab?.content}
                    </div>
                </main>
            </div>
        </Modal>
    );
};
