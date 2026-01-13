import React from 'react';

interface UserHoverCardProps {
    user: {
        uid: string;
        displayName: string;
        photoURL?: string;
        email?: string;
        isOnline?: boolean;
    };
    children: React.ReactNode;
}

export const UserHoverCard: React.FC<UserHoverCardProps> = ({ user, children }) => {
    return (
        <div className="group relative inline-block">
            {children}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                <div className="flex items-center gap-3 mb-2">
                    <div className="size-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                        {user.photoURL ? (
                            <img src={user.photoURL} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xs">{user.displayName[0]}</div>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{user.displayName}</p>
                        {(user as any).title && (
                            <p className="text-xs font-medium text-primary mb-0.5">{(user as any).title}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 capitalize flex items-center gap-1">
                            <span className={`size-2 rounded-full ${user.isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                            {user.isOnline ? 'Online' : 'Offline'}
                        </p>
                    </div>
                </div>
                {user.email && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded break-all border border-gray-100 dark:border-gray-800 mb-2">
                        {user.email}
                    </div>
                )}
                {(user as any).bio && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 italic px-1">
                        "{(user as any).bio}"
                    </p>
                )}
                {/* Tail */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white dark:border-t-gray-800 drop-shadow-sm"></div>
            </div>
        </div>
    );
};
