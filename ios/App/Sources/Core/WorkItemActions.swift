import SwiftUI
import PFData
import PFDesign
import PFModel

/// The shared swipe/peek grammar for any work item (concept §6). Every list uses these so that the
/// same gesture always does the same thing.
@MainActor
struct WorkItemActions {
    let model: AppModel

    // MARK: Mutations with undo

    func toggleComplete(_ item: WorkItem) async {
        let completing = !item.isCompleted
        await setCompleted(item, completing)
        if completing {
            model.toasts.show(PFToast(L10n.t("task.completedNamed", ["title": item.title]), style: .success,
                                      actionTitle: L10n.t("common.undo")) {
                Task { await setCompleted(item, false) }
            })
            if model.profile?.focus?.itemId == item.rawId { await FocusController(model: model).clear() }
        }
    }

    private func setCompleted(_ item: WorkItem, _ completed: Bool) async {
        guard let actions = model.actions else { return }
        await model.perform {
            switch item {
            case .task(let t): try await actions.setCompleted(t.ref, completed)
            case .personal(let p): try await actions.setPersonalCompleted(p.id, completed)
            }
        }
    }

    /// "Heute": sets the planned day (`scheduledDate`). Overdue items offer moving the due date too.
    func planToday(_ item: WorkItem) async {
        let today = Formatting.day(offset: 0)
        let previous = item.scheduledDate
        await setScheduled(item, today)
        let overdue = item.severity == .overdue
        model.toasts.show(PFToast(
            overdue ? L10n.t("task.plannedTodayOverdue") : L10n.t("task.scheduledToday"),
            actionTitle: overdue ? L10n.t("task.moveDueToo") : L10n.t("common.undo")
        ) {
            Task {
                if overdue { await setDue(item, today) } else { await setScheduled(item, previous) }
            }
        })
    }

    func setScheduled(_ item: WorkItem, _ date: FlexDate?) async {
        guard let actions = model.actions else { return }
        await model.perform {
            switch item {
            case .task(let t): try await actions.setScheduledDate(t.ref, date)
            case .personal(let p): try await actions.updatePersonalTask(p.id, ["scheduledDate": date?.webString])
            }
        }
    }

    func setDue(_ item: WorkItem, _ date: FlexDate?) async {
        guard let actions = model.actions else { return }
        await model.perform {
            switch item {
            case .task(let t): try await actions.setDueDate(t.ref, date)
            case .personal(let p): try await actions.updatePersonalTask(p.id, ["dueDate": date?.webString])
            }
        }
    }

    func setStatus(_ item: WorkItem, _ status: TaskStatus) async {
        guard let actions = model.actions else { return }
        PFHaptics.selection()
        await model.perform {
            switch item {
            case .task(let t): try await actions.setStatus(t.ref, status)
            case .personal(let p):
                try await actions.updatePersonalTask(p.id, ["status": status.rawValue, "isCompleted": status == .done])
            }
        }
    }

    func setPriority(_ item: WorkItem, _ priority: TaskPriority?) async {
        guard let actions = model.actions else { return }
        PFHaptics.selection()
        await model.perform {
            switch item {
            case .task(let t): try await actions.setPriority(t.ref, priority)
            case .personal(let p): try await actions.updatePersonalTask(p.id, ["priority": priority?.rawValue])
            }
        }
    }

    func startFocus(_ item: WorkItem) async {
        switch item {
        case .task(let t): await FocusController(model: model).start(task: t)
        case .personal(let p): await FocusController(model: model).start(personal: p)
        }
    }

    func togglePin(_ item: WorkItem) async {
        guard let actions = model.focusActions else { return }
        let pinned = model.profile?.pinnedItems.contains { $0.id == item.rawId } ?? false
        await model.perform {
            if pinned { try await actions.unpin(item.rawId) } else { try await actions.pin(item.pinned) }
        }
    }

    // MARK: Sheets

    /// "Später…": choose a day (sets the planned day; with edit rights the due date can move too).
    func presentLater(_ item: WorkItem) {
        model.presenter.present(detents: [.fit]) {
            LaterSheet(item: item)
        }
    }

    func presentStatus(_ item: WorkItem) {
        model.presenter.present(detents: [.fit]) {
            OptionSheet(title: L10n.t("common.status"), options: TaskStatus.workflow.map { status in
                OptionSheet.Option(id: status.rawValue, label: status.label, isSelected: status == item.status) {
                    PFPill(status.label, tone: .status(status.tone), compact: true)
                }
            }) { id in
                if let status = TaskStatus(rawValue: id) { Task { await setStatus(item, status) } }
            }
        }
    }

    func presentPriority(_ item: WorkItem) {
        model.presenter.present(detents: [.fit]) {
            OptionSheet(title: L10n.t("common.priority"), options: ([TaskPriority.urgent, .high, .medium, .low]).map { priority in
                OptionSheet.Option(id: priority.rawValue, label: priority.label, isSelected: priority == item.priority) {
                    PFPrioritySignal(priority)
                }
            }) { id in
                Task { await setPriority(item, TaskPriority(rawValue: id)) }
            }
        }
    }

