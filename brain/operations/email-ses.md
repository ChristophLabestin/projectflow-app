# E-Mail-Versand über Amazon SES

Stand 2026-10-24. Alle System-Mails (Einladungen, Benachrichtigungen, Rechtsdokument-Jobs, Waitlist,
Newsletter-Opt-in, Kontaktformular, Admin-MCP) gehen über `sendEmail()` in `functions/src/email.ts`.
Workspaces mit eigenem SMTP (Einstellungen → SMTP, `tenants/{id}/secrets/smtp`) senden weiter über
ihren Server.

## Architektur

```
sendEmail(to, subject, html, { type, unsubscribeUrl, tenantId })
  1. email_suppressions/{sha256(email)} aktiv?  → nicht senden ({ transport: 'suppressed' })
  2. Tenant-SMTP konfiguriert?                  → nodemailer (unverändert)
  3. EMAIL_TRANSPORT=ses + Keys gesetzt         → SES API v2 (eu-north-1), Config-Set, Tags, Rate-Limit, Retries
     sonst / EMAIL_TRANSPORT=smtp               → System-SMTP (SMTP_HOST/PORT/USER/PASS/FROM)
     SES lehnt Empfänger ab (Sandbox) + EMAIL_SMTP_FALLBACK=true → System-SMTP

SES Config-Set projectflow-default → SNS projectflow-ses-events → sesEvents (Signatur + Topic-Allowlist)
  Bounce Permanent / Complaint → email_suppressions (active)   Transient → nach 3 in 7 Tagen
  alle Events → email_stats/{YYYY-MM-DD}.counts / .byType     (Admin: email.stats)
Benachrichtigungs-Mails → List-Unsubscribe (RFC 8058) → emailUnsubscribe → notificationPrefs.email.<kategorie> = false
```

| Teil | Datei |
|---|---|
| Versand, SES-Client, Rate-Limit (GetAccount → MaxSendRate), Retries (3, Backoff) | `functions/src/email.ts` |
| Reine Logik (Suppression, SES-Events, SNS-Signatur, Tokens, Header) | `functions/src/email-logic.ts` |
| Layouts mit Impressum (System-Mail, Benachrichtigung) | `functions/src/email-template.ts` |
| SNS-Webhook `sesEvents`, `emailUnsubscribe`, `setSuppression` | `functions/src/email-events.ts` |
| Admin-Aktionen `email.suppressions.list/add/remove`, `email.stats`, `email.test` | `functions/src/admin-console/modules/email.ts` |
| Nicht-geheime Konfiguration | `functions/.env.projectflow-labestin` |
| Tests | `functions/scripts/unit/email.test.js` (`npm run test:unit`) |

Mail-Typen (SES-Tag `type`, Tag `category` = `transactional`/`list`): `invitation`, `notification` (list),
`legal`, `waitlist`, `newsletter` (list, für spätere Rundmails), `newsletter-optin`, `contact`, `admin`, `system`.
Neue Absender-Funktionen brauchen `runWith({ secrets: EMAIL_SECRETS })` bzw. `secrets: EMAIL_SECRETS` (v2),
sonst fehlen die Keys zur Laufzeit und der Versand fällt auf SMTP zurück.

Firestore (nur Server, Rules `allow false`): `email_suppressions/{id}` {email, active, reason bounce|complaint|manual,
detail, source ses|admin, mailType, softBounces[], events, by, createdAt, updatedAt}, `email_stats/{day}`,
`admin_config/email.unsubscribeKey` (HMAC-Schlüssel für Abmeldelinks, wird beim ersten Gebrauch erzeugt).

## Einrichtung (einmalig)

**Konto/Region (2026-10-24):** neues AWS-Konto 173433120074 („Lift Off Soon“), Region `eu-north-1` (Stockholm, EU) — die Konsole ließ sich nicht auf Frankfurt halten. Identität `mail.getprojectflow.com` ist dort angelegt (Easy DKIM RSA-2048, MAIL FROM `bounce.mail`).

