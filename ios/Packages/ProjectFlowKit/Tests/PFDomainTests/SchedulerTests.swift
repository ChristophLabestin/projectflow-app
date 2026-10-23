import Foundation
import Testing
import PFModel
@testable import PFDomain

/// Behaviour of `web/utils/scheduler.ts`. 2026-10-23 is a Friday.
@Suite("Scheduler")
struct SchedulerTests {
    let friday = "2026-10-23"

    private func item(_ id: String, day: String? = nil, _ priority: TaskPriority? = .medium, users: [String] = ["me"], done: Bool = false) -> SchedulerItem {
        SchedulerItem(id: id, title: id, isCompleted: done, day: day, priority: priority, assigneeIds: users)
    }

    @Test("an empty pool proposes nothing")
    func empty() {
        #expect(Scheduler.distribute(items: [], today: friday).isEmpty)
    }

    @Test("priority weights follow the web table")
    func weights() {
        #expect(Scheduler.weight(.urgent) == 4)
        #expect(Scheduler.weight(.high) == 3)
        #expect(Scheduler.weight(.medium) == 2)
        #expect(Scheduler.weight(.low) == 1)
        #expect(Scheduler.weight(nil) == 1)
    }

    @Test("completed tasks are ignored")
    func skipsCompleted() {
        #expect(Scheduler.distribute(items: [item("a", done: true)], today: friday).isEmpty)
    }

    @Test("a task already on its target day is not proposed again")
    func alreadyThere() {
        #expect(Scheduler.distribute(items: [item("a", day: friday)], today: friday).isEmpty)
    }

    @Test("capacity per day pushes the overflow to the next day")
    func capacity() {
        let items = (1...3).map { item("t\($0)", day: friday) }
        let result = Scheduler.distribute(items: items, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 2))
        // t1 and t2 stay on Friday, t3 moves to Monday (weekend skipped).
        #expect(result == [ProposedSchedule(taskId: "t3", newDay: "2026-10-26", originalDay: friday, reason: .optimized)])
    }

    @Test("weekends are skipped unless included")
    func weekends() {
        let saturday = "2026-10-24"
        let skip = Scheduler.distribute(items: [item("a", day: saturday)], today: saturday)
        #expect(skip.first?.newDay == "2026-10-26")
        let include = Scheduler.distribute(items: [item("a")], today: saturday,
                                           preferences: SchedulerPreferences(includeWeekends: true))
        #expect(include.first?.newDay == saturday)
    }

    @Test("overdue first, then priority, then earliest day")
    func ordering() {
        let items = [
            item("low-soon", day: "2026-10-23", .low),
            item("urgent-later", day: "2026-10-30", .urgent),
            item("overdue-low", day: "2026-10-20", .low),
            item("high", day: "2026-10-28", .high),
        ]
        let result = Scheduler.distribute(items: items, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 1))
        // Order of assignment: overdue-low (Fri), urgent-later (Mon), high (Tue), low-soon (Wed).
        let byId = Dictionary(uniqueKeysWithValues: result.map { ($0.taskId, $0) })
        #expect(byId["overdue-low"]?.newDay == friday)
        #expect(byId["overdue-low"]?.reason == .overdue)
        #expect(byId["urgent-later"]?.newDay == "2026-10-26")
        #expect(byId["high"]?.newDay == "2026-10-27")
        #expect(byId["low-soon"]?.newDay == "2026-10-28")
    }

    @Test("prioritizeOverdue off ranks purely by priority")
    func withoutOverduePriority() {
        let items = [item("overdue-low", day: "2026-10-20", .low), item("urgent", day: "2026-10-30", .urgent)]
        let result = Scheduler.distribute(items: items, today: friday,
                                          preferences: SchedulerPreferences(maxItemsPerDay: 1, prioritizeOverdue: false))
        #expect(result.first { $0.taskId == "urgent" }?.newDay == friday)
        #expect(result.first { $0.taskId == "overdue-low" }?.newDay == "2026-10-26")
    }

    @Test("undated tasks sort after dated ones of the same priority")
    func undatedLast() {
        let items = [item("none"), item("dated", day: "2026-10-27")]
        let result = Scheduler.distribute(items: items, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 1))
        #expect(result.first { $0.taskId == "dated" }?.newDay == friday)
        #expect(result.first { $0.taskId == "none" }?.newDay == "2026-10-26")
    }

    @Test("shared tasks need every assignee to have capacity")
    func sharedCapacity() {
        let items = [
            item("solo-me", day: friday, users: ["me"]),
            item("shared", day: friday, users: ["me", "you"]),
        ]
        let result = Scheduler.distribute(items: items, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 1))
        #expect(result == [ProposedSchedule(taskId: "shared", newDay: "2026-10-26", originalDay: friday, reason: .optimized)])
    }

    @Test("team tasks take capacity and are deduplicated by id")
    func teamTasks() {
        let mine = [item("mine", day: friday, users: ["me", "you"])]
        let team = [item("mine", day: friday, users: ["you"]), item("theirs", day: friday, users: ["you"])]
        let result = Scheduler.distribute(items: mine, teamItems: team, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 1))
        #expect(result.map(\.taskId) == ["theirs"])
        #expect(result.first?.newDay == "2026-10-26")
    }

    @Test("tasks without assignees are not capacity limited")
    func unassigned() {
        let items = (1...8).map { item("t\($0)", day: friday, users: []) }
        #expect(Scheduler.distribute(items: items, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 1)).isEmpty)
    }

    @Test("equal tasks keep their input order")
    func stable() {
        let items = [item("a"), item("b"), item("c")]
        let result = Scheduler.distribute(items: items, today: friday, preferences: SchedulerPreferences(maxItemsPerDay: 1))
        #expect(result.map(\.taskId) == ["a", "b", "c"])
        #expect(result.map(\.newDay) == [friday, "2026-10-26", "2026-10-27"])
    }
}
