import { useEffect, useState } from 'react';
import { getDesktopBridge, hasDesktopCapability, type DesktopUpdateState } from '../services/desktop';

/** Update status of the desktop shell (capability 'updates'); `none` outside the desktop app. */
export const useDesktopUpdate = (): DesktopUpdateState => {
    const [state, setState] = useState<DesktopUpdateState>({ status: 'none' });
    useEffect(() => {
        const bridge = getDesktopBridge();
        if (!bridge?.getUpdateState || !bridge.onUpdateStateChange || !hasDesktopCapability('updates')) return undefined;
        let mounted = true;
        void bridge.getUpdateState().then((next) => { if (mounted) setState(next); });
        const unsubscribe = bridge.onUpdateStateChange(setState);
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);
    return state;
};
