import React from 'react';
import { useLanguage } from '../../context/LanguageContext';

type DataStateProps = {
    /** True while the initial data load is in flight. */
    loading?: boolean;
    /** Truthy when the load failed; renders the error state with a retry action. */
    error?: unknown;
    /** True when the load succeeded but produced no items. */
    isEmpty?: boolean;
    /** Retry handler shown on the error state (and optionally empty state). */
    onRetry?: () => void;
    loadingLabel?: string;
    errorTitle?: string;
    errorMessage?: string;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyIcon?: string;
    /** Rendered when data is present (not loading/error/empty). */
    children?: React.ReactNode;
};

/**
 * Standardizes the loading / error / empty / ready states for data-fetching
 * surfaces so screens stop assuming success. Drop it around any list/section
 * that loads async data.
 */
export const DataState = ({
    loading,
    error,
    isEmpty,
    onRetry,
    loadingLabel,
    errorTitle,
    errorMessage,
    emptyTitle,
    emptyMessage,
    emptyIcon = 'inbox',
    children,
}: DataStateProps) => {
    const { t } = useLanguage();

    if (loading) {
        return (
            <div className="data-state" role="status" aria-live="polite">
                <span className="data-state__spinner" aria-hidden="true" />
                <p className="data-state__text">
                    {loadingLabel ?? t('common.loading', 'Loading…')}
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="data-state data-state--error" role="alert">
                <span className="material-symbols-outlined data-state__icon">error</span>
                <p className="data-state__title">
                    {errorTitle ?? t('common.dataError.title', 'Something went wrong')}
                </p>
                <p className="data-state__text">
                    {errorMessage ?? t('common.dataError.message', "We couldn't load this. Please try again.")}
                </p>
                {onRetry && (
                    <button type="button" className="data-state__retry" onClick={onRetry}>
                        {t('common.retry', 'Try again')}
                    </button>
                )}
            </div>
        );
    }

    if (isEmpty) {
        return (
            <div className="data-state data-state--empty">
                <span className="material-symbols-outlined data-state__icon">{emptyIcon}</span>
                <p className="data-state__title">
                    {emptyTitle ?? t('common.empty.title', 'Nothing here yet')}
                </p>
                {emptyMessage && <p className="data-state__text">{emptyMessage}</p>}
            </div>
        );
    }

    return <>{children}</>;
};