    // MARK: Gesture + peek configuration

    var swipeComplete: (WorkItem) -> PFSwipeAction {
        { item in
            PFSwipeAction(item.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete"),
                          systemImage: item.isCompleted ? "arrow.uturn.backward" : "checkmark", tint: PFColor.success) {
                Task { await toggleComplete(item) }
            }
        }
    }

    func swipeTrailing(_ item: WorkItem) -> [PFSwipeAction] {
        [
            PFSwipeAction(L10n.t("common.today"), systemImage: "sun.max", tint: PFColor.primary, foreground: PFColor.onPrimary) {
                Task { await planToday(item) }
            },
            PFSwipeAction(L10n.t("common.later"), systemImage: "calendar", tint: PFColor.raised, foreground: PFColor.textMain) {
                presentLater(item)
            },
        ]
    }

    func peekActions(_ item: WorkItem) -> [PFPeekAction] {
        let pinned = model.profile?.pinnedItems.contains { $0.id == item.rawId } ?? false
        return [
            PFPeekAction(L10n.t("common.startFocus"), systemImage: "scope") { Task { await startFocus(item) } },
            PFPeekAction(item.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete"), systemImage: "checkmark.circle") {
                Task { await toggleComplete(item) }
            },
            PFPeekAction(L10n.t("common.status"), systemImage: "circle.dotted") { presentStatus(item) },
            PFPeekAction(L10n.t("common.priority"), systemImage: "chart.bar") { presentPriority(item) },
            PFPeekAction(L10n.t("common.later"), systemImage: "calendar") { presentLater(item) },
            PFPeekAction(pinned ? L10n.t("common.unpin") : L10n.t("common.pin"), systemImage: pinned ? "pin.slash" : "pin") {
                Task { await togglePin(item) }
            },
        ]
    }
}

/// Generic single-choice list in a custom sheet.
struct OptionSheet: View {
    struct Option: Identifiable {
        let id: String
        let label: String
        let isSelected: Bool
        let leading: AnyView

        init<Leading: View>(id: String, label: String, isSelected: Bool, @ViewBuilder leading: () -> Leading) {
            self.id = id
            self.label = label
            self.isSelected = isSelected
            self.leading = AnyView(leading())
        }
    }

    let title: String
    let options: [Option]
    let onSelect: (String) -> Void
    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFEyebrow(title).padding(.horizontal, PFSpace.page)
            VStack(spacing: 0) {
                ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                    if index > 0 { PFRowDivider() }
                    Button {
                        onSelect(option.id)
                        presenter.dismiss()
                    } label: {
                        HStack(spacing: PFSpace.s) {
                            option.leading.frame(minWidth: 24)
                            Text(option.label).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                            Spacer()
                            if option.isSelected {
                                Image(systemName: "checkmark").font(.system(size: 14, weight: .bold)).foregroundStyle(PFColor.textMain)
                            }
                        }
                        .padding(.horizontal, PFSpace.m)
                        .frame(minHeight: 52)
                        .contentShape(.rect)
                    }
                    .buttonStyle(.pfPressable)
                    .accessibilityAddTraits(option.isSelected ? [.isButton, .isSelected] : .isButton)
                }
            }
            .background(PFColor.raisedSoft, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .padding(.horizontal, PFSpace.m)
        }
        .padding(.bottom, PFSpace.l)
    }
}

/// "Später…" sheet: quick days + day strip. Sets the planned day; can also move the due date.
struct LaterSheet: View {
    let item: WorkItem
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var selection: Date?
    @State private var moveDue = false

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.m) {
            VStack(alignment: .leading, spacing: 4) {
                PFEyebrow(L10n.t("later.eyebrow"))
                Text(item.title).pfText(.section).foregroundStyle(PFColor.textMain).lineLimit(2)
            }
            .padding(.horizontal, PFSpace.page)
            PFDateStrip(quick: Formatting.quickDates.compactMap { quick in
                Formatting.date(quick.value).map { PFDateStrip.Quick(id: quick.id, label: quick.label, date: $0) }
            }, calendar: Formatting.calendar, locale: L10n.locale, selection: $selection)
            PFSwitch(L10n.t("later.moveDue"), isOn: $moveDue).padding(.horizontal, PFSpace.page)
            HStack(spacing: PFSpace.s) {
                PFButton(L10n.t("later.unplan"), kind: .ghost, fullWidth: true) {
                    Task { await WorkItemActions(model: model).setScheduled(item, nil) }
                    presenter.dismiss()
                }
                PFButton(L10n.t("common.save"), fullWidth: true) { save() }
                    .disabled(selection == nil)
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
        .onAppear { moveDue = item.severity == .overdue }
    }

    private func save() {
        guard let selection else { return }
        let day = FlexDate.day(of: selection, in: Formatting.timeZone)
        let actions = WorkItemActions(model: model)
        Task {
            await actions.setScheduled(item, day)
            if moveDue { await actions.setDue(item, day) }
            model.toasts.show(PFToast(L10n.t("task.moved", ["date": Formatting.shortDate(day)])))
        }
        presenter.dismiss()
    }
}
