import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const AccountingPlaceholder = () => {
    // const { t } = useLanguage(); 
    // Assuming simple placeholder for now as requested.

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in">
            <div className="size-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/10">
                <span className="material-symbols-outlined text-5xl text-emerald-600 dark:text-emerald-400">receipt_long</span>
            </div>
            <h1 className="text-3xl font-bold text-main mb-3">Accounting Module</h1>
            <p className="text-subtle max-w-md text-lg">
                This module is currently under development. It will allow you to manage project finances, invoices, and expenses.
            </p>
            <div className="mt-8 px-4 py-2 bg-surface-hover rounded-full text-xs font-semibold text-muted border border-surface">
                Coming Soon
            </div>
        </div>
    );
};
