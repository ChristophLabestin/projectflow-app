# Terms of Service (SaaS Agreement)

_Last updated: [publication date]_

> **DRAFT v4 – not published.** Resolve the points marked “⚠ Prüfen” (review) and remove the markers before publishing.

Summary (non-binding): ProjectFlow is an online project management service for businesses and individuals. The Free plan costs nothing; paid plans are subscriptions billed monthly or yearly and can be cancelled at any time effective at the end of the billing period. Consumers have a 14-day right of withdrawal (section 8 and Annex 1).

## 1. Parties and scope

These terms apply between Labestin Digital, owner Christoph Labestin, Ödwieser Weg 7, 84082 Laberweinting, Germany (“Provider”), and the person or business that creates an account or books a plan (“Customer”) for the use of ProjectFlow (“Service”), including the web app, iOS app and desktop app.

The Service is offered to businesses (entrepreneurs within the meaning of § 14 BGB) and to consumers (§ 13 BGB). Provisions that apply only to consumers or only to businesses are marked as such. Anyone acting for a business warrants that they are authorised to bind it. Conflicting terms of the Customer do not apply unless the Provider expressly agrees to them in text form. Individual agreements (e.g. an offer for the Organization plan) take precedence; for data protection matters, the data processing agreement (section 12) also applies.

> ⚠ Prüfen: Opening the Service to consumers is a material change from v3 (“B2B only”). Recommended to publish as `requiresAcceptance` (new consent).

## 2. Definitions

- **Workspace:** the area in which projects, tasks, flows and other content are managed. Every user has a personal workspace (for themselves only); team workspaces can be shared with others.
- **Owner:** the user who owns a workspace. Only the owner can book, change and cancel plans for that workspace.
- **Users:** persons granted access to a workspace, with roles and permissions (e.g. owner, administrator, member, guest).
- **Customer Data:** all content and data that the Customer or its users store in the Service.
- **Plan:** the booked package of features and usage limits: Free, Personal, Team or Organization (section 7.1).
- **Seat:** a booked entitlement for one full member of a team workspace. Guests do not take up a seat.
- **AI add-on:** an optional extra that unlocks the AI Features for one user without their own API key.
- **Billing period:** one month or one year, depending on the chosen billing, starting on the day of booking.
- **AI Features:** optional features that send inputs to an AI provider to generate results.

## 3. Formation of contract, accounts, trial

Registering and accepting these terms concludes a free-of-charge usage agreement for the Free plan. Registration details must be accurate. The Customer is responsible for the activities of its users and for keeping login credentials secure.

The owner books a paid plan on the order page (getprojectflow.com/en/checkout). It shows the plan, billing period, number of seats, AI add-on, total price and – during a running trial – the date of the first charge; input errors can be corrected via “Back” before ordering. By clicking “Subscribe with obligation to pay”, the Customer makes a binding offer; the contract is concluded when the Provider confirms the booking (confirmation screen or email), at the latest when the plan is activated. The Provider stores the contract text; these terms are available at any time at getprojectflow.com/en/terms. The contract languages are German and English.

New team workspaces can be tested free of charge for 14 days with the features of the Team plan. The trial ends automatically; without a booking the workspace moves to the Free plan at no cost. Personal workspaces start on the Free plan without a trial. Trials and beta features are provided without warranty and without availability commitments, to the extent permitted by law.

> ⚠ Prüfen: Is a booking confirmation sent by email (Stripe receipt / own email)? § 312f (2) BGB requires, for consumers, a confirmation of the contract including terms and withdrawal policy on a durable medium – not implemented today.

## 4. Service description and usage rights

For the term of the contract, the Provider makes the Service available as software-as-a-service, with features such as workspaces, projects, tasks, flows (structured ideation), file sharing, permissions, optional modules, AI Features and integrations, each to the extent of the chosen Subscription Plan. The Customer receives a non-exclusive, non-transferable right, limited to the contract term, to use the Service for its own purposes. The Provider may further develop the Service as long as core functionality is not materially reduced.

