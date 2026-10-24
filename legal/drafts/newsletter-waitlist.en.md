# Draft: Privacy – newsletter & waitlist (next version)

> **Status: draft, not published.** 2026-10-24. Replaces section 12 of `legal/privacy.en.md` and amends sections 3, 14
> and 16. Items marked **[REVIEW]** need the owner's (or legal counsel's) confirmation. German master: `newsletter-waitlist.de.md`.

## Change in section 3 (website)

Delete the last sentence of section 12 ("There are currently no such forms on getprojectflow.com itself.") and add to section 3:

**Waitlist and newsletter.** On getprojectflow.com you can join the waitlist or subscribe to the newsletter. The forms send
your details directly to our servers (Cloud Functions, Frankfurt region); details in section 12.

## New section 12: Newsletter, waitlist, contact requests

**What we process.** When you sign up for the waitlist or the newsletter on the website, in the app (Settings →
Notifications) or following our invitation, we process your email address, optionally your name, for the waitlist
optionally your intended use, the chosen language and the source of the sign-up. If you are signed in to the app, we link
the subscription to your account.

**Purpose and legal basis.** Waitlist: notifying you when access is available and launch information. Newsletter: news about
ProjectFlow features, tips and insights (about once or twice a month). Both only with your consent (Art. 6(1)(a) GDPR).
Waitlist and newsletter are separate consents.

**Double opt-in and proof.** After signing up you receive an email with a confirmation link (valid for 48 hours). We only
send content after you confirm. To be able to prove your consent we store the time of sign-up and confirmation, IP address,
browser identifier (user agent) and the version and wording of the consent text (Art. 6(1)(c) with Art. 7(1) GDPR and
Art. 6(1)(f) GDPR, legitimate interest in proof). Unconfirmed sign-ups are deleted after 30 days. When you confirm the
waitlist, the confirmation page lets you also subscribe to the newsletter; your address is already verified then, so no
second email is needed.

**Delivery and evaluation.** Emails are sent via Amazon Simple Email Service (Amazon Web Services EMEA SARL, EU/Stockholm
region) or, as a fallback, Google Workspace (Google Ireland Limited). We only record whether an email was delivered or
bounced and whether someone complained, to stop sending to invalid addresses (Art. 6(1)(f) GDPR). **We do not track opens or
clicks** (no tracking pixels, no redirect links). **[REVIEW: keep only while tracking stays off.]**

**Withdrawal.** You can withdraw your consent at any time with effect for the future: via the unsubscribe link in every
email (including one-click unsubscribe in your mail app), in the app under Settings → Notifications, or by email to
hello@getprojectflow.com. Processing carried out before the withdrawal remains lawful.

**Retention.** Until withdrawal; waitlist entries at the latest 6 months after ProjectFlow becomes generally available
**[REVIEW: period; the deletion run is not automated yet]**. After a withdrawal we keep proof of consent and withdrawal for up
to 3 years (limitation period for possible claims, § 195 BGB) **[REVIEW]**; addresses that no longer want any email or are
undeliverable are kept on a suppression list.

**Contact requests.** If you write to us, we process your details to handle the request (Art. 6(1)(b) or (f) GDPR) and
generally delete them up to 12 months after the last correspondence.

## Addition to section 14 (recipients)

- **Amazon Web Services EMEA SARL** (Luxembourg; Amazon Web Services, Inc., USA): email delivery (Amazon SES, region
  eu-north-1 Stockholm), delivery and bounce notifications. **[REVIEW: DPA with AWS signed? Add AWS to section 15 (DPF/SCC).]**

## Addition to section 16 (retention)

- Newsletter/waitlist: until withdrawal; unconfirmed sign-ups 30 days; proof of consent up to 3 years after withdrawal.

## Consent texts (shown in the form and stored as proof, version `2026-10-24`)

- **Waitlist:** "I want to join the ProjectFlow waitlist and be notified by email when I get access. I can withdraw my
  consent at any time, e.g. via the unsubscribe link in every email."
- **Newsletter:** "I want to receive the ProjectFlow newsletter with product news and tips by email (about once or twice a
  month). I can withdraw my consent at any time, e.g. via the unsubscribe link in every email."
