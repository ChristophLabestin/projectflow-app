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
    facebookCallback
};
export * from './passkeys';