## 5. Customer obligations

The Customer uses the Service lawfully and in accordance with these terms, keeps credentials secret, informs the Provider without delay of misuse, ensures it is entitled to process the data it submits (in particular personal data of third parties), and is responsible for roles and permissions in its workspace. The Customer reviews AI-generated results for accuracy and permissibility on its own responsibility before using them.

## 6. Acceptable use

Prohibited in particular are:

- unlawful, discriminatory, threatening or infringing content,
- malware, attacks on security or availability, circumventing limits or access restrictions,
- automated scraping outside the provided interfaces, reverse engineering (to the extent permitted by law),
- reselling or making the Service available to third parties without consent,
- using AI Features for unlawful purposes or in breach of the AI provider's usage policies.

In case of violations the Provider may remove content or restrict access.

## 7. Fees, payment, term and cancellation

### 7.1 Plans and prices

All prices are final prices in euros. Under § 19 UStG (small business scheme), no VAT is charged or shown.

- **Free** (personal workspace): €0.
- **Personal** (personal workspace): €5 per month billed monthly, or €48 per year billed yearly (equals €4 per month).
- **Team** (team workspace): €12 per seat per month billed monthly, or €120 per seat per year billed yearly (equals €10 per seat per month).
- **AI add-on** (extra for Personal or Team, per user with AI): €10 per user per month or €120 per user per year; at most one AI add-on on Personal.
- **Organization** (team workspace): price on request, separate agreement.

The scope of each plan (e.g. number of projects, members, storage, AI allowances) follows from the plan overview on getprojectflow.com and the order page at the time of booking. Personal can only be booked for the personal workspace, Team only for team workspaces; a personal workspace cannot be converted into a team workspace. Each workspace has its own subscription.

> ⚠ Prüfen: Plan scope (Free: 3 projects, 1 person, 1 GB; Personal: unlimited projects, 25 GB; Team: 10 GB per full member, min. 25 GB; AI add-on allowance) is marked “changeable before live” in code – either fix it here or make sure the plan overview is archived as the service description.

### 7.2 Payment and invoices

Fees are payable in advance for each billing period, first on booking or – during a running trial – on the trial end date shown on the order page, and thereafter on the same day of the following month or year. Payment is processed by the payment service provider Stripe (Stripe Payments Europe, Ltd., Ireland) using the payment methods offered on the order page. The Customer authorises the Provider to collect the recurring fees and prorated amounts under section 7.5 from the stored payment method. Invoices are provided electronically (by email and in ProjectFlow under Settings → Billing). The owner can change the payment method and billing details at any time in the customer portal.

### 7.3 Term and renewal

The term equals the chosen billing period (one month or one year) and starts on booking or at the end of the trial. It renews automatically for the same period unless cancelled beforehand.

For consumers, the following applies instead: after the first twelve months, a yearly contract continues for an indefinite period and can then be cancelled at any time with one month's notice. The Provider refunds, pro rata, fees already paid for the period after such cancellation takes effect.

> ⚠ Prüfen: § 309 no. 9 BGB. Technically, Stripe always renews yearly subscriptions for 12 months; the one-month notice and pro-rata refund for consumers would have to be handled manually (Stripe dashboard) until a technical solution exists. Alternative: switch consumers' yearly subscriptions to monthly billing on renewal.

### 7.4 Cancellation

