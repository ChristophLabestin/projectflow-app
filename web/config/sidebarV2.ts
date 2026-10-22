// Feature flag for the "Navigator" sidebar redesign (SidebarNavigator).
//
// Resolution order:
//   1. localStorage override `projectflow.sidebarV2` ('1' = on, '0' = off) — lets
//      you A/B the new vs. legacy sidebar live without a rebuild.
//   2. Build-time env `VITE_SIDEBAR_V2` ('false' / '0' disables it).
//   3. Default: on.
//
// Mirrors the pattern used by `config/pmCore.ts`.

const SIDEBAR_V2_STORAGE_KEY = 'projectflow.sidebarV2';

const readSidebarV2Env = (): boolean => {
    const raw = import.meta.env.VITE_SIDEBAR_V2;
    if (raw === undefined || raw === '') return true;
    return raw !== 'false' && raw !== '0';
};

export const isSidebarV2Enabled = (): boolean => {
    if (typeof window !== 'undefined') {
        try {
            const override = window.localStorage.getItem(SIDEBAR_V2_STORAGE_KEY);
            if (override === '1') return true;
            if (override === '0') return false;
        } catch {
            // Ignore storage access errors; fall back to env default.
        }
    }
    return readSidebarV2Env();
};
