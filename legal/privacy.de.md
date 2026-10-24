# Datenschutzerklärung

_Zuletzt aktualisiert: 24. Oktober 2026_

Diese Datenschutzerklärung gilt einheitlich für die Website getprojectflow.com, die Web-App unter app.getprojectflow.com, die iOS-App und die Desktop-App (macOS/Windows) von ProjectFlow.

## 1. Verantwortlicher

Verantwortlich im Sinne der DSGVO ist:

Labestin Digital  
Inhaber: Christoph Labestin  
Ödwieser Weg 7  
84082 Laberweinting  
Deutschland  
E-Mail: [hello@getprojectflow.com](mailto:hello@getprojectflow.com)

Für Inhalte, die Kunden in ihren Workspaces ablegen (z. B. Daten von Teammitgliedern oder Dritten), ist in der Regel der Kunde bzw. seine Organisation Verantwortlicher; wir handeln dann als Auftragsverarbeiter (siehe Nutzungsbedingungen).

## 2. Überblick

- **Website (getprojectflow.com):** keine Cookies, keine Analyse- oder Tracking-Tools, keine Drittanbieter-Einbindungen, kein Kontaktformular. Es fallen nur technisch notwendige Server-Logs an.
- **Web-App, iOS-App, Desktop-App:** Verarbeitung von Konto-, Workspace- und Projektdaten zur Bereitstellung des Dienstes.

## 3. Website getprojectflow.com

**Hosting und Server-Logs.** Die Website ist eine statische Seite und wird über Firebase Hosting (Google Ireland Limited bzw. Google LLC) ausgeliefert. Beim Aufruf werden technisch notwendig Daten in Server-Logs verarbeitet: IP-Adresse, Datum und Uhrzeit, aufgerufene URL und User-Agent. Zweck ist der sichere und stabile Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Die Logs werden nach etwa 14 Tagen gelöscht, bei Sicherheitsvorfällen ggf. länger.

**Schriftarten.** Schriftarten werden von unserer eigenen Domain ausgeliefert; es erfolgt keine Verbindung zu Schriftarten-Servern Dritter.

**Spracheinstellung.** Ihre Sprachauswahl kann im lokalen Speicher Ihres Browsers (localStorage) abgelegt werden. Dies ist technisch notwendig, um Ihre Auswahl beizubehalten, wird nicht an uns übertragen und ist kein Cookie. (§ 25 Abs. 2 Nr. 2 TDDDG)

**Kontakt per E-Mail.** Die Website verlinkt auf unsere E-Mail-Adresse (mailto). Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b oder f DSGVO) und löschen sie in der Regel innerhalb von 12 Monaten nach der letzten Korrespondenz, sofern keine Aufbewahrungspflichten entgegenstehen.

## 4. Konto, Authentifizierung und Profil

Für die Nutzung der Apps verarbeiten wir:

- **Kontodaten:** Name, E-Mail-Adresse, optionales Profilbild, Spracheinstellungen.
- **Anmeldedaten:** Anmeldung über Firebase Authentication per E-Mail/Passwort, Google-Anmeldung oder Passkey. Passwörter speichern wir nicht selbst; sie werden von Firebase Authentication (gehasht) verwaltet.
- **Passkeys (WebAuthn):** Gespeichert werden der öffentliche Schlüssel, die Credential-ID und technische Metadaten. Der private Schlüssel bleibt auf Ihrem Gerät bzw. in Ihrem Passkey-Anbieter (z. B. iCloud-Schlüsselbund); biometrische Daten (Face ID/Touch ID) verlassen Ihr Gerät nicht und werden von uns nicht verarbeitet.
- **Workspace-Daten:** Mitgliedschaften, Rollen und Berechtigungen.

Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).

## 5. Projekt- und Inhaltsdaten

Alle Inhalte, die Sie oder Ihr Team im Dienst anlegen (z. B. Projekte, Aufgaben, Kommentare, Flows/Ideen, Dateien, Blog-Beiträge, Einstellungen), werden gespeichert, um den Dienst bereitzustellen und die Zusammenarbeit im Workspace zu ermöglichen. Sichtbar sind sie nur für Personen mit entsprechender Berechtigung im Workspace. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).

Dateien werden standardmäßig in Firebase Storage gespeichert. Workspace-Administratoren können optional einen eigenen Speicher (Amazon S3 oder Google Drive) anbinden; in diesem Fall werden Dateien beim jeweiligen Speicheranbieter nach dessen Bedingungen abgelegt.

## 6. Onboarding-Umfrage

