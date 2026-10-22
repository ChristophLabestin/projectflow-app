import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIState } from '../../context/UIContext';
import { useLanguage } from '../../context/LanguageContext';

export const GlobalToast = () => {
    const { toast, closeToast } = useUIState();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);

    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (toast.show) {
            setIsVisible(true);
            setCopied(false);
            setShowDetails(false); // Default to collapsed
        } else {
            // Delay unmounting for exit animation
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    // Don't unmount if modal is open, so it doesn't disappear
    if (!isVisible && !toast.show) return null;

    const toneClass = toast.type === 'error' ? 'global-toast--error' :
        toast.type === 'success' ? 'global-toast--success' :
            'global-toast--info';

    const handleCopy = () => {
        const fullMessage = toast.details ? `${toast.message}\n\nDetails:\n${toast.details}` : toast.message;
        navigator.clipboard.writeText(fullMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <div className={`global-toast ${toneClass} ${toast.show ? 'global-toast--visible' : ''}`}>
                <div className="global-toast__row">
                    <span className="material-symbols-outlined global-toast__icon">
                        {toast.type === 'error' ? 'error' :
                            toast.type === 'success' ? 'check_circle' :
                                'info'}
                    </span>
                    <div className={`global-toast__message ${toast.type === 'error' ? 'global-toast__message--mono' : ''}`}>
                        {toast.message}
                    </div>

                    {toast.type === 'error' && (
                        <>
                            {toast.details && (
                                <button
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="global-toast__btn"
                                    title={showDetails ? "Hide Details" : "Show Details"}
                                >
                                    <span className="material-symbols-outlined">
                                        {showDetails ? 'expand_less' : 'expand_more'}
                                    </span>
                                </button>
                            )}
                            {toast.action && (
                                <button
                                    onClick={() => {
                                        navigate(toast.action!.path);
                                        closeToast();
                                    }}
                                    className="global-toast__btn global-toast__btn--action"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                            <button
                                onClick={handleCopy}
                                className="global-toast__btn"
                                title={copied ? "Copied!" : "Copy Error"}
                            >
                                <span className="material-symbols-outlined">
                                    {copied ? 'check' : 'content_copy'}
                                </span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={closeToast}
                        aria-label={t('common.close')}
                        className="global-toast__btn global-toast__btn--close"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {showDetails && toast.details && (
                    <div className="global-toast__details">
                        <pre className="global-toast__pre">
                            {toast.details}
                        </pre>
                    </div>
                )}
            </div>

        </>
    );
};
