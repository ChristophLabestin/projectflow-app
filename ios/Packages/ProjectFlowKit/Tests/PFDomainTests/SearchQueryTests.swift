import Foundation
import Testing
@testable import PFDomain

/// Loads `<repo>/shared/fixtures/<folder>/*.json` (override with `PF_FIXTURES_DIR`). Tests skip when the folder is missing.
private enum SearchFixtures {
    static var root: URL {
        if let override = ProcessInfo.processInfo.environment["PF_FIXTURES_DIR"], !override.isEmpty {
            return URL(fileURLWithPath: override)
        }
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<6 { url.deleteLastPathComponent() }
        return url.appendingPathComponent("shared/fixtures")
    }

    static func cases(_ folder: String) -> [(name: String, input: [String: Any], expected: [String: Any])] {
        let directory = root.appendingPathComponent(folder)
        let files = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return files.filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }.compactMap { url in
            guard let data = try? Data(contentsOf: url),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let input = json["input"] as? [String: Any], let expected = json["expected"] as? [String: Any] else { return nil }
            return (json["name"] as? String ?? url.lastPathComponent, input, expected)
        }
    }

    static func available(_ folder: String) -> Bool { !cases(folder).isEmpty }
}

@Suite("Search query grammar")
struct SearchQueryTests {
    @Test(.enabled(if: SearchFixtures.available("globalSearch")))
    func parserMatchesGoldenFixtures() {
        for fixture in SearchFixtures.cases("globalSearch") {
            let parsed = SearchQuery.parse(fixture.input["query"] as? String ?? "")
            #expect(parsed.raw == fixture.expected["raw"] as? String, "\(fixture.name): raw")
            #expect(parsed.prefixScope?.rawValue == fixture.expected["prefixScope"] as? String, "\(fixture.name): prefixScope")
            #expect(parsed.terms == fixture.expected["terms"] as? [String], "\(fixture.name): terms")
            #expect(parsed.taskFilters.map(\.rawValue) == fixture.expected["taskFilters"] as? [String], "\(fixture.name): taskFilters")
            #expect(parsed.priority?.rawValue == fixture.expected["priority"] as? String, "\(fixture.name): priority")
            #expect(parsed.hasTaskFilters == fixture.expected["hasTaskFilters"] as? Bool, "\(fixture.name): hasTaskFilters")
        }
    }

    @Test(.enabled(if: SearchFixtures.available("globalSearchScore")))
    func scoreMatchesGoldenFixtures() {
        for fixture in SearchFixtures.cases("globalSearchScore") {
            let score = SearchQuery.score(terms: fixture.input["terms"] as? [String] ?? [],
                                          title: fixture.input["title"] as? String ?? "",
                                          secondary: fixture.input["secondary"] as? [String] ?? [])
            #expect(score == (fixture.expected["score"] as? NSNumber)?.doubleValue, "\(fixture.name)")
        }
    }

    // MARK: Built-in checks (run without fixtures)

    @Test func prefixesSelectScopes() {
        #expect(SearchQuery.parse(">neu").prefixScope == .commands)
        #expect(SearchQuery.parse("#web").prefixScope == .projects)
        #expect(SearchQuery.parse("!fix").prefixScope == .tasks)
        #expect(SearchQuery.parse("?hilfe").prefixScope == .help)
        #expect(SearchQuery.parse("   #web").terms == ["web"])
        #expect(SearchQuery.parse("a #web").prefixScope == nil)
    }

    @Test func filtersAreRecognised() {
        let query = SearchQuery.parse("is:open IS:Overdue prio:high redirects")
        #expect(query.taskFilters == [.open, .overdue])
        #expect(query.priority == .high)
        #expect(query.terms == ["redirects"])
        #expect(query.hasTaskFilters)
        #expect(SearchQuery.parse("is:bogus").terms == ["is:bogus"])
        #expect(SearchQuery.parse("is:open:later").taskFilters == [.open])
        #expect(SearchQuery.parse("plain:colon").terms == ["plain:colon"])
    }

    @Test func diacriticsAndCaseAreIgnored() {
        #expect(SearchQuery.parse("Übersicht").terms == ["ubersicht"])
        #expect(SearchQuery.score(terms: ["ubersicht"], title: "Übersicht Q4") == 4)
    }

    @Test func scoringOrder() {
        #expect(SearchQuery.score(terms: ["web"], title: "Website") == 4)
        #expect(SearchQuery.score(terms: ["relaunch"], title: "Website Relaunch") == 3)
        #expect(SearchQuery.score(terms: ["site"], title: "Website") == 1.5)
        #expect(SearchQuery.score(terms: ["wbs"], title: "Website") == 0.5)
        #expect(SearchQuery.score(terms: ["zzz"], title: "Website") == 0)
        #expect(SearchQuery.score(terms: ["design"], title: "Kickoff", secondary: ["Design-Review"]) == 0.75)
        #expect(SearchQuery.score(terms: ["web", "zzz"], title: "Website") == 0)
        #expect(SearchQuery.score(terms: [], title: "Anything") == 1)
    }

    @Test func rankerOrdersByScoreAndKeepsTies() {
        let titles = ["Mobile Website", "Website Relaunch", "Webinar", "Kickoff"]
        let ranked = SearchRanker.rank(titles, terms: ["web"], title: { $0 })
        #expect(ranked == ["Website Relaunch", "Webinar", "Mobile Website"])
        let boosted = SearchRanker.rank(titles, terms: ["web"], title: { $0 }, bonus: { $0 == "Mobile Website" ? 5 : 0 })
        #expect(boosted.first == "Mobile Website")
        #expect(SearchRanker.rank(titles, terms: [], title: { $0 }) == titles)
        #expect(SearchRanker.rank(titles, terms: ["web"], title: { $0 }, limit: 1).count == 1)
    }

    @Test func highlightRangesAlignWithOriginalText() {
        let text = "Übersicht der Übersetzung"
        let ranges = SearchQuery.highlightRanges(in: text, terms: ["uber"])
        #expect(ranges.map { String(text[$0]) } == ["Über", "Über"])
        #expect(SearchQuery.highlightRanges(in: text, terms: ["zzz"]).isEmpty)
        #expect(SearchQuery.highlightRanges(in: "aaaa", terms: ["aa", "aaa"]).count == 1)
    }
}
