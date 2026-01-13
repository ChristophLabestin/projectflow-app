import { COMPANY_EMAIL, COMPANY_NAME, COMPANY_STREET, COMPANY_ZIP, COMPANY_CITY } from "@/config/company";
import { Translations } from "./legal-en";

export const de: Translations = {
    legal: {
        back: "Zurück zum Start",
        titles: { impressum: "Impressum", privacy: "Datenschutzerklärung", terms: "Nutzungsbedingungen / SaaS-Vertrag für ProjectFlow", appPrivacy: "App Datenschutzerklärung" },
        nav: { impressum: "Impressum", privacy: "Datenschutzerklärung", terms: "AGB", appPrivacy: "App Datenschutz" },
        errors: { termsMissing: "Fehler beim Laden der Nutzungsbedingungen. Uebersetzung fehlt moeglicherweise." },
        impressum: {
            intro: "Angaben gemäß § 5 DDG",
            providerTitle: "Anbieter",
            country: "Deutschland",
            businessTitle: "Geschäftsbezeichnung",
            businessName: "ProjectFlow (Marke / Produktname)",
            contactTitle: "Kontakt",
            phone: "Telefon: +49 170 5853983",
            email: "E-Mail: hello@getprojectflow.com",
            vatTitle: "Umsatzsteuer",
            vatIntro: "Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG:",
            noVat: "Keine Umsatzsteuer-Identifikationsnummer vorhanden.",
            responsibleTitle: "Verantwortlich für den Inhalt",
            responsibleIntro: "Verantwortlich gemäß § 18 Abs. 2 MStV:",
            disputeTitle: "Streitbeilegung / Verbraucherstreitbeilegung",
            disputeText: "Wir sind nicht verpflichtet und grundsätzlich nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen (§ 36 VSBG).",
            liabilityContentTitle: "Haftung für Inhalte",
            liabilityContentText: "Als Diensteanbieter sind wir gemäß den allgemeinen Gesetzen für eigene Inhalte auf diesen Seiten verantwortlich. Eine Haftung für die Aktualität, Vollständigkeit und Richtigkeit der Inhalte kann jedoch nicht dauerhaft gewährleistet werden.",
            liabilityLinksTitle: "Haftung für Links",
            liabilityLinksText: "Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte übernehmen wir keine Gewähr. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.",
            copyrightTitle: "Urheberrecht",
            copyrightText: "Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers."
        },
        privacy: {
            lastUpdated: "Zuletzt aktualisiert: 30. Dezember 2025",
            scope: {
                title: "1. Geltungsbereich",
                text: "Diese Datenschutzerklärung gilt für die ProjectFlow Marketing-Website / Landingpage unter getprojectflow.com (die \"Website\").",
                appNote: "Hinweis: Wenn Sie die ProjectFlow Webanwendung (app.getprojectflow.com) nutzen, gelten separate Datenschutzinformationen für die In-App-Verarbeitung."
            },
            controller: {
                title: "2. Verantwortlicher (Datenschutz)",
                text: "Der Verantwortliche für die Verarbeitung personenbezogener Daten auf dieser Website im Sinne der DSGVO ist:",
                name: `${COMPANY_NAME}`,
                street: `${COMPANY_STREET}`,
                city: `${COMPANY_ZIP} ${COMPANY_CITY}, Deutschland`,
                email: `E-Mail: **${COMPANY_EMAIL}**`
            },
            categories: {
                title: "3. Kategorien der von uns verarbeiteten personenbezogenen Daten",
                intro: "Wir können die folgenden Kategorien personenbezogener Daten erheben und verarbeiten:",
                accessData: {
                    title: "3.1 Website-Zugriffsdaten (Server-Logs)",
                    text: "Beim Zugriff auf die Website werden technische Daten automatisch verarbeitet, um die Website bereitzustellen und vor Angriffen zu schützen. Dazu gehören:",
                    items: [
                        "IP-Adresse (Internet-Protokoll-Adresse)",
                        "Datum und Uhrzeit des Zugriffs",
                        "Aufgerufene Seite/Ressource (besuchte URL)",
                        "Referrer-URL (die Seite, die auf unsere Website verwiesen hat, sofern vorhanden)",
                        "User-Agent-Informationen (Browser, Betriebssystem, Gerät)",
                        "Status-/Fehlercodes (z. B. HTTP-Statuscodes)"
                    ]
                },
                consentData: {
                    title: "3.2 Einwilligungsdaten (Cookie-Banner)",
                    text: "Da wir ein selbstentwickeltes Cookie-Banner verwenden, verarbeiten wir die Daten, die erforderlich sind, um Ihre Einwilligungsentscheidungen zu speichern und zu dokumentieren, wie z. B.:",
                    items: [
                        "Ihr Einwilligungsstatus je Kategorie (z. B. ob Sie Analytics zugestimmt haben)",
                        "Ein Zeitstempel Ihrer Entscheidung (und ggf. eine Banner-/Versionskennung)",
                        "Eine technische Kennung, um Ihre Wahl zu speichern (Cookie und/oder Local-Storage)"
                    ]
                },
                ga4Data: {
                    title: "3.3 Google Analytics 4 (GA4) Daten (nur mit Einwilligung)",
                    text: "Wenn Sie \"Analytics\"-Cookies zustimmen, verwenden wir Google Analytics 4, um Nutzungs- und Interaktionsdaten über Ihre Nutzung der Website zu erheben, z. B.:",
                    items: [
                        "Seitenaufrufe und Navigationspfad",
                        "Interaktionen mit Seitenelementen (z. B. Klicks, Scrolltiefe)",
                        "Geräte- und Browserinformationen",
                        "Ungefähre Standortdaten, abgeleitet von Ihrer IP (die nicht gespeichert wird - siehe unten)"
                    ],
                    ipNote: "**IP-Adressen:** Google gibt an, dass GA4 überhaupt keine IP-Adressen protokolliert oder speichert; jede IP-Adresse, die zur Geolokalisierung erhoben wird, wird bei EU-Nutzern anonymisiert und vor der Protokollierung verworfen."
                },
                newsletterData: {
                    title: "3.4 Newsletter-Anmeldedaten",
                    text: "Wenn Sie unseren Newsletter abonnieren, erheben wir die von Ihnen angegebenen Informationen zu diesem Zweck:",
                    items: [
                        "E-Mail-Adresse (erforderlich)",
                        "Vorname (optional)",
                        "Nachname (optional)",
                        "Geschlecht (optional)",
                        "Anrede (optional)"
                    ],
                    note: "(Wir nutzen das Double-Opt-In-Verfahren. Nach der Anmeldung erhalten Sie eine E-Mail, mit der Sie Ihr Newsletter-Abonnement bestätigen.)"
                },
                waitlistData: {
                    title: "3.5 Wartelisten-Anmeldedaten (Pre-Release)",
                    text: "Wenn Sie sich vor dem Produktstart auf unsere Warteliste setzen lassen, erheben wir:",
                    items: [
                        "Name (erforderlich)",
                        "E-Mail-Adresse (erforderlich)"
                    ],
                    note: "(Die Warteliste ist temporär und dient ausschließlich der Benachrichtigung zum Launch. Nach dem Launch wird sie gemäß Abschnitt Speicherdauer behandelt.)"
                },
                contactData: {
                    title: "3.6 Kontaktformular-Anfragen",
                    text: "Wenn Sie uns über das Kontaktformular eine Nachricht senden, erheben wir die von Ihnen angegebenen Informationen:",
                    items: [
                        "Name (erforderlich)",
                        "E-Mail-Adresse (erforderlich)",
                        "Nachrichteninhalt (Inhalt Ihrer Anfrage)"
                    ],
                    note: "Wir verwenden diese Informationen ausschließlich, um Ihre Anfrage zu beantworten und zu bearbeiten."
                }
            },
            legalBases: {
                title: "4. Zwecke und Rechtsgrundlagen der Verarbeitung",
                intro: "Wir verarbeiten Ihre personenbezogenen Daten zu den folgenden Zwecken und stützen uns dabei auf die jeweiligen Rechtsgrundlagen der DSGVO:",
                operation: {
                    title: "4.1 Website-Betrieb, Stabilität und Sicherheit",
                    purpose: "**Zweck:** Bereitstellung der Website, Stabilität und Performance, Missbrauchsprävention sowie Erkennung und Behebung technischer Probleme.",
                    basis: "**Rechtsgrundlage:** Art. 6(1)(f) DSGVO - unsere berechtigten Interessen an einem sicheren und funktionsfähigen Website-Betrieb."
                },
                cookies: {
                    title: "4.2 Einwilligungsmanagement für Cookies",
                    purpose: "**Zweck:** Speicherung und Dokumentation Ihrer Cookie-/Analytics-Präferenzen sowie Ermöglichung von Änderungen/Widerruf.",
                    basis: "**Rechtsgrundlage:** Art. 6(1)(c) DSGVO - Erfüllung gesetzlicher Pflichten (soweit einschlägig) sowie Art. 6(1)(f) DSGVO - unser berechtigtes Interesse an Compliance und Dokumentation.",
                    note: "Hinweis: Das Speichern oder Auslesen nicht notwendiger Informationen auf Ihrem Endgerät (z. B. Analytics-Cookies) erfordert nach deutschem Recht eine Einwilligung gemäß § 25(1) TTDSG."
                },
                ga4: {
                    title: "4.3 Google Analytics (Website-Analytik)",
                    purpose: "**Zweck:** Reichweiten- und Nutzungsanalyse der Website, um Nutzungsmuster zu verstehen und Inhalte/Services zu verbessern.",
                    basis: "**Rechtsgrundlage:** Art. 6(1)(a) DSGVO - Ihre Einwilligung (Analytics erfolgt nur nach Opt-in). Zusätzlich Einwilligung nach § 25(1) TTDSG für Analytics-Cookies/Identifier."
                },
                newsletter: {
                    title: "4.4 Newsletter-E-Mails",
                    purpose: "**Zweck:** Zusendung von Produkt-Updates und Informationen, die Sie durch das Newsletter-Abonnement angefordert haben.",
                    basis: "**Rechtsgrundlage:** Art. 6(1)(a) DSGVO - Ihre Einwilligung.",
                    note: "Sie erhalten den Newsletter nur nach freiwilliger Einwilligung und können diese jederzeit durch Abmeldung widerrufen."
                },
                waitlist: {
                    title: "4.5 Wartelisten-Benachrichtigungen",
                    purpose: "**Zweck:** Information über Produktlaunch und Onboarding beim Release.",
                    basis: "**Rechtsgrundlage:** Art. 6(1)(a) DSGVO - Ihre Einwilligung."
                },
                contact: {
                    title: "4.6 Kontaktformular-Anfragen",
                    purpose: "**Zweck:** Kommunikation mit Ihnen und Bearbeitung der von Ihnen übermittelten Anfrage.",
                    basis: "**Rechtsgrundlage:** Art. 6(1)(f) DSGVO - unser berechtigtes Interesse an der Beantwortung von Kundenanfragen und der Pflege von Kundenbeziehungen. Wenn Ihre Anfrage auf einen Vertragsabschluss oder vorvertragliche Informationen abzielt, kann die Verarbeitung auch als vorvertragliche Maßnahme nach Art. 6(1)(b) DSGVO erfolgen."
                }
            },
            cookies: {
                title: "5. Cookies und Local Storage",
                intro: "Wir verwenden Cookies und ähnliche Local-Storage-Technologien auf der Website wie folgt:",
                essential: {
                    title: "5.1 Essenzielle Cookies/Technologien",
                    text: "Dies sind Cookies oder Local-Storage-Einträge, die für die Kernfunktionalität und Sicherheit der Website notwendig sind. Zum Beispiel verwenden wir essenzielle Cookies/Storage, um:",
                    items: [
                        "Ihre Cookie-Präferenzen zu speichern",
                        "Grundlegende Website-Funktionen und Sicherheitsmaßnahmen bereitzustellen"
                    ],
                    note: "Solche essenziellen Technologien werden ohne Einwilligung eingesetzt, soweit dies nach § 25(2) TTDSG zulässig ist, und beruhen auf Art. 6(1)(f) DSGVO (berechtigte Interessen an einem sicheren, nutzerfreundlichen Betrieb)."
                },
                analytics: {
                    title: "5.2 Analytics-Cookies (GA4)",
                    text: "Wir setzen Google-Analytics-Cookies nur ein, wenn Sie ausdrücklich zustimmen. Diese Cookies bleiben inaktiv, bis Sie über das Cookie-Banner einwilligen. Wenn Sie ablehnen oder das Banner ignorieren, werden keine GA4-Daten erhoben. Google Analytics 4 wird also erst nach Opt-in aktiviert."
                },
                withdraw: {
                    title: "5.3 Einwilligung ändern oder widerrufen",
                    text: "Sie können Ihre Cookie-Einstellungen jederzeit mit Wirkung für die Zukunft ändern oder Ihre Einwilligung widerrufen.",
                    link: "Nutzen Sie den **Cookie-Einstellungen**-Link auf unserer Website (z. B. im Footer). Sobald Sie Ihre Präferenzen anpassen, berücksichtigen wir diese und stoppen nicht notwendige Verarbeitung bei Widerruf."
                }
            },
            ga4Details: {
                title: "6. Google Analytics 4 (GA4) Details",
                intro: "Dieser Abschnitt enthält zusätzliche Informationen zu unserem Einsatz von Google Analytics 4, sofern Sie Analytics zustimmen:",
                provider: {
                    title: "6.1 Anbieterinformationen",
                    text: "Google Analytics wird in Europa bereitgestellt von:",
                    address: "**Google Ireland Limited**, Gordon House, Barrow Street, Dublin 4, Irland (Tochtergesellschaft von Google LLC mit Sitz in den USA)."
                },
                config: {
                    title: "6.2 Konfiguration und Datenschutzmaßnahmen",
                    text: "Wir haben GA4 mit datenschutzfreundlichen Einstellungen konfiguriert (Standardkonfiguration mit IP-Anonymisierung). Insbesondere:",
                    items: [
                        "Google Signals: **Deaktiviert** (wir kombinieren Analytics-Daten nicht mit Ihrem Google-Konto)",
                        "Ads-Personalisierung: **Deaktiviert** (keine Werbe- oder Cross-Site-Tracking-Nutzung)",
                        "Granulare Standort-/Gerätedaten-Erhebung: **Aktiviert** (ermöglicht generalisierte Standort- und Gerätekontrollen zum Schutz der Privatsphäre)"
                    ]
                },
                retention: {
                    title: "6.3 Aufbewahrung in Google Analytics",
                    text: "Wir haben GA4 so konfiguriert, dass nutzerbezogene Daten (Cookies/Identifier) maximal **2 Monate** gespeichert werden. Ältere Analytics-Daten werden automatisch rollierend gelöscht. Diese minimale Aufbewahrung reduziert die Dauer, in der identifizierbare Analytics-Informationen bestehen."
                }
            },
            email: {
                title: "7. E-Mail-Versand (Newsletter und Warteliste)",
                text: "Unsere Newsletter- und Wartelisten-Bestätigungs-E-Mails werden derzeit über einen eigenentwickelten Dienst versendet, der Googles SMTP-Server nutzt (d. h. wir verwenden Googles E-Mail-Infrastruktur für den Versand). Dadurch können Ihre E-Mail-Adresse und der E-Mail-Inhalt von Google verarbeitet werden, während die Nachricht an Ihr Postfach übertragen wird. Wir nutzen derzeit keine externe E-Mail-Marketing-Plattform; die E-Mails werden direkt aus unserem System über Google versendet.",
                note: "Hinweis: Wir planen, künftig auf einen selbstgehosteten E-Mail-Service umzusteigen. Sobald sich unser Anbieter ändert, aktualisieren wir diese Datenschutzerklärung."
            },
            recipients: {
                title: "8. Empfänger und Auftragsverarbeiter",
                text: "Wir verkaufen Ihre personenbezogenen Daten nicht an Dritte. Wir nutzen jedoch vertrauenswürdige Dienstleister, um unsere Website und Services zu betreiben. Je nach genutzter Funktion können Daten an folgende Kategorien von Empfängern übermittelt oder von ihnen verarbeitet werden:",
                items: [
                    "**Google (Analytics):** Wenn Sie Analytics zustimmen, erhebt Google über Google Analytics 4 Nutzungsdaten (siehe Abschnitt 3.3). Google Ireland Limited (EU) stellt den Dienst bereit, Daten können jedoch auch von Google LLC in den USA verarbeitet werden. Google agiert als Auftragsverarbeiter für Analytics.",
                    "**Google (Hosting & E-Mail-Services):** Unsere Website und das Backend (inkl. Datenbanken für Kontaktformular, Newsletter/Warteliste) laufen auf Google Firebase / Google Cloud (EU oder USA). Zudem verwenden wir Googles E-Mail-Server für den Versand. Google verarbeitet Daten als Auftragsverarbeiter in unserem Auftrag.",
                    "**Soziale Netzwerke:** Unsere Website kann Links zu externen Social-Media-Plattformen (z. B. LinkedIn oder Twitter) enthalten. Beim Anklicken werden Sie zur jeweiligen Plattform weitergeleitet. Über unsere Website teilen wir keine personenbezogenen Daten mit diesen Plattformen. Dort gelten die jeweiligen Datenschutzrichtlinien."
                ],
                note: "Alle Dienstleister handeln in unserem Auftrag und sind vertraglich verpflichtet, personenbezogene Daten nur nach unseren Weisungen und DSGVO-konform zu verarbeiten (inkl. Art. 28 AVV, soweit erforderlich)."
            },
            transfers: {
                title: "9. Internationale Datenübermittlungen",
                text: "Einige Dienstleister können Daten außerhalb des Europäischen Wirtschaftsraums (EWR) verarbeiten, insbesondere in den USA. Bei Übermittlungen stellen wir geeignete Garantien sicher, z. B. Angemessenheitsmechanismen wie das EU-US Data Privacy Framework oder Standardvertragsklauseln (SCCs) der EU-Kommission mit ergänzenden Maßnahmen. Bei Fragen oder für eine Kopie der Schutzmaßnahmen kontaktieren Sie uns bitte."
            },
            retention: {
                title: "10. Speicherdauer (Wie lange wir Daten aufbewahren)",
                intro: "Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Pflichten dies verlangen. Konkrete Aufbewahrungsfristen:",
                logs: {
                    title: "10.1 Server-Logs",
                    text: "Server-Log-Daten (einschließlich IP-Adressen) werden etwa **14 Tage** gespeichert und anschließend automatisch gelöscht. Eine längere Aufbewahrung erfolgt nur bei Sicherheitsvorfällen oder Missbrauch."
                },
                consent: {
                    title: "10.2 Cookie-Einwilligungsdatensätze",
                    text: "Nachweise Ihrer Cookie-Einwilligung werden **3 Jahre** ab der letzten Einwilligungsaktion gespeichert, um Compliance zu belegen."
                },
                ga4: {
                    title: "10.3 Google-Analytics-Daten",
                    text: "GA4-Daten werden von Google gemäß unserer Einstellung bis zu **2 Monate** gespeichert und automatisch rollierend gelöscht. Aggregierte Berichte ohne Personenbezug können länger aufbewahrt werden."
                },
                newsletter: {
                    title: "10.4 Newsletter-Daten",
                    items: [
                        "Ihre E-Mail-Adresse (und optionale Profilangaben) speichern wir, solange Sie den Newsletter abonniert haben.",
                        "Nach Abmeldung behalten wir einen minimalen Sperrvermerk (E-Mail und Abmeldehinweis) für **3 Jahre**, um den Opt-out zu respektieren und Compliance nachzuweisen."
                    ],
                    note: "Optionale Angaben (z. B. Vorname, Nachname, Geschlecht, Anrede) werden bei Abmeldung gelöscht oder anonymisiert, sofern keine gesetzliche Aufbewahrungspflicht besteht."
                },
                waitlist: {
                    title: "10.5 Wartelisten-Daten",
                    text: "Wartelisten-Daten (Name, E-Mail) speichern wir bis zum offiziellen Release und bis zu **6 Monate** danach. Wenn Sie zusätzlich den Newsletter abonniert haben, gilt die Newsletter-Aufbewahrung."
                },
                emailLogs: {
                    title: "10.6 E-Mail-Versandprotokolle",
                    text: "Einfache Versandprotokolle (Zeitstempel, Empfänger, Status) werden **90 Tage** zur Fehleranalyse und Missbrauchsprävention gespeichert. E-Mail-Inhalte werden dabei in der Regel nicht gespeichert."
                },
                contact: {
                    title: "10.7 Kontaktformular-Anfragen",
                    text: "Kontaktanfragen (Name, E-Mail, Nachricht) speichern wir nur so lange, wie es zur Bearbeitung erforderlich ist. In der Regel löschen wir Kontaktanfragen innerhalb von **12 Monaten** nach der letzten Korrespondenz, es sei denn, rechtliche Gründe erfordern eine längere Aufbewahrung (z. B. zur Rechtsverteidigung)."
                }
            },
            rights: {
                title: "11. Ihre Rechte nach DSGVO",
                text: "Unter der DSGVO haben Sie folgende Rechte in Bezug auf Ihre personenbezogenen Daten:",
                items: [
                    "Auskunft (Art. 15 DSGVO): Bestätigung und Kopie Ihrer Daten sowie Informationen zu Nutzung, Empfängern, Speicherdauer und Schutzmaßnahmen.",
                    "Berichtigung (Art. 16 DSGVO): Korrektur unrichtiger oder unvollständiger Daten.",
                    "Löschung (Art. 17 DSGVO): Löschung, wenn Daten nicht mehr erforderlich sind oder keine Rechtsgrundlage besteht (mit Ausnahmen).",
                    "Einschränkung der Verarbeitung (Art. 18 DSGVO): Einschränkung unter bestimmten Voraussetzungen.",
                    "Datenübertragbarkeit (Art. 20 DSGVO): Bereitstellung Ihrer Daten in einem strukturierten, gängigen, maschinenlesbaren Format und Übermittlung, soweit technisch möglich.",
                    "Widerspruch (Art. 21 DSGVO): Widerspruch gegen Verarbeitung auf Basis berechtigter Interessen; wir stellen dann ein, sofern keine zwingenden Gründe oder Rechtsansprüche vorliegen. Widerspruch gegen Direktwerbung ist jederzeit möglich.",
                    "Widerruf der Einwilligung (Art. 7(3) DSGVO): Widerruf jederzeit ohne Wirkung auf frühere rechtmäßige Verarbeitung.",
                    "Beschwerde (Art. 77 DSGVO): Beschwerde bei einer Aufsichtsbehörde im EU-Mitgliedstaat."
                ],
                contact: "Ausübung Ihrer Rechte: Sie können Ihre Rechte jederzeit unter **hello@getprojectflow.com** geltend machen. Wir können eine Identitätsprüfung verlangen, um Missbrauch zu verhindern. Wir antworten so schnell wie möglich, spätestens innerhalb der gesetzlichen Fristen (in der Regel ein Monat, verlängerbar um zwei weitere Monate). Für Anfragen fallen keine Gebühren an, es sei denn, sie sind offensichtlich unbegründet oder exzessiv."
            },
            updates: {
                title: "12. Aktualisierungen dieser Datenschutzerklärung",
                text: "Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren, um Änderungen unserer Prozesse, der Website oder gesetzlicher Anforderungen zu berücksichtigen. Bei Änderungen aktualisieren wir das Datum \"Zuletzt aktualisiert\" und informieren bei wesentlichen Änderungen ggf. zusätzlich. Diese Datenschutzerklärung gilt ab dem oben genannten Datum. Durch die weitere Nutzung der Website nach Inkrafttreten von Änderungen gilt die aktualisierte Version als akzeptiert, soweit rechtlich zulässig. Wenn Sie nicht einverstanden sind, sollten Sie die Website nicht weiter nutzen und ggf. Ihre Einwilligung widerrufen. Bei Fragen kontaktieren Sie uns unter hello@getprojectflow.com."
            }
        },
        terms: {
            summary: {
                title: "Zusammenfassung in einfacher Sprache (nicht verbindlich)",
                text: `Diese Zusammenfassung dient der Orientierung und ist nicht Teil der rechtlichen Vereinbarung. ProjectFlow ist ein Online-Projektmanagement-Softwaredienst, der Unternehmen (keine Verbraucher) im Abonnement angeboten wird. Durch die Registrierung stimmt ein Unternehmen (Kunde) diesen Bedingungen zu. Nur B2B: Der Dienst ist für die geschäftliche Nutzung durch Unternehmen bestimmt; eine Nutzung durch Verbraucher ist nicht zulässig. Kunden zahlen wiederkehrende Gebühren (monatlich oder jährlich) für den Zugang zu verschiedenen Plänen (z. B. Starter, Professional, Organization). Der Dienst umfasst Funktionen wie Workspaces, Projekte, Aufgaben, Dateifreigabe und optionale KI-gestützte Tools zur Projektverwaltung. Wir behandeln Kundendaten vertraulich und sicher und agieren als Auftragsverarbeiter für personenbezogene Daten, die Sie hochladen, gemäß DSGVO. Kunden behalten die Eigentumsrechte an ihren Daten und wir nutzen sie ausschließlich zur Bereitstellung des Dienstes (zuzüglich der beschriebenen Analysen). Wir streben eine Verfügbarkeit von ca. 99,5 % an und reagieren in der Regel innerhalb von 24 Stunden auf Support-Anfragen. Wir können den Dienst im Laufe der Zeit ändern und informieren über wichtige Änderungen an Funktionen oder Bedingungen. Beide Parteien können das Abonnement beenden: Sie können gemäß der vereinbarten Laufzeit kündigen und wir können aus bestimmten schwerwiegenden Gründen kündigen. Bereits gezahlte Gebühren werden nicht erstattet (außer wenn das Gesetz dies verlangt oder wir im Einzelfall anders entscheiden). Unsere Haftung ist begrenzt - wir haften für Vorsatz und grobe Fahrlässigkeit, im Übrigen ist die Haftung auf einen angemessenen Betrag begrenzt. Es gibt eine Acceptable Use Policy gegen Missbrauch (keine illegalen Inhalte, kein Hacking usw.) sowie eine Auftragsverarbeitungsvereinbarung zur DSGVO-Compliance. Es gilt deutsches Recht, und Streitigkeiten werden vor den deutschen Gerichten am Sitz unseres Unternehmens ausgetragen (zwingendes Recht bleibt unberührt). Bitte lesen Sie die vollständigen Bedingungen unten für alle Details.`
            },
            sections: [
                {
                    title: "1. Einleitung, Parteien und B2B-Only-Anwendungsbereich",
                    blocks: [
                        {
                            type: "p",
                            text: `**1.1 Parteien.** Diese Software-as-a-Service-Nutzungsbedingungen ("Vertrag") werden geschlossen zwischen ${COMPANY_NAME}, mit Sitz in ${COMPANY_STREET}, ${COMPANY_ZIP} ${COMPANY_CITY}, Deutschland, ("Anbieter", "wir" oder "uns") und dem abonnierenden Unternehmen ("Kunde" oder "Sie"). Dieser Vertrag regelt den Zugriff des Kunden auf den ProjectFlow Online-Softwaredienst ("Service") und dessen Nutzung. Wirksamkeitsdatum: Dieser Vertrag gilt ab dem [Effective Date] (dem "Wirksamkeitsdatum").`
                        },
                        {
                            type: "p",
                            text: `**1.2 Nur B2B - Keine Verbraucher.** Dieser Vertrag gilt ausschließlich für Business-to-Business-Geschäfte. Der Kunde sichert zu und gewährleistet, dass er kein Verbraucher (Verbraucher), sondern ein Unternehmen oder Unternehmer im Sinne von § 14 BGB oder vergleichbarem Recht ist. Mit Annahme dieses Vertrags bestätigt die handelnde Person, dass sie befugt ist, das Kundenunternehmen zu binden. Keine Verbraucherrechte: Verbraucherschutzvorschriften (wie Widerrufs- oder Rücktrittsrechte nach EU-Verbraucherrecht) gelten für diesen Vertrag nicht. Wenn eine Person, die Verbraucher ist (kein Unternehmen), diesen Vertrag irrtümlich abschließt oder sich für den Service registriert, behält sich der Anbieter das Recht vor, das Konto zu beenden und bereits gezahlte Gebühren nach Ermessen des Anbieters zu erstatten.`
                        },
                        {
                            type: "p",
                            text: `**1.3 Einbeziehung durch Verweis.** Zusätzliche Dokumente sind Bestandteil dieses Vertrags:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) jedes Bestellformular oder Online-Anmeldeformular des Kunden, das auf diesen Vertrag verweist,`,
                                `(b) die Auftragsverarbeitungsvereinbarung ("DPA" oder "AVV") als Anhang C (anwendbar, wenn der Kunde personenbezogene Daten zur Verarbeitung bereitstellt),`,
                                `(c) die Acceptable Use Policy in Anhang A, und`,
                                `(d) sofern zutreffend, ein Service Level Agreement (SLA) oder eine Support-Richtlinie in Anhang B.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Im Konfliktfall haben ein Bestellformular oder individuell ausgehandelte Vertragsbedingungen Vorrang vor diesem Vertrag, und die DPA hat Vorrang hinsichtlich datenschutzrechtlicher Fragen. Dieser Vertrag und alle Anhänge bilden die gesamte Vereinbarung zwischen Anbieter und Kunde in Bezug auf den Service und ersetzen alle vorherigen Absprachen oder Mitteilungen. Einkaufsbedingungen oder sonstige Bedingungen des Kunden sind nicht bindend und werden hiermit zurückgewiesen, sofern sie nicht ausdrücklich schriftlich vom Anbieter akzeptiert wurden.`
                        }
                    ]
                },
                {
                    title: "2. Definitionen",
                    blocks: [
                        {
                            type: "p",
                            text: `**2.1 "Service"** bezeichnet das Projektmanagement-Software-as-a-Service-Produkt "ProjectFlow", einschließlich seiner Webanwendung, APIs, mobilen Apps oder sonstiger Software, die vom Anbieter bereitgestellt wird, sowie aller zugehörigen Dokumentationen, Tools oder Websites, die vom Anbieter für die Nutzung des Services betrieben werden.`
                        },
                        {
                            type: "p",
                            text: `**2.2 "Customer Data"** bezeichnet alle Daten, Informationen, Dateien und Inhalte, die der Kunde oder seine autorisierten Nutzer (siehe unten) in den Service hochladen, übermitteln oder dort speichern, einschließlich Texten, Bildern, Dateien, Anhängen, Aufgaben, Kommentaren, Projektinformationen sowie personenbezogenen Daten von Mitarbeitern oder Endnutzern des Kunden.`
                        },
                        {
                            type: "p",
                            text: `**2.3 "Authorized Users"** bezeichnet Personen, die vom Kunden zur Nutzung des Services im Rahmen seines Kontos berechtigt sind, z. B. Mitarbeiter, Auftragnehmer oder sonstiges Personal. Autorisierte Nutzer können auch verbundene Unternehmen des Kunden (siehe unten) oder Kunden des Kunden sein, sofern dies vom Abonnement erlaubt ist.`
                        },
                        {
                            type: "p",
                            text: `**2.4 "Affiliate"** bezeichnet jede Einheit, die eine Partei direkt oder indirekt kontrolliert, von ihr kontrolliert wird oder unter gemeinsamer Kontrolle steht, wobei "Kontrolle" den Besitz von mehr als 50 % der Kapital- oder Stimmrechtsanteile bedeutet.`
                        },
                        {
                            type: "p",
                            text: `**2.5 "Order Form"** bezeichnet jedes Bestelldokument, Online-Anmeldeformular oder jede Abonnementbestätigung, die auf diesen Vertrag Bezug nimmt und den konkreten Abonnementplan, die Laufzeit und die Preise für den vom Kunden gewählten Service festlegt.`
                        },
                        {
                            type: "p",
                            text: `**2.6 "Subscription Plan"** bezeichnet das konkrete Paket von Funktionen und Nutzungslimits, für das der Kunde den Service abonniert (z. B. Starter, Professional, Organization), wie auf der Website des Anbieters oder im Bestellformular beschrieben, und das die anwendbaren Gebühren bestimmt.`
                        },
                        {
                            type: "p",
                            text: `**2.7 "Fees"** bezeichnet die Abonnementgebühren und sonstigen Gebühren, die der Kunde für den Zugang zum Service im gewählten Abonnementplan zu zahlen hat, wie im Bestellformular oder auf der Preisseite des Anbieters angegeben, exklusive Steuern.`
                        },
                        {
                            type: "p",
                            text: `**2.8 "Acceptable Use Policy"** oder "AUP" bezeichnet die Regeln des Anbieters für die zulässige Nutzung des Services gemäß Anhang A, die bestimmtes Verhalten und Inhalte in Verbindung mit dem Service untersagen.`
                        },
                        {
                            type: "p",
                            text: `**2.9 "Data Processing Addendum"** oder "DPA" (auf Deutsch: Auftragsverarbeitungsvereinbarung oder "AVV") bezeichnet den ergänzenden Vertrag zwischen Kunde (als Verantwortlicher) und Anbieter (als Auftragsverarbeiter) zur Verarbeitung personenbezogener Daten im Service gemäß Art. 28 DSGVO, der als Anhang C beigefügt ist.`
                        },
                        {
                            type: "p",
                            text: `**2.10 "Confidential Information"** hat die in Abschnitt 13 (Vertraulichkeit) festgelegte Bedeutung.`
                        },
                        {
                            type: "p",
                            text: `**2.11 "Intellectual Property Rights"** bezeichnet alle Formen von geistigen Eigentums- und Schutzrechten weltweit, einschließlich Urheberrechte, Datenbankrechte, Patente, Geschäftsgeheimnisse, Know-how und Marken.`
                        },
                        {
                            type: "p",
                            text: `**2.12** Weitere großgeschriebene Begriffe können an anderer Stelle in diesem Vertrag definiert werden (z. B. im Kontext ihrer ersten Verwendung). Alle Verweise auf Gesetzesvorschriften beziehen sich auf diese in ihrer jeweils geänderten oder neu gefassten Fassung.`
                        }
                    ]
                },
                {
                    title: "3. Vertragsschluss; Konten; Kostenloser Test",
                    blocks: [
                        {
                            type: "p",
                            text: `**3.1 Registrierung und Annahme.** Um den Service zu nutzen, muss der Kunde ein Konto registrieren, indem er korrekte Unternehmensinformationen angibt und diesen Vertrag akzeptiert (z. B. durch Anklicken von "I Agree" oder Unterzeichnung eines Bestellformulars). Durch Abschluss des Anmelde- oder Bestellprozesses macht der Kunde ein Angebot zum Vertragsschluss zu den vorgelegten Bedingungen, das der Anbieter entweder (a) durch ausdrückliche Bestätigung (z. B. Willkommens-E-Mail oder Gegenzeichnung eines Bestellformulars) oder (b) durch Bereitstellung des Services annimmt. In diesem Zeitpunkt kommt ein verbindlicher Vertrag zwischen Anbieter und Kunde zustande, bestehend aus diesem Vertrag und etwaigen Bestellformularen.`
                        },
                        {
                            type: "p",
                            text: `**3.2 Nutzung durch verbundene Unternehmen.** Verbundene Unternehmen des Kunden können den Service unter dem Konto des Kunden nutzen, sofern (a) der Kunde sicherstellt, dass jedes verbundene Unternehmen bzw. jeder Nutzer diesen Vertrag einhält, und (b) der Kunde für Handlungen seiner verbundenen Unternehmen und autorisierten Nutzer verantwortlich bleibt. Alternativ kann ein verbundenes Unternehmen des Kunden ein eigenes Bestellformular unter diesem Vertrag abschließen und gilt dann als eigenständiger Kunde.`
                        },
                        {
                            type: "p",
                            text: `**3.3 Kostenloser Test.** Registriert der Kunde einen kostenlosen Test, beträgt die Testlaufzeit 14 Tage (sofern der Anbieter sie nicht nach eigenem Ermessen verlängert oder vorzeitig beendet). Während des Tests wird der Service "AS IS" ohne Gewährleistung oder SLA bereitgestellt und kann nur eingeschränkten Support umfassen. Beide Parteien können den Test jederzeit beenden. Nach Ablauf des Tests muss der Kunde einen kostenpflichtigen Abonnementplan erwerben, um den Service weiter zu nutzen; andernfalls kann das Konto deaktiviert oder herabgestuft werden. Während des Tests eingegebene Kundendaten können dauerhaft verloren gehen, sofern der Kunde nicht vor Ablauf in einen kostenpflichtigen Plan wechselt. Der Anbieter haftet nicht für einen solchen Datenverlust.`
                        },
                        {
                            type: "p",
                            text: `**3.4 Updates und Beta-Funktionen.** Der Kunde erkennt an, dass sich der Service kontinuierlich weiterentwickeln kann. Der Anbieter kann Updates, Upgrades, Ergänzungen oder Änderungen am Service vornehmen (einschließlich Hinzufügen oder Entfernen von Funktionen), sofern die Kernfunktionalität des vom Kunden erworbenen Services nicht wesentlich reduziert wird. Der Anbieter kann auch Zugang zu Beta- oder experimentellen Funktionen oder separaten Modulen ("Beta-Funktionen") zu Testzwecken anbieten. Beta-Funktionen werden optional, "as is" und ohne Gewähr oder Zusage bereitgestellt und können jederzeit geändert oder eingestellt werden. Die Nutzung von Beta-Funktionen erfolgt nach Ermessen und auf Risiko des Kunden; der Kunde stellt auf Anfrage angemessenes Feedback bereit.`
                        },
                        {
                            type: "p",
                            text: `**3.5 Dienste und Komponenten Dritter.** Der Service kann Integrationen oder Kompatibilität mit Diensten Dritter (z. B. Integrationen über APIs) beinhalten oder Softwarekomponenten Dritter (einschließlich Open-Source-Bibliotheken) enthalten. Die Nutzung von Diensten oder Software Dritter durch den Kunden kann separaten Bedingungen Dritter unterliegen, die der Kunde prüfen und einhalten muss. Der Anbieter ist nicht verantwortlich für Betrieb oder Sicherheit von Drittanbieterdiensten, die nicht vom Anbieter bereitgestellt werden, und garantiert nicht, dass Integrationen dauerhaft verfügbar bleiben. Der Anbieter kann Drittkomponenten im Service von Zeit zu Zeit aktualisieren oder ersetzen.`
                        }
                    ]
                },
                {
                    title: "4. Leistungsbeschreibung und Nutzungsrechte",
                    blocks: [
                        {
                            type: "p",
                            text: `**4.1 Bereitstellung des Services.** Der Anbieter stellt dem Kunden während der Abonnementlaufzeit den im Bestellformular beschriebenen Service bereit, vorbehaltlich der Zahlung der Gebühren und der Einhaltung dieses Vertrags. Der Service wird als onlinebasierte, webbasierte Softwarelösung bereitgestellt (mit optionalen mobilen oder Desktop-Komponenten, sofern angeboten) und ist über das Internet zugänglich. Vorbehaltlich der Bedingungen dieses Vertrags gewährt der Anbieter dem Kunden ein nicht exklusives, nicht übertragbares, weltweites Nutzungsrecht, das es den autorisierten Nutzern erlaubt, den Service während der Abonnementlaufzeit ausschließlich für die internen Geschäftsabläufe des Kunden zu nutzen, entsprechend den Limits des vereinbarten Abonnementplans und der Dokumentation.`
                        },
                        {
                            type: "p",
                            text: `**4.2 Funktionen und Leistungsumfang.** ProjectFlow bietet Projektmanagement- und Kollaborationsfunktionen, einschließlich (aber nicht beschränkt auf) das Erstellen und Verwalten von Workspaces und Projekten, das Zuweisen von Aufgaben, das Hinzufügen von Kommentaren und Anhängen, das Verfolgen des Fortschritts in Dashboards sowie das Erstellen von Reports oder Analysen. Der Kunde und seine autorisierten Nutzer können projektbezogene Daten und Dateien in den Service hochladen und speichern, Teammitglieder einladen und unterstützte Drittanwendungen integrieren, um Workflows zu verbessern. Details zu aktuellen Funktionen und Modulen finden sich auf https://getprojectflow.com oder in der Dokumentation.`
                        },
                        {
                            type: "p",
                            text: `**4.3 Optionale KI-Funktionen.** Der Service kann optionale KI-gestützte Funktionen ("KI-Funktionen") anbieten, z. B. intelligente Aufgabenempfehlungen, automatisierte Dateneingabe oder -analyse, Inhaltserstellung (z. B. Zusammenfassungen oder Entwürfe von Aufgabenbeschreibungen oder Kommentaren) oder andere prädiktive Funktionen. Die KI-Funktionen, sofern vom Kunden aktiviert, beinhalten die Verarbeitung von Kunden-Prompts oder -Daten durch Machine-Learning-Algorithmen, die von Drittanbietern bereitgestellt werden können. Der Kunde erkennt an, dass KI eine sich entwickelnde Technologie ist: Für Ausgaben aus KI-Funktionen wird keine Genauigkeitsgarantie übernommen, und Ergebnisse können gelegentlich fehlerhaft oder irreführend sein. **Pflichten des Kunden bei KI-Nutzung:** Der Kunde ist verantwortlich, KI-generierte Inhalte zu überprüfen und gesetzeskonform zu verwenden. Der Kunde darf keine hochsensiblen Informationen in KI-Funktionen eingeben (z. B. Gesundheitsdaten, Daten zur rassischen oder ethnischen Herkunft, politische Meinungen usw. oder Daten, die speziellen Gesetzen unterliegen), sofern der Anbieter nicht ausdrücklich schriftlich zugestimmt hat. Der Anbieter verwendet die Eingaben des Kunden in KI-Funktionen nicht zum Training oder zur Verbesserung allgemeiner KI-Modelle zugunsten anderer Kunden; eine Nutzung erfolgt ausschließlich zur Bereitstellung des Services für den Kunden. Der Anbieter kann KI-Funktionen von Zeit zu Zeit durch Machine Learning verbessern; sofern dabei Kundendaten analysiert werden, geschieht dies nur im Einklang mit der DPA und soweit möglich in anonymisierter oder aggregierter Form. Zusätzliche oder spezifische Bedingungen für KI-Funktionen (sofern vorhanden) werden in der Dokumentation oder im Service-Interface bereitgestellt.`
                        },
                        {
                            type: "p",
                            text: `**4.4 Technische Voraussetzungen.** Die Nutzung des Services erfordert ein kompatibles Gerät, Internetzugang und bestimmte unterstützte Software (z. B. einen modernen Webbrowser). Der Kunde ist verantwortlich für die Beschaffung und Wartung aller Hardware, Software und Konnektivität, die für den Zugriff auf den Service erforderlich sind. Der Anbieter ist nicht verantwortlich für eine Unfähigkeit zur Nutzung des Services, die durch Geräte, Netzwerke oder Systeme des Kunden oder seiner Nutzer verursacht wird oder durch Internet- oder Hosting-Ausfälle außerhalb des Einflussbereichs des Anbieters.`
                        },
                        {
                            type: "p",
                            text: `**4.5 Benutzerkonten und Zugangsdaten.** Der Kunde verwaltet die Erstellung von Benutzerkonten für seine autorisierten Nutzer. Jeder autorisierte Nutzer muss über eindeutige Zugangsdaten verfügen. Der Kunde stellt sicher, dass alle autorisierten Nutzer ihre Zugangsdaten (Benutzername, Passwörter, API-Keys usw.) vertraulich behandeln und nicht an Unbefugte weitergeben. Der Kunde ist für Handlungen verantwortlich, die unter seinen Benutzerkonten vorgenommen werden (außer soweit diese durch einen Vertragsbruch des Anbieters oder einen Sicherheitsvorfall beim Anbieter verursacht wurden). Der Kunde informiert den Anbieter unverzüglich, wenn er von Verlust, Diebstahl oder unbefugter Nutzung von Zugangsdaten oder von tatsächlichen oder vermuteten Sicherheitsverletzungen im Zusammenhang mit dem Service Kenntnis erlangt.`
                        }
                    ]
                },
                {
                    title: "5. Pflichten des Kunden",
                    blocks: [
                        {
                            type: "p",
                            text: `**5.1 Nutzung für rechtmäßige Geschäftszwecke.** Der Kunde nutzt den Service ausschließlich für legitime Geschäftszwecke und in Übereinstimmung mit allen anwendbaren Gesetzen und Vorschriften. Der Kunde ist allein verantwortlich für den Inhalt und die Rechtmäßigkeit aller Kundendaten, die über den Service verarbeitet werden. Der Kunde darf den Service nicht in einer Weise nutzen, die gegen Gesetze verstößt, einschließlich (ohne Einschränkung) Gesetze zum Datenschutz, geistigen Eigentum, Exportkontrolle oder Anti-Spam.`
                        },
                        {
                            type: "p",
                            text: `**5.2 Compliance und Kooperation.** Der Kunde ist verantwortlich sicherzustellen, dass seine autorisierten Nutzer und alle weiteren Personen, denen er Zugang gewährt (z. B. verbundene Unternehmen oder Auftragnehmer), die Bedingungen dieses Vertrags und die Acceptable Use Policy einhalten. Der Kunde informiert den Anbieter unverzüglich über bekannte oder vermutete Verstöße gegen die AUP oder unbefugte Nutzung des Services und kooperiert bei angemessenen Untersuchungen des Anbieters zu Ausfällen, Sicherheitsproblemen oder vermuteten Vertragsverstößen.`
                        },
                        {
                            type: "p",
                            text: `**5.3 Kundensysteme.** Der Kunde ist verantwortlich für die Integrität und Konfiguration seiner eigenen IT-Systeme, die zur Verbindung mit dem Service genutzt werden, einschließlich aktueller und geeigneter Virenschutz- und Sicherheitsmaßnahmen, um unbefugten Zugriff auf den Service über Kundensysteme zu verhindern.`
                        },
                        {
                            type: "p",
                            text: `**5.4 Keine sensiblen oder regulierten Daten (sofern nicht vereinbart).** Der Service ist ein allgemeines Projektmanagement-Tool und nicht speziell dafür ausgelegt, rechtliche Anforderungen für bestimmte Arten sensibler Daten zu erfüllen (z. B. Gesundheitsdaten, Kreditkartendaten oder sonstige regulierte Daten). Sofern nicht schriftlich anders vereinbart, sollte der Kunde den Service nicht zur Speicherung sensibler personenbezogener Daten wie Gesundheits- oder medizinischer Informationen, Zahlungskartendaten (außer für Zahlungsabwicklung über unseren Zahlungsdienstleister) oder sonstiger Daten mit besonderen gesetzlichen Sicherheitsanforderungen verwenden. Wenn der Kunde solche Daten dennoch hochlädt, trägt er das damit verbundene Risiko.`
                        },
                        {
                            type: "p",
                            text: `**5.5 Backup-Pflichten.** Während der Anbieter routinemäßige Backups zu Disaster-Recovery-Zwecken durchführt, ist der Kunde für die Erstellung eigener Backups oder Kopien seiner Kundendaten verantwortlich. Soweit nicht ausdrücklich in diesem Vertrag oder einer SLA geregelt, garantiert der Anbieter nicht, dass Kundendaten niemals verloren gehen oder beschädigt werden. Der Anbieter empfiehlt dem Kunden, wichtige Daten regelmäßig zu exportieren oder herunterzuladen, insbesondere vor Beendigung des Services.`
                        }
                    ]
                },
                {
                    title: "6. Acceptable Use Policy",
                    blocks: [
                        {
                            type: "p",
                            text: `Der Kunde verpflichtet sich, die Acceptable Use Policy ("AUP") einzuhalten, die als Anhang A Bestandteil dieses Vertrags ist. Die AUP enthält unter anderem die folgenden Kernbeschränkungen und Regeln:`
                        },
                        {
                            type: "ul",
                            items: [
                                `**Keine illegalen oder schädlichen Inhalte:** Der Kunde darf keine Kundendaten über den Service hochladen, speichern oder teilen, die illegal, verleumderisch, obszön, pornografisch, belästigend, bedrohlich sind oder Rechte Dritter verletzen (einschließlich geistiger Eigentums- und Datenschutzrechte). Dies umfasst Inhalte, die gegen Strafgesetze oder Vorschriften verstoßen oder Gewalt, Diskriminierung oder rechtswidrige Aktivitäten fördern.`,
                                `**Kein unbefugter Zugriff oder Sicherheitsverstöße:** Der Kunde darf nicht (und darf niemanden unter seiner Kontrolle) den Service oder die Server und Netzwerke, die den Service bereitstellen, stören oder beeinträchtigen. Untersagt sind u. a. der Versuch, unbefugten Zugriff auf den Service oder andere Konten zu erlangen, das Prüfen/Scannen/Testen von Schwachstellen (außer in einem vom Anbieter genehmigten Security-Testing-Programm) oder das Umgehen von Sicherheits- oder Authentifizierungsmaßnahmen.`,
                                `**Kein Missbrauch des Services:** Der Kunde darf den Service nicht zur Verbreitung von Malware, Viren oder anderem schädlichem Code nutzen. Der Kunde darf den Service nicht für Spam, Phishing oder andere unaufgeforderte Kommunikation oder für betrügerische oder irreführende Aktivitäten verwenden.`,
                                `**Kein Reverse Engineering oder Kopieren:** Soweit gesetzlich zulässig, darf der Kunde den Service oder Softwarebestandteile nicht rückentwickeln, dekompilieren oder disassemblieren. Der Kunde darf nicht versuchen, Quellcode zu extrahieren oder abgeleitete Werke zu erstellen. Auch das Scraping des Services oder seiner Inhalte (außer der eigenen Kundendaten) ist untersagt.`,
                                `**Kein Weiterverkauf oder unbefugte Weitergabe:** Der Kunde darf den Zugang zum Service nicht vermieten, verleasen, verkaufen, unterlizenzieren oder weiterverkaufen und den Service nicht im Auftrag oder zugunsten Dritter nutzen, die vom Anbieter nicht autorisiert sind (z. B. Betrieb als Service-Büro). Die Nutzung durch verbundene Unternehmen oder Kunden ist nur erlaubt, sofern dies ausdrücklich durch diesen Vertrag oder den Abonnementplan gestattet ist.`,
                                `**Kein Einsatz für konkurrierende Dienste:** Der Kunde darf den Service nicht nutzen, um ein konkurrierendes Produkt oder einen konkurrierenden Dienst zu entwickeln oder zu verbessern, und darf den Service oder vertrauliche Informationen des Anbieters nicht zu Benchmarking- oder öffentlichen Vergleichszwecken hinsichtlich Leistung, Funktionen oder Sicherheit verwenden, ohne vorherige schriftliche Zustimmung des Anbieters.`,
                                `**Fair Use und API-Limits:** Der Kunde nutzt APIs oder automatisierte Systeme gemäß der Dokumentation und etwaigen Rate Limits. Exzessive Nutzung, die die Stabilität des Services gefährdet, ist nicht erlaubt. Der Anbieter kann API-Zugriffe bei Missbrauch drosseln oder sperren, um die Integrität des Services zu schützen.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Der Anbieter kann den Service aussetzen oder beenden (gemäß Abschnitt 8 oder 9), wenn der Kunde gegen die AUP verstößt. Der Anbieter kann auch Inhalte entfernen oder den Zugriff darauf sperren, wenn diese gegen die AUP oder diesen Vertrag verstoßen. Anhang A enthält weitere Details und Beispiele verbotener Nutzungen.`
                        }
                    ]
                },
                {
                    title: "7. Gebühren, Zahlung und Steuern",
                    blocks: [
                        {
                            type: "p",
                            text: `**7.1 Abonnementgebühren.** Der Kunde zahlt die Gebühren für den Service wie im Bestellformular oder im gewählten Abonnementplan angegeben. Abonnementgebühren werden in der Regel wiederkehrend berechnet (z. B. monatlich oder jährlich, je nach Auswahl des Kunden). Sofern nicht anders angegeben, sind Gebühren in der im Bestellformular oder auf der Website angegebenen Währung zu zahlen und verstehen sich zuzüglich anwendbarer Steuern.`
                        },
                        {
                            type: "p",
                            text: `**7.2 Abrechnung und Zahlung.** Der Kunde muss eine gültige Zahlungsmethode oder, soweit erforderlich, Bestellinformationen angeben, wie vom Anbieter oder dessen Zahlungsdienstleister (z. B. Stripe, "Zahlungsdienstleister") verlangt. Bei Kreditkarten- oder Online-Zahlungen autorisiert der Kunde den Anbieter (oder den Zahlungsdienstleister), die Abonnementgebühren gemäß dem vorgesehenen Zeitplan (z. B. monatlich im Voraus bei Monatsplänen oder jährlich im Voraus bei Jahresplänen) zu belasten. Falls Rechnungsstellung vereinbart ist, sind Zahlungen innerhalb von 30 Tagen ab Rechnungsdatum fällig, sofern nicht anders angegeben.`
                        },
                        {
                            type: "p",
                            text: `**7.3 Zahlungsverzug.** Geht eine Zahlung nicht bis zum Fälligkeitsdatum ein, kann der Anbieter (nach eigenem Ermessen und ohne Einschränkung weiterer Rechte) Verzugszinsen in Höhe von 9 Prozentpunkten über dem Basiszinssatz pro Jahr (oder dem höchsten gesetzlich zulässigen Satz, falls niedriger) berechnen, gerechnet ab Fälligkeit bis zur Zahlung. Darüber hinaus kann der Anbieter den Zugang zum Service sperren, wenn das Kundenkonto länger als 30 Tage überfällig ist, nach vorheriger schriftlicher Mitteilung (E-Mail ausreichend), bis alle rückständigen Beträge vollständig bezahlt sind.`
                        },
                        {
                            type: "p",
                            text: `**7.4 Steuern.** Alle Gebühren verstehen sich exklusive Steuern, Abgaben oder Zölle. Der Kunde ist verantwortlich für anwendbare Mehrwertsteuer (USt/VAT), Umsatzsteuer (Sales Tax), GST oder ähnliche Steuern. Wenn der Kunde gesetzlich verpflichtet ist, Steuern einzubehalten, erhöht er die Zahlung entsprechend, sodass der Anbieter den vollen geschuldeten Betrag erhält, als ob keine Einbehalte erforderlich wären. Im Reverse-Charge-Fall (z. B. innergemeinschaftliche B2B-Leistungen) berechnet der Anbieter keine USt, sofern der Kunde eine gültige USt-ID bereitstellt und bestätigt, dass er in seinem Land umsatzsteuerlich registriert ist.`
                        },
                        {
                            type: "p",
                            text: `**7.5 Preisänderungen.** Der Anbieter kann die Gebühren ändern oder neue Entgelte für den Service einführen, mit mindestens 30 Tagen Vorankündigung (per E-Mail, Website oder im Service). Änderungen gelten ab Beginn der nächsten Abonnementlaufzeit oder Verlängerung. Wenn der Kunde den neuen Gebühren nicht zustimmt, kann er das Abonnement gemäß Abschnitt 8.1 nicht verlängern. Die fortgesetzte Nutzung des Services nach Inkrafttreten der Gebührenänderung gilt als Zustimmung.`
                        },
                        {
                            type: "p",
                            text: `**7.6 Upgrades und Downgrades.** Der Kunde kann seinen Abonnementplan jederzeit upgraden (z. B. mehr Nutzer oder Funktionen). Bei einem Upgrade während der Laufzeit werden die zusätzlichen Gebühren für den Rest der aktuellen Abrechnungsperiode anteilig berechnet und sofort belastet; der neue höhere Preis gilt für die folgenden Perioden. Ein Downgrade tritt in der Regel erst ab dem nächsten Abrechnungszyklus in Kraft (keine Teilrückerstattung für Downgrades während der Laufzeit), sofern nicht anders vereinbart. Ein Downgrade kann zu Funktions- oder Kapazitätsverlusten führen - der Anbieter haftet nicht für solche Auswirkungen, sofern der Kunde darüber informiert wurde.`
                        },
                        {
                            type: "p",
                            text: `**7.7 Keine Rückerstattungen.** Sofern nicht ausdrücklich in diesem Vertrag vorgesehen oder gesetzlich erforderlich, sind alle Zahlungen nicht erstattungsfähig. Dies gilt insbesondere für teilweise Nutzung eines Leistungszeitraums, ungenutzte Konten oder Kündigungen vor Ablauf eines vorausbezahlten Zeitraums. Der Anbieter kann in Ausnahmefällen anteilige Rückerstattungen oder Gutschriften gewähren (z. B. bei Kündigung aus Kulanz gemäß Abschnitt 8.3), ist dazu jedoch nicht verpflichtet.`
                        }
                    ]
                },
                {
                    title: "8. Laufzeit und Kündigung",
                    blocks: [
                        {
                            type: "p",
                            text: `**8.1 Laufzeit und Verlängerung.** Die anfängliche Abonnementlaufzeit entspricht der im Bestellformular angegebenen Laufzeit (z. B. monatlich oder einjährig). Sofern nicht anders angegeben, verlängern sich Abonnements automatisch um jeweils gleichlange Laufzeiten (z. B. einen weiteren Monat oder ein weiteres Jahr), sofern nicht eine Partei die Nichtverlängerung mindestens 30 Tage (bei Jahresplänen) oder 5 Tage (bei Monatsplänen) vor Ablauf der aktuellen Laufzeit erklärt. Der Kunde kann die Nichtverlängerung über die Kontoeinstellungen im Service, durch Kontakt des Supports oder auf eine andere vom Anbieter angegebene Weise erklären. Der Anbieter erinnert den Kunden an die bevorstehende automatische Verlängerung bei Jahresabonnements gemäß gesetzlicher Anforderungen.`
                        },
                        {
                            type: "p",
                            text: `**8.2 Kündigung durch den Kunden (ohne Angabe von Gründen).** Der Kunde kann diesen Vertrag ohne Angabe von Gründen kündigen, indem er nicht verlängert (siehe oben) oder das Abonnement jederzeit über die Service-Oberfläche oder schriftlich kündigt, wirksam zum Ende der laufenden Abonnementperiode. Sofern nicht anders vereinbart, besteht kein Anspruch auf Rückerstattung vorausbezahlter Gebühren, und der Kunde behält den Zugang bis zum Ende der bezahlten Laufzeit.`
                        },
                        {
                            type: "p",
                            text: `**8.3 Kündigung oder Aussetzung durch den Anbieter.**`
                        },
                        {
                            type: "p",
                            text: `**Aus wichtigem Grund:** Der Anbieter kann diesen Vertrag kündigen oder den Zugang des Kunden zum Service mit sofortiger Wirkung aussetzen, wenn: (a) der Kunde fällige Gebühren nicht innerhalb von 14 Tagen nach schriftlicher Mahnung bezahlt; (b) der Kunde eine wesentliche Vertragsbestimmung (einschließlich der Acceptable Use Policy oder Lizenzbeschränkungen) verletzt und der Verstoß nicht (sofern heilbar) innerhalb von 14 Tagen nach Mitteilung des Anbieters behoben wird; oder (c) der Kunde insolvent wird, Insolvenz anmeldet oder ein vergleichbares Ereignis eintritt (z. B. Betriebseinstellung, Liquidation oder Bestellung eines Insolvenzverwalters).`
                        },
                        {
                            type: "p",
                            text: `**Notfall-Sperrung:** Ungeachtet des Vorstehenden kann der Anbieter den Zugang zum Service mit minimaler Vorankündigung aussetzen, wenn dies erforderlich ist, um erheblichen Schaden für den Service, den Anbieter oder andere Kunden zu verhindern oder gesetzlichen Anforderungen zu entsprechen (z. B. bei einem laufenden Cyberangriff oder der Übertragung rechtswidriger Inhalte). In solchen Fällen informiert der Anbieter den Kunden so bald wie möglich und arbeitet in gutem Glauben an einer Lösung und schnellen Wiederherstellung des Zugangs.`
                        },
                        {
                            type: "p",
                            text: `**Aus Bequemlichkeit:** Der Anbieter kann diesen Vertrag zudem aus Bequemlichkeit kündigen (und die Bereitstellung des Services für den Kunden einstellen) mit mindestens 60 Tagen schriftlicher Vorankündigung. In diesem Fall erstattet der Anbieter anteilige vorausbezahlte Gebühren für den verbleibenden Zeitraum nach Wirksamwerden der Kündigung.`
                        },
                        {
                            type: "p",
                            text: `**8.4 Wirkung der Kündigung.** Bei Kündigung oder Ablauf dieses Vertrags: (a) erlischt das Nutzungsrecht des Kunden am Service sofort (bei Nichtverlängerung zum Ende der Laufzeit), und der Anbieter kann die Konten deaktivieren; (b) der Kunde zahlt alle ausstehenden Gebühren für bis zur Beendigung erbrachte Leistungen (und bei Kündigung aus wichtigem Grund durch den Anbieter oder Kündigung des Kunden ohne wichtigen Grund werden alle offenen Gebühren für die restliche vereinbarte Laufzeit sofort fällig, soweit rechtlich zulässig); und (c) jede Partei gibt vertrauliche Informationen der anderen Partei zurück oder vernichtet diese gemäß Abschnitt 13.`
                        },
                        {
                            type: "p",
                            text: `**8.5 Datenexport und Löschung.** Nach Beendigung hat der Kunde 30 Tage Zeit, seine Kundendaten aus dem Service zu exportieren oder herunterzuladen, es sei denn, das Konto wurde wegen eines Vertragsverstoßes des Kunden beendet; in diesem Fall kann der Anbieter den Zugang nach eigenem Ermessen einschränken (wobei der Anbieter auf Anfrage angemessen mitwirkt, um Kundendaten an den Kunden zurückzugeben). Nach Ablauf dieser 30 Tage kann der Anbieter alle Kundendaten im System des Kunden löschen, vorbehaltlich gesetzlicher Aufbewahrungspflichten oder interner Backup-Zwecke. Auf schriftliche Anfrage des Kunden zum oder vor dem Beendigungszeitpunkt kann der Anbieter einen finalen Export der Kundendaten in einem Standardformat gegen eine angemessene Gebühr bereitstellen (sofern nicht bereits als Self-Service verfügbar).`
                        },
                        {
                            type: "p",
                            text: `**8.6 Fortgeltung.** Bestimmungen dieses Vertrags, die ihrem Wesen nach fortgelten sollen (z. B. Zahlungsansprüche, Vertraulichkeit, Haftungsausschlüsse, Haftungsbegrenzungen und Streitbeilegung), bleiben auch nach Beendigung oder Ablauf wirksam.`
                        }
                    ]
                },
                {
                    title: "9. Support und Wartung",
                    blocks: [
                        {
                            type: "p",
                            text: `**9.1 Standard-Support.** Der Anbieter stellt dem Kunden Standard-Support ohne zusätzliche Kosten zur Verfügung (sofern kein höheres Support-Level angeboten und gebucht wird). Standard-Support umfasst den Zugang zu Hilfedokumentationen auf der Website des Anbieters und die Möglichkeit, den Support per E-Mail an hello@getprojectflow.com oder über das Support-Portal zu kontaktieren. Support erfolgt während der üblichen Geschäftszeiten des Anbieters (Montag-Freitag, 09:00-17:00 Uhr MEZ, ausgenommen deutsche Feiertage). Der Anbieter bemüht sich, Support-Anfragen innerhalb eines Werktages (24 Stunden) zu beantworten.`
                        },
                        {
                            type: "p",
                            text: `**9.2 Wartung und Verfügbarkeit.** Der Anbieter bemüht sich, die Verfügbarkeit des Services 24 Stunden am Tag, 7 Tage die Woche sicherzustellen, mit einer Zielverfügbarkeit von mindestens 99,5 % pro Kalendermonat, ausgenommen geplante Wartungsfenster und Fälle höherer Gewalt. Der Anbieter führt routinemäßige Wartung während angekündigter Wartungsfenster durch (z. B. am Wochenende oder außerhalb der Spitzenzeiten). Während solcher Wartungsfenster kann der Service nicht verfügbar oder eingeschränkt sein. Der Anbieter bemüht sich, Häufigkeit und Dauer geplanter Wartung zu begrenzen. Bei dringender Wartung oder sicherheitsrelevanten Patches wird der Anbieter nach Möglichkeit vorab informieren. Detaillierte Service-Level-Verpflichtungen und etwaige Abhilfen können in einer SLA (Anhang B) geregelt sein. Ohne separate SLA ist die genannte Verfügbarkeit ein Ziel und keine strikte Garantie; das einzige Rechtsmittel des Kunden bei erheblicher Ausfallzeit (ohne grobe Fahrlässigkeit oder Vorsatz des Anbieters) ist die Kündigung gemäß Abschnitt 8.`
                        },
                        {
                            type: "p",
                            text: `**9.3 Updates und Softwareänderungen.** Der Anbieter führt Updates, Fehlerbehebungen und Upgrades als Teil der laufenden Wartung durch. Solche Updates können die Nutzererfahrung oder Funktionalität verändern; der Anbieter bemüht sich, dass Änderungen angemessen sind und die Qualität des Services verbessern oder erhalten. Der Anbieter informiert den Kunden (z. B. über Release Notes oder E-Mail) über wesentliche Änderungen, die Nutzung oder Kompatibilität beeinflussen. Der Kunde ist dafür verantwortlich, die jeweils aktuelle Version des Services zu verwenden und clientseitige Software oder Integrationen an Updates anzupassen.`
                        },
                        {
                            type: "p",
                            text: `**9.4 Zusätzlicher Support oder Professional Services.** Unterstützungs- oder Beratungsleistungen über den Standard-Support hinaus (z. B. Support außerhalb der Geschäftszeiten, Vor-Ort-Schulungen, Datenmigrationen oder individuelle Entwicklung) können gegen zusätzliche Vergütung in einem separaten Vertrag oder Bestellformular angeboten werden.`
                        }
                    ]
                },
                {
                    title: "10. Service Levels (SLA)",
                    blocks: [
                        {
                            type: "p",
                            text: `(Siehe Anhang B für ein detailliertes Service Level Agreement, sofern beigefügt. Ist keine SLA beigefügt, gelten die Bestimmungen in Abschnitt 9.2 zur Verfügbarkeit; zusätzliche Service-Level-Garantien oder Gutschriften werden nicht gewährt.)`
                        }
                    ]
                },
                {
                    title: "11. Datenschutz und Privatsphäre",
                    blocks: [
                        {
                            type: "p",
                            text: `**11.1 Rollen der Parteien (DSGVO).** Soweit Kundendaten personenbezogene Daten enthalten (im Sinne der EU-Datenschutz-Grundverordnung (DSGVO) oder anderer anwendbarer Datenschutzgesetze), ist der Kunde der "Verantwortliche" (oder "business" nach CCPA) und der Anbieter ein "Auftragsverarbeiter" (oder "service provider"), der diese Daten im Auftrag des Kunden verarbeitet. Der Anbieter verarbeitet personenbezogene Daten aus Kundendaten ausschließlich zur Bereitstellung des Services und zur Erfüllung seiner Pflichten aus diesem Vertrag, gemäß den Anweisungen des Kunden, wie in diesem Vertrag und der DPA festgelegt.`
                        },
                        {
                            type: "p",
                            text: `**11.2 Auftragsverarbeitungsvereinbarung.** Die Parteien schließen eine Auftragsverarbeitungsvereinbarung (DPA) gemäß Art. 28 DSGVO (oder entsprechenden Bestimmungen anderer Datenschutzgesetze), die die Verarbeitung personenbezogener Daten durch den Anbieter im Auftrag des Kunden regelt. Die DPA ist als Anhang C beigefügt oder verfügbar unter [URL or location] und wird hiermit durch Verweis Bestandteil dieses Vertrags. Durch die Nutzung des Services und das Hochladen personenbezogener Daten gilt die DPA als akzeptiert und unterzeichnet. Im Konfliktfall zwischen diesem Vertrag und der DPA hinsichtlich der Verarbeitung personenbezogener Daten hat die DPA Vorrang.`
                        },
                        {
                            type: "p",
                            text: `**11.3 Pflichten des Anbieters als Auftragsverarbeiter.** Der Anbieter implementiert geeignete technische und organisatorische Maßnahmen zum Schutz personenbezogener Daten im Service gegen unbefugten Zugriff, Verlust oder Verletzung, wie nach Art. 32 DSGVO erforderlich. Der Anbieter und sein Personal verarbeiten personenbezogene Daten ausschließlich gemäß den dokumentierten Anweisungen des Kunden (wie in diesem Vertrag und der DPA festgelegt oder anderweitig schriftlich vom Kunden erteilt). Der Anbieter stellt sicher, dass Personen, die personenbezogene Daten verarbeiten, zur Vertraulichkeit verpflichtet sind. Wird dem Anbieter eine Verletzung des Schutzes personenbezogener Daten bekannt, informiert er den Kunden unverzüglich und unterstützt ihn mit Informationen zur Erfüllung von Meldepflichten (siehe auch Abschnitt 15.3).`
                        },
                        {
                            type: "p",
                            text: `**11.4 Unterauftragsverarbeiter.** Der Kunde erteilt dem Anbieter eine allgemeine Genehmigung, Unterauftragnehmer und Unterauftragsverarbeiter zur Erbringung des Services einzusetzen, insbesondere für Hosting und Verarbeitung personenbezogener Daten, wobei der Anbieter für die Leistung seiner Unterauftragsverarbeiter verantwortlich bleibt und mit ihnen Verträge schließt, die mindestens denselben Datenschutzstandard gewährleisten wie dieser Vertrag und die DPA. Der Anbieter führt eine Liste aktueller Unterauftragsverarbeiter (z. B. auf seiner Website oder in Anhang C) und informiert den Kunden vorab über beabsichtigte Änderungen, damit der Kunde aus datenschutzrechtlichen Gründen widersprechen kann. Bei berechtigten Einwänden und fehlender Einigung kann der Kunde den Service in Bezug auf den betroffenen Teil (sofern trennbar) oder insgesamt als letztes Mittel kündigen und erhält anteilige Rückerstattung vorausbezahlter Gebühren für den betroffenen Teil.`
                        },
                        {
                            type: "p",
                            text: `**11.5 Internationale Datenübermittlungen.** Der Kunde erkennt an, dass der Anbieter und seine Unterauftragsverarbeiter personenbezogene Daten in Ländern außerhalb des Landes verarbeiten können, in dem der Kunde ansässig ist oder aus dem die Daten stammen, einschließlich außerhalb des Europäischen Wirtschaftsraums (EWR). Der Anbieter stellt sicher, dass Übermittlungen personenbezogener Daten aus dem EWR oder anderen Regionen mit Übermittlungsbeschränkungen durch geeignete rechtliche Mechanismen abgesichert werden, um ein angemessenes Schutzniveau gemäß Kapitel V der DSGVO zu gewährleisten. Diese Mechanismen können umfassen:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) die EU-Standardvertragsklauseln (SCCs) der Europäischen Kommission (soweit anwendbar in die DPA integriert),`,
                                `(b) die Berufung auf einen Angemessenheitsbeschluss der Europäischen Kommission für das Zielland, oder`,
                                `(c) andere rechtlich zulässige Übermittlungsmechanismen nach geltendem Recht.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Der Anbieter setzt erforderliche zusätzliche Maßnahmen um, um Daten während der Übertragung und Speicherung zu schützen.`
                        },
                        {
                            type: "p",
                            text: `**11.6 Unterstützung bei Betroffenenanfragen.** Unter Berücksichtigung der Art der Verarbeitung unterstützt der Anbieter den Kunden durch geeignete technische und organisatorische Maßnahmen soweit möglich bei der Erfüllung von Pflichten zur Bearbeitung von Betroffenenanfragen (z. B. Auskunft, Löschung oder Berichtigung). Erhält der Anbieter eine Anfrage eines Betroffenen, die den Kunden identifiziert, leitet er diese an den Kunden weiter und antwortet nicht direkt (außer wenn rechtlich verpflichtet). Der Anbieter unterstützt den Kunden auf Anfrage außerdem bei Datenschutz-Folgenabschätzungen oder Konsultationen mit Aufsichtsbehörden, soweit dies für den Kunden im Zusammenhang mit dem Service erforderlich ist; der Kunde trägt hierfür angemessene Kosten, sofern der Aufwand erheblich ist.`
                        },
                        {
                            type: "p",
                            text: `**11.7 Datenschutzerklärung (personenbezogene Daten als Verantwortlicher).** Der Kunde erkennt an, dass der Anbieter bestimmte begrenzte personenbezogene Daten von Mitarbeitern des Kunden (z. B. Administratoren oder Abrechnungskontakte) für eigene legitime Zwecke verarbeiten kann (z. B. Kontoverwaltung, Abrechnung oder Service-Mitteilungen). Diese Verarbeitung erfolgt nicht im Auftrag des Kunden, sondern als unabhängiger Verantwortlicher; sie unterliegt der Datenschutzerklärung des Anbieters unter https://getprojectflow.com/privacy. Dies ist getrennt von der Verarbeitung der Kundendaten im Service, die durch die DPA geregelt ist.`
                        }
                    ]
                },
                {
                    title: "12. Kundendaten und Schutzrechte",
                    blocks: [
                        {
                            type: "p",
                            text: `**12.1 Eigentum an Kundendaten.** Zwischen den Parteien verbleiben alle Rechte, Titel und Interessen an den Kundendaten beim Kunden. Der Anbieter beansprucht kein Eigentum an Kundendaten und erkennt an, dass Kundendaten als vertrauliche Informationen des Kunden gelten (vorbehaltlich der zulässigen Nutzungen in diesem Vertrag). Der Kunde gewährt dem Anbieter und seinen Unterauftragsverarbeitern eine nicht exklusive, weltweite, gebührenfreie Lizenz, Kundendaten zu hosten, zu speichern, zu verarbeiten, zu übertragen und anzuzeigen, soweit dies zur Bereitstellung des Services und des Supports sowie zur Erfüllung der Pflichten des Anbieters erforderlich ist.`
                        },
                        {
                            type: "p",
                            text: `**12.2 Datensicherheit und Backup.** Der Anbieter schützt Kundendaten gemäß den Sicherheitsmaßnahmen in Abschnitt 15 und Anhang C (DPA). Während der Anbieter regelmäßige Backups für die Notfallwiederherstellung durchführt, versteht der Kunde, dass diese dem Anbieter dienen. Sofern keine SLA etwas anderes regelt, garantiert der Anbieter nicht, dass er spezifische Daten auf Wunsch des Kunden wiederherstellen kann (außer im Disaster-Recovery-Fall). Der Kunde wird ermutigt, eigene Backups/Exporte der Daten zu erstellen (siehe Abschnitt 5.5).`
                        },
                        {
                            type: "p",
                            text: `**12.3 Aggregierte Daten und anonymisierte Nutzungsdaten.** Ungeachtet anderslautender Bestimmungen kann der Anbieter aggregierte und anonymisierte Statistiken oder Erkenntnisse zur Leistung, zum Betrieb und zur Nutzung des Services ("Aggregierte Daten") erstellen. Beispielsweise kann der Anbieter die Gesamtnutzung des Systems, Funktionsnutzungsraten oder durchschnittliche Aufgabenabschlusszeiten über alle Kunden hinweg analysieren, um den Service zu verbessern. Der Anbieter darf solche aggregierten Daten nutzen, speichern und veröffentlichen, sofern sie keine Informationen enthalten, die den Kunden oder einzelne Personen identifizieren, und keine nicht öffentlichen Kundendaten enthalten. Der Anbieter behält alle Rechte an Aggregierten Daten. Darüber hinaus darf der Anbieter die Nutzung des Services durch den Kunden und dessen Nutzer überwachen und nutzen, soweit dies zur Einhaltung dieses Vertrags, zur Unterstützung oder zur Verbesserung des Services erforderlich ist (im Einklang mit Vertraulichkeit und Datenschutzpflichten).`
                        },
                        {
                            type: "p",
                            text: `**12.4 Entfernung von Inhalten.** Wenn der Anbieter vom Kunden informiert wird oder selbst Kenntnis erlangt, dass Kundendaten gegen die AUP, Gesetze oder Rechte Dritter verstoßen könnten, kann der Anbieter (ist jedoch nicht verpflichtet) den Zugriff auf die betreffenden Kundendaten deaktivieren oder diese entfernen. Der Anbieter informiert den Kunden über solche Maßnahmen, sofern dies rechtlich zulässig ist.`
                        },
                        {
                            type: "p",
                            text: `**12.5 Drittanfragen nach Daten.** Wenn ein Dritter (einschließlich Strafverfolgungs- oder Behördenstellen) Zugriff auf Kundendaten oder Kontoinformationen verlangt (z. B. durch Vorladung oder Gerichtsbeschluss), informiert der Anbieter den Kunden unverzüglich (sofern rechtlich zulässig) und unterstützt ihn bei dem Versuch, die Daten zu schützen. Der Anbieter kann Kundendaten offenlegen, wenn er gesetzlich oder durch bindenden Beschluss dazu verpflichtet ist; in diesem Fall offenlegt er nur das notwendige Minimum und strebt, soweit möglich, vertrauliche Behandlung an.`
                        }
                    ]
                },
                {
                    title: "13. Vertraulichkeit",
                    blocks: [
                        {
                            type: "p",
                            text: `**13.1 Definition vertraulicher Informationen.** "Vertrauliche Informationen" bezeichnet alle Informationen, die eine Partei ("offenlegende Partei") der anderen Partei ("empfangende Partei") in mündlicher, schriftlicher, elektronischer oder sonstiger Form offenlegt, die als vertraulich gekennzeichnet sind oder deren Vertraulichkeit sich aus der Art der Informationen und dem Kontext ergibt. Vertrauliche Informationen des Kunden umfassen Kundendaten (vorbehaltlich Abschnitt 12.3 zu Aggregierten Daten). Vertrauliche Informationen des Anbieters umfassen die Service-Software und Dokumentation, Preisinformationen, Produkt-Roadmaps sowie nicht öffentliche Informationen über das Geschäft, Produkte oder Kunden des Anbieters. Die Bedingungen dieses Vertrags gelten als vertrauliche Informationen beider Parteien.`
                        },
                        {
                            type: "p",
                            text: `**13.2 Ausnahmen.** Informationen gelten nicht als vertrauliche Informationen, wenn die empfangende Partei nachweisen kann, dass:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) sie ohne Pflichtverletzung öffentlich bekannt sind oder werden;`,
                                `(b) sie der empfangenden Partei bereits ohne Vertraulichkeitsverpflichtung vor der Offenlegung bekannt waren;`,
                                `(c) sie unabhängig ohne Nutzung der vertraulichen Informationen der offenlegenden Partei entwickelt wurden; oder`,
                                `(d) sie rechtmäßig von einem Dritten erlangt wurden, der keiner Vertraulichkeitspflicht unterliegt.`
                            ]
                        },
                        {
                            type: "p",
                            text: `**13.3 Vertraulichkeitspflichten.** Die empfangende Partei darf die vertraulichen Informationen der offenlegenden Partei nur im Rahmen dieses Vertrags verwenden und darf sie nicht an Dritte weitergeben, außer an eigene verbundene Unternehmen, Mitarbeiter, Auftragnehmer oder Berater, die sie zur Vertragserfüllung benötigen und einer mindestens gleichwertigen Vertraulichkeitspflicht unterliegen. Die empfangende Partei schützt vertrauliche Informationen mit der gleichen Sorgfalt wie eigene vertrauliche Informationen vergleichbarer Art, jedoch mindestens mit angemessener Sorgfalt.`
                        },
                        {
                            type: "p",
                            text: `**13.4 Zwingende Offenlegung.** Wenn die empfangende Partei aufgrund von Gesetz, Verordnung oder Gerichtsbeschluss zur Offenlegung vertraulicher Informationen verpflichtet ist, informiert sie die offenlegende Partei (soweit rechtlich zulässig) unverzüglich schriftlich und kooperiert bei Bemühungen um eine Schutzanordnung oder andere geeignete Abhilfe. Ist die Offenlegung letztlich erforderlich, offenlegt die empfangende Partei nur die gesetzlich erforderlichen Informationen und bemüht sich, die Vertraulichkeit zu wahren (z. B. durch Antrag auf vertrauliche Behandlung).`
                        },
                        {
                            type: "p",
                            text: `**13.5 Rückgabe oder Vernichtung.** Bei Beendigung dieses Vertrags oder auf schriftliche Aufforderung der offenlegenden Partei gibt die empfangende Partei alle vertraulichen Informationen zurück oder vernichtet sie sicher. Eine Archivkopie darf aus Compliance-Gründen aufbewahrt werden; vertrauliche Informationen in routinemäßigen Backups dürfen verbleiben, sofern sie weiterhin der Vertraulichkeitspflicht unterliegen.`
                        },
                        {
                            type: "p",
                            text: `**13.6 Dauer.** Die Vertraulichkeitspflichten dieses Abschnitts beginnen mit dem Wirksamkeitsdatum und gelten für fünf (5) Jahre nach Beendigung dieses Vertrags, mit Ausnahme von Geschäftsgeheimnissen und Kundendaten, die unbegrenzt oder so lange wie gesetzlich zulässig geschützt bleiben.`
                        }
                    ]
                },
                {
                    title: "14. Geistiges Eigentum und Feedback",
                    blocks: [
                        {
                            type: "p",
                            text: `**14.1 Geistiges Eigentum des Anbieters.** Alle Rechte, Titel und Interessen am Service sowie an sämtlicher Software, Technologie, Materialien und Inhalten des Anbieters (einschließlich aller Änderungen, Verbesserungen und abgeleiteten Werke) verbleiben beim Anbieter und seinen Lizenzgebern. Dies umfasst die ProjectFlow-Plattform, Benutzeroberflächen, Know-how, zugrunde liegenden Quellcode, Algorithmen, Datenbanken sowie Designs und Dokumentationen des Anbieters. Der Name ProjectFlow und das Logo sowie Produktnamen, Logos und Service-Marken des Anbieters sind Marken des Anbieters oder seiner verbundenen Unternehmen. Über die ausdrücklich gewährten Rechte hinaus werden keine weiteren Rechte eingeräumt; der Anbieter behält alle nicht ausdrücklich gewährten Rechte.`
                        },
                        {
                            type: "p",
                            text: `**14.2 Lizenzbeschränkungen.** Der Kunde darf nicht (und darf Dritten nicht gestatten):`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) den Service oder Softwarebestandteile zu kopieren, zu modifizieren, zu adaptieren, zu übersetzen oder abgeleitete Werke zu erstellen;`,
                                `(b) den Service zu dekompilieren, rückzuentwickeln, zu disassemblieren oder anderweitig den Quellcode abzuleiten, außer soweit gesetzlich ausdrücklich erlaubt (und dann mit vorheriger Mitteilung an den Anbieter);`,
                                `(c) proprietäre Hinweise oder Kennzeichnungen auf dem Service oder in Berichten/Outputs zu entfernen, zu verdecken oder zu verändern;`,
                                `(d) den Service in Verletzung der AUP oder geltenden Rechts zu nutzen; oder`,
                                `(e) automatisierte Systeme oder Software (z. B. Bots oder Skripte) zu verwenden, um Daten aus dem Service zu extrahieren oder zu scrapen, außer über autorisierte APIs und gemäß API-Bedingungen.`
                            ]
                        },
                        {
                            type: "p",
                            text: `**14.3 Kundenfeedback.** Wenn der Kunde oder autorisierte Nutzer dem Anbieter Vorschläge, Ideen, Verbesserungswünsche, Feedback oder Empfehlungen zum Service ("Feedback") geben, darf der Anbieter dieses Feedback ohne Verpflichtung gegenüber dem Kunden nutzen und in Produkte oder Dienste einarbeiten, sofern der Anbieter Feedback nicht öffentlich dem Kunden zuordnet, ohne dessen Zustimmung. Der Kunde räumt dem Anbieter eine dauerhafte, unwiderrufliche, unterlizenzierbare, gebührenfreie Lizenz ein, Feedback im Service oder anderen Produkten zu verwenden.`
                        },
                        {
                            type: "p",
                            text: `**14.4 Drittansprüche und IP-Freistellung durch den Anbieter.** Der Anbieter verteidigt den Kunden gegen Ansprüche Dritter ("Anspruch"), die behaupten, dass der Service (wie vom Anbieter bereitgestellt) unmittelbar Patente, Urheberrechte oder Markenrechte eines Dritten verletzt oder Geschäftsgeheimnisse eines Dritten missbraucht, und stellt den Kunden von rechtskräftig zugesprochenen Schäden und Kosten frei (oder durch Vergleich, den der Anbieter zustimmt). Die Freistellung setzt voraus, dass der Kunde:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(i) den Anbieter unverzüglich schriftlich über den Anspruch informiert (mit ausreichenden Details, z. B. Kopie der Klage oder Abmahnung);`,
                                `(ii) dem Anbieter die alleinige Befugnis zur Verteidigung oder Einigung einräumt (der Anbieter darf nicht ohne vorherige Zustimmung des Kunden einen Vergleich schließen, der ein Schuldeingeständnis des Kunden enthält oder nicht monetäre Pflichten auferlegt); und`,
                                `(iii) dem Anbieter angemessen kooperiert.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Im Falle eines solchen Anspruchs kann der Anbieter nach eigenem Ermessen und auf eigene Kosten (a) das Recht erwirken, dass der Kunde den Service weiterhin nutzt, (b) die verletzende Komponente ersetzen oder so ändern, dass sie nicht verletzend ist und im Wesentlichen gleiche Funktionalität bietet, oder (c) wenn (a) und (b) nach Ansicht des Anbieters wirtschaftlich nicht zumutbar sind, den Vertrag beenden und eine anteilige Rückerstattung vorausbezahlter Gebühren für ungenutzte Zeiträume gewähren. Der Anbieter haftet nicht für Ansprüche, die entstehen aus: Vertragsverletzung des Kunden; Nutzung des Services in Kombination mit Software, Hardware oder Daten, die nicht vom Anbieter bereitgestellt wurden (einschließlich Drittintegrationen), sofern die Verletzung ohne diese Kombination nicht entstanden wäre; Nutzung entgegen Dokumentation oder Anweisungen; oder Änderungen am Service, die nicht vom Anbieter vorgenommen oder autorisiert wurden. Abschnitt 14.4 regelt die gesamte Haftung des Anbieters und den ausschließlichen Rechtsbehelf des Kunden hinsichtlich der Verletzung geistiger Eigentumsrechte Dritter.`
                        },
                        {
                            type: "p",
                            text: `**14.5 Kundenfreistellung.** Der Kunde stellt den Anbieter und seine verbundenen Unternehmen, Organe, Direktoren und Mitarbeiter von allen Ansprüchen Dritter, Verlusten, Haftungen, Schäden und Aufwendungen (einschließlich angemessener Anwaltskosten) frei, die entstehen aus oder im Zusammenhang mit:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) Verletzung der AUP oder Abschnitt 6 durch den Kunden oder seine autorisierten Nutzer (z. B. Ansprüche, dass Kundendaten illegal sind oder Rechte Dritter verletzen);`,
                                `(b) Gesetzesverletzungen des Kunden bei der Nutzung des Services (z. B. Verstöße gegen Datenschutz- oder Anti-Spam-Recht); oder`,
                                `(c) sonstigen Materialien oder Informationen, die der Kunde im Zusammenhang mit dem Service bereitstellt und die zu einem Drittanspruch führen.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Der Anbieter wird: (i) den Kunden unverzüglich über jeden Anspruch informieren, für den er Freistellung verlangt (wobei eine verzögerte Mitteilung den Kunden nur insoweit entlastet, wie er dadurch wesentlich benachteiligt wird); (ii) dem Kunden die alleinige Kontrolle über Verteidigung oder Vergleich des Anspruchs überlassen (unter ähnlichen Einschränkungen wie in 14.4, dass der Kunde keinen Vergleich schließen darf, der Haftung oder Schuldeingeständnisse des Anbieters enthält, ohne dessen Zustimmung); und (iii) angemessen kooperieren, wobei die Kosten der Kunde trägt.`
                        }
                    ]
                },
                {
                    title: "15. Sicherheit und Datenvorfälle",
                    blocks: [
                        {
                            type: "p",
                            text: `**15.1 Sicherheitsmaßnahmen.** Der Anbieter implementiert und unterhält technische und organisatorische Maßnahmen zum Schutz der Sicherheit (einschließlich Integrität, Verfügbarkeit und Vertraulichkeit) des Services und der Kundendaten. Diese Maßnahmen umfassen mindestens: Zugriffskontrollen (nur autorisiertes Personal mit Bedarf erhält Zugriff auf Kundendaten); Verschlüsselung von Kundendaten bei Übertragung (z. B. HTTPS/TLS) und im Ruhezustand (soweit möglich mit starken Algorithmen); Netzwerksicherheitsmaßnahmen wie Firewalls und Intrusion Detection; regelmäßige Vulnerability-Assessments und Security-Tests des Services; sowie Personalschulungen und -sicherheitsmaßnahmen. Weitere Details zu Sicherheitspraktiken können in einem Sicherheitsüberblick oder in der DPA beschrieben sein. Der Kunde erkennt an, dass kein Service vollkommen sicher ist, der Anbieter jedoch branchenübliche Maßnahmen zum Schutz vor unbefugtem Zugriff oder Offenlegung ergreift.`
                        },
                        {
                            type: "p",
                            text: `**15.2 Sicherheitsobliegenheiten des Kunden.** Der Kunde ist verantwortlich, den Service sicher zu nutzen, einschließlich Schutz der Zugangsdaten, Verwendung starker Passwörter oder SSO sowie Sicherstellung, dass seine Systeme frei von Malware sind. Der Kunde informiert den Anbieter unverzüglich, wenn er unbefugten Zugriff auf sein Konto oder eine Sicherheitslücke im Service vermutet. Plant der Kunde Penetrationstests am Service, muss er zuvor die schriftliche Zustimmung des Anbieters einholen und die bereitgestellten Regeln einhalten (nicht autorisierte Tests sind ausdrücklich untersagt).`
                        },
                        {
                            type: "p",
                            text: `**15.3 Sicherheitsvorfälle und Benachrichtigung.** Wird dem Anbieter ein unrechtmäßiger Zugriff auf Kundendaten in seinen Systemen bekannt oder ein unbefugter Zugriff, der zu Verlust, Offenlegung oder Veränderung von Kundendaten führt ("Sicherheitsverletzung"), untersucht der Anbieter den Vorfall unverzüglich und informiert den Kunden ohne schuldhaftes Zögern (spätestens 48 Stunden nach Kenntniserlangung). Die Benachrichtigung enthält, soweit bekannt, eine Beschreibung der Art des Vorfalls, der betroffenen Daten und der ergriffenen Maßnahmen. Der Anbieter kooperiert mit angemessenen Anfragen des Kunden, z. B. zur Erfüllung gesetzlicher Meldepflichten gegenüber Betroffenen oder Behörden. Sofern gesetzlich nicht erforderlich, wird der Anbieter Dritte (einschließlich Betroffene oder Aufsichtsbehörden) nicht ohne Zustimmung des Kunden über die Sicherheitsverletzung informieren, außer wenn er rechtlich verpflichtet ist.`
                        },
                        {
                            type: "p",
                            text: `**15.4 Business Continuity und Disaster Recovery.** Der Anbieter unterhält Backup-Systeme und einen Notfallwiederherstellungsplan, um den Service nach einem schwerwiegenden Vorfall wiederherzustellen. Backup- und Recovery-Prozesse werden regelmäßig getestet. Im Falle eines Desasters oder höherer Gewalt bemüht sich der Anbieter, die Verfügbarkeit so schnell wie möglich wiederherzustellen. Dennoch kann es in Extremszenarien zu Datenverlust kommen; der Kunde wird daher angehalten, eigene Kopien kritischer Daten zu halten. Die Haftung für Datenverlust ist in Abschnitt 17 geregelt.`
                        }
                    ]
                },
                {
                    title: "16. Gewährleistungen und Haftungsausschlüsse",
                    blocks: [
                        {
                            type: "p",
                            text: `**16.1 Service-Gewährleistung.** Der Anbieter gewährleistet, dass der Service während der Laufzeit dieses Vertrags im Wesentlichen den auf getprojectflow.com oder in der Dokumentation beschriebenen Funktionen entspricht und mit angemessener Sorgfalt erbracht wird. Bei Verletzung dieser Gewährleistung besteht der einzige und ausschließliche Rechtsbehelf des Kunden darin, dass der Anbieter angemessene Anstrengungen unternimmt, die Abweichung zu beheben oder, falls dies nicht innerhalb angemessener Zeit möglich ist, der Kunde den betroffenen Service beendet und eine anteilige Rückerstattung vorausbezahlter Gebühren für den Zeitraum erhält, in dem der Service nicht konform war. Ansprüche aus dieser Gewährleistung sind innerhalb von 30 Tagen nach Entdeckung des Problems anzuzeigen.`
                        },
                        {
                            type: "p",
                            text: `**16.2 Ausgeschlossene Gewährleistungsansprüche.** Die Gewährleistung gemäß Abschnitt 16.1 gilt nicht für: (i) Beta-Funktionen oder Testservices, die kostenlos bereitgestellt werden; (ii) Nutzung des Services entgegen diesem Vertrag oder der Dokumentation; (iii) Abweichungen, die durch Geräte, Software oder sonstige Technologie Dritter (einschließlich Integrationen) verursacht werden; oder (iv) Probleme, die durch Faktoren außerhalb des angemessenen Einflussbereichs des Anbieters entstehen (z. B. Internetausfälle oder höhere Gewalt).`
                        },
                        {
                            type: "p",
                            text: `**16.3 Gewährleistungen des Kunden.** Der Kunde sichert zu und gewährleistet: (a) er ist befugt, diesen Vertrag zu schließen und seine Pflichten zu erfüllen; (b) er und seine Nutzer verwenden den Service im Einklang mit diesem Vertrag und geltendem Recht; und (c) das Hochladen und die Nutzung von Kundendaten im Service (einschließlich personenbezogener Daten) verletzt keine Gesetze oder Rechte Dritter. Der Kunde gewährleistet ferner, dass er alle erforderlichen Einwilligungen oder Rechte für personenbezogene Daten Dritter besitzt, die er über den Service verarbeitet.`
                        },
                        {
                            type: "p",
                            text: `**16.4 Haftungsausschluss für weitere Gewährleistungen.** Soweit in diesem Vertrag nicht ausdrücklich geregelt, wird der Service "AS IS" und "AS AVAILABLE" bereitgestellt. Der Anbieter schließt - soweit gesetzlich zulässig - alle weiteren Gewährleistungen aus, ob ausdrücklich, konkludent oder gesetzlich, einschließlich etwaiger Gewährleistungen der Marktgängigkeit, Eignung für einen bestimmten Zweck, Rechtsmängelfreiheit oder Nichtverletzung von Rechten Dritter. Der Anbieter gewährleistet nicht, dass der Service fehlerfrei oder unterbrechungsfrei ist oder dass alle Fehler behoben werden. Der Anbieter garantiert nicht, dass der Service alle Anforderungen oder Erwartungen des Kunden erfüllt. Der Kunde erkennt an, dass die Leistung des Services von Internetverbindungen und Drittanbieterdiensten abhängen kann und dass das Herunterladen oder Abrufen von Daten oder Inhalten im Service auf eigenes Risiko erfolgt.`
                        }
                    ]
                },
                {
                    title: "17. Haftungsbeschränkung",
                    blocks: [
                        {
                            type: "p",
                            text: `**17.1 Unbeschränkte Haftung in bestimmten Fällen.** Nichts in diesem Vertrag beschränkt oder schließt die Haftung einer Partei aus für:`
                        },
                        {
                            type: "ul",
                            items: [
                                `(a) Tod oder Personenschäden, die durch Fahrlässigkeit oder Vorsatz verursacht wurden,`,
                                `(b) Betrug oder arglistige Täuschung,`,
                                `(c) Haftung, die gesetzlich nicht beschränkt oder ausgeschlossen werden darf (z. B. nach dem Produkthaftungsgesetz oder bei Übernahme einer Garantie), oder`,
                                `(d) vorsätzliche Pflichtverletzungen (Vorsatz).`
                            ]
                        },
                        {
                            type: "p",
                            text: `**17.2 Haftung bei leichter Fahrlässigkeit (Verletzung wesentlicher Pflichten).** Bei einfacher oder leichter Fahrlässigkeit haftet jede Partei (insbesondere der Anbieter) nur bei Verletzung wesentlicher Vertragspflichten ("wesentliche Vertragspflichten"). Wesentliche Vertragspflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags erst ermöglicht und auf deren Einhaltung die andere Partei regelmäßig vertraut. In diesen Fällen ist die Haftung auf die typischen und vorhersehbaren Schäden zum Zeitpunkt des Vertragsschlusses begrenzt, sofern kein Fall unbeschränkter Haftung vorliegt.`
                        },
                        {
                            type: "p",
                            text: `**17.3 Haftungshöchstgrenze.** Vorbehaltlich Abschnitt 17.1 (unbeschränkte Fälle) und unter Ausschluss von ausdrücklich vorgesehenen Gutschriften oder Rückerstattungen ist die Gesamthaftung jeder Partei aus oder im Zusammenhang mit diesem Vertrag (für alle Ansprüche, ob vertraglich, deliktisch (einschließlich Fahrlässigkeit) oder anderweitig) auf den Betrag der vom Kunden an den Anbieter in den zwölf (12) Monaten vor dem haftungsbegründenden Ereignis gezahlten oder geschuldeten Gebühren begrenzt. War die Vertragslaufzeit kürzer als 12 Monate, entspricht die Haftungsgrenze dem in diesem kürzeren Zeitraum gezahlten oder geschuldeten Gesamtbetrag (oder im Fall eines kostenlosen Testkunden EUR 0).`
                        },
                        {
                            type: "p",
                            text: `**17.4 Ausschluss bestimmter Schäden.** Soweit gesetzlich zulässig, haftet keine Partei für indirekte, besondere, zufällige, Folge- oder Strafschäden sowie für folgende Schäden (direkt oder indirekt): entgangener Gewinn, entgangene Geschäftsmöglichkeiten, Umsatzverluste, entgangene Einsparungen, Verlust oder Beschädigung von Daten (vorbehaltlich Abschnitt 17.5), oder Verlust des Goodwills, auch wenn die Partei auf die Möglichkeit solcher Schäden hingewiesen wurde und selbst wenn ein Rechtsbehelf seinen wesentlichen Zweck verfehlt.`
                        },
                        {
                            type: "p",
                            text: `**17.5 Haftung für Datenverlust.** Bei Verlust oder Beschädigung von Kundendaten besteht der einzige und ausschließliche Rechtsbehelf des Kunden darin, dass der Anbieter angemessene Anstrengungen unternimmt, die Daten aus dem neuesten Backup des Anbieters (falls vorhanden) wiederherzustellen. Die Haftung des Anbieters für Datenverlust (soweit nicht als Folgeschaden ausgeschlossen) ist in jedem Fall auf den typischen Aufwand begrenzt, der für die Wiederherstellung erforderlich gewesen wäre, wenn der Kunde angemessene Backups erstellt hätte.`
                        },
                        {
                            type: "p",
                            text: `**17.6 Anwendung der Haftungsbegrenzungen.** Die Parteien vereinbaren, dass die Haftungsbeschränkungen in diesem Abschnitt eine angemessene Risikoverteilung darstellen und dass Preisgestaltung und Vertragsbedingungen ohne diese Begrenzungen anders wären. Jede Partei ist verpflichtet, Schäden nach allgemeinen Rechtsgrundsätzen zu mindern. Die Haftungsbeschränkungen gelten für alle Ansprüche aus oder im Zusammenhang mit diesem Vertrag, unabhängig von der Anspruchsgrundlage, schränken jedoch nicht Zahlungspflichten nach Abschnitt 7 oder die Haftung des Kunden für Verletzung geistiger Eigentumsrechte des Anbieters oder Freistellungen nach Abschnitt 14.5 ein.`
                        },
                        {
                            type: "p",
                            text: `**17.7 Unabhängige Rechtsbehelfe.** Die in diesem Vertrag ausdrücklich vorgesehenen Rechtsbehelfe (z. B. Servicegutschriften, Kündigungsrechte oder Freistellung) bestehen zusätzlich zu gesetzlichen Ansprüchen, unterliegen jedoch den Haftungsbeschränkungen dieses Abschnitts.`
                        }
                    ]
                },
                {
                    title: "18. Drittanbieter-Services und Links",
                    blocks: [
                        {
                            type: "p",
                            text: `Der Service kann Funktionen enthalten, die mit Diensten Dritter interagieren, oder Links zu Websites oder Ressourcen Dritter enthalten. Beispielsweise kann der Service Integrationen mit anderen Projektmanagement-Tools, Dateispeichern oder KI-Plattformen ermöglichen oder Links zu Tutorials auf Drittseiten enthalten. Keine Gewähr oder Empfehlung: Der Anbieter empfiehlt oder verantwortet keine Drittanbieterdienste oder -websites, deren Verfügbarkeit, Richtigkeit oder Inhalte. Die Nutzung von Drittanbieterdiensten unterliegt deren eigenen Bedingungen und Datenschutzrichtlinien, die der Kunde prüfen muss. Keine Haftung: Der Anbieter haftet nicht für Schäden oder Verluste, die aus der Nutzung von Drittanbieterdiensten entstehen, einschließlich Datenaustausch zwischen Kunde und Drittanbieter. Der Kunde nutzt solche Dienste auf eigenes Risiko. Wenn ein Drittanbieter die Integration einstellt, ist der Anbieter nicht verpflichtet, Rückerstattungen oder Entschädigungen zu leisten, abgesehen von möglichen Exportwerkzeugen.`
                        }
                    ]
                },
                {
                    title: "19. Änderungen des Services und der Bedingungen",
                    blocks: [
                        {
                            type: "p",
                            text: `**19.1 Änderungen des Services.** Der Anbieter behält sich das Recht vor, den Service von Zeit zu Zeit in angemessener Weise zu ändern oder zu aktualisieren, z. B. zur Funktions- oder Sicherheitsverbesserung oder zur Einhaltung gesetzlicher Anforderungen. Wenn eine Änderung die Kernfunktionalität des Services wesentlich reduziert, informiert der Anbieter den Kunden rechtzeitig (z. B. per E-Mail oder In-App-Mitteilung). Der Kunde kann dann als alleinigen Rechtsbehelf den Service kündigen und eine anteilige Rückerstattung vorausbezahlter Gebühren für den verbleibenden Zeitraum erhalten, sofern die Kündigung innerhalb von 30 Tagen nach Inkrafttreten der Änderung erfolgt.`
                        },
                        {
                            type: "p",
                            text: `**19.2 Änderungen der Bedingungen.** Der Anbieter kann diesen Vertrag (einschließlich Anhänge) von Zeit zu Zeit aktualisieren oder ändern. Der Anbieter informiert den Kunden über wesentliche Änderungen mindestens 30 Tage vor Inkrafttreten, per E-Mail an die hinterlegte Kontaktadresse oder per In-App-Mitteilung. Widerspricht der Kunde, muss er dies schriftlich innerhalb der Frist mitteilen. Bei Monatsabonnements gelten die neuen Bedingungen mit Beginn der nächsten Monatslaufzeit nach Ablauf der 30-Tage-Frist (Nutzung nach Inkrafttreten gilt als Zustimmung). Bei Jahres- oder Festlaufzeitverträgen werden die Parteien bei fristgerechtem Widerspruch in gutem Glauben verhandeln; kommt keine Einigung zustande, kann der Kunde entweder (a) bis zum Ende der laufenden Laufzeit unter den bisherigen Bedingungen fortsetzen, danach gelten die neuen Bedingungen für Verlängerungen, oder (b) den Vertrag zum Ende der laufenden Laufzeit kündigen (oder früher, wenn die Änderungen die Nutzung wesentlich beeinträchtigen und der Anbieter eine anteilige Rückerstattung gewährt). Erfolgt kein Widerspruch, werden die neuen Bedingungen mit Ablauf der Frist oder zum angegebenen Datum verbindlich. Die Mitteilung des Anbieters weist auf das Widerspruchs- bzw. Nichtverlängerungsrecht hin. Geringfügige Änderungen (z. B. Klarstellungen, die die Rechte des Kunden nicht wesentlich beeinträchtigen) können ohne Vorankündigung erfolgen und werden im Versionsdatum der Bedingungen abgebildet.`
                        },
                        {
                            type: "p",
                            text: `**19.3 Regulatorische Änderungen.** Wenn Änderungen von Gesetzen oder Verordnungen (einschließlich DSGVO) Änderungen am Service oder den Bedingungen erfordern oder eine Aufsichtsbehörde bzw. ein Gericht Änderungen verlangt, kann der Anbieter diese Änderungen vornehmen und wird sich bemühen, die Auswirkungen auf den Kunden zu minimieren. Gesetzlich erforderliche Änderungen können mit kürzerer Frist erfolgen, sofern dies zur Einhaltung erforderlich ist.`
                        }
                    ]
                },
                {
                    title: "20. Compliance, Exportkontrolle und Sanktionen",
                    blocks: [
                        {
                            type: "p",
                            text: `**20.1 Exportkontrollen.** Der Service einschließlich Software, Dokumentation und technischer Daten kann Exportkontroll- und Sanktionsgesetzen der USA, der EU, Deutschlands und anderer Rechtsordnungen unterliegen. Der Kunde versichert, dass er nicht auf Regierungslisten von Personen oder Unternehmen steht, die vom Export ausgeschlossen sind oder mit denen Geschäfte verboten sind (z. B. die SDN-Liste des US-Finanzministeriums oder die EU-Sanktionsliste). Der Kunde darf autorisierten Nutzern den Zugriff auf den Service nicht in Verletzung von Exportembargos, Verboten oder Beschränkungen ermöglichen, einschließlich (ohne Einschränkung) der Ausfuhr oder Wiederausfuhr des Services in umfassend sanktionierte Länder (z. B. Kuba, Iran, Nordkorea, Syrien oder die Krim-Region) ohne erforderliche Genehmigung.`
                        },
                        {
                            type: "p",
                            text: `**20.2 Anti-Korruption.** Jede Partei verpflichtet sich, in Verbindung mit diesem Vertrag und der Nutzung des Services alle anwendbaren Anti-Korruptions- und Anti-Bestechungsgesetze einzuhalten (z. B. den U.S. Foreign Corrupt Practices Act und den UK Bribery Act). Keine Partei wird Bestechungsgelder, Kickbacks oder sonstige unzulässige Zahlungen oder Vorteile anbieten, versprechen, leisten oder genehmigen, um Entscheidungen unzulässig zu beeinflussen oder unfaire Vorteile zu erlangen.`
                        },
                        {
                            type: "p",
                            text: `**20.3 Gesetzliche Compliance.** Der Kunde ist verantwortlich sicherzustellen, dass seine Nutzung des Services mit allen für sein Geschäft geltenden Gesetzen und Vorschriften übereinstimmt, einschließlich Datenschutz-, Arbeits- und branchenspezifischer Regelungen. Der Anbieter hält die für ihn als SaaS-Anbieter und Auftragsverarbeiter geltenden Gesetze ein.`
                        }
                    ]
                },
                {
                    title: "21. Anwendbares Recht und Gerichtsstand",
                    blocks: [
                        {
                            type: "p",
                            text: `**21.1 Anwendbares Recht.** Dieser Vertrag und alle Streitigkeiten daraus oder im Zusammenhang damit unterliegen dem Recht der Bundesrepublik Deutschland unter Ausschluss des Kollisionsrechts. Das UN-Kaufrecht (CISG) findet keine Anwendung.`
                        },
                        {
                            type: "p",
                            text: `**21.2 Gerichtsstand.** Die Gerichte am [eingetragenen Sitz des Anbieters] (Deutschland) sind ausschließlich zuständig für Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag, außer der Anbieter kann Unterlassungsansprüche oder die Durchsetzung seiner geistigen Eigentumsrechte in jeder zuständigen Gerichtsbarkeit geltend machen. Jede Partei stimmt diesem Gerichtsstand zu und verzichtet auf Einwände (z. B. Unzuständigkeit oder forum non conveniens), soweit rechtlich zulässig.`
                        },
                        {
                            type: "p",
                            text: `**21.3 Zwingendes Ortsrecht.** Ungeachtet der vorstehenden Rechtswahl- und Gerichtsstandsregelungen soll dieser Vertrag dem Kunden nicht den Schutz zwingender Bestimmungen nehmen, die nach dem Recht des Sitzstaates des Kunden nicht abbedungen werden dürfen (z. B. bestimmte lokale Datenschutz- oder zwingende Schutzvorschriften). In diesem Fall gilt der Vertrag als in dem notwendigen Umfang angepasst, um diesen zwingenden Bestimmungen zu entsprechen.`
                        }
                    ]
                },
                {
                    title: "22. Verschiedenes",
                    blocks: [
                        {
                            type: "p",
                            text: `**22.1 Gesamter Vertrag.** Dieser Vertrag einschließlich aller Anhänge und Bestellformulare stellt die gesamte Vereinbarung der Parteien dar und ersetzt alle vorherigen oder gleichzeitigen Vereinbarungen, Verhandlungen, Zusicherungen oder Vorschläge, ob schriftlich oder mündlich, bezüglich des Vertragsgegenstands. Jede Partei bestätigt, dass sie sich beim Abschluss dieses Vertrags nicht auf Zusicherungen verlassen hat, die nicht ausdrücklich in diesem Vertrag enthalten sind. Bedingungen auf Bestellformularen oder sonstigen Geschäftsdokumenten des Kunden haben keine Wirkung und werden zurückgewiesen, selbst wenn der Anbieter sie unterschreibt oder ihnen nicht widerspricht.`
                        },
                        {
                            type: "p",
                            text: `**22.2 Änderung und Verzicht.** Sofern nicht in Abschnitt 19 geregelt, bedürfen Änderungen oder Ergänzungen dieses Vertrags der Schriftform und Unterzeichnung durch beide Parteien (elektronische Form zulässig). Ein Verzicht auf ein Recht bei einer Gelegenheit gilt nicht als Verzicht auf dasselbe oder andere Rechte in der Zukunft. Die Nichtdurchsetzung einer Bestimmung stellt keinen Verzicht oder eine Änderung dar.`
                        },
                        {
                            type: "p",
                            text: `**22.3 Salvatorische Klausel.** Wird eine Bestimmung dieses Vertrags von einem zuständigen Gericht für ungültig, illegal oder nicht durchsetzbar erklärt, wird diese Bestimmung in dem maximal zulässigen Umfang durchgesetzt, um die Absicht der Parteien zu erfüllen, und die übrigen Bestimmungen bleiben wirksam. Ist eine Bestimmung in einer Jurisdiktion ungültig, aber in einer anderen gültig, bleibt die Gültigkeit in der anderen Jurisdiktion unberührt. Die Parteien bemühen sich, eine ungültige Bestimmung durch eine gültige zu ersetzen, die dem ursprünglichen Zweck möglichst nahekommt.`
                        },
                        {
                            type: "p",
                            text: `**22.4 Abtretung.** Der Kunde darf diesen Vertrag (ganz oder teilweise) nicht abtreten oder übertragen und keine Pflichten delegieren, ohne vorherige schriftliche Zustimmung des Anbieters, außer der Kunde darf den Vertrag im Zusammenhang mit einer Fusion, Übernahme oder dem Verkauf von im Wesentlichen allen Vermögenswerten oder Anteilen mit schriftlicher Mitteilung an den Anbieter abtreten (sofern der Erwerber kein direkter Wettbewerber des Anbieters ist). Der Anbieter darf diesen Vertrag an ein verbundenes Unternehmen oder im Zusammenhang mit einer Fusion, Umstrukturierung, Übernahme oder anderweitigen Übertragung seines Geschäfts oder Vermögens übertragen. Vorbehaltlich dessen bindet der Vertrag die Parteien und deren zulässige Rechtsnachfolger und Abtretungsempfänger. Jede unzulässige Abtretung ist nichtig.`
                        },
                        {
                            type: "p",
                            text: `**22.5 Subunternehmer.** Der Anbieter darf Pflichten aus diesem Vertrag an Dritte vergeben (z. B. Rechenzentrumsbetreiber oder Supportdienstleister), wobei der Anbieter für die Leistung verantwortlich bleibt und Unterauftragsverarbeiter, die personenbezogene Daten verarbeiten, Verpflichtungen entsprechend der DPA unterliegen.`
                        },
                        {
                            type: "p",
                            text: `**22.6 Verhältnis der Parteien.** Die Parteien sind unabhängige Vertragspartner. Dieser Vertrag begründet keine Partnerschaft, Franchise, Joint Venture, Agentur, Treuhand- oder Arbeitsverhältnis. Keine Partei ist befugt, im Namen der anderen Partei zu handeln oder diese zu binden, sofern nicht ausdrücklich vereinbart.`
                        },
                        {
                            type: "p",
                            text: `**22.7 Keine Drittbegünstigten.** Es bestehen keine Drittbegünstigten dieses Vertrags; er dient ausschließlich den Unterzeichnern und deren zulässigen Rechtsnachfolgern. Freigestellte Personen nach Abschnitt 14.5 (z. B. verbundene Unternehmen und Mitarbeiter des Anbieters) gelten jedoch insoweit als begünstigte Dritte.`
                        },
                        {
                            type: "p",
                            text: `**22.8 Mitteilungen.** Laufende Kommunikation (z. B. konto- oder supportbezogene Mitteilungen) kann per E-Mail an die angegebenen Kontakte erfolgen. Rechtliche Mitteilungen zu Vertragsverletzung, Kündigung oder Freistellungsansprüchen ("Rechtliche Mitteilungen") sind schriftlich per Kurier oder Einschreiben an die im Bestellformular angegebenen Adressen oder an die oben genannte Adresse des Anbieters zu senden (oder an eine andere Adresse, die schriftlich mitgeteilt wurde). Zusätzlich kann der Anbieter Rechtliche Mitteilungen an die E-Mail-Adresse des registrierten Kontoinhabers senden. Rechtliche Mitteilungen gelten als zugegangen mit Zustellnachweis (oder bei E-Mail mit Versand an die korrekte Adresse, sofern keine Fehlermeldung vorliegt).`
                        },
                        {
                            type: "p",
                            text: `**22.9 Sprache.** Dieser Vertrag wird in englischer Sprache verfasst, die für die Auslegung maßgeblich ist. Übersetzungen (falls bereitgestellt) dienen nur der Bequemlichkeit. Im Konfliktfall hat die englische Version Vorrang. Alle Mitteilungen und Hinweise erfolgen in englischer Sprache, sofern nicht anders vereinbart.`
                        },
                        {
                            type: "p",
                            text: `**22.10 Überschriften und Auslegung.** Abschnittsüberschriften dienen nur der Bequemlichkeit und beeinflussen die Auslegung nicht. Begriffe wie "einschließlich" oder "zum Beispiel" gelten als ergänzt durch "ohne Einschränkung", sofern der Kontext nichts anderes nahelegt. Verweise auf Gesetze oder Vorschriften umfassen deren Änderungen oder Nachfolgeregelungen.`
                        },
                        {
                            type: "p",
                            text: `**22.11 Ausfertigungen und elektronische Annahme.** Dieser Vertrag kann in Ausfertigungen unterzeichnet werden (z. B. durch Austausch unterzeichneter Seiten oder über elektronische Signaturdienste), die zusammen ein Instrument bilden. Alternativ kann die Annahme dieses Vertrags durch Click-through-Akzeptanz oder elektronische Signatur erfolgen und gilt als rechtsverbindliche Ausführung.`
                        }
                    ]
                },
                {
                    title: "Anhänge",
                    blocks: [
                        {
                            type: "p",
                            text: `Die folgenden Anhänge sind Bestandteil dieses Vertrags:`
                        },
                        {
                            type: "ul",
                            items: [
                                `Anhang A: Acceptable Use Policy (AUP)`,
                                `Anhang B: Service Level Agreement (SLA) / Support-Richtlinie`,
                                `Anhang C: Auftragsverarbeitungsvereinbarung (Zusammenfassung & Einbeziehung durch Verweis)`
                            ]
                        }
                    ]
                },
                {
                    title: "Anhang A: Acceptable Use Policy (AUP)",
                    blocks: [
                        {
                            type: "p",
                            text: `Diese AUP enthält zusätzliche Beispiele unzulässiger Nutzungen und ist Bestandteil dieses Vertrags. Zusätzlich zu den Pflichten in Abschnitt 6 verpflichtet sich der Kunde (einschließlich aller autorisierten Nutzer), den Service nicht zu verwenden:`
                        },
                        {
                            type: "ul",
                            items: [
                                `**Zur Rechtsverletzung:** in einer Weise, die gegen geltende Gesetze, Verordnungen oder Gerichtsbeschlüsse verstößt. Dazu gehören Datenschutzgesetze, Gesetze zum geistigen Eigentum, Exportkontrollgesetze und Strafgesetze.`,
                                `**Zur Ausbeutung von Minderjährigen:** um Minderjährige zu schädigen oder auszubeuten (z. B. durch unangemessene Inhalte oder die Erhebung persönlicher Informationen).`,
                                `**Zum Stalking oder Belästigen:** zur Belästigung, Verfolgung oder Bedrohung von Personen.`,
                                `**Zur Täuschung oder für Phishing:** um eine Person oder Organisation zu imitieren oder falsche Angaben zu machen (z. B. sich als Vertreter eines Unternehmens auszugeben). Ebenso ist die Erstellung von Phishing-Seiten/E-Mails oder Betrugsmaschen verboten.`,
                                `**Für hochriskante Aktivitäten:** in Umgebungen, in denen die Nutzung oder ein Ausfall zu Tod, Personenschäden oder Umweltschäden führen könnte (z. B. Betrieb medizinischer Geräte, Flugsicherung, Nuklearanlagen), sofern nicht ausdrücklich vom Anbieter erlaubt und durch zusätzliche Garantien oder Versicherungen abgesichert.`,
                                `**Zum Übertragen von Viren:** zum Hochladen oder Senden von Viren, Malware oder anderem schädlichen Code, der Software, Hardware oder Geräte beeinträchtigen soll.`,
                                `**Zum Krypto-Mining:** sofern nicht ausdrücklich erlaubt, zum Ausführen von Kryptowährungs-Mining oder ähnlich ressourcenintensiven Tätigkeiten.`,
                                `**Zur Umgehung von Sicherheit:** um Sicherheits- oder Zugriffsrestriktionen des Services zu umgehen oder zu unterlaufen. Dies umfasst auch die Nutzung des Services zur Umgehung seiner Sicherheits- oder Verschlüsselungsmechanismen (z. B. Extraktion von Schlüsseln oder Tests von Drittsystemen ohne Genehmigung).`,
                                `**Automatisierte Nutzung:** bei Nutzung von Skripten oder Bots über die API nur in gutartiger Weise (z. B. Einhaltung von Rate Limits, keine Endlosschleifen). Massendownloads oder Scraping von Daten, die nicht Ihnen gehören, sind untersagt.`,
                                `**Speicherung illegaler Materialien:** den Service als Plattform zur Speicherung von nicht zweckbezogenen Inhalten zu nutzen, insbesondere wenn diese illegal, rechtsverletzend oder obszön sind.`,
                                `**Weiterverkauf oder unbefugte Weitergabe:** nicht öffentliche Service-Funktionen oder Inhalte an Dritte weiterzugeben oder einen Drittservice zu entwickeln, der den Service außerhalb erlaubter API-Nutzung einbindet, ohne vorherige schriftliche Zustimmung des Anbieters.`
                            ]
                        },
                        {
                            type: "p",
                            text: `Der Anbieter kann die AUP von Zeit zu Zeit aktualisieren, indem er eine neue Version veröffentlicht oder den Kunden anderweitig informiert. Wesentliche Änderungen werden gemäß diesem Vertrag angekündigt. Erfährt der Kunde von einem Verstoß eines autorisierten Nutzers gegen die AUP, hat er dessen Zugang unverzüglich zu sperren und den Anbieter zu informieren. Der Anbieter behält sich das Recht vor (ohne Verpflichtung), die Einhaltung der AUP zu überwachen und Inhalte zu entfernen oder Konten zu sperren, die gegen die AUP oder diesen Vertrag verstoßen.`
                        }
                    ]
                },
                {
                    title: "Anhang B: Service Level Agreement (SLA) / Support-Richtlinie",
                    blocks: [
                        {
                            type: "p",
                            text: `Dieser Anhang enthält zusätzliche Details zur Serviceverfügbarkeit und zum Support. Sofern eine separate, unterzeichnete SLA besteht, hat diese im Konfliktfall Vorrang. Andernfalls gilt Folgendes:`
                        },
                        {
                            type: "ol",
                            items: [
                                `**Verfügbarkeitsziel:** Der Anbieter strebt eine Verfügbarkeit von mindestens 99,5 % pro Kalendermonat an, ausgenommen geplante Wartung und höhere Gewalt. "Uptime" bedeutet, dass der Service grundsätzlich erreichbar und funktionsfähig ist (keine Garantie für Performance oder Antwortzeiten). Geplante Wartung erfolgt typischerweise in Zeiten geringer Nutzung; bei geplanten Ausfällen von mehr als 15 Minuten informiert der Anbieter mindestens 2 Tage im Voraus. Der Anbieter bemüht sich, Wartungszeiten auf 4 Stunden pro Monat zu begrenzen.`,
                                `**Messung:** Die Verfügbarkeit wird serverseitig am Übergabepunkt des Anbieternetzwerks gemessen (d. h. dort, wo das Netzwerk des Anbieters mit dem öffentlichen Internet verbunden ist). Ausfälle oder Probleme auf Kundenseite oder im allgemeinen Internet sind nicht berücksichtigt. Die Überwachungstools des Anbieters bestimmen die Verfügbarkeit.`,
                                `**Servicegutschriften:** (Optional; sofern der Anbieter Servicegutschriften anbietet, stehen die Bedingungen hier. Falls keine Gutschriften: Dieser Vertrag sieht keine automatischen Gutschriften vor. Bei einer Verfügbarkeit unter 99,5 % aufgrund von Ursachen innerhalb des Einflussbereichs des Anbieters kann der Kunde jedoch Kontakt aufnehmen, um eine Kulanzgutschrift oder Verlängerung zu prüfen. Solche Maßnahmen liegen im Ermessen des Anbieters und berühren die Haftungsbegrenzungen nicht.)`,
                                `**Support-Reaktionszeiten:** Das Support-Team bemüht sich, innerhalb von 24 Stunden an Werktagen auf Support-Tickets oder E-Mails zu antworten. Eine erste Antwort bedeutet eine menschliche Rückmeldung (keine automatische Antwort) mit einer ersten Einschätzung oder Rückfragen. Die Behebungszeit hängt von der Komplexität ab; kritische Störungen (Service komplett down oder wesentliche Funktionen inoperabel) werden so schnell wie möglich bearbeitet, ggf. auch außerhalb der Geschäftszeiten.`,
                                `**Eskalation:** Bei kritischen Störungen (Service nicht verfügbar) sollte der Kunde das Ticket als "Urgent" markieren oder einen bereitgestellten Notfallkontakt nutzen. Der Anbieter eskaliert solche Fälle intern, um eine schnelle Antwort zu gewährleisten. Für weniger schwerwiegende Themen (kleine Bugs oder Fragen) gilt die Standardreaktion innerhalb eines Werktages.`,
                                `**Ausnahmen:** Der Anbieter ist nicht verantwortlich für die Nichteinhaltung von Leistungszielen, soweit verursacht durch: (i) Missbrauch des Services oder Vertragsverstöße des Kunden bzw. seiner Nutzer; (ii) Internet- oder Telekommunikationsausfälle außerhalb des Anbieters; (iii) Beta-Funktionen oder Testnutzung; (iv) höhere Gewalt (z. B. DDoS-Angriffe, Ausfälle großer Cloud-Provider, Naturkatastrophen); oder (v) kundenseitige Netz- oder Geräteprobleme.`,
                                `**Aktualisierung der SLA:** Der Anbieter kann diese Support- und Service-Level-Zusagen von Zeit zu Zeit prüfen und aktualisieren (insbesondere wenn neue Supportpläne oder Premium-Support eingeführt werden). Eine wesentliche Reduzierung der Service Level wird als Änderung gemäß Abschnitt 19.2 behandelt.`
                            ]
                        }
                    ]
                },
                {
                    title: "Anhang C: Zusammenfassung der Auftragsverarbeitungsvereinbarung (DPA)",
                    blocks: [
                        {
                            type: "p",
                            text: `Dieser Anhang C gibt einen Überblick über die wesentlichen Bedingungen der DPA und bestätigt ihre Einbeziehung. Das vollständige DPA-Dokument (separat oder unter https://getprojectflow.com verfügbar) enthält detailliertere Bestimmungen gemäß Art. 28 DSGVO und anderen Datenschutzgesetzen.`
                        },
                        {
                            type: "p",
                            text: `**Parteien und Rollen:** Diese DPA besteht zwischen Digital Products by ${COMPANY_NAME} als Auftragsverarbeiter und dem Kunden als Verantwortlichem (im Sinne der DSGVO). Sie gilt, wenn Kundendaten personenbezogene Daten enthalten und der Anbieter sie im Rahmen der Servicebereitstellung verarbeitet.`
                        },
                        {
                            type: "p",
                            text: `**Gegenstand:** Die Verarbeitung dient der Bereitstellung des Services für den Kunden. Dauer: Die Verarbeitung dauert für die Laufzeit des Vertrags bis zur Löschung personenbezogener Daten gemäß den Vertragsbedingungen. Art und Zweck: Hosting, Übermittlung und Verarbeitung von Daten, soweit erforderlich, um Projektmanagement- und zugehörige Funktionen bereitzustellen. Arten personenbezogener Daten: Typischerweise Kontaktinformationen (Namen, E-Mails), projektbezogene Informationen (einschließlich möglicher personenbezogener Daten in Beschreibungen oder Dateien) sowie Kommunikationsinhalte (Kommentare, Nachrichten). Kategorien betroffener Personen: Mitarbeiter, Auftragnehmer, Kunden oder andere Personen, deren Daten in Kundendaten enthalten sind.`
                        },
                        {
                            type: "p",
                            text: `**Pflichten des Auftragsverarbeiters:** Der Anbieter (Auftragsverarbeiter) verarbeitet personenbezogene Daten nur gemäß dokumentierten Anweisungen des Kunden (dieser Vertrag und die Nutzung des Services gelten als initiale Anweisungen). Der Anbieter stellt sicher, dass sein Personal zur Vertraulichkeit verpflichtet ist und angemessene technische und organisatorische Sicherheitsmaßnahmen (Art. 32 DSGVO) implementiert.`
                        },
                        {
                            type: "p",
                            text: `**Unterauftragsverarbeitung:** Der Kunde erteilt eine allgemeine Genehmigung zur Beauftragung von Unterauftragsverarbeitern für die Serviceerbringung (z. B. Cloud-Hosting, E-Mail, Support-Tools). Der Anbieter führt eine Liste der Unterauftragsverarbeiter und informiert über Änderungen (z. B. via Website oder E-Mail) mit Gelegenheit zum Widerspruch. Unterauftragsverarbeiter sind an gleichwertige Datenschutzpflichten gebunden. Wichtige Unterauftragsverarbeiter umfassen: Hosting (z. B. AWS oder ähnlich), E-Mail-Versand (falls zutreffend) usw. Hinweis: die konkrete Liste wird separat bereitgestellt.`
                        },
                        {
                            type: "p",
                            text: `**Internationale Übermittlungen:** Wenn der Anbieter oder Unterauftragsverarbeiter personenbezogene Daten aus der EU/dem EWR in ein Land ohne angemessenes Datenschutzniveau übermitteln, gelten die EU-Standardvertragsklauseln (SCCs) als vereinbart, wobei der Kunde als "Datenexporteur" und der Anbieter als "Datenimporteur" gilt. Ergänzende Sicherheitsmaßnahmen (z. B. Verschlüsselung) werden umgesetzt, soweit erforderlich.`
                        },
                        {
                            type: "p",
                            text: `**Unterstützung des Verantwortlichen:** Der Anbieter unterstützt den Kunden angemessen bei der Erfüllung von Betroffenenrechten (Auskunft, Berichtigung, Löschung usw.), bei Datenschutz-Folgenabschätzungen (DPIA) und bei Konsultationen mit Aufsichtsbehörden, soweit erforderlich. Für umfangreiche Unterstützungsleistungen kann der Anbieter eine angemessene Gebühr berechnen.`
                        },
                        {
                            type: "p",
                            text: `**Meldung von Datenschutzverletzungen:** Der Anbieter informiert den Kunden unverzüglich nach Kenntniserlangung einer Datenschutzverletzung mit Kundendaten und stellt Informationen bereit, die der Kunde zur Erfüllung seiner Meldepflichten benötigt.`
                        },
                        {
                            type: "p",
                            text: `**Löschung oder Rückgabe von Daten:** Nach Beendigung des Services löscht oder gibt der Anbieter personenbezogene Daten im Auftrag des Kunden zurück, soweit nicht gesetzliche Aufbewahrungspflichten entgegenstehen. Auf Wunsch werden Daten in einem gängigen Format bereitgestellt. Minimale Daten können vorübergehend in Backups oder Logs verbleiben und werden später überschrieben.`
                        },
                        {
                            type: "p",
                            text: `**Audits:** Der Kunde kann die Einhaltung der DPA prüfen, entweder durch Einsicht in verfügbare Zertifizierungen/Reports (z. B. ISO 27001, SOC 2, sofern vorhanden) oder durch ein angemessenes Audit (ggf. durch einen Dritten unter Vertraulichkeit) mit Vorankündigung. Umfang und Zeitpunkt eines Audits werden abgestimmt, um den Betrieb minimal zu beeinträchtigen. Auditkosten trägt der Kunde, sofern kein wesentlicher Verstoß festgestellt wird.`
                        },
                        {
                            type: "p",
                            text: `**Haftung im Rahmen der DPA:** Die Haftungsbegrenzungen des Hauptvertrags gelten auch für die DPA. Keine Partei haftet für DPA-Verstöße über die in Abschnitt Haftung festgelegten Grenzen hinaus, sofern gesetzlich zulässig.`
                        },
                        {
                            type: "p",
                            text: `**Rangfolge:** Bei Konflikten zwischen DPA und Hauptvertrag oder anderen Dokumenten hat die DPA hinsichtlich Datenschutzfragen Vorrang. Die SCCs (falls verwendet) haben in ihrem Anwendungsbereich Vorrang vor beiden.`
                        },
                        {
                            type: "p",
                            text: `**Sonstiges (DPA):** Die DPA enthält die zwingenden Klauseln des Art. 28(3) und (4) DSGVO. Sie begründet keine Rechte Dritter. Änderungen der DPA bedürfen der Schriftform. Die DPA kann als Anhang oder separates Dokument bestehen; in jedem Fall ist sie rechtlich bindend, sobald der Hauptvertrag gilt und der Kunde den Service zur Verarbeitung personenbezogener Daten nutzt.`
                        }
                    ]
                }
            ]
        },
        appPrivacy: {
            lastUpdatedLabel: "Zuletzt aktualisiert:",
            intro: {
                title: "1. Einleitung",
                text: "Willkommen zur Datenschutzerklärung für ProjectFlow (der „Dienst“). Diese Richtlinie erklärt, wie wir Ihre personenbezogenen Daten erfassen, verwenden, offenlegen und schützen, wenn Sie unseren Dienst nutzen. Wir verpflichten uns zur Einhaltung der EU-Datenschutz-Grundverordnung (DSGVO) und anderer geltender Datenschutzgesetze. Bitte lesen Sie diese Richtlinie sorgfältig durch, um unseren Umgang mit Ihren Informationen zu verstehen."
            },
            controller: {
                title: "2. Verantwortlicher und Kontaktinformationen",
                text: `Der **Dienst** wird von **${COMPANY_NAME}** betrieben, der der „**Verantwortliche**“ für Ihre personenbezogenen Daten ist. **${COMPANY_NAME}** hat seinen Sitz in **Frühlingsstraße 8, ${COMPANY_ZIP} ${COMPANY_CITY}, Deutschland**. Wenn Sie Fragen oder Anliegen bezüglich Ihrer personenbezogenen Daten haben, können Sie uns unter **hello@getprojectflow.com** kontaktieren.`,
                subtitle: "2.1 Verantwortlicher vs. Auftragsverarbeiter",
                subtext: "In den meisten Fällen fungieren wir als Verantwortlicher für Informationen, die Sie direkt dem Dienst bereitstellen (z. B. Ihre Kontodaten). Für personenbezogene Daten jedoch, die Sie im Namen anderer auf die Plattform hochladen oder dort verwalten (z. B. Kontaktlisten für E-Mail-Kampagnen oder personenbezogene Daten Ihrer Teammitglieder in einem Workspace), sind Sie oder Ihre Organisation möglicherweise der Verantwortliche, und wir fungieren als Auftragsverarbeiter, der diese Daten gemäß Ihren Anweisungen verarbeitet. In diesen Fällen sind Sie dafür verantwortlich, sicherzustellen, dass Sie eine Rechtsgrundlage für die Verarbeitung dieser personenbezogenen Daten haben, und den betroffenen Personen alle erforderlichen Mitteilungen zukommen zu lassen."
            },
            collectedData: {
                title: "3. Personenbezogene Daten, die wir erfassen",
                intro: "Wir erfassen verschiedene Arten von personenbezogenen Daten, wenn Sie **ProjectFlow** nutzen. Dazu gehören Informationen, die Sie uns direkt zur Verfügung stellen, Informationen, die durch Ihre Nutzung des Dienstes generiert werden, und Informationen von integrierten Drittanbieterdiensten. Nachfolgend finden Sie eine Übersicht über die Datenkategorien, die wir verarbeiten:",
                account: {
                    title: "3.1 Kontoinformationen",
                    text: "Wenn Sie ein **Konto** registrieren, erfassen wir Ihre **E-Mail-Adresse** und bitten Sie möglicherweise um einen Anzeigenamen und ein Profilfoto. Diese grundlegenden Profildaten werden in unseren Systemen gespeichert. Wenn Sie sich über einen OAuth-Anbieter (wie Google oder GitHub) anmelden, erhalten wir Ihren Namen und Ihre E-Mail-Adresse von diesem Anbieter anstelle einer manuellen Anmeldung. Ihre Benutzer-ID wird ebenfalls zur Identifizierung im System aufgezeichnet. Diese Informationen sind notwendig, um Ihr Benutzerkonto zu erstellen und zu führen."
                },
                auth: {
                    title: "3.2 Authentifizierungsdaten",
                    text: "Wir verwenden **Firebase Authentication**, um Benutzeranmeldungen zu verwalten. Wenn Sie sich mit E-Mail/Passwort registrieren, wird Ihr Passwort in gehashter Form von Firebase gespeichert (wir sehen Ihr Rohpasswort nie). Wir speichern auch Authentifizierungsfaktoren und Anmeldeinformationen, wie sie für die Sicherheit erforderlich sind: Wenn Sie beispielsweise die Zwei-Faktor-Authentifizierung (2FA) mit einer Authentifizierungs-App (TOTP) aktivieren, wird die Tatsache, dass 2FA aktiviert ist (und die notwendigen geheimen Daten zur Überprüfung von Codes), sicher von Firebase gespeichert. Wenn Sie passwortlose Anmeldemethoden wie Passkeys (WebAuthn) verwenden, speichern wir Ihre Passkey-Anmeldeinformationen (öffentlicher Schlüssel, Anmeldeinformations-ID und Gerätedetails), die mit Ihrem Konto verknüpft sind. Dies ermöglicht Ihnen die Authentifizierung mit biometrischen Daten oder Sicherheitsschlüsseln. Wir speichern auch Informationen über Ihre Authentifizierungsanbieter (z. B. ob Sie ein Google- oder GitHub-Konto für die Anmeldung verknüpft haben). All diese Daten werden erfasst, um Ihr Konto zu sichern und Ihre bevorzugten Anmeldemethoden zu ermöglichen."
                },
                profile: {
                    title: "3.3 Profil- und Workspace-Daten",
                    text: "Sie haben die Möglichkeit, zusätzliche **Profildetails** in Ihrem Konto anzugeben. Dazu können ein Anzeigename (sofern nicht bereits angegeben) sowie optionale Informationen wie Ihre Berufsbezeichnung, Biografie, Adresse, Fähigkeiten oder ein Profilbild gehören. Wenn Sie diese Felder in Ihrem Profil ausfüllen, erfassen und speichern wir diese Informationen. Sie können Ihre Datenschutzeinstellungen für einige Profilfelder innerhalb der App anpassen (z. B. wer in Ihrem Workspace Ihre E-Mail-Adresse oder andere Details sehen kann). Wir erfassen auch Ihre Workspace-Mitgliedschaft und Rollen. Wenn Sie einem Workspace (Teamkonto) angehören, speichern wir Ihre Rolle (z. B. Eigentümer, Admin, Mitglied, Gast) und Gruppenmitgliedschaften innerhalb dieses Workspaces. Der Dienst zeichnet die Projekte und Gruppen auf, auf die Sie Zugriff haben, sowie wer Sie eingeladen hat oder wann Sie einem Workspace beigetreten sind. Diese Workspace-Daten werden verwendet, um Berechtigungen und Funktionen für die Zusammenarbeit zu verwalten."
                },
                content: {
                    title: "3.4 Projekt- und Inhaltsdaten",
                    text: "**ProjectFlow** ist eine Plattform für Produktivität und Projektmanagement, daher verarbeiten wir naturgemäß die **Inhalte**, die Sie und Ihr Team in den Dienst eingeben. Dazu gehören Projektdetails und Metadaten, Aufgaben und Probleme (Issues), die Sie erstellen oder die Ihnen zugewiesen sind, Meilensteine, Mind-Map-Einträge, Kommentare, die Sie posten, Dateien oder Medien, die Sie hochladen, und alle anderen Inhalte oder Daten, die Sie während der Nutzung der Plattform übermitteln. Wir speichern diese Daten in unserer Datenbank und unserem Dateispeicher, um die Kernfunktionen des Dienstes (Organisation Ihrer Projekte und Workflows) bereitzustellen. Wenn Sie beispielsweise eine Aufgabe erstellen oder einen Kommentar hinterlassen, speichern wir diesen Inhalt zusammen mit Informationen darüber, wer ihn erstellt hat und wann. Ebenso werden Dateien, die Sie hochladen (wie Bilder oder Dokumente in die Medienbibliothek oder als Anhänge), in unserem Cloud-Speicher gespeichert und Ihrem Konto oder Projekt zugeordnet. Bitte beachten Sie: Die Inhalte, die Sie und Ihre Benutzer eingeben, können zufällig personenbezogene Daten enthalten (z. B. könnte eine Aufgabenbeschreibung den Namen oder die Kontaktinformationen einer Person enthalten, wenn Sie diese hinzufügen). Wir verlangen normalerweise nicht, dass Sie besondere Kategorien personenbezogener Daten in die Plattform eingeben, und Sie sollten das Hochladen sensibler persönlicher Informationen vermeiden, es sei denn, dies ist notwendig. Alle personenbezogenen Daten, die in Ihren Projektinhalten enthalten sind, werden von uns ausschließlich zur Bereitstellung des Dienstes für Sie verarbeitet (wir verwenden sie nicht für unsere eigenen Zwecke)."
                },
                social: {
                    title: "3.5 Daten zu Social- und Marketing-Funktionen",
                    text: "Wenn Sie die integrierten Funktionen des **Social Studio** oder der **Marketing-Suite** nutzen, erfassen wir die Daten, die Sie für diese Zwecke eingeben. Wenn Sie beispielsweise eine Social-Media-Kampagne oder einen geplanten Beitrag erstellen, speichern wir die Kampagnendetails (Kampagnenname, Ziele, Zielgruppe, Zeitplan usw.) und den Inhalt der Social-Media-Beiträge (Bildunterschriften, Bilder, Hashtags usw.), die Sie vorbereiten. Die Plattform kann auch Analyse- oder Statusinformationen zu diesen Kampagnen speichern (z. B. ob ein Beitrag genehmigt, geplant, veröffentlicht wurde oder Metriken wie die Anzahl der Klicks, wenn Sie diese eingeben). Ebenso speichern wir, wenn Sie den Marketing-Kampagnenplaner verwenden, Details wie Kampagnenziele, Kanäle (z. B. Google Ads, E-Mail usw.) und alle damit verbundenen Daten, die Sie zu Strategie oder Budget eingeben. Alle diese Informationen werden von Ihnen bereitgestellt, um diese Funktionen zu nutzen, und gelten als Ihre Geschäftsdaten – wir verarbeiten sie lediglich, um die Funktionalität zur Kampagnenplanung und -verfolgung zu ermöglichen."
                },
                lists: {
                    title: "3.6 Kontaktlisten und E-Mail-Marketing-Daten",
                    text: "Als Teil der Marketing-Tools können Sie **E-Mail-Kampagnen** und **Empfängerlisten** verwalten. Wenn Sie Empfängerkontaktdaten importieren oder hinzufügen (z. B. eine Liste von E-Mail-Abonnenten oder Kunden, an die Sie E-Mail-Kampagnen senden möchten), speichern wir die Informationen dieser Kontakte in unserem System in Ihrem Auftrag. Dies umfasst typischerweise eine E-Mail-Adresse und kann den Namen sowie weitere Details enthalten, die Sie für jeden Kontakt hochladen (wie Tags, Gruppenzuweisungen oder benutzerdefinierte Felder wie Firma, Geschlecht usw., die Sie konfigurieren). Wir zeichnen auch den Status jedes Kontakts auf (abonniert, abgemeldet, unzustellbar) sowie grundlegende E-Mail-Zustellungsstatistiken für Ihre Kampagnen (z. B. wie viele E-Mails gesendet, geöffnet, angeklickt wurden usw.). Wichtig: Wenn Sie uns personenbezogene Daten anderer Personen zur Verfügung stellen (z. B. indem Sie Ihre Kunden-E-Mail-Liste hochladen), sind Sie dafür verantwortlich, sicherzustellen, dass Sie diese Daten rechtmäßig erhoben haben (z. B. dass Sie deren Einwilligung zum Senden von Marketing-E-Mails haben). Wir verwenden die Daten dieser Kontakte nur, um die E-Mail-Funktionalität gemäß Ihren Anweisungen zu betreiben (z. B. um die von Ihnen verfassten E-Mails an die von Ihnen aufgeführten Empfänger zu senden und Abmeldungen oder Unzustellbarkeiten zu verfolgen)."
                },
                integration: {
                    title: "3.7 Integrationsdaten (Drittanbieterkonten)",
                    text: "ProjectFlow bietet Integrationen mit bestimmten **Drittanbieterdiensten** (wie GitHub und Facebook/Instagram), um Ihren Workflow zu optimieren. Wenn Sie sich entscheiden, ein Drittanbieterkonto zu verbinden, erfassen und speichern wir die minimal erforderlichen Daten für diese Integration. Wenn Sie beispielsweise ein GitHub-Konto verknüpfen, um Issues zu synchronisieren, bitten wir um ein GitHub Personal Access Token oder verwenden OAuth, um die Berechtigung zu erhalten. Wir speichern Ihr GitHub-Token sicher in Ihren Profil- oder Projekteinstellungen, damit die Anwendung auf Ihre Repositories zugreifen oder Issues in Ihrem Namen erstellen kann. Ebenso speichern wir, wenn Sie ein Facebook- oder Instagram-Konto für das Social Studio verbinden, das Zugriffstoken und die zugehörige Konto-ID/den Benutzernamen für das Social-Media-Konto. Dies ermöglicht es uns, Ihre Social-Media-Profile abzurufen und Inhalte zu veröffentlichen, die Sie innerhalb von ProjectFlow planen. Wir rufen Daten wie Repository-Namen oder Namen von Social-Media-Profilen nach Bedarf ab, um sie in der App anzuzeigen. Wir verwenden diese Token oder Integrationsdaten zu keinem anderen Zweck als zur Bereitstellung der Integrationsfunktionalität, die Sie aktiviert haben. Sie können Integrationen jederzeit über die Einstellungen trennen, wodurch unser Zugriff widerrufen wird."
                },
                ai: {
                    title: "3.8 KI-Funktionen und Nutzungsdaten",
                    text: "**ProjectFlow** enthält **KI-gestützte Funktionen** (z. B. das **AI Studio** für Brainstorming, Inhaltserstellung mit Googles **Gemini 3.0**-Modell, KI-gestützte Suchantworten und ein Bildbearbeitungstool unter Verwendung von **Nano Banana**). Wenn Sie diese Funktionen nutzen, können wir einige Ihrer Daten durch KI-Dienste von Drittanbietern verarbeiten. Wenn Sie beispielsweise die KI auffordern, Ideen zu generieren oder Text zu analysieren, wird der Prompt oder Inhalt, den Sie bereitstellen, an die generative KI-API von Google (Gemini 3.0) gesendet, um ein Ergebnis zu erhalten. Ebenso werden, wenn Sie die Bilderstellungs- oder -bearbeitungsfunktion verwenden, die Bilder und Prompts, die Sie bereitstellen, zur Verarbeitung an den Nano Banana Bildgenerierungsdienst gesendet. Wir erhalten von diesen KI-Anbietern keine personenbezogenen Daten über Sie; wir erhalten nur das generierte Ergebnis, um es Ihnen anzuzeigen. Intern protokollieren wir Ihre Nutzung der KI-Funktionen (z. B. wie viele KI-Text-Token verarbeitet wurden oder wie viele Bilder Sie generiert haben). Diese KI-Nutzungsdaten umfassen Zählungen von Token und Bildern sowie Zeitstempel und werden verwendet, um Nutzungsgrenzen oder Kontingente durchzusetzen und uns zu helfen, die Nutzung der Funktionen zu verstehen. Wir erstellen kein Profil von Benutzern basierend auf diesen Daten; es geht vielmehr um die Gewährleistung einer fairen Nutzung und Kapazitätsplanung. Der Inhalt Ihrer KI-Prompts oder -Ausgaben wird von uns zu keinem anderen Zweck verwendet, als Ihnen das Ergebnis in Echtzeit zu liefern, und wird anderen Benutzern nicht angezeigt (es sei denn, Sie entscheiden sich, KI-generierte Inhalte in einem Projekt zu speichern, damit Ihr Team sie sehen kann)."
                },
                preferences: {
                    title: "3.9 Präferenzen und Cookies",
                    text: "Wir speichern bestimmte **Benutzerpräferenzen**, um Ihr Erlebnis zu verbessern. Beispielsweise können Sie Ihre bevorzugte Sprache, das Datumsformat, die Zeitzone und das Thema (Hell-/Dunkelmodus) einstellen, und wir verfolgen, ob Sie Tutorials oder Onboarding-Abläufe abgeschlossen haben. Diese Präferenzen können in Ihrem Benutzerprofil und/oder im lokalen Speicher Ihres Browsers auf Ihrem Gerät gespeichert werden (damit wir Ihre Einstellungen anwenden können, ohne wiederholt nachzufragen). Der Dienst selbst verwendet keine Tracking-„**Cookies**“ für Analyse- oder Werbezwecke. Aus technischen Gründen können unser Authentifizierungssystem und Hosting jedoch essentielle Cookies oder ähnliche Technologien verwenden. Beispielsweise könnte Firebase Authentication ein Cookie oder den lokalen Speicher verwenden, um Sie sicher eingeloggt zu halten, und wenn Sie auf die Web-App zugreifen, sendet Ihr Browser automatisch Ihr Sitzungstoken oder Cookie, um Sie zu authentifizieren. Diese sind für die Funktion des Dienstes unbedingt erforderlich und werden nicht verwendet, um Sie über andere Websites hinweg zu verfolgen. Abgesehen von diesen notwendigen Mechanismen und dem lokalen Speicher für Präferenzen platzieren wir keine Tracking- oder Werbe-Cookies von Drittanbietern auf Ihrem Gerät. (Wir verwenden derzeit auch kein Google Analytics oder ähnliche Analysedienste in der Codebasis, so dass Ihre Nutzung nicht durch Analyseskripte von Drittanbietern verfolgt wird.)"
                },
                logs: {
                    title: "3.10 Technische Protokolle und Geräteinformationen",
                    text: "Wie die meisten Online-Dienste erfassen wir automatisch einige **technische Informationen** über Ihre Nutzung des Dienstes. Wenn Sie mit unserem Backend interagieren (z. B. unsere API oder Cloud Functions aufrufen), protokollieren unsere Server (**Firebase Cloud Functions** und **Hosting**) bestimmte Informationen. Dazu gehören die IP-Adresse des verwendeten Geräts, Zeitstempel der Anfragen und möglicherweise Ihre Geräte-/User-Agent-Informationen (die Browsertyp und -version, Betriebssystem, Gerätemodell usw. umfassen können). Wenn Sie beispielsweise Aktionen wie Anmelden oder eine Anfrage an unsere API durchführen, zeichnen Firebase-Protokolle möglicherweise Ihre IP und Anfragedetails zu Sicherheits- und Debugging-Zwecken auf. Wir können auch Ihre Plattform- oder Browserinformationen erfassen, wenn Sie Passkeys registrieren (um Ihren Passkey mit dem Gerätetyp zu kennzeichnen). Wir verwenden IP- oder Gerätedaten nicht aktiv, um ein Profil von Ihnen zu erstellen, aber wir könnten sie zur Betrugserkennung oder Sicherheit verwenden (z. B. Erkennung eines verdächtigen Logins). Technische Protokolle werden im Allgemeinen nur zur Überwachung und Fehlerbehebung des Dienstes und zur Gewährleistung der Sicherheit Ihres Kontos verwendet."
                },
                summary: {
                    text: "Zusammenfassend dienen die von uns erfassten personenbezogenen Daten dazu, Sie zu identifizieren, Ihnen die Funktionalität des Dienstes bereitzustellen, die Zusammenarbeit mit anderen zu erleichtern und Ihr Konto zu sichern. Im Allgemeinen erfassen wir über ProjectFlow keine besonderen Kategorien personenbezogener Daten wie behördliche Ausweise, Finanzinformationen oder Gesundheitsdaten, und wir bitten Sie, davon abzusehen, solche Daten auf der Plattform zu speichern. Wenn Sie glauben, dass wir versehentlich sensible Daten erfasst haben, kontaktieren Sie uns bitte, damit wir uns darum kümmern können."
                }
            },
            usage: {
                title: "4. Wie wir Ihre Daten verwenden",
                intro: "Wir verwenden die erfassten personenbezogenen Daten für die folgenden Zwecke, alle in Übereinstimmung mit den DSGVO-Grundsätzen der Notwendigkeit und Rechtmäßigkeit:",
                maintenance: {
                    title: "4.1 Bereitstellung und Wartung des Dienstes",
                    text: "In erster Linie verwenden wir Ihre Informationen, um ProjectFlow zu betreiben und Ihnen dessen Funktionen bereitzustellen. Dazu gehört die Verwendung von Konto- und Authentifizierungsdaten, um Sie anzumelden und Ihre Identität zu verifizieren, die Verwendung Ihrer Workspace- und Projektinhaltsdaten, um die Informationen, die Sie und Ihr Team eingeben, anzuzeigen und zu synchronisieren, und allgemein sicherzustellen, dass die App wie vorgesehen für Projektmanagement und Zusammenarbeit funktioniert. Beispielsweise verwenden wir Ihre E-Mail, um Ihnen die Anmeldung zu ermöglichen und Ihnen wichtige Kontomitteilungen (wie Bestätigungs-E-Mails oder Passwort-Resets) zu senden, und wir verwenden die von Ihnen eingegebenen Inhalte (Aufgaben, Projekte usw.), um Ihr Dashboard zu füllen und Ihnen die Arbeit mit Ihrem Team zu ermöglichen. Ohne die Verarbeitung Ihrer Daten auf diese Weise könnten wir den Dienst nicht bereitstellen."
                },
                collaboration: {
                    title: "4.2 Zusammenarbeit im Workspace und Benutzerkommunikation",
                    text: "Wenn Sie Teil eines Team-Workspaces sind, können die von Ihnen eingegebenen Daten (wie Ihr Profilname, Kommentare oder Aufgaben) anderen autorisierten Benutzern in Ihrem Workspace angezeigt werden, um eine Zusammenarbeit zu ermöglichen. Wir verwalten Berechtigungen so, dass nur Personen mit entsprechendem Zugriff (z. B. Mitglieder Ihres Projekts oder Workspaces) die relevanten Informationen sehen können. Wir verwenden Ihre Daten auch, um Ihnen Benachrichtigungen innerhalb der App oder per E-Mail (wenn Sie E-Mail-Benachrichtigungen aktiviert haben) über Aktualisierungen in Ihren Projekten zu senden – wenn Ihnen beispielsweise eine Aufgabe zugewiesen wird oder jemand Sie in einem Kommentar erwähnt, könnten wir Sie benachrichtigen. Diese Mitteilungen sind Teil der Funktionalität des Dienstes. Wir verwenden auch Ihre Präferenzen (wie Sprache und Zeitzone), um Inhalte und Daten für Sie zu lokalisieren und UI-Einstellungen (z. B. Beibehaltung Ihres gewählten Themas) zu speichern."
                },
                ai: {
                    title: "4.3 KI-gestützte Funktionen",
                    text: "Wenn Sie eine KI-Funktion (Texterstellung, KI-gestützte Suche, Bildbearbeitung usw.) nutzen, verwenden wir Ihre Eingabedaten, um die angeforderte Ausgabe zu generieren. Wenn Sie beispielsweise die KI bitten, Projektideen zu sammeln, senden wir Ihren Prompt (der von Ihnen bereitgestellten Projektkontext enthalten kann) an unseren KI-Partner (Google) und rufen die generierten Ideen ab, um sie Ihnen dann anzuzeigen. Wir verwenden diese Prompts zu keinem anderen Zweck, und alle temporären Kopien dienen nur dazu, die KI-Verarbeitung zu ermöglichen. Wenn Sie sich entscheiden, KI-generierte Inhalte in Ihrem Projekt zu speichern, werden diese wie alle anderen von Benutzern eingegebenen Daten Teil Ihres ProjectFlow-Inhalts. Wir verfolgen auch die Menge der von Ihnen genutzten KI-Ressourcen (Token-Zählungen), um Nutzungsgrenzen durchzusetzen und die Systemleistung sicherzustellen. Diese Nutzungsverfolgung dient in erster Linie der internen Überwachung und der Durchsetzung der fairen Nutzung, nicht der Profilerstellung von Benutzern."
                },
                social: {
                    title: "4.4 Social-Media- und Integrationsaktionen",
                    text: "Wenn Sie Integrationen von Drittanbietern verbinden (z. B. Posten in sozialen Medien oder Synchronisierung mit GitHub), verwenden wir Ihre Daten, um die von Ihnen angeforderten Aktionen auszuführen. Wenn Sie beispielsweise einen Social-Media-Beitrag über unseren Dienst planen, verwenden wir den von Ihnen verfassten Inhalt und das gespeicherte Zugriffstoken, um diesen Beitrag auf der integrierten Plattform zu veröffentlichen (z. B. senden wir die Bildunterschrift und das Bild zum geplanten Zeitpunkt an die API von Facebook/Instagram zur Veröffentlichung). Wenn Sie uns bitten, Issues mit GitHub zu synchronisieren, verwenden wir Ihr gespeichertes Token, um Issues in Ihrem GitHub-Repository abzurufen oder zu aktualisieren. Kurz gesagt, wir verwenden die Integrationsdaten ausschließlich, um die spezifischen Integrationsvorgänge durchzuführen, die Sie initiiert haben, wie z. B. das Erstellen von GitHub-Issues, das Abrufen von Commit-Informationen, das Abrufen von Social-Media-Profildaten oder das Hochladen geplanter Beiträge. Wir posten nichts auf Ihren verbundenen Konten oder greifen auf Ihre Daten bei Drittanbietern zu, es sei denn, Sie verwenden speziell eine Integrationsfunktion, die dies erfordert."
                },
                email: {
                    title: "4.5 E-Mail-Kampagnen und Newsletter",
                    text: "Wenn Sie die E-Mail-Marketing-Tools innerhalb von ProjectFlow nutzen, verwenden wir die Kontaktinformationen und E-Mail-Inhalte, die Sie bereitstellen, um die E-Mails wie angewiesen zu versenden. Wenn Sie beispielsweise eine E-Mail-Kampagne an eine Liste von Empfängern starten, nimmt unser System die von Ihnen erstellte E-Mail-Vorlage/den Inhalt und die Empfängerliste (E-Mail-Adressen und Personalisierungsfelder) und sendet die E-Mails über unseren E-Mail-Dienstleister in Ihrem Auftrag. Wir verfolgen Sendungen, Öffnungen, Klicks und Bounces, um Ihnen Kampagnenstatistiken bereitzustellen. Unabhängig davon: Wenn Sie unseren eigenen Newsletter oder unsere Warteliste abonnieren (über unsere öffentliche Website), verwenden wir Ihre E-Mail-Adresse, um Ihnen die angeforderten Newsletter-Updates zu senden oder bezüglich der Warteliste nachzufassen (erst nachdem Sie per Double-Opt-in bestätigt haben). Sie können sich jederzeit abmelden, und wir werden dann aufhören, Ihnen den Newsletter zu senden (Ihre E-Mail kann als abgemeldet in den Akten bleiben, um Ihre Abmeldung zu respektieren)."
                },
                analytics: {
                    title: "4.6 Dienstverbesserung und Analytik",
                    text: "Intern können wir aggregierte oder de-identifizierte Informationen darüber verwenden, wie Benutzer ProjectFlow verwenden, um den Dienst zu verbessern. Dazu können Metriken gehören wie die Anzahl der erstellten Projekte, welche Funktionen am häufigsten verwendet werden oder allgemeine Leistungsinformationen. Wir können Protokolle oder Nutzungsdaten einsehen, um Probleme zu debuggen (z. B. Überprüfung eines Fehlerprotokolls, wenn eine Funktion fehlschlägt, was eine Benutzer-ID oder eine Aktion enthalten könnte, die dies verursacht hat). Wir haben keine Analysetrecker von Drittanbietern, die Ihr Surfverhalten erfassen, aber wir führen unsere eigenen Analysen der Daten in unserer Datenbank durch, um Funktionen zu verbessern (z. B. Verwendung von Projektdaten zur Entwicklung einer Projektgesundheits-Bewertungsfunktion innerhalb der App oder Verwendung von Feedback zur Verfeinerung von KI-Modellen). Wo möglich, verwenden wir aggregierte Daten für diese Zwecke. Alle gewonnenen Erkenntnisse werden verwendet, um die Funktionalität, die Benutzererfahrung und die Sicherheit zu verbessern."
                },
                security: {
                    title: "4.7 Sicherheit und Betrugsprävention",
                    text: "Wir verarbeiten personenbezogene Daten nach Bedarf, um unsere Plattform und die Konten der Benutzer zu sichern. Dazu gehört die Verwendung von Authentifizierungsdaten und IP-/Geräteinformationen, um verdächtige Anmeldungen oder Kontomissbrauch zu erkennen und zu verhindern. Beispielsweise könnten wir Ihre IP-Adresse verwenden, um festzustellen, ob ein Anmeldeversuch von einem ungewöhnlichen Standort stammt, und eine zusätzliche Verifizierung verlangen. Wir führen Protokolle über wichtige Aktionen (wie Anmeldeversuche, Passwortänderungen, Integrationsverknüpfungen), um auf betrügerische oder böswillige Aktivitäten zu überwachen. Wenn wir ein Verhalten feststellen, das gegen unsere Bedingungen verstößt oder dem Dienst oder anderen Benutzern schaden könnte, können wir personenbezogene Daten (wie Kontokennungen und beteiligte Inhalte) verwenden, um dies zu untersuchen und Maßnahmen zu ergreifen (z. B. Benachrichtigung an Sie oder, falls erforderlich, Deaktivierung eines Kontos zum Schutz anderer). Diese Verarbeitung liegt in unserem berechtigten Interesse, den Dienst sicher und zuverlässig zu halten."
                },
                legal: {
                    title: "4.8 Rechtliche Compliance und Durchsetzung",
                    text: "In bestimmten Fällen müssen wir möglicherweise personenbezogene Daten verarbeiten, um gesetzlichen Verpflichtungen nachzukommen oder unsere gesetzlichen Rechte zu verteidigen. Beispielsweise können wir bestimmte Informationen über Finanztransaktionen (falls Rechnungsinformationen beteiligt sind) aus buchhalterischen und steuerlichen Gründen aufbewahren, oder wir können Daten als Reaktion auf rechtmäßige Anfragen von Behörden verarbeiten (z. B. Einhaltung einer gerichtlichen Anordnung zur Offenlegung von Inhalten). Darüber hinaus könnten wir Daten verwenden oder aufbewahren, wenn dies zur Durchsetzung unserer Nutzungsbedingungen oder zur Bearbeitung von Rechtsstreitigkeiten erforderlich ist (z. B. Protokollierung, wann ein Benutzer Bedingungen zugestimmt hat, oder Verwendung von Protokollen, um nachzuweisen, wie ein Konto genutzt wurde, falls dies für einen Rechtsanspruch erforderlich ist)."
                },
                decision: {
                    text: "Wir werden Ihre personenbezogenen Daten nur für die oben beschriebenen Zwecke oder für Zwecke verwenden, die mit diesen vereinbar sind (z. B. Verwendung von Kontodaten zur Bereitstellung von Support, wenn Sie uns bei einem Problem kontaktieren). Wir verwenden Ihre Daten nicht für eine automatisierte Entscheidungsfindung, die rechtliche oder ähnlich signifikante Auswirkungen auf Sie hat – es finden keine automatisierten Bonitätsprüfungen, Scorings oder Profilings statt, die über den Umfang der Bereitstellung der App-Funktionen hinausgehen (der „Projektgesundheits-Score“ und ähnliche Analysen innerhalb der App werden aus Projektdaten generiert, um Ihnen beim Projektmanagement zu helfen, nicht um Sie als Individuum zu bewerten)."
                }
            },
            legalBasis: {
                title: "5. Rechtsgrundlagen für die Verarbeitung",
                intro: "Gemäß der DSGVO stützen wir uns auf die folgenden Rechtsgrundlagen für die Verarbeitung Ihrer personenbezogenen Daten:",
                contract: {
                    title: "5.1 Vertragserfüllung (Art. 6(1)(b))",
                    text: "Der Großteil unserer Datenverarbeitung ist dadurch gerechtfertigt, dass sie notwendig ist, um Ihnen den von Ihnen angeforderten Dienst bereitzustellen – im Wesentlichen, um unseren Vertrag mit Ihnen zu erfüllen. Wenn Sie sich für ProjectFlow anmelden und unseren Bedingungen zustimmen, kommt ein Vertrag zustande, damit wir die Funktionalität der Plattform bereitstellen. Wir müssen Ihre Kontodaten, Projektinhalte, Kommunikation usw., wie oben beschrieben, verarbeiten, um diesen Vertrag zu erfüllen. Zum Beispiel sind die Verwendung Ihrer E-Mail-Adresse zur Erstellung eines Kontos und zur Anmeldung oder die Speicherung der von Ihnen eingegebenen Aufgaben, damit Sie diese später abrufen können, notwendig, damit der Dienst wie vorgesehen funktioniert."
                },
                consent: {
                    title: "5.2 Einwilligung (Art. 6(1)(a))",
                    text: "In bestimmten Situationen verlassen wir uns auf Ihre Einwilligung. Zum Beispiel senden wir Ihnen Marketing-E-Mails nur dann zu, wenn Sie sich über die Website für unseren Newsletter anmelden oder sich auf eine Warteliste setzen lassen und Ihre Einwilligung gegeben haben (und diese über die Double-Opt-In-E-Mail bestätigt haben). Sie können diese Einwilligung jederzeit widerrufen, indem Sie sich abmelden. Sollten wir in Zukunft innerhalb der App eine Funktion einführen, die Ihre Daten auf eine Weise nutzt, die für den Dienst nicht offensichtlich oder notwendig ist (zum Beispiel die Veröffentlichung eines Erfahrungsberichts mit Ihrem Namen oder die Nutzung Ihrer Daten für einen neuen Zweck), würden wir Sie um Ihre Einwilligung bitten. Auch wenn wir optionale Analysen oder Cookies integrieren, die eine Einwilligung erfordern, werden wir diese einholen. Bitte beachten Sie, dass Sie uns, wenn Sie Konten von Drittanbietern verbinden oder Daten über andere importieren (wie Kontakte für E-Mail-Kampagnen), effektiv anweisen, diese Daten zu verarbeiten – wir betrachten dies als analog zu einer Einwilligung/einem Vertrag durch Sie, da es Teil des Dienstes ist, den wir Ihnen bereitstellen sollen. Wenn Sie die Einwilligung der Personen in Ihren Kontaktlisten einholen müssen, liegt dies in Ihrer Verantwortung als Verantwortlicher für diese Daten."
                },
                interest: {
                    title: "5.3 Berechtigte Interessen (Art. 6(1)(f))",
                    text: "Wir verarbeiten einige Daten auf der Grundlage berechtigter Interessen, nachdem wir die Auswirkungen auf Ihre Privatsphäre sorgfältig abgewogen haben. Zu unseren berechtigten Interessen gehören: die Aufrechterhaltung der Sicherheit unserer Plattform (z. B. Verarbeitung von IP-Adressen und Login-Daten zur Betrugsprävention), die Verbesserung und Weiterentwicklung unserer Dienste (z. B. Analyse der Nutzung von Funktionen, um über neue Verbesserungen zu entscheiden) und die Kommunikation mit Ihnen über Produkt-Updates oder Ähnliches (sofern diese Kommunikation nach geltendem Recht keine Einwilligung erfordert). Wenn wir uns auf ein berechtigtes Interesse berufen, stellen wir sicher, dass unser Interesse nicht durch Ihre Datenschutzrechte überwiegt – zum Beispiel ist die Sicherheitsverarbeitung notwendig, um alle Nutzer zu schützen, und beeinträchtigt die Privatsphäre nicht übermäßig, da sie tatsächlich dazu beiträgt, personenbezogene Daten zu schützen. Wenn Sie mit einer auf berechtigten Interessen beruhenden Verarbeitung nicht einverstanden sind, haben Sie das Recht, Widerspruch einzulegen (siehe Ihre Rechte unten), und wir werden solche Anfragen prüfen."
                },
                obligation: {
                    title: "5.4 Rechtliche Verpflichtung (Art. 6(1)(c))",
                    text: "In einigen Fällen müssen wir Daten verarbeiten, um einem Gesetz nachzukommen. Dies ist nicht die Hauptgrundlage für die meisten täglichen Verarbeitungen auf ProjectFlow, könnte aber für Dinge gelten wie die Aufbewahrung von Transaktionsdatensätzen für das Steuerrecht oder die Offenlegung von Daten, wenn eine gültige rechtliche Anfrage eingeht. Wir werden dies nur tun, wenn dies gesetzlich vorgeschrieben ist."
                },
                summary: {
                    text: "Wir werden deutlich darauf hinweisen, wenn wir Ihre personenbezogenen Daten jemals für einen Zweck benötigen, der Ihre Einwilligung erfordert oder außerhalb des ursprünglichen Zwecks liegt, für den sie erhoben wurden. Im Allgemeinen erkennen Sie durch die Nutzung von ProjectFlow an, dass Ihre personenbezogenen Daten verarbeitet werden, wie es für die Bereitstellung des Dienstes erforderlich ist (dies ist die Vertragsbasis). Für optionale Nutzungen werden wir sicherstellen, dass es eine Wahlmöglichkeit gibt."
                }
            },
            cookies: {
                title: "6. Cookies und Tracking-Technologien",
                intro: "Die ProjectFlow-Webanwendung verwendet nur minimale Cookies/Tracker, hauptsächlich für essenzielle Funktionen:",
                essential: {
                    title: "6.1 Essenzielle Cookies",
                    text: "Wir verwenden Authentifizierungstoken (die von Firebase Auth in einem Cookie oder im lokalen Speicher gespeichert werden können), um Sie sitzungsübergreifend angemeldet zu halten. Diese sind für eine sichere Anmeldung und Sitzungsverwaltung zwingend erforderlich. Firebase kann beispielsweise ein Cookie verwenden, um sich zu merken, dass Sie sich bereits angemeldet haben, damit Sie sich nicht bei jedem Laden der Seite neu authentifizieren müssen. Wir nutzen auch den lokalen Speicher Ihres Browsers, um bestimmte Einstellungen und den Status Ihrer aktuellen Workspace- (Mandanten-) Auswahl zu speichern. Zum Beispiel speichern wir Ihre aktive Workspace-ID, damit die App beim Aktualisieren der Seite weiß, welche Workspace-Daten für Sie geladen werden sollen. Ein weiteres Beispiel ist das Speichern von UI-Einstellungen wie dem Design (Dunkel- oder Hellmodus), damit wir die Benutzeroberfläche ohne Verzögerung entsprechend rendern können. Diese Einträge im lokalen Speicher und essenziellen Cookies werden nicht verwendet, um Sie auf anderen Websites zu verfolgen, und enthalten keine sensiblen personenbezogenen Daten (in der Regel enthalten sie IDs oder Flags, die nur für unsere App relevant sind)."
                },
                noTracking: {
                    title: "6.2 Keine Marketing-Cookies von Drittanbietern",
                    text: "Wir verwenden derzeit keine Werbe- oder Analyse-Cookies von Drittanbietern in unserer App oder auf unserer Website. Das bedeutet, dass wir keine Google Analytics-, Facebook Pixel- oder ähnliche Tracking-Cookies setzen, die Sie außerhalb unserer Domain verfolgen. Alle Ihre Interaktionen mit ProjectFlow bleiben innerhalb unserer Plattform, und alle Datenanalysen werden intern oder durch unsere beschriebenen Dienstleister durchgeführt, nicht durch Profiling-Cookies."
                },
                optional: {
                    title: "6.3 Optionale Funktionen",
                    text: "Sollten wir in Zukunft Cookies einführen, die nicht zwingend erforderlich sind (z. B. um zusätzliche Analysen zu ermöglichen oder Einstellungen zu speichern, die über das für den Dienst Erforderliche hinausgehen), werden wir diese Richtlinie aktualisieren und, sofern gesetzlich vorgeschrieben, Ihre Einwilligung einholen, bevor wir diese verwenden."
                },
                control: {
                    title: "6.4 Ihre Kontrolle",
                    text: "Sie haben die Möglichkeit, Cookies über Ihre Browsereinstellungen zu kontrollieren. Bedenken Sie jedoch, dass das Blockieren von Cookies oder lokalem Speicher für ProjectFlow bestimmte Funktionen beeinträchtigen kann – zum Beispiel könnten Sie sich nicht mehr anmelden oder Ihre Einstellungen werden möglicherweise nicht gespeichert. Da wir derzeit nur essenzielle Cookies/Speicher verwenden, könnte deren Deaktivierung Sie effektiv abmelden oder die Nutzung des Dienstes verhindern. Für unsere öffentliche Marketing-Website (z. B. die Homepage oder den Blog auf getprojectflow.com) versuchen wir ebenfalls, Cookies auf ein Minimum zu beschränken. Newsletter-Anmelde- oder Wartelisten-Formulare auf der Website können ein Cookie verwenden, um das Double-Opt-In-Verfahren zu erleichtern oder sich zu merken, dass Sie sich angemeldet haben, aber auch hier setzen wir keine Tracking-Anzeigen von Drittanbietern ein. Wenn Sie Fragen zu einem bestimmten Cookie oder Speicherelement haben, das von ProjectFlow verwendet wird, können Sie sich gerne an uns wenden. Wir möchten transparent sein und sicherstellen, dass Sie sich mit unserem Umgang mit diesen Technologien wohlfühlen."
                }
            },
            thirdParty: {
                title: "7. Weitergabe an Dritte und Unterauftragsverarbeiter",
                intro: "Um die Funktionalität des Dienstes bereitzustellen, verlassen wir uns auf mehrere Dienste von Drittanbietern, die Daten in unserem Auftrag verarbeiten (oft als „Auftragsverarbeiter“ oder „Unterauftragsverarbeiter“ bezeichnet). Wir geben Daten manchmal auch auf Ihre Anweisung hin an Dritte weiter (z. B. wenn Sie eine Integration verwenden). Wir verkaufen Ihre personenbezogenen Daten an niemanden. Wir geben sie nur weiter an: (a) Dienstleister unter strengen Datenverarbeitungsverträgen oder (b) andere Parteien, wenn Sie uns ausdrücklich dazu auffordern (oder wenn gesetzlich vorgeschrieben). Hier skizzieren wir die wichtigsten beteiligten Dritten und welche Daten mit ihnen geteilt werden könnten:",
                firebase: {
                    title: "7.1 Google Firebase (Google Cloud Platform)",
                    text: "Unsere Anwendung basiert auf der Cloud-Infrastruktur von Google. Wir verwenden Firebase für Authentifizierung, Datenbank, Dateispeicherung, Cloud-Funktionen und Hosting. Firebase Authentication speichert Ihre Anmeldedaten und verwaltet die Anmeldung (wie bereits erwähnt, umfasst dies das Hashing von Passwörtern, OAuth-Login-Token und Multi-Faktor-Authentifizierung). Firestore Database ist unser primärer Datenspeicher, in dem alle Ihre Projektdaten, Profilinformationen und sonstigen Inhalte gespeichert werden – unser Firebase-Projekt ist so konfiguriert, dass es europäische Server (Multi-Region EU) für Firestore verwendet, sodass Ihre Daten standardmäßig in der EU gespeichert sind. Firebase Storage wird für Datei-Uploads (z. B. Bilder, Dokumente) verwendet – diese Dateien werden in Google Cloud Storage gespeichert. Durch die Nutzung von Firebase fließen notwendigerweise bestimmte Daten durch die Systeme von Google. Wenn Sie sich beispielsweise anmelden, sieht Firebase Ihre E-Mail-Adresse und Ihr Passwort (oder OAuth-Token), um Sie zu authentifizieren; wenn Daten in der Datenbank gespeichert werden, liegen sie auf den Servern von Google (verschlüsselt im Ruhezustand). Wir haben die Regionen europe-west/eu der Google Cloud für die Datenspeicherung gewählt, um die Einhaltung der EU-Datenlokalisierungspräferenzen zu unterstützen. Google fungiert als Auftragsverarbeiter für uns, was bedeutet, dass sie verpflichtet sind, Daten nur nach unseren Weisungen zu verarbeiten. Wir haben einen Datenverarbeitungsvertrag mit Google, der die EU-Standardvertragsklauseln enthält, um etwaige Übermittlungen personenbezogener Daten außerhalb der EU abzusichern. In der Praxis bleiben Routinevorgänge (Datenbankabfragen, Dateispeicherung) in EU-Rechenzentren, aber Google ist als Unternehmen in den USA ansässig, sodass die Möglichkeit besteht, dass einige Verwaltungs- oder Supportzugriffe Nicht-EU-Regionen betreffen könnten. Wir vertrauen darauf, dass Google Firebase hohe Sicherheitsstandards einhält; wir möchten jedoch, dass Sie sich bewusst sind, dass Ihre Daten in der Cloud von Google gehostet werden."
                },
                gemini: {
                    title: "7.2 Google Gemini 3.0 und Nano Banana (Generative KI-Dienste)",
                    text: "Neben der Kerninfrastruktur nutzen wir die KI-Dienste von Google und Nano Banana, um die KI-Funktionen in ProjectFlow zu betreiben. Wenn Sie die KI-Texterstellung oder -analyse (Gemini 3.0) verwenden, senden unsere Server den Prompt und den erforderlichen Kontext an die Google GenAI API und erhalten die Ergebnisse. Ebenso sendet unsere Funktion, wenn Sie die Bildbearbeitungs-/-generierungsfunktion verwenden, das Bild (in Base64-Form) und den Prompt an den Nano Banana Bildgenerierungs-Endpunkt, um neue Bilder zu generieren. Diese Anfragen erfolgen von unserer Server-Seite mit unseren Anmeldeinformationen, und die Daten (Prompts, Bilder) gehen zur Verarbeitung vorübergehend an die jeweiligen KI-Modelle. Unsere KI-Anbieter können diese Daten verarbeiten (und sie haben ihre eigenen Bedingungen, diese nicht ohne Einwilligung zum Trainieren ihrer Modelle zu verwenden – zum Zeitpunkt dieses Schreibens gibt Google an, dass Daten, die an ihre GenAI-APIs gesendet werden, nicht zur Verbesserung des KI-Modells verwendet werden). Wir speichern den Inhalt Ihrer KI-Interaktionen nicht über die Übermittlung des Ergebnisses an Sie hinaus, außer möglicherweise in flüchtigen Protokollen oder wenn Sie das Ergebnis speichern. Der Umgang unserer KI-Anbieter mit den Daten unterliegt unseren Verträgen mit ihnen und ihren Datenschutzverpflichtungen als Auftragsverarbeiter. Dennoch handelt es sich hierbei um einen Fall, in dem Ihre Daten unsere unmittelbare Umgebung verlassen und an einen Drittanbieterdienst gehen, um zu funktionieren. Wir stellen sicher, dass alle derartigen Kommunikationen mit den APIs unserer KI-Anbieter während der Übertragung verschlüsselt sind. Die KI-Dienste von Google werden ebenfalls in der Google Cloud gehostet; wir verwenden die europäische Region für Gemini 3.0-Anfragen, wenn möglich. Es ist jedoch möglich, dass die Verarbeitung durch das KI-Modell nicht vollständig EU-lokal ist. Durch die Nutzung dieser Funktionen erkennen Sie an, dass die Inhalte, die Sie in einem KI-Prompt bereitstellen, mit unseren KI-Anbietern zum Zweck der Generierung des Ergebnisses geteilt werden."
                },
                smtp: {
                    title: "7.3 E-Mail-Dienst (SMTP)",
                    text: "Wir nutzen einen E-Mail-Zustelldienst, um System-E-Mails zu versenden (wie Verifizierungs-E-Mails, Passwort-Resets, Benachrichtigungen und die optionalen Newsletter-/Wartelisten-E-Mails). Derzeit haben wir einen SMTP-Server für den Versand von E-Mails konfiguriert. Standardmäßig kann unsere Konfiguration einen von Google bereitgestellten E-Mail-Dienst verwenden (zum Beispiel Versand über Gmails SMTP oder einen anderen Mail-Provider). Unabhängig vom Anbieter wird, wenn wir Ihnen eine E-Mail senden, offensichtlich Ihre E-Mail-Adresse von diesem Anbieter verarbeitet, ebenso wie der Inhalt der E-Mail. Für Newsletter- und Wartelisten-Bestätigungen wickeln wir diese über Firebase Cloud Functions ab, die über unser SMTP-Setup senden. Wir stellen sicher, dass die SMTP-Anmeldedaten sicher gespeichert sind (Umgebungsvariablen) und dass der E-Mail-Dienst seriös ist. In Zukunft könnten wir eine dedizierte E-Mail-Zustellplattform (wie SendGrid, Mailgun o. ä.) verwenden; falls dies geschieht, wird diese Richtlinie aktualisiert. Der E-Mail-Dienstleister fungiert als Auftragsverarbeiter, der Ihre Daten nur verwendet, um E-Mails in unserem Auftrag zu versenden."
                },
                github: {
                    title: "7.4 GitHub API",
                    text: "Wenn Sie sich entscheiden, GitHub zu integrieren, interagieren wir mit der REST-API von GitHub. Das bedeutet, dass bestimmte Daten zu/von GitHub fließen: Wir könnten zum Beispiel ein neues Issue, das Sie in ProjectFlow erstellt haben, an GitHub senden (einschließlich Issue-Titel und -Beschreibung) oder eine Liste Ihrer Repositorys und Issues von GitHub abrufen, um sie in der App anzuzeigen. Dazu speichern wir Ihr persönliches GitHub-Zugriffstoken oder OAuth-Token, das als Autorisierungs-Header in API-Aufrufen an GitHub verwendet wird. GitHub (ein Dienst von Microsoft, ansässig in den USA) erhält diese API-Aufrufe zusammen mit Daten wie Ihrem Token und allen Inhalten, die wir senden (Issue-Titel usw.). Wir beschränken Aufrufe auf nur das Notwendige (z. B. Repos auflisten, Issues erstellen/aktualisieren, Kommentare posten). GitHub ist im Wesentlichen ein Empfänger von Daten, wenn Sie Issues absichtlich synchronisieren oder erstellen. Sie behandeln diese Daten gemäß ihrer eigenen Datenschutzrichtlinie (da sie Teil Ihrer GitHub-Kontodaten werden, z. B. ein neues Issue in Ihrem Repo). Wir teilen Ihre ProjectFlow-Daten nicht mit GitHub, es sei denn, Sie initiieren dies über die Integration, und Ihr GitHub-Token wird mit keiner Partei geteilt, außer dass es wie beabsichtigt zur Authentifizierung an die Server von GitHub gesendet wird."
                },
                meta: {
                    title: "7.5 Facebook & Instagram (Meta) Integration",
                    text: "Wenn Sie eine Facebook-Seite oder ein Instagram-Konto zum Veröffentlichen von Social-Media-Inhalten verbinden, integrieren wir mit der von Meta Platforms bereitgestellten Facebook Graph API. Wir erhalten von Ihnen über den OAuth-Flow von Facebook ein Zugriffstoken (das an unsere App weitergeleitet wird) und speichern dieses Token. Mit diesem Token können wir API-Anfragen stellen, wie z. B. das Abrufen Ihrer verbundenen Facebook-Seiten/Instagram-Unternehmenskonten, das Abrufen grundlegender Profilinformationen (wie Kontoname und Avatar) zur Anzeige in unserer Benutzeroberfläche und das Veröffentlichen von Inhalten, die Sie genehmigt/geplant haben. Wenn Sie beispielsweise bei einem geplanten Instagram-Beitrag in ProjectFlow auf „Veröffentlichen“ klicken, ruft unser System den Graph API-Endpunkt auf, um das Foto und die Bildunterschrift in Ihrem Namen auf Instagram hochzuladen. Diese Anfragen enthalten den Inhalt des Beitrags und werden natürlich von den Servern von Facebook empfangen. Meta speichert und zeigt diese Inhalte dann auf ihrer Plattform gemäß der normalen Nutzung ihres Dienstes an. Wir senden keine ProjectFlow-Daten an Meta, außer dem, was für die spezifische Aktion erforderlich ist (wir übertragen nicht massenhaft Ihre gesamten Projektdaten oder persönlichen Infos – nur den Inhalt des Social-Media-Beitrags oder Integrationsabfragen). Meta (Facebook/Instagram) könnte einige Nutzungsinformationen (wie das Protokollieren, dass unsere App mit Ihrer Benutzer-ID eine Anfrage gestellt hat) für ihre eigene Sicherheit und Analyse verarbeiten. Wir behandeln Meta sowohl als Auftragsverarbeiter (wenn sie Inhalte auf unsere Anweisung hin liefern) als auch als unabhängigen Verantwortlichen für alle Daten, sobald sie auf ihrer Seite sind (da ein veröffentlichter Beitrag den Bedingungen von Facebook/Instagram unterliegt). Sie können die Facebook-/Instagram-Integration jederzeit widerrufen, wodurch das Token ungültig wird, sodass wir nicht mehr auf Ihr Konto zugreifen können. Beachten Sie auch, dass Facebook Ihnen beim Verknüpfen eines Kontos möglicherweise anzeigt, welche Berechtigungen Sie gewähren (wie Inhalte posten, Insights lesen usw.); wir verwenden diese Berechtigungen nur, um die Funktionen zu implementieren, die Sie nutzen, nicht für andere Zwecke."
                },
                other: {
                    title: "7.6 Sonstige Integrationen",
                    text: "ProjectFlow bietet möglicherweise andere Integrationen an oder nutzt andere APIs, wie z. B. Google für die Anmeldung (Google OAuth für Login) oder potenziell andere soziale Netzwerke oder Tools. Wenn wir Google Sign-In verwenden, bedeutet das, dass wir von Google Ihre grundlegenden Profilinformationen (Name, E-Mail) erhalten und Google weiß, dass Sie unsere App zur Authentifizierung nutzen. Zur Vollständigkeit: Unser Google Sign-In und GitHub Sign-In werden von Firebase Auth verwaltet, was bedeutet, dass Google und GitHub wissen, wenn Sie sie zum Anmelden verwenden, als Teil des OAuth-Prozesses. Wir unterstützen auch die Anmeldung über Passkeys, die den WebAuthn-Standard verwendet; dieser Prozess findet hauptsächlich lokal zwischen Ihrem Gerät und unserem Server statt (wobei die Bestätigung durch die WebAuthn-API erfolgt) und involviert keine Dienste von Drittanbietern, außer möglicherweise die Plattform Ihres Geräts (z. B. Apple oder Microsoft könnten bei der Speicherung von Anmeldeinformationen auf Ihrem Gerät beteiligt sein, aber das sendet keine Daten über unseren Dienst spezifisch an sie). Wenn wir weitere Integrationen von Drittanbietern einführen (wie Google Drive, Trello usw.), werden wir diesen Abschnitt aktualisieren, um anzugeben, welche Daten geteilt werden. In allen Fällen ist unsere Philosophie, dass Integrationen von Drittanbietern Opt-in sind und von Ihren Bedürfnissen gesteuert werden – wir übertragen Daten an diese Dienste nur soweit erforderlich, um die von Ihnen aktivierte Integrationsfunktion zu erfüllen."
                },
                payment: {
                    title: "7.7 Zahlungsdienstleister",
                    text: "Wir nutzen derzeit keine Zahlungsabwickler in dieser Version (wenn kostenpflichtige Pläne hinzugefügt werden, wird der Zahlungsabwickler hier aufgeführt)."
                },
                dpa: {
                    title: "7.8 Internationale Datenübermittlungen",
                    text: "Einige unserer Anbieter (wie Google) haben ihren Sitz in den USA. Wir stellen sicher, dass Übermittlungen in Länder außerhalb des EWR durch angemessene Schutzmaßnahmen geschützt sind, wie z. B. Entscheidungen der EU-Kommission über die Angemessenheit (z. B. das EU-U.S. Data Privacy Framework, sofern der Anbieter zertifiziert ist) oder Standardvertragsklauseln (SCCs)."
                },
                team: {
                    title: "7.9 Teammitglieder und andere Nutzer",
                    text: "Unsere Teammitglieder (Mitarbeiter und Auftragnehmer) haben Zugang zu Daten, wenn dies für Entwicklung oder Support erforderlich ist, unterliegen jedoch strengen Vertraulichkeitsverpflichtungen."
                },
                regulatory: {
                    title: "7.10 Rechtliche oder behördliche Offenlegungen",
                    text: "Strafverfolgungsbehörden oder Regulierungsbehörden, wenn wir gesetzlich dazu verpflichtet sind."
                },
                corporate: {
                    title: "7.11 Unternehmenstransaktionen",
                    text: "Mögliche Käufer im Falle einer Geschäftsübernahme oder Fusion."
                },
                noSale: {
                    title: "7.12 Kein Verkauf von Daten",
                    text: "Wir verkaufen, vermieten oder handeln Ihre personenbezogenen Daten nicht zu Werbezwecken an Dritte."
                }
            },
            storage: {
                title: "8. Datenspeicherung und -standort",
                intro: "Wir haben unseren Sitz in Deutschland, aber die Nutzerbasis von ProjectFlow kann global sein. Wir möchten transparent darüber sein, wo Ihre Daten gespeichert und verarbeitet werden:",
                primary: {
                    title: "8.1 Primärer Speicherort - Europäische Union",
                    text: "Wir haben unsere Cloud-Infrastruktur so konfiguriert, dass Daten in der Europäischen Union gespeichert werden. Insbesondere befindet sich unsere Datenbank in einem Multi-Region-EU-Rechenzentrum (Google-Region „eur3“) und unsere Serverfunktionen laufen in europe-west3 (in Deutschland). Das bedeutet, dass Ihre Daten, wenn Sie ein EU-Nutzer sind, ursprünglich innerhalb der EU und im Einklang mit den DSGVO-Präferenzen gespeichert werden. Auch wenn Sie sich nicht in der EU befinden, nutzen wir die EU-Region, um die Daten aller Nutzer konsistent zu speichern und weil die EU-Datenschutzstandards hoch sind."
                },
                backup: {
                    title: "8.2 Backup und Redundanz",
                    text: "Die Natur von Cloud-Diensten bringt es mit sich, dass es Backups und Replikate von Daten zur Zuverlässigkeit gibt. Firestore (unsere Datenbank) speichert mehrere Replikate innerhalb der Multi-Region (z. B. können Daten zur Fehlertoleranz an mehreren EU-Standorten gespiegelt werden). Wir können auch regelmäßig Backups der Datenbank zur Notfallwiederherstellung exportieren. Diese Backups würden ebenfalls auf sicherem Cloud-Speicher gespeichert (wiederum wahrscheinlich in der EU-Region, sofern nicht anders konfiguriert). Wir behandeln Backups mit der gleichen Sicherheit wie Live-Daten. Keine physischen Medien von Backups verlassen die Cloud-Umgebung."
                },
                transfers: {
                    title: "8.3 Übermittlungen in Länder außerhalb der EU",
                    text: "Trotz der Datenspeicherung in der EU sind einige unserer Dienstleister internationale Unternehmen (Google, Meta, Microsoft). Es ist möglich, dass auf einige personenbezogene Daten außerhalb der EU zugegriffen wird oder diese dorthin übertragen werden, zum Beispiel:",
                    items: [
                        "Google als Unternehmen mit Hauptsitz in den USA muss möglicherweise Support leisten oder bestimmte Anfragen (insbesondere im Bereich KI oder Authentifizierung) über Server außerhalb der EU leiten.",
                        "Wenn Sie Integrationen wie GitHub oder Facebook nutzen, interagieren Sie mit Systemen in den USA (die API-Server von GitHub und Facebook befinden sich hauptsächlich in den USA). Das bedeutet zum Beispiel, dass ein Issue-Titel oder Social-Media-Beitragsinhalt, den Sie senden, von unseren EU-Servern an diese in den USA ansässigen Dienste übertragen wird.",
                        "Unser E-Mail-Versand nutzt möglicherweise SMTP-Server, die sich in den USA befinden (zum Beispiel bei Nutzung eines US-basierten E-Mail-Dienstes oder sogar der Gmail-Server von Google, die global sind)."
                    ],
                    transfersNote: "Wir ergreifen Maßnahmen, um eine rechtmäßige Übermittlung in diesen Fällen sicherzustellen. Unsere Verträge mit Google und anderen Anbietern enthalten Standardvertragsklauseln (SCCs), die sie verpflichten, DSGVO-Niveau-Schutzmaßnahmen einzuhalten, auch wenn Daten die EU verlassen. Bei Integrationen wie Facebook und GitHub willigen Sie mit der Autorisierung der Integration faktisch in diese Übermittlung ein, soweit dies für die Nutzung der Funktion erforderlich ist (da die Daten an diese Dienste gehen müssen). Wir stellen sicher, dass jede solche Übermittlung während der Übertragung verschlüsselt ist (HTTPS-sichere Anfragen) und nur die minimal erforderlichen Daten übertragen werden."
                },
                noGlobal: {
                    title: "8.4 Kein globaler Zugriff ohne Notwendigkeit",
                    text: `Wir greifen nicht routinemäßig auf Benutzerdaten zu oder übertragen diese an Büros oder Personal außerhalb der EU, es sei denn, dies ist erforderlich. Wenn beispielsweise ${COMPANY_NAME} in der EU ansässig ist, greift unser Team bei Supportleistungen aus der EU auf Daten zu. Wenn ${COMPANY_NAME} Entwickler oder Support-Mitarbeiter in anderen Ländern hat, greifen diese nur bei Bedarf und unter strengen Kontrollen auf Daten zu. Wir streben an, den Datenzugriff so weit wie möglich zu lokalisieren.`
                },
                hosting: {
                    title: "8.5 Hosting und Netzwerk",
                    text: "Die ProjectFlow-Webanwendung wird über Firebase Hosting bereitgestellt (das ein globales CDN verwendet). Wenn Sie auf unseren Dienst zugreifen, werden Ihre statischen Assets (wie JavaScript, Bilder der Benutzeroberfläche) möglicherweise von einem Server in Ihrer Nähe (der sich außerhalb der EU befinden kann) bereitgestellt, um die Geschwindigkeit zu optimieren; diese Assets enthalten jedoch nicht Ihre personenbezogenen Daten – es ist lediglich der Anwendungscode. API-Aufrufe, die Sie tätigen, werden an unsere EU-Server geleitet (wobei DNS Sie möglicherweise zum nächstgelegenen Edge-Standort leitet und dann zur EU-Region tunnelt). Dies gewährleistet minimale Latenz bei gleichzeitiger zentraler Datenspeicherung.",
                    summary: "Zusammenfassend lässt sich sagen, dass Ihre Daten hauptsächlich in der EU gespeichert werden, einige Verarbeitungen und Zugriffe jedoch andere Regionen, insbesondere die Vereinigten Staaten, aufgrund der von uns genutzten Anbieter betreffen können. Wir haben Maßnahmen (Verträge, technische Schutzmaßnahmen) ergriffen, um Ihre Daten in diesen Szenarien zu schützen. Durch die Nutzung von ProjectFlow verstehen Sie, dass Ihre personenbezogenen Daten in Länder außerhalb Ihres eigenen übertragen oder von unseren Unterauftragnehmern dort abgerufen werden können. Wir werden stets sicherstellen, dass solche Übermittlungen den geltenden Gesetzen entsprechen und dass Ihre Daten nach den Standards der DSGVO geschützt bleiben. Wenn Sie Fragen dazu haben, wo spezifische Daten gespeichert oder verarbeitet werden, oder weitere Details zu grenzüberschreitenden Schutzmaßnahmen benötigen, kontaktieren Sie uns bitte. Wir können auf Anfrage weitere Informationen oder eine Kopie der relevanten Vertragsbedingungen bereitstellen."
                }
            },
            retention: {
                title: "9. Datenspeicherung (Dauer)",
                intro: "Wir speichern Ihre personenbezogenen Daten nur so lange, wie es für die Erfüllung der Zwecke, für die sie erhoben wurden, erforderlich ist, oder wie es gesetzlich vorgeschrieben ist. Nachfolgend skizzieren wir unsere Aufbewahrungspraktiken für verschiedene Datenkategorien:",
                account: {
                    title: "9.1 Kontodaten",
                    text: "Wenn Sie ein Konto bei ProjectFlow haben, bewahren wir Ihre Kontoinformationen (wie Ihre E-Mail, Ihren Namen und Anmeldedaten) so lange auf, wie Ihr Konto aktiv ist. Dies ist erforderlich, damit Sie sich anmelden und den Dienst nutzen können. Wenn Sie sich entscheiden, Ihr Konto zu löschen, oder wenn Ihr Konto über einen längeren Zeitraum inaktiv ist, werden wir die Löschung Ihrer personenbezogenen Daten einleiten, vorbehaltlich der unten genannten Überlegungen. Die Kontolöschung entfernt persönliche Identifikatoren und Authentifizierungsdaten aus unseren primären Systemen (obwohl einige von Ihnen erstellte Inhalte bestehen bleiben könnten, wenn sie an einen geteilten Workspace gebunden sind, siehe unten). Wir können Ihre E-Mail-Adresse in einer Sperrliste aufbewahren, wenn Sie sich von E-Mails abgemeldet haben, einfach um sicherzustellen, dass wir Ihre Abmeldung respektieren."
                },
                content: {
                    title: "9.2 Projekt- und Inhaltsdaten",
                    text: "Alle Projekte, Aufgaben und sonstigen Inhalte, die Sie in ProjectFlow generieren, werden gespeichert, bis Sie oder ein autorisierter Benutzer sie löschen. Wir legen kein festes Ablaufdatum für Benutzerinhalte fest – es sind Ihre Daten, und wir halten sie für Sie verfügbar, bis Sie sich entscheiden, sie zu entfernen. Sie (oder Ihr Workspace-Admin) können bestimmte Elemente (z. B. eine Aufgabe oder Datei löschen) oder ganze Projekte/Workspaces löschen. Wenn Sie Daten über die App löschen, werden diese in der Regel sofort oder nach einem kurzen Sicherheitsintervall aus der Live-Datenbank entfernt. Reste der Daten können jedoch noch eine Weile in unseren Backups oder Protokollen verbleiben. Wir überschreiben Backups im Allgemeinen regelmäßig; Protokolle, die Daten enthalten, werden gemäß unserer Protokollaufbewahrung (in der Regel innerhalb weniger Wochen bis weniger Monate) bereinigt. Wichtig: Wenn Sie Teil eines geteilten Workspaces sind, können Daten, die Sie beigetragen haben (wie Aufgaben oder Kommentare), als Teil der Aufzeichnungen dieses Workspaces betrachtet werden. Wenn Sie den Workspace verlassen oder Ihr Konto löschen, bleibt der von Ihnen erstellte Inhalt normalerweise für die verbleibenden Workspace-Mitglieder zugänglich (zumindest das, was für die Projekthistorie notwendig ist), er kann jedoch anonymisiert werden (z. B. wird Ihr Name möglicherweise nicht mehr angezeigt, aber der Kommentar existiert noch als „Gelöschter Benutzer“). Workspace-Admins können uns kontaktieren, um bei Bedarf die Löschung von Inhalten zu beantragen, sie haben jedoch möglicherweise ihre eigenen Gründe (Recht/Compliance), Projektunterlagen aufzubewahren. Wir werden mit unseren Kunden zusammenarbeiten, um Aufbewahrungsanforderungen zu erfüllen."
                },
                tokens: {
                    title: "9.3 Integrationstoken",
                    text: "Wenn Sie Konten von Drittanbietern verknüpfen, werden die Token so lange gespeichert, wie Sie die Integration aktiv halten. Wenn Sie eine Integration trennen oder diese abläuft, entfernen oder invalidieren wir das gespeicherte Token. Wir können eine Aufzeichnung darüber behalten, dass eine Integration verbunden war (für Audit/Sicherheit), aber nicht das Token selbst nach der Trennung. Ihr GitHub-Token wird beispielsweise in Ihrem Profil oder Projektdokument gespeichert; wenn Sie es entfernen, ist es aus unserer Datenbank verschwunden. Dasselbe gilt für Social-Media-Token."
                },
                logs: {
                    title: "9.4 Protokolle und Metadaten",
                    text: "Unsere Systemprotokolle (die IP-Adressen, Geräteinformationen und Aktionsdatensätze enthalten können) werden für einen begrenzten Zeitraum zur Fehlerbehebung und Sicherheit aufbewahrt. Normalerweise bewahren wir detaillierte Protokolle für kurze Zeit (mehrere Wochen) und High-Level-Protokolle etwas länger auf. Firebase rotiert beispielsweise Protokolle automatisch; wir exportieren möglicherweise auch einige Protokolle für Sicherheitsaudits und bewahren diese einige Monate auf. Danach werden Protokolldaten gelöscht oder anonymisiert. Wir bewahren Protokolle nicht unbegrenzt auf, es sei denn, sie sind Teil einer spezifischen Sicherheitsuntersuchung."
                },
                ai: {
                    title: "9.5 KI-Nutzungsdaten",
                    text: "Informationen über Ihre Nutzung von KI-Funktionen (Token-Anzahl, Anzahl der Bildgenerierungen) werden monatlich aggregiert. Wir können Nutzungscounter jeden Monat zurücksetzen, um monatliche Limits zu implementieren. Wir bewahren möglicherweise historische aggregierte Nutzungsdaten (z. B. verwendete Token insgesamt pro Monat) für Analysen auf, dies wird jedoch normalerweise nicht länger als für die Trendanalyse erforderlich gespeichert. Sie können auf eine nicht personenbeziehbare Weise aufbewahrt werden."
                },
                newsletter: {
                    title: "9.6 Newsletter/Warteliste",
                    text: "Wenn Sie Ihre E-Mail-Adresse für unseren Newsletter oder unsere Warteliste auf der öffentlichen Seite angegeben haben, bewahren wir diese E-Mail auf, bis Sie sich abmelden oder uns bitten, sie zu löschen. Wenn jemand das Opt-in nicht bestätigt (für Newsletter/Warteliste), halten wir die unbestätigte Anfrage nur für kurze Zeit vor (unser System setzt eine 4-stündige Frist für die Bestätigung von Newsletter-Anmeldungen; wenn nicht bestätigt, läuft dieser ausstehende Datensatz ab und kann bereinigt werden). Bestätigte Abonnenten halten wir unbegrenzt, bis sie entfernt werden. Wir fügen in jede Newsletter-E-Mail einen Abmeldelink ein, und wenn Sie darauf klicken oder eine Abmeldung anfordern, markieren wir Ihre Adresse als abgemeldet (und beenden den Versand). Wir können die E-Mail auf einer Sperrliste behalten, um ein erneutes Senden zu vermeiden, es sei denn, Sie fordern eine vollständige Entfernung an."
                },
                closed: {
                    title: "9.7 Geschlossene Konten",
                    text: "Wenn Sie Ihr ProjectFlow-Konto löschen, bemühen wir uns, personenbezogene Daten, die mit Ihrem Konto verknüpft sind, zu entfernen oder zu anonymisieren. Es kann jedoch gesetzliche Anforderungen geben, bestimmte Daten aufzubewahren. Wenn Sie beispielsweise jemals einen Kauf getätigt haben (in Zukunft, wenn Zahlungen eingeführt werden), müssen wir Transaktionsdatensätze möglicherweise aus steuerlichen Gründen X Jahre aufbewahren. Oder wenn wir einen Sicherheitsvorfall hatten, bewahren wir möglicherweise einige Protokollbeweise auf. Im Allgemeinen bereinigen wir bei der Kontolöschung benutzerbereitgestellte Inhalte und Profildaten aus der Produktion, und nur minimale Informationen bleiben erhalten, wenn dies absolut erforderlich ist (z. B. ein archivierter Datensatz einer E-Mail-Einwilligung oder Daten in Backups, die schließlich auslaufen)."
                },
                backups: {
                    title: "9.8 Backups",
                    text: "Daten in Backups können bestehen bleiben, bis diese Backups ausrotiert werden. Unser Backup-Aufbewahrungsplan könnte beispielsweise 30 oder 60 Tage betragen (dies legen wir intern fest). Das bedeutet, dass selbst nach dem Löschen von etwas dieses für diesen Zeitraum in verschlüsselten Backups verbleiben kann. Wir werden diese Daten nicht wiederherstellen oder verwenden, außer zur Notfallwiederherstellung. Nach der Aufbewahrungszeit werden Backups, die die gelöschten Daten enthalten, überschrieben oder gelöscht. Wir haben keine unendlichen Backups, sodass gelöschte Daten schließlich aus allen Systemen fallen.",
                    summary: "Sobald die Aufbewahrungsfrist abgelaufen ist oder die Daten nicht mehr benötigt werden, werden wir sie entweder auf sichere Weise löschen oder anonymisieren (sodass sie nicht mehr mit einer Person verknüpft werden können). Wir überprüfen auch kontinuierlich die Daten, die wir haben; wenn wir feststellen, dass wir Daten haben, die unnötig sind, streben wir an, diese zu löschen oder zu anonymisieren, auch wenn Sie dies nicht ausdrücklich angefordert haben. Wenn Sie möchten, dass ein bestimmtes personenbezogenes Datum früher gelöscht wird (zum Beispiel haben Sie versehentlich etwas hochgeladen und möchten, dass es vollständig gelöscht wird), kontaktieren Sie uns bitte. Wir werden uns nach bestem Wissen bemühen, Anträge auf vorzeitige Löschung zu erfüllen, sofern wir nicht verpflichtet sind, diese Daten aufzubewahren. Bedenken Sie, dass Kommunikationsdaten, die Sie uns senden (wie Support-E-Mails), möglicherweise separat in unseren E-Mail-Aufzeichnungen aufbewahrt werden. Wir behandeln diese ähnlich – wir bewahren sie so lange auf, wie es zur Lösung Ihrer Anfrage erforderlich ist, und für eine kurze Weile danach (um eine Historie der Support-Interaktionen aufzubauen), und löschen sie dann, wenn angemessen. Beachten Sie schließlich, dass Restkombinationen vorübergehend in System-Caches oder verteiltem Speicher existieren können, diese werden jedoch kurz nach der aktiven Löschung überschrieben. Unser Ziel ist es, dass etwas, wenn es gelöscht wird, sofort aus allen für den Benutzer zugänglichen Bereichen und innerhalb eines angemessenen Zeitraums aus allen Backups/Protokollen verschwunden ist."
                }
            },
            security: {
                title: "10. Sicherheit Ihrer Daten",
                intro: "Die Sicherheit Ihrer Daten hat für uns Priorität. Wir setzen technische und organisatorische Maßnahmen ein, um Ihre personenbezogenen Daten zu schützen:",
                encryption: {
                    title: "10.1 Verschlüsselung",
                    text: "Der gesamte Netzwerkverkehr mit ProjectFlow wird während der Übertragung mittels HTTPS/TLS verschlüsselt. Egal, ob Sie auf die Web-App oder unsere APIs zugreifen, Ihre Daten werden sicher übertragen, um Abhören zu verhindern. Darüber hinaus nutzen unsere Datenbank und unser Speicher eine Verschlüsselung im Ruhezustand (Google Firebase verschlüsselt Daten automatisch auf den Festplatten ihrer Server). Alle sensiblen Felder (wie Passwörter) werden auf Anwendungsebene weiter durch Hashing oder Verschlüsselung geschützt – Passwörter werden beispielsweise von Firebase Auth gehasht, und wir speichern sie niemals im Klartext. Für besonders sensible Daten wie Integrationstoken oder SMTP-Zugangsdaten verlassen wir uns auf die Sicherheitsregeln von Firebase und/oder Verschlüsselung, um diese sicher zu halten (und in einer echten Produktionsumgebung würden wir zusätzliche Verschlüsselung in Betracht ziehen; unsere Code-Kommentare weisen darauf hin, dass SMTP-Passwörter idealerweise verschlüsselt sein sollten)."
                },
                access: {
                    title: "10.2 Zugriffskontrolle",
                    text: "Daten in ProjectFlow sind durch Authentifizierungsprüfungen geschützt. Sie können nur auf die Daten Ihres Workspaces zugreifen, wenn Sie ein angemeldetes Mitglied dieses Workspaces sind. Wir setzen eine rollenbasierte Zugriffskontrolle (Rollen: Eigentümer, Admin, Mitglied, Betrachter mit spezifischen Berechtigungen) durch, um sicherzustellen, dass Benutzer nur das sehen und tun, was ihnen gestattet ist. Im Backend stellen unsere Firestore-Sicherheitsregeln und Cloud-Function-Prüfungen sicher, dass Benutzer keine Daten lesen oder schreiben können, die sie nicht sollten (diese Regeln beschränken Daten nach Benutzer-ID, Workspace-ID und Rollenprivilegien). Innerhalb unseres Teams ist der Zugriff auf Produktionsdaten auf autorisiertes Personal beschränkt, das ihn für Wartung oder Support benötigt (und auch dann greifen sie unter strenger Vertraulichkeit darauf zu)."
                },
                auth: {
                    title: "10.3 Authentifizierungssicherheit",
                    text: "Wir bieten und empfehlen starke Authentifizierungsoptionen wie OAuth (damit Sie kein schwaches Passwort festlegen müssen) und Zwei-Faktor-Authentifizierung (2FA) über Authenticator-Apps oder Passkeys. Diese Funktionen fügen Ihrem Konto Sicherheitsebenen hinzu. Wir speichern öffentliche Schlüssel und Anmeldeinformationen für Passkeys wie beschrieben, die nicht verwendet werden können, um sich ohne Ihr physisches Gerät als Sie auszugeben. Wir überwachen auch Anmeldeversuche und können Konten nach übermäßigen Fehlversuchen sperren, um Brute-Force-Angriffe abzuwehren. Wenn Sie 2FA aktivieren, könnte sich selbst jemand, der irgendwie an Ihr Passwort gelangt ist, ohne den zweiten Faktor nicht anmelden."
                },
                network: {
                    title: "10.4 Netzwerk- und Infrastruktursicherheit",
                    text: "Unsere Server laufen auf der Google Cloud, die über robuste Sicherheit auf physischer und Netzwerkebene verfügt. Wir verwenden Cloud Functions mit dem Prinzip der geringsten Rechte (jede Funktion hat nur Zugriff auf das, was sie benötigt). Wir halten unsere Softwareabhängigkeiten auf dem neuesten Stand, um Sicherheitslücken zu schließen. Die Datenbank ist nicht direkt über das Internet zugänglich, außer über unsere sicheren API-Endpunkte mit entsprechenden Regeln. Wir verwenden auch Sicherheitsregeln für Firestore, die nur gültige authentifizierte Anfragen an bestimmte Sammlungen zulassen. Wir überprüfen diese Regeln regelmäßig auf Lücken."
                },
                testing: {
                    title: "10.5 Testen und Überwachen",
                    text: "Wir testen unsere Anwendung (einschließlich Sicherheitsregeln), um etwaige Fehlkonfigurationen zu finden. Wir protokollieren auch wichtige Ereignisse und überwachen auf Anomalien. Wenn verdächtige Aktivitäten erkannt werden (wie ein ungewöhnlicher Anstieg der Nutzung oder ein bekanntes Angriffsmuster in Protokollen), untersuchen wir dies umgehend. Firebase bietet Tools wie das Security Center und Warnungen, die wir nutzen. Wir verwenden auch rollenbasierte API-Schlüssel und Secrets für Dienste von Drittanbietern, um sicherzustellen, dass bei einer Kompromittierung eines Schlüssels dessen Umfang begrenzt ist. Unsere API-Aufrufe an Google AI erfordern beispielsweise unsere sicher gespeicherten Dienstkonto-Zugangsdaten, und unser Datenbankzugriff erfordert ordnungsgemäße Anmeldeinformationen, die nicht auf der Client-Seite offengelegt werden."
                },
                team: {
                    title: "10.6 Mitarbeiter- und Auftragnehmerzugriff",
                    text: `Innerhalb von ${COMPANY_NAME} ist der Zugriff auf personenbezogene Daten streng limitiert. Teammitglieder, die den Dienst unterstützen müssen, dürfen auf Daten zugreifen, aber nur auf das Notwendige. Wir schulen unser Team in Datenschutz- und Sicherheitspraktiken. Jeder Zugriff auf Produktionssysteme wird protokolliert und erfordert Authentifizierung. Wir stellen auch sicher, dass alle Auftragnehmer oder Verarbeiter, mit denen wir zusammenarbeiten, NDAs unterliegen und unsere Sicherheitsstandards befolgen.`
                },
                prevention: {
                    title: "10.7 Präventivmaßnahmen",
                    text: "Wir implementieren Maßnahmen gegen gängige Web-Bedrohungen: z. B. schützen wir uns vor SQL/NoSQL-Injections durch Verwendung der parametrisierten Abfragen und Validierung von Firestore; wir schützen uns vor XSS, indem wir Benutzereingaben in der UI ordnungsgemäß kodieren; wir mindern CSRF, indem wir keine Cookies für sensible Operationen verwenden (und wenn wir es tun, sicherstellen, dass sie Same-Site sind oder Token zur Verifizierung verwenden). Wir nutzen auch die integrierten Schutzmaßnahmen von Firebase (wie App Check usw., falls konfiguriert), um sicherzustellen, dass nur unsere App auf das Backend zugreifen kann."
                },
                isolation: {
                    title: "10.8 Datenisolierung",
                    text: "Die Daten jedes Kunden sind logisch durch eindeutige Identifikatoren (Mandanten-/Workspace-IDs) getrennt. Das bedeutet, dass Benutzer aus einem Workspace nicht auf die Daten eines anderen Workspaces zugreifen können, es sei denn, sie wurden hinzugefügt. Unser Multi-Tenancy-Modell ist darauf ausgelegt, Datenlecks über Konten hinweg zu verhindern."
                },
                backups: {
                    title: "10.9 Backups und Wiederherstellung",
                    text: "Wir sichern Daten regelmäßig, um Verlusten vorzubeugen, wie erwähnt, und diese Backups sind gesichert. Im Falle eines Datenvorfalls (wie Korruption oder versehentliches Löschen) haben wir die Möglichkeit, aus dem Backup wiederherzustellen, um die Auswirkungen zu minimieren. Der Zugriff auf Backup-Speicherorte ist ebenfalls eingeschränkt.",
                    summary: "Obwohl wir uns bemühen, Ihre Daten zu schützen, ist es wichtig zu beachten, dass kein System zu 100 % sicher sein kann. Es besteht immer ein gewisses Risiko einer Verletzung oder Schwachstelle. Im unwahrscheinlichen Fall einer Datenpanne, die Ihre personenbezogenen Daten betrifft, werden wir die geltenden Gesetze befolgen, um betroffene Benutzer und Behörden innerhalb der erforderlichen Fristen zu benachrichtigen, und wir werden die notwendigen Schritte unternehmen, um den Schaden zu begrenzen. Auch Sie spielen eine Rolle bei der Sicherheit – wir empfehlen Ihnen, ein starkes Passwort zu verwenden und Ihre Kontoanmeldeinformationen vertraulich zu behandeln. Aktivieren Sie 2FA oder Passkeys für zusätzliche Sicherheit. Seien Sie vorsichtig bei Phishing-Versuchen; wir werden Sie niemals per E-Mail nach Ihrem Passwort fragen. Wenn Sie einen unbefugten Zugriff auf Ihr Konto vermuten, ändern Sie bitte sofort Ihr Passwort und kontaktieren Sie uns."
                }
            },
            rights: {
                title: "11. Ihre Rechte (DSGVO und Äquivalente)",
                intro: "Als Einzelperson in der Europäischen Union (oder in Ländern mit ähnlichen Datenschutzgesetzen) haben Sie bestimmte Rechte in Bezug auf Ihre personenbezogenen Daten. Wir verpflichten uns, diese Rechte zu wahren. Nachfolgend finden Sie eine Zusammenfassung Ihrer wichtigsten Rechte:",
                access: {
                    title: "11.1 Recht auf Auskunft",
                    text: "Sie haben das Recht, eine Kopie der personenbezogenen Daten zu verlangen, die wir über Sie speichern, und Informationen darüber zu erhalten, wie wir diese verarbeiten. Dies ist allgemein als „Auskunftsersuchen der betroffenen Person“ bekannt. Nach Überprüfung Ihrer Identität werden wir Ihnen einen Überblick über Ihre Daten geben – typischerweise umfasst dies Daten wie Ihre Profilinformationen, Kontodetails und möglicherweise Protokolle Ihrer Aktivitäten oder Kommunikationen. (Viele dieser Daten sind für Sie direkt in der App zugänglich, aber Sie können einen strukturierten Bericht anfordern)."
                },
                rectification: {
                    title: "11.2 Recht auf Berichtigung",
                    text: "Wenn Ihre personenbezogenen Daten unrichtig oder unvollständig sind, haben Sie das Recht, diese korrigieren oder aktualisieren zu lassen. Wenn Sie beispielsweise feststellen, dass wir Ihren Namen falsch geschrieben haben oder eine veraltete E-Mail-Adresse haben, können Sie dies in Ihrem Profil ändern oder uns bitten, dies zu korrigieren. Wir empfehlen Ihnen, Ihre Kontoinformationen auf dem neuesten Stand zu halten. In vielen Fällen können Sie Ihre Informationen direkt bearbeiten (z. B. Änderung Ihres Anzeigenamens oder Ihrer Profildetails in den Einstellungen). Bei Feldern, die Sie nicht bearbeiten können, kontaktieren Sie uns, und wir werden Ihnen bei der Aktualisierung helfen."
                },
                erasure: {
                    title: "11.3 Recht auf Löschung",
                    text: "Allgemein bekannt als das „Recht auf Vergessenwerden“, erlaubt Ihnen dieses Recht, die Löschung Ihrer personenbezogenen Daten zu verlangen. Sie können bestimmte Daten selbst löschen (z. B. Inhalte entfernen, die Sie gepostet haben, oder Ihr gesamtes Konto über die Kontoeinstellungen der App löschen, falls diese Funktion verfügbar ist, oder indem Sie den Support kontaktieren). Wenn Sie die Löschung beantragen, werden wir Ihre personenbezogenen Daten aus unseren Systemen löschen, sofern wir keine rechtliche Verpflichtung oder ein überwiegendes berechtigtes Interesse haben, diese zu behalten. Beachten Sie, dass, wenn Sie Teil eines Workspaces sind, das Löschen Ihres Kontos möglicherweise nicht automatisch alle Inhalte löscht, die Sie in geteilten Projekten erstellt haben (da diese für die Projekthistorie anderer Benutzer wichtig sein könnten). In solchen Fällen können wir Ihre Identität bei verbleibenden Inhalten anonymisieren oder pseudonymisieren (z. B. „Ehemaliger Benutzer“ anstelle Ihres Namens anzeigen). Wir werden Ihnen solche Vorbehalte erklären, falls sie zutreffen. Wenn Sie möchten, dass alle von Ihnen hinzugefügten Inhalte entfernt werden, müssen wir uns möglicherweise mit dem Workspace-Eigentümer abstimmen. In jedem Fall werden wir unser Bestes tun, um den Geist Ihrer Anfrage zu ehren und persönliche Identifikatoren zu entfernen."
                },
                restrict: {
                    title: "11.4 Recht auf Einschränkung der Verarbeitung",
                    text: "Sie können uns bitten, die Verarbeitung Ihrer Daten unter bestimmten Umständen einzuschränken oder zu „pausieren“. Wenn Sie beispielsweise die Richtigkeit der Daten bestreiten oder der Verarbeitung widersprochen haben (siehe unten) und wir Ihre Anfrage prüfen, können Sie verlangen, dass wir die Verarbeitung während dieses Zeitraums einschränken. Ein weiteres Beispiel ist, wenn Sie Daten für einen Rechtsanspruch aufbewahrt benötigen, während wir sie ansonsten löschen würden – wir können sie als eingeschränkt markieren, sodass sie nicht aktiv verarbeitet, sondern nur gespeichert werden. Wenn die Verarbeitung eingeschränkt ist, werden wir die Daten außer zur Speicherung nicht verwenden und Sie informieren, bevor wir die Einschränkung aufheben."
                },
                portability: {
                    title: "11.5 Recht auf Datenübertragbarkeit",
                    text: "Sie haben das Recht, die personenbezogenen Daten, die Sie uns bereitgestellt haben, in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten, und Sie haben das Recht, diese Daten an einen anderen Verantwortlichen zu übermitteln (z. B. an einen anderen Dienst), sofern dies technisch machbar ist. Dies gilt typischerweise für Daten, die wir automatisiert auf der Grundlage Ihrer Einwilligung oder eines Vertrags verarbeiten. In der Praxis könnte dies bedeuten, dass wir auf Ihre Anfrage hin Ihre Projektdaten oder Profilinformationen in einem CSV- oder JSON-Format exportieren könnten, damit Sie diese mitnehmen können. Wir werden unser Bestes tun, um solchen Anfragen in einem angemessenen Format nachzukommen. (Hinweis: Dieses Recht ist eher auf Dinge wie Social-Media-Beiträge oder Fotos auf einer Plattform ausgerichtet; in unserem Fall können Ihre Projektdaten recht komplex sein. Wir werden mit Ihnen zusammenarbeiten, um einen geeigneten Weg zur Übergabe Ihrer Daten zu finden, falls erforderlich)."
                },
                object: {
                    title: "11.6 Widerspruchsrecht",
                    text: "Sie haben das Recht, unserer Verarbeitung Ihrer personenbezogenen Daten zu widersprechen, wenn diese Verarbeitung auf unseren berechtigten Interessen (Art. 6(1)(f) DSGVO) oder auf öffentlichem Interesse beruht. Wenn Sie widersprechen, müssen wir die Verarbeitung Ihrer Daten einstellen, es sei denn, wir haben zwingende schutzwürdige Gründe, die Ihre Rechte überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen. Sie können beispielsweise der Verarbeitung Ihrer Daten für Direktwerbung widersprechen (obwohl wir derzeit kein Marketing ohne Einwilligung betreiben). Sie könnten auch widersprechen, wenn wir ein Analytics-Profiling auf der Grundlage berechtigter Interessen durchführen würden – als Reaktion darauf würden wir entweder diese Verarbeitung stoppen oder darlegen, warum wir glauben, dass unsere Gründe Ihre Privatsphäre überwiegen (in den meisten Fällen werden wir, wenn ein Benutzer widerspricht, eher dazu neigen, die Verarbeitung zu stoppen). Wenn Sie einer Verarbeitung Ihrer Daten widersprechen, kontaktieren Sie uns bitte und geben Sie an, wogegen Sie widersprechen und warum. Wir werden umgehend mit einer Entscheidung oder einer Bitte um Klärung antworten."
                },
                withdraw: {
                    title: "11.7 Recht auf Widerruf der Einwilligung",
                    text: "Wenn wir Ihre Daten auf der Grundlage einer Einwilligung verarbeiten, haben Sie das Recht, diese Einwilligung jederzeit zu widerrufen. Wenn Sie beispielsweise dem Erhalt des Newsletters zugestimmt haben, können Sie sich abmelden (Widerruf der Einwilligung für diese Nutzung Ihrer E-Mail). Der Widerruf der Einwilligung berührt nicht die Rechtmäßigkeit der Verarbeitung, die vor dem Widerruf erfolgt ist. Beachten Sie auch, dass, wenn Sie Ihre Einwilligung für etwas widerrufen, das für die Bereitstellung des Dienstes erforderlich ist (angenommen, Sie hätten hypothetisch zugestimmt, uns einige Daten verwenden zu lassen, und widerrufen dann, aber diese Daten werden für Ihr Konto benötigt), wir diesen Aspekt des Dienstes möglicherweise beenden müssen. Wir werden Sie informieren, falls dies der Fall ist, damit Sie eine fundierte Entscheidung treffen können."
                },
                automated: {
                    title: "11.8 Recht, nicht einer automatisierten Entscheidung unterworfen zu werden",
                    text: "Sie haben Rechte in Bezug auf Entscheidungen, die nicht ausschließlich auf einer automatisierten Verarbeitung beruhen und die Ihnen gegenüber rechtliche Wirkung entfalten oder Sie in ähnlicher Weise erheblich beeinträchtigen. Wie bereits erwähnt, führt ProjectFlow keine solche automatisierte Entscheidungsfindung durch (keine KI entscheidet beispielsweise darüber, ob Sie den Dienst nutzen dürfen oder nicht, ohne menschliche Beteiligung). Dieses Recht ist hier also eher eine Formalität – Sie werden dem nicht unterworfen sein, und daher gibt es nichts, wovon Sie sich abmelden müssten. Sollten Sie jedoch jemals das Gefühl haben, dass eine automatisierte Funktion Sie erheblich beeinträchtigt, lassen Sie es uns wissen, und wir werden dies überprüfen."
                },
                contact: {
                    text: "Um eines dieser Rechte auszuüben, können Sie uns unter **hello@getprojectflow.com** erreichen. Wir müssen möglicherweise Ihre Identität überprüfen, um unbefugte Anfragen zu verhindern (wir möchten beispielsweise nicht, dass jemand anderes fälschlicherweise behauptet, er sei Sie, und Zugang zu Ihren Daten erhält). Wir bemühen uns, Anfragen innerhalb eines Monats zu beantworten, wie es die DSGVO vorschreibt, und werden Sie informieren, wenn wir mehr Zeit benötigen (bis zu zwei Monate Verlängerung in komplexen Fällen). Die Ausübung Ihrer Rechte ist in der Regel gebührenfrei. Wenn eine Anfrage jedoch offenkundig unbegründet oder exzessiv ist (wie wiederholte Anfragen ohne Rechtfertigung), können wir eine angemessene Gebühr erheben oder die Bearbeitung verweigern, wie gesetzlich zulässig. Aber wir werden mit Ihnen kommunizieren und versuchen, eine vernünftige Lösung zu finden."
                },
                complaint: {
                    text: `Wenn Sie mit unserer Antwort nicht zufrieden sind oder glauben, dass wir Ihre Daten unrechtmäßig verarbeiten, haben Sie auch das Recht, eine Beschwerde bei einer Datenschutzaufsichtsbehörde einzureichen. In Deutschland könnten Sie beispielsweise die Datenschutzbehörde des Bundeslandes, in dem Sie wohnen, oder das Bayerische Landesamt für Datenschutzaufsicht (BayLDA) kontaktieren, wenn ${COMPANY_NAME} in Bayern ansässig ist. In der EU können Sie sich generell an die Behörde in Ihrem Wohnsitzland oder an die Behörde wenden, wo unser Unternehmen niedergelassen ist (falls abweichend). Wir würden es natürlich begrüßen, wenn wir Ihre Bedenken zuerst direkt ansprechen dürften, daher ermutigen wir Sie, uns bei Beschwerden zu kontaktieren, und wir werden unser Bestes tun, um sie zu lösen. Ihre Datenschutzrechte sind uns sehr wichtig. Wir werden Sie nicht benachteiligen, wenn Sie eines dieser Rechte ausüben, und wir sind hier, um Ihnen die Kontrolle über Ihre personenbezogenen Daten zu erleichtern.`
                }
            },
            children: {
                title: "12. Datenschutz bei Kindern",
                text: "Unser Dienst richtet sich nicht an Personen unter 16 Jahren (oder dem höheren Alter der digitalen Mündigkeit in Ihrem Land). Wir erfassen wissentlich keine personenbezogenen Daten von Kindern. Wenn Sie feststellen, dass ein Kind uns personenbezogene Daten ohne elterliche Zustimmung zur Verfügung gestellt hat, kontaktieren Sie uns bitte. Wir werden Schritte unternehmen, um diese Informationen zu entfernen und das Konto zu kündigen."
            },
            changes: {
                title: "13. Änderungen dieser Datenschutzerklärung",
                text: "Wir können unsere Datenschutzerklärung von Zeit zu Zeit aktualisieren. Wir werden Sie über Änderungen informieren, indem wir die neue Datenschutzerklärung auf dieser Seite veröffentlichen und das Datum „Zuletzt aktualisiert“ aktualisieren. Bei wesentlichen Änderungen können wir Sie per E-Mail oder durch einen deutlichen Hinweis in unserem Dienst benachrichtigen. Es wird empfohlen, diese Datenschutzerklärung regelmäßig auf Änderungen zu überprüfen."
            },
            contactUs: {
                title: "14. Kontakt",
                intro: "Wenn Sie Fragen zu dieser Datenschutzerklärung oder unseren Datenpraktiken haben, kontaktieren Sie uns bitte unter:",
                address: `**${COMPANY_NAME}**<br />Datenschutzbeauftragter/Datenschutzteam (falls zutreffend)<br />Adresse: Frühlingsstraße 8, ${COMPANY_ZIP} ${COMPANY_CITY}, Deutschland<br />E-Mail: hello@getprojectflow.com`,
                outro: "Wir werden Ihre Anfrage so schnell wie möglich bearbeiten.<br /><br />Vielen Dank, dass Sie sich die Zeit genommen haben, unsere Datenschutzrichtlinie zu lesen. Wir schätzen Ihre Privatsphäre und verpflichten uns, Ihre personenbezogenen Daten zu schützen, während wir Ihnen einen nützlichen und sicheren Dienst bieten."
            }
        },

    },
}
