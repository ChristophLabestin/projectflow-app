import { useCallback, useEffect, useState } from 'react';

/**
 * Personal in-app AI preferences (this device): the ✦ that follows the caret in text fields can be
 * switched off (Settings → AI & integrations). Selection tools and ⌘J stay available.
 */
const KEY = 'pf-ai-caret-spark';
const EVENT = 'pf:ai-prefs-changed';

const readCaretSpark = () => {
    try {
        return localStorage.getItem(KEY) !== 'off';
    } catch {
        return true;
    }
};

export const useAiPrefs = () => {
    const [caretSpark, setCaretSparkState] = useState(readCaretSpark);
    useEffect(() => {
        const sync = () => setCaretSparkState(readCaretSpark());
        window.addEventListener(EVENT, sync);
        window.addEventListener('storage', sync);
        return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
    }, []);
    const setCaretSpark = useCallback((on: boolean) => {
        try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
        window.dispatchEvent(new Event(EVENT));
    }, []);
    return { caretSpark, setCaretSpark };
};
