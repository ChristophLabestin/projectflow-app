import Foundation

// Optimistic edits of the shared snapshot. Widget buttons and Live Activity buttons apply them right
// away (so the widget reacts immediately) and the app replaces the snapshot with the real state as soon as
// the write has gone through.

public extension TodaySnapshot {
    /// The snapshot without the stop `id`; counts and the day band shrink like the in-app band does.
    func removingStop(id: String) -> TodaySnapshot {
        guard let stop = stops.first(where: { $0.id == id }) else { return self }
        var copy = self
        copy.stops.removeAll { $0.id == id }
        var bandKind: String?
        switch stop.severity {
        case "overdue": copy.overdueCount = max(overdueCount - 1, 0); bandKind = "overdue"
        case "due": copy.dueTodayCount = max(dueTodayCount - 1, 0); bandKind = "due"
        case "scheduled", "suggested", "blocked": bandKind = "waiting"
        default: break
        }
        if let bandKind, let index = copy.band.firstIndex(of: bandKind) {
            copy.band.remove(at: index)
        }
        if let focus, focus.itemId == id { copy.focus = nil }
        return copy
    }

    /// Focus paused until `date` (nil → resumed).
    func settingFocusPause(until date: Date?) -> TodaySnapshot {
        guard var current = focus else { return self }
        current = TodaySnapshot.Focus(itemId: current.itemId, itemType: current.itemType, title: current.title,
                                      projectName: current.projectName, nextStep: current.nextStep,
                                      status: date == nil ? "active" : "snoozed", startedAt: current.startedAt,
                                      tenantId: current.tenantId, projectId: current.projectId, snoozedUntil: date)
        var copy = self
        copy.focus = current
        return copy
    }

    var clearingFocus: TodaySnapshot {
        var copy = self
        copy.focus = nil
        return copy
    }

    /// Open items counted by the band (overdue + due today + waiting).
    var openCount: Int { band.filter { $0 != "free" }.count }
}

public extension SnapshotStore {
    /// Loads the snapshot, applies `transform` and saves it. No-op while signed out or without a snapshot.
    @discardableResult
    static func update(_ transform: (TodaySnapshot) -> TodaySnapshot) -> TodaySnapshot? {
        guard let current = load(), current.signedIn else { return nil }
        let next = transform(current)
        save(next)
        return next
    }

    // MARK: Actions queued by extension processes

    /// A write requested from a widget/control that could not run in the app process
    /// (the app drains the queue the next time it becomes active).
    struct PendingIntentAction: Codable, Hashable, Sendable, Identifiable {
        public enum Kind: String, Codable, Sendable { case completeTask, completeFocus, pauseFocus, resumeFocus }
        public let id: UUID
        public let kind: Kind
        public let tenantId: String?
        public let projectId: String?
        public let itemId: String?
        public let isPersonal: Bool
        public let createdAt: Date

        public init(kind: Kind, tenantId: String? = nil, projectId: String? = nil, itemId: String? = nil, isPersonal: Bool = false) {
            id = UUID(); self.kind = kind; self.tenantId = tenantId; self.projectId = projectId
            self.itemId = itemId; self.isPersonal = isPersonal; createdAt = .now
        }
    }

    private static var intentActionsURL: URL? { containerURL?.appendingPathComponent("pending-intent-actions.json") }

    static func pendingIntentActions() -> [PendingIntentAction] {
        guard let url = intentActionsURL, let data = try? Data(contentsOf: url) else { return [] }
        return (try? JSONDecoder.snapshot.decode([PendingIntentAction].self, from: data)) ?? []
    }

    static func queueIntentAction(_ action: PendingIntentAction) {
        guard let url = intentActionsURL else { return }
        let actions = pendingIntentActions() + [action]
        guard let data = try? JSONEncoder.snapshot.encode(actions) else { return }
        try? data.write(to: url, options: .atomic)
    }

    /// Returns the queued actions (newest 20, nothing older than a day) and empties the queue.
    static func drainIntentActions() -> [PendingIntentAction] {
        let actions = pendingIntentActions().filter { $0.createdAt > Date.now.addingTimeInterval(-86_400) }.suffix(20)
        guard let url = intentActionsURL else { return [] }
        try? FileManager.default.removeItem(at: url)
        return Array(actions)
    }
}
