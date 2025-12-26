import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const ErrorPage = () => {
    const error = useRouteError();
    const navigate = useNavigate();

    let errorMessage = 'An unexpected error has occurred.';
    let errorStatus = 'Oops!';

    if (isRouteErrorResponse(error)) {
        // error is type `ErrorResponse`
        errorMessage = error.statusText || error.data?.message || 'Page not found';
        errorStatus = error.status.toString();
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col items-center justify-center p-4 text-center">
            <div className="max-w-md w-full bg-[var(--color-surface-card)] border border-[var(--color-surface-border)] rounded-2xl p-8 shadow-xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="size-20 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-5xl text-red-500">
                        error_outline
                    </span>
                </div>

                <h1 className="text-4xl font-black text-[var(--color-text-main)] mb-2">
                    {errorStatus}
                </h1>

                <p className="text-[var(--color-text-muted)] mb-8 text-lg">
                    {errorMessage}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <Button
                        variant="secondary"
                        onClick={() => navigate(-1)}
                        className="flex-1 justify-center"
                        icon={<span className="material-symbols-outlined text-[18px]">arrow_back</span>}
                    >
                        Go Back
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => navigate('/')}
                        className="flex-1 justify-center"
                        icon={<span className="material-symbols-outlined text-[18px]">home</span>}
                    >
                        Go Home
                    </Button>
                </div>

                <div className="mt-8 pt-6 border-t border-[var(--color-surface-border)] w-full">
                    <p className="text-xs text-[var(--color-text-subtle)]">
                        If this persists, please contact support.
                    </p>
                </div>
            </div>
        </div>
    );
};
