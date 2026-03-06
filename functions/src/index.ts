import './init'; // Ensure init runs

import { testSMTPConnection } from './email';
import { newsletterSubscribe, newsletterUnsubscribe, api } from './newsletter';

import { createBlogPost, getBlogPosts, onBlogPostWrite } from './blog';
import { getCategories, manageCategories } from './categories';
import { onNotificationCreated } from './notifications';
import { sendInvitation } from './invitations';
import { requestWaitlist, confirmWaitlist } from './waitlist';
import { requestNewsletterSignup, confirmNewsletterSignup } from './newsletter-public';
import { sendContactFormEmail } from './contact';
import { askCora, generateImage, editImage, callGemini } from './ai-service';
import { getTikTokAuthUrl, tiktokCallback } from './tiktok';
import { getYouTubeAuthUrl, youtubeCallback } from './youtube';
import { checkScheduledPosts, debugScheduler, autoStartSprints, dailyHealthSnapshots, debugHealthSnapshots } from './scheduler';
import { getFacebookAuthUrl, facebookCallback } from './facebook';
import {
    createWorkspaceApiToken,
    deleteWorkspaceApiToken,
    fetchWorkspaceFinancialUsage,
    getWorkspaceFinancialConfig,
    getWorkspaceSmtpConfig,
    listWorkspaceApiTokens,
    saveWorkspaceFinancialConfig,
    saveWorkspaceSmtpConfig
} from './workspace-admin';
import {
    allocatePayment,
    buildFinancialReports,
    buildTaxReport,
    calculateScenarioSnapshot,
    confirmReconciliation,
    createBill,
    createInvoice,
    extractInvoiceFromDocument,
    generateDatevExport,
    importBankStatement,
    issueInvoice,
    migrateLegacyFinanceV1ToV2,
    postBill,
    postJournalEntry,
    recordPayment,
    reopenPeriod,
    runMonthlyClose,
    suggestReconciliation,
    unallocatePayment,
    upsertFinanceAccount,
    upsertFinanceCustomer,
    upsertFinancePeriod,
    upsertFinanceSettings,
    upsertFinanceTaxCode,
    upsertFinanceVendor,
    upsertScenario,
    voidBill,
    voidInvoice
} from './finance-v2';



export {
    testSMTPConnection,
    newsletterSubscribe,
    newsletterUnsubscribe,
    api,
    createBlogPost,
    getBlogPosts,
    onBlogPostWrite,
    getCategories,
    manageCategories,
    onNotificationCreated,
    sendInvitation,
    requestWaitlist,
    confirmWaitlist,
    requestNewsletterSignup,
    confirmNewsletterSignup,
    sendContactFormEmail,
    askCora,
    generateImage,
    editImage,
    callGemini,
    getTikTokAuthUrl,
    tiktokCallback,
    getYouTubeAuthUrl,
    youtubeCallback,
    checkScheduledPosts,
    debugScheduler,
    autoStartSprints,
    dailyHealthSnapshots,
    debugHealthSnapshots,
    getFacebookAuthUrl,
    facebookCallback,
    getWorkspaceSmtpConfig,
    saveWorkspaceSmtpConfig,
    listWorkspaceApiTokens,
    createWorkspaceApiToken,
    deleteWorkspaceApiToken,
    getWorkspaceFinancialConfig,
    saveWorkspaceFinancialConfig,
    fetchWorkspaceFinancialUsage,
    postJournalEntry,
    createInvoice,
    issueInvoice,
    voidInvoice,
    createBill,
    extractInvoiceFromDocument,
    postBill,
    voidBill,
    recordPayment,
    allocatePayment,
    unallocatePayment,
    importBankStatement,
    suggestReconciliation,
    confirmReconciliation,
    runMonthlyClose,
    reopenPeriod,
    generateDatevExport,
    buildFinancialReports,
    buildTaxReport,
    migrateLegacyFinanceV1ToV2,
    upsertScenario,
    calculateScenarioSnapshot,
    upsertFinanceAccount,
    upsertFinancePeriod,
    upsertFinanceSettings,
    upsertFinanceCustomer,
    upsertFinanceVendor,
    upsertFinanceTaxCode
};
export * from './passkeys';