The Customer can cancel any paid plan at any time without notice, effective at the end of the current billing period (for consumers, where applicable, with one month's notice under section 7.3). Cancellation is possible

- via the “Cancel contracts here” button in ProjectFlow under Settings → Billing (for the workspace owner),
- in the customer portal (“Manage billing”), or
- in text form to [hello@getprojectflow.com](mailto:hello@getprojectflow.com).

The plan remains fully usable until the end of the billing period; the cancellation can be withdrawn until then. Afterwards, the workspace moves to the Free plan (section 7.8). There is no pro-rata refund for the current billing period unless these terms provide otherwise. Cancelling the plan does not close the account; the account can be deleted at any time under Settings → Account.

Both parties' right to terminate for good cause remains unaffected. The Provider may terminate a paid plan with 60 days' notice and then refunds, pro rata, fees paid in advance for the period after the end of the contract.

> ⚠ Prüfen: § 312k BGB requires, for consumers, a cancellation button that is “permanently available and directly and easily accessible”, a confirmation page with a “cancel now” button and an immediate confirmation in text form. Implemented: a “Cancel contracts here” button in the billing settings (after sign-in) that opens the cancellation flow of the Stripe customer portal directly (button there: “Cancel subscription”). Open: a cancellation page on the website without sign-in, the “cancel now” label, and a confirmation email stating receipt date and contract end.

### 7.5 Seats, AI add-on and plan changes

Seats are booked capacity of a team workspace. The number of full members may not exceed the number of booked seats; guests are free. Seats are never added automatically.

- **More seats or AI add-ons** take effect immediately once the prorated amount for the rest of the current billing period has been paid; this amount is invoiced immediately and collected from the stored payment method. If the payment fails, the previous number stays unchanged.
- **Fewer seats or AI add-ons** take effect at the end of the current billing period; until then they remain usable, and there is no pro-rata refund. Seats cannot be reduced below the current number of full members, AI add-ons not below the number of assigned users.
- **Switching the billing period** (monthly ↔ yearly) takes effect immediately; fees already paid for the unused part are credited pro rata. The Customer moves from a paid plan to the Free plan by cancelling (section 7.4).

> ⚠ Prüfen: The interval switch is billed differently depending on the path – on the order page immediately (`always_invoice`), in the Stripe customer portal as a credit on the next invoice (`create_prorations`). The wording covers both; consider unifying technically.

### 7.6 Price changes

Towards businesses, the Provider may change prices with at least 30 days' notice in text form, effective from the start of the next billing period; the Customer may cancel at no extra cost until the change takes effect. Towards consumers, price increases only take effect if the consumer expressly agrees; if they do not, the contract continues at the previous price and the Provider may terminate it under section 7.4. Price reductions apply from the next billing period without consent.

> ⚠ Prüfen: Validity of the price change clause towards businesses (§ 307 BGB) and the consent model for consumers (BGH XI ZR 26/20 on deemed consent).

### 7.7 Late payment and suspension

If a payment fails, the Provider or Stripe informs the owner by email and retries the charge over several days; during this time the plan remains usable. The owner can update the payment method at any time in the customer portal. If payment is still not received after these retries, the subscription ends and the workspace moves to the Free plan (section 7.8); no data is deleted as a result. The Customer can book the plan again at any time. Towards businesses, statutory default interest applies (§ 288 BGB). Further rights of the Provider, in particular suspension for violations under section 6, remain unaffected.

> ⚠ Prüfen: Duration and number of retries (Stripe Smart Retries / “Revenue recovery”) are not configured yet (launch checklist). Consider naming a concrete period (e.g. “up to 14 days”). A reminder before downgrading is advisable towards consumers.

### 7.8 Data after a paid plan ends and data export

When a paid plan ends (cancellation, failed payment or end of trial), the workspace continues on the Free plan; Customer Data is not deleted as a result. The Free plan's limits apply: projects above the limit (all except the three most recently edited) become read-only but remain readable and exportable; no new members can be added and no files above the storage limit can be uploaded; AI add-ons end. Booking again makes all projects editable again.

The Customer can download its data at any time – including after a paid plan has ended – under Settings → Account → “Export data” in a machine-readable format (JSON), and download files individually. Customer Data is deleted when the owner deletes the workspace or the Customer deletes their account, but no later than [⚠ period] after the contract as a whole has ended, unless statutory retention obligations apply.

> ⚠ Prüfen: v3 provided “30 days export, then deletion”. Technically nothing is deleted after a paid plan ends (Free continues). Decide whether and when data of inactive Free accounts is deleted; the export (`exportMyData`) is capped at 100 workspaces / 300 projects per workspace / 500 entries per collection – check whether that is sufficient as a complete export for large team workspaces.

## 8. Right of withdrawal for consumers

Consumers have a statutory right of withdrawal as set out in the withdrawal policy in Annex 1; Annex 2 contains a model withdrawal form. Businesses have no right of withdrawal.

On the order page, the Customer expressly requests that the Provider begin performance before the withdrawal period ends and confirms their knowledge that, in the event of withdrawal, they owe compensation for the service provided until then and that the right of withdrawal expires once the contract has been fully performed. The Provider stores this declaration with its time and text version.

> ⚠ Prüfen: Classification of ProjectFlow as a “digital service” (§ 327 (2) sentence 2 BGB) with expiry under § 356 (4) BGB and compensation under § 357a (2) BGB (rather than § 356 (5) for digital content). The checkbox is currently shown to all buyers (including businesses), as the order page does not ask whether the buyer is a consumer or a business.

## 9. Support, maintenance and availability

The Provider provides support by email at [hello@getprojectflow.com](mailto:hello@getprojectflow.com) within the scope of the chosen plan. Maintenance may cause brief interruptions. The Provider endeavors to provide high availability; additional availability commitments or credits exist only if expressly agreed.

## 10. AI Features

AI Features process the inputs initiated by the User through an AI provider (see the [Privacy Policy](/en/privacy)). AI results may be incorrect, incomplete or unsuitable and do not replace professional, legal or other review. The Customer is responsible for using the results. The Provider may change AI Features and providers or set usage limits.

## 11. Third-party services and integrations

Integrations (e.g. GitHub, custom file storage, API/MCP) are additionally subject to the terms of the respective third party. The Provider is not responsible for their availability or content.

## 12. Data protection

Personal data is processed in accordance with the [Privacy Policy](/en/privacy). Where the Provider processes personal data on behalf of the Customer, the data processing agreement (Art. 28 GDPR) applies and is made available on request at [hello@getprojectflow.com](mailto:hello@getprojectflow.com). Data is stored primarily in the EU (Firestore eur3, cloud functions europe-west3).

## 13. Customer Data, confidentiality and security

Rights in Customer Data remain with the Customer. The Customer grants the Provider the right to process this data to provide the Service. Each party keeps the other party's confidential information confidential. The Provider takes appropriate technical and organizational measures to protect data and notifies of personal data breaches as required by law. The Provider owes backups only within its standard procedures; the Customer should export important data itself.

## 14. Intellectual property and feedback

All rights in the Service, the software and the ProjectFlow brand remain with the Provider. The Provider may use feedback and suggestions for improvement without compensation.

## 15. Warranty

The Provider provides the Service with due care. Defects must be reported without delay and will be remedied within a reasonable period. Towards businesses, strict liability for defects existing at the time of contract (§ 536a (1) BGB) is excluded. Consumers have the statutory warranty rights for digital products (§§ 327 et seq. BGB). Free trials and beta features are provided without warranty to the extent permitted by law.

> ⚠ Prüfen: Update obligation (§ 327f BGB) and burden-of-proof rules for consumers; warranty exclusion for the free Free plan.

## 16. Liability

The Provider is liable without limitation for intent, fraudulent concealment, injury to life, body or health, under the Product Liability Act and where a guarantee has been given. Towards consumers, the Provider is also liable without limitation for gross negligence. For simple negligence, it is liable only for breach of essential contractual obligations, limited to the damage typically foreseeable for this type of contract. Towards businesses, the total liability of both parties, except in the cases above, is limited to the fees paid or owed by the Customer in the twelve months before the damaging event. For data loss, the Provider is liable only to the extent that the damage would also have occurred had the Customer backed up data regularly and appropriately. Liability under mandatory law remains unaffected.

> ⚠ Prüfen: Liability for gross negligence towards businesses (not expressly included in v3) and validity of the 12-month cap (§ 309 no. 7 BGB applies to consumers, hence B2B only).

## 17. Changes to the Service and the terms

The Provider may further develop the Service as long as the agreed core functionality is not materially reduced; changes to digital products towards consumers are made only in accordance with § 327r BGB.

The Provider announces changes to these terms at least 30 days before they take effect, by email or in the Service. Towards businesses, the changes are deemed accepted if the Customer does not object within this period; the notice will point out this consequence, and the Customer may terminate effective when the change takes effect. Towards consumers, changes affecting the service or the fees only take effect with express consent (in ProjectFlow: consent the next time the app is opened).

> ⚠ Prüfen: Deemed consent towards businesses (§ 307 BGB) and which changes require consumer consent.

## 18. Compliance, export control and sanctions

The Customer complies with the laws applicable to its use, including export and sanctions rules, and does not use the Service in sanctioned countries or for sanctioned persons.

## 19. Governing law, jurisdiction and dispute resolution

German law applies, excluding the UN Convention on Contracts for the International Sale of Goods (CISG). Towards consumers, this choice of law applies only insofar as it does not deprive them of the protection afforded by mandatory provisions of the law of the country in which they have their habitual residence. If the Customer is a merchant (Kaufmann), a legal entity under public law or a special fund under public law, the exclusive place of jurisdiction is the Provider's seat in Laberweinting, Germany.

The Provider is neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.

> ⚠ Prüfen: The jurisdiction clause only applies to merchants (§ 38 ZPO); notice under § 36 VSBG (mandatory only from 11 employees, recommended voluntarily).

## 20. Miscellaneous

If any provision is invalid, the remaining provisions remain valid. Amendments and additions require text form. The Customer may assign rights under this contract only with the Provider's consent. Contact: [hello@getprojectflow.com](mailto:hello@getprojectflow.com).

## Annex 1: Withdrawal policy

_Applies to consumers only._

### Right of withdrawal

You have the right to withdraw from this contract within fourteen days without giving any reason.

The withdrawal period is fourteen days from the day the contract is concluded.

To exercise your right of withdrawal, you must inform us (Labestin Digital, owner Christoph Labestin, Ödwieser Weg 7, 84082 Laberweinting, Germany, email: [hello@getprojectflow.com](mailto:hello@getprojectflow.com)) of your decision to withdraw from this contract by means of a clear statement (e.g. a letter sent by post or an email). You may use the attached model withdrawal form, but this is not mandatory.

To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired.

### Effects of withdrawal

If you withdraw from this contract, we shall reimburse to you all payments received from you without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.

If you requested to begin the performance of services during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated to us your withdrawal from this contract, in comparison with the full coverage of the contract.

### Special notes

Your right of withdrawal expires when we have fully performed the service and only began performance after you gave your express consent and at the same time acknowledged that you lose your right of withdrawal once we have fully performed the contract.

If you book during a running free trial, nothing is charged until the trial ends; withdrawing during that time costs you nothing.

_End of withdrawal policy_

> ⚠ Prüfen: The German text follows the statutory model (Annex 1 to Art. 246a § 1 (2) sentence 2 EGBGB, notes 1, 2 and 5 for services); the model's protective effect only applies if it is adopted unchanged – the trial sentence and the “Special notes” heading are additions. The German version governs; this English version is a translation.

## Annex 2: Model withdrawal form

(Complete and return this form only if you wish to withdraw from the contract.)

To: Labestin Digital, owner Christoph Labestin, Ödwieser Weg 7, 84082 Laberweinting, Germany, email: [hello@getprojectflow.com](mailto:hello@getprojectflow.com)

- I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract for the provision of the following service (*): ProjectFlow, plan ______, workspace ______
- Ordered on (*) ______ / received on (*) ______
- Name of consumer(s): ______
- Address of consumer(s): ______
- Email address of the ProjectFlow account: ______
- Signature of consumer(s) (only if this form is notified on paper): ______
- Date: ______

(*) Delete as appropriate.
