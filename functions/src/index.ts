import './init'; // Ensure init runs
import { setGlobalOptions } from 'firebase-functions/v2';

// Defaults for v2 functions only (v1 functions set their own region via functions.region()).
setGlobalOptions({ region: 'europe-west3', maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' });

import { testSMTPConnection } from './email';
import { newsletterSubscribe, newsletterUnsubscribe, api } from './newsletter';

import { createBlogPost, getBlogPosts, onBlogPostWrite } from './blog';
import { getCategories, manageCategories } from './categories';
import { onNotificationCreated, sendTestNotification } from './notifications';
import { acceptWorkspaceInvite, sendInvitation } from './invitations';
import { requestWaitlist, confirmWaitlist } from './waitlist';
import { requestNewsletterSignup, confirmNewsletterSignup } from './newsletter-public';
import { sendContactFormEmail } from './contact';
import { askCora, generateImage, editImage, callGemini } from './ai-service';
import { getInitiativeFeedbackForm, saveInitiativeFeedbackConfig, submitInitiativeFeedback } from './initiative-feedback';
import { getProjectIntakeForm, saveProjectIntakeConfig, submitProjectIntake } from './project-intake';
import { autoStartSprints, dailyHealthSnapshots } from './scheduler';
import { onProjectTaskGitHubSync } from './github-task-sync';
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
    createTenantFileUploadSession,
    deleteTenantFile,
    disconnectGoogleDriveStorage,
    finalizeTenantFileUpload,
    getGoogleDriveStorageAuthUrl,
    getTenantFirebaseStorageDownloadUrl,
    getTenantFileDownloadUrl,
    getWorkspaceFileStorageConfig,
    googleDriveStorageCallback,
    listTenantFiles,
    saveWorkspaceFileStorageConfig,
    testWorkspaceFileStorageConnection,
} from './file-storage';
import {
    allocatePayment,
    buildFinancialReports,
    buildTaxReport,
    calculateScenarioSnapshot,
    confirmReconciliation,
    confirmExtractedInvoiceDraft,
    createBill,
    createInvoice,
    deleteFinanceDocument,
    deleteFinanceRecurringTemplate,
    advanceInvoiceDunning,
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
    runFinanceSync,
    suggestReconciliation,
    unallocatePayment,
    linkFinanceDocumentToEntity,
    listFinanceOperationRuns,
    upsertFinanceAllocationRule,
    upsertFinanceOperationTemplate,
    upsertFinanceAccount,
    upsertFinanceCustomer,
    upsertFinancePeriod,
    upsertFinanceRecurringTemplate,
    upsertFinanceSettings,
    upsertFinanceSyncConnection,
    upsertFinanceTaxCode,
    upsertFinanceVendor,
    uploadFinanceDocument,
    versionFinanceDocument,
    previewFinanceOperation,
    executeFinanceOperation,
    getFinanceOperationRun,
    retryFinanceOperationRun,
    recommendFinanceOperations,
    deleteFinanceOperationTemplate,
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
    sendTestNotification,
    sendInvitation,
    acceptWorkspaceInvite,
    requestWaitlist,
    confirmWaitlist,
    requestNewsletterSignup,
    confirmNewsletterSignup,
    sendContactFormEmail,
    askCora,
    generateImage,
    editImage,
    callGemini,
    saveInitiativeFeedbackConfig,
    getInitiativeFeedbackForm,
    submitInitiativeFeedback,
    saveProjectIntakeConfig,
    getProjectIntakeForm,
    submitProjectIntake,
    autoStartSprints,
    dailyHealthSnapshots,
    onProjectTaskGitHubSync,
    getWorkspaceSmtpConfig,
    saveWorkspaceSmtpConfig,
    listWorkspaceApiTokens,
    createWorkspaceApiToken,
    deleteWorkspaceApiToken,
    getWorkspaceFinancialConfig,
    saveWorkspaceFinancialConfig,
    fetchWorkspaceFinancialUsage,
    getWorkspaceFileStorageConfig,
    saveWorkspaceFileStorageConfig,
    testWorkspaceFileStorageConnection,
    getGoogleDriveStorageAuthUrl,
    disconnectGoogleDriveStorage,
    createTenantFileUploadSession,
    finalizeTenantFileUpload,
    listTenantFiles,
    getTenantFirebaseStorageDownloadUrl,
    getTenantFileDownloadUrl,
    deleteTenantFile,
    googleDriveStorageCallback,
    postJournalEntry,
    createInvoice,
    issueInvoice,
    voidInvoice,
    advanceInvoiceDunning,
    createBill,
    confirmExtractedInvoiceDraft,
    extractInvoiceFromDocument,
    uploadFinanceDocument,
    versionFinanceDocument,
    previewFinanceOperation,
    executeFinanceOperation,
    getFinanceOperationRun,
    listFinanceOperationRuns,
    retryFinanceOperationRun,
    recommendFinanceOperations,
    upsertFinanceOperationTemplate,
    deleteFinanceOperationTemplate,
    linkFinanceDocumentToEntity,
    deleteFinanceDocument,
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
    upsertFinanceRecurringTemplate,
    deleteFinanceRecurringTemplate,
    upsertFinanceAllocationRule,
    upsertFinanceSyncConnection,
    runFinanceSync,
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
export * from './desktopAuth';
export { mcp } from './mcp-server';
export { transferWorkspaceOwnership, deleteWorkspace } from './workspace-lifecycle';
export { exportMyData, deleteMyAccount } from './account-data';
export { deleteProject } from './project-delete';
export { getOnboardingStats } from './onboarding-stats';
// iOS backend work package (contracts C1-C5): side-effect triggers, reminders, nudges, Live Activity sync.
export { onTaskWritten, onSubtaskWritten, onCommentCreated, onProjectWritten } from './task-triggers';
export { deliverReminders } from './reminders';
export { sendNudges } from './nudges';
export { onUserFocusChanged } from './live-activity';
