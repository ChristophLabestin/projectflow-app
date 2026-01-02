import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { signOut } from 'firebase/auth';
import { subscribeUserStatusPreference, updateUserStatusPreference } from '../services/dataService';
import { useLanguage } from '../context/LanguageContext';
import { SettingsModal } from './SettingsModal';

/**
 * User Profile Dropdown for the Topbar
 * Shows avatar only, expands to show name/email and menu options
 */
export const UserProfileDropdown: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isStatusSelectorOpen, setIsStatusSelectorOpen] = useState(false);
    const [statusPreference, setStatusPreference] = useState<'online' | 'busy' | 'idle' | 'offline'>('online');
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const statusSelectorRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const user = auth.currentUser;
    const { t } = useLanguage();

    // Subscribe to status preference
    useEffect(() => {
        if (!user) return;
        const unsub = subscribeUserStatusPreference(user.uid, (status) => {
            setStatusPreference(status);
        });
        return () => unsub();
    }, [user?.uid]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setIsStatusSelectorOpen(false);
            }
            if (statusSelectorRef.current && !statusSelectorRef.current.contains(e.target as Node)) {
                setIsStatusSelectorOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            if (typeof localStorage !== 'undefined') localStorage.removeItem('activeTenantId');
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const closeAndNavigate = () => {
        setIsOpen(false);
    };

    const handleStatusUpdate = async (status: 'online' | 'busy' | 'idle' | 'offline') => {
        if (!user) return;
        try {
            await updateUserStatusPreference(user.uid, status);
            setIsStatusSelectorOpen(false);
        } catch (error) {
            console.error('Error updating status preference:', error);
        }
    };

    const getStatusInfo = (status: 'online' | 'busy' | 'idle' | 'offline') => {
        switch (status) {
            case 'online': return { color: 'bg-emerald-500', label: t('status.online'), icon: 'check_circle' };
            case 'busy': return { color: 'bg-rose-500', label: t('status.busy'), icon: 'do_not_disturb_on' };
            case 'idle': return { color: 'bg-amber-400', label: t('status.away'), icon: 'schedule' };
            case 'offline': return { color: 'bg-slate-400', label: t('status.offline'), icon: 'visibility_off' };
            default: return { color: 'bg-emerald-500', label: t('status.online'), icon: 'check_circle' };
        }
    };

    const currentStatus = getStatusInfo(statusPreference);

    return (
        <div ref={dropdownRef} className="relative">
            {/* Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    relative size-10 rounded-full transition-all duration-200
                    ring-2 ring-offset-2 ring-offset-[var(--color-surface-card)]
                    ${isOpen
                        ? 'ring-[var(--color-primary)] scale-105'
                        : 'ring-transparent hover:ring-[var(--color-surface-border)]'
                    }
                `}
            >
                {user?.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt={user.displayName || t('user.profileAlt')}
                        className="size-10 rounded-full object-cover"
                    />
                ) : (
                    <div className="size-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {user?.displayName?.charAt(0)?.toUpperCase() || t('user.fallbackInitial')}
                    </div>
                )}

                {/* Online indicator */}
                <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-[var(--color-surface-card)] ${currentStatus.color}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className="
                        absolute top-full right-0 mt-2 w-72
                        bg-[var(--color-surface-card)] 
                        border border-[var(--color-surface-border)]
                        rounded-2xl shadow-2xl
                        animate-scale-up origin-top-right
                        z-50
                    "
                >
                    {/* User Info Header */}
                    <div className="p-4 rounded-t-2xl bg-gradient-to-br from-[var(--color-surface-hover)] to-transparent border-b border-[var(--color-surface-border)]">
                        <div className="flex items-center gap-3">
                            {user?.photoURL ? (
                                <img
                                    src={user.photoURL}
                                    alt={user.displayName || t('user.profileAlt')}
                                    className="size-12 rounded-full object-cover ring-2 ring-[var(--color-surface-border)]"
                                />
                            ) : (
                                <div className="size-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg ring-2 ring-[var(--color-surface-border)]">
                                    {user?.displayName?.charAt(0)?.toUpperCase() || t('user.fallbackInitial')}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-[var(--color-text-main)] truncate">
                                    {user?.displayName || t('user.fallbackName')}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`size-1.5 rounded-full ${currentStatus.color}`} />
                                    <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                                        {currentStatus.label}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Custom Status Selector */}
                        <div className="mt-4 relative" ref={statusSelectorRef}>
                            <button
                                onClick={() => setIsStatusSelectorOpen(!isStatusSelectorOpen)}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2 rounded-xl border
                                    transition-all duration-200 group
                                    ${isStatusSelectorOpen
                                        ? 'bg-[var(--color-surface-hover)] border-[var(--color-primary)]/50 ring-4 ring-[var(--color-primary)]/5'
                                        : 'bg-white/5 border-[var(--color-surface-border)] hover:border-[var(--color-primary)]/30'
                                    }
                                `}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`size-2 rounded-full ${currentStatus.color} shadow-sm`} />
                                    <span className="text-[12px] font-bold text-[var(--color-text-main)]">
                                        {currentStatus.label}
                                    </span>
                                </div>
                                <span className={`material-symbols-outlined text-[18px] text-[var(--color-text-muted)] transition-transform duration-200 ${isStatusSelectorOpen ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>

                            {isStatusSelectorOpen && (
                                <div
                                    className="
                                        absolute top-full left-0 right-0 mt-1.5 p-1
                                        bg-[var(--color-surface-card)] 
                                        border border-[var(--color-surface-border)]
                                        rounded-xl shadow-xl
                                        z-[60] animate-scale-up origin-top
                                    "
                                >
                                    {(['online', 'busy', 'idle', 'offline'] as const).map((status) => {
                                        const info = getStatusInfo(status);
                                        const isSelected = statusPreference === status;
                                        return (
                                            <button
                                                key={status}
                                                onClick={() => handleStatusUpdate(status)}
                                                className={`
                                                    w-full flex items-center gap-2.5 p-2 rounded-lg transition-all
                                                    ${isSelected
                                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                                                        : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                                    }
                                                `}
                                            >
                                                <span className={`material-symbols-outlined text-[18px]`}>
                                                    {info.icon}
                                                </span>
                                                <span className="text-[12px] font-bold text-left">{info.label}</span>
                                                {isSelected && <span className="material-symbols-outlined text-[16px] ml-auto">check</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                        <Link
                            to="/profile"
                            onClick={closeAndNavigate}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">person</span>
                            <span className="text-sm font-medium">{t('user.viewProfile')}</span>
                        </Link>
                        <button
                            onClick={() => {
                                closeAndNavigate();
                                setShowSettingsModal(true);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] transition-colors text-left"
                        >
                            <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">settings</span>
                            <span className="text-sm font-medium">{t('user.settings')}</span>
                        </button>
                        <Link
                            to="/media"
                            onClick={closeAndNavigate}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">perm_media</span>
                            <span className="text-sm font-medium">{t('user.mediaLibrary')}</span>
                        </Link>
                        <Link
                            to="/personal-tasks"
                            onClick={closeAndNavigate}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-hover)] text-[var(--color-text-main)] transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px] text-[var(--color-text-muted)]">task_alt</span>
                            <span className="text-sm font-medium">{t('user.personalTasks')}</span>
                        </Link>
                    </div>

                    {/* Logout Section */}
                    <div className="border-t border-[var(--color-surface-border)] py-2 rounded-b-2xl">
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/10 text-rose-600 dark:text-rose-400 transition-colors text-left"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                            <span className="text-sm font-medium">{t('user.signOut')}</span>
                        </button>
                    </div>
                </div>
            )}

            <SettingsModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />
        </div>
    );
};

