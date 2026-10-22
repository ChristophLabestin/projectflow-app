import Foundation
import Testing
@testable import PFDomain

/// Output shape of the `dueBuckets` fixtures (see `shared/fixtures/README.md`).
struct DueBucketsOutput: Decodable, Equatable {
    struct Item: Decodable, Equatable { var id: String; var status: String }
    struct Group: Decodable, Equatable { var key: String; var tasks: [Item] }
    var groups: [Group]
    var summary: DueSummary

    /// Adapter mirroring `web/utils/fixtureRunners.ts`.
    static func run(_ input: DueBucketsInput) -> DueBucketsOutput {
        let context = DueContext(now: input.now, timeZone: input.timeZone)
        let groups = DueBuckets.group(input.tasks, context: context).map { group in
            Group(key: group.key.rawValue, tasks: group.tasks.map { Item(id: $0.id, status: DueBuckets.normalizeStatus($0)) })
        }
        return DueBucketsOutput(groups: groups, summary: DueBuckets.summarize(input.tasks, context: context))
    }
}

struct DueBucketsInput: Decodable {
    var now: DateLike
    var timeZone: String?
    var tasks: [DueBucketFixtureTask]

    private enum CodingKeys: String, CodingKey { case now, timeZone, tasks }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        now = try c.decodeIfPresent(DateLike.self, forKey: .now) ?? .none
        timeZone = try c.decodeIfPresent(String.self, forKey: .timeZone)
        tasks = try c.decodeIfPresent([DueBucketFixtureTask].self, forKey: .tasks) ?? []
    }
}

@Suite("DueBuckets golden fixtures")
struct DueBucketsFixtureTests {
    @Test("fixtures directory is available", .enabled(if: Fixtures.exists("dueBuckets")))
    func fixturesPresent() {
        #expect(!Fixtures.cases("dueBuckets").isEmpty)
    }

    @Test("dueBuckets fixture", .enabled(if: Fixtures.exists("dueBuckets")), arguments: Fixtures.cases("dueBuckets"))
    func fixture(_ file: FixtureCase) throws {
        let (name, input, expected) = try file.decode(DueBucketsInput.self, DueBucketsOutput.self)
        let actual = DueBucketsOutput.run(input)
        #expect(actual == expected, "\(file.testDescription) — \(name)\nactual: \(actual)\nexpected: \(expected)")
    }
}

@Suite("DueBuckets behaviour")
struct DueBucketsBehaviourTests {
    private let context = DueContext(now: .string("2026-10-22T10:00:00.000Z"), timeZone: "Europe/Berlin")

    @Test func bucketBoundaries() {
        #expect(DueBuckets.bucket(for: .string("2026-10-21"), context: context) == .overdue)
        #expect(DueBuckets.bucket(for: .string("2026-10-22"), context: context) == .today)
        #expect(DueBuckets.bucket(for: .string("2026-10-29"), context: context) == .week)
        #expect(DueBuckets.bucket(for: .string("2026-10-30"), context: context) == .later)
        #expect(DueBuckets.bucket(for: .none, context: context) == .undated)
    }
}
