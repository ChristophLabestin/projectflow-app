/**
 * Feature flag for the redesigned project overview (V2).
 *
 * Resolution order:
 *   1. URL query `?overviewV2=1` / `?overviewV2=0` (also persisted for the session)
 *   2. localStorage `projectflow.overviewV2`
 *   3. default: enabled
 *
 * The flag lets the new workspace ship alongside the legacy overview during the
 * strangler migration. It is removed once the rebuild is the permanent default.
 */
const OVERVIEW_V2_STORAGE_KEY = 'projectflow.overviewV2';

const parseFlag = (raw: string | null | undefined): boolean | null => {
    if (raw === null || raw === undefined || raw === '') return null;
    if (raw === '1' || raw === 'true' || raw === 'on') return true;
    if (raw === '0' || raw === 'false' || raw === 'off') return false;
    return null;
};

export const isOverviewV2Enabled = (): boolean => {
    if (typeof window === 'undefined') return true;

    try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = parseFlag(params.get('overviewV2'));
        if (fromQuery !== null) {
            window.localStorage.setItem(OVERVIEW_V2_STORAGE_KEY, fromQuery ? '1' : '0');
            return fromQuery;
        }
    } catch {
        // Ignore malformed URLs.
    }

    const stored = parseFlag(window.localStorage.getItem(OVERVIEW_V2_STORAGE_KEY));
    if (stored !== null) return stored;

    return true;
};

export const setOverviewV2Enabled = (enabled: boolean): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OVERVIEW_V2_STORAGE_KEY, enabled ? '1' : '0');
};
