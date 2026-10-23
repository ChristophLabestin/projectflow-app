export interface LegalSection { id: string; title: string; html: string }
export interface LegalDoc { title: string; description: string; updated: string; intro?: string; sections: LegalSection[] }
export type LegalKind = 'imprint' | 'privacy' | 'terms';

export const legal: Record<'de' | 'en', Record<LegalKind, LegalDoc>> = {
    de: {
        imprint: {
            title: 'Impressum',
            description: 'Impressum und Anbieterkennzeichnung für ProjectFlow (getprojectflow.com) gemäß § 5 DDG.',
            updated: 'Zuletzt aktualisiert: 23. Oktober 2026',
            intro: 'Angaben gemäß § 5 DDG',
            sections: [
                {
                    id: 'anbieter',
                    title: 'Anbieter',
                    html: `<p>Christoph Labestin<br>Frühlingsstraße 8<br>84082 Laberweinting<br>Deutschland</p>`
                },
                {
                    id: 'geschaeftsbezeichnung',
                    title: 'Geschäftsbezeichnung',
                    html: `<p>ProjectFlow (Marke / Produktname)</p>`
                },
                {
                    id: 'kontakt',
                    title: 'Kontakt',
                    html: `<p>Telefon: +49 170 5853983<br>E-Mail: <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a></p>`
                },
                {
                    id: 'umsatzsteuer',
                    title: 'Umsatzsteuer',
                    html: `<p>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: Keine Umsatzsteuer-Identifikationsnummer vorhanden.</p>`
                },
                {
                    id: 'verantwortlich-inhalt',
                    title: 'Verantwortlich für den Inhalt',
                    html: `<p>Verantwortlich gemäß § 18 Abs. 2 MStV:<br>Christoph Labestin, Frühlingsstraße 8, 84082 Laberweinting, Deutschland</p>`
                },
                {
                    id: 'streitbeilegung',
                    title: 'Streitbeilegung / Verbraucherstreitbeilegung',
                    html: `<p>Wir sind nicht verpflichtet und grundsätzlich nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).</p>`
                },
                {
                    id: 'haftung-inhalte',
                    title: 'Haftung für Inhalte',
                    html: `<p>Als Diensteanbieter sind wir gemäß den allgemeinen Gesetzen für eigene Inhalte auf diesen Seiten verantwortlich. Eine Haftung für die Aktualität, Vollständigkeit und Richtigkeit der Inhalte kann jedoch nicht dauerhaft gewährleistet werden.</p>`
                },
                {
                    id: 'haftung-links',
                    title: 'Haftung für Links',
                    html: `<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte übernehmen wir keine Gewähr. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>`
                },
                {
                    id: 'urheberrecht',
                    title: 'Urheberrecht',
                    html: `<p>Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.</p>`
                }
            ]
        },
        privacy: {
            title: 'Datenschutzerklärung',
            description: 'Wie ProjectFlow personenbezogene Daten auf der Website, in der Web-App, iOS-App und Desktop-App verarbeitet und welche Rechte Sie haben.',
            updated: 'Zuletzt aktualisiert: 23. Oktober 2026',
            intro: 'Diese Datenschutzerklärung gilt einheitlich für die Website getprojectflow.com, die Web-App unter app.getprojectflow.com, die iOS-App und die Desktop-App (macOS/Windows) von ProjectFlow.',
            sections: [
                {
                    id: 'verantwortlicher',
                    title: '1. Verantwortlicher',
                    html: `<p>Verantwortlich im Sinne der DSGVO ist:</p><p>Christoph Labestin<br>Frühlingsstraße 8<br>84082 Laberweinting<br>Deutschland<br>E-Mail: <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a></p><p>Für Inhalte, die Kunden in ihren Workspaces ablegen (z. B. Daten von Teammitgliedern oder Dritten), ist in der Regel der Kunde bzw. seine Organisation Verantwortlicher; wir handeln dann als Auftragsverarbeiter (siehe Nutzungsbedingungen).</p>`
                },
                {
                    id: 'ueberblick',
                    title: '2. Überblick',
                    html: `<ul><li><strong>Website (getprojectflow.com):</strong> keine Cookies, keine Analyse- oder Tracking-Tools, keine Drittanbieter-Einbindungen, kein Kontaktformular. Es fallen nur technisch notwendige Server-Logs an.</li><li><strong>Web-App, iOS-App, Desktop-App:</strong> Verarbeitung von Konto-, Workspace- und Projektdaten zur Bereitstellung des Dienstes.</li></ul>`
                },
                {
                    id: 'website',
                    title: '3. Website getprojectflow.com',
                    html: `<p><strong>Hosting und Server-Logs.</strong> Die Website ist eine statische Seite und wird über Firebase Hosting (Google Ireland Limited bzw. Google LLC) ausgeliefert. Beim Aufruf werden technisch notwendig Daten in Server-Logs verarbeitet: IP-Adresse, Datum und Uhrzeit, aufgerufene URL und User-Agent. Zweck ist der sichere und stabile Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Die Logs werden nach etwa 14 Tagen gelöscht, bei Sicherheitsvorfällen ggf. länger.</p><p><strong>Schriftarten.</strong> Schriftarten werden von unserer eigenen Domain ausgeliefert; es erfolgt keine Verbindung zu Schriftarten-Servern Dritter.</p><p><strong>Spracheinstellung.</strong> Ihre Sprachauswahl kann im lokalen Speicher Ihres Browsers (localStorage) abgelegt werden. Dies ist technisch notwendig, um Ihre Auswahl beizubehalten, wird nicht an uns übertragen und ist kein Cookie. (§ 25 Abs. 2 Nr. 2 TDDDG)</p><p><strong>Kontakt per E-Mail.</strong> Die Website verlinkt auf unsere E-Mail-Adresse (mailto). Wenn Sie uns schreiben, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage (Art. 6 Abs. 1 lit. b oder f DSGVO) und löschen sie in der Regel innerhalb von 12 Monaten nach der letzten Korrespondenz, sofern keine Aufbewahrungspflichten entgegenstehen.</p>`
                },
                {
                    id: 'konto-daten',
                    title: '4. Konto, Authentifizierung und Profil',
                    html: `<p>Für die Nutzung der Apps verarbeiten wir:</p><ul><li><strong>Kontodaten:</strong> Name, E-Mail-Adresse, optionales Profilbild, Spracheinstellungen.</li><li><strong>Anmeldedaten:</strong> Anmeldung über Firebase Authentication per E-Mail/Passwort, Google-Anmeldung oder Passkey. Passwörter speichern wir nicht selbst; sie werden von Firebase Authentication (gehasht) verwaltet.</li><li><strong>Passkeys (WebAuthn):</strong> Gespeichert werden der öffentliche Schlüssel, die Credential-ID und technische Metadaten. Der private Schlüssel bleibt auf Ihrem Gerät bzw. in Ihrem Passkey-Anbieter (z. B. iCloud-Schlüsselbund); biometrische Daten (Face ID/Touch ID) verlassen Ihr Gerät nicht und werden von uns nicht verarbeitet.</li><li><strong>Workspace-Daten:</strong> Mitgliedschaften, Rollen und Berechtigungen.</li></ul><p>Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p>`
                },
                {
                    id: 'inhaltsdaten',
                    title: '5. Projekt- und Inhaltsdaten',
                    html: `<p>Alle Inhalte, die Sie oder Ihr Team im Dienst anlegen (z. B. Projekte, Aufgaben, Kommentare, Flows/Ideen, Dateien, Blog-Beiträge, Einstellungen), werden gespeichert, um den Dienst bereitzustellen und die Zusammenarbeit im Workspace zu ermöglichen. Sichtbar sind sie nur für Personen mit entsprechender Berechtigung im Workspace. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p><p>Dateien werden standardmäßig in Firebase Storage gespeichert. Workspace-Administratoren können optional einen eigenen Speicher (Amazon S3 oder Google Drive) anbinden; in diesem Fall werden Dateien beim jeweiligen Speicheranbieter nach dessen Bedingungen abgelegt.</p>`
                },
                {
                    id: 'onboarding',
                    title: '6. Onboarding-Umfrage',
                    html: `<p>Bei der Einrichtung können Sie Fragen zu Ihrer Rolle, Ihren Anwendungsfällen, Teamgröße, Branche, Ihrer Herkunft (wie Sie von ProjectFlow erfahren haben) und Ihrem bisherigen Tool beantworten. Die Antworten werden Ihrem Profil zugeordnet gespeichert, dienen der Anpassung des Dienstes und werden von uns in aggregierter Form ausgewertet, um das Produkt zu verbessern (Art. 6 Abs. 1 lit. f DSGVO). Die Beantwortung ist freiwillig; Sie können Ihre Angaben jederzeit löschen lassen.</p>`
                },
                {
                    id: 'ki',
                    title: '7. KI-Funktionen',
                    html: `<p>Wenn Sie KI-Funktionen nutzen (z. B. Textvorschläge, KI-Suche, Ideenfindung, Bilderzeugung, Assistent), übermitteln wir Ihre Eingabe und den dafür nötigen Kontext aus Ihrem Workspace über eine Cloud Function (Region europe-west3, Frankfurt) an einen KI-Anbieter und geben die Antwort an Sie zurück. Derzeit setzen wir dafür Modelle der OpenAI Ireland Ltd. / OpenAI, L.L.C. ein. Eine Verarbeitung in den USA ist möglich. Die KI-Funktionen werden nur auf Ihre Anforderung hin ausgeführt. Nach unseren Angaben werden Inhalte nicht zum Training eigener Modelle durch uns verwendet; zur Verarbeitung durch den Anbieter gelten dessen Vertragsbedingungen für API-Nutzung. Bitte geben Sie keine Daten ein, die Sie nicht übermitteln dürfen. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p>`
                },
                {
                    id: 'push',
                    title: '8. Benachrichtigungen und Push-Mitteilungen',
                    html: `<ul><li><strong>E-Mail-Benachrichtigungen</strong> (z. B. Einladungen, Erinnerungen, Aktivitäten) werden über einen SMTP-Dienst versendet (aktuell Google-Infrastruktur). Dabei werden E-Mail-Adresse und Nachrichteninhalt verarbeitet.</li><li><strong>Push-Mitteilungen (iOS):</strong> Wenn Sie Mitteilungen erlauben, wird ein geräte- und app-spezifisches Push-Token gespeichert und an den Apple Push Notification Service (APNs) bzw. Firebase Cloud Messaging übermittelt, damit Apple bzw. Google die Mitteilung zustellen können. Mitteilungstext und Badge-Zähler laufen dabei über diese Dienste. Sie können Push-Mitteilungen jederzeit in den iOS-Einstellungen oder in der App deaktivieren; das Token wird dann gelöscht.</li><li><strong>Live Activities (iOS)</strong> nutzen ebenfalls Apples Push-Infrastruktur, um laufende Aktivitäten (z. B. Fokus-Timer) anzuzeigen.</li></ul><p>Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO); bei Push-Mitteilungen Ihre Einwilligung über die Systemabfrage (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG).</p>`
                },
                {
                    id: 'ios-app',
                    title: '9. iOS-App',
                    html: `<p>Die iOS-App nutzt dieselben Konten- und Inhaltsdaten wie die Web-App. Zusätzlich gilt:</p><ul><li><strong>Kalender (optional):</strong> Mit Ihrer Erlaubnis liest die App Termine über Apples Kalender-Schnittstelle, um in der Wochenplanung freie Zeit anzuzeigen. Die Termine werden lokal auf dem Gerät verarbeitet und nicht an unsere Server übertragen.</li><li><strong>Passkeys / Face ID:</strong> siehe Abschnitt 4.</li><li><strong>Fotos/Kamera (optional):</strong> nur, wenn Sie selbst ein Profilbild oder eine Datei auswählen.</li></ul><p>Apple verarbeitet im Rahmen von App Store, iCloud-Schlüsselbund und APNs Daten in eigener Verantwortung.</p>`
                },
                {
                    id: 'desktop-app',
                    title: '10. Desktop-App (macOS/Windows)',
                    html: `<p>Die Desktop-App (Electron) umgibt die gehostete Web-App; Konto- und Inhaltsdaten werden wie in der Web-App verarbeitet. Zusätzlich gilt:</p><ul><li><strong>Kalender (optional, macOS):</strong> Mit Ihrer Erlaubnis liest die App anstehende Termine lokal, um Fokus-Aufgaben zu pausieren und Meeting-Notizen anzubieten. Die Termine werden nicht an unsere Server übertragen.</li><li><strong>Automatische Updates:</strong> Die App prüft über GitHub Releases (GitHub, Inc., USA) auf neue Versionen und lädt diese herunter. Dabei erhält GitHub technisch bedingt Ihre IP-Adresse und Angaben zu App-Version und Betriebssystem. Rechtsgrundlage: berechtigtes Interesse an Sicherheit und Aktualität der Software (Art. 6 Abs. 1 lit. f DSGVO).</li><li>Lokale Einstellungen werden auf Ihrem Gerät gespeichert.</li></ul>`
                },
                {
                    id: 'integrationen',
                    title: '11. Integrationen',
                    html: `<p>Wenn Sie oder Ihr Workspace-Administrator Integrationen aktivieren (z. B. GitHub-Aufgabensynchronisierung, eigener Dateispeicher, API/MCP-Zugriff), werden die dafür nötigen Daten an den jeweiligen Dienst übertragen bzw. von dort abgerufen. Zugangsdaten (Tokens) werden serverseitig geschützt gespeichert und bei Trennung der Integration gelöscht. Es gelten zusätzlich die Datenschutzbestimmungen des Drittanbieters.</p>`
                },
                {
                    id: 'newsletter-blog',
                    title: '12. Newsletter, Warteliste, Kontaktanfragen',
                    html: `<p>Soweit Sie sich über die App oder eine Landingpage für Newsletter oder Warteliste anmelden oder uns über ein Kontaktformular schreiben, verarbeiten wir E-Mail-Adresse und ggf. Name sowie Ihre Nachricht. Newsletter-Anmeldungen erfolgen per Double-Opt-in auf Basis Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO); nach Abmeldung bewahren wir einen minimalen Sperrvermerk 3 Jahre auf. Wartelisten-Daten speichern wir bis 6 Monate nach Release, Kontaktanfragen in der Regel bis 12 Monate nach der letzten Korrespondenz. Auf getprojectflow.com selbst gibt es dafür derzeit keine Formulare.</p>`
                },
                {
                    id: 'fehlerberichte',
                    title: '13. Fehlerberichte',
                    html: `<p>Die Web-App kann, sofern aktiviert, anonymisierte Fehlerberichte (Fehlermeldung, Stacktrace, App-Version, Browser/Gerät) an Functional Software GmbH / Sentry übermitteln, um Abstürze zu beheben (Art. 6 Abs. 1 lit. f DSGVO). Ohne Konfiguration werden keine Fehlerberichte gesendet.</p>`
                },
                {
                    id: 'empfaenger',
                    title: '14. Empfänger und Auftragsverarbeiter',
                    html: `<p>Wir verkaufen keine personenbezogenen Daten. Wir setzen folgende Dienstleister ein, die in unserem Auftrag nach Art. 28 DSGVO bzw. als eigene Verantwortliche tätig sind:</p><ul><li><strong>Google Cloud / Firebase</strong> (Google Ireland Limited; Google LLC, USA): Hosting, Authentifizierung, Datenbank (Firestore, Standort eur3/EU), Dateispeicher, Cloud Functions (Region europe-west3, Frankfurt), Push (FCM), E-Mail-Versand (SMTP).</li><li><strong>OpenAI</strong>: Verarbeitung von KI-Anfragen (siehe Abschnitt 7).</li><li><strong>Apple</strong>: APNs, App Store, ggf. Passkey-Synchronisierung.</li><li><strong>GitHub</strong>: Auslieferung der Desktop-Updates; optionale Integration.</li><li><strong>Sentry</strong>: optionale Fehlerberichte (Abschnitt 13).</li><li><strong>Zahlungsdienstleister:</strong> Soweit kostenpflichtige Pläne angeboten werden, erfolgt die Zahlungsabwicklung über einen Zahlungsdienstleister; dieser verarbeitet Zahlungsdaten in eigener Verantwortung. Wir speichern keine vollständigen Zahlungsmittel-Daten.</li><li><strong>Weitere Nutzer</strong> Ihres Workspaces gemäß der vergebenen Rollen und Berechtigungen.</li></ul>`
                },
                {
                    id: 'drittlaender',
                    title: '15. Übermittlungen in Drittländer',
                    html: `<p>Einige Dienstleister (insbesondere Google LLC, OpenAI, Apple, GitHub) können Daten in den USA verarbeiten. Wir stützen Übermittlungen auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework (soweit der Anbieter zertifiziert ist) oder auf Standardvertragsklauseln der EU-Kommission mit ergänzenden Maßnahmen. Auf Anfrage erhalten Sie eine Kopie der Garantien.</p>`
                },
                {
                    id: 'speicherdauer',
                    title: '16. Speicherdauer',
                    html: `<ul><li>Server-Logs der Website: ca. 14 Tage.</li><li>Konto- und Inhaltsdaten: bis zur Löschung des Kontos bzw. Workspaces; danach Löschung innerhalb angemessener Frist, soweit keine gesetzlichen Aufbewahrungspflichten bestehen. Backups werden im regulären Zyklus überschrieben.</li><li>Push-Token: bis zur Deaktivierung der Mitteilungen bzw. Abmeldung des Geräts.</li><li>E-Mail-Versandprotokolle: 90 Tage.</li><li>Integrations-Tokens: bis zur Trennung der Integration.</li><li>Rechnungs- und steuerrelevante Daten: gemäß gesetzlichen Fristen (in der Regel bis zu 10 Jahre).</li></ul>`
                },
                {
                    id: 'rechte',
                    title: '17. Ihre Rechte',
                    html: `<p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitung auf Grundlage berechtigter Interessen (Art. 21 DSGVO). Erteilte Einwilligungen können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Sie haben zudem das Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO); für uns zuständig ist das Bayerische Landesamt für Datenschutzaufsicht (BayLDA).</p><p>Zur Ausübung Ihrer Rechte schreiben Sie an <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a>. Wir antworten in der Regel innerhalb eines Monats und können zur Missbrauchsvermeidung einen Identitätsnachweis verlangen. Die Bereitstellung von Daten ist für die Nutzung des Dienstes erforderlich, soweit oben nicht als freiwillig bezeichnet.</p>`
                },
                {
                    id: 'aenderungen',
                    title: '18. Änderungen',
                    html: `<p>Wir passen diese Datenschutzerklärung an, wenn sich Dienst, Dienstleister oder Rechtslage ändern. Es gilt die jeweils hier veröffentlichte Fassung; das Datum der letzten Aktualisierung steht am Anfang.</p>`
                }
            ]
        },
        terms: {
            title: 'Nutzungsbedingungen (AGB) / SaaS-Vertrag',
            description: 'Nutzungsbedingungen für ProjectFlow, den Online-Projektmanagement-Dienst für Unternehmen: Konten, Pläne, Pflichten, Haftung, Laufzeit und Datenschutz.',
            updated: 'Zuletzt aktualisiert: 23. Oktober 2026',
            intro: 'Zusammenfassung (nicht verbindlich): ProjectFlow ist ein Online-Projektmanagement-Dienst für Unternehmen (nicht für Verbraucher), der im Abonnement angeboten wird. Mit der Registrierung stimmt das Unternehmen diesen Bedingungen zu.',
            sections: [
                {
                    id: 'geltungsbereich',
                    title: '1. Parteien und Geltungsbereich (nur B2B)',
                    html: `<p>Diese Bedingungen gelten zwischen Christoph Labestin, Frühlingsstraße 8, 84082 Laberweinting, Deutschland („Anbieter“), und dem registrierenden Unternehmen („Kunde“) für die Nutzung von ProjectFlow („Service“), einschließlich Web-App, iOS-App und Desktop-App.</p><p>Der Service richtet sich ausschließlich an Unternehmer im Sinne von § 14 BGB. Der Kunde sichert zu, kein Verbraucher zu sein und befugt zu sein, das Unternehmen zu binden. Verbraucherschutzrechte (z. B. Widerrufsrecht) finden keine Anwendung. Abweichende Bedingungen des Kunden gelten nicht, es sei denn, der Anbieter stimmt ihnen schriftlich zu. Individuelle Vereinbarungen (z. B. Bestellformular) haben Vorrang; in Datenschutzfragen gilt zudem die Auftragsverarbeitungsvereinbarung (Abschnitt 11).</p>`
                },
                {
                    id: 'definitionen',
                    title: '2. Definitionen',
                    html: `<ul><li><strong>Workspace:</strong> der Arbeitsbereich des Kunden, in dem Projekte, Aufgaben, Flows und weitere Inhalte verwaltet werden.</li><li><strong>Nutzer:</strong> Personen, denen der Kunde Zugang zum Workspace gewährt, mit Rollen und Berechtigungen (z. B. Administrator, Mitglied, Gast).</li><li><strong>Kundendaten:</strong> alle Inhalte und Daten, die der Kunde oder seine Nutzer im Service ablegen.</li><li><strong>Abonnementplan:</strong> das gebuchte Paket von Funktionen und Nutzungslimits (z. B. Starter, Professional, Organization).</li><li><strong>KI-Funktionen:</strong> optionale Funktionen, die Eingaben an einen KI-Anbieter übermitteln, um Ergebnisse zu erzeugen.</li></ul>`
                },
                {
                    id: 'vertragsschluss',
                    title: '3. Vertragsschluss, Konten, Test',
                    html: `<p>Der Vertrag kommt zustande, wenn der Kunde die Registrierung abschließt und diese Bedingungen akzeptiert und der Anbieter das Konto freischaltet oder den Zugang bereitstellt. Angaben bei der Registrierung müssen korrekt sein. Der Kunde ist für die Aktivitäten seiner Nutzer und für die Sicherheit der Zugangsdaten verantwortlich. Verbundene Unternehmen dürfen den Service über das Konto des Kunden nutzen, sofern der Kunde für deren Einhaltung dieser Bedingungen einsteht.</p><p>Ein kostenloser Test, sofern angeboten, dauert 14 Tage (sofern nichts anderes mitgeteilt wird), wird ohne Gewährleistung und ohne SLA bereitgestellt und kann jederzeit beendet werden. Beta-Funktionen werden ohne Gewähr bereitgestellt.</p>`
                },
                {
                    id: 'leistung',
                    title: '4. Leistungsbeschreibung und Nutzungsrechte',
                    html: `<p>Der Anbieter stellt dem Kunden für die Vertragslaufzeit den Service als Software-as-a-Service zur Verfügung, mit Funktionen wie Workspaces, Projekten, Aufgaben, Flows (strukturierte Ideenfindung), Dateifreigabe, Berechtigungen, optionalen Modulen, KI-Funktionen und Integrationen, jeweils im Umfang des gewählten Abonnementplans. Der Kunde erhält ein nicht ausschließliches, nicht übertragbares, zeitlich auf die Vertragslaufzeit beschränktes Recht, den Service für eigene geschäftliche Zwecke zu nutzen. Der Anbieter darf den Service weiterentwickeln, solange die Kernfunktionalität nicht wesentlich eingeschränkt wird.</p>`
                },
                {
                    id: 'pflichten',
                    title: '5. Pflichten des Kunden',
                    html: `<p>Der Kunde nutzt den Service rechtmäßig und gemäß diesen Bedingungen, hält Zugangsdaten geheim, informiert den Anbieter unverzüglich über Missbrauch, stellt sicher, dass er zur Verarbeitung der von ihm eingestellten Daten (insbesondere personenbezogener Daten Dritter) berechtigt ist, und ist für Rollen und Berechtigungen in seinem Workspace verantwortlich. Der Kunde prüft KI-generierte Ergebnisse eigenverantwortlich auf Richtigkeit und Zulässigkeit, bevor er sie verwendet.</p>`
                },
                {
                    id: 'aup',
                    title: '6. Zulässige Nutzung',
                    html: `<p>Untersagt sind insbesondere:</p><ul><li>rechtswidrige, diskriminierende, bedrohende oder rechtsverletzende Inhalte,</li><li>Schadsoftware, Angriffe auf Sicherheit oder Verfügbarkeit, Umgehen von Limits oder Zugriffsbeschränkungen,</li><li>automatisiertes Auslesen außerhalb der bereitgestellten Schnittstellen, Reverse Engineering (soweit gesetzlich zulässig),</li><li>Weiterverkauf oder Bereitstellung des Service für Dritte ohne Zustimmung,</li><li>Nutzung der KI-Funktionen für rechtswidrige oder gegen die Nutzungsrichtlinien des KI-Anbieters verstoßende Zwecke.</li></ul><p>Bei Verstößen darf der Anbieter Inhalte entfernen oder den Zugang einschränken.</p>`
                },
                {
                    id: 'gebuehren',
                    title: '7. Gebühren, Zahlung und Steuern',
                    html: `<p>Der Kunde zahlt die im Bestellformular oder im gewählten Abonnementplan ausgewiesenen Gebühren, in der Regel wiederkehrend (monatlich oder jährlich) im Voraus, zuzüglich anwendbarer Steuern. Die Zahlung kann über einen Zahlungsdienstleister erfolgen. Bei Zahlungsverzug werden Verzugszinsen nach den gesetzlichen Vorschriften berechnet; der Anbieter kann den Zugang nach Mahnung und Fristsetzung sperren. Preisänderungen kündigt der Anbieter mindestens 30 Tage vor ihrem Wirksamwerden an und sie gelten ab der nächsten Laufzeit; der Kunde kann bis dahin kündigen. Upgrades wirken sofort (anteilige Berechnung), Downgrades zum Ende der Laufzeit. Gebühren sind, soweit gesetzlich zulässig, nicht erstattungsfähig.</p>`
                },
                {
                    id: 'laufzeit',
                    title: '8. Laufzeit und Kündigung',
                    html: `<p>Die Laufzeit entspricht dem gebuchten Abrechnungszeitraum und verlängert sich automatisch um dieselbe Dauer, wenn nicht spätestens 30 Tage (Jahrespläne) bzw. 5 Tage (Monatspläne) vor Ablauf gekündigt wird. Der Kunde kann in den Kontoeinstellungen oder in Textform kündigen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt; der Anbieter kann zudem den Zugang bei Verstößen oder zur Abwehr erheblicher Schäden sperren. Der Anbieter kann den Vertrag mit 60 Tagen Frist ordentlich kündigen und erstattet dann anteilig vorausbezahlte Gebühren. Nach Vertragsende kann der Kunde seine Daten 30 Tage lang exportieren; danach werden sie gelöscht, soweit keine Aufbewahrungspflichten bestehen.</p>`
                },
                {
                    id: 'support-sla',
                    title: '9. Support, Wartung und Verfügbarkeit',
                    html: `<p>Der Anbieter leistet Support per E-Mail an <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a> im Rahmen des gewählten Plans. Wartungsarbeiten können zu kurzzeitigen Unterbrechungen führen. Der Anbieter bemüht sich um hohe Verfügbarkeit; zusätzliche Verfügbarkeitszusagen oder Gutschriften bestehen nur, wenn sie ausdrücklich vereinbart sind.</p>`
                },
                {
                    id: 'ki',
                    title: '10. KI-Funktionen',
                    html: `<p>KI-Funktionen verarbeiten die vom Nutzer veranlassten Eingaben über einen KI-Anbieter (siehe <a href="/de/datenschutz">Datenschutzerklärung</a>). KI-Ergebnisse können fehlerhaft, unvollständig oder unpassend sein und ersetzen keine fachliche, rechtliche oder sonstige Prüfung. Für die Nutzung der Ergebnisse ist der Kunde verantwortlich. Der Anbieter kann KI-Funktionen und -Anbieter ändern oder Nutzungslimits festlegen.</p>`
                },
                {
                    id: 'drittanbieter',
                    title: '11. Drittanbieter-Dienste und Integrationen',
                    html: `<p>Integrationen (z. B. GitHub, eigener Dateispeicher, API/MCP) unterliegen zusätzlich den Bedingungen des jeweiligen Drittanbieters. Für deren Verfügbarkeit und Inhalte ist der Anbieter nicht verantwortlich.</p>`
                },
                {
                    id: 'datenschutz',
                    title: '12. Datenschutz',
                    html: `<p>Die Verarbeitung personenbezogener Daten erfolgt gemäß der <a href="/de/datenschutz">Datenschutzerklärung</a>. Soweit der Anbieter im Auftrag des Kunden personenbezogene Daten verarbeitet, gilt die Auftragsverarbeitungsvereinbarung (Art. 28 DSGVO), die auf Anfrage unter <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a> bereitgestellt wird. Die Speicherung erfolgt vorrangig in der EU (Firestore eur3, Cloud Functions europe-west3).</p>`
                },
                {
                    id: 'kundendaten',
                    title: '13. Kundendaten, Vertraulichkeit und Sicherheit',
                    html: `<p>Die Rechte an den Kundendaten verbleiben beim Kunden. Der Kunde räumt dem Anbieter das Recht ein, diese Daten zur Erbringung des Service zu verarbeiten. Beide Parteien behandeln vertrauliche Informationen der jeweils anderen Partei vertraulich. Der Anbieter trifft angemessene technische und organisatorische Maßnahmen zum Schutz der Daten und informiert bei Datenschutzverletzungen entsprechend den gesetzlichen Pflichten. Kundendatensicherungen (Backups) schuldet der Anbieter nur im Rahmen der von ihm betriebenen Standardverfahren; der Kunde sollte wichtige Daten selbst exportieren.</p>`
                },
                {
                    id: 'ip',
                    title: '14. Geistiges Eigentum und Feedback',
                    html: `<p>Alle Rechte am Service, an der Software und an der Marke ProjectFlow verbleiben beim Anbieter. Rückmeldungen und Verbesserungsvorschläge darf der Anbieter ohne Vergütung nutzen.</p>`
                },
                {
                    id: 'gewaehrleistung',
                    title: '15. Gewährleistung',
                    html: `<p>Der Anbieter stellt den Service mit der erforderlichen Sorgfalt bereit. Mängel sind unverzüglich zu melden und werden in angemessener Frist behoben. Die verschuldensunabhängige Haftung für bei Vertragsschluss vorhandene Mängel (§ 536a Abs. 1 BGB) ist ausgeschlossen. Kostenlose Tests und Beta-Funktionen werden ohne Gewährleistung bereitgestellt, soweit gesetzlich zulässig.</p>`
                },
                {
                    id: 'haftung',
                    title: '16. Haftung',
                    html: `<p>Der Anbieter haftet unbeschränkt bei Vorsatz, Arglist, Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz und bei Übernahme einer Garantie. Bei einfacher Fahrlässigkeit haftet er nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den vertragstypisch vorhersehbaren Schaden. Die Gesamthaftung beider Parteien ist, außer in den vorgenannten Fällen, auf die vom Kunden in den zwölf Monaten vor dem schädigenden Ereignis gezahlten oder geschuldeten Gebühren begrenzt. Bei Datenverlust haftet der Anbieter nur in dem Umfang, in dem der Schaden auch bei regelmäßiger, gefahrentsprechender Datensicherung durch den Kunden eingetreten wäre. Die Haftung nach zwingendem Recht bleibt unberührt.</p>`
                },
                {
                    id: 'aenderungen',
                    title: '17. Änderungen des Service und der Bedingungen',
                    html: `<p>Der Anbieter kann diese Bedingungen mit angemessener Vorankündigung (mindestens 30 Tage, per E-Mail oder im Service) ändern. Widerspricht der Kunde nicht innerhalb dieser Frist, gelten die Änderungen als angenommen; der Anbieter weist in der Ankündigung auf diese Folge hin. Dem Kunden steht ein Sonderkündigungsrecht zum Wirksamwerden der Änderung zu.</p>`
                },
                {
                    id: 'compliance',
                    title: '18. Compliance, Exportkontrolle und Sanktionen',
                    html: `<p>Der Kunde hält die für seine Nutzung geltenden Gesetze ein, einschließlich Export- und Sanktionsvorschriften, und nutzt den Service nicht in sanktionierten Ländern oder für sanktionierte Personen.</p>`
                },
                {
                    id: 'recht',
                    title: '19. Anwendbares Recht und Gerichtsstand',
                    html: `<p>Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG). Ausschließlicher Gerichtsstand ist, soweit zulässig, der Sitz des Anbieters in Laberweinting, Deutschland. Zwingende Rechte am Sitz des Kunden bleiben unberührt.</p>`
                },
                {
                    id: 'sonstiges',
                    title: '20. Sonstiges',
                    html: `<p>Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt. Änderungen und Ergänzungen bedürfen der Textform. Der Kunde darf Rechte aus diesem Vertrag nur mit Zustimmung des Anbieters übertragen. Kontakt: <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a>.</p>`
                }
            ]
        }
    },
    en: {
        imprint: {
            title: 'Imprint',
            description: 'Legal notice and provider information for ProjectFlow (getprojectflow.com) pursuant to § 5 DDG.',
            updated: 'Last updated: October 23, 2026',
            intro: 'Information pursuant to § 5 DDG (German Digital Services Act)',
            sections: [
                {
                    id: 'provider',
                    title: 'Provider',
                    html: `<p>Christoph Labestin<br>Frühlingsstraße 8<br>84082 Laberweinting<br>Germany</p>`
                },
                {
                    id: 'business-name',
                    title: 'Business name',
                    html: `<p>ProjectFlow (brand / product name)</p>`
                },
                {
                    id: 'contact',
                    title: 'Contact',
                    html: `<p>Phone: +49 170 5853983<br>Email: <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a></p>`
                },
                {
                    id: 'vat',
                    title: 'VAT',
                    html: `<p>VAT identification number pursuant to § 27a UStG: no VAT identification number available.</p>`
                },
                {
                    id: 'responsible-content',
                    title: 'Responsible for content',
                    html: `<p>Responsible pursuant to § 18 (2) MStV:<br>Christoph Labestin, Frühlingsstraße 8, 84082 Laberweinting, Germany</p>`
                },
                {
                    id: 'dispute-resolution',
                    title: 'Dispute resolution',
                    html: `<p>We are neither obliged nor, as a rule, willing to participate in dispute resolution proceedings before a consumer arbitration board (§ 36 VSBG).</p>`
                },
                {
                    id: 'liability-content',
                    title: 'Liability for content',
                    html: `<p>As a service provider, we are responsible for our own content on these pages under general law. However, we cannot permanently guarantee that the content is current, complete and correct.</p>`
                },
                {
                    id: 'liability-links',
                    title: 'Liability for links',
                    html: `<p>Our offering contains links to external third-party websites over whose content we have no influence. We accept no liability for such third-party content. The respective provider or operator of the linked pages is always responsible for their content.</p>`
                },
                {
                    id: 'copyright',
                    title: 'Copyright',
                    html: `<p>Content and works created by the site operator on these pages are subject to German copyright law. Reproduction, editing, distribution and any kind of use beyond the limits of copyright law require the written consent of the respective author or creator.</p>`
                }
            ]
        },
        privacy: {
            title: 'Privacy Policy',
            description: 'How ProjectFlow processes personal data on the website, web app, iOS app and desktop app, and what rights you have under the GDPR.',
            updated: 'Last updated: October 23, 2026',
            intro: 'This privacy policy applies to the website getprojectflow.com, the web app at app.getprojectflow.com, the iOS app and the desktop app (macOS/Windows) of ProjectFlow.',
            sections: [
                {
                    id: 'controller',
                    title: '1. Controller',
                    html: `<p>The controller within the meaning of the GDPR is:</p><p>Christoph Labestin<br>Frühlingsstraße 8<br>84082 Laberweinting<br>Germany<br>Email: <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a></p><p>For content that customers store in their workspaces (for example data of team members or third parties), the customer or its organization is generally the controller and we act as a processor (see the Terms).</p>`
                },
                {
                    id: 'overview',
                    title: '2. Overview',
                    html: `<ul><li><strong>Website (getprojectflow.com):</strong> no cookies, no analytics or tracking tools, no third-party embeds, no contact form. Only technically necessary server logs are created.</li><li><strong>Web app, iOS app, desktop app:</strong> processing of account, workspace and project data to provide the service.</li></ul>`
                },
                {
                    id: 'website',
                    title: '3. Website getprojectflow.com',
                    html: `<p><strong>Hosting and server logs.</strong> The website is a static site served via Firebase Hosting (Google Ireland Limited / Google LLC). When you visit it, the following data is processed in server logs as technically required: IP address, date and time, requested URL and user agent. The purpose is secure and stable operation (Art. 6(1)(f) GDPR). Logs are deleted after about 14 days, or kept longer in the event of security incidents.</p><p><strong>Fonts.</strong> Fonts are served from our own domain; no connection is made to third-party font servers.</p><p><strong>Language preference.</strong> Your language choice may be stored in your browser's local storage (localStorage). This is technically necessary to remember your choice, is not transmitted to us and is not a cookie (Section 25(2) no. 2 TDDDG).</p><p><strong>Contact by email.</strong> The website links to our email address (mailto). If you write to us, we process your details to handle your request (Art. 6(1)(b) or (f) GDPR) and generally delete them within 12 months after the last correspondence unless retention obligations apply.</p>`
                },
                {
                    id: 'account-data',
                    title: '4. Account, authentication and profile',
                    html: `<p>To use the apps we process:</p><ul><li><strong>Account data:</strong> name, email address, optional profile picture, language settings.</li><li><strong>Sign-in data:</strong> sign-in through Firebase Authentication using email/password, Google sign-in or a passkey. We do not store passwords ourselves; they are managed (hashed) by Firebase Authentication.</li><li><strong>Passkeys (WebAuthn):</strong> we store the public key, credential ID and technical metadata. The private key stays on your device or with your passkey provider (e.g. iCloud Keychain); biometric data (Face ID/Touch ID) never leaves your device and is not processed by us.</li><li><strong>Workspace data:</strong> memberships, roles and permissions.</li></ul><p>Legal basis: performance of a contract (Art. 6(1)(b) GDPR).</p>`
                },
                {
                    id: 'content-data',
                    title: '5. Project and content data',
                    html: `<p>All content you or your team create in the service (such as projects, tasks, comments, flows/ideas, files, blog posts, settings) is stored to provide the service and enable collaboration in the workspace. It is visible only to people with the corresponding permission in the workspace. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).</p><p>Files are stored in Firebase Storage by default. Workspace administrators may optionally connect their own storage (Amazon S3 or Google Drive); in that case files are stored with that storage provider under its terms.</p>`
                },
                {
                    id: 'onboarding',
                    title: '6. Onboarding survey',
                    html: `<p>During setup you can answer questions about your role, use cases, team size, industry, how you heard about ProjectFlow and your previous tool. The answers are stored linked to your profile, used to tailor the service and evaluated by us in aggregated form to improve the product (Art. 6(1)(f) GDPR). Answering is voluntary; you can have your answers deleted at any time.</p>`
                },
                {
                    id: 'ai',
                    title: '7. AI features',
                    html: `<p>When you use AI features (such as text suggestions, AI search, ideation, image generation, assistant), we send your input and the workspace context needed for it through a cloud function (region europe-west3, Frankfurt) to an AI provider and return the response to you. We currently use models from OpenAI Ireland Ltd. / OpenAI, L.L.C. for this. Processing in the USA is possible. AI features run only when you request them. According to our information, we do not use content to train our own models; processing by the provider is governed by its API terms. Please do not enter data you are not allowed to transmit. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).</p>`
                },
                {
                    id: 'push',
                    title: '8. Notifications and push messages',
                    html: `<ul><li><strong>Email notifications</strong> (e.g. invitations, reminders, activity) are sent via an SMTP service (currently Google infrastructure). Email address and message content are processed.</li><li><strong>Push notifications (iOS):</strong> if you allow notifications, a device- and app-specific push token is stored and transmitted to the Apple Push Notification service (APNs) or Firebase Cloud Messaging so that Apple or Google can deliver the message. Notification text and badge count pass through these services. You can disable push notifications at any time in iOS settings or in the app; the token is then deleted.</li><li><strong>Live Activities (iOS)</strong> also use Apple's push infrastructure to display ongoing activities (e.g. focus timer).</li></ul><p>Legal basis: performance of a contract (Art. 6(1)(b) GDPR); for push notifications, your consent via the system prompt (Art. 6(1)(a) GDPR, Section 25(1) TDDDG).</p>`
                },
                {
                    id: 'ios-app',
                    title: '9. iOS app',
                    html: `<p>The iOS app uses the same account and content data as the web app. In addition:</p><ul><li><strong>Calendar (optional):</strong> with your permission the app reads events through Apple's calendar interface to show free time in weekly planning. Events are processed locally on the device and are not transmitted to our servers.</li><li><strong>Passkeys / Face ID:</strong> see Section 4.</li><li><strong>Photos/camera (optional):</strong> only when you yourself choose a profile picture or file.</li></ul><p>Apple processes data in its own responsibility in connection with the App Store, iCloud Keychain and APNs.</p>`
                },
                {
                    id: 'desktop-app',
                    title: '10. Desktop app (macOS/Windows)',
                    html: `<p>The desktop app (Electron) wraps the hosted web app; account and content data are processed as in the web app. In addition:</p><ul><li><strong>Calendar (optional, macOS):</strong> with your permission the app reads upcoming events locally to pause focus tasks and offer meeting notes. Events are not transmitted to our servers.</li><li><strong>Automatic updates:</strong> the app checks for and downloads new versions through GitHub Releases (GitHub, Inc., USA). For technical reasons GitHub receives your IP address and information on app version and operating system. Legal basis: legitimate interest in the security and currency of the software (Art. 6(1)(f) GDPR).</li><li>Local settings are stored on your device.</li></ul>`
                },
                {
                    id: 'integrations',
                    title: '11. Integrations',
                    html: `<p>If you or your workspace administrator enable integrations (e.g. GitHub task sync, custom file storage, API/MCP access), the data required for them is transmitted to or retrieved from the respective service. Credentials (tokens) are stored protected on the server side and deleted when the integration is disconnected. The third party's privacy terms additionally apply.</p>`
                },
                {
                    id: 'newsletter',
                    title: '12. Newsletter, waitlist, contact requests',
                    html: `<p>If you sign up for the newsletter or waitlist via the app or a landing page, or write to us through a contact form, we process your email address, name where provided and your message. Newsletter sign-ups use double opt-in based on your consent (Art. 6(1)(a) GDPR); after unsubscribing we keep a minimal suppression record for 3 years. Waitlist data is kept until 6 months after release, contact requests generally until 12 months after the last correspondence. There are currently no such forms on getprojectflow.com itself.</p>`
                },
                {
                    id: 'error-reports',
                    title: '13. Error reports',
                    html: `<p>The web app can, where enabled, send error reports (error message, stack trace, app version, browser/device) to Functional Software GmbH / Sentry to fix crashes (Art. 6(1)(f) GDPR). Without configuration no error reports are sent.</p>`
                },
                {
                    id: 'recipients',
                    title: '14. Recipients and processors',
                    html: `<p>We do not sell personal data. We use the following service providers, acting on our behalf under Art. 28 GDPR or as independent controllers:</p><ul><li><strong>Google Cloud / Firebase</strong> (Google Ireland Limited; Google LLC, USA): hosting, authentication, database (Firestore, location eur3/EU), file storage, cloud functions (region europe-west3, Frankfurt), push (FCM), email delivery (SMTP).</li><li><strong>OpenAI:</strong> processing of AI requests (see Section 7).</li><li><strong>Apple:</strong> APNs, App Store, possibly passkey sync.</li><li><strong>GitHub:</strong> delivery of desktop updates; optional integration.</li><li><strong>Sentry:</strong> optional error reports (Section 13).</li><li><strong>Payment service providers:</strong> where paid plans are offered, payment is handled by a payment service provider that processes payment data in its own responsibility. We do not store full payment instrument data.</li><li><strong>Other users</strong> of your workspace according to the roles and permissions granted.</li></ul>`
                },
                {
                    id: 'third-countries',
                    title: '15. Transfers to third countries',
                    html: `<p>Some providers (in particular Google LLC, OpenAI, Apple, GitHub) may process data in the USA. We rely on the EU-US Data Privacy Framework adequacy decision (where the provider is certified) or on the EU Commission's standard contractual clauses with supplementary measures. You can request a copy of the safeguards.</p>`
                },
                {
                    id: 'retention',
                    title: '16. Retention',
                    html: `<ul><li>Website server logs: about 14 days.</li><li>Account and content data: until the account or workspace is deleted; then deleted within a reasonable period unless legal retention obligations apply. Backups are overwritten in the regular cycle.</li><li>Push tokens: until notifications are disabled or the device signs out.</li><li>Email delivery logs: 90 days.</li><li>Integration tokens: until the integration is disconnected.</li><li>Billing and tax-relevant data: according to statutory periods (generally up to 10 years).</li></ul>`
                },
                {
                    id: 'rights',
                    title: '17. Your rights',
                    html: `<p>You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21 GDPR). You may withdraw consent at any time with effect for the future (Art. 7(3) GDPR). You also have the right to lodge a complaint with a supervisory authority (Art. 77 GDPR); the authority responsible for us is the Bavarian State Office for Data Protection Supervision (BayLDA).</p><p>To exercise your rights, write to <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a>. We generally respond within one month and may ask for proof of identity to prevent misuse. Providing data is required to use the service unless marked voluntary above.</p>`
                },
                {
                    id: 'changes',
                    title: '18. Changes',
                    html: `<p>We update this privacy policy when the service, providers or legal situation change. The version published here applies; the date of the last update is shown at the top.</p>`
                }
            ]
        },
        terms: {
            title: 'Terms of Service (SaaS Agreement)',
            description: 'Terms of service for ProjectFlow, the online project management service for businesses: accounts, plans, obligations, liability, term and data protection.',
            updated: 'Last updated: October 23, 2026',
            intro: 'Summary (non-binding): ProjectFlow is an online project management service for businesses (not consumers), offered by subscription. By registering, the business agrees to these terms.',
            sections: [
                {
                    id: 'scope',
                    title: '1. Parties and scope (B2B only)',
                    html: `<p>These terms apply between Christoph Labestin, Frühlingsstraße 8, 84082 Laberweinting, Germany ("Provider"), and the registering business ("Customer") for use of ProjectFlow ("Service"), including the web app, iOS app and desktop app.</p><p>The Service is intended exclusively for business users within the meaning of § 14 BGB. The Customer warrants that it is not a consumer and is authorized to bind the business. Consumer protection rights (e.g. right of withdrawal) do not apply. Conflicting terms of the Customer do not apply unless the Provider agrees in writing. Individual agreements (e.g. an order form) take precedence; for data protection matters the data processing agreement also applies (Section 12).</p>`
                },
                {
                    id: 'definitions',
                    title: '2. Definitions',
                    html: `<ul><li><strong>Workspace:</strong> the Customer's working area in which projects, tasks, flows and other content are managed.</li><li><strong>Users:</strong> persons to whom the Customer grants workspace access, with roles and permissions (e.g. administrator, member, guest).</li><li><strong>Customer Data:</strong> all content and data stored in the Service by the Customer or its Users.</li><li><strong>Subscription Plan:</strong> the booked package of features and usage limits (e.g. Starter, Professional, Organization).</li><li><strong>AI Features:</strong> optional features that send input to an AI provider to generate results.</li></ul>`
                },
                {
                    id: 'formation',
                    title: '3. Formation of contract, accounts, trial',
                    html: `<p>The contract is formed when the Customer completes registration and accepts these terms and the Provider activates the account or provides access. Registration details must be accurate. The Customer is responsible for its Users' activities and for the security of credentials. Affiliates may use the Service under the Customer's account provided the Customer ensures their compliance with these terms.</p><p>A free trial, if offered, lasts 14 days (unless communicated otherwise), is provided without warranty or SLA and may be ended at any time. Beta features are provided as is.</p>`
                },
                {
                    id: 'service',
                    title: '4. Service description and usage rights',
                    html: `<p>For the term of the contract, the Provider makes the Service available as software-as-a-service, with features such as workspaces, projects, tasks, flows (structured ideation), file sharing, permissions, optional modules, AI Features and integrations, each to the extent of the chosen Subscription Plan. The Customer receives a non-exclusive, non-transferable right, limited to the contract term, to use the Service for its own business purposes. The Provider may further develop the Service as long as core functionality is not materially reduced.</p>`
                },
                {
                    id: 'customer-duties',
                    title: '5. Customer obligations',
                    html: `<p>The Customer uses the Service lawfully and in accordance with these terms, keeps credentials secret, informs the Provider without delay of misuse, ensures it is entitled to process the data it submits (in particular personal data of third parties), and is responsible for roles and permissions in its workspace. The Customer reviews AI-generated results for accuracy and permissibility on its own responsibility before using them.</p>`
                },
                {
                    id: 'aup',
                    title: '6. Acceptable use',
                    html: `<p>Prohibited in particular are:</p><ul><li>unlawful, discriminatory, threatening or infringing content,</li><li>malware, attacks on security or availability, circumventing limits or access restrictions,</li><li>automated scraping outside the provided interfaces, reverse engineering (to the extent permitted by law),</li><li>reselling or making the Service available to third parties without consent,</li><li>using AI Features for unlawful purposes or in breach of the AI provider's usage policies.</li></ul><p>In case of violations the Provider may remove content or restrict access.</p>`
                },
                {
                    id: 'fees',
                    title: '7. Fees, payment and taxes',
                    html: `<p>The Customer pays the fees shown in the order form or the chosen Subscription Plan, generally recurring (monthly or yearly) in advance, plus applicable taxes. Payment may be processed through a payment service provider. In case of late payment, default interest accrues under statutory rules; after reminder and a deadline the Provider may suspend access. The Provider announces price changes at least 30 days before they take effect and they apply from the next term; the Customer may terminate until then. Upgrades take effect immediately (pro rata), downgrades at the end of the term. Fees are non-refundable to the extent permitted by law.</p>`
                },
                {
                    id: 'term',
                    title: '8. Term and termination',
                    html: `<p>The term equals the booked billing period and renews automatically for the same period unless terminated at least 30 days (annual plans) or 5 days (monthly plans) before it ends. The Customer can terminate in the account settings or in text form. The right to extraordinary termination for good cause remains unaffected; the Provider may also suspend access in case of violations or to prevent significant harm. The Provider may terminate for convenience with 60 days' notice and then refunds prepaid fees pro rata. After the contract ends, the Customer can export its data for 30 days; afterwards it is deleted unless retention obligations apply.</p>`
                },
                {
                    id: 'support',
                    title: '9. Support, maintenance and availability',
                    html: `<p>The Provider provides support by email at <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a> within the scope of the chosen plan. Maintenance may cause brief interruptions. The Provider endeavors to provide high availability; additional availability commitments or credits exist only if expressly agreed.</p>`
                },
                {
                    id: 'ai',
                    title: '10. AI Features',
                    html: `<p>AI Features process the inputs initiated by the User through an AI provider (see the <a href="/en/privacy">Privacy Policy</a>). AI results may be incorrect, incomplete or unsuitable and do not replace professional, legal or other review. The Customer is responsible for using the results. The Provider may change AI Features and providers or set usage limits.</p>`
                },
                {
                    id: 'third-party',
                    title: '11. Third-party services and integrations',
                    html: `<p>Integrations (e.g. GitHub, custom file storage, API/MCP) are additionally subject to the terms of the respective third party. The Provider is not responsible for their availability or content.</p>`
                },
                {
                    id: 'data-protection',
                    title: '12. Data protection',
                    html: `<p>Personal data is processed in accordance with the <a href="/en/privacy">Privacy Policy</a>. Where the Provider processes personal data on behalf of the Customer, the data processing agreement (Art. 28 GDPR) applies and is made available on request at <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a>. Data is stored primarily in the EU (Firestore eur3, cloud functions europe-west3).</p>`
                },
                {
                    id: 'customer-data',
                    title: '13. Customer Data, confidentiality and security',
                    html: `<p>Rights in Customer Data remain with the Customer. The Customer grants the Provider the right to process this data to provide the Service. Each party keeps the other party's confidential information confidential. The Provider takes appropriate technical and organizational measures to protect data and notifies of personal data breaches as required by law. The Provider owes backups only within its standard procedures; the Customer should export important data itself.</p>`
                },
                {
                    id: 'ip',
                    title: '14. Intellectual property and feedback',
                    html: `<p>All rights in the Service, the software and the ProjectFlow brand remain with the Provider. The Provider may use feedback and suggestions for improvement without compensation.</p>`
                },
                {
                    id: 'warranty',
                    title: '15. Warranty',
                    html: `<p>The Provider provides the Service with due care. Defects must be reported without delay and will be remedied within a reasonable period. Strict liability for defects existing at the time of contract (§ 536a (1) BGB) is excluded. Free trials and beta features are provided without warranty to the extent permitted by law.</p>`
                },
                {
                    id: 'liability',
                    title: '16. Liability',
                    html: `<p>The Provider is liable without limitation for intent, fraud, injury to life, body or health, under the Product Liability Act and when giving a guarantee. For simple negligence it is liable only for breach of essential contractual obligations, limited to the typically foreseeable damage. Except in the foregoing cases, each party's total liability is limited to the fees paid or owed by the Customer in the twelve months before the damaging event. In case of data loss, the Provider is liable only to the extent the damage would also have occurred had the Customer made regular, risk-appropriate backups. Liability under mandatory law remains unaffected.</p>`
                },
                {
                    id: 'changes',
                    title: '17. Changes to the Service and terms',
                    html: `<p>The Provider may change these terms with reasonable notice (at least 30 days, by email or in the Service). If the Customer does not object within that period, the changes are deemed accepted; the notice will point out this consequence. The Customer has a special right of termination effective when the change takes effect.</p>`
                },
                {
                    id: 'compliance',
                    title: '18. Compliance, export control and sanctions',
                    html: `<p>The Customer complies with the laws applicable to its use, including export and sanctions rules, and does not use the Service in sanctioned countries or for sanctioned persons.</p>`
                },
                {
                    id: 'governing-law',
                    title: '19. Governing law and jurisdiction',
                    html: `<p>German law applies, excluding the UN Convention on Contracts for the International Sale of Goods (CISG). To the extent permitted, the exclusive place of jurisdiction is the Provider's registered seat in Laberweinting, Germany. Mandatory rights at the Customer's seat remain unaffected.</p>`
                },
                {
                    id: 'misc',
                    title: '20. Miscellaneous',
                    html: `<p>If any provision is invalid, the remaining provisions remain valid. Amendments and additions require text form. The Customer may assign rights under this contract only with the Provider's consent. Contact: <a href="mailto:hello@getprojectflow.com">hello@getprojectflow.com</a>.</p>`
                }
            ]
        }
    }
};
