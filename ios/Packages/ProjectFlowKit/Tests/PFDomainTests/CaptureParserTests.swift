import Foundation
import Testing
@testable import PFDomain

/// Reference "now" for every case: Thursday 2026-10-22, 12:00 in Berlin (CEST).
private enum CaptureClock {
    static let timeZone = TimeZone(identifier: "Europe/Berlin")!

    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        calendar.locale = Locale(identifier: "en_US")
        calendar.firstWeekday = 2
        return calendar
    }

    static let now = ISO8601DateFormatter().date(from: "2026-10-22T10:00:00Z")!

    static let projects = [
        CaptureEntity(id: "p-web", name: "Website Relaunch"),
        CaptureEntity(id: "p-app", name: "Mobile App v2"),
        CaptureEntity(id: "p-mkt", name: "Marketing"),
    ]
    static let people = [
        CaptureEntity(id: "u-lena", name: "Lena Meier"),
        CaptureEntity(id: "u-alex", name: "Alex Kranz"),
        CaptureEntity(id: "u-chris", name: "Christoph Labestin"),
    ]

    static func options(now: Date = now, dismissed: Set<String> = []) -> CaptureParser.Options {
        CaptureParser.Options(now: now, calendar: calendar, projects: projects, people: people, dismissed: dismissed, usesDataDetector: false)
    }
}

private struct CaptureCase: CustomTestStringConvertible, Sendable {
    let input: String
    let title: String
    var due: String?
    var project: String?
    var person: String?

    init(_ input: String, title: String, due: String? = nil, project: String? = nil, person: String? = nil) {
        self.input = input
        self.title = title
        self.due = due
        self.project = project
        self.person = person
    }

    var testDescription: String { input }
}