Bei der Einrichtung können Sie Fragen zu Ihrer Rolle, Ihren Anwendungsfällen, Teamgröße, Branche, Ihrer Herkunft (wie Sie von ProjectFlow erfahren haben) und Ihrem bisherigen Tool beantworten. Die Antworten werden Ihrem Profil zugeordnet gespeichert, dienen der Anpassung des Dienstes und werden von uns in aggregierter Form ausgewertet, um das Produkt zu verbessern (Art. 6 Abs. 1 lit. f DSGVO). Die Beantwortung ist freiwillig; Sie können Ihre Angaben jederzeit löschen lassen.

## 7. KI-Funktionen

Wenn Sie KI-Funktionen nutzen (z. B. Textvorschläge, KI-Suche, Ideenfindung, Bilderzeugung, Assistent), übermitteln wir Ihre Eingabe und den dafür nötigen Kontext aus Ihrem Workspace über eine Cloud Function (Region europe-west3, Frankfurt) an einen KI-Anbieter und geben die Antwort an Sie zurück. Derzeit setzen wir dafür Modelle der OpenAI Ireland Ltd. / OpenAI, L.L.C. ein. Eine Verarbeitung in den USA ist möglich. Die KI-Funktionen werden nur auf Ihre Anforderung hin ausgeführt. Nach unseren Angaben werden Inhalte nicht zum Training eigener Modelle durch uns verwendet; zur Verarbeitung durch den Anbieter gelten dessen Vertragsbedingungen für API-Nutzung. Bitte geben Sie keine Daten ein, die Sie nicht übermitteln dürfen. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).

## 8. Benachrichtigungen und Push-Mitteilungen

- **E-Mail-Benachrichtigungen** (z. B. Einladungen, Erinnerungen, Aktivitäten) werden über einen SMTP-Dienst versendet (aktuell Google-Infrastruktur). Dabei werden E-Mail-Adresse und Nachrichteninhalt verarbeitet.
- **Push-Mitteilungen (iOS):** Wenn Sie Mitteilungen erlauben, wird ein geräte- und app-spezifisches Push-Token gespeichert und an den Apple Push Notification Service (APNs) bzw. Firebase Cloud Messaging übermittelt, damit Apple bzw. Google die Mitteilung zustellen können. Mitteilungstext und Badge-Zähler laufen dabei über diese Dienste. Sie können Push-Mitteilungen jederzeit in den iOS-Einstellungen oder in der App deaktivieren; das Token wird dann gelöscht.
- **Live Activities (iOS)** nutzen ebenfalls Apples Push-Infrastruktur, um laufende Aktivitäten (z. B. Fokus-Timer) anzuzeigen.

Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO); bei Push-Mitteilungen Ihre Einwilligung über die Systemabfrage (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG).

## 9. iOS-App

Die iOS-App nutzt dieselben Konten- und Inhaltsdaten wie die Web-App. Zusätzlich gilt:

- **Kalender (optional):** Mit Ihrer Erlaubnis liest die App Termine über Apples Kalender-Schnittstelle, um in der Wochenplanung freie Zeit anzuzeigen. Die Termine werden lokal auf dem Gerät verarbeitet und nicht an unsere Server übertragen.
- **Passkeys / Face ID:** siehe Abschnitt 4.
- **Fotos/Kamera (optional):** nur, wenn Sie selbst ein Profilbild oder eine Datei auswählen.

Apple verarbeitet im Rahmen von App Store, iCloud-Schlüsselbund und APNs Daten in eigener Verantwortung.

## 10. Desktop-App (macOS/Windows)

Die Desktop-App (Electron) umgibt die gehostete Web-App; Konto- und Inhaltsdaten werden wie in der Web-App verarbeitet. Zusätzlich gilt:

- **Kalender (optional, macOS):** Mit Ihrer Erlaubnis liest die App anstehende Termine lokal, um Fokus-Aufgaben zu pausieren und Meeting-Notizen anzubieten. Die Termine werden nicht an unsere Server übertragen.
- **Automatische Updates:** Die App prüft über GitHub Releases (GitHub, Inc., USA) auf neue Versionen und lädt diese herunter. Dabei erhält GitHub technisch bedingt Ihre IP-Adresse und Angaben zu App-Version und Betriebssystem. Rechtsgrundlage: berechtigtes Interesse an Sicherheit und Aktualität der Software (Art. 6 Abs. 1 lit. f DSGVO).
- Lokale Einstellungen werden auf Ihrem Gerät gespeichert.

## 11. Integrationen

Wenn Sie oder Ihr Workspace-Administrator Integrationen aktivieren (z. B. GitHub-Aufgabensynchronisierung, eigener Dateispeicher, API/MCP-Zugriff), werden die dafür nötigen Daten an den jeweiligen Dienst übertragen bzw. von dort abgerufen. Zugangsdaten (Tokens) werden serverseitig geschützt gespeichert und bei Trennung der Integration gelöscht. Es gelten zusätzlich die Datenschutzbestimmungen des Drittanbieters.

