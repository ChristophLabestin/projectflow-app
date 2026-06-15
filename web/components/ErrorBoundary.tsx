import React from 'react';
import { reportError } from '../services/errorReporting';

type ErrorBoundaryProps = {
    children: React.ReactNode;
};

type ErrorBoundaryState = {
    hasError: boolean;
};

// Crash-safe copy: this boundary wraps the i18n provider itself, so it cannot
// use the translation context. We read the persisted language directly.
const COPY = {
    en: {
        title: 'Something went wrong',
        body: 'An unexpected error occurred. You can try reloading the page.',
        reload: 'Reload',
    },
    de: {
        title: 'Etwas ist schiefgelaufen',
        body: 'Ein unerwarteter Fehler ist aufgetreten. Du kannst die Seite neu laden.',
        reload: 'Neu laden',
    },
} as const;

const resolveCopy = () => {
    try {
        const lang = localStorage.getItem('pf-language');
        if (lang && lang.toLowerCase().startsWith('de')) {
            return COPY.de;
        }
    } catch {
        // localStorage may be unavailable (private mode); fall back to English.
    }
    return COPY.en;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        reportError(error, { componentStack: info.componentStack });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        const copy = resolveCopy();
        return (
            <div className="error-boundary" role="alert">
                <div className="error-boundary__card">
                    <span className="material-symbols-outlined error-boundary__icon">error</span>
                    <h1 className="error-boundary__title">{copy.title}</h1>
                    <p className="error-boundary__body">{copy.body}</p>
                    <button type="button" className="error-boundary__button" onClick={this.handleReload}>
                        {copy.reload}
                    </button>
                </div>
            </div>
        );
    }
}