@Suite("Capture parser")
struct CaptureParserTests {
    private static let corpus: [CaptureCase] = [
        // German, relative days and weekdays
        CaptureCase("heute", title: "", due: "2026-10-22"),
        CaptureCase("Call Mom heute", title: "Call Mom", due: "2026-10-22"),
        CaptureCase("Bericht schreiben morgen", title: "Bericht schreiben", due: "2026-10-23"),
        CaptureCase("Folien übermorgen fertig", title: "Folien fertig", due: "2026-10-24"),
        CaptureCase("Zahnarzt am Freitag", title: "Zahnarzt", due: "2026-10-23"),
        CaptureCase("Montag Team-Meeting vorbereiten", title: "Team-Meeting vorbereiten", due: "2026-10-26"),
        CaptureCase("Rechnung bis Donnerstag", title: "Rechnung", due: "2026-10-29"),
        CaptureCase("Abgabe nächsten Montag", title: "Abgabe", due: "2026-10-26"),
        CaptureCase("Team-Lunch kommenden Dienstag", title: "Team-Lunch", due: "2026-10-27"),
        CaptureCase("Naechste Woche Urlaub", title: "Urlaub", due: "2026-10-26"),
        CaptureCase("Urlaub planen nächste Woche", title: "Urlaub planen", due: "2026-10-26"),
        CaptureCase("Retro vorbereiten übernächste Woche", title: "Retro vorbereiten", due: "2026-11-02"),
        CaptureCase("Aufräumen am Wochenende", title: "Aufräumen", due: "2026-10-24"),
        CaptureCase("Heute Abend Pizza bestellen", title: "Pizza bestellen", due: "2026-10-22"),
        CaptureCase("Morgen früh joggen", title: "joggen", due: "2026-10-23"),
        CaptureCase("MORGEN anrufen", title: "anrufen", due: "2026-10-23"),
        CaptureCase("Besprechung für morgen", title: "Besprechung", due: "2026-10-23"),
        // German, relative amounts
        CaptureCase("Angebot in 2 Wochen nachfassen", title: "Angebot nachfassen", due: "2026-11-05"),
        CaptureCase("Rückruf in 3 Tagen", title: "Rückruf", due: "2026-10-25"),
        CaptureCase("Vertrag in einem Monat prüfen", title: "Vertrag prüfen", due: "2026-11-22"),
        // German, calendar dates
        CaptureCase("Steuern bis 15.11.", title: "Steuern", due: "2026-11-15"),
        CaptureCase("Geburtstag am 24.10.", title: "Geburtstag", due: "2026-10-24"),
        CaptureCase("Flug buchen 1.12.", title: "Flug buchen", due: "2026-12-01"),
        CaptureCase("Zahnarzt 5.10.", title: "Zahnarzt", due: "2027-10-05"),
        CaptureCase("Konferenz 24.10.2027", title: "Konferenz", due: "2027-10-24"),
        CaptureCase("Konferenz 24.10.27", title: "Konferenz", due: "2027-10-24"),
        CaptureCase("Schulung am 5.11", title: "Schulung", due: "2026-11-05"),
        CaptureCase("Geburtstag 24. Oktober", title: "Geburtstag", due: "2026-10-24"),
        CaptureCase("Umzug 3. November 2026 organisieren", title: "Umzug organisieren", due: "2026-11-03"),
        CaptureCase("Freitag, 24.10. Abgabe", title: "Abgabe", due: "2026-10-24"),
        // English
        CaptureCase("Buy milk tomorrow", title: "Buy milk", due: "2026-10-23"),
        CaptureCase("Call John by Friday", title: "Call John", due: "2026-10-23"),
        CaptureCase("Prepare slides next monday", title: "Prepare slides", due: "2026-10-26"),
        CaptureCase("Review PR this friday", title: "Review PR", due: "2026-10-23"),
        CaptureCase("Ship the release this thursday", title: "Ship the release", due: "2026-10-22"),
        CaptureCase("Pay rent on Oct 24", title: "Pay rent", due: "2026-10-24"),
        CaptureCase("Dentist October 24th", title: "Dentist", due: "2026-10-24"),
        CaptureCase("Dentist 24 Oct", title: "Dentist", due: "2026-10-24"),
        CaptureCase("Conference Nov 3, 2026 booking", title: "Conference booking", due: "2026-11-03"),
        CaptureCase("Gifts Dec 25 2026", title: "Gifts", due: "2026-12-25"),
        CaptureCase("Submit report in 2 weeks", title: "Submit report", due: "2026-11-05"),
        CaptureCase("Follow up in 3 days", title: "Follow up", due: "2026-10-25"),
        CaptureCase("Renew passport in a week", title: "Renew passport", due: "2026-10-29"),
        CaptureCase("Call mom tonight", title: "Call mom", due: "2026-10-22"),
        CaptureCase("Plan trip day after tomorrow", title: "Plan trip", due: "2026-10-24"),
        CaptureCase("Retro next week", title: "Retro", due: "2026-10-26"),
        CaptureCase("Cleanup this weekend", title: "Cleanup", due: "2026-10-24"),
        CaptureCase("Deploy 2026-11-15", title: "Deploy", due: "2026-11-15"),
        CaptureCase("Sunday brunch", title: "brunch", due: "2026-10-25"),
        CaptureCase("Pay bills on friday morning", title: "Pay bills", due: "2026-10-23"),
        // Projects and people
        CaptureCase("Redirects testen morgen #website", title: "Redirects testen", due: "2026-10-23", project: "p-web"),
        CaptureCase("#mobile Onboarding polieren", title: "Onboarding polieren", project: "p-app"),
        CaptureCase("Lena @lena fragen", title: "Lena fragen", person: "u-lena"),
        CaptureCase("Review mit @alex bis Freitag #website", title: "Review mit", due: "2026-10-23", project: "p-web", person: "u-alex"),
        CaptureCase("Kampagne #market planen", title: "Kampagne planen", project: "p-mkt"),
        CaptureCase("Meeting mit Lena morgen", title: "Meeting mit Lena", due: "2026-10-23"),
        // Text that must stay untouched
        CaptureCase("Nothing special here", title: "Nothing special here"),
        CaptureCase("Mail an max@example.com senden", title: "Mail an max@example.com senden"),
        CaptureCase("Version 1.2.3 prüfen", title: "Version 1.2.3 prüfen"),
        CaptureCase("Preis 3.5 Euro prüfen", title: "Preis 3.5 Euro prüfen"),
        CaptureCase("May I help", title: "May I help"),
        CaptureCase("Kommentar #unknown schreiben", title: "Kommentar #unknown schreiben"),
        CaptureCase("Abgabe 31.4.", title: "Abgabe 31.4."),
        CaptureCase("Übermorgens Wetter", title: "Übermorgens Wetter"),
    ]

    @Test("Corpus: title, date, project and person", arguments: corpus)
    fileprivate func parsesCorpus(_ testCase: CaptureCase) {
        let result = CaptureParser.parse(testCase.input, options: CaptureClock.options())
        #expect(result.title == testCase.title)
        #expect(result.dueDate?.webString == testCase.due)
        #expect(result.projectId == testCase.project)
        #expect(result.personId == testCase.person)
    }

    @Test func corpusIsLargeEnough() {
        #expect(Self.corpus.count >= 40)
    }

