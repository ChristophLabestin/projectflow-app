import { COMPANY_EMAIL, COMPANY_NAME, COMPANY_STREET, COMPANY_ZIP, COMPANY_CITY } from "@/config/company";

export const en = {
    legal: {
        back: "Back to Home",
        titles: { impressum: "Impressum (Legal Notice)", privacy: "Privacy Policy", terms: "Terms of Service / SaaS Agreement for ProjectFlow", appPrivacy: "App Privacy Policy" },
        nav: { impressum: "Impressum", privacy: "Privacy Policy", terms: "Terms of Service", appPrivacy: "App Privacy" },
        impressum: {
            intro: "Information according to § 5 DDG",
            providerTitle: "Provider",
            country: "Germany",
            businessTitle: "Business Designation",
            businessName: "ProjectFlow (Brand / Product Name)",
            contactTitle: "Contact",
            phone: "Phone: +49 170 5853983",
            email: "Email: hello@getprojectflow.com",
            vatTitle: "VAT ID",
            vatIntro: "VAT identification number according to § 27a UStG:",
            noVat: "No VAT identification number available.",
            responsibleTitle: "Responsible for Content",
            responsibleIntro: "Responsible according to § 18 Abs. 2 MStV:",
            disputeTitle: "Dispute Resolution",
            disputeText: "We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board (§ 36 VSBG).",
            liabilityContentTitle: "Liability for Contents",
            liabilityContentText: "As a service provider, we are responsible for our own content on these pages in accordance with general laws. However, liability for the topicality, completeness and correctness of the content cannot be guaranteed permanently.",
            liabilityLinksTitle: "Liability for Links",
            liabilityLinksText: "Our offer contains links to external third-party websites, over whose content we have no influence. We therefore assume no liability for these external contents. The respective provider or operator of the pages is always responsible for the content of the linked pages.",
            copyrightTitle: "Copyright",
            copyrightText: "The content and works created by the site operators on these pages are subject to German copyright law. Duplication, processing, distribution and any kind of exploitation outside the limits of copyright law require the written consent of the respective author or creator."
        },
        privacy: {
            lastUpdated: "Last updated: 30 December 2025",
            scope: {
                title: "1. Scope",
                text: "This Privacy Policy applies to the ProjectFlow marketing website / landing page at getprojectflow.com (the \"Website\").",
                appNote: "Note: If you use the ProjectFlow web application (app.getprojectflow.com), separate privacy information will apply to in-app data processing."
            },
            controller: {
                title: "2. Controller (Data Controller)",
                text: "The controller responsible for processing personal data on this Website under the GDPR is:",
                name: `${COMPANY_NAME}`,
                street: `${COMPANY_STREET}`,
                city: `${COMPANY_ZIP} ${COMPANY_CITY}, Germany`,
                email: `Email: **${COMPANY_EMAIL}**`
            },
            categories: {
                title: "3. Categories of Personal Data We Process",
                intro: "We may collect and process the following categories of personal data:",
                accessData: {
                    title: "3.1 Website access data (server logs)",
                    text: "When you access the Website, technical data is automatically processed to deliver the site and protect it against attacks. This includes:",
                    items: [
                        "IP address (internet protocol address)",
                        "Date and time of access",
                        "Requested page/resource (URL visited)",
                        "Referrer URL (the page that linked you to our site, if any)",
                        "User agent information (browser, operating system, device)",
                        "Status/error codes (e.g. HTTP status codes)"
                    ]
                },
                consentData: {
                    title: "3.2 Consent data (cookie banner)",
                    text: "Because we use a self-developed cookie banner, we process data needed to store and document your consent choices, such as:",
                    items: [
                        "Your consent status for each category (e.g., whether you opted in to analytics)",
                        "A timestamp of when you made your choice (and a banner version identifier, if applicable)",
                        "A technical identifier to remember your choice (stored via a cookie and/or local storage in your browser)"
                    ]
                },
                ga4Data: {
                    title: "3.3 Google Analytics 4 (GA4) data (only with consent)",
                    text: "If you consent to \"Analytics\" cookies, we use Google Analytics 4 to collect usage and interaction data about how you use the Website, such as:",
                    items: [
                        "Pages you view and your navigation path",
                        "Interactions with page elements (e.g., clicks, scroll depth)",
                        "Device and browser information",
                        "Approximate location derived from your IP (which is not stored - see below)"
                    ],
                    ipNote: "**IP addresses:** Google states that GA4 does not log or store IP addresses at all; any IP address collected (for geolocation) is anonymized and dropped before being logged for EU users."
                },
                newsletterData: {
                    title: "3.4 Newsletter sign-up data",
                    text: "If you subscribe to our newsletter, we collect the information you provide for that purpose:",
                    items: [
                        "Email address (required)",
                        "First name (optional)",
                        "Last name (optional)",
                        "Gender (optional)",
                        "Form of address (salutation) (optional)"
                    ],
                    note: "(We use a double opt-in process for newsletter subscriptions. This means after signing up, you will receive an email asking you to confirm your subscription before you start receiving our newsletter.)"
                },
                waitlistData: {
                    title: "3.5 Waitlist sign-up data (pre-release)",
                    text: "If you join our waitlist (prior to the product launch), we collect:",
                    items: [
                        "Name (required)",
                        "Email address (required)"
                    ],
                    note: "(The waitlist is temporary and used only to notify you when the product launches. After the launch, waitlist data will be handled as described in the Retention section below.)"
                },
                contactData: {
                    title: "3.6 Contact form inquiries",
                    text: "If you send us a message via our contact form, we collect the information you provide:",
                    items: [
                        "Name (required)",
                        "Email address (required)",
                        "Message content (the content of your inquiry or request)"
                    ],
                    note: "We use this information solely to respond to and manage your inquiry."
                }
            },
            legalBases: {
                title: "4. Purposes and Legal Bases for Processing",
                intro: "We process your personal data for the following purposes, and rely on the corresponding legal bases under the EU General Data Protection Regulation (GDPR):",
                operation: {
                    title: "4.1 Website operation, stability, and security",
                    purpose: "**Purpose:** To deliver the Website to you, maintain its stability and performance, prevent abuse, and detect or fix technical issues.",
                    basis: "**Legal basis:** GDPR Art. 6(1)(f) - our legitimate interests in operating a secure and functional website."
                },
                cookies: {
                    title: "4.2 Cookie consent management",
                    purpose: "**Purpose:** To store and document your cookie/analytics preferences and to enable you to change or withdraw consent.",
                    basis: "**Legal basis:** GDPR Art. 6(1)(c) - compliance with legal obligations (where applicable), and Art. 6(1)(f) - our legitimate interest in compliance and record-keeping.",
                    note: "Note: Storing or accessing non-essential information on your device (such as analytics cookies) also requires consent under German law (Section 25(1) TTDSG)."
                },
                ga4: {
                    title: "4.3 Google Analytics (website analytics)",
                    purpose: "**Purpose:** To measure reach and user behavior on our Website, in order to understand usage patterns and improve our content and services.",
                    basis: "**Legal basis:** GDPR Art. 6(1)(a) - your consent (we only collect analytics data if you have opted in). We also obtain consent under Section 25(1) TTDSG for the use of analytics cookies/identifiers on your device."
                },
                newsletter: {
                    title: "4.4 Newsletter emails",
                    purpose: "**Purpose:** To send you product updates and information that you have requested by subscribing to our newsletter.",
                    basis: "**Legal basis:** GDPR Art. 6(1)(a) - your consent.",
                    note: "You will only receive the newsletter if you have voluntarily opted in, and you can withdraw your consent at any time by unsubscribing."
                },
                waitlist: {
                    title: "4.5 Waitlist notifications",
                    purpose: "**Purpose:** To inform you about our product launch and onboarding when the product is released.",
                    basis: "**Legal basis:** GDPR Art. 6(1)(a) - your consent."
                },
                contact: {
                    title: "4.6 Contact form inquiries",
                    purpose: "**Purpose:** To communicate with you and address the inquiry or request you submitted through the contact form.",
                    basis: "**Legal basis:** GDPR Art. 6(1)(f) - our legitimate interest in responding to customer inquiries and maintaining good customer relations. If your inquiry is related to entering into a contract or pre-sales information about our services, the processing of your data for that purpose may also be regarded as a pre-contractual step (GDPR Art. 6(1)(b))."
                }
            },
            cookies: {
                title: "5. Cookies and Local Storage",
                intro: "We use cookies and similar local storage technologies on the Website as follows:",
                essential: {
                    title: "5.1 Essential cookies/technologies",
                    text: "These are cookies or local storage items that are necessary for the Website's core functionality and security. For example, we use essential cookies/storage to:",
                    items: [
                        "Remember your cookie consent preferences",
                        "Provide basic site features and security measures"
                    ],
                    note: "Such essential technologies are used without asking for consent where this is allowed by law (under Section 25(2) TTDSG in Germany), and the processing of related data is based on our legitimate interests (GDPR Art. 6(1)(f)) in operating a secure, user-friendly site."
                },
                analytics: {
                    title: "5.2 Analytics cookies (GA4)",
                    text: "We will only use Google Analytics cookies if you have explicitly opted in. These cookies (and related tracking) remain inactive until you give consent via the cookie banner. If you decline or ignore the banner, no GA4 analytics data will be collected from your device. In other words, Google Analytics 4 is only activated after you opt in."
                },
                withdraw: {
                    title: "5.3 Changing or withdrawing consent",
                    text: "You can change your cookie preferences or withdraw your consent at any time with effect for the future.",
                    link: "Use the **Cookie Settings** link on our Website (for example, in the footer). Once you adjust your preferences, our site will honor your new settings and stop any non-essential processing if you withdraw consent."
                }
            },
            ga4Details: {
                title: "6. Google Analytics 4 (GA4) Details",
                intro: "This section provides additional information about our use of Google Analytics 4 for those who consent to analytics:",
                provider: {
                    title: "6.1 Provider information",
                    text: "Google Analytics is provided in Europe by:",
                    address: "**Google Ireland Limited**, Gordon House, Barrow Street, Dublin 4, Ireland (a subsidiary of Google LLC, based in the United States)."
                },
                config: {
                    title: "6.2 Configuration and privacy measures",
                    text: "We have configured GA4 with privacy-enhancing settings (standard configuration with IP anonymization). In particular:",
                    items: [
                        "Google Signals: **Disabled** (we do not enable Google Signals, so we do not combine analytics data with your Google account)",
                        "Ads personalization: **Disabled** (we do not use GA4 for advertising or cross-site ad tracking)",
                        "Granular location/device data collection: **Enabled** (this allows GA4 to use generalized location and device data controls to protect privacy)"
                    ]
                },
                retention: {
                    title: "6.3 Data retention in Google Analytics",
                    text: "We have set Google Analytics 4 to retain user-level data (associated with cookies and user identifiers) for a maximum of **2 months**. Older analytics data is automatically deleted on a rolling basis. We chose this minimal retention to reduce how long identifiable analytics information persists."
                }
            },
            email: {
                title: "7. Email Delivery (Newsletter and Waitlist)",
                text: "Our newsletter and waitlist confirmation emails are currently sent using a custom-built service that relies on Google's SMTP servers (i.e., we use Google's email infrastructure to send these emails). This means your email address and the content of the email may be processed by Google as it transits to your inbox. We do not use an external email marketing platform at this time; the emails are sent directly from our system via Google.",
                note: "Note: We plan to migrate to a self-hosted email service in the future. We will update this Privacy Policy to reflect any change in our email service provider once that happens."
            },
            recipients: {
                title: "8. Recipients and Data Processors",
                text: "We do not sell your personal data to third parties. However, we use certain trusted external service providers to help us operate our Website and services. Depending on which features you use, your personal data may be shared with or processed by the following categories of recipients:",
                items: [
                    "**Google (Analytics):** If you consent to analytics, data about your Website usage (see Section 3.3 above) will be collected by Google via Google Analytics 4. Google Ireland Limited (based in the EU) provides this service, but data may also be processed by Google LLC in the USA. Google acts as our data processor for analytics purposes.",
                    "**Google (Hosting & email services):** We use Google's services to host our Website and handle certain data. The site and its backend (including databases for contact form submissions or newsletter/waitlist lists) are hosted on Google Firebase / Google Cloud servers (which may reside in the EU or in the USA). Additionally, we use Google's email servers to route newsletter and waitlist emails. In these roles, Google is a data processor handling data on our behalf.",
                    "**Social media platforms:** Our Website may include links to our pages on external social networks (for example, LinkedIn or Twitter). If you choose to click on those links, you will be redirected to the respective third-party platform. We do not share any personal data with these platforms through our Website. However, once you leave our site and visit a social media page, the privacy policy of that platform applies."
                ],
                note: "All these service providers act on our behalf and are bound by contracts to process personal data only under our instructions and in compliance with the GDPR (including Art. 28 DPAs where applicable)."
            },
            transfers: {
                title: "9. International Data Transfers",
                text: "Some of our service providers may process data outside of the European Economic Area (EEA), particularly in the United States. When we transfer personal data out of the EEA, we ensure appropriate safeguards are in place, such as reliance on adequacy mechanisms like the EU-US Data Privacy Framework or the European Commission's Standard Contractual Clauses (SCCs) with supplementary measures as needed. If you have questions or want a copy of the relevant safeguards, you can contact us for more information."
            },
            retention: {
                title: "10. Data Retention (How Long We Keep Data)",
                intro: "We keep your personal data only for as long as necessary to fulfill the purposes outlined in this Policy, or as required by law. Specific retention periods for different categories of data are as follows:",
                logs: {
                    title: "10.1 Server logs",
                    text: "Server log data (including IP addresses captured in logs) are retained for approximately **14 days**, after which they are automatically deleted. We may retain logs longer only if needed to investigate security incidents or misuse."
                },
                consent: {
                    title: "10.2 Cookie consent records",
                    text: "Records of your cookie consent are stored for **3 years** from the date of your last consent action to demonstrate compliance."
                },
                ga4: {
                    title: "10.3 Google Analytics data",
                    text: "Analytics data collected via GA4 is retained by Google for up to **2 months** (per our configuration) and is automatically deleted on a rolling basis. Aggregate reports (which do not contain personally identifiable data) may be kept longer for analysis."
                },
                newsletter: {
                    title: "10.4 Newsletter subscription data",
                    items: [
                        "We retain your email address (and any optional profile information) for as long as you remain subscribed to the newsletter.",
                        "After you unsubscribe, we keep a minimal record of your email and the fact that you unsubscribed on a suppression list for **3 years** to respect your opt-out and demonstrate compliance."
                    ],
                    note: "Optional data (such as first name, last name, gender, or salutation) is deleted or anonymized when you unsubscribe unless required for a legal reason."
                },
                waitlist: {
                    title: "10.5 Waitlist data",
                    text: "Waitlist information (name and email) is retained until the official product release and for up to **6 months** thereafter. If you separately subscribed to the newsletter, the newsletter retention period applies to that data."
                },
                emailLogs: {
                    title: "10.6 Email delivery logs",
                    text: "Basic logs of email deliveries (timestamp, recipient, status) are kept for **90 days** to troubleshoot delivery issues and prevent abuse. These logs typically do not include email content beyond transient processing."
                },
                contact: {
                    title: "10.7 Contact form submissions",
                    text: "Messages and data you send via the contact form are stored as long as needed to respond and resolve your inquiry. We aim to delete contact form submissions within **12 months** after our last correspondence, unless retention is needed for legal reasons (e.g., disputes or legal claims)."
                }
            },
            rights: {
                title: "11. Your Rights Under GDPR",
                text: "Under the GDPR, you have the following rights regarding your personal data:",
                items: [
                    "Right of Access (Art. 15 GDPR): obtain confirmation and a copy of your data, plus information on use, recipients, retention, and safeguards.",
                    "Right to Rectification (Art. 16 GDPR): correct incomplete or inaccurate personal data without undue delay.",
                    "Right to Erasure (Art. 17 GDPR): request deletion when the data is no longer necessary, consent is withdrawn, or there is no overriding legal basis (subject to exceptions).",
                    "Right to Restrict Processing (Art. 18 GDPR): request that we limit processing in certain circumstances.",
                    "Right to Data Portability (Art. 20 GDPR): receive your data in a structured, commonly used, machine-readable format and request transfer where feasible.",
                    "Right to Object (Art. 21 GDPR): object to processing based on legitimate interests; we must stop unless we demonstrate compelling grounds or need the data for legal claims. You can always object to direct marketing.",
                    "Right to Withdraw Consent (Art. 7(3) GDPR): withdraw consent at any time without affecting the lawfulness of prior processing.",
                    "Right to Lodge a Complaint (Art. 77 GDPR): file a complaint with a supervisory authority in your EU Member State."
                ],
                contact: "Exercising your rights: You can exercise any of your rights by contacting us at **hello@getprojectflow.com**. We may need to verify your identity to ensure we do not disclose data to the wrong person. We will respond as soon as possible and no later than the timeframes set by law (generally one month, extendable by two further months if necessary). There is no fee unless a request is manifestly unfounded or excessive, in which case we may charge a reasonable fee or refuse the request."
            },
            updates: {
                title: "12. Updates to this Privacy Policy",
                text: "We may revise or update this Privacy Policy from time to time to reflect changes in our operations, the Website, or applicable law. When we make changes, we will update the \"Last updated\" date at the top of this Policy, and if changes are significant we may provide more prominent notice. This Privacy Policy is effective as of the date noted above. Your continued use of the Website after updates take effect will be taken as acceptance of the revised Policy to the extent permitted by law. If you do not agree to the changes, you should stop using the Website and withdraw consent for any features as described above. If you have any questions or concerns, contact us at hello@getprojectflow.com."
            }
        },
        terms: {
            summary: {
                title: "Plain-English Summary (Non-Binding)",
                text: `This summary is provided for convenience and does not form part of the legal agreement. ProjectFlow is an online project management software service offered to businesses (not consumers) on a subscription basis. By signing up, a company (Customer) agrees to these terms. B2B Only: The service is for business use by companies; consumer use is not allowed. Customers pay recurring fees (monthly or annually) for access to different plans (e.g., Starter, Professional, Organization). The service includes features like workspaces, projects, tasks, file sharing, and optional AI-powered tools to help manage projects. We keep Customer data confidential and secure, and we act as a data processor for any personal data you upload, following GDPR. Customers own their data and we won't use it except to provide the service (plus any analytics as described). We maintain ~99.5% uptime and aim to respond to support requests within 24 hours. We may update the service over time, and we'll inform you of important changes to features or terms. Both parties have rights to end the subscription: you can cancel per the agreed term and we can terminate for specific serious reasons. There's no refund on fees already paid (unless the law requires it or we decide otherwise case-by-case). Our liability is limited - we're responsible for intent and gross negligence, but we cap other liabilities to a reasonable amount. There's an Acceptable Use Policy to prevent misuse (no illegal content, no hacking, etc.) and a Data Processing Addendum for GDPR compliance. German law governs these terms, and any disputes will be handled in German courts at our company's location (with any mandatory laws still applying as needed). Please read the full terms below for all details.`
            },
            sections: [
                {
                    title: "1. Introduction, Parties, and B2B-Only Scope",
                    blocks: [
                        {
                            type: "p",
                            text: `**1.1 Parties.** This Software-as-a-Service Terms of Service ("Agreement") is entered into between ${COMPANY_NAME}, having its registered office at ${COMPANY_STREET}, ${COMPANY_ZIP} ${COMPANY_CITY}, Germany, ("Provider", "we" or "us") and the subscribing business entity ("Customer" or "you"). This Agreement governs Customer's access to and use of the ProjectFlow online software service ("Service"). Effective Date: This Agreement is effective as of [Effective Date] (the "Effective Date").`
                        },
                        {
                            type: "p",
                            text: `**1.2 B2B Only - No Consumers.** This Agreement is only for business-to-business transactions. Customer represents and warrants that it is not a consumer (Verbraucher) but rather a business or entrepreneur (Unternehmer) as defined in § 14 BGB (German Civil Code) or similar applicable law. By entering this Agreement, the individual accepting on behalf of Customer confirms they have authority to bind the Customer company. No Consumer Rights: Consumer protection laws (such as any rights of cancellation or withdrawal under EU consumer directives) do not apply to this Agreement. If a person who is a consumer (not a business) mistakenly enters into this Agreement or signs up for the Service, the Provider reserves the right to terminate the account and issue a refund for any fees paid, at Provider's discretion.`
                        },
                        {
                            type: "p",
                            text: `**1.3 Incorporation by Reference.** Additional documents form part of this Agreement:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) any Order Form or online signup form executed by Customer which references this Agreement,`,
                                `(b) the Data Processing Addendum ("DPA" or "AVV") attached or linked as Appendix C (applicable if Customer provides personal data for processing),`,
                                `(c) the Acceptable Use Policy in Appendix A, and`,
                                `(d) if applicable, any Service Level Agreement (SLA) or Support Policy in Appendix B.`
                            ]
                        },
                        {
                            type: "p",
                            text: `In case of conflict, an Order Form or individually negotiated contract terms prevail over this Agreement, and the DPA prevails over this Agreement with respect to data protection matters. This Agreement and all its Appendices constitute the entire agreement between Provider and Customer regarding the Service, and supersede any prior agreements or communications. Customer's purchase order or other terms are not binding and are hereby rejected unless expressly agreed in writing by Provider.`
                        }
                    ]
                },
                {
                    title: "2. Definitions",
                    blocks: [
                        {
                            type: "p",
                            text: `**2.1 "Service"** means the Provider's project management software-as-a-service product "ProjectFlow", including its web application, APIs, mobile apps or other software provided by Provider, and any related documentation, tools, or websites operated by Provider for use with the service.`
                        },
                        {
                            type: "p",
                            text: `**2.2 "Customer Data"** means all data, information, files, and content that Customer or its Authorized Users (defined below) upload, submit, or transmit into the Service, including text, images, files, attachments, tasks, comments, project information, and personal data relating to Customer's personnel or end-users.`
                        },
                        {
                            type: "p",
                            text: `**2.3 "Authorized Users"** means individuals who are authorized by Customer to use the Service under Customer's account, such as Customer's employees, contractors, or other personnel. Authorized Users may also include Customer's Affiliates (defined below) or clients if permitted by Customer's subscription.`
                        },
                        {
                            type: "p",
                            text: `**2.4 "Affiliate"** means any entity that directly or indirectly controls, is controlled by, or is under common control with a party, where "control" means ownership of more than 50% of equity or voting interests.`
                        },
                        {
                            type: "p",
                            text: `**2.5 "Order Form"** means any ordering document, online sign-up page, or subscription confirmation that references this Agreement and sets out the specific subscription plan, term, and pricing for the Service chosen by Customer.`
                        },
                        {
                            type: "p",
                            text: `**2.6 "Subscription Plan"** means the specific package of features and usage limits for the Service to which Customer subscribes (e.g., the Starter, Professional, Organization plans), as detailed on the Provider's website or Order Form, and which determines the applicable Fees.`
                        },
                        {
                            type: "p",
                            text: `**2.7 "Fees"** means the subscription charges and any other fees payable by Customer for access to the Service under the chosen Subscription Plan, as set forth in the Order Form or Provider's pricing page, excluding any taxes.`
                        },
                        {
                            type: "p",
                            text: `**2.8 "Acceptable Use Policy"** or "AUP" means the Provider's rules for acceptable use of the Service, as set forth in Appendix A, which prohibit certain conduct and content in connection with the Service.`
                        },
                        {
                            type: "p",
                            text: `**2.9 "Data Processing Addendum"** or "DPA" (in German: Auftragsverarbeitungsvereinbarung or "AVV") means the supplemental contract between Customer (as controller) and Provider (as processor) governing the processing of personal data within the Service, in compliance with Article 28 GDPR, attached as Appendix C.`
                        },
                        {
                            type: "p",
                            text: `**2.10 "Confidential Information"** has the meaning set forth in section 13 (Confidentiality).`
                        },
                        {
                            type: "p",
                            text: `**2.11 "Intellectual Property Rights"** means all forms of intellectual property rights and proprietary rights recognized anywhere in the world, including copyrights, database rights, patents, trade secrets, know-how, and trademarks.`
                        },
                        {
                            type: "p",
                            text: `**2.12** Other capitalized terms may be defined elsewhere in this Agreement (for example, in the context where they are first used). All references to statutory provisions are to those provisions as amended or re-enacted.`
                        }
                    ]
                },
                {
                    title: "3. Formation of Contract; Accounts; Free Trial",
                    blocks: [
                        {
                            type: "p",
                            text: `**3.1 Account Registration and Acceptance.** To use the Service, Customer must register for an account by providing accurate business information and accepting this Agreement (e.g., by clicking "I Agree" or signing an Order Form). By completing the signup or order process, Customer makes an offer to enter into this Agreement on the terms presented, which is accepted by Provider either (a) by explicit confirmation (e.g., sending a welcome email or counter-signing an Order Form), or (b) by provisioning the Service for use by Customer. At that point, a binding contract is formed between Provider and Customer consisting of this Agreement and any applicable Order Form.`
                        },
                        {
                            type: "p",
                            text: `**3.2 Affiliate Participation.** Customer's Affiliates may access and use the Service under Customer's account, provided that (a) Customer ensures each Affiliate or user complies with this Agreement, and (b) Customer remains responsible for any actions of its Affiliates and Authorized Users. Alternatively, an Affiliate of Customer may enter its own Order Form under this Agreement and in such case is deemed a separate Customer.`
                        },
                        {
                            type: "p",
                            text: `**3.3 Free Trial.** If Customer registers for a free trial of the Service, the trial will be for a period of 14 days (unless extended or terminated earlier by Provider in its discretion). During the trial, the Service is provided "AS IS" with no warranty or SLA, and may be subject to limited support. Either party may terminate a trial at any time. At the end of the trial, Customer must purchase a paid Subscription Plan to continue using the Service, otherwise Customer's account may be deactivated or downgraded. Any Customer Data entered during the trial period may be permanently lost unless Customer converts to a paid plan before the trial ends. Provider is not liable for any such loss of data from trial accounts.`
                        },
                        {
                            type: "p",
                            text: `**3.4 Updates and Beta Features.** Customer acknowledges that the Service may continually evolve. Provider may make updates, upgrades, additions or modifications to the Service (including by adding or removing features) from time to time, provided that such changes do not materially reduce the core functionality of the Service as purchased by Customer. Provider might also offer access to beta or experimental features or separate modules ("Beta Features") for trial. Beta Features are provided on an optional basis, "as is" and without any warranty or commitment, and may be withdrawn or modified at any time. Use of Beta Features is at Customer's discretion and risk, and Customer will provide feedback on them if reasonably requested.`
                        },
                        {
                            type: "p",
                            text: `**3.5 Third-Party Services and Components.** The Service may include integrations or compatibility with third-party services (such as integrations with other software via APIs) or incorporate third-party software components (including open-source libraries). Customer's use of third-party services or software may be subject to separate third-party terms, which Customer is responsible for reviewing and complying with. Provider is not responsible for the operation or security of third-party services not provided by Provider, and does not guarantee that any integrations will continue to be available. Provider may update or replace third-party components in the Service from time to time.`
                        }
                    ]
                },
                {
                    title: "4. Service Description and Use Rights",
                    blocks: [
                        {
                            type: "p",
                            text: `**4.1 Provision of Service.** Provider will provide Customer with access to the Service identified in the Order Form for the subscription term, subject to Customer's payment of Fees and compliance with this Agreement. The Service is provided as an online, web-based software solution (with optional mobile or desktop components where offered) accessible via the internet. Subject to the terms of this Agreement, Provider grants Customer a non-exclusive, non-transferable, worldwide right during the subscription term to allow its Authorized Users to access and use the Service solely for Customer's internal business operations, in accordance with the agreed Subscription Plan's limits and the documentation.`
                        },
                        {
                            type: "p",
                            text: `**4.2 Features and Functionality.** ProjectFlow provides project management and collaboration features including, but not limited to, creating and managing workspaces and projects, assigning tasks to users, adding comments and attachments to tasks, tracking progress on dashboards, and generating reports or analytics. Customer and its Authorized Users may upload and store project-related data and files in the Service, invite team members, and integrate with supported third-party applications to enhance workflow. Details of current features and modules are described on our website https://getprojectflow.com or in the Service documentation.`
                        },
                        {
                            type: "p",
                            text: `**4.3 Optional AI Features.** The Service may offer optional artificial intelligence-powered features ("AI Features") such as intelligent task suggestions, automated data entry or analysis, content generation (e.g., summarizing or writing drafts of task descriptions or comments), or other predictive functionalities. The AI Features, if enabled by Customer, will involve the processing of Customer-provided prompts or data through machine learning algorithms, which may be provided by third-party AI platforms. Customer acknowledges that AI is an evolving technology: no guarantee of accuracy is given for outputs from AI Features, and such outputs may occasionally be incorrect or misleading. **Customer's Responsibilities for AI Use:** Customer is responsible for verifying the accuracy of any AI-generated content and for using it in compliance with the law. Customer must not input any information into the AI Features that is highly sensitive (such as personal data revealing health, racial or ethnic origin, political opinions, etc., or any data regulated under special laws) unless Provider has expressly agreed in writing to handle such data. Provider will not use Customer's inputs into AI Features to train or improve any generalized AI models for the benefit of other customers; any use of such data is solely to provide the Service to Customer. Provider may from time to time improve the AI Features using machine learning; if these improvements rely on analyzing Customer Data, Provider will do so only in compliance with the DPA and in an anonymized or aggregate manner where feasible. Additional or specific terms for AI Features (if any) will be provided in the documentation or on the Service interface.`
                        },
                        {
                            type: "p",
                            text: `**4.4 Technical Requirements.** Use of the Service requires a compatible device, Internet access, and certain supported software (e.g., a modern web browser). Customer is responsible for procuring and maintaining all hardware, software, and connectivity needed to access the Service. Provider is not responsible for any inability to access or use the Service caused by Customer's or its users' equipment, networks, or systems, or by any internet or hosting outages not within Provider's control.`
                        },
                        {
                            type: "p",
                            text: `**4.5 User Accounts and Credentials.** Customer will manage the creation of user accounts for its Authorized Users. Each Authorized User must have unique login credentials. Customer shall ensure that all Authorized Users keep their account credentials (username, passwords, API keys, etc.) confidential and not share them with any unauthorized person. Customer is responsible for any actions taken under its user accounts (except to the extent caused by Provider's breach of this Agreement or a security incident on Provider's side). Customer shall promptly notify Provider if it becomes aware of any loss, theft or unauthorized use of any account passwords or tokens or any actual or suspected breach of security involving the Service.`
                        }
                    ]
                },
                {
                    title: "5. Customer Responsibilities",
                    blocks: [
                        {
                            type: "p",
                            text: `**5.1 Use for Lawful Business Purposes.** Customer shall use the Service only for legitimate business purposes and in compliance with all applicable laws and regulations. Customer is solely responsible for the content and legality of all Customer Data processed through the Service. Customer must not use the Service in a way that would violate any laws, including (without limitation) laws relating to data privacy, intellectual property, export control, or anti-spam.`
                        },
                        {
                            type: "p",
                            text: `**5.2 Compliance and Cooperation.** Customer is responsible for ensuring that its Authorized Users and anyone else it allows to access the Service (e.g., affiliates or contractors) comply with the terms of this Agreement and the Acceptable Use Policy. Customer will promptly notify Provider of any known or suspected violation of the Acceptable Use Policy or unauthorized use of the Service and cooperate with Provider's reasonable investigation of service outages, security issues, or any suspected breach of this Agreement.`
                        },
                        {
                            type: "p",
                            text: `**5.3 Customer Systems.** Customer is responsible for the integrity and configuration of its own IT systems that it uses to connect to the Service, including using up-to-date and appropriate virus protection and security measures to prevent unauthorized access to the Service via Customer's systems.`
                        },
                        {
                            type: "p",
                            text: `**5.4 No Sensitive or Regulated Data (Unless Agreed).** The Service is a general-purpose project management tool and is not specifically designed to meet legal obligations for handling certain types of sensitive data (for example, personal health information, credit card data, or other regulated data). Unless otherwise agreed in writing, Customer should not use the Service to store any sensitive personal data such as health or medical information, payment card information (except for payment processed via our Payment Processor for subscription fees), or any data subject to special governmental security regulations. If Customer chooses to upload any such data without an agreement, Customer assumes all associated risk.`
                        },
                        {
                            type: "p",
                            text: `**5.5 Backup Responsibilities.** While Provider maintains routine backups of system data for disaster recovery purposes, Customer is responsible for maintaining its own backups or copies of Customer Data as needed. Except as expressly provided in this Agreement or an SLA, Provider does not guarantee that Customer Data will never be lost or corrupted. Provider strongly encourages Customer to export or download important data periodically and especially before termination of the Service.`
                        }
                    ]
                },
                {
                    title: "6. Acceptable Use Policy",
                    blocks: [
                        {
                            type: "p",
                            text: `Customer agrees to abide by Provider's Acceptable Use Policy ("AUP"), which is incorporated into this Agreement as Appendix A. The AUP includes, among other things, the following core restrictions and rules:`
                        },
                        {
                            type: "ul",
                            items: [
                                `**No Illegal or Harmful Content:** Customer shall not upload, store, or share any Customer Data via the Service that is illegal, defamatory, obscene, pornographic, harassing, threatening, or that infringes any third-party rights (including intellectual property and privacy rights). This includes content that would violate any criminal laws or regulations, or content promoting violence, discrimination, or unlawful activities.`,
                                `**No Unauthorized Access or Security Violations:** Customer shall not (and shall not allow anyone under its control to) interfere with or disrupt the Service or the servers and networks used to provide the Service. Prohibited activities include attempting to gain unauthorized access to the Service or other accounts, probing, scanning or testing the vulnerability of any system or network (except as permitted under a Provider-approved security testing program), or breaching security or authentication measures.`,
                                `**No Misuse or Abuse of the Service:** Customer shall not use the Service to distribute malware, viruses, or any other harmful code. Customer shall not use the Service for spamming, phishing, or other unsolicited communications or for any fraudulent or misleading activities.`,
                                `**No Reverse Engineering or Copying:** Except as allowed by applicable law, Customer must not reverse engineer, decompile, or disassemble the Service or any software provided as part of the Service. Customer must not attempt to extract the source code or create derivative works based on the Service. Also, scraping of the Service or its content (other than Customer's own Customer Data) is prohibited.`,
                                `**No Resale or Unauthorized Sharing:** Customer may not rent, lease, sell, sub-license, or resell access to the Service to any third party, nor use the Service on behalf of or for the benefit of any third party not authorized by Provider, such as operating a service bureau. Use of the Service by Customer's Affiliates or clients is only permitted as expressly allowed under this Agreement or the Subscription Plan.`,
                                `**No Competing Service Use:** Customer shall not use the Service to build or enhance a competing product or service, and shall not use the Service or any Confidential Information of Provider to benchmark or publicly compare the performance, features, or security of the Service with another product, without Provider's prior written consent.`,
                                `**Fair Use and API Limits:** Customer will use any APIs or automated systems in accordance with the provided documentation and any rate limits. Excessive usage that threatens the stability of the Service is not permitted. Provider reserves the right to throttle or suspend API access in case of abuse to protect the Service's integrity.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Provider may suspend or terminate the Service (consistent with Section 8 or 9) if Customer violates the AUP. Provider may also remove or disable access to any content that violates the AUP or this Agreement. Appendix A provides further details and examples of prohibited uses.`
                        }
                    ]
                },
                {
                    title: "7. Fees, Payment and Taxes",
                    blocks: [
                        {
                            type: "p",
                            text: `**7.1 Subscription Fees.** Customer shall pay the Fees for the Service as specified in the Order Form or as per the Subscription Plan selected. Subscription Fees are typically charged on a recurring basis (e.g., monthly or annual billing cycles, depending on Customer's selection). Unless otherwise stated, fees are quoted and payable in the currency specified on the Order Form or website and are exclusive of any applicable taxes.`
                        },
                        {
                            type: "p",
                            text: `**7.2 Billing and Payment.** Customer must provide a valid payment method or purchase order information as required by Provider or its third-party payment processor (e.g., Stripe, "Payment Processor"). For credit card or online payments, Customer authorizes Provider (or the Payment Processor) to charge the Subscription Fees to the provided payment method on the schedule indicated (e.g., monthly in advance for monthly plans, or annually in advance for annual plans). If invoicing is agreed, payments are due within 30 days of invoice date unless otherwise specified.`
                        },
                        {
                            type: "p",
                            text: `**7.3 Late Payment.** If any payment is not received by the due date, Provider may (at its option and without limiting its other rights) charge interest on overdue amounts at the rate of 9 percentage points above the base interest rate (Basiszinssatz) per annum (or the highest rate allowed by law, if lower), calculated from the due date until payment. Additionally, if Customer's account is overdue by more than 30 days, Provider reserves the right to suspend access to the Service upon prior written notice (email sufficient) until all overdue amounts are paid in full.`
                        },
                        {
                            type: "p",
                            text: `**7.4 Taxes.** All Fees are exclusive of taxes, levies, or duties imposed by taxing authorities. Customer is responsible for any value-added tax (VAT), goods and services tax (GST), sales tax, or similar taxes that apply to its purchases. If Customer is required by law to withhold any taxes from its payment, it shall gross up the payment so that Provider receives the full amount owed as if no withholding were required. In cases of reverse charge (e.g., intra-EU B2B services), Provider will not charge VAT if Customer provides a valid VAT ID and confirms it is registered for VAT in its country.`
                        },
                        {
                            type: "p",
                            text: `**7.5 Price Changes.** Provider may modify the Fees or introduce new charges for the Service upon at least 30 days' prior notice to Customer (which may be sent by email or posted on our website or within the Service). Fee changes will take effect at the start of the next subscription term or renewal. If Customer does not agree to the new fees, Customer may elect not to renew the subscription as described in Section 8.1. Continued use of the Service into a new term or after a fee change takes effect constitutes acceptance of the new fees.`
                        },
                        {
                            type: "p",
                            text: `**7.6 Upgrades and Downgrades.** Customer may upgrade its Subscription Plan at any time (e.g., to add more users or features). If an upgrade occurs mid-term, any incremental Fees for the remainder of the current billing period will be pro-rated and charged at the time of upgrade, and the new higher rate will apply for subsequent periods. If Customer downgrades its Subscription Plan, the change will generally take effect only from the next billing cycle (no partial refunds for downgrades mid-term), unless otherwise agreed by Provider. Downgrading may cause loss of features or capacity - Provider shall not be liable for any such impact as long as Customer was informed of it when electing to downgrade.`
                        },
                        {
                            type: "p",
                            text: `**7.7 No Refunds.** Except as expressly provided in this Agreement or required by applicable law, all payments are non-refundable. This applies, without limitation, to cases of partial use of a service period, or unused accounts, or subscription cancellations prior to the end of a prepaid term. Provider may choose to provide pro-rata refunds or credits in extenuating circumstances (e.g., if Provider terminates the Service for convenience under Section 8.3), but is not obligated to do so unless required by law.`
                        }
                    ]
                },
                {
                    title: "8. Term and Termination",
                    blocks: [
                        {
                            type: "p",
                            text: `**8.1 Subscription Term and Renewal.** The initial subscription term for the Service will be as specified in the Order Form (e.g., month-to-month or a one-year term). Unless otherwise specified, subscriptions will automatically renew for successive terms of equal length (e.g., another month or another year) unless either party gives notice of non-renewal at least 30 days (for annual plans) or 5 days (for monthly plans) before the end of the current term. Customer can provide non-renewal notice by using the account settings in the Service or contacting Provider support, or through any other method indicated by Provider. Provider will remind Customer of upcoming auto-renewal for annual subscriptions in advance as required by law.`
                        },
                        {
                            type: "p",
                            text: `**8.2 Termination by Customer (for Convenience).** Customer may terminate this Agreement for convenience by opting not to renew as described above, or by cancelling their subscription through the Service interface or by written notice to Provider at any time, to be effective at the end of the then-current subscription term. Unless otherwise agreed, Customer's termination will not entitle it to any refund of prepaid fees, and Customer will retain access to the Service until the end of the paid term.`
                        },
                        {
                            type: "p",
                            text: `**8.3 Termination or Suspension by Provider.**`
                        },
                        {
                            type: "p",
                            text: `**For Cause:** Provider may terminate this Agreement or suspend Customer's access to the Service, with immediate effect upon notice to Customer, if: (a) Customer fails to pay any overdue Fees within 14 days after written notice from Provider; (b) Customer materially breaches any provision of this Agreement (including the Acceptable Use Policy or any license restrictions) and the breach is not cured (if capable of cure) within 14 days of Provider's notice; or (c) Customer suffers an insolvency or bankruptcy event or any analogous event in any jurisdiction (e.g., ceases business, enters liquidation, or has a receiver appointed).`
                        },
                        {
                            type: "p",
                            text: `**Emergency Suspension:** Notwithstanding the foregoing, Provider may suspend access to the Service with minimal notice if reasonably needed to prevent significant harm to the Service, Provider, other customers, or to comply with law (for example, suspending an account that is under an active cyberattack or is transmitting unlawful content). In such cases, Provider will inform Customer as soon as practicable and work with Customer in good faith to resolve the issues and restore access promptly.`
                        },
                        {
                            type: "p",
                            text: `**Convenience:** Additionally, Provider may terminate this Agreement for convenience (and discontinue providing the Service to Customer) by providing at least 60 days' written notice to Customer, in which case Provider will refund any prepaid Fees covering the remainder of the subscription term after the termination effective date.`
                        },
                        {
                            type: "p",
                            text: `**8.4 Effect of Termination.** Upon termination or expiration of this Agreement: (a) Customer's rights to access and use the Service will immediately cease (or in case of non-renewal, will cease at the end of the current term), and Provider may disable Customer's accounts; (b) Customer shall promptly pay any outstanding Fees for Service provided up to the termination date (and, if termination was by Provider for cause or by Customer without cause, any unpaid Fees for the remainder of a committed term become immediately due, except where prohibited by law); and (c) each party shall return or destroy the other party's Confidential Information in its possession, as described in Section 13.`
                        },
                        {
                            type: "p",
                            text: `**8.5 Data Export and Deletion.** Following termination, Customer will have 30 days to export or download its Customer Data from the Service, unless the account was terminated for Customer's breach in which case this post-termination access may be curtailed at Provider's discretion (provided that, upon request, Provider will still reasonably cooperate to provide Customer Data back to Customer). After such 30-day period, Provider may delete all Customer Data in its systems related to Customer's account, subject to any retention required by law or permitted for Provider's internal backup purposes. Upon Customer's written request made at or before termination, Provider can provide a final export of Customer Data in a standard format for an additional reasonable fee (unless such export is already available self-service).`
                        },
                        {
                            type: "p",
                            text: `**8.6 Survival.** Any provisions of this Agreement that by their nature should survive termination (such as accrued payment obligations, confidentiality, disclaimers, limitations of liability, and dispute resolution terms) shall survive expiration or termination of this Agreement.`
                        }
                    ]
                },
                {
                    title: "9. Support and Maintenance",
                    blocks: [
                        {
                            type: "p",
                            text: `**9.1 Standard Support.** Provider will provide Customer with standard support for the Service at no additional charge (unless a higher support tier is offered and purchased). Standard support includes access to help documentation on the Provider's website and the ability to contact Provider's support team via email at hello@getprojectflow.com or through the support portal. Support is provided during Provider's normal business hours (Monday-Friday, 9:00-17:00 Central European Time (CET), excluding German public holidays), and Provider will use commercially reasonable efforts to respond to support inquiries within one business day (24 hours).`
                        },
                        {
                            type: "p",
                            text: `**9.2 Service Maintenance and Availability.** Provider will use reasonable efforts to maintain the availability of the Service 24 hours a day, 7 days a week, with a target uptime of at least 99.5% per calendar month, excluding scheduled maintenance windows and events of force majeure. Provider will conduct routine maintenance during scheduled maintenance windows, which will be communicated to Customer in advance (e.g., maintenance may be scheduled during weekends or off-peak hours). During maintenance windows, the Service may be unavailable or degraded. Provider will endeavor to limit the frequency and duration of scheduled maintenance. If emergency maintenance or patching is required (e.g., to address security vulnerabilities), Provider will attempt to provide advance notice when practicable. Detailed service level commitments and remedies (if any) may be set forth in an SLA (Appendix B) if the parties have agreed to one. In the absence of a separate SLA, the target uptime stated above is a goal and not a strict guarantee, and Customer's sole remedy for significant downtime (absent Provider's gross negligence or willful misconduct) is to terminate the Agreement in accordance with Section 8.`
                        },
                        {
                            type: "p",
                            text: `**9.3 Updates and Software Changes.** Provider will apply updates, bug fixes, and upgrades to the Service as part of its ongoing maintenance. Such updates may change the user experience or functionality of the Service; Provider will endeavor to ensure any such changes are reasonable and improve or maintain the Service's overall quality. Provider will notify Customer (for example, via release notes or email) of major changes that might affect usage or compatibility. Customer is responsible for using the then-current version of the Service and updating any client-side software or integrations to compatible versions as updates are made available.`
                        },
                        {
                            type: "p",
                            text: `**9.4 Additional Support or Professional Services.** Any support or consulting services beyond standard support (for example, dedicated support outside normal hours, on-site training, data migration assistance, or custom development) may be available from Provider at additional cost under a separate agreement or Order Form.`
                        }
                    ]
                },
                {
                    title: "10. Service Levels (SLA)",
                    blocks: [
                        {
                            type: "p",
                            text: `(See Appendix B for a detailed Service Level Agreement if one is attached. If no SLA is attached, the provisions of Section 9.2 above regarding service availability apply and no additional service level guarantees or credits are provided.)`
                        }
                    ]
                },
                {
                    title: "11. Data Protection and Privacy",
                    blocks: [
                        {
                            type: "p",
                            text: `**11.1 Roles of the Parties (GDPR).** To the extent Customer Data includes personal data (as defined under the EU General Data Protection Regulation (GDPR) or other applicable data protection laws), Customer is the "controller" (or "business" under CCPA) of such personal data, and Provider is a "processor" (or "service provider") that processes such data on behalf of Customer. Provider will only process personal data contained in Customer Data for the purpose of providing the Service and performing its obligations under this Agreement, in accordance with Customer's instructions as specified in this Agreement and the DPA.`
                        },
                        {
                            type: "p",
                            text: `**11.2 Data Processing Addendum.** The parties shall enter into a Data Processing Addendum (DPA) in compliance with GDPR Article 28 (or equivalent provisions of other data protection laws) to govern Provider's processing of personal data on Customer's behalf. The DPA is attached as Appendix C or available at [URL or location], and is hereby incorporated by reference into this Agreement. By using the Service and uploading personal data, Customer is deemed to have accepted and signed the DPA. In case of any conflict between this Agreement and the DPA concerning the processing of personal data, the DPA will prevail.`
                        },
                        {
                            type: "p",
                            text: `**11.3 Provider's Obligations as Processor.** Provider will implement appropriate technical and organizational measures to protect personal data within the Service against unauthorized access, loss, or breach, as required by Article 32 GDPR. Provider and its personnel will process Customer personal data only in accordance with the documented instructions of Customer (as set out in this Agreement and the DPA or as otherwise directed by Customer in writing). Provider will ensure that persons authorized to process the personal data are committed to confidentiality. If Provider becomes aware of a personal data breach affecting Customer Data, it will notify Customer without undue delay and provide cooperation and information to assist Customer in fulfilling its breach notification obligations (see also Section 15.3 on Security Incidents).`
                        },
                        {
                            type: "p",
                            text: `**11.4 Subprocessors.** Customer provides a general authorization for Provider to engage subcontractors and sub-processors to assist in the provision of the Service, including for hosting and processing of personal data, provided that Provider remains responsible for the performance of its sub-processors and contracts with them on terms that are no less protective of personal data than those in this Agreement and the DPA. Provider will maintain a list of current sub-processors which will be made available to Customer (e.g., on Provider's website or in Appendix C). Provider will inform Customer in advance of any intended addition or replacement of sub-processors that will handle Customer personal data, giving Customer the opportunity to object for reasonable grounds related to data protection. If Customer has legitimate objections to a new sub-processor and the parties cannot resolve the concern, Customer may terminate the Service with respect to only the affected part (if separable) or altogether as a last resort, and receive a prorated refund of any prepaid fees for the terminated portion.`
                        },
                        {
                            type: "p",
                            text: `**11.5 International Data Transfers.** Customer acknowledges that Provider and its sub-processors may process personal data in countries outside the country in which Customer is located or where the data originated, including outside the European Economic Area (EEA). Provider will ensure that any transfer of personal data from the EEA or other regions with data transfer restrictions will be governed by appropriate legal mechanisms to ensure an adequate level of protection in compliance with GDPR Chapter V. Such mechanisms may include:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) the EU Standard Contractual Clauses (SCCs) adopted by the European Commission (incorporated into the DPA as applicable),`,
                                `(b) reliance on an adequacy decision by the European Commission for the destination country, or`,
                                `(c) any other valid transfer mechanism available under applicable law.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Provider will comply with any supplementary measures required to ensure data is protected in transit and at rest.`
                        },
                        {
                            type: "p",
                            text: `**11.6 Data Subject Requests and Cooperation.** Taking into account the nature of the processing, Provider will assist Customer, by appropriate technical and organizational measures and as reasonably possible, in fulfilling Customer's obligations to respond to requests from individuals (data subjects) to exercise their rights under data protection laws (such as rights to access, delete, or correct personal data). If Provider receives a request from a data subject regarding personal data in Customer's account, and the request identifies Customer, Provider will forward the request to Customer and not respond directly (unless legally compelled to do so). Additionally, upon request, Provider will assist with data protection impact assessments or consultations with supervisory authorities, to the extent required of Customer and relating to the Service, provided that Customer shall pay any reasonable charges for such assistance if the effort is material.`
                        },
                        {
                            type: "p",
                            text: `**11.7 Privacy Policy (Personal Data as Controller).** Customer acknowledges that Provider may collect and process certain limited personal data about Customer's personnel (such as account administrators or billing contacts) for its own legitimate business purposes (for example, account management, billing, or sending service communications). Such processing is not on behalf of Customer, but as an independent data controller; it is governed by Provider's Privacy Policy available at https://getprojectflow.com/privacy. This is separate from the processing of Customer Data within the Service, which is governed by the DPA as described above.`
                        }
                    ]
                },
                {
                    title: "12. Customer Data and Proprietary Rights",
                    blocks: [
                        {
                            type: "p",
                            text: `**12.1 Customer Ownership of Data.** As between the parties, Customer retains all right, title, and interest in and to the Customer Data. Provider does not claim ownership of Customer Data and acknowledges that Customer Data is considered Confidential Information of Customer (subject to the permitted uses under this Agreement). Customer grants to Provider and its sub-processors a non-exclusive, worldwide, royalty-free license to host, store, process, transmit, and display Customer Data only as necessary to provide the Service and related support to Customer, and to otherwise perform Provider's obligations under this Agreement.`
                        },
                        {
                            type: "p",
                            text: `**12.2 Data Security and Backup.** Provider shall protect Customer Data in accordance with the security measures outlined in Section 15 and Appendix C (DPA). While Provider maintains regular backups for disaster recovery, Customer understands that these are for Provider's own restoration purposes. Except as provided in an SLA, Provider does not guarantee that it can restore specific data on Customer's request (outside of a disaster recovery scenario). Customer is encouraged to maintain its own backups/export of its data as needed (see Section 5.5).`
                        },
                        {
                            type: "p",
                            text: `**12.3 Aggregated Data and Anonymized Usage Data.** Notwithstanding anything to the contrary, Provider may compile aggregated and anonymized statistics or insights related to the performance, operation and use of the Service ("Aggregated Data"). For example, Provider might track overall system usage, feature adoption rates, or average task completion times across all customers for benchmarking and improving the Service. Provider may use, store, and publish such Aggregated Data provided that it does not contain any information that could reasonably identify Customer or any individual and does not include any non-public Customer Data. Provider retains all rights to such Aggregated Data. Additionally, Provider may monitor and use Customer's and its users' usage of the Service to the extent needed to ensure compliance with this Agreement, to provide support, and to improve the Service and develop new features (in compliance with the confidentiality and data protection obligations herein).`
                        },
                        {
                            type: "p",
                            text: `**12.4 Removal of Content.** If Provider is notified by Customer or becomes aware that any Customer Data may violate the AUP or any law or third-party right, Provider may (but is not obligated to) disable access to or remove the offending Customer Data. Provider will notify Customer if it takes such action, unless the notice is prohibited by law.`
                        },
                        {
                            type: "p",
                            text: `**12.5 Third-Party Requests for Data.** In the event any third party (including law enforcement or government authorities) requests access to Customer Data or information about Customer's account (such as through a subpoena or court order), Provider will promptly notify Customer (unless legally prohibited) and cooperate with Customer's efforts to protect the Customer Data. Provider may disclose Customer Data to such third party if required by law or a binding order, in which case Provider will only disclose the minimum necessary and, if possible, secure confidential treatment of the data.`
                        }
                    ]
                },
                {
                    title: "13. Confidentiality",
                    blocks: [
                        {
                            type: "p",
                            text: `**13.1 Definition of Confidential Information.** "Confidential Information" means any information disclosed by one party ("Disclosing Party") to the other party ("Receiving Party"), whether in oral, written, electronic, or other form, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the context of disclosure. Confidential Information of Customer includes Customer Data (subject to Section 12.3 for Aggregated Data). Confidential Information of Provider includes the Service software and documentation, pricing information, product roadmaps, and any non-public information about Provider's business, products, or customers. The terms and conditions of this Agreement are considered Confidential Information of both parties.`
                        },
                        {
                            type: "p",
                            text: `**13.2 Exclusions.** Information is not Confidential Information if the Receiving Party can demonstrate that:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) it is or becomes publicly available without breach of any obligation by the Receiving Party;`,
                                `(b) it was known to the Receiving Party without confidentiality obligations, prior to the Disclosing Party's disclosure;`,
                                `(c) it was independently developed by the Receiving Party without use of or reference to the Disclosing Party's Confidential Information; or`,
                                `(d) it was rightfully obtained from a third party not bound by a confidentiality obligation.`
                            ]
                        },
                        {
                            type: "p",
                            text: `**13.3 Confidentiality Obligations.** The Receiving Party shall not use the Disclosing Party's Confidential Information for any purpose outside the scope of this Agreement, and shall not disclose it to any third party except to its own affiliates, employees, contractors, or advisors who need to know it for purposes of this Agreement and who are bound by confidentiality obligations at least as protective. The Receiving Party shall use the same degree of care to protect Confidential Information as it uses to protect its own confidential information of similar nature, but no less than reasonable care.`
                        },
                        {
                            type: "p",
                            text: `**13.4 Compelled Disclosure.** If the Receiving Party is required by law, regulation, or court order to disclose Confidential Information of the Disclosing Party, it shall (if legally permissible) give prompt written notice to the Disclosing Party and cooperate with the Disclosing Party's efforts to seek a protective order or other appropriate remedy. If disclosure is ultimately required, the Receiving Party will disclose only such Confidential Information as legally required and will use reasonable efforts to ensure the information remains confidential (for example, by requesting it be filed under seal).`
                        },
                        {
                            type: "p",
                            text: `**13.5 Return or Destruction.** Upon termination of this Agreement or upon written request of the Disclosing Party, the Receiving Party will return or securely destroy all Confidential Information of the Disclosing Party in its possession, except that the Receiving Party may retain one archival copy for legal compliance purposes or any Confidential Information stored in routine backups, provided such retained information remains subject to confidentiality obligations.`
                        },
                        {
                            type: "p",
                            text: `**13.6 Duration.** The confidentiality obligations in this Section 13 shall commence on the Effective Date and continue for a period of five (5) years after termination of this Agreement, except with respect to trade secrets and Customer Data, which shall be protected indefinitely or for as long as allowed by applicable law.`
                        }
                    ]
                },
                {
                    title: "14. Intellectual Property and Feedback",
                    blocks: [
                        {
                            type: "p",
                            text: `**14.1 Provider Intellectual Property.** All rights, title, and interest in and to the Service and all software, technology, materials, and Provider content used to provide the Service (including all modifications, enhancements, and derivatives thereto) are and shall remain with Provider and its licensors. This includes the ProjectFlow platform and all associated user interfaces, know-how, underlying software code, algorithms, databases, and any design or documentation provided by Provider. The ProjectFlow name and logo, as well as all Provider's product names, logos, and service marks, are trademarks of Provider or its affiliates. Except for the limited rights expressly granted to Customer under this Agreement, no other rights or licenses are granted or implied, and Provider reserves all rights not expressly granted.`
                        },
                        {
                            type: "p",
                            text: `**14.2 License Restrictions.** Customer shall not (and shall not permit any third party to):`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) copy, modify, adapt, translate, or create derivative works of the Service or any software provided as part of the Service;`,
                                `(b) decompile, reverse engineer, disassemble or otherwise attempt to derive the source code of the Service, except to the limited extent such restrictions are expressly prohibited by law (and then with prior notice to Provider);`,
                                `(c) remove, obscure, or alter any proprietary notices or labels on the Service or any reports or output generated through the Service;`,
                                `(d) use the Service in violation of the Acceptable Use Policy or any applicable law; or`,
                                `(e) use any automated system or software (such as bots or scripts) to extract or scrape data from the Service, except via authorized APIs and in accordance with API terms.`
                            ]
                        },
                        {
                            type: "p",
                            text: `**14.3 Customer Feedback.** If Customer or any of its Authorized Users provides suggestions, ideas, enhancement requests, feedback, or recommendations to Provider regarding the Service ("Feedback"), Provider is free to use and incorporate such Feedback into its products and services without obligation to Customer, provided that Provider will not publicly attribute such Feedback to Customer without permission. Customer hereby grants Provider a perpetual, irrevocable, sublicensable, royalty-free license to use and incorporate any Feedback into the Service or other products.`
                        },
                        {
                            type: "p",
                            text: `**14.4 Third-Party Claims and IP Indemnification by Provider.** Provider will defend Customer against any third-party claim, demand, suit, or proceeding ("Claim") alleging that the Service (as provided by Provider) directly infringes a third party's patent, copyright, or trademark, or misappropriates a third party's trade secret, and will indemnify and hold Customer harmless against any damages and costs finally awarded by a court (or in a settlement agreed to by Provider) attributable to such Claim. This indemnity is conditioned on Customer:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(i) promptly notifying Provider in writing of the Claim (and providing sufficient detail such as a copy of the lawsuit or demand letter);`,
                                `(ii) giving Provider sole authority to defend or settle the Claim (provided that Provider may not settle any Claim in a manner that admits fault or liability of Customer or imposes non-monetary obligations on Customer without Customer's prior consent); and`,
                                `(iii) providing reasonable cooperation to Provider in the defense.`
                            ]
                        },
                        {
                            type: "p",
                            text: `In the event of any such Claim, Provider may, at its option and expense, seek to (a) obtain the right for Customer to continue using the Service, (b) replace or modify the infringing component to make it non-infringing while providing substantially similar functionality, or (c) if options (a) and (b) are not commercially reasonable in Provider's judgment, terminate the Agreement and issue a pro-rata refund of any pre-paid Fees for unused Service. Provider will have no liability for any Claim to the extent it arises from: Customer's breach of this Agreement; use of the Service in combination with software, hardware, or data not provided by Provider (including third-party integrations) if the infringement would not have occurred but for such combination; use of the Service in a manner contrary to the documentation or instructions; or modifications to the Service not made or authorized by Provider. This Section 14.4 states the entire liability of Provider, and Customer's exclusive remedy, for any infringement of third-party intellectual property rights.`
                        },
                        {
                            type: "p",
                            text: `**14.5 Customer Indemnity.** Customer shall indemnify, defend, and hold harmless Provider and its affiliates, officers, directors, and employees from and against any and all third-party claims, losses, liabilities, damages, and expenses (including reasonable attorneys' fees) arising out of or related to:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) Customer's or its Authorized Users' breach of the Acceptable Use Policy or Section 6 (e.g., claims that Customer Data is illegal or infringes a third party's rights);`,
                                `(b) Customer's violation of law in its use of the Service (e.g., violation of data protection or anti-spam laws by Customer); or`,
                                `(c) any other materials or information provided by Customer in connection with the Service that causes a third-party claim.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Provider will: (i) promptly notify Customer of any claim for which it seeks indemnification (provided that failure to give prompt notice only relieves Customer of its obligation to the extent materially prejudiced by the delay); (ii) allow Customer sole control of the defense or settlement of the claim (subject to similar limitations as in 14.4 that Customer may not agree to any settlement imposing liability or admission of fault on Provider without consent); and (iii) provide reasonable cooperation at Customer's expense.`
                        }
                    ]
                },
                {
                    title: "15. Security and Data Incidents",
                    blocks: [
                        {
                            type: "p",
                            text: `**15.1 Security Measures.** Provider implements and maintains technical and organizational measures to protect the security (including integrity, availability, and confidentiality) of the Service and Customer Data. These measures include, at a minimum: access controls to data (ensuring only authorized staff with a need to know can access Customer Data); encryption of Customer Data in transit (e.g., via HTTPS/TLS) and at rest (where feasible, using strong encryption algorithms); network security measures such as firewalls and intrusion detection; regular vulnerability assessments and security testing of the Service; and personnel security and training. Additional details of Provider's security practices may be provided in a security overview document or as part of the DPA. Customer acknowledges that no service can be completely secure, but Provider shall use industry-standard practices to protect against unauthorized access or disclosure of Customer Data.`
                        },
                        {
                            type: "p",
                            text: `**15.2 Customer's Security Obligations.** Customer is responsible for using the Service in a secure manner, including protecting its account credentials, using strong passwords or SSO, and ensuring its systems connecting to the Service are free of malware. Customer should promptly notify Provider if it suspects any unauthorized access to its account or any security vulnerability in the Service. If Customer plans to conduct any penetration testing on the Service, Customer must obtain Provider's written consent and adhere to any scope or rules provided by Provider (unauthorized penetration testing or scans are expressly prohibited).`
                        },
                        {
                            type: "p",
                            text: `**15.3 Security Incidents and Breach Notification.** If Provider becomes aware of any unlawful access to any Customer Data stored on Provider's systems, or unauthorized access to such systems that results in loss, disclosure, or alteration of Customer Data (a "Security Breach"), Provider will promptly investigate the Security Breach and notify Customer without undue delay (in no case later than 48 hours after becoming aware of the breach). Provider's notification will include, to the extent known, a description of the nature of the breach, the affected data, and any steps Provider is taking to mitigate the breach. Provider will also cooperate with Customer's reasonable requests in connection with the breach, such as providing information needed for Customer to fulfill any legal obligations to notify affected individuals or authorities. Unless required by law, Provider will not notify any third party (including the data subjects or supervisory authority) of the Security Breach without Customer's prior consent, except that Provider may document and report it to relevant data protection authorities if legally obligated.`
                        },
                        {
                            type: "p",
                            text: `**15.4 Business Continuity and Disaster Recovery.** Provider maintains backup systems and a disaster recovery plan to ensure that the Service can be restored in case of a major incident. Provider will test its backup and recovery processes periodically. In the event of a disaster or force majeure event impacting the Service, Provider will make reasonable efforts to restore availability as soon as practicable. However, some data loss could occur in extreme scenarios; as stated, Customer is advised to keep its own copies of critical data. The liability for data loss is addressed in Section 17 below.`
                        }
                    ]
                },
                {
                    title: "16. Warranties and Disclaimers",
                    blocks: [
                        {
                            type: "p",
                            text: `**16.1 Service Warranty.** Provider warrants that during the term of this Agreement, the Service will substantially conform in all material respects to the features and descriptions on getprojectflow.com or in the applicable documentation, and that it will perform the Service with reasonable skill and care. In the event of any breach of this warranty, Customer's sole and exclusive remedy, and Provider's sole obligation, is for Provider to make commercially reasonable efforts to correct the non-conformity or, if Provider is unable to correct the issue within a reasonable time, for Customer to terminate the affected Service and receive a prorated refund of any pre-paid Fees for the period in which the Service did not conform to this warranty. Any claim under this warranty must be notified to Provider within thirty (30) days of discovering the issue.`
                        },
                        {
                            type: "p",
                            text: `**16.2 Excluded Warranty Claims.** The warranty in Section 16.1 does not apply to: (i) any Beta Features or trial services provided free of charge; (ii) any use of the Service not in accordance with this Agreement or the documentation; (iii) any non-conformity caused by third-party equipment, software, or other technology (including integrations) used by Customer; or (iv) any issues caused by factors outside of Provider's reasonable control (such as internet outages or force majeure events).`
                        },
                        {
                            type: "p",
                            text: `**16.3 Customer Warranties.** Customer represents and warrants that: (a) it has valid authority to enter into this Agreement and perform its obligations; (b) it and its users will use the Service in accordance with the Agreement and in compliance with all applicable laws; and (c) uploading and using the Customer Data with the Service (including any personal data) in accordance with this Agreement will not violate any laws or infringe any rights of third parties. Customer further warrants that it has obtained all necessary consents or rights for any personal data of third parties that it processes via the Service.`
                        },
                        {
                            type: "p",
                            text: `**16.4 Disclaimer of Other Warranties.** Except as expressly provided in this Agreement, the Service is provided "AS IS" and "AS AVAILABLE," and to the maximum extent permitted by law, Provider disclaims all other warranties, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, title, or non-infringement. Provider does not warrant that the Service will be completely error-free or uninterrupted, or that all errors will be corrected. Provider does not guarantee that the Service will meet all of Customer's requirements or expectations. Customer acknowledges that the Service's performance may depend on internet connectivity and third-party services and that any data or content downloaded or obtained through the Service is at Customer's own discretion and risk.`
                        }
                    ]
                },
                {
                    title: "17. Limitation of Liability",
                    blocks: [
                        {
                            type: "p",
                            text: `**17.1 Unlimited Liability in Certain Cases.** Nothing in this Agreement shall limit or exclude either party's liability for:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) death or personal injury caused by its negligence or willful misconduct,`,
                                `(b) fraud or fraudulent misrepresentation,`,
                                `(c) any liability that cannot be limited or excluded by law (such as under the German Product Liability Act or in the event of an assumption of a specific guarantee (Garantie) given by Provider), or`,
                                `(d) intentional breaches (Vorsatz).`
                            ]
                        },
                        {
                            type: "p",
                            text: `**17.2 Liability for Slight Negligence (Verletzung wesentlicher Pflichten).** In cases of simple or slight negligence, each party (and in particular Provider) shall be liable only for the breach of essential contractual obligations ("wesentliche Vertragspflichten"). Essential contractual obligations are those duties which must be fulfilled to achieve the purpose of the contract and on the fulfillment of which the other party can generally rely. In such cases, provided no other unlimited liability ground applies, each party's liability is limited to the typical and foreseeable damages at the time of concluding the contract.`
                        },
                        {
                            type: "p",
                            text: `**17.3 Overall Cap on Liability.** Subject to Section 17.1 (unlimited cases) and excluding any credits or refunds expressly provided under this Agreement, the total aggregate liability of either party under or in connection with this Agreement (for all claims, whether in contract, tort (including negligence), or otherwise) shall not exceed the amount of Fees paid or payable by Customer to Provider in the twelve (12) months preceding the event giving rise to the liability. If the term of the Agreement has been less than 12 months, then the cap will be the total amount paid or payable for that shorter term (or, for a free trial customer, EUR 0).`
                        },
                        {
                            type: "p",
                            text: `**17.4 Exclusion of Certain Damages.** To the maximum extent permitted by applicable law, neither party will be liable to the other for any indirect, special, incidental, consequential or punitive damages of any kind, or for any of the following types of loss or damage, whether direct or indirect: loss of profits, loss of business opportunity, loss of revenue, loss of anticipated savings, loss or corruption of data (subject to Section 17.5 below), or loss of goodwill, even if the party has been advised of the possibility of such damages in advance and even if a remedy fails of its essential purpose.`
                        },
                        {
                            type: "p",
                            text: `**17.5 Liability for Data Loss.** In the event of loss or corruption of Customer Data, Customer's sole and exclusive remedy shall be for Provider to use commercially reasonable efforts to restore the data from the latest backup maintained by Provider (if any). Provider's liability for loss or corruption of data (to the extent not excluded as consequential damage) shall in any case be limited to the typical effort of recovering and restoring the data that would have been required if Customer had maintained reasonable backup copies of such data.`
                        },
                        {
                            type: "p",
                            text: `**17.6 Application of Limitations.** The parties agree that the limitations and exclusions of liability in this section reflect a reasonable allocation of risk between the parties, and that without these limitations the pricing and terms of this Agreement would be different. Each party has a duty to mitigate its damages under general principles of law. The limitations in this section shall apply to any and all claims arising from or relating to this Agreement, whether arising in contract, tort, strict liability, or otherwise, and regardless of the theory of liability, but shall not limit payment obligations under Section 7 (Fees) or Customer's liability for infringement or violation of Provider's intellectual property rights or indemnity obligations under Section 14.5.`
                        },
                        {
                            type: "p",
                            text: `**17.7 Independent Remedies.** Any remedies expressly provided in this Agreement (e.g., service credits, termination rights, or indemnification) are in addition to and separate from any rights of damages that a party may have at law or in equity, subject to the limitations and exclusions set forth in this section.`
                        }
                    ]
                },
                {
                    title: "18. Third-Party Services and Links",
                    blocks: [
                        {
                            type: "p",
                            text: `The Service may contain features that interoperate with third-party services or may contain links to third-party websites or resources. For example, the Service might enable Customer to integrate with other project management tools, file storage providers, or AI platforms, or contain links to tutorials on third-party sites. No Endorsement or Warranty: Provider does not endorse and is not responsible for any third-party services or websites, or their availability, accuracy, or content. Use of any third-party service is governed by that third party's terms and privacy policy, which Customer is responsible for reviewing. No Liability: Provider will not be liable for any damages or losses incurred by Customer as a result of interactions with third-party services, including any exchange of data between Customer and any third-party provider. Customer uses such third-party services at its own risk. If a third-party service used by Customer to integrate with the Service ceases to make the integration available or functional, Provider is not obligated to provide any refund or compensation for the loss of use of such integration, aside from possibly providing data export tools.`
                        }
                    ]
                },
                {
                    title: "19. Changes to Service and Terms",
                    blocks: [
                        {
                            type: "p",
                            text: `**19.1 Changes to the Service.** Provider reserves the right to make commercially reasonable changes or updates to the Service from time to time, for example to improve functionality or security, or to comply with legal requirements. If Provider makes a change that materially reduces core functionality or features of the Service, Provider will inform Customer with reasonable advance notice (e.g., by email or notification within the Service), and Customer may, as its sole remedy, terminate the Service and receive a pro-rata refund of prepaid fees for the portion of the term remaining after termination (if Customer gives notice of termination within 30 days after the change effective date).`
                        },
                        {
                            type: "p",
                            text: `**19.2 Changes to Terms.** Provider may update or modify this Agreement (including any Appendices) from time to time. Provider will notify Customer of material changes at least 30 days before the new terms are to take effect, by sending an email to the contact email provided by Customer or via an in-service notification. If Customer objects to the updated Agreement, Customer must notify Provider in writing within the notice period. In the case of Customers on monthly subscription plans, the updated terms will take effect at the start of the next monthly term after the 30-day notice period (and continued use of the Service after that effective date constitutes acceptance). In the case of Customers on annual or fixed-term subscriptions, if Customer timely objects to the changes, the parties will negotiate in good faith; if no resolution is reached, Customer may elect to either (a) continue under the prior terms until the end of the current term, after which the updated terms will apply for any renewal, or (b) terminate the Agreement at the end of the current term (or earlier if the changes materially impair Customer's use of the Service, in which case Provider may allow early termination with pro-rata refund). If Customer does not object within the notice period, the updated Agreement will become binding at the end of the notice period or on the stated effective date of the new terms. Provider's notice of updated terms will reference Customer's right to object and/or not renew in accordance with this section. Minor updates (such as clarifications or changes that do not materially diminish Customer's rights) may be made without prior notice, but will be reflected in the version date of the terms.`
                        },
                        {
                            type: "p",
                            text: `**19.3 Regulatory Changes.** If any changes in law or regulation (including GDPR or other data protection regulations) require a change to the Service or terms, or if a regulatory authority or court decision requires changes, Provider may make such changes and will use reasonable efforts to minimize the impact on Customer. Any such legally required changes may be made on shorter notice than that specified in 19.2 if necessary to comply with the law.`
                        }
                    ]
                },
                {
                    title: "20. Compliance, Export Control and Sanctions",
                    blocks: [
                        {
                            type: "p",
                            text: `**20.1 Export Controls.** The Service, including any software, documentation, and technical data, may be subject to export control and economic sanctions laws of the United States, the European Union, Germany, and other jurisdictions. Customer represents that it is not named on any government list of persons or entities prohibited from receiving exports or doing business with certain parties (such as the U.S. Treasury Department's Specially Designated Nationals list, or the EU consolidated sanctions list). Customer shall not permit Authorized Users to access or use the Service in violation of any export embargo, prohibition or restriction, including (but not limited to) exporting or re-exporting the Service to jurisdictions subject to comprehensive sanctions (such as Cuba, Iran, North Korea, Syria, or the Crimea region) without proper authorization.`
                        },
                        {
                            type: "p",
                            text: `**20.2 Anti-Bribery.** Each party agrees that in connection with this Agreement and the use of the Service, it will comply with all applicable anti-corruption and anti-bribery laws (such as the U.S. Foreign Corrupt Practices Act and the UK Bribery Act). Neither party will offer, pay, promise, or authorize any bribe, kickback, or other improper payment of money or anything of value to any person or entity with the aim of improperly influencing any decision or obtaining an unfair advantage.`
                        },
                        {
                            type: "p",
                            text: `**20.3 Legal Compliance.** Customer is responsible for ensuring that its use of the Service is in compliance with all laws and regulations applicable to Customer's business, including but not limited to privacy laws, employment laws, and regulations related to its industry. Provider will comply with laws applicable to Provider as a SaaS service provider and its role as a data processor.`
                        }
                    ]
                },
                {
                    title: "21. Governing Law and Jurisdiction",
                    blocks: [
                        {
                            type: "p",
                            text: `**21.1 Governing Law.** This Agreement, and any disputes arising out of or related to it, shall be governed by the laws of Germany, without regard to its conflict of laws principles. The United Nations Convention on Contracts for the International Sale of Goods (CISG) does not apply to this Agreement.`
                        },
                        {
                            type: "p",
                            text: `**21.2 Jurisdiction.** The courts of ${COMPANY_CITY} (Germany) shall have exclusive jurisdiction to adjudicate any dispute arising out of or relating to this Agreement, except that Provider may seek injunctive relief or enforcement of its intellectual property rights in any competent jurisdiction. Each party consents to such jurisdiction and venue, and waives any objections (such as inconvenient forum) to the extent permitted.`
                        },
                        {
                            type: "p",
                            text: `**21.3 Local Mandatory Laws.** Notwithstanding the foregoing governing law and jurisdiction clauses, if Customer's principal place of business is outside Germany, nothing in this Agreement is intended to deprive Customer of the benefit of any provisions of law which cannot by law be waived (for example, certain local data protection laws or mandatory consumer/business protection laws if applicable). In such case, this Agreement shall be deemed amended to the minimum extent necessary to comply with such mandatory law.`
                        }
                    ]
                },
                {
                    title: "22. Miscellaneous",
                    blocks: [
                        {
                            type: "p",
                            text: `**22.1 Entire Agreement.** This Agreement, including all Appendices and any Order Form, constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior or contemporaneous agreements, negotiations, representations and proposals, written or oral, concerning the subject matter. Each party acknowledges that in entering into this Agreement it has not relied on any representations or warranties not expressly set out in this Agreement. Any terms or conditions (whether printed, hyperlinked, or otherwise) on a Customer purchase order or other business form will have no effect and are rejected, even if signed or not objected to by Provider.`
                        },
                        {
                            type: "p",
                            text: `**22.2 Amendment and Waiver.** Except as provided in Section 19 (Changes to Terms), any amendment or modification to this Agreement must be in writing and signed by both parties (electronic form is acceptable). A waiver of any right under this Agreement on one occasion shall not constitute a waiver of any other right or of the same right on another occasion. The failure of a party to enforce any provision of this Agreement shall not constitute a waiver or modification of that provision or affect that party's right to subsequently enforce it.`
                        },
                        {
                            type: "p",
                            text: `**22.3 Severability.** If any provision of this Agreement is held to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision shall be enforced to the maximum extent permissible so as to effect the intent of the parties, and the remaining provisions of the Agreement shall remain in full force and effect. If a certain provision is invalid in one jurisdiction but would be valid under the laws of another jurisdiction, the validity of such provision in that other jurisdiction shall not be affected. The parties shall endeavor in good faith to replace any invalid or unenforceable provision with a valid and enforceable one that achieves the original intent.`
                        },
                        {
                            type: "p",
                            text: `**22.4 Assignment.** Customer may not assign or transfer this Agreement (in whole or in part), nor delegate any of its obligations, to any third party without Provider's prior written consent, except that Customer may assign this Agreement in its entirety, with notice to Provider, in connection with a merger, acquisition, or sale of all or substantially all of Customer's assets or equity (provided the assignee is not a direct competitor of Provider). Provider may assign or transfer this Agreement to an Affiliate or in connection with a merger, reorganization, acquisition or other transfer of all or substantially all of its business or assets to which this Agreement relates. Subject to the foregoing, this Agreement will bind and benefit the parties and their respective permitted successors and assigns. Any attempted assignment in violation of this section is void.`
                        },
                        {
                            type: "p",
                            text: `**22.5 Subcontracting.** Provider may subcontract obligations under this Agreement to third parties (for example, engaging data center operators or support service providers), provided that no such subcontract shall relieve Provider of its responsibility for performance of its duties hereunder, and provided that any sub-processor handling personal data is subject to obligations consistent with the DPA.`
                        },
                        {
                            type: "p",
                            text: `**22.6 Relationship of the Parties.** The parties are independent contractors. This Agreement does not create a partnership, franchise, joint venture, agency, fiduciary, or employment relationship between the parties. Neither party has authority to act on behalf of or bind the other in any way unless expressly provided in this Agreement.`
                        },
                        {
                            type: "p",
                            text: `**22.7 No Third-Party Beneficiaries.** There are no third-party beneficiaries to this Agreement; this Agreement is intended solely for the benefit of the signatories and permitted assigns. However, indemnified parties under Section 14.5 (such as Provider's affiliates and personnel) are intended third-party beneficiaries to that extent only.`
                        },
                        {
                            type: "p",
                            text: `**22.8 Notices.** Routine communications (such as account-related or support communications) may be sent by email to the contacts provided. For legal notices regarding breach, termination, or indemnifiable claims ("Legal Notices"), the parties shall deliver them in writing by courier or certified mail to the addresses specified in the Order Form or to the Provider's address above (or such other address as either party notifies to the other in writing). Additionally, Provider may send Legal Notices to the email of Customer's registered account owner. Legal Notices shall be effective upon receipt as demonstrated by delivery confirmation (or, for email, upon sending to the proper email address, provided no bounce-back is received).`
                        },
                        {
                            type: "p",
                            text: `**22.9 Language.** This Agreement is drafted in the English language, which shall be the governing language for its interpretation. Any translations (if provided) are for convenience only. In case of any conflict between the English text and a translated version, the English version shall prevail. All communications and notices under this Agreement shall be in English, unless otherwise agreed.`
                        },
                        {
                            type: "p",
                            text: `**22.10 Headings and Interpretation.** Section headings are for convenience only and shall not affect the interpretation of this Agreement. Terms such as "including" or "for example" are deemed to be followed by "without limitation" unless context indicates otherwise. References to statutes or regulations include any amendments or successors thereto.`
                        },
                        {
                            type: "p",
                            text: `**22.11 Counterparts and Electronic Acceptance.** This Agreement may be executed in counterparts (for example, by exchanging signed signature pages or via electronic signature services), which together will constitute one instrument. Alternatively, acceptance of this Agreement may be evidenced by Customer's click-through acceptance or electronic signature, which shall be deemed execution of the Agreement and legally binding.`
                        }
                    ]
                },
                {
                    title: "Appendices",
                    blocks: [
                        {
                            type: "p",
                            text: `The following Appendices are included as part of this Agreement:`
                        },
                        {
                            type: "ul",
                            items: [
                                `Appendix A: Acceptable Use Policy (AUP)`,
                                `Appendix B: Service Level Agreement (SLA) / Support Policy`,
                                `Appendix C: Data Processing Addendum (summary & incorporation by reference)`
                            ]
                        }
                    ]
                },
                {
                    title: "Appendix A: Acceptable Use Policy (AUP)",
                    blocks: [
                        {
                            type: "p",
                            text: `This AUP sets forth additional examples of prohibited uses of the Service and forms part of the Agreement. In addition to the obligations in Section 6 of the Agreement, Customer (including all Authorized Users) agrees not to use the Service:`
                        },
                        {
                            type: "ul",
                            items: [
                                `**To Violate Law:** In any manner that violates any applicable law, regulation, or court order. This includes data protection laws, intellectual property laws, export control laws, and criminal laws.`,
                                `**To Exploit Minors:** To harm or exploit minors (e.g., expose them to inappropriate content or solicit personal information).`,
                                `**To Stalk or Harass:** To engage in stalking, harassment, or threatening behavior toward anyone.`,
                                `**To Misrepresent or Phish:** To impersonate any person or entity, or falsely state or misrepresent yourself (e.g., pretending to be a representative of another company). Also, not to use the Service to create phishing websites/emails or fraudulent schemes.`,
                                `**For High-Risk Activities:** In any environment where use or failure of the Service could lead to death, personal injury, or environmental damage (e.g., operating medical equipment, air traffic control, nuclear facilities), unless Provider has given explicit permission and such use is backed by additional warranties or insurance.`,
                                `**To Transmit Viruses:** To upload or send through the Service any viruses, malware, or other code that is malicious or designed to disrupt the operation of software, hardware, or equipment.`,
                                `**To Mine Cryptocurrency:** Unless specifically permitted, not to run any cryptocurrency mining or similar resource-intensive operations via the Service.`,
                                `**To Circumvent Security:** To attempt to bypass or undermine any security or access restrictions of the Service. This includes not using the Service in a way that undermines its security or encryption (for example, extracting encryption keys, or using the Service to test third-party systems without authorization).`,
                                `**Automated Use:** If using scripts or bots with the Service's API, ensuring they are well-behaved (e.g., respect rate limits, no infinite loops that might spam requests). Bulk exporting or scraping of data you do not own, beyond what the Service's features allow, is prohibited.`,
                                `**Storage of Illicit Material:** Not to use the Service as a platform for backup or storage of material unrelated to its intended use, especially if such material is illegal, infringing, or obscene.`,
                                `**Reselling or Sharing Beyond License:** Not to share non-public Service features or content with any third party or develop any third-party site or service that links to the Service outside of the allowed API usage, without Provider's prior written consent.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Provider may update this AUP from time to time by posting an updated version in the same repository or link as the main Agreement or by other notice to Customer. Material changes will be communicated with notice as per the Agreement. If Customer becomes aware that any Authorized User has violated this AUP, Customer shall immediately suspend the user's access to the Service and inform Provider. Provider reserves the right (but is not obligated) to monitor compliance with this AUP and the Agreement, and may remove content or suspend accounts found to be in violation.`
                        }
                    ]
                },
                {
                    title: "Appendix B: Service Level Agreement (SLA) / Support Policy",
                    blocks: [
                        {
                            type: "p",
                            text: `This Appendix provides additional details on service availability and support. If a separate, signed SLA document is in place, its terms will supersede this Appendix to the extent of conflict. In the absence of a separately negotiated SLA, the following applies:`
                        },
                        {
                            type: "ol",
                            items: [
                                `**Service Availability Commitment:** Provider targets at least 99.5% uptime for the Service each calendar month, excluding scheduled maintenance and force majeure events. "Uptime" means the Service is generally accessible to Customer and operational (not a guarantee of performance or response time). Scheduled maintenance will typically occur during low-usage periods and Provider will give at least 2 days' notice for any planned downtime exceeding 15 minutes. Provider will make reasonable efforts to limit maintenance downtime to 4 hours per month.`,
                                `**Measurement:** Uptime is measured at the server side at the demarcation point of Provider's network (i.e., the point where Provider's network connects to the public internet). It does not account for outages or issues on Customer's side or general internet issues outside Provider's control. Provider's monitoring tools will be used to determine availability.`,
                                `**Service Credits:** (Optional; if Provider offers service credits for downtime, terms would be here. If no credits: This Agreement does not provide for automatic service credits. However, if uptime in a given month falls below 99.5% due to issues within Provider's control, Customer may contact Provider to discuss a goodwill service credit or extension of subscription time. Any such remedy is at Provider's discretion and does not waive the limitations of liability in the Agreement.)`,
                                `**Support Response Times:** Provider's support team strives to respond to support tickets or emails within 24 hours during business days. Initial response means a human (not just an automated reply) acknowledging the issue and providing an initial assessment or request for more information. Resolution times will vary depending on the complexity of the issue, but Provider will work diligently to resolve critical issues (Service completely down or major features inoperative) as soon as possible, including outside normal hours if necessary.`,
                                `**Escalation:** If Customer experiences a critical severity issue (Service unavailable), they should mark the support request as "Urgent" or use any emergency contact method provided. Provider will escalate such issues internally to ensure a prompt response. For less severe issues (minor bugs or how-to questions), standard response within 1 business day applies.`,
                                `**Exceptions:** Provider is not responsible for failure to meet performance targets to the extent due to: (i) misuse of the Service or violation of the Agreement by Customer or its users; (ii) internet or telecom failures outside Provider's control; (iii) any beta features or trial use; (iv) force majeure events (e.g., DDoS attacks, major cloud provider outage, natural disasters); or (v) Customer's specific network or equipment issues.`,
                                `**Updates to SLA:** Provider may review and update these support and service level commitments from time to time (especially if new support plans or premium support tiers are introduced). Any material reduction in service level commitments will be handled as a change to the Agreement under Section 19.2.`
                            ]
                        }
                    ]
                },
                {
                    title: "Appendix C: Data Processing Addendum (DPA) Summary",
                    blocks: [
                        {
                            type: "p",
                            text: `This Appendix C provides a high-level overview of the Data Processing Addendum terms and confirms its incorporation. The full DPA document (which may be provided separately or available at https://getprojectflow.com) contains more detailed provisions required by GDPR Article 28 and other privacy laws.`
                        },
                        {
                            type: "p",
                            text: `**Parties and Roles:** This DPA is between Digital Products by Christoph Labestin as the Processor and Customer as the Controller (as those terms are defined in GDPR). It applies when Customer Data includes Personal Data and Provider processes it on behalf of Customer in providing the Service.`
                        },
                        {
                            type: "p",
                            text: `**Subject Matter:** The processing is the provision of the Service to Customer. Duration: The processing lasts for the duration of the Agreement until deletion of personal data as per the terms. Nature and Purpose: To host, transmit, and manipulate data as necessary to provide the project management and related features of the Service. Types of Personal Data: Typically may include contact information (names, emails), project-related information (which could include any personal data users input, such as descriptions or files), and communication content (comments, messages). Categories of Data Subjects: Customer's employees, contractors, clients or individuals collaborating via the Service; any persons whose data is included in Customer Data.`
                        },
                        {
                            type: "p",
                            text: `**Processor Obligations:** Provider (Processor) will only process personal data on documented instructions from Customer (the Agreement and use of Service serve as the initial instructions). Provider will ensure its personnel are bound to confidentiality. Provider will implement appropriate technical and organizational security measures (as per GDPR Art. 32) to protect personal data.`
                        },
                        {
                            type: "p",
                            text: `**Sub-processing:** Customer gives general authorization for Provider to use sub-processors to deliver the Service (e.g., cloud hosting providers, email service, support tools). Provider will maintain a list of sub-processors and will notify Customer of changes (e.g., via website or email) giving the opportunity to object. Sub-processors are required to uphold equivalent data protection obligations. Key sub-processors include: hosting (e.g., AWS or similar), email delivery (if applicable), etc. Note: actual list to be provided separately.`
                        },
                        {
                            type: "p",
                            text: `**International Transfers:** If Provider or its sub-processors transfer personal data from the EU/EEA to a country not deemed adequate, the EU Standard Contractual Clauses (SCCs) will apply by reference, with Customer as "data exporter" and Provider as "data importer." The SCCs will be deemed executed by the parties as needed. Provider will implement additional safeguards if required (encryption, etc.) to ensure transferred data is protected.`
                        },
                        {
                            type: "p",
                            text: `**Assistance to Controller:** Provider will reasonably assist Customer in fulfilling its obligations to respond to data subject requests (rights to access, rectify, erase, etc.), to conduct Data Protection Impact Assessments (DPIAs), and to consult with supervisory authorities if required, taking into account the nature of processing and information available. Provider may charge a reasonable fee for extensive assistance requests beyond the standard Service features.`
                        },
                        {
                            type: "p",
                            text: `**Breach Notification:** Processor will notify Customer without undue delay after becoming aware of a personal data breach involving Customer's data, providing sufficient information to help Customer meet any obligations to inform regulators or data subjects.`
                        },
                        {
                            type: "p",
                            text: `**Deletion or Return of Data:** Upon termination of the Service, upon Customer's request or as per the Agreement, Provider will delete or return all personal data processed on Customer's behalf, except to the extent retention is required by law. If return is requested, data will be provided in a commonly used format. Provider may retain minimal personal data in backups or logs for a limited period, subject to confidentiality, before it is overwritten.`
                        },
                        {
                            type: "p",
                            text: `**Audits:** Customer has the right to audit Provider's compliance with the DPA, either by reviewing available third-party audit certifications/reports (e.g., ISO 27001, SOC 2, if provided) or by conducting a reasonable audit (which may be via a third-party auditor subject to confidentiality) with prior notice. Parties will agree on the scope and timing of any direct audit to minimize disruption. Customer is responsible for any audit costs, unless the audit reveals material non-compliance.`
                        },
                        {
                            type: "p",
                            text: `**Liability under DPA:** The limitations of liability in the main Agreement apply to the DPA as well. In no event shall any party's total liability for breaches of the DPA exceed the limitations set out in the Agreement's liability section, except to the extent that law forbids limiting liability for certain data protection obligations.`
                        },
                        {
                            type: "p",
                            text: `**Order of Precedence:** In case of conflict between the DPA and the main Agreement or other documents, the DPA will prevail regarding data protection matters. The SCCs (if used) will prevail over both in their applicable scope.`
                        },
                        {
                            type: "p",
                            text: `**Miscellaneous (DPA):** The DPA incorporates the mandatory clauses of Article 28(3) and (4) GDPR. It does not grant any third-party beneficiary rights. Any amendments to the DPA must be in writing. The DPA may be an appendix or a separate signed document; in either case, it is legally binding once the main Agreement is in effect and Customer uses the Service to process personal data.`
                        }
                    ]
                }
            ]
        },
        appPrivacy: {
            intro: {
                title: "1. Introduction",
                text: "Welcome to the privacy policy for ProjectFlow (the “Service”). This policy explains how we collect, use, disclose, and protect your personal data when you use our Service. We are committed to complying with the EU General Data Protection Regulation (GDPR, known as DSGVO in Germany) and other applicable privacy laws. Please read this policy carefully to understand our practices regarding your information."
            },
            controller: {
                title: "2. Data Controller and Contact Information",
                text: `The **Service** is operated by **${COMPANY_NAME}**, which is the “**data controller**” responsible for your personal data. **${COMPANY_NAME}** is located at **${COMPANY_STREET}, ${COMPANY_ZIP} ${COMPANY_CITY}, Germany**. If you have any questions or requests regarding your personal data, you can contact us at **${COMPANY_EMAIL}**.`,
                subtitle: "2.1 Controller vs Processor",
                subtext: "In most cases, we act as the data controller for information you provide directly to the Service (e.g. your account details). However, for personal data that you upload or manage within the platform on behalf of others (for example, contact lists for email campaigns or personal information about your team members in a workspace), you or your organization may be the data controller, and we function as a data processor handling that data on your instructions. In those cases, you are responsible for ensuring you have a legal basis to process that personal data and for providing any necessary notices to the individuals concerned."
            },
            collectedData: {
                title: "3. Personal Data We Collect",
                intro: "We collect various types of personal data when you use **ProjectFlow**. This includes information you provide to us directly, information generated through your use of the Service, and information from integrated third-party services. Below is an overview of the categories of data we handle:",
                account: {
                    title: "3.1 Account Information",
                    text: "When you register an **account**, we collect your **email address** and may ask for a display name and profile photo. This basic profile data is stored in our systems. If you sign up via an OAuth provider (like Google or GitHub), we receive your name and email from that provider instead of a manual signup. Your user ID is also recorded for identification in the system. This information is necessary to create and maintain your user account."
                },
                auth: {
                    title: "3.2 Authentication Data",
                    text: "We use **Firebase Authentication** to manage user logins. If you register with an email/password, your password is stored in hashed form by Firebase (we never see your raw password). We also store authentication factors and credentials as needed for security: for example, if you enable two-factor authentication (2FA) with an authenticator app (TOTP), the fact that 2FA is enabled (and necessary secret data to verify codes) is stored securely by Firebase. If you use passwordless login methods like passkeys (WebAuthn), we store your passkey credential information (public key, credential ID, and device details) associated with your account. This allows you to authenticate with biometrics or security keys. We also retain information on your authentication providers (e.g. whether you linked a Google or GitHub account for login). All such data is collected to secure your account and enable your preferred login methods."
                },
                profile: {
                    title: "3.3 Profile and Workspace Data",
                    text: "You have the option to provide additional **profile details** in your account. This may include a display name (if not provided already), and optional information like your job title, bio/biography, address, skills, or profile picture. If you choose to fill out these fields in your profile, we will collect and store that information. You can adjust your privacy settings for some profile fields within the app (for example, who in your workspace can see your email or other details). We also keep track of your workspace membership and roles. If you belong to a workspace (team account), we store your role (e.g. Owner, Admin, Member, Guest) and group memberships within that workspace. The Service records the projects and groups you have access to, and who invited you or when you joined a workspace. This workspace data is used to manage permissions and collaboration features."
                },
                content: {
                    title: "3.4 Project and Content Data",
                    text: "**ProjectFlow** is a productivity and project management platform, so by its nature we process the **content** you and your team input into the Service. This includes project details and metadata, tasks and issues you create or are assigned to, milestones, mind map entries, comments you post, files or media you upload, and any other content or data you submit while using the platform. We store this data in our database and file storage in order to provide the Service’s core functionality (organizing your projects and workflows). For example, if you create a task or leave a comment, we will store that content along with information on who created it and when. Likewise, if you upload files (such as images or documents to the media library or as attachments), those files are stored in our cloud storage and associated with your account or project. Please note: The content you and your users input may incidentally include personal data (for instance, a task description could include someone’s name or contact info if you add it). We do not normally require you to input special categories of personal data into the platform, and you should avoid uploading any sensitive personal information unless necessary. Any personal data contained in your project content will be processed by us solely to provide the Service to you (we do not use it for our own purposes)."
                },
                social: {
                    title: "3.5 Social and Marketing Features Data",
                    text: "If you use the integrated **Social Studio** or **Marketing suite** features, we collect the data you input for those purposes. For example, if you create a social media campaign or scheduled post, we will store the campaign details (campaign name, goals, audience, schedule, etc.) and the content of the social posts (captions, images, hashtags, etc.) that you prepare. The platform may also store analytic or status information about these campaigns (e.g. whether a post is approved, scheduled, published, or metrics like number of clicks if you input them). Similarly, if you use the marketing campaign planner, we store details like campaign objectives, channels (e.g. Google Ads, Email, etc.), and any related data you enter about strategy or budget. All such information is provided by you to use these features and is considered your business data – we just process it to enable the campaign planning and tracking functionality."
                },
                lists: {
                    title: "3.6 Contact Lists and Email Marketing Data",
                    text: "As part of the marketing tools, you can manage **email campaigns** and **recipient lists**. If you import or add recipient contact data (for example, a list of email subscribers or customers to send email campaigns to), we will store those contacts’ information in our system on your behalf. This typically includes an email address and may include name, and any other details you choose to upload for each contact (such as tags, group assignments, or custom fields like company, gender, etc. that you configure). We also record the status of each contact (subscribed, unsubscribed, bounced) and basic email delivery statistics for your campaigns (e.g. how many emails were sent, opened, clicked, etc.). Important: If you provide us with personal data of other individuals (e.g. uploading your customer email list), you are responsible for ensuring you have collected that data lawfully (for instance, that you have their consent to send marketing emails). We will only use these contacts’ data to operate the email functionality as directed by you (for example, to send the emails you compose to the recipients you list, and to track unsubscribes or bounces)."
                },
                integration: {
                    title: "3.7 Integration Data (Third-Party Accounts)",
                    text: "ProjectFlow offers integrations with certain **third-party services** (such as GitHub and Facebook/Instagram) to streamline your workflow. If you choose to connect a third-party account, we will collect and store the minimal data necessary for that integration. For example, if you link a GitHub account to sync issues, we will ask for a GitHub personal access token or use OAuth to get permission. We will store your GitHub token securely in your profile or project settings so that the application can access your repositories or create issues on your behalf. Similarly, if you connect a Facebook or Instagram account for the Social Studio, we will store the access token and the associated account ID/username for the social account. This allows us to fetch your social media profiles and to publish content you schedule from within ProjectFlow. We fetch data like repository names or social profile names as needed to display in the app. We do not use these tokens or integration data for any purpose other than providing the integration functionality that you have enabled. You can disconnect integrations at any time via the settings, which revokes our access."
                },
                ai: {
                    title: "3.8 AI Features and Usage Data",
                    text: "**ProjectFlow** includes **AI-assisted features** (e.g. the **AI Studio** for brainstorming, content generation with Google’s **Gemini 3.0** model, AI-powered search answers, and an image editing tool using **Nano Banana**). If you use these features, we may process some of your data through third-party AI services. For instance, when you request the AI to generate ideas or analyze text, the prompt or content you provide is sent to Google’s generative AI API (Gemini 3.0) in order to get a result. Likewise, if you use the image generation or editing feature, the images and prompts you provide will be sent to the Nano Banana image generation service for processing. We do not receive personal data from these AI providers about you; we only get the generated result to display to you. Internally, we log your AI feature usage (such as how many AI text tokens were processed, or how many images you generated). This AI usage data includes counts of tokens and images and timestamps, and is used to enforce usage limits or quotas and to help us understand feature usage. We do not profile users based on this data; it’s more about ensuring fair use and capacity planning. The content of your AI prompts or outputs is not used by us for any purpose other than to deliver you the result in real time, and it’s not shown to other users (unless you choose to save AI-generated content into a project for your team to see)."
                },
                preferences: {
                    title: "3.9 Preferences and Cookies",
                    text: "We remember certain **user preferences** to improve your experience. For example, you can set your preferred language, date format, time zone, theme (light/dark mode), and we track whether you have completed tutorials or onboarding flows. These preferences may be stored in your user profile and/or in your browser’s local storage on your device (so that we can apply your settings without repeatedly asking). The Service itself does not use tracking “**cookies**” for analytics or advertising purposes. However, for technical reasons, our authentication system and hosting may use essential cookies or similar technologies. For instance, Firebase Authentication might use a cookie or local storage to keep you logged in securely, and when you access the web app, your browser automatically sends your session token or cookie to authenticate you. These are strictly necessary for the Service to function and are not used to track you across other sites. Aside from these necessary mechanisms and the local storage for preferences, we do not place any third-party tracking or advertising cookies on your device. (We also currently do not use any Google Analytics or similar analytics services in the codebase, so your usage is not being tracked by third-party analytics scripts.)"
                },
                logs: {
                    title: "3.10 Technical Logs and Device Information",
                    text: "Like most online services, we automatically collect some **technical information** about your use of the Service. When you interact with our backend (e.g. calling our API or cloud functions), our servers (**Firebase Cloud Functions** and **Hosting**) will log certain information. This includes the IP address of the device you used, timestamps of requests, and possibly your device/user agent information (which can include browser type and version, OS, device model, etc.). For example, when you perform actions such as signing in or making a request to our API, Firebase logs may record your IP and request details for security and debugging. We also may capture your platform or browser information when registering passkeys (to label your passkey with the device type). We do not actively use IP or device data to profile you, but we might use it for fraud detection or security (e.g. recognizing a suspicious login). Technical logs are generally used only for monitoring and troubleshooting the Service and ensuring the security of your account."
                },
                summary: {
                    text: "In summary, the personal data we collect serves to identify you, provide you the Service’s functionality, facilitate collaboration with others, and secure your account. In general, we do not collect sensitive categories of personal data such as government IDs, financial information, or health data through ProjectFlow, and we ask that you refrain from storing such data in the platform. If you believe we have inadvertently collected sensitive data, please contact us so we can address it."
                }
            },
            usage: {
                title: "4. How We Use Your Data",
                intro: "We use the collected personal data for the following purposes, all in accordance with GDPR principles of necessity and lawfulness:",
                maintenance: {
                    title: "4.1 Providing and Maintaining the Service",
                    text: "First and foremost, we use your information to operate ProjectFlow and deliver its features to you. This includes using account and authentication data to log you in and verify your identity, using your workspace and project content data to display and synchronize the information you and your team input, and generally ensuring the app functions as intended for project management and collaboration. For example, we use your email to allow you to log in and to send you essential account communications (like verification emails or password resets), and we use the content you enter (tasks, projects, etc.) to populate your dashboard and enable you to work with your team. Without processing your data in these ways, we wouldn’t be able to provide the Service."
                },
                collaboration: {
                    title: "4.2 Workspace Collaboration and User Communications",
                    text: "If you are part of a team workspace, the data you input (like your profile name, comments, or tasks) may be shown to other authorized users in your workspace to enable collaboration. We manage permissions so that only those with proper access (e.g. members of your project or workspace) can see the relevant information. We also use your data to send you notifications within the app or via email (if you have email notifications enabled) about updates in your projects – for example, if you are assigned a task or if someone mentions you in a comment, we might alert you. These communications are part of the Service’s functionality. We also use your preferences (like language and time zone) to localize content and dates for you and to remember UI settings (e.g. keeping your chosen theme)."
                },
                ai: {
                    title: "4.3 AI-Assisted Features",
                    text: "When you engage an AI feature (text generation, AI-powered search, image editing, etc.), we use your input data to generate the requested output. For instance, if you ask the AI to brainstorm project ideas, we will send your prompt (which may include project context you provide) to our AI partner (Google) and retrieve the generated ideas, then display them to you. We do not use these prompts for any other purpose, and any temporary copies are only to facilitate the AI processing. If you choose to save AI-generated content into your project, it becomes part of your ProjectFlow content like any other user-entered data. We also track the amount of AI resources you use (token counts) to enforce any usage limits and ensure system performance. This usage tracking is primarily for internal monitoring and fair-use enforcement, not for profiling users."
                },
                social: {
                    title: "4.4 Social Media and Integration Actions",
                    text: "If you connect third-party integrations (such as posting to social media or syncing with GitHub), we use your data to perform the actions you request. For example, when you schedule a social media post via our Service, we use the content you composed and the stored access token to publish that post on the integrated platform (e.g. we send the caption and image to Facebook/Instagram’s API for publishing at the scheduled time). When you ask us to sync issues with GitHub, we will use your saved token to fetch or update issues in your GitHub repository. In short, we use the integration data solely to carry out the specific integration operations you have initiated, such as creating GitHub issues, retrieving commit info, fetching social profile data, or uploading scheduled posts. We do not post anything to your connected accounts or access your third-party data unless you specifically use an integration feature that requires it."
                },
                email: {
                    title: "4.5 Email Campaigns and Newsletters",
                    text: "If you utilize the email marketing tools within ProjectFlow, we will use the contact information and email content you provide to send out the emails as directed. For example, when you initiate an email campaign to a list of recipients, our system will take the email template/content you created and the recipient list (email addresses and any personalization fields) and send the emails via our email service provider on your behalf. We track sends, opens, clicks, and bounces to provide you with campaign statistics. Separately, if you subscribe to our own newsletter or waitlist (through our public website), we will use your email address to send you the requested newsletter updates or to follow up on the waitlist (only after you have confirmed via double opt-in). You can unsubscribe at any time, and we will then stop sending you the newsletter (your email may remain on file marked as unsubscribed to honor your opt-out)."
                },
                analytics: {
                    title: "4.6 Service Improvement and Analytics",
                    text: "Internally, we may use aggregated or de-identified information about how users use ProjectFlow to improve the Service. This can include metrics like the number of projects created, which features are used most often, or general performance information. We may look at logs or usage data to debug issues (for example, checking an error log if a function fails, which might include a user ID or action that caused it). We do not have third-party analytics trackers collecting your browsing behavior, but we do perform our own analyses on the data in our database to improve features (for instance, using project data to develop a project health scoring feature within the app, or using feedback to refine AI models). Where possible, we use aggregated data for these purposes. Any insights gained are used to enhance functionality, user experience, and security."
                },
                security: {
                    title: "4.7 Security and Fraud Prevention",
                    text: "We process personal data as needed to secure our platform and users’ accounts. This includes using authentication data and IP/device information to detect and prevent suspicious logins or account misuse. For example, we might use your IP address to determine if a login attempt is coming from an unusual location and prompt for additional verification. We keep logs of important actions (like login attempts, password changes, integration linkages) to monitor for fraudulent or malicious activity. If we detect behavior that violates our terms or could harm the Service or other users, we may use personal data (like account identifiers and content involved) to investigate and take action (such as notifying you or, if necessary, disabling an account to protect others). This processing is in our legitimate interest to keep the Service safe and reliable."
                },
                legal: {
                    title: "4.8 Legal Compliance and Enforcement",
                    text: "In certain cases, we may need to process personal data to comply with legal obligations or to defend our legal rights. For example, we may retain certain information about financial transactions (if any billing info is involved) for accounting and tax reasons, or we may process data in response to lawful requests by public authorities (such as complying with a court order to disclose content). Additionally, we might use or preserve data when necessary to enforce our Terms of Service or to handle legal disputes (for instance, logging when a user gave consent to terms, or using logs to demonstrate how an account was used if needed for a legal claim)."
                },
                decision: {
                    text: "We will only use your personal data for the purposes described above or for purposes that are compatible with those (for example, using account data to provide support if you reach out with a problem). We do not use your data for any kind of automated decision-making that produces legal or similarly significant effects on you – there are no automated credit checks, scoring, or profiling happening beyond the scope of providing the app’s features (the “project health score” and similar analytics within the app are generated from project data to help you manage projects, not to evaluate you as an individual)."
                }
            },
            legalBasis: {
                title: "5. Legal Bases for Processing (EU GDPR)",
                intro: "Under the GDPR, we must have a valid “legal basis” to process your personal data. We rely on the following legal grounds, depending on the context:",
                contract: {
                    title: "5.1 Performance of a Contract (Art. 6(1)(b) GDPR)",
                    text: "Most of our data processing is justified by the fact that it is necessary to provide you with the Service you requested – essentially, to fulfill our contract with you. When you sign up for ProjectFlow and agree to our Terms, a contract is formed for us to deliver the platform’s functionality. We need to process your account data, project content, communications, etc., as described above, in order to perform that contract. For example, using your email to create an account and log you in, or storing the tasks you enter so that you can retrieve them later, are necessary for the Service to work as intended."
                },
                consent: {
                    title: "5.2 Your Consent (Art. 6(1)(a) GDPR)",
                    text: "We rely on consent in certain situations. For instance, if you join our newsletter via the website or sign up for a waitlist, we will only send marketing emails to you if you have given consent (and confirmed it via the double opt-in email). You can withdraw that consent at any time by unsubscribing. Within the app, if in the future we introduce any feature that uses your data in a way that is not obvious or necessary for the service (for example, publishing a testimonial with your name or using your data for a new purpose), we would ask for your consent. Also, if we ever integrate optional analytics or cookies that require consent, we will obtain that. Note that when you connect third-party accounts or import data about others (like contacts for email campaigns), you are effectively instructing us to process that data – we consider that analogous to consent/contract by you, since it’s part of the service you want us to provide. If you need to collect consent from the individuals on your contact lists, that is your responsibility as the controller for that data."
                },
                interest: {
                    title: "5.3 Legitimate Interests (Art. 6(1)(f) GDPR)",
                    text: "We process some data under the basis of legitimate interests, after carefully considering the impact on your privacy. Our legitimate interests include: maintaining the security of our platform (e.g. processing IP addresses and login data to prevent fraud), improving and developing our services (e.g. analyzing how features are used in aggregate to decide on new improvements), and communicating with you about product updates or similar (unless those communications require consent under applicable law). When we rely on legitimate interest, we ensure that our interest is not overridden by your data protection rights – for example, security processing is necessary to protect all users, and does not unduly infringe on privacy, as it actually helps safeguard personal data. If you disagree with any processing based on legitimate interests, you have the right to object (see Your Rights below), and we will evaluate such requests."
                },
                obligation: {
                    title: "5.4 Legal Obligation (Art. 6(1)(c) GDPR)",
                    text: "In some cases, we may need to process data to comply with a law. This is not the main basis for most day-to-day processing on ProjectFlow, but it could apply to things like retaining transaction records for tax law, or disclosing data when a valid legal request is received. We will only do so when required by law."
                },
                summary: {
                    text: "We will clearly indicate if we ever need your personal data for a purpose that requires your consent or is outside the scope of the original purpose for which it was collected. Generally, by using ProjectFlow, you acknowledge that your personal data will be processed as needed to provide you the service (this is the contract basis). For optional uses, we will ensure there is a choice."
                }
            },
            cookies: {
                title: "6. Cookies and Tracking Technologies",
                intro: "ProjectFlow’s web application uses minimal cookies/trackers, mostly for essential functionality:",
                essential: {
                    title: "6.1 Essential Cookies/Storage",
                    text: "We use authentication tokens (which may be stored in a cookie or local storage by Firebase Auth) to keep you logged in across sessions. These are strictly necessary for secure login and session management. For instance, Firebase may use a cookie to remember that you have already signed in so you don’t have to re-authenticate on every page load. We also utilize your browser’s local storage to store certain preferences and the state of your current workspace (tenant) selection. For example, we save your active workspace ID so that if you refresh the page, the app knows which workspace’s data to load for you. Another example is storing UI preferences like theme (dark or light mode) so that we render the interface accordingly without delay. These local storage entries and essential cookies are not used to track you on other sites and do not contain sensitive personal data (typically they contain IDs or flags relevant only to our app)."
                },
                noTracking: {
                    title: "6.2 No Third-Party Marketing Cookies",
                    text: "We do not use any third-party advertising or analytics cookies on our app or site at this time. That means we are not dropping Google Analytics, Facebook Pixel, or similar tracking cookies that follow you outside of our domain. All of your interactions with ProjectFlow stay within our platform and any data analytics are done in-house or through our service providers as described, not through profiling cookies."
                },
                optional: {
                    title: "6.3 Optional Cookies",
                    text: "If in the future we introduce any cookies that are not strictly necessary (for example, to enable additional analytics or to remember preferences beyond what is needed for service), we will update this policy and, if required by law, prompt you for consent before using them."
                },
                control: {
                    title: "6.4 Your Control",
                    text: "You have the ability to control cookies through your browser settings. However, keep in mind that blocking cookies or local storage for ProjectFlow may disrupt certain functionalities – for instance, you might not be able to stay logged in or your preferences might not be saved. Since we currently only use essential cookies/storage, disabling them could effectively log you out or prevent use of the service. For our public marketing website (e.g. the homepage or blog on getprojectflow.com), we similarly aim to keep cookies to a minimum. Any newsletter signup or waitlist forms on the site might use a cookie to facilitate the double opt-in process or remember that you’ve subscribed, but again, we do not engage in third-party tracking ads. If you ever have questions about a specific cookie or piece of storage used by ProjectFlow, feel free to contact us. We want to be transparent and ensure you’re comfortable with how we handle these technologies."
                }
            },
            thirdParty: {
                title: "7. Third-Party Service Providers (Data Recipients)",
                intro: "In order to provide the Service’s functionality, we rely on several third-party services who process data on our behalf (often called “processors” or “sub-processors”). We also at times share data with third parties at your direction (such as when you use an integration). We do not sell your personal data to anyone. We only share it with: (a) service providers under strict data processing agreements, or (b) other parties when you explicitly tell us to (or as required by law). Here we outline the key third parties involved and what data might be shared with them:",
                firebase: {
                    title: "7.1 Google Firebase (Google Cloud Platform)",
                    text: "Our application is built on Google’s cloud infrastructure. We use Firebase for authentication, database, file storage, cloud functions, and hosting. Firebase Authentication stores your credentials and manages login (as mentioned earlier, this includes handling password hashing, OAuth login tokens, and multi-factor authentication). Firestore Database is our primary data store where all your project data, profile info, and other content are stored – our Firebase project is configured to use European servers (multi-region EU) for Firestore, so your data is stored in the EU by default. Firebase Storage is used for file uploads (e.g. images, documents) – those files are stored in Google Cloud Storage. By using Firebase, certain data necessarily flows through Google’s systems. For example, when you log in, Firebase will see your email and password (or OAuth token) to authenticate you; when data is stored in the database, it resides on Google’s servers (encrypted at rest). We have chosen Google Cloud’s europe-west/eu regions for data storage to help comply with EU data locality preferences. Google acts as a data processor for us, meaning they are bound to only process data under our instructions. We have a Data Processing Agreement with Google that includes the EU Standard Contractual Clauses to safeguard any transfers of personal data outside the EU. In practice, routine operations (database queries, file storage) stay within EU data centers, but Google as a company is US-based, so there is a possibility that some management or support access could involve non-EU regions. We trust Google Firebase to maintain high security standards; however, we want you to be aware that your data is hosted on Google’s cloud."
                },
                gemini: {
                    title: "7.2 Google Gemini 3.0 and Nano Banana (Generative AI Services)",
                    text: "Apart from core infrastructure, we use Google’s AI services and Nano Banana to power the AI features in ProjectFlow. When you use AI text generation or analysis (Gemini 3.0), our servers send the prompt and necessary context to the Google GenAI API and receive the results. Likewise, when you use the image editing/generation feature, our function sends the image (in base64 form) and prompt to the Nano Banana image generation endpoint to generate new images. These requests are made from our server side with our credentials, and the data (prompts, images) goes to the relevant AI models temporarily for processing. Our AI providers may process this data (and they have their own terms about not using it to train their models without consent – as of this writing Google says data submitted to their GenAI APIs is not used to improve the AI model). We do not retain the content of your AI interactions beyond delivering the result to you, except possibly in transient logs or if you save the result. Our AI providers’ handling of the data is governed by our contracts with them and their privacy commitments as processors. Nevertheless, this is a case of your data leaving our immediate environment to a third-party service in order to function. We ensure all such communications with our AI providers’ APIs are encrypted in transit. Google’s AI services are also hosted on Google Cloud; we use the European region for Gemini 3.0 requests when possible. However, it’s possible that the AI model processing might not be entirely EU-local. By using these features, you acknowledge that the content you provide in an AI prompt will be shared with our AI providers for the purpose of generating the result."
                },
                smtp: {
                    title: "7.3 Email Service (SMTP)",
                    text: "We use an email delivery service to send out system emails (such as verification emails, password resets, notifications, and the optional newsletter/waitlist emails). Currently, we have configured an SMTP server for sending emails. By default, our configuration may use an email service provided by Google (for example, sending through Gmail’s SMTP or another mail provider). Regardless of the provider, if we send an email to you, obviously your email address is processed by that provider, and the content of the email as well. For newsletter and waitlist confirmations, we handle those via Firebase Cloud Functions that send through our SMTP setup. We ensure the SMTP credentials are stored securely (environment variables) and that the email service is reputable. In the future, we might use a dedicated email delivery platform (like SendGrid, Mailgun, or similar); if so, this policy will be updated. The email service provider acts as a data processor, using your data only to send emails on our behalf."
                },
                github: {
                    title: "7.4 GitHub API",
                    text: "If you choose to integrate GitHub, we interact with GitHub’s REST API. This means that certain data will flow to/from GitHub: for example, we might send a new issue you created in ProjectFlow to GitHub (including the issue title and description), or fetch a list of your repositories and issues from GitHub to display in the app. To do this, we store your GitHub personal access token or OAuth token, which is used as an authorization header in API calls to GitHub. GitHub (a service by Microsoft, based in the US) will receive those API calls along with data like your token and any content we send (issue titles, etc.). We limit calls to only what’s needed (e.g. list repos, create/update issues, post comments). GitHub is essentially a recipient of data when you intentionally sync or create issues. They will handle that data under their own privacy policy (as it becomes part of your GitHub account data, e.g., a new issue in your repo). We do not share your ProjectFlow data with GitHub unless you initiate it via the integration, and your GitHub token is not shared with any party except being sent to GitHub’s servers for authentication as intended."
                },
                meta: {
                    title: "7.5 Facebook & Instagram (Meta) Integration",
                    text: "If you connect a Facebook Page or Instagram account for publishing social media content, we integrate with the Facebook Graph API provided by Meta Platforms. We will obtain an access token from you through Facebook’s OAuth flow (which forwards it to our app) and store that token. Using that token, we may make API requests such as retrieving your connected Facebook Pages/Instagram Business accounts, pulling basic profile information (like account name and avatar) to show in our UI, and publishing content that you have approved/scheduled. For example, when you click “Publish” on a scheduled Instagram post in ProjectFlow, our system will call the Graph API endpoint to upload the photo and caption to Instagram on your behalf. Those requests include the content of the post and are of course received by Facebook’s servers. Meta will then store and display that content on their platform per normal usage of their service. We do not send any ProjectFlow data to Meta except what’s needed for the specific action (we’re not bulk-transferring your entire project data or personal info – only the social post content or integration queries). Meta (Facebook/Instagram) might process some usage info (like logging that our app with your user ID made a request) for their own security and analytics. We treat Meta as both a processor (when they are delivering content on our instruction) and as an independent controller for any data once it’s on their side (since a published post becomes subject to Facebook/Instagram’s terms). You can revoke the Facebook/Instagram integration at any time, which invalidates the token so we can no longer access your account. Also note, when you link an account, Facebook may show you what permissions you are granting (like posting content, reading insights, etc.); we only use those permissions to implement the features you use, not for any other purpose."
                },
                other: {
                    title: "7.6 Other Integrations",
                    text: "ProjectFlow may offer other integrations or use other APIs, such as Google for sign-in (Google OAuth for login), or potentially other social networks or tools. If we use Google Sign-In, that means we receive from Google your basic profile info (name, email) and Google knows you’re using our app for authentication. For completeness: our Google Sign-In and GitHub Sign-In are handled by Firebase Auth, which means Google and GitHub are aware when you use them to log in, as part of the OAuth process. We also support login via Passkeys which uses the WebAuthn standard; that process is primarily local between your device and our server (with attestation handled by the WebAuthn API), not involving third-party services except possibly your device’s platform (e.g. Apple or Microsoft may have some involvement in storing credentials on your device, but that doesn’t send data to them about our service specifically). If we introduce any additional third-party integrations (like Google Drive, Trello, etc.), we will update this section with what data is shared. In all cases, our philosophy is that third-party integrations are opt-in and driven by your needs – we only transfer data to those services as necessary to fulfill the integration function you activated."
                },
                payment: {
                    title: "7.7 Payment Processor",
                    text: "This is only relevant if ProjectFlow charges for subscriptions or purchases. At present, ProjectFlow is in a pre-release or free beta stage (as implied by references to “Pre-Alpha” in the code). If in the future we start charging for the Service, we would integrate a payment processor (like Stripe) to handle billing. That would involve sharing minimal personal data such as your email and maybe name with the payment provider, and of course any payment information you provide would go directly to them. We would update our policy at that time to reflect the specific processor and scope of data. For now, you can assume no payment data is collected by us."
                },
                dpa: {
                    title: "7.8 Data Processing Agreements",
                    text: "We ensure that each third-party service we use is bound by appropriate data protection terms. We have Data Processing Agreements in place where needed (for example, with Google for Firebase and AI services, and we adhere to Facebook’s platform terms for protecting data). Whenever personal data is transferred out of the European Economic Area (EEA) – for example, to the United States, which is where some of these companies are based – we rely on mechanisms such as the European Commission’s Standard Contractual Clauses (SCCs) or other legally valid transfer frameworks to ensure your data has equivalent protection as in the EU. We also evaluate the data importers’ security measures and policies (for instance, Google and Microsoft have robust privacy and security compliance programs). Aside from service providers, the only other parties who might receive your personal data are:"
                },
                team: {
                    title: "7.9 Team Members and Other Users",
                    text: "As part of normal Service operation, certain data is shared with other users in your workspace or projects. For example, your display name and avatar are visible to other members of your projects; if you post a comment or complete a task, other members of that project see that activity along with your name. This is not “third-party” sharing in the legal sense (since they are also users you have chosen to collaborate with), but it is worth noting that any data you intentionally share in-app (like posting in a public workspace or sending an invite email to someone) is disseminated per your actions."
                },
                regulatory: {
                    title: "7.10 Legal or Regulatory Disclosures",
                    text: "If we are compelled by a valid legal request (such as a subpoena, court order, or binding request from law enforcement) to disclose certain data, we may do so. We will only share the data that is necessary to comply with the request and only after verifying its legitimacy. Whenever possible and legally permissible, we would inform you of such requests."
                },
                corporate: {
                    title: "7.11 Corporate Transactions",
                    text: "If our company is involved in a merger, acquisition, financing due diligence, reorganization, bankruptcy, receivership, sale of company assets, or transition of service to another provider, your data may be transferred as part of that transaction. We would ensure the new owner continues to respect your personal data in line with this privacy policy (or you would be given notice and a chance to opt out if the policies change materially)."
                },
                noSale: {
                    title: "7.12 No Sale of Data",
                    text: "We will never sell your personal information to advertisers or unrelated third parties. We do not share data with advertisers, data brokers, or social media companies for their independent use. Any integrations with social media are under your control and solely to facilitate content you want to push to those platforms, not to send your usage data to them for analytics or advertising. In summary, third parties involved in providing ProjectFlow are limited to infrastructure providers (like Google), integration endpoints (GitHub, Meta, etc., when you use them), and standard business/legal channels. All are used with your privacy in mind and under agreements that restrict their use of your data."
                }
            },
            storage: {
                title: "8. Data Storage and International Transfers",
                intro: "We are based in [Your Country], but ProjectFlow’s user base may be global. We want to be transparent about where your data is stored and processed:",
                primary: {
                    title: "8.1 Primary Storage Location - European Union",
                    text: "We have configured our cloud infrastructure to store data in the European Union. Specifically, our database is in a multi-region EU data center (Google “eur3” region) and our server functions run in europe-west3 (in Germany). This means that if you are an EU user, your data is initially stored within the EU which is aligned with GDPR preferences. Even if you are not in the EU, we use the EU region to store everyone’s data for consistency and because EU data protection standards are high."
                },
                backup: {
                    title: "8.2 Backup and Redundancy",
                    text: "The nature of cloud services means there are backups and replicas of data for reliability. Firestore (our database) keeps multiple replicas within the multi-region (e.g. data might be mirrored in multiple EU locations for fault tolerance). We also may periodically export backups of the database for disaster recovery. Those backups would also be stored on secure cloud storage (again likely in EU region unless otherwise configured). We treat backups with the same security as live data. No physical media of backups leave the cloud environment."
                },
                transfers: {
                    title: "8.3 Transfers Outside of EU",
                    text: "Despite storing data in the EU, some of our service providers are international companies (Google, Meta, Microsoft). It’s possible that some personal data might be accessed or transferred outside of the EU, for example:",
                    items: [
                        "Google, as a US-headquartered company, might need to provide support or might route certain requests (especially AI-related or authentication flows) through servers outside the EU.",
                        "When you use integrations like GitHub or Facebook, you are interacting with systems in the US (GitHub’s API and Facebook’s API servers are mainly in the US). That means, for example, an issue title or social post content you send will travel from our EU servers to those US-based services.",
                        "Our email sending may use SMTP servers that are in the US (for instance, if using a US-based email service or even Google’s Gmail servers which are global)."
                    ],
                    transfersNote: "We take steps to ensure lawful transfer for these cases. Our contracts with Google and other providers include Standard Contractual Clauses (SCCs), committing them to uphold GDPR-level protections even when data leaves the EU. For integrations like Facebook and GitHub, when you authorize the integration, you are effectively consenting to that transfer as necessary to use the feature (since the data must go to those services). We ensure any such transfer is encrypted in transit (HTTPS secure requests) and only the minimum data required is transmitted."
                },
                noGlobal: {
                    title: "8.4 No Global Access for Unneeded Reasons",
                    text: `We do not routinely access or transfer user data to any offices or personnel outside of the EU unless needed. For example, if ${COMPANY_NAME} is based in the EU, our team will access data from within the EU when performing support. If ${COMPANY_NAME} has developers or support staff in other countries, they would only access data if necessary and under strict controls. We aim to localize data access as much as possible.`
                },
                hosting: {
                    title: "8.5 Hosting and Network",
                    text: "The ProjectFlow web application is delivered through Firebase Hosting (which uses a global CDN). When you access our service, your static assets (like JavaScript, images of the interface) might be served from a server near you (which could be outside the EU) for speed, but those assets do not contain your personal data – they’re just the application code. API calls you make will be routed to our EU servers (with DNS possibly pointing you to the nearest edge location then tunneling to EU region). This ensures minimal latency while keeping data storage centralized.",
                    summary: "In summary, your data is primarily stored in the EU, but some processing and access might involve other regions, particularly the United States, due to the providers we use. We have taken measures (contracts, technical safeguards) to protect your data in those scenarios. By using ProjectFlow, you understand that your personal data may be transferred or accessed by our subcontractors in countries outside your own. We will always ensure such transfers comply with applicable laws and that your data remains protected to the standards of the GDPR. If you have questions about where specific data is stored or processed, or need more detail on cross-border safeguards, please contact us. We can provide more information or a copy of the relevant contractual terms upon request."
                }
            },
            retention: {
                title: "9. Data Retention",
                intro: "We retain your personal data only as long as necessary to fulfill the purposes for which it was collected, or as required by law.",
                account: {
                    title: "9.1 Account Data",
                    text: "If you have an account with ProjectFlow, we will keep your account information (like your email, name, and credentials) as long as your account is active. This is required to let you log in and use the Service. If you decide to delete your account or if your account is inactive for an extended period, we will initiate deletion of your personal data, subject to the considerations below. Account deletion will remove personal identifiers and authentication info from our primary systems (though some content you created might remain if it’s tied to a shared workspace, see below). We may retain your email in a suppression list if you opted out of emails, simply to ensure we respect your opt-out."
                },
                content: {
                    title: "9.2 Project and Content Data",
                    text: "All the projects, tasks, and other content you generate in ProjectFlow are stored until you or an authorized user deletes them. We do not impose a fixed expiration on user content – it’s your data, and we keep it available to you until you choose to remove it. You (or your workspace admin) can delete specific items (e.g. delete a task or file) or entire projects/workspaces. When you delete data through the app, it is typically removed from the live database immediately or after a short safety interval. However, remnants of the data might persist in our backups or logs for a while. We generally overwrite backups periodically; any logs containing data will be cleared out in accordance with our log retention (usually within a few weeks to a few months). Important: If you are part of a shared workspace, data you contributed (like tasks or comments) may be considered part of that workspace’s records. If you leave the workspace or delete your account, normally the content you created remains accessible to the remaining workspace members (at least, whatever is necessary for project history), but it may be anonymized (for example, your name might no longer be displayed, but the comment still exists as “Deleted User”). Workspace admins can contact us to request deletion of content if needed, but they might have their own reasons (legal/compliance) to retain project records. We will work with our customers to honor retention requirements."
                },
                tokens: {
                    title: "9.3 Integration Tokens",
                    text: "If you link third-party accounts, the tokens are stored as long as you keep the integration active. If you disconnect an integration or it expires, we remove or invalidate the stored token. We may keep a record that an integration was connected (for audit/security), but not the token itself after disconnection. For example, your GitHub token is stored in your profile or project document; if you remove it, it’s gone from our database. The same applies for social media tokens."
                },
                logs: {
                    title: "9.4 Logs and Metadata",
                    text: "Our system logs (which may contain IP addresses, device info, and action records) are retained for a limited period for debugging and security. Typically, we keep detailed logs for a short time (several weeks) and high-level logs a bit longer. For instance, Firebase automatically rotates logs; we might also export some logs for security audits and retain those for a few months. After that, log data is deleted or anonymized. We don’t keep logs indefinitely unless they’re part of a specific security investigation."
                },
                ai: {
                    title: "9.5 AI Usage Data",
                    text: "Information about your AI feature usage (token counts, image generation counts) is aggregated monthly. We may reset usage counters every month to implement monthly limits. We might keep historical aggregate usage (e.g. total tokens used per month) for analytics, but this typically wouldn’t be stored longer than necessary for analyzing trends. It may be retained in a non-personally identifiable way."
                },
                newsletter: {
                    title: "9.6 Newsletter/Waitlist",
                    text: "If you provided your email for our newsletter or waitlist on the public site, we retain that email until you unsubscribe or ask us to delete it. If someone doesn’t confirm the opt-in (for newsletter/waitlist), we only hold the unconfirmed request for a short time (our system sets a 4-hour expiration for confirming newsletter signups, and if not confirmed, that pending record expires and can be purged). Confirmed subscribers we hold indefinitely until removed. We include an unsubscribe link in every newsletter email, and if you click it or request to unsubscribe, we will mark your address as unsubscribed (and cease mailings). We may keep the email on a suppression list to avoid re-sending anything, unless you request complete removal."
                },
                closed: {
                    title: "9.7 Closed Accounts",
                    text: "If you delete your ProjectFlow account, we endeavor to remove or anonymize personal data associated with your account. However, there may be legal requirements to keep certain data. For example, if you ever made a purchase (in the future if payments are introduced), we might need to retain transaction records for X years for tax reasons. Or if we had a security incident, we might preserve some log evidence. In general, upon account deletion, we purge user-provided content and profile data from production, and only minimal info is retained if absolutely required (e.g. an archived record of an email consent, or data in backups that will eventually cycle out)."
                },
                backups: {
                    title: "9.8 Backups",
                    text: "Data in backups may persist until those backups are rotated out. Our backup retention schedule might be, say, 30 or 60 days (we will define this internally). That means even after you delete something, it could remain in encrypted backups for that period. We will not restore or use that data except for disaster recovery. After the retention time, backups containing the deleted data will be overwritten or deleted. We do not have infinite backups, so eventually deleted data falls off all systems.",
                    summary: "Once the retention period is over or the data is no longer needed, we will either delete it in a secure manner or anonymize it (so it can no longer be linked to an individual). We also continuously review the data we have; if we find we have data that is unnecessary, we aim to delete or anonymize it even if you haven’t specifically requested it. If you need a specific piece of personal data deleted sooner (for example, you accidentally uploaded something and want it fully expunged), please contact us. We will make good faith efforts to accommodate requests for early deletion, provided we are not required to keep that data. Keep in mind that communication data you send us (like support emails) might be retained separately in our email records. We treat those similarly – we keep them as long as needed to resolve your query and for a short while after (to build a history of support interactions), then delete if appropriate. Finally, note that residual copies might exist in system caches or distributed storage temporarily, but those will be overwritten shortly after active deletion. Our goal is that when something is deleted, it’s gone from all user-accessible areas immediately, and gone from all backups/logs within a reasonable period."
                }
            },
            security: {
                title: "10. Data Security",
                intro: "The security of your data is a priority. We implement technical and organizational measures to protect your personal data:",
                encryption: {
                    title: "10.1 Encryption",
                    text: "All network communication with ProjectFlow is encrypted in transit using HTTPS/TLS. Whether you are accessing the web app or our APIs, your data is transmitted securely to prevent eavesdropping. Additionally, our database and storage utilize encryption at rest (Google Firebase automatically encrypts data on disk on their servers). Any sensitive fields (like passwords) are further protected by hashing or encryption at the application level – for instance, passwords are hashed by Firebase Auth, and we never store them in plaintext. For particularly sensitive data like integration tokens or SMTP credentials, we rely on Firebase’s security rules and/or encryption to keep those safe (and in a real production environment we’d consider extra encryption; our code comments note that SMTP passwords should ideally be encrypted)."
                },
                access: {
                    title: "10.2 Access Control",
                    text: "Data in ProjectFlow is protected by authentication checks. You can only access your workspace’s data if you are a logged-in member of that workspace. We enforce role-based access control (Owner, Admin, Member, Viewer roles with specific permissions) to ensure users only see and do what they’re permitted. On the backend, our Firestore security rules and Cloud Function checks ensure that users cannot read or write data that they shouldn’t (these rules restrict data by user ID, workspace ID, and role privileges). Within our team, access to production data is limited to authorized personnel who need it for maintenance or support (and even then, they would access it under strict confidentiality)."
                },
                auth: {
                    title: "10.3 Authentication Security",
                    text: "We offer and encourage strong authentication options like OAuth (so you don’t have to set a weak password) and Two-Factor Authentication (2FA) via authenticator apps or Passkeys. These features add layers of security to your account. We store passkey public keys and credentials as described, which cannot be used to impersonate you without your physical device. We also monitor login attempts and can lock accounts after excessive failures to mitigate brute force attacks. If you enable 2FA, even if someone somehow got your password, they still couldn’t log in without the second factor."
                },
                network: {
                    title: "10.4 Network and Infrastructure Security",
                    text: "Our servers run on Google Cloud, which has robust security at the physical and network level. We use Cloud Functions with least privilege (each function only has access to what it needs). We keep our software dependencies updated to address security vulnerabilities. The database is not exposed directly to the internet except via our secure API endpoints with proper rules. We also employ security rules for Firestore that only allow valid authenticated requests to specific collections. We regularly review these rules for any gaps."
                },
                testing: {
                    title: "10.5 Testing and Monitoring",
                    text: "We test our application (including security rules) to catch any misconfigurations. We also log important events and monitor for anomalies. If suspicious activity is detected (like an unusual spike in usage or a known attack pattern in logs), we investigate promptly. Firebase provides tools like Security Center and alerts that we utilize. We also use role-based API keys and secrets for third-party services to ensure that if any key is compromised, its scope is limited. For example, our API calls to Google AI require our service account credentials which are securely stored, and our database access requires proper credentials that are not exposed on the client side."
                },
                team: {
                    title: "10.6 Employee and Contractor Access",
                    text: `Within ${COMPANY_NAME}, access to personal data is strictly limited. Team members who need to support the service may access data, but only what is necessary. We train our team on data privacy and security practices. All access to production systems is logged and requires authentication. We also ensure that any contractors or processors we work with are under NDAs and follow our security standards.`
                },
                prevention: {
                    title: "10.7 Preventive Measures",
                    text: "We implement measures against common web threats: e.g., we guard against SQL/NoSQL injection by using Firestore’s parameterized queries and validation; we protect against XSS by properly encoding user inputs in the UI; we mitigate CSRF by not using cookies for sensitive operations (and when we do, ensuring they are same-site or using tokens for verification). We also utilize Firebase’s built-in protections (like App Check, etc., if configured) to ensure only our app can access the backend."
                },
                isolation: {
                    title: "10.8 Data Isolation",
                    text: "Each customer’s data is logically separated by unique identifiers (tenant/workspace IDs). This means users from one workspace cannot access another workspace’s data unless they have been added. Our multi-tenancy model is designed to prevent data leakage across accounts."
                },
                backups: {
                    title: "10.9 Backups and Recovery",
                    text: "We regularly backup data to prevent loss, as mentioned, and those backups are secured. In case of any data incident (like corruption or accidental deletion), we have the ability to restore from backup to minimize impact. Access to backup locations is also restricted.",
                    summary: "While we strive to protect your data, it’s important to note that no system can be 100% secure. There is always some risk of a breach or vulnerability. In the unlikely event of a data breach that affects your personal data, we will follow applicable laws to notify affected users and authorities within the required time frames, and we will take necessary steps to mitigate the damage. You also play a role in security – we encourage you to use a strong password and keep your account credentials confidential. Enable 2FA or passkeys for added security. Be cautious of phishing attempts; we will never ask for your password via email. If you suspect any unauthorized access to your account, please change your password immediately and contact us."
                }
            },
            rights: {
                title: "11. Your Rights (GDPR and Equivalent)",
                intro: "As an individual in the European Union (or in jurisdictions with similar data protection laws), you have certain rights regarding your personal data. We are committed to honoring these rights. Below is a summary of your key rights:",
                access: {
                    title: "11.1 Right to Access",
                    text: "You have the right to request a copy of the personal data we hold about you, and to obtain information about how we process it. This is commonly known as a “data subject access request.” Upon verification of your identity, we will provide you with an overview of your data – typically, this includes data like your profile info, account details, and perhaps logs of your activities or communications. (Much of this data is accessible to you directly in the app, but you can ask for a structured report)."
                },
                rectification: {
                    title: "11.2 Right to Rectification",
                    text: "If any of your personal data is inaccurate or incomplete, you have the right to have it corrected or updated. For example, if you realize we have the wrong spelling of your name or an outdated email, you can change it in your profile or ask us to fix it. We encourage you to keep your account information up-to-date. In many cases, you can directly edit your info (like changing your display name or profile details in settings). For any fields you cannot edit, contact us and we will assist in updating them."
                },
                erasure: {
                    title: "11.3 Right to Erasure",
                    text: "Commonly known as the “right to be forgotten,” this right allows you to request deletion of your personal data. You can delete certain data yourself (for instance, remove content you’ve posted, or delete your entire account via the app’s account settings if that feature is available, or by contacting support). If you request erasure, we will delete your personal data from our systems, provided we don’t have a legal obligation or overriding legitimate interest to keep it. Note that if you’re part of a workspace, deleting your account might not auto-delete all content you created in shared projects (as those could be important to other users’ project history). In such cases, we can anonymize or pseudonymize your identity on remaining content (e.g., show “Former User” instead of your name). We’ll explain any such caveats if they apply. If you want all content you added removed, we may need to coordinate with the workspace owner. In any event, we will do our best to honor the spirit of your request and remove personal identifiers."
                },
                restrict: {
                    title: "11.4 Right to Restrict Processing",
                    text: "You can ask us to limit or “pause” the processing of your data in certain circumstances. For example, if you contest the accuracy of the data or have objected to processing (see below) and we’re evaluating your request, you can request that we restrict processing during that period. Another example is if you need data preserved for a legal claim while we’d otherwise delete it – we can mark it as restricted so it’s not actively processed, just stored. When processing is restricted, we will not use the data except for storage and will inform you before lifting the restriction."
                },
                portability: {
                    title: "11.5 Right to Data Portability",
                    text: "You have the right to receive the personal data you provided to us in a structured, commonly used, machine-readable format, and you have the right to transmit that data to another controller (for example, to another service), where technically feasible. This typically applies to data we process by automated means based on your consent or a contract. In practice, this could mean if you request it, we could export your project data or profile info in a CSV or JSON format for you to take elsewhere. We will do our best to accommodate such requests in a reasonable format. (Note: This right is more geared towards things like social media posts or photos on a platform; in our case, your project data can be quite complex. We’ll work with you to determine an appropriate way to hand over your data if needed)."
                },
                object: {
                    title: "11.6 Right to Object",
                    text: "You have the right to object to our processing of your personal data when that processing is based on our legitimate interests (Art. 6(1)(f) GDPR) or on public interest. If you object, we must stop processing your data unless we have compelling legitimate grounds that override your rights or the processing is for legal claims. For example, you can object to processing of your data for direct marketing (though we currently don’t do any marketing without consent). You could also object if we were doing an analytics profiling on legitimate interest grounds – in response, we would either stop that processing or demonstrate why we believe our grounds override your privacy (in most cases, if a user objects, we will err on the side of stopping the processing). If you object to any processing of your data, please contact us specifying what you object to and why. We will respond promptly with a decision or request for clarification."
                },
                withdraw: {
                    title: "11.7 Right to Withdraw Consent",
                    text: "If we are processing any of your data based on consent, you have the right to withdraw that consent at any time. For instance, if you consented to receive the newsletter, you can unsubscribe (withdrawing consent for that use of your email). Withdrawing consent will not affect the lawfulness of processing that was done before withdrawal. Also note that if you withdraw consent for something necessary to provide the service (say, hypothetically you had consented to let us use some data and then withdraw, but that data is needed for your account), we might have to terminate that aspect of service. We will inform you if that’s the case so you can make an informed decision."
                },
                automated: {
                    title: "11.8 Right not to be subject to Automated Decision-Making",
                    text: "You have rights related to not being subject to decisions based solely on automated processing that produce legal or similarly significant effects on you. As noted, ProjectFlow does not perform such automated decision-making (no AI is deciding something like whether you get to use the service or not without human involvement). So this right is more of a formality here – you won’t be subject to it, and thus there’s nothing to opt-out of. However, if you ever feel that an automated feature is affecting you significantly, let us know and we will review it."
                },
                contact: {
                    text: `To exercise any of these rights, you can reach out to us at ${COMPANY_EMAIL}. We may need to verify your identity to prevent unauthorized requests (for example, we wouldn’t want someone else to falsely claim they’re you and get access to your data). We strive to respond to requests within one month, as required by GDPR, and will inform you if we need more time (up to a two-month extension in complex cases). There is generally no fee for exercising your rights. However, if a request is manifestly unfounded or excessive (like repetitive requests without justification), we may charge a reasonable fee or refuse to act, as permitted by law. But we will communicate with you and try to find a reasonable solution.`
                },
                complaint: {
                    text: `If you are not satisfied with our response or believe we are processing your data unlawfully, you also have the right to lodge a complaint with a Data Protection Supervisory Authority. In Germany, for example, you could contact the data protection authority of the German state in which you reside or the Bavarian Data Protection Authority (BayLDA) if ${COMPANY_NAME} is based in Bavaria. In the EU generally, you can contact the authority in your country of residence or the authority where our company is established (if different). We would, of course, appreciate the chance to address your concerns directly first, so we encourage you to contact us with any complaints and we will do our best to resolve them. Your privacy rights are very important to us. We will not retaliate against you for exercising any of these rights, and we are here to help facilitate your control over your personal data.`
                }
            },
            children: {
                title: "12. Children's Privacy",
                text: "Our Service is not directed to individuals under the age of 16 (or higher age of digital consent in your country). We do not knowingly collect personal data from children. If you become aware that a child has provided us with personal data without parental consent, please contact us. We will take steps to remove that information and terminate the account."
            },
            changes: {
                title: "13. Changes to This Privacy Policy",
                text: "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the “Last updated” date. If the changes are material, we may notify you via email or a prominent notice on our Service. You are advised to review this Privacy Policy periodically for any changes."
            },
            contactUs: {
                title: "14. Contact Us",
                intro: "If you have any questions about this Privacy Policy or our data practices, please contact us at:",
                address: `**${COMPANY_NAME}**<br />Data Protection Officer/Privacy Team (if applicable)<br />Address: ${COMPANY_STREET}, ${COMPANY_ZIP} ${COMPANY_CITY}, Germany<br />Email: ${COMPANY_EMAIL}`,
                outro: "We will address your inquiry as promptly as possible.<br /><br />Thank you for taking the time to read our Privacy Policy. We value your privacy and are committed to protecting your personal data while providing you with a useful and secure service."
            }
        },
    },
}

export type Translations = typeof en;