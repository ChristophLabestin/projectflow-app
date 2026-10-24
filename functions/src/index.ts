// Node process uptime when index.ts starts loading (cold start log below).
const indexStartMs = process.uptime() * 1000;
import './init'; // Ensure init runs
import { setGlobalOptions } from 'firebase-functions/v2/options';

// Defaults for v2 functions only (v1 functions set their own region via functions.region()).
setGlobalOptions({ region: 'europe-west3', maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' });

/**
 * Lazy export map (cold start): every function is exported through a getter that loads its
 * module on first access. The runtime only reads `exports[FUNCTION_TARGET]`, so an instance
 * loads just its own module instead of every SDK; deploy discovery enumerates all getters.
 * New function: add its name under its module here. `scripts/unit/index-exports.test.js`
 * fails when a module exports a function that is missing from this map.
 * See brain/operations/functions-performance.md.
 */
const FUNCTION_MODULES: Record<string, string[]> = {
    './email': ['testSMTPConnection'],
    './newsletter': ['newsletterSubscribe', 'newsletterUnsubscribe', 'api'],
    './blog': ['createBlogPost', 'getBlogPosts', 'onBlogPostWrite'],
    './categories': ['getCategories', 'manageCategories'],
    './notifications': ['onNotificationCreated', 'sendTestNotification'],
    './invitations': ['acceptWorkspaceInvite', 'sendInvitation'],
    // Platform waitlist + newsletter (double opt-in, campaigns): brain/plans/newsletter-concept.md
    './platform-newsletter/public': ['requestWaitlist', 'requestNewsletterSignup', 'confirmOptin'],
    './platform-newsletter/app': ['platformNewsletterPreference'],
    './platform-newsletter/dispatch': ['platformNewsletterDispatch'],
    './contact': ['sendContactFormEmail'],
    './email-events': ['emailUnsubscribe', 'sesEvents'],
    './ai-service': ['generateImage', 'editImage', 'runAiCapability'],
    './ai-assist': ['aiAssist'],
    './ai-actions': ['aiApplyProposal', 'aiUndoProposal'],
    './initiative-feedback': ['getInitiativeFeedbackForm', 'saveInitiativeFeedbackConfig', 'submitInitiativeFeedback'],
    './project-intake': ['getProjectIntakeForm', 'saveProjectIntakeConfig', 'submitProjectIntake'],
    './scheduler': ['autoStartSprints', 'dailyHealthSnapshots'],
    './github-task-sync': ['onProjectTaskGitHubSync'],
    './workspace-admin': [
        'createWorkspaceApiToken', 'deleteWorkspaceApiToken', 'fetchWorkspaceFinancialUsage', 'getWorkspaceFinancialConfig',
        'getWorkspaceSmtpConfig', 'listWorkspaceApiTokens', 'saveWorkspaceFinancialConfig', 'saveWorkspaceSmtpConfig'
    ],
    './ai-integrations': ['getWorkspaceAiPolicy', 'listWorkspaceAiAudit', 'updateWorkspaceAiPolicy'],
    './oauth-server': [
        'approveOAuthConsent', 'createPersonalAccessToken', 'denyOAuthConsent', 'getOAuthConsentRequest',
        'listAiConnections', 'oauth', 'revokeAiConnection'
    ],
    './file-storage': [
        'createTenantFileUploadSession', 'deleteTenantFile', 'disconnectGoogleDriveStorage', 'finalizeTenantFileUpload',
        'getGoogleDriveStorageAuthUrl', 'getTenantFirebaseStorageDownloadUrl', 'getTenantFileDownloadUrl',
        'getWorkspaceFileStorageConfig', 'googleDriveStorageCallback', 'listTenantFiles', 'saveWorkspaceFileStorageConfig',
        'testWorkspaceFileStorageConnection'
    ],
    './files-manager': [
        'getTenantFileUrls', 'getWorkspaceFileQuota', 'purgeTenantFile', 'restoreTenantFile', 'trashTenantFile', 'updateTenantFile'
    ],
    './passkeys': [
        'generatePasskeyRegistrationOptions', 'verifyPasskeyRegistration',
        'generatePasskeyAuthenticationOptions', 'verifyPasskeyAuthentication'
    ],
    './desktopAuth': ['createDesktopAuthCode', 'exchangeDesktopAuthCode'],
    './mcp-server': ['mcp', 'mcpServer'],
    './crash-reports': ['crashIngest'],
    './workspace-lifecycle': ['transferWorkspaceOwnership', 'deleteWorkspace'],
    './account-data': ['exportMyData', 'deleteMyAccount'],
    './project-delete': ['deleteProject'],
    './admin-console': ['adminApi'],
    './admin-console/mcp/oauth': ['adminOAuth'],
    './admin-console/mcp/server': ['adminMcp'],
    './legal': ['acceptLegalDocuments', 'declineLegalDocuments', 'legalDocument', 'onLegalMailJobCreated', 'processLegalMailJobs'],
    // iOS backend work package (contracts C1-C5): side-effect triggers, reminders, nudges, Live Activity sync.
    './task-triggers': ['onTaskWritten', 'onSubtaskWritten', 'onCommentCreated', 'onProjectWritten'],
    './wiki-triggers': ['onWikiDocWritten'],
    './insights': ['computeWorkspaceInsights', 'refreshWorkspaceInsights', 'generateWeeklyInsightsReport'],
    // Flows (automations): brain/plans/flows-concept.md
    './automations': [
        'onAutomationEvent', 'runAutomationSchedules', 'saveAutomation', 'setAutomationEnabled', 'deleteAutomation',
        'runAutomation', 'retryAutomationRun', 'previewAutomation', 'draftAutomationFromText'
    ],
    './reminders': ['deliverReminders'],
    './nudges': ['sendNudges'],
    './live-activity': ['onUserFocusChanged'],
    // Billing (Stripe test mode, plan entitlements): brain/plans/billing-implementation.md
    './billing': [
        'createBillingCheckout', 'createBillingPortal', 'stripeWebhook', 'personalAiKey', 'setAiAddonMembers', 'ensurePersonalWorkspace',
        'previewSubscription', 'createSubscriptionIntent', 'recordCheckoutConsent', 'getBillingConfig', 'listBillingWorkspaces', 'createTeamWorkspace', 'setWorkspaceMemberRole',
        'getSubscriptionStatus', 'onTenantCreatedBilling', 'onProjectCountBilling', 'onMemberWrittenBilling', 'billingSweep'
    ],
    // Seat management (contract §9)
    './billing-seats': ['previewSeatChange', 'changeSeats', 'getBillingOverview'],
};

let coldStartLogged = false;

for (const [modulePath, names] of Object.entries(FUNCTION_MODULES)) {
    for (const name of names) {
        Object.defineProperty(exports, name, {
            enumerable: true,
            get: () => {
                const loadStartMs = process.uptime() * 1000;
                const fn = require(modulePath)[name];
                if (!fn) throw new Error(`index.ts: ${modulePath} does not export ${name}`);
                if (!coldStartLogged && name === process.env.FUNCTION_TARGET) {
                    // One line per instance: node boot, init + SDK base, own module (ms since process start).
                    coldStartLogged = true;
                    const doneMs = process.uptime() * 1000;
                    console.log(JSON.stringify({
                        message: 'coldStart', target: name,
                        nodeBootMs: Math.round(indexStartMs),
                        initMs: Math.round(loadStartMs - indexStartMs),
                        moduleLoadMs: Math.round(doneMs - loadStartMs),
                    }));
                }
                return fn;
            },
        });
    }
}
