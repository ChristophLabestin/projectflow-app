import Foundation
import PFData
import PFDesign
import PFModel

/// Focus transitions, mirroring `web/context/PinnedTasksContext.tsx`:
/// start pins the item and preserves `startedAt` when the same item resumes; snooze (60 min default),
/// block and clear update `users/{uid}.focusState`; complete finishes the item, unpins it and clears focus.
@MainActor
struct FocusController {
    let model: AppModel

    static func subtitle(for focus: FocusState, now: Date = .now) -> String {
        switch focus.status {
        case .active:
            guard let started = focus.startedAt?.instant else { return L10n.t("focus.running") }
            return L10n.t("focus.since", ["time": Formatting.time(started)])
        case .snoozed:
            guard let until = focus.snoozedUntil?.instant else { return L10n.t("focus.paused") }
            return L10n.t("focus.pausedUntil", ["time": Formatting.time(until)])
        case .blocked:
            return L10n.t("focus.blocked")
        }
    }

    var current: FocusState? { model.profile?.focus }

    func start(task: WorkTask) async {
        await start(PinnedItem(id: task.id, type: .task, title: task.title, projectId: task.projectId, tenantId: task.tenantId,
                               priority: task.priority?.rawValue))
    }

    func start(personal: PersonalTask) async {
        await start(PinnedItem(id: personal.id, type: .personalTask, title: personal.title, projectId: nil, tenantId: personal.tenantId,
                               priority: personal.priority?.rawValue))
    }

    func start(_ item: PinnedItem) async {
        guard let actions = model.focusActions else { return }
        let resumed = current?.itemId == item.id
        var focus = FocusState(itemId: item.id, itemType: item.type, title: item.title, projectId: item.projectId,
                               tenantId: item.tenantId, status: .active,
                               startedAt: resumed ? current?.startedAt : FlexDate(instant: .now),
                               lastAction: resumed ? .resumed : .started)
        focus.snoozedUntil = nil
        focus.blockedAt = nil
        PFHaptics.soft()
        await model.perform {
            try await actions.pin(item)
            try await actions.setFocus(focus)
        }
        LiveActivityBridge.shared.sync(focus: focus, model: model)
    }

    func resume() async {
        guard var focus = current, let actions = model.focusActions else { return }
        focus.status = .active
        focus.snoozedUntil = nil
        focus.blockedAt = nil
        focus.lastAction = .resumed
        await model.perform { try await actions.setFocus(focus) }
        LiveActivityBridge.shared.sync(focus: focus, model: model)
    }

    func snooze(minutes: Int = 60) async {
        guard var focus = current, let actions = model.focusActions else { return }
        focus.status = .snoozed
        focus.snoozedUntil = FlexDate(instant: .now.addingTimeInterval(TimeInterval(minutes * 60)))
        focus.blockedAt = nil
        focus.lastAction = .snoozed
        await model.perform { try await actions.setFocus(focus) }
        LocalReminders.scheduleFocusResume(title: focus.title, at: focus.snoozedUntil!.instant)
        LiveActivityBridge.shared.sync(focus: focus, model: model)
    }

    /// Marks the focus blocked and, for project tasks, the task itself (status Blocked + blocker note).
    func block(note: String?) async {
        guard var focus = current, let actions = model.focusActions else { return }
        focus.status = .blocked
        focus.blockedAt = FlexDate(instant: .now)
        focus.snoozedUntil = nil
        focus.lastAction = .blocked
        PFHaptics.warning()
        await model.perform {
            try await actions.setFocus(focus)
            if focus.itemType == .task, let ref = taskRef(focus) {
                try await model.actions?.setBlocked(ref, note: note)
            }
        }
        LiveActivityBridge.shared.sync(focus: focus, model: model)
    }

    /// Completes the focused item, unpins it and clears the focus. Returns the finished title.
    @discardableResult
    func complete() async -> String? {
        guard let focus = current, let focusActions = model.focusActions else { return nil }
        let ok = await model.perform {
            switch focus.itemType {
            case .task:
                if let ref = taskRef(focus) { try await model.actions?.setCompleted(ref, true) }
            case .personalTask:
                try await model.actions?.setPersonalCompleted(focus.itemId, true)
            default:
                break
            }
            try await focusActions.unpin(focus.itemId)
            try await focusActions.setFocus(nil)
        }
        LocalReminders.cancelFocusResume()
        LiveActivityBridge.shared.sync(focus: nil, model: model)
        if ok {
            model.toasts.show(PFToast(L10n.t("focus.completedToast", ["title": focus.title]), style: .success))
        }
        return ok ? focus.title : nil
    }

    func clear() async {
        guard let actions = model.focusActions else { return }
        await model.perform { try await actions.setFocus(nil) }
        LocalReminders.cancelFocusResume()
        LiveActivityBridge.shared.sync(focus: nil, model: model)
    }

    func taskRef(_ focus: FocusState) -> TaskRef? {
        guard let projectId = focus.projectId else { return nil }
        return TaskRef(tenantId: focus.tenantId ?? model.workspace?.tenantId ?? "", projectId: projectId, taskId: focus.itemId)
    }
}
