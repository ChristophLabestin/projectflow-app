import React, { useState, useRef, useEffect } from 'react';
import { useWorkspaceTeamPresence, useWorkspacePresence } from '../hooks/usePresence';
import { auth } from '../services/firebase';
import { Link } from 'react-router-dom';

interface WorkspaceTeamIndicatorProps {
    tenantId?: string;
    onClose?: () => void;
}

/**
 * Premium Workspace Team Presence Indicator for the Sidebar
 * Shows stacked avatars of online team members with smooth hover expansion
 */
export const WorkspaceTeamIndicator: React.FC<WorkspaceTeamIndicatorProps> = ({ tenantId, onClose }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Track workspace presence (Removed: now handled globally in AppLayout.tsx)
    // useWorkspacePresence({ tenantId, enabled: true });

    // Get team presence data
    const {
        members,
        onlineMembers,
        idleMembers,
        busyMembers,
        offlineMembers,
        totalCount,
        onlineCount,
        busyCount
    } = useWorkspaceTeamPresence(tenantId);

    const currentUserId = auth.currentUser?.uid;

    // Filter everyone by removing the current user
    const filteredOnlineMembers = onlineMembers.filter(m => m.uid !== currentUserId);
    const filteredIdleMembers = idleMembers.filter(m => m.uid !== currentUserId);
    const filteredBusyMembers = busyMembers.filter(m => m.uid !== currentUserId);
    const filteredOfflineMembers = offlineMembers.filter(m => m.uid !== currentUserId);
    const filteredTotalCount = members.filter(m => m.uid !== currentUserId).length;
    const filteredOnlineCount = filteredOnlineMembers.length;
    const filteredTotalActiveCount = filteredOnlineMembers.length + filteredIdleMembers.length + filteredBusyMembers.length;

    // Gradient Logic
    // Green: at least one online
    // Orange: no one online, but at least one away (idle)
    // Red: no one online or away, but at least one busy
    const hasOnline = filteredOnlineMembers.length > 0;
    const hasIdle = !hasOnline && filteredIdleMembers.length > 0;
    const hasBusy = !hasOnline && !hasIdle && filteredBusyMembers.length > 0;

    const statusGradientClass = hasOnline
        ? 'from-emerald-500/10 to-transparent border-emerald-500/20'
        : hasIdle
            ? 'from-amber-400/10 to-transparent border-amber-400/20'
            : hasBusy
                ? 'from-rose-500/10 to-transparent border-rose-500/20'
                : 'bg-transparent border-transparent';

    const statusIndicatorColor = hasOnline
        ? 'bg-emerald-500'
        : hasIdle
            ? 'bg-amber-400'
            : hasBusy
                ? 'bg-rose-500'
                : 'bg-[var(--color-text-muted)]';

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsLocked(false);
                setIsHovered(false);
            }
        };

        if (isLocked) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isLocked]);

    // Hover handlers with delay for smoother UX
    const handleMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        if (isLocked) return;
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 150);
    };

    const handleClick = () => {
        setIsLocked(!isLocked);
        setIsHovered(true);
    };

    // Don't show if there are no other members
    if (filteredTotalCount === 0) {
        return null;
    }

    // Get up to 4 online/idle/busy members for display
    const displayMembers = [...filteredOnlineMembers, ...filteredIdleMembers, ...filteredBusyMembers].slice(0, 4);
    const extraCount = (filteredOnlineMembers.length + filteredIdleMembers.length + filteredBusyMembers.length) - 4;

    const isExpanded = isHovered || isLocked;

    return (
        <div
            ref={containerRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Collapsed State - Premium Stacked Avatars Row */}
            <div
                onClick={handleClick}
                className={`
                    flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer
                    transition-all duration-300 ease-out bg-gradient-to-r border
                    ${isExpanded
                        ? statusGradientClass
                        : 'hover:bg-[var(--color-surface-hover)]/60 border-transparent'
                    }
                `}
            >
                <div className="flex items-center gap-3">
                    {/* Stacked Avatars with premium styling */}
                    <div className="flex items-center">
                        {displayMembers.map((member, idx) => (
                            <div
                                key={member.uid}
                                className={`
                                    relative rounded-full transition-all duration-300 ease-out
                                    ${idx > 0 ? '-ml-2.5' : ''}
                                    hover:scale-110 hover:z-20
                                `}
                                style={{ zIndex: displayMembers.length - idx }}
                            >
                                {/* Glow effect for online users */}
                                {member.isOnline && (
                                    <div className="absolute inset-0 rounded-full bg-emerald-400 blur-sm opacity-40 animate-pulse" />
                                )}

                                {/* Avatar */}
                                <div
                                    className={`
                                        relative size-8 rounded-full border-2 border-[var(--color-surface-card)]
                                        bg-cover bg-center shadow-lg
                                        ring-2 transition-all duration-300
                                        ${member.isOnline
                                            ? 'ring-emerald-500'
                                            : member.isIdle
                                                ? 'ring-amber-400'
                                                : member.isBusy
                                                    ? 'ring-rose-500'
                                                    : 'ring-transparent'
                                        }
                                    `}
                                    style={{
                                        backgroundImage: member.photoURL ? `url("${member.photoURL}")` : undefined
                                    }}
                                >
                                    {!member.photoURL && (
                                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 text-white text-xs font-bold rounded-full">
                                            {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                </div>

                                {/* Status indicator */}
                                <div className={`
                                    absolute -bottom-0.5 -right-0.5 size-3 rounded-full 
                                    border-2 border-[var(--color-surface-card)]
                                    shadow-sm transition-colors duration-300
                                    ${member.isOnline ? 'bg-emerald-500' : member.isIdle ? 'bg-amber-400' : 'bg-rose-500'}
                                `} />
                            </div>
                        ))}

                        {/* +X more indicator */}
                        {extraCount > 0 && (
                            <div
                                className="relative -ml-2 size-8 rounded-full bg-[var(--color-surface-hover)] border-2 border-[var(--color-surface-card)] flex items-center justify-center shadow-lg"
                                style={{ zIndex: 0 }}
                            >
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                                    +{extraCount}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Status Label */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <div className="relative">
                                <span className={`size-2 rounded-full ${statusIndicatorColor} block`} />
                                {(hasOnline || hasIdle || hasBusy) && (
                                    <span className={`absolute inset-0 size-2 rounded-full ${statusIndicatorColor} animate-ping opacity-75`} />
                                )}
                            </div>
                            <span className="text-[13px] font-semibold text-[var(--color-text-main)]">
                                {filteredTotalActiveCount} active
                            </span>
                        </div>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-3.5">
                            {filteredTotalCount} team members
                        </span>
                    </div>
                </div>

                {/* Expand Indicator */}
                <span className={`
                    material-symbols-outlined text-[16px] text-[var(--color-text-muted)]
                    transition-transform duration-300
                    ${isExpanded ? 'rotate-180' : ''}
                `}>
                    expand_less
                </span>
            </div>

            {/* Expanded Flyout Panel */}
            <div
                className={`
                    absolute bottom-full left-0 w-[280px] mb-2
                    bg-[var(--color-surface-card)] 
                    border border-[var(--color-surface-border)]
                    rounded-2xl shadow-2xl
                    origin-bottom
                    transition-all duration-300 ease-out
                    ${isExpanded
                        ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                        : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
                    }
                `}
                style={{ zIndex: 100 }}
            >
                {/* Decorative gradient border */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-violet-500/10 pointer-events-none" />

                {/* Header */}
                <div className="relative flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-border)]">
                    <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="material-symbols-outlined text-white text-[18px]">groups</span>
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-[var(--color-text-main)]">Workspace Team</h4>
                            <p className="text-[10px] text-[var(--color-text-muted)]">{filteredTotalCount} members</p>
                        </div>
                    </div>

                    {/* Live indicator (now Dynamic based on top status) */}
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${statusGradientClass}`}>
                        <div className="relative">
                            <span className={`size-1.5 rounded-full ${statusIndicatorColor} block`} />
                            {(hasOnline || hasIdle || hasBusy) && (
                                <span className={`absolute inset-0 size-1.5 rounded-full ${statusIndicatorColor} animate-ping`} />
                            )}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${hasOnline ? 'text-emerald-500' : hasIdle ? 'text-amber-500' : hasBusy ? 'text-rose-500' : 'text-slate-500'}`}>
                            {hasOnline ? 'Online' : hasIdle ? 'Away' : hasBusy ? 'Busy' : 'Live'}
                        </span>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="relative max-h-[280px] overflow-y-auto scrollbar-none py-2">

                    {/* Online Members Section */}
                    {filteredOnlineMembers.length > 0 && (
                        <div className="px-3 mb-2">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="size-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                    Online Now
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent" />
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    {filteredOnlineMembers.length}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredOnlineMembers.map(member => (
                                    <MemberRow
                                        key={member.uid}
                                        member={member}
                                        isCurrentUser={false}
                                        status="online"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Away Members Section */}
                    {filteredIdleMembers.length > 0 && (
                        <div className="px-3 mb-2">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="size-2 rounded-full bg-amber-400" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                    Away
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-amber-400/30 to-transparent" />
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    {filteredIdleMembers.length}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredIdleMembers.map(member => (
                                    <MemberRow
                                        key={member.uid}
                                        member={member}
                                        isCurrentUser={false}
                                        status="idle"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Busy Members Section */}
                    {filteredBusyMembers.length > 0 && (
                        <div className="px-3 mb-2">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="size-2 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                                    Busy
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-rose-500/30 to-transparent" />
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                                    {filteredBusyMembers.length}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredBusyMembers.map(member => (
                                    <MemberRow
                                        key={member.uid}
                                        member={member}
                                        isCurrentUser={false}
                                        status="busy"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Offline Members Section */}
                    {filteredOfflineMembers.length > 0 && (
                        <div className="px-3">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                                <span className="size-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                                    Offline
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-slate-300/30 dark:from-slate-600/30 to-transparent" />
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                                    {filteredOfflineMembers.length}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {filteredOfflineMembers.map(member => (
                                    <MemberRow
                                        key={member.uid}
                                        member={member}
                                        isCurrentUser={false}
                                        status="offline"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {filteredTotalCount === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                            <span className="material-symbols-outlined text-4xl text-[var(--color-text-muted)] opacity-30 mb-2">
                                group_off
                            </span>
                            <p className="text-sm text-[var(--color-text-muted)]">No team members yet</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <Link
                    to="/team"
                    onClick={() => {
                        setIsLocked(false);
                        setIsHovered(false);
                        onClose?.();
                    }}
                    className="
                        relative flex items-center justify-center gap-2 
                        px-4 py-3 m-2 mt-0
                        bg-gradient-to-r from-[var(--color-surface-hover)] to-transparent
                        rounded-xl border border-[var(--color-surface-border)]
                        text-[var(--color-primary)] 
                        hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/30
                        transition-all duration-200
                        group
                    "
                >
                    <span className="text-xs font-bold tracking-wide">Manage Team</span>
                    <span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-0.5">
                        arrow_forward
                    </span>
                </Link>
            </div>
        </div>
    );
};

// Premium Member Row Component
const MemberRow: React.FC<{
    member: { uid: string; displayName: string; photoURL?: string; role?: string };
    isCurrentUser: boolean;
    status: 'online' | 'idle' | 'offline';
}> = ({ member, isCurrentUser, status }) => (
    <div className={`
        flex items-center gap-3 px-2 py-2 rounded-xl 
        transition-all duration-200 cursor-default
        ${status === 'online'
            ? 'hover:bg-emerald-500/5'
            : status === 'idle'
                ? 'hover:bg-amber-400/5'
                : 'hover:bg-[var(--color-surface-hover)]/50'
        }
    `}>
        {/* Avatar with status ring */}
        <div className="relative shrink-0">
            {/* Glow for online */}
            {status === 'online' && (
                <div className="absolute inset-0 rounded-full bg-emerald-400 blur-md opacity-30" />
            )}

            {member.photoURL ? (
                <img
                    src={member.photoURL}
                    alt={member.displayName}
                    className={`
                        relative size-9 rounded-full object-cover
                        ring-2 transition-all duration-300
                        ${status === 'online'
                            ? 'ring-emerald-500 shadow-lg shadow-emerald-500/20'
                            : status === 'idle'
                                ? 'ring-amber-400'
                                : 'ring-[var(--color-surface-border)] opacity-70 grayscale-[30%]'
                        }
                    `}
                />
            ) : (
                <div className={`
                    relative size-9 rounded-full 
                    flex items-center justify-center text-white text-sm font-bold
                    ring-2 transition-all duration-300
                    ${status === 'online'
                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500 ring-emerald-500 shadow-lg shadow-emerald-500/20'
                        : status === 'idle'
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500 ring-amber-400'
                            : 'bg-gradient-to-br from-slate-400 to-slate-500 ring-[var(--color-surface-border)] opacity-70'
                    }
                `}>
                    {member.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
            )}

            {/* Status dot */}
            <div className={`
                absolute -bottom-0.5 -right-0.5 size-3 rounded-full 
                border-2 border-[var(--color-surface-card)]
                ${status === 'online' ? 'bg-emerald-500' : status === 'idle' ? 'bg-amber-400' : 'bg-slate-400'}
            `}>
                {status === 'online' && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
            </div>
        </div>

        {/* Name & Status */}
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className={`
                    text-[13px] font-semibold truncate
                    ${status === 'offline' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}
                `}>
                    {member.displayName}
                </span>
                {isCurrentUser && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        You
                    </span>
                )}
            </div>
            <span className={`
                text-[10px] font-medium
                ${status === 'online'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : status === 'idle'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[var(--color-text-muted)]'
                }
            `}>
                {status === 'online' ? 'Active now' : status === 'idle' ? 'Away' : 'Offline'}
            </span>
        </div>

        {/* Role badge */}
        {member.role && (
            <span className={`
                shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md
                ${member.role.toLowerCase() === 'owner' || member.role.toLowerCase() === 'admin'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]'
                }
            `}>
                {member.role}
            </span>
        )}
    </div>
);
