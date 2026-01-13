import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIState } from '../../context/UIContext';

import { CreateIssueModal } from '../CreateIssueModal';

export const GlobalToast = () => {
    const { toast, closeToast } = useUIState();
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);

    const [showDetails, setShowDetails] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [modalDetails, setModalDetails] = useState('');

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
    if (!isVisible && !toast.show && !isIssueModalOpen) return null;

    const bgColor = toast.type === 'error' ? 'bg-red-500' :
        toast.type === 'success' ? 'bg-green-600' :
            'bg-blue-600';

    const handleCopy = () => {
        const fullMessage = toast.details ? `${toast.message}\n\nDetails:\n${toast.details}` : toast.message;
        navigator.clipboard.writeText(fullMessage);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenIssue = () => {
        setModalMessage(toast.message);
        setModalDetails(toast.details || '');
        setIsIssueModalOpen(true);
    };

    return (
        <>
            <div className={`
                 fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[2147483647]
                 flex flex-col rounded-xl shadow-2xl
                 text-white font-medium max-w-xl w-full
                 transition-all duration-300 ease-out
                 ${toast.show ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto' : 'translate-y-4 opacity-0 scale-95 pointer-events-none'}
                 ${bgColor}
            `}>
                <div className="flex items-center gap-3 px-4 py-3">
                    <span className="material-symbols-outlined text-[20px] shrink-0">
                        {toast.type === 'error' ? 'error' :
                            toast.type === 'success' ? 'check_circle' :
                                'info'}
                    </span>
                    <div className={`flex-1 text-sm ${toast.type === 'error' ? 'font-mono' : ''} break-all`}>
                        {toast.message}
                    </div>

                    {toast.type === 'error' && (
                        <>
                            {toast.details && (
                                <button
                                    onClick={() => setShowDetails(!showDetails)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                                    title={showDetails ? "Hide Details" : "Show Details"}
                                >
                                    <span className="material-symbols-outlined text-[16px]">
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
                                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-xs font-bold shrink-0"
                                >
                                    {toast.action.label}
                                </button>
                            )}
                            <button
                                onClick={handleOpenIssue}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                                title="Open Issue"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    bug_report
                                </span>
                            </button>
                            <button
                                onClick={handleCopy}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0 flex items-center justify-center"
                                title={copied ? "Copied!" : "Copy Error"}
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {copied ? 'check' : 'content_copy'}
                                </span>
                            </button>
                        </>
                    )}

                    <button
                        onClick={closeToast}
                        className="p-1 bg-white/20 hover:bg-white/30 rounded-full transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-[14px] block">close</span>
                    </button>
                </div>

                {showDetails && toast.details && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/10">
                        <pre className="text-[10px] font-mono whitespace-pre-wrap break-all opacity-80 max-h-40 overflow-y-auto">
                            {toast.details}
                        </pre>
                    </div>
                )}
            </div>

            <CreateIssueModal
                isOpen={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
                projectId="ogZ8Pyz8pwEQtv8I64nu"
                initialTitle="Bug Report"
                initialDescription={`${modalMessage}\n\nDetails:\n${modalDetails}`}
            />
        </>
    );
};