Der Bestand im AWS-Konto (frühere Waitlist-Einrichtung) wird weiterverwendet: vorhandene Identitäten in
eu-north-1 prüfen; eine bereits verifizierte E-Mail-Identität des Users kann bleiben. Im DNS von
getprojectflow.com gab es am 2026-10-24 keine SES-Einträge (Root: Google Workspace MX, SPF
`include:_spf.google.com`, DMARC `p=none`).

**Warum `mail.getprojectflow.com` statt der Root-Domain:** eigene Reputation für App-Mails, keine
Änderung am SPF-Record der Google-Workspace-Postfächer, DMARC für App-Mails separat verschärfbar.

### 1. SES-Identität (AWS-Konsole, Region Europe (Stockholm) eu-north-1, AWS-Konto 173433120074 „Lift Off Soon“) — klickbar ohne Keys
1. SES → Configuration → Identities → Create identity → Domain `mail.getprojectflow.com`.
2. „Use a custom MAIL FROM domain“: `bounce` (ergibt `bounce.mail.getprojectflow.com`),
   „Behavior on MX failure“: Use default MAIL FROM.
3. Verifying your domain: Easy DKIM, RSA_2048_BIT, DKIM signatures enabled. Create identity.
4. SES zeigt 3 DKIM-CNAMEs + MAIL-FROM-Einträge → in IONOS eintragen (Schritt 2).

### 2. DNS bei IONOS (getprojectflow.com → DNS → Eintrag hinzufügen; Hostname relativ zur Domain)

| Typ | Hostname (IONOS) | Wert | TTL |
|---|---|---|---|
| CNAME | `547pvw3cqsoqrgtttcupfwvqnwlv2hld._domainkey.mail` | `547pvw3cqsoqrgtttcupfwvqnwlv2hld.dkim.amazonses.com` | 1 h |
| CNAME | `hnoyfbv3gvym5qzr4d7inctwm3zq4qzf._domainkey.mail` | `hnoyfbv3gvym5qzr4d7inctwm3zq4qzf.dkim.amazonses.com` | 1 h |
| CNAME | `zdtumbluxesorfd2zumubxiokplprkj7._domainkey.mail` | `zdtumbluxesorfd2zumubxiokplprkj7.dkim.amazonses.com` | 1 h |
| MX | `bounce.mail` | `feedback-smtp.eu-north-1.amazonses.com`, Priorität 10 | 1 h |
| TXT | `bounce.mail` | `v=spf1 include:amazonses.com ~all` | 1 h |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:hello@getprojectflow.com; adkim=r; aspf=r` | 1 h |

DKIM-Tokens aus der SES-Konsole (Identity → Authentication → Publish DNS records), Stand 2026-10-24.
DMARC nach 2–4 Wochen ohne Fehler in den Reports auf `p=quarantine` anheben. Prüfen:
`dig +short CNAME 547pvw3cqsoqrgtttcupfwvqnwlv2hld._domainkey.mail.getprojectflow.com`, `dig +short MX bounce.mail.getprojectflow.com`.
SES meldet „Verified“ für DKIM und MAIL FROM meist innerhalb einer Stunde (bis 72 h).

### 3. Konto-Suppression, SNS, Configuration Set — klickbar ohne Keys
1. SES → Configuration → Suppression list → Account-level suppression: **Bounces und Complaints** aktivieren.
2. SNS (eu-north-1) → Topics → Create topic → Standard, Name `projectflow-ses-events`. Die ARN
   `arn:aws:sns:eu-north-1:173433120074:projectflow-ses-events` ist bereits in `functions/.env.projectflow-labestin`
   (`SES_SNS_TOPIC_ARNS`) eingetragen; weicht der echte ARN ab, dort ändern. `sesEvents` muss vor Schritt 4 deployt sein,
   sonst schlägt die Bestätigung der Subscription fehl.
3. SES → Configuration sets → Create set `projectflow-default`: Reputation metrics an, Suppression „Use account-level
   settings“. Event destinations → Add destination → Event types: Sends, Rejects, Bounces, Complaints, Deliveries,
   Delivery delays, Rendering failures → Destination SNS → Topic `projectflow-ses-events`.
4. SNS → Topic → Create subscription → Protocol **HTTPS**, Endpoint
   `https://europe-west3-projectflow-labestin.cloudfunctions.net/sesEvents`, Raw message delivery **aus**.
   Die Function bestätigt automatisch; Status muss „Confirmed“ werden (Log: `sesEvents: subscription … confirmed`).
