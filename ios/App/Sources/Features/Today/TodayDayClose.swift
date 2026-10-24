import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Tagesabschluss (`/?mode=close`, day_close push): per open stop three ways to let go of it —
/// plan it for tomorrow, move its due date (project tasks), or take it out of today's plan.
/// Everything is undoable via the toast.
struct TodayDayClose: View {
    let plan: DayPlan
    let now: Date

    @Environment(AppModel.self) private var model
    /// The stops as they were when the day was closed, so rows stay put while they are being handled.
    @State private var frozen: [DayPlanStop] = []
    @State private var handled: [String: Handled] = [:]

    enum Handled { case tomorrow, due, unplanned }

    private var rows: [DayPlanStop] { frozen.isEmpty ? plan.stops.filter { !$0.proposed } : frozen }

    private func isDone(_ stop: DayPlanStop) -> Bool {
        guard let workspace = model.workspace, let item = TodayPlanner.item(for: stop, workspace: workspace) else { return false }
        return item.isCompleted
    }

    private var doneToday: Int {
        guard let workspace = model.workspace else { return 0 }
        let zone = Formatting.timeZone
        func isToday(_ date: FlexDate?) -> Bool {
            guard let date else { return false }
            return ZonedDate.toDay(DateLike(date), in: zone) == plan.today
        }
        return workspace.myTasks.filter { $0.isCompleted && isToday($0.completedAt) }.count
            + workspace.personalTasks.filter { $0.isCompleted && isToday($0.completedAt) }.count
    }

    var body: some View {
        let done = doneToday
        let total = done + rows.filter { !isDone($0) }.count
        VStack(alignment: .leading, spacing: 0) {
            TodayDateRow(now: now).pfAppear(0)
            Text(L10n.t("today.close.title"))
                .pfText(.display).foregroundStyle(PFColor.textMain)
                .padding(.top, 10).pfAppear(1)
            summary(done: done, total: total).padding(.top, PFSpace.s).pfAppear(2)
            PFProgressBar(value: total == 0 ? 1 : Double(done) / Double(total), height: 8).padding(.top, PFSpace.m).pfAppear(3)

            if rows.allSatisfy({ isDone($0) || handled[$0.id] != nil }) {
                allClear.padding(.top, PFSpace.xl).pfAppear(4)
            }
            if !rows.isEmpty {
                VStack(spacing: PFSpace.s) {
                    ForEach(rows) { stop in closeCard(stop) }
                }
                .padding(.top, PFSpace.xl)
                .pfAppear(4)
            }

            PFButton(L10n.t("today.close.done"), kind: .primary, size: .large, fullWidth: true) {
                PFHaptics.success()
                withAnimation(PFMotion.snappy) { model.router.todayMode = .normal }
            }
            .padding(.top, PFSpace.xl)
            .pfAppear(5)
        }
        .onAppear { if frozen.isEmpty { frozen = plan.stops.filter { !$0.proposed } } }
    }

    @ViewBuilder private func summary(done: Int, total: Int) -> some View {
        if done == 0 {
            Text(L10n.t("today.close.summary.none")).pfText(.body).foregroundStyle(PFColor.textMuted)
        } else {
            let text = L10n.t("today.close.summary", ["done": "\u{1}", "total": total])
            let parts = text.components(separatedBy: "\u{1}")
            PFEditorialHeadline(before: parts.first ?? "", value: String(done), after: parts.dropFirst().joined(), style: .section)
        }
    }

    private var allClear: some View {
        PFEmptyState(systemImage: "moon.stars", title: L10n.t("today.close.allClear"), message: L10n.t("today.close.allClearMessage"))
    }

    // MARK: Cards

    @ViewBuilder private func closeCard(_ stop: DayPlanStop) -> some View {
        if let workspace = model.workspace, let item = TodayPlanner.item(for: stop, workspace: workspace) {
            let done = item.isCompleted
            let state = handled[stop.id]
            PFRowCard {
                WorkItemRow(item: item, showsProject: false, subtitleOverride: TodayText.subtitle(stop))
                if !done {
                    if let state {
                        handledLabel(state)
                    } else {
                        actions(for: item, stop: stop)
                    }
                }
            }
            .opacity(done || state != nil ? 0.62 : 1)
            .animation(PFMotion.respecting(PFMotion.snappy), value: state == nil)
        }
    }

    private func actions(for item: WorkItem, stop: DayPlanStop) -> some View {
        ScrollView(.horizontal) {
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("today.close.tomorrow"), systemImage: "sunrise", kind: .secondary, size: .small) { planTomorrow(item, key: stop.id) }
                if item.task != nil {
                    PFButton(L10n.t("today.close.moveDue"), systemImage: "calendar.badge.clock", kind: .secondary, size: .small) { moveDue(item, key: stop.id) }
                }
                if item.scheduledDate != nil {
                    PFButton(L10n.t("today.close.unplan"), systemImage: "minus.circle", kind: .ghost, size: .small) { unplan(item, key: stop.id) }
                }
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, PFSpace.xs)
        }
        .scrollIndicators(.hidden)
    }

    private func handledLabel(_ state: Handled) -> some View {
        let key: String = switch state {
        case .tomorrow: "today.close.toastTomorrow"
        case .due: "today.close.toastDue"
        case .unplanned: "today.close.toastUnplanned"
        }
        return HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(PFColor.success)
            Text(L10n.t(key)).pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
            Spacer()
        }
        .padding(PFSpace.m)
    }

    // MARK: Actions (with undo)

    private func planTomorrow(_ item: WorkItem, key: String) {
        let actions = WorkItemActions(model: model)
        let previous = item.scheduledDate
        PFHaptics.selection()
        Task { await actions.setScheduled(item, Formatting.day(offset: 1)) }
        withAnimation(PFMotion.snappy) { handled[key] = .tomorrow }
        model.toasts.show(PFToast(L10n.t("today.close.toastTomorrow"), actionTitle: L10n.t("common.undo")) {
            Task { await actions.setScheduled(item, previous) }
            withAnimation(PFMotion.snappy) { handled[key] = nil }
        })
    }

    private func moveDue(_ item: WorkItem, key: String) {
        let actions = WorkItemActions(model: model)
        let previous = item.dueDate
        PFHaptics.selection()
        Task { await actions.setDue(item, Formatting.day(offset: 1)) }
        withAnimation(PFMotion.snappy) { handled[key] = .due }
        model.toasts.show(PFToast(L10n.t("today.close.toastDue"), actionTitle: L10n.t("common.undo")) {
            Task { await actions.setDue(item, previous) }
            withAnimation(PFMotion.snappy) { handled[key] = nil }
        })
    }

    private func unplan(_ item: WorkItem, key: String) {
        let actions = WorkItemActions(model: model)
        let previous = item.scheduledDate
        PFHaptics.selection()
        Task { await actions.setScheduled(item, nil) }
        withAnimation(PFMotion.snappy) { handled[key] = .unplanned }
        model.toasts.show(PFToast(L10n.t("today.close.toastUnplanned"), actionTitle: L10n.t("common.undo")) {
            Task { await actions.setScheduled(item, previous) }
            withAnimation(PFMotion.snappy) { handled[key] = nil }
        })
    }
}
