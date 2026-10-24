import React, { useCallback, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { AiPanelProvider, dataUrlToFile, useAiPanel } from '../context/AiPanelContext';
import { AiCommandBar } from '../components/ai/AiCommandBar';
import { desktopWindowKind, getDesktopBridge } from '../services/desktop';

/**
 * Desktop AI pop-out (`/desktop/assist`, global ⌃⌘J): the ⌘J command bar above any app. Payloads from the
 * shell reopen it, optionally with a Snap image (Quick Capture, "attach screen"). Links open in the main window.
 * Shell side: desktop/src/windows/assistWindow.ts.
 */
const AssistBar: React.FC = () => {
    const bridge = getDesktopBridge();
    const { enabled, open, openPanel } = useAiPanel();
    const wasOpen = useRef(false);

    useEffect(() => {
        openPanel();
        return bridge?.onWindowPayload?.((payload) => {
            const image = typeof payload.image === 'string' ? dataUrlToFile(payload.image) : null;
            openPanel(typeof payload.prompt === 'string' ? payload.prompt : undefined, image);
        });
    }, [bridge, openPanel]);

    // Esc / close in the bar hides the pop-out (kept alive for an instant re-open).
    useEffect(() => {
        if (open) wasOpen.current = true;
        else if (wasOpen.current) {
            wasOpen.current = false;
            bridge?.closeSelf?.();
        }
    }, [open, bridge]);

    const captureScreen = useCallback(async () => {
        const dataUrl = await bridge?.assist?.({ action: 'capture-screen' }).catch(() => null);
        return dataUrl ? dataUrlToFile(dataUrl) : null;
    }, [bridge]);

    const navigate = useCallback((path: string) => {
        bridge?.openInMain(path);
        bridge?.closeSelf?.();
    }, [bridge]);

    if (!enabled) return null;
    return <AiCommandBar variant="window" onCaptureScreen={bridge?.assist ? captureScreen : undefined} onNavigate={navigate} />;
};

export const DesktopAssistWindow: React.FC = () => {
    if (!getDesktopBridge() || desktopWindowKind() !== 'assist') return <Navigate to="/" replace />;
    return <AiPanelProvider><AssistBar /></AiPanelProvider>;
};
