# Privacy Policy

_Last updated: October 24, 2026_

This privacy policy applies to the website getprojectflow.com, the web app at app.getprojectflow.com, the iOS app and the desktop app (macOS/Windows) of ProjectFlow.

## 1. Controller

The controller within the meaning of the GDPR is:

Labestin Digital  
Owner: Christoph Labestin  
Ödwieser Weg 7  
84082 Laberweinting  
Germany  
Email: [hello@getprojectflow.com](mailto:hello@getprojectflow.com)

For content that customers store in their workspaces (for example data of team members or third parties), the customer or its organization is generally the controller and we act as a processor (see the Terms).

## 2. Overview

- **Website (getprojectflow.com):** no cookies, no analytics or tracking tools, no third-party embeds, no contact form. Only technically necessary server logs are created.
- **Web app, iOS app, desktop app:** processing of account, workspace and project data to provide the service.

## 3. Website getprojectflow.com

**Hosting and server logs.** The website is a static site served via Firebase Hosting (Google Ireland Limited / Google LLC). When you visit it, the following data is processed in server logs as technically required: IP address, date and time, requested URL and user agent. The purpose is secure and stable operation (Art. 6(1)(f) GDPR). Logs are deleted after about 14 days, or kept longer in the event of security incidents.

**Fonts.** Fonts are served from our own domain; no connection is made to third-party font servers.

**Language preference.** Your language choice may be stored in your browser's local storage (localStorage). This is technically necessary to remember your choice, is not transmitted to us and is not a cookie (Section 25(2) no. 2 TDDDG).

**Contact by email.** The website links to our email address (mailto). If you write to us, we process your details to handle your request (Art. 6(1)(b) or (f) GDPR) and generally delete them within 12 months after the last correspondence unless retention obligations apply.

## 4. Account, authentication and profile

To use the apps we process:

- **Account data:** name, email address, optional profile picture, language settings.
- **Sign-in data:** sign-in through Firebase Authentication using email/password, Google sign-in or a passkey. We do not store passwords ourselves; they are managed (hashed) by Firebase Authentication.
- **Passkeys (WebAuthn):** we store the public key, credential ID and technical metadata. The private key stays on your device or with your passkey provider (e.g. iCloud Keychain); biometric data (Face ID/Touch ID) never leaves your device and is not processed by us.
- **Workspace data:** memberships, roles and permissions.

Legal basis: performance of a contract (Art. 6(1)(b) GDPR).

## 5. Project and content data

All content you or your team create in the service (such as projects, tasks, comments, flows/ideas, files, blog posts, settings) is stored to provide the service and enable collaboration in the workspace. It is visible only to people with the corresponding permission in the workspace. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).

Files are stored in Firebase Storage by default. Workspace administrators may optionally connect their own storage (Amazon S3 or Google Drive); in that case files are stored with that storage provider under its terms.

## 6. Onboarding survey

During setup you can answer questions about your role, use cases, team size, industry, how you heard about ProjectFlow and your previous tool. The answers are stored linked to your profile, used to tailor the service and evaluated by us in aggregated form to improve the product (Art. 6(1)(f) GDPR). Answering is voluntary; you can have your answers deleted at any time.

## 7. AI features

When you use AI features (such as text suggestions, AI search, ideation, image generation, assistant), we send your input and the workspace context needed for it through a cloud function (region europe-west3, Frankfurt) to an AI provider and return the response to you. We currently use models from OpenAI Ireland Ltd. / OpenAI, L.L.C. for this. Processing in the USA is possible. AI features run only when you request them. According to our information, we do not use content to train our own models; processing by the provider is governed by its API terms. Please do not enter data you are not allowed to transmit. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).

## 8. Notifications and push messages

- **Email notifications** (e.g. invitations, reminders, activity) are sent via an SMTP service (currently Google infrastructure). Email address and message content are processed.
- **Push notifications (iOS):** if you allow notifications, a device- and app-specific push token is stored and transmitted to the Apple Push Notification service (APNs) or Firebase Cloud Messaging so that Apple or Google can deliver the message. Notification text and badge count pass through these services. You can disable push notifications at any time in iOS settings or in the app; the token is then deleted.
- **Live Activities (iOS)** also use Apple's push infrastructure to display ongoing activities (e.g. focus timer).

