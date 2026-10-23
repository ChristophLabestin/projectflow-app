import Foundation
import Testing
@testable import PFDomain
import PFModel

@Suite("DayPlan golden fixtures")
struct DayPlanFixtureTests {
    @Test("fixtures directory is available", .enabled(if: Fixtures.exists("dayPlan")))
    func fixturesPresent() {
        #expect(!Fixtures.cases("dayPlan").isEmpty)
    }

    @Test("dayPlan fixture", .enabled(if: Fixtures.exists("dayPlan")), arguments: Fixtures.cases("dayPlan"))
    func fixture(_ file: FixtureCase) throws {
        let (name, input, expected) = try file.decode(DayPlanInput.self, DayPlan.self)
        let actual = buildDayPlan(input)
        let diffs = differingFields(actual, expected)
        #expect(diffs.isEmpty, "\(file.testDescription) — \(name)\n\(diffs.joined(separator: "\n"))")
        #expect(actual == expected)

        let known = Set(Mirror(reflecting: actual).children.compactMap(\.label))
        let unknown = try file.expectedKeys().subtracting(known)
        #expect(unknown.isEmpty, "expected contains keys the Swift DayPlan does not model: \(unknown)")
    }
}

@Suite("DayPlan behaviour")
struct DayPlanBehaviourTests {
    private let now = DateLike.string("2026-10-22T10:00:00.000Z")

    private func plan(tasks: [DayPlanTask], personal: [DayPlanTask] = [], focus: DayPlanFocus? = nil) -> DayPlan {
        buildDayPlan(DayPlanInput(
            now: now, timeZone: "Europe/Berlin", projects: [DayPlanProject(id: "p", title: "Website")],
            tasks: tasks, personalTasks: personal, focus: focus
        ))
    }

    @Test func capsStopsAtFourAndCountsTheRest() {
        let tasks = (1...6).map { DayPlanTask(id: "t\($0)", title: "Task \($0)", projectId: "p", dueDate: .string("2026-10-1\($0)")) }
        let result = plan(tasks: tasks)
        #expect(result.stops.count == DayPlanLimits.maxStops)
        #expect(result.moreCount == 2)
        #expect(result.statement.key == "dashboard.route.statement.behind")
        #expect(result.statement.value == "4")
        #expect(result.stops.first?.reason.params["days"] == .int(11))
    }

    @Test func isCompletedWinsOverStatus() {
        let done = DayPlanTask(id: "a", title: "Done but open status", projectId: "p", status: "Open", isCompleted: true, dueDate: .string("2026-10-22"))
        let open = DayPlanTask(id: "b", title: "Done status, not completed", projectId: "p", status: "Done", isCompleted: false, dueDate: .string("2026-10-22"))
        let result = plan(tasks: [done, open])
        #expect(result.stops.map(\.taskId) == ["b"])
    }

    @Test func personalTasksAreNamespaced() {
        let project = DayPlanTask(id: "same", title: "Project", projectId: "p", dueDate: .string("2026-10-22"))
        let personal = DayPlanTask(id: "same", title: "Personal", dueDate: .string("2026-10-22"))
        let result = plan(tasks: [project], personal: [personal])
        #expect(result.stops.map(\.id) == ["same", "personal:same"])
        #expect(result.stops.last?.isPersonal == true)
        #expect(result.stops.last?.canFocus == false)
    }

    @Test func snoozedFocusIsIgnoredUntilExpired() {
        let task = DayPlanTask(id: "f", title: "Focus", projectId: "p", nextStep: "Do it")
        let snoozed = DayPlanFocus(id: "f", type: "task", title: "Focus", projectId: "p", status: "snoozed", snoozedUntil: .string("2026-10-22T11:00:00Z"))
        let expired = DayPlanFocus(id: "f", type: "task", title: "Focus", projectId: "p", status: "snoozed", snoozedUntil: .string("2026-10-22T09:00:00Z"))
        #expect(plan(tasks: [task], focus: snoozed).stops.first?.kind != .focus)
        let leading = plan(tasks: [task], focus: expired).stops.first
        #expect(leading?.kind == .focus)
        #expect(leading?.reason.key == "dashboard.today.reason.focusNext")
    }
}

@Suite("ZonedDate")
struct ZonedDateTests {
    private let berlin = TimeZone(identifier: "Europe/Berlin")!
    private let losAngeles = TimeZone(identifier: "America/Los_Angeles")!

    @Test func dateOnlyIsADayNotAnInstant() {
        #expect(ZonedDate.toDay(.string("2026-10-22"), in: berlin) == "2026-10-22")
        #expect(ZonedDate.toDay(.string("2026-10-22"), in: losAngeles) == "2026-10-22")
    }

    @Test func instantsReadTheWallClockOfTheZone() {
        let late = DateLike.string("2026-10-22T23:30:00Z")
        #expect(ZonedDate.toDay(late, in: berlin) == "2026-10-23")
        #expect(ZonedDate.toDay(late, in: losAngeles) == "2026-10-22")
        #expect(ZonedDate.clockLabel(ZonedDate.toInstant(late, in: berlin)!, in: berlin) == "01:30")
    }

    @Test func offsetLessDateTimeIsWallClockInTheZone() {
        // 07:30 Berlin in October (CEST, +02:00) is 05:30Z.
        #expect(ZonedDate.toInstant(.string("2026-10-22T07:30:00"), in: berlin) == ZonedDate.toInstant(.string("2026-10-22T05:30:00Z"), in: berlin))
    }

    @Test func timestampIgnoresNanoseconds() {
        #expect(ZonedDate.toInstant(.timestamp(seconds: 1_792_663_200), in: berlin) == 1_792_663_200_000)
    }

    @Test func dayArithmetic() {
        #expect(ZonedDate.addDays("2026-10-31", 1) == "2026-11-01")
        #expect(ZonedDate.addDays("2026-03-01", -1) == "2026-02-28")
        #expect(ZonedDate.daysBetween("2026-10-22", "2026-10-25") == 3)
        #expect(ZonedDate.weekdayIndex("2026-10-22") == 3)   // Thursday
        #expect(ZonedDate.weekdayIndex("2026-10-26") == 0)   // Monday
    }

    @Test func dstDayHas25Hours() {
        let start = ZonedDate.startOfDay("2026-10-25", in: berlin)
        let next = ZonedDate.startOfDay("2026-10-26", in: berlin)
        #expect((next - start) / 3_600_000 == 25)
    }

    @Test func truthinessMirrorsJavaScript() {
        #expect(!DateLike.none.isTruthy)
        #expect(!DateLike.string("").isTruthy)
        #expect(DateLike.string("tomorrow-ish").isTruthy)
        #expect(!DateLike.number(0).isTruthy)
    }

    @Test func flexDateBridge() {
        let day = FlexDate.dateOnly(year: 2026, month: 10, day: 22)
        #expect(DateLike(day) == .string("2026-10-22"))
        #expect(DateLike(nil as FlexDate?) == .none)
    }
}
