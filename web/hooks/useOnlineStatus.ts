import { useEffect, useState } from 'react';

/**
 * Tracks browser connectivity via the Network Information events.
 * Returns `true` when online. SSR-safe (defaults to online).
 */
export const useOnlineStatus = (): boolean => {
    const [online, setOnline] = useState<boolean>(
        typeof navigator === 'undefined' ? true : navigator.onLine,
    );

    useEffect(() => {
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    return online;
};