    @Test func tokenRangesPointAtTheTypedText() {
        let text = "Redirects testen morgen #website"
        let result = CaptureParser.parse(text, options: CaptureClock.options())
        #expect(result.tokens.map(\.kind) == [.date, .project])
        #expect(result.tokens.map(\.text) == ["morgen", "#website"])
        #expect(result.tokens[0].range == NSRange(location: 17, length: 6))
        #expect(result.tokens[1].range == NSRange(location: 24, length: 8))
        #expect(result.tokens[0].stringRange(in: text).map { String(text[$0]) } == "morgen")
    }

    @Test func leadingPrepositionIsPartOfTheDateToken() {
        let result = CaptureParser.parse("Call John by Friday", options: CaptureClock.options())
        #expect(result.tokens.first?.text == "by Friday")
    }

    @Test func dismissedTokensStayInTheTitle() {
        let text = "Redirects morgen testen #website"
        let all = CaptureParser.parse(text, options: CaptureClock.options())
        let date = try! #require(all.tokens.first { $0.kind == .date })
        let result = CaptureParser.parse(text, options: CaptureClock.options(dismissed: [date.key]))
        #expect(result.dueDate == nil)
        #expect(result.projectId == "p-web")
        #expect(result.title == "Redirects morgen testen")
    }

    @Test func dismissingTheFirstDateActivatesTheNext() {
        let text = "morgen und übermorgen"
        let first = CaptureParser.parse(text, options: CaptureClock.options())
        #expect(first.dueDate?.webString == "2026-10-23")
        #expect(first.title == "und übermorgen")
        let second = CaptureParser.parse(text, options: CaptureClock.options(dismissed: ["date:morgen"]))
        #expect(second.dueDate?.webString == "2026-10-24")
    }

    @Test func onlyTheFirstProjectAndPersonCount() {
        let result = CaptureParser.parse("#website #marketing @lena @alex", options: CaptureClock.options())
        #expect(result.projectId == "p-web")
        #expect(result.personId == "u-lena")
        #expect(result.title == "#marketing @alex")
    }

    @Test func todayFollowsTheCalendarTimeZone() {
        // 23:30 UTC on the 22nd is already the 23rd in Berlin.
        let late = ISO8601DateFormatter().date(from: "2026-10-22T23:30:00Z")!
        let result = CaptureParser.parse("heute", options: CaptureClock.options(now: late))
        #expect(result.dueDate?.webString == "2026-10-23")
    }

    @Test func weekdayNamedToday() {
        // "Donnerstag" on a Thursday means next week, "diesen Donnerstag" means today.
        #expect(CaptureParser.parse("Donnerstag", options: CaptureClock.options()).dueDate?.webString == "2026-10-29")
        #expect(CaptureParser.parse("diesen Donnerstag", options: CaptureClock.options()).dueDate?.webString == "2026-10-22")
    }

    @Test func leapDayOnlyInLeapYears() {
        #expect(CaptureParser.parse("Steuer 29.2.", options: CaptureClock.options()).dueDate?.webString == "2028-02-29")
        #expect(CaptureParser.parse("Steuer 29.2.2027", options: CaptureClock.options()).dueDate == nil)
    }

    @Test func resolvesNamesByPrefixThenInsideWords() {
        #expect(CaptureParser.resolve("web", among: CaptureClock.projects)?.id == "p-web")
        #expect(CaptureParser.resolve("relaunch", among: CaptureClock.projects)?.id == "p-web")
        #expect(CaptureParser.resolve("website-relaunch", among: CaptureClock.projects)?.id == "p-web")
        #expect(CaptureParser.resolve("lab", among: CaptureClock.people)?.id == "u-chris")
        #expect(CaptureParser.resolve("zzz", among: CaptureClock.projects) == nil)
    }

    @Test func dataDetectorFallbackFindsDatesTheRulesMiss() {
        var options = CaptureClock.options()
        options.usesDataDetector = true
        // Numeric US/EU dates have no own rule; the system detector understands both.
        let result = CaptureParser.parse("Plan party Christmas Eve 12/24/2026", options: options)
        #expect(result.dueDate?.webString == "2026-12-24")
        #expect(result.title == "Plan party Christmas Eve")
    }

    @Test func dataDetectorIgnoresTimesAndLooseWords() {
        var options = CaptureClock.options()
        options.usesDataDetector = true
        #expect(CaptureParser.parse("Call at 5pm", options: options).dueDate == nil)
        #expect(CaptureParser.parse("Call at 5pm", options: options).title == "Call at 5pm")
        #expect(CaptureParser.parse("Lunch the 30th", options: options).title == "Lunch the 30th")
    }
}
