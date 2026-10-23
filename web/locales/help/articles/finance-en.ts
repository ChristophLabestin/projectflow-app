import type { HelpArticle } from '../../../components/help/helpTypes';

const article: HelpArticle = {
    id: 'finance',
    category: 'workspace',
    icon: 'account_balance_wallet',
    title: 'Finance',
    summary: 'Track income and expenses, recurring bookings, invoices and bank lines, and see how profitable your projects are.',
    keywords: ['finance', 'accounting', 'income', 'expenses', 'transactions', 'recurring', 'invoices', 'receivables', 'payables', 'bank', 'reconciliation', 'tax', 'datev', 'export', 'reports', 'profitability', 'cockpit'],
    sections: [
        {
            id: 'access',
            title: 'Where do I find Finance, and who can see it?',
            keywords: ['access', 'permission', 'more', 'sidebar', 'restricted'],
            blocks: [
                { type: 'text', text: 'Finance is a workspace-wide area, separate from your projects. Open **Finance** in the sidebar (it may sit behind **More**) or go straight to the [Finance cockpit](/finance/cockpit).' },
                { type: 'text', text: 'Only people with finance access see it, and Guests never do. Without permission you get **Access Restricted**. Viewing and editing are separate rights: to add or change bookings you need the manage permission, otherwise the buttons are disabled.' },
            ],
        },
        {
            id: 'cockpit',
            title: 'What do I see in the Cockpit?',
            keywords: ['overview', 'chart', 'period', 'filters', 'net balance', 'profitability'],
            blocks: [
                { type: 'text', text: 'The cockpit is the overview. It shows **Total Income**, **Total Expenses** and **Net Balance**, and an **Income vs Expenses** chart with monthly totals.' },
                { type: 'text', text: 'Pick a period (for example **30D**, **3M**, **YTD**, **All time** or **Custom**) and narrow the data under **Filters** by type, project or category. **Clear filters** resets everything. **Project Profitability** lists income, costs, net profit and margin per project.' },
            ],
        },
        {
            id: 'add-bookings',
            title: 'How do I record income and expenses?',
            keywords: ['add transaction', 'recurring', 'booking', 'income', 'expense', 'project', 'category'],
            blocks: [
                {
                    type: 'steps',
                    items: [
                        'Open the **Cockpit** or **Bookings**.',
                        'Click **Add Transaction** for a one-off booking, or **Add Recurring** for something that repeats.',
                        'Choose **Income** or **Expense**, enter date, category, amount and notes.',
                        'Optionally link a **Project** so the booking shows up in **Project Profitability**.',
                        'Click **Save**.',
                    ],
                },
                { type: 'text', text: 'All recorded bookings are listed under **Transactions**.' },
            ],
        },
        {
            id: 'areas',
            title: 'What are the other Finance areas?',
            keywords: ['receivables', 'payables', 'bank', 'tax', 'reports', 'exports', 'close', 'sync', 'settings', 'planning', 'calculations', 'functions', 'datev'],
            blocks: [
                { type: 'text', text: 'While you are in Finance, the sidebar switches to the Finance areas:' },
                {
                    type: 'terms',
                    items: [
                        { term: 'Bookings', text: 'Bookings and ledger data in one list.' },
                        { term: 'Receivables', text: 'Open customer invoices and their payment status.' },
                        { term: 'Payables', text: 'Open vendor bills and outgoing payments.' },
                        { term: 'Bank & Reconciliation', text: 'Import bank lines, get match suggestions and confirm reconciliations.' },
                        { term: 'Tax', text: 'Tax reports for German-compliant workflows.' },
                        { term: 'Reports', text: 'Trial balance, profit and loss, balance sheet and project profitability.' },
                        { term: 'Exports & Close', text: 'DATEV export jobs and period close.' },
                        { term: 'Sync', text: 'Run and monitor syncs with external billing and accounting systems.' },
                        { term: 'Settings', text: 'Defaults and governance settings for the accounting core.' },
                        { term: 'Planning & Calculations', text: 'Calculation and planning tools.' },
                    ],
                },
                { type: 'callout', tone: 'note', text: 'Each area has its own permission (for example for invoices, bank data, tax, close or DATEV export). If an action is missing for you, ask a workspace admin to check your role.' },
            ],
        },
    ],
};

export default article;
