import React, { useEffect, useState } from 'react';
import { useUIState } from '../../context/UIContext';
import { Button } from './Button';

export const GlobalConfirmationModal = () => {
    const { confirmation, closeConfirmation } = useUIState();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (confirmation.show) {
            setIsVisible(true);
        } else {
            // Delay for exit animation
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [confirmation.show]);

    if (!isVisible && !confirmation.show) return null;

    return (
        <div className={`
             fixed inset-0 z-[2147483647] flex items-center justify-center p-4
             transition-opacity duration-200
             ${confirmation.show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => closeConfirmation(false)}
            />

            {/* Modal */}
            <div className={`
                 bg-[var(--color-surface-card)] rounded-2xl shadow-2xl 
                 max-w-sm w-full p-6 relative border border-[var(--color-surface-border)]
                 transform transition-all duration-300
                 ${confirmation.show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
            `}>
                <h3 className="text-xl font-bold mb-2 text-[var(--color-text-main)]">
                    {confirmation.title}
                </h3>
                <p className="text-[var(--color-text-muted)] text-sm mb-6 leading-relaxed">
                    {confirmation.message}
                </p>

                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => closeConfirmation(false)}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => closeConfirmation(true)}
                        className="flex-1"
                    >
                        Confirm
                    </Button>
                </div>
            </div>
        </div>
    );
};