## 12. Newsletter, Warteliste, Kontaktanfragen

Soweit Sie sich über die App oder eine Landingpage für Newsletter oder Warteliste anmelden oder uns über ein Kontaktformular schreiben, verarbeiten wir E-Mail-Adresse und ggf. Name sowie Ihre Nachricht. Newsletter-Anmeldungen erfolgen per Double-Opt-in auf Basis Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); nach Abmeldung bewahren wir einen minimalen Sperrvermerk 3 Jahre auf. Wartelisten-Daten speichern wir bis 6 Monate nach Release, Kontaktanfragen in der Regel bis 12 Monate nach der letzten Korrespondenz. Auf getprojectflow.com selbst gibt es dafür derzeit keine Formulare.

## 13. Fehlerberichte

Die Web-App kann, sofern aktiviert, anonymisierte Fehlerberichte (Fehlermeldung, Stacktrace, App-Version, Browser/Gerät) an Functional Software GmbH / Sentry übermitteln, um Abstürze zu beheben (Art. 6 Abs. 1 lit. f DSGVO). Ohne Konfiguration werden keine Fehlerberichte gesendet.

## 14. Empfänger und Auftragsverarbeiter

Wir verkaufen keine personenbezogenen Daten. Wir setzen folgende Dienstleister ein, die in unserem Auftrag nach Art. 28 DSGVO bzw. als eigene Verantwortliche tätig sind:

- **Google Cloud / Firebase** (Google Ireland Limited; Google LLC, USA): Hosting, Authentifizierung, Datenbank (Firestore, Standort eur3/EU), Dateispeicher, Cloud Functions (Region europe-west3, Frankfurt), Push (FCM), E-Mail-Versand (SMTP).
- **OpenAI**: Verarbeitung von KI-Anfragen (siehe Abschnitt 7).
- **Apple**: APNs, App Store, ggf. Passkey-Synchronisierung.
- **GitHub**: Auslieferung der Desktop-Updates; optionale Integration.
- **Sentry**: optionale Fehlerberichte (Abschnitt 13).
- **Zahlungsdienstleister:** Soweit kostenpflichtige Pläne angeboten werden, erfolgt die Zahlungsabwicklung über einen Zahlungsdienstleister; dieser verarbeitet Zahlungsdaten in eigener Verantwortung. Wir speichern keine vollständigen Zahlungsmittel-Daten.
- **Weitere Nutzer** Ihres Workspaces gemäß der vergebenen Rollen und Berechtigungen.

## 15. Übermittlungen in Drittländer

Einige Dienstleister (insbesondere Google LLC, OpenAI, Apple, GitHub) können Daten in den USA verarbeiten. Wir stützen Übermittlungen auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework (soweit der Anbieter zertifiziert ist) oder auf Standardvertragsklauseln der EU-Kommission mit ergänzenden Maßnahmen. Auf Anfrage erhalten Sie eine Kopie der Garantien.

## 16. Speicherdauer

- Server-Logs der Website: ca. 14 Tage.
- Konto- und Inhaltsdaten: bis zur Löschung des Kontos bzw. Workspaces; danach Löschung innerhalb angemessener Frist, soweit keine gesetzlichen Aufbewahrungspflichten bestehen. Backups werden im regulären Zyklus überschrieben.
- Push-Token: bis zur Deaktivierung der Mitteilungen bzw. Abmeldung des Geräts.
- E-Mail-Versandprotokolle: 90 Tage.
- Integrations-Tokens: bis zur Trennung der Integration.
- Rechnungs- und steuerrelevante Daten: gemäß gesetzlichen Fristen (in der Regel bis zu 10 Jahre).

## 17. Ihre Rechte

Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitung auf Grundlage berechtigter Interessen (Art. 21 DSGVO). Erteilte Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Sie haben zudem das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO); für uns zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA).

Zur Ausübung Ihrer Rechte schreiben Sie an [hello@getprojectflow.com](mailto:hello@getprojectflow.com). Wir antworten in der Regel innerhalb eines Monats und können zur Missbrauchsvermeidung einen Identitätsnachweis verlangen. Die Bereitstellung von Daten ist für die Nutzung des Dienstes erforderlich, soweit oben nicht als freiwillig bezeichnet.

## 18. Änderungen

Wir passen diese Datenschutzerklärung an, wenn sich Dienst, Dienstleister oder Rechtslage ändern. Es gilt die jeweils hier veröffentlichte Fassung; das Datum der letzten Aktualisierung steht am Anfang.
