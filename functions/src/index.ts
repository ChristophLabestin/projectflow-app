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
import { generateImage, editImage, runAiCapability } from './ai-service';
import { aiAssist } from './ai-assist';
import { aiApplyProposal, aiUndoProposal } from './ai-actions';
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
import { getWorkspaceAiPolicy, listWorkspaceAiAudit, updateWorkspaceAiPolicy } from './ai-integrations';
import {
    approveOAuthConsent,
    createPersonalAccessToken,
    denyOAuthConsent,
    getOAuthConsentRequest,
    listAiConnections,
    oauth,
    revokeAiConnection
} from './oauth-server';
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
    getTenantFileUrls,
    getWorkspaceFileQuota,
    purgeTenantFile,
    restoreTenantFile,
    trashTenantFile,
    updateTenantFile,
} from './files-manager';



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
    generateImage,
    editImage,
    runAiCapability,
    aiAssist,
    aiApplyProposal,
    aiUndoProposal,
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
    getWorkspaceAiPolicy,
    updateWorkspaceAiPolicy,
    listWorkspaceAiAudit,
    oauth,
    getOAuthConsentRequest,
    approveOAuthConsent,
    denyOAuthConsent,
    createPersonalAccessToken,
    listAiConnections,
    revokeAiConnection,
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
    getTenantFileUrls,
    getWorkspaceFileQuota,
    purgeTenantFile,
    restoreTenantFile,
    trashTenantFile,
    updateTenantFile,
    listTenantFiles,
    getTenantFirebaseStorageDownloadUrl,
    getTenantFileDownloadUrl,
    deleteTenantFile,
    googleDriveStorageCallback,
};
export * from './passkeys';
export * from './desktopAuth';
export { mcp, mcpServer } from './mcp-server';
export { crashIngest } from './crash-reports';
export { transferWorkspaceOwnership, deleteWorkspace } from './workspace-lifecycle';
export { exportMyData, deleteMyAccount } from './account-data';
export { deleteProject } from './project-delete';
export { adminApi } from './admin-console';
export {
    acceptLegalDocuments,
    declineLegalDocuments,
    legalDocument,
    onLegalMailJobCreated,
    processLegalMailJobs,
} from './legal';
// iOS backend work package (contracts C1-C5): side-effect triggers, reminders, nudges, Live Activity sync.
export { onTaskWritten, onSubtaskWritten, onCommentCreated, onProjectWritten } from './task-triggers';
export { onWikiDocWritten } from './wiki-triggers';
export { computeWorkspaceInsights, refreshWorkspaceInsights, generateWeeklyInsightsReport } from './insights';
// Flows (automations): brain/plans/flows-concept.md
export {
    onAutomationEvent, runAutomationSchedules, saveAutomation, setAutomationEnabled, deleteAutomation,
    runAutomation, retryAutomationRun, previewAutomation, draftAutomationFromText
} from './automations';
export { deliverReminders } from './reminders';
export { sendNudges } from './nudges';
export { onUserFocusChanged } from './live-activity';
// Billing (Stripe test mode, plan entitlements): brain/plans/billing-implementation.md
export {
    createBillingCheckout, createBillingPortal, stripeWebhook, personalAiKey, setAiAddonMembers, ensurePersonalWorkspace,
    previewSubscription, createSubscriptionIntent,
    onTenantCreatedBilling, onProjectCountBilling, onMemberWrittenBilling, billingSweep
} from './billing';
