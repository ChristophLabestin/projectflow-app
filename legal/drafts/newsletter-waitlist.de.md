# Entwurf: Datenschutz – Newsletter & Warteliste (nächste Version)

> **Status: Entwurf, nicht veröffentlicht.** Stand 2026-10-24. Ersetzt in `legal/privacy.de.md` Abschnitt 12 und ergänzt
> Abschnitte 3, 14 und 16. Veröffentlichung über die Admin-Konsole (Rechtstexte → neue Version), nicht direkt hier.
> Stellen mit **[PRÜFEN]** muss der User (bzw. eine Rechtsberatung) bestätigen.

## Änderung in Abschnitt 3 (Website)

Letzten Satz von Abschnitt 12 („Auf getprojectflow.com selbst gibt es dafür derzeit keine Formulare.“) streichen und in
Abschnitt 3 ergänzen:

**Warteliste und Newsletter.** Auf getprojectflow.com können Sie sich auf die Warteliste setzen oder den Newsletter
abonnieren. Die Formulare senden Ihre Angaben direkt an unsere Server (Cloud Functions, Region Frankfurt); Einzelheiten in
Abschnitt 12.

## Neuer Abschnitt 12: Newsletter, Warteliste, Kontaktanfragen

**Was wir verarbeiten.** Wenn Sie sich auf der Website, in der App (Einstellungen → Benachrichtigungen) oder auf unsere
Einladung hin für die Warteliste oder den Newsletter anmelden, verarbeiten wir Ihre E-Mail-Adresse, freiwillig Ihren Namen,
bei der Warteliste freiwillig Ihren Einsatzzweck, die gewählte Sprache und die Quelle der Anmeldung. Sind Sie in der App
angemeldet, verknüpfen wir das Abonnement mit Ihrem Konto.

**Zweck und Rechtsgrundlage.** Warteliste: Benachrichtigung, sobald ein Zugang bereitsteht, und Informationen zum Start.
Newsletter: Neuigkeiten zu Funktionen von ProjectFlow, Tipps und Einblicke (etwa ein- bis zweimal im Monat). Beides nur mit
Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Warteliste und Newsletter sind getrennte Einwilligungen.

**Double-Opt-in und Nachweis.** Nach der Anmeldung erhalten Sie eine E-Mail mit einem Bestätigungslink (48 Stunden gültig).
Erst nach Ihrer Bestätigung schicken wir Ihnen Inhalte. Um die Einwilligung nachweisen zu können, speichern wir Zeitpunkt der
Anmeldung und der Bestätigung, IP-Adresse, Browser-Kennung (User-Agent) sowie Version und Wortlaut des Einwilligungstexts
(Art. 6 Abs. 1 lit. c i. V. m. Art. 7 Abs. 1 DSGVO sowie lit. f DSGVO, berechtigtes Interesse am Nachweis). Nicht bestätigte
Anmeldungen löschen wir nach 30 Tagen. Bestätigen Sie die Warteliste, können Sie auf der Bestätigungsseite zusätzlich den
Newsletter abonnieren; Ihre Adresse ist dann bereits bestätigt, eine zweite E-Mail ist nicht nötig.

**Versand und Auswertung.** Der Versand erfolgt über Amazon Simple Email Service (Amazon Web Services EMEA SARL, Region
EU/Stockholm) bzw. ersatzweise über Google Workspace (Google Ireland Limited). Wir erfassen nur, ob eine E-Mail zugestellt
wurde oder unzustellbar war (Bounce) und ob sich jemand beschwert hat, um den Versand an ungültige Adressen zu stoppen
(Art. 6 Abs. 1 lit. f DSGVO). **Öffnungen und Klicks werten wir nicht aus** (keine Zählpixel, keine Weiterleitungslinks).
**[PRÜFEN: nur so lassen, solange Tracking aus bleibt.]**

**Widerruf.** Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen: über den Abmeldelink in jeder
E-Mail (auch per Ein-Klick-Abmeldung im E-Mail-Programm), in der App unter Einstellungen → Benachrichtigungen oder per E-Mail
an hello@getprojectflow.com. Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.

**Speicherdauer.** Bis zum Widerruf; Wartelisten-Einträge spätestens 6 Monate nach allgemeiner Verfügbarkeit von ProjectFlow
**[PRÜFEN: Frist; Löschlauf ist noch nicht automatisiert]**. Nach einem Widerruf bewahren wir den Nachweis der Einwilligung
und des Widerrufs bis zu 3 Jahre auf (Verjährungsfrist für mögliche Ansprüche, § 195 BGB) **[PRÜFEN]**; Adressen, die
dauerhaft keine E-Mails mehr erhalten möchten oder unzustellbar sind, führen wir in einer Sperrliste.

**Kontaktanfragen.** Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben zur Bearbeitung (Art. 6 Abs. 1 lit. b oder f
DSGVO) und löschen sie in der Regel bis 12 Monate nach der letzten Korrespondenz.

## Ergänzung Abschnitt 14 (Empfänger)

- **Amazon Web Services EMEA SARL** (Luxemburg; Amazon Web Services, Inc., USA): E-Mail-Versand (Amazon SES, Region
  eu-north-1 Stockholm), Zustell- und Bounce-Meldungen. **[PRÜFEN: AVV/DPA mit AWS abgeschlossen? Abschnitt 15 um AWS
  ergänzen (DPF/SCC).]**
- Google: „E-Mail-Versand (SMTP)“ bleibt als Ausweichweg.

## Ergänzung Abschnitt 16 (Speicherdauer)

- Newsletter/Warteliste: bis zum Widerruf; unbestätigte Anmeldungen 30 Tage; Einwilligungsnachweis bis 3 Jahre nach Widerruf.

---

## Einwilligungstexte (so im Formular angezeigt und im Nachweis gespeichert, Version `2026-10-24`)

- **Warteliste:** „Ich möchte auf die Warteliste von ProjectFlow und per E-Mail erfahren, sobald ich einen Zugang bekomme. Die
  Einwilligung kann ich jederzeit widerrufen, z. B. über den Abmeldelink in jeder E-Mail.“
- **Newsletter:** „Ich möchte den ProjectFlow-Newsletter mit Produktneuigkeiten und Tipps per E-Mail erhalten (etwa ein- bis
  zweimal im Monat). Die Einwilligung kann ich jederzeit widerrufen, z. B. über den Abmeldelink in jeder E-Mail.“

Quelle: `functions/src/platform-newsletter/logic.ts` (`CONSENT_TEXTS`), Anzeige `landing/src/content/optin.ts`. Ein Unit-Test
stellt sicher, dass beide übereinstimmen. Textänderung = neue `CONSENT_VERSION`.

## Prüfliste für den User
1. Einwilligung per Hinweistext über dem Button (keine Checkbox). Reicht das, oder lieber eine Pflicht-Checkbox?
2. Newsletter-Zusatz auf der Bestätigungsseite ohne zweite Mail (Adresse ist durch den Klick verifiziert). Okay?
3. IP-Adresse im Klartext im Nachweis; Aufbewahrung 3 Jahre nach Widerruf.
4. Frist Warteliste (6 Monate nach Release) und wer den Löschlauf auslöst.
5. AWS als Empfänger + Drittlandübermittlung ergänzen; AVV mit AWS.
6. Öffnungs-/Klicktracking bleibt aus (sonst eigener Einwilligungstext + Abschnitt anpassen).