Legal basis: performance of a contract (Art. 6(1)(b) GDPR); for push notifications, your consent via the system prompt (Art. 6(1)(a) GDPR, Section 25(1) TDDDG).

## 9. iOS app

The iOS app uses the same account and content data as the web app. In addition:

- **Calendar (optional):** with your permission the app reads events through Apple's calendar interface to show free time in weekly planning. Events are processed locally on the device and are not transmitted to our servers.
- **Passkeys / Face ID:** see Section 4.
- **Photos/camera (optional):** only when you yourself choose a profile picture or file.

Apple processes data in its own responsibility in connection with the App Store, iCloud Keychain and APNs.

## 10. Desktop app (macOS/Windows)

The desktop app (Electron) wraps the hosted web app; account and content data are processed as in the web app. In addition:

- **Calendar (optional, macOS):** with your permission the app reads upcoming events locally to pause focus tasks and offer meeting notes. Events are not transmitted to our servers.
- **Automatic updates:** the app checks for and downloads new versions through GitHub Releases (GitHub, Inc., USA). For technical reasons GitHub receives your IP address and information on app version and operating system. Legal basis: legitimate interest in the security and currency of the software (Art. 6(1)(f) GDPR).
- Local settings are stored on your device.

## 11. Integrations

If you or your workspace administrator enable integrations (e.g. GitHub task sync, custom file storage, API/MCP access), the data required for them is transmitted to or retrieved from the respective service. Credentials (tokens) are stored protected on the server side and deleted when the integration is disconnected. The third party's privacy terms additionally apply.

## 12. Newsletter, waitlist, contact requests

If you sign up for the newsletter or waitlist via the app or a landing page, or write to us through a contact form, we process your email address, name where provided and your message. Newsletter sign-ups use double opt-in based on your consent (Art. 6(1)(a) GDPR); after unsubscribing we keep a minimal suppression record for 3 years. Waitlist data is kept until 6 months after release, contact requests generally until 12 months after the last correspondence. There are currently no such forms on getprojectflow.com itself.

## 13. Error reports

The web app can, where enabled, send error reports (error message, stack trace, app version, browser/device) to Functional Software GmbH / Sentry to fix crashes (Art. 6(1)(f) GDPR). Without configuration no error reports are sent.

## 14. Recipients and processors

We do not sell personal data. We use the following service providers, acting on our behalf under Art. 28 GDPR or as independent controllers:

- **Google Cloud / Firebase** (Google Ireland Limited; Google LLC, USA): hosting, authentication, database (Firestore, location eur3/EU), file storage, cloud functions (region europe-west3, Frankfurt), push (FCM), email delivery (SMTP).
- **OpenAI:** processing of AI requests (see Section 7).
- **Apple:** APNs, App Store, possibly passkey sync.
- **GitHub:** delivery of desktop updates; optional integration.
- **Sentry:** optional error reports (Section 13).
- **Payment service providers:** where paid plans are offered, payment is handled by a payment service provider that processes payment data in its own responsibility. We do not store full payment instrument data.
- **Other users** of your workspace according to the roles and permissions granted.

## 15. Transfers to third countries

Some providers (in particular Google LLC, OpenAI, Apple, GitHub) may process data in the USA. We rely on the EU-US Data Privacy Framework adequacy decision (where the provider is certified) or on the EU Commission's standard contractual clauses with supplementary measures. You can request a copy of the safeguards.

## 16. Retention

- Website server logs: about 14 days.
- Account and content data: until the account or workspace is deleted; then deleted within a reasonable period unless legal retention obligations apply. Backups are overwritten in the regular cycle.
- Push tokens: until notifications are disabled or the device signs out.
- Email delivery logs: 90 days.
- Integration tokens: until the integration is disconnected.
- Billing and tax-relevant data: according to statutory periods (generally up to 10 years).

## 17. Your rights

You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21 GDPR). You may withdraw consent at any time with effect for the future (Art. 7(3) GDPR). You also have the right to lodge a complaint with a supervisory authority (Art. 77 GDPR); the authority responsible for us is the Bavarian State Office for Data Protection Supervision (BayLDA).

To exercise your rights, write to [hello@getprojectflow.com](mailto:hello@getprojectflow.com). We generally respond within one month and may ask for proof of identity to prevent misuse. Providing data is required to use the service unless marked voluntary above.

## 18. Changes

We update this privacy policy when the service, providers or legal situation change. The version published here applies; the date of the last update is shown at the top.
