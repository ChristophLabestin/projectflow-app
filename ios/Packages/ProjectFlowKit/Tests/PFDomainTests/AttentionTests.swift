import Foundation
import Testing
@testable import PFDomain

/// Runs the golden fixtures `shared/fixtures/attention/*.json` and `portfolioGroup/*.json` (the same files
/// Vitest runs for `web/utils/attention.ts`). Override the location with `PF_FIXTURES_DIR`; tests that need
/// the files are skipped when the folder is missing.
private enum AttentionFixtureFiles {
    static var root: URL? {
        if let override = ProcessInfo.processInfo.environment["PF_FIXTURES_DIR"], !override.isEmpty {
            return URL(fileURLWithPath: override, isDirectory: true)
        }
        // <repo>/ios/Packages/ProjectFlowKit/Tests/PFDomainTests/<this file>
        var url = URL(fileURLWithPath: #filePath)
        for _ in 0..<6 { url.deleteLastPathComponent() }
        return url.appendingPathComponent("shared/fixtures", isDirectory: true)
    }

    static func files(_ folder: String) -> [URL] {
        guard let root else { return [] }
        let directory = root.appendingPathComponent(folder, isDirectory: true)
        let urls = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        return urls.filter { $0.pathExtension == "json" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    static var attention: [URL] { files("attention") }
    static var portfolio: [URL] { files("portfolioGroup") }
}

private struct Fixture<Input: Decodable, Expected: Decodable>: Decodable {
    let name: String
    let input: Input
    let expected: Expected
}

@Suite("Attention")
struct AttentionTests {
    @Test("golden fixtures: buildAttention", .enabled(if: !AttentionFixtureFiles.attention.isEmpty))
    func attentionFixtures() throws {
        for url in AttentionFixtureFiles.attention {
            let fixture = try JSONDecoder().decode(Fixture<AttentionInput, AttentionResult>.self, from: Data(contentsOf: url))
            let actual = Attention.build(fixture.input)
            #expect(actual == fixture.expected, "\(url.lastPathComponent): \(fixture.name)")
        }
    }

    @Test("golden fixtures: classifyPortfolio", .enabled(if: !AttentionFixtureFiles.portfolio.isEmpty))
    func portfolioFixtures() throws {
        for url in AttentionFixtureFiles.portfolio {
            let fixture = try JSONDecoder().decode(Fixture<PortfolioInput, [PortfolioClassification]>.self, from: Data(contentsOf: url))
            let actual = Attention.classifyPortfolio(fixture.input)
            #expect(actual == fixture.expected, "\(url.lastPathComponent): \(fixture.name)")
        }
    }

    // MARK: Fixture-independent checks

    private let now = AttentionDate.text("2026-10-22T10:00:00.000Z")

    @Test func scoreCombinesOverdueBlockedAndHealth() {
        let input = AttentionInput(
            now: now, timeZone: "Europe/Berlin",
            projects: [AttentionProject(id: "p", title: "P", health: AttentionHealth(status: "critical", trend: "declining"))],
            tasks: [
                AttentionTask(id: "a", projectId: "p", dueDate: .text("2026-10-20"), createdAt: .text("2026-10-21T08:00:00Z")),
                AttentionTask(id: "b", projectId: "p", status: "Blocked", createdAt: .text("2026-10-21T08:00:00Z")),
            ])
        let result = Attention.build(input)
        // 3 (overdue) + 2 (blocked) + 6 (critical) + 3 (declining)
        #expect(result.entries.first?.score == 14)
        #expect(result.attention == ["p"])
        #expect(result.entries.first?.chips.map(\.key) == [.overdue, .blocked, .declining])
    }

    @Test func tiesKeepInputOrderAndAttentionIsCappedAtThree() {
        let projects = (1...5).map { AttentionProject(id: "p\($0)", title: "P\($0)") }
        let tasks = projects.map { AttentionTask(id: "t-\($0.id)", projectId: $0.id, dueDate: .text("2026-10-01"), createdAt: .text("2026-10-21T08:00:00Z")) }
        let result = Attention.build(AttentionInput(now: now, timeZone: "UTC", projects: projects, tasks: tasks))
        #expect(result.attention == ["p1", "p2", "p3"])
        #expect(result.quietCount == 2)
    }

    @Test func dateOnlyValuesAreDaysNotInstants() {
        let berlin = TimeZone(identifier: "Europe/Berlin")!
        let la = TimeZone(identifier: "America/Los_Angeles")!
        #expect(AttentionZone.toDay(.text("2026-10-22"), berlin) == "2026-10-22")
        #expect(AttentionZone.toDay(.text("2026-10-22"), la) == "2026-10-22")
        // 2026-10-22T23:30Z is already the 23rd in Berlin (CEST) but still the 22nd in Los Angeles.
        #expect(AttentionZone.toDay(.text("2026-10-22T23:30:00Z"), berlin) == "2026-10-23")
        #expect(AttentionZone.toDay(.text("2026-10-22T23:30:00Z"), la) == "2026-10-22")
        #expect(AttentionZone.daysBetween("2026-10-22", "2026-10-25") == 3)
        #expect(AttentionZone.addDays("2026-10-31", 1) == "2026-11-01")
    }

    @Test func wallClockTextUsesTheZone() {
        let berlin = TimeZone(identifier: "Europe/Berlin")!
        // 07:30 in Berlin on 22 Oct (CEST, UTC+2) is 05:30Z.
        let instant = AttentionZone.toInstant(.text("2026-10-22T07:30:00"), berlin)
        #expect(instant == AttentionZone.toInstant(.text("2026-10-22T05:30:00Z"), berlin))
    }

    @Test func portfolioGroupByStatusAndSignals() {
        func group(_ status: String, signals: PortfolioSignals? = nil, health: String? = nil, due: String? = nil) -> PortfolioGroup {
            Attention.portfolioGroup(status: status, dueDate: due.map(AttentionDate.text), signals: signals, healthStatus: health,
                                     clock: AttentionClock(now: .text("2026-10-22T10:00:00Z"), timeZone: "Europe/Berlin"))
        }
        #expect(group("Completed") == .closed)
        #expect(group("On Hold") == .paused)
        #expect(group("Brainstorming") == .planning)
        #expect(group("Active") == .active)
        #expect(group("Active", signals: PortfolioSignals(overdue: 1, blocked: 0)) == .attention)
        #expect(group("Review", health: "critical") == .attention)
        #expect(group("Active", due: "2026-10-21") == .attention)
        #expect(group("Active", due: "2026-10-22") == .active)
    }
}
