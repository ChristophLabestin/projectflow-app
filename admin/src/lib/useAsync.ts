import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from './api';

export type AsyncState<T> = { data: T | null; error: Error | null; loading: boolean; reload: () => void; setData: (fn: (prev: T | null) => T | null) => void };

/** Loads one adminApi action; re-runs when the serialized params change. */
export function useAdminQuery<T>(action: string | null, params?: unknown): AsyncState<T> {
    const [data, setDataState] = useState<T | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(Boolean(action));
    const [tick, setTick] = useState(0);
    const key = JSON.stringify(params ?? {});
    const seq = useRef(0);

    useEffect(() => {
        if (!action) return;
        const id = ++seq.current;
        setLoading(true);
        setError(null);
        adminApi<T>(action, JSON.parse(key))
            .then((result) => { if (id === seq.current) setDataState(result); })
            .catch((err) => { if (id === seq.current) setError(err); })
            .finally(() => { if (id === seq.current) setLoading(false); });
    }, [action, key, tick]);

    const reload = useCallback(() => setTick((t) => t + 1), []);
    const setData = useCallback((fn: (prev: T | null) => T | null) => setDataState(fn), []);
    return { data, error, loading, reload, setData };
}
