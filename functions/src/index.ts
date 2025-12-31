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
import { createBlogMetaFunction } from './blogMetaFunction';
import * as path from 'path';
import { db } from './init';

const blogMeta = createBlogMetaFunction(db, path.join(__dirname, '../landing-page-index.html'));


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
    blogMeta
};
export * from './passkeys';