5. Identity `mail.getprojectflow.com` → Configuration set → Default configuration set `projectflow-default`.

### 4. IAM-User mit minimaler Policy (macht der User; Keys nie im Chat)
1. IAM → Policies → Create policy → JSON → Name `ProjectFlowSesSend`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendAsProjectFlow",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": [
        "arn:aws:ses:eu-north-1:173433120074:identity/*",
        "arn:aws:ses:eu-north-1:173433120074:configuration-set/projectflow-default"
      ],
      "Condition": { "StringLike": { "ses:FromAddress": "*@mail.getprojectflow.com" } }
    },
    {
      "Sid": "QuotaAndSuppression",
      "Effect": "Allow",
      "Action": ["ses:GetAccount", "ses:GetSuppressedDestination", "ses:PutSuppressedDestination", "ses:DeleteSuppressedDestination"],
      "Resource": "*"
    }
  ]
}
```
   `identity/*` ist nötig, weil SES in der Sandbox auch die Empfänger-Identität autorisiert; die Condition begrenzt
   den Absender auf `@mail.getprojectflow.com`.
2. IAM → Users → Create user `projectflow-ses-sender` (kein Konsolenzugang) → Attach policy `ProjectFlowSesSend`.
3. User → Security credentials → Create access key → „Application running outside AWS“ → Key ID + Secret kopieren.
4. Im Terminal (Repo-Root), interaktiv, jeweils Wert einfügen:
```bash
firebase functions:secrets:set AWS_SES_ACCESS_KEY_ID --project projectflow-labestin
```
```bash
firebase functions:secrets:set AWS_SES_SECRET_ACCESS_KEY --project projectflow-labestin
```
   Erst wenn beide Secrets existieren, lässt sich der SES-Code nach main mergen und deployen: Firebase bricht den
   Deploy jeder Function ab, die ein nicht existierendes Secret bindet (betrifft auch `adminApi`/`adminMcp`).
   Neue Secret-Versionen (Key-Rotation) greifen erst nach erneutem Deploy der Mail-Functions (Liste unten).
   Der Code behandelt den Wert `unset` als „nicht gesetzt“ (Fallback SMTP), falls Secrets vorab als Platzhalter angelegt werden.

Functions mit `EMAIL_SECRETS`: `sendInvitation`, `onNotificationCreated`, `onLegalMailJobCreated`,
`processLegalMailJobs`, `requestWaitlist`, `requestNewsletterSignup`, `sendContactFormEmail`, `adminApi`, `adminMcp`.

```bash
firebase deploy --only functions:sendInvitation,functions:onNotificationCreated,functions:onLegalMailJobCreated,functions:processLegalMailJobs,functions:requestWaitlist,functions:requestNewsletterSignup,functions:sendContactFormEmail,functions:adminApi,functions:adminMcp,functions:sesEvents,functions:emailUnsubscribe --project projectflow-labestin
```

### 5. Tests in der Sandbox
1. SES → Identities → Create identity → Email address (eigene Adresse) → Bestätigungslink klicken.
2. Admin-Konsole bzw. `adminApi` `email.test` an die eigene Adresse → Mail kommt an, Header zeigen
   `dkim=pass header.d=mail.getprojectflow.com`, `spf=pass smtp.mailfrom=bounce.mail.getprojectflow.com`.
3. `email.test` an `bounce@simulator.amazonses.com` → nach Sekunden Eintrag in `email_suppressions`
   (reason bounce) und `email_stats/<heute>.counts.bounce`; `complaint@simulator.amazonses.com` → reason complaint;
   `success@simulator.amazonses.com` → nur `counts.delivery`. Danach die Simulator-Einträge in der Admin-Konsole entfernen.
4. Erneuter `email.test` an eine unterdrückte Adresse → Ergebnis `{ transport: 'suppressed' }`.
5. Benachrichtigungs-Mail: Footer-Link „Diese E-Mails abbestellen“ → Bestätigungsseite → Button → Kategorie in
   Einstellungen → Benachrichtigungen ist aus. Gmail zeigt „Abbestellen“ neben dem Absender (One-Click-POST).

### 6. Antrag auf Production Access
SES → Account dashboard → „Request production access“. Felder:
- **Mail type:** Transactional
- **Website URL:** https://getprojectflow.com
- **Additional contacts:** hello@getprojectflow.com
- **Preferred contact language:** English
- **Use case description** (EN, so ins Formular):

> ProjectFlow (https://getprojectflow.com, app at https://app.getprojectflow.com) is a project management SaaS for small teams, operated by Christoph Labestin, Frühlingsstraße 8, 84082 Laberweinting, Germany. We use Amazon SES in eu-north-1 only for transactional email from our verified domain mail.getprojectflow.com (Easy DKIM, custom MAIL FROM bounce.mail.getprojectflow.com, SPF and DMARC published).
>
> Email types: (1) workspace invitations that a workspace owner sends to a specific person, (2) activity notifications for registered users (task assigned, mentions, due dates), (3) account, billing and legal notices to registered users (e.g. updated Terms of Service or Privacy Policy), (4) double-opt-in confirmations for our waitlist/newsletter and contact-form copies to our own inbox. We do not send marketing campaigns, do not buy, rent or scrape lists, and never email anyone who has not signed up or been explicitly invited by a workspace owner.
>
> Recipients: users who registered an account (email verified at sign-up) and people a workspace owner invited by email address. Invitations are single messages per invite, rate-limited and tied to the inviting account.
>
> Unsubscribe and preferences: notification emails can be turned off per category in Settings → Notifications; they carry an RFC 8058 List-Unsubscribe / List-Unsubscribe-Post one-click header and an unsubscribe link in the footer. Every email contains our imprint and a reply-to address (hello@getprojectflow.com) that is read by a person.
>
> Bounces and complaints: a configuration set publishes Bounce, Complaint, Delivery and Reject events to an SNS topic; an HTTPS endpoint verifies the SNS signature and writes hard bounces and complaints (and repeated soft bounces) to our suppression list. Every send is checked against this list before calling SES, and the SES account-level suppression list is enabled for bounces and complaints. We monitor bounce and complaint rates daily in our admin console and pause sending if they approach 2% bounces or 0.05% complaints.
>
> Volume: we are in early launch. We expect fewer than 1,000 emails per day (typically 50–300) in the first months, growing gradually with the user base; a daily quota of 10,000 and 10 messages per second would be ample. Peak sends are spread by our own rate limiter that follows the account's maximum send rate.

- **Deutsch (zum Gegenlesen, nicht einreichen):** ProjectFlow ist eine Projektmanagement-SaaS für kleine Teams,
  betrieben von Christoph Labestin (Impressum s. o.). SES in eu-north-1 nur für transaktionale Mails von der
  verifizierten Domain mail.getprojectflow.com (DKIM, eigene MAIL-FROM-Domain, SPF, DMARC). Mail-Arten: Einladungen
  durch Workspace-Owner an konkrete Personen, Aktivitäts-Benachrichtigungen an registrierte Nutzer, Konto-, Billing-
  und Rechtshinweise an registrierte Nutzer, Double-Opt-in-Bestätigungen (Waitlist/Newsletter) und Kopien des
  Kontaktformulars ans eigene Postfach. Kein Marketing, keine gekauften Listen. Empfänger: registrierte Nutzer
  (E-Mail bei Registrierung bestätigt) und explizit Eingeladene. Abmeldung: Benachrichtigungen pro Kategorie in den
  Einstellungen abschaltbar, One-Click-List-Unsubscribe-Header und Footer-Link, Impressum und betreute Reply-To-Adresse
  in jeder Mail. Bounces/Beschwerden: Config-Set → SNS → signaturgeprüfter HTTPS-Endpunkt → eigene Suppression-Liste,
  Prüfung vor jedem Versand, zusätzlich SES-Konto-Suppression; tägliches Monitoring der Raten. Volumen: unter
  1.000 Mails/Tag (meist 50–300) in den ersten Monaten; 10.000/Tag und 10/s reichen.

Typische Rückfragen von AWS (Antwort binnen 24 h, gleicher Ton): Wie kommen Adressen zustande? (Registrierung mit
Bestätigung / Einladung durch Owner) · Was passiert bei Bounces? (siehe oben) · Beispiel-Mail? (Screenshot einer
Einladung schicken). Erst beantragen, wenn DKIM/MAIL FROM „Verified“ und die Website Impressum + Datenschutz zeigt.

Nach der Freischaltung: `EMAIL_SMTP_FALLBACK=false` lassen, `SES_MAX_SEND_RATE` nicht nötig (kommt aus GetAccount).

### Stand 2026-10-24 (live)
- Alle Mail-Functions + `sesEvents` + `emailUnsubscribe` + Rules deployt; SNS-Subscription Confirmed.
- SES-Konto: Sandbox (`ProductionAccessEnabled=false`), 200 Mails/24 h, 1 Mail/s, Konto-Suppression BOUNCE+COMPLAINT.
- Simulator-Test grün: success → `counts.delivery`, bounce → Suppression `bounce` (Permanent · General · 550 5.1.1),
  complaint → Suppression `complaint` (abuse). Die zwei Simulator-Einträge stehen bewusst in `email_suppressions`.
- Die IAM-Policy erlaubt kein `ses:GetEmailIdentity`; der Verifizierungsstatus steht in der Konsole (erfolgreiche Sends von
  `@mail.getprojectflow.com` belegen die Verifizierung).
- In der Sandbox scheitern Mails an nicht verifizierte Empfänger (Einladungen, Benachrichtigungen) bis zur Freischaltung.

## Betrieb

- **Kennzahlen:** `adminApi email.stats` (14 Tage). SES prüft Konten ab 5 % Bounces bzw. 0,1 % Beschwerden und
  pausiert ab 10 % bzw. 0,5 %. Eigene Warnschwelle: 2 % / 0,05 %.
- **Unterdrückte Adresse freigeben:** nur wenn der Empfänger bestätigt, dass die Adresse funktioniert →
  Admin-Konsole `email.suppressions.remove` (setzt `active=false`, löscht sie auch aus der SES-Konto-Liste).
- **Logs:** `firebase functions:log --only sesEvents`, Versand: `SES sent type=… messageId=…`,
  Fehler: `SES send failed type=…`.
- **Konfig ändern** (`.env.projectflow-labestin`): danach die betroffenen Functions neu deployen.

### Runbook: Bounce- oder Beschwerde-Spitze
1. `email.stats` → welcher `byType` treibt die Rate? SES-Konsole → Reputation metrics gegenprüfen.
2. Sofort bremsen: betroffenen Absender stoppen (z. B. Rechtsdokument-Job pausieren: `legal_mail_jobs/{id}.status`),
   oder global `EMAIL_TRANSPORT=smtp` + Deploy der Mail-Functions (SMTP ist ohne `SMTP_*` nicht konfiguriert → Versand
   stoppt faktisch); im Notfall SES → Account dashboard → „Pause sending“ für das Config-Set.
3. Ursache: Liste mit alten/ungültigen Adressen (Import, Einladungsspam eines Workspaces?) → Workspace prüfen,
   Einladungen sperren, Adressen manuell unterdrücken (`email.suppressions.add`).
4. Prüfen, dass `sesEvents` Events verarbeitet (Logs, SNS-Subscription „Confirmed“, `SES_SNS_TOPIC_ARNS` stimmt);
   fehlende Verarbeitung = Bounces landen nicht auf der Liste.
5. Erst wieder voll senden, wenn die 24-h-Rate unter 2 % / 0,05 % liegt. Bei einer SES-Review-Mail sachlich mit
   Ursache + Maßnahmen antworten.
