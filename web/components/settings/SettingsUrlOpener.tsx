import type { ComponentProps } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingsModal } from '../SettingsModal';

type SettingsTab = NonNullable<ComponentProps<typeof SettingsModal>['initialTab']>;

/** Personal settings tabs that may be opened by link (e.g. the desktop app sends `?openSettings=account` to the browser). */
const LINKABLE_TABS: SettingsTab[] = ['account', 'security', 'notifications', 'preferences', 'ai', 'billing'];

export const SettingsUrlOpener = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('openSettings') as SettingsTab | null;
    if (!tab || !LINKABLE_TABS.includes(tab)) return null;
    const close = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('openSettings');
        next.delete('checkout');
        setSearchParams(next, { replace: true });
    };
    return <SettingsModal isOpen initialTab={tab} onClose={close} />;
};
