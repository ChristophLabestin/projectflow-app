import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

// MARK: - Plan

/// "Dein Plan für heute": at most four stops as the shared task row, then "+ N weitere in Arbeit".
struct TodayPlanSection: View {
    let plan: DayPlan
    let now: Date

    @Environment(AppModel.self) private var model
    /// Stops that were completed a moment ago keep their (now green) row until the check has been seen.
    @State private var lingering: [LingeringStop] = []
    @State private var previousStops: [DayPlanStop] = []

    struct LingeringStop: Identifiable {
        let stop: DayPlanStop
        let index: Int
        var id: String { stop.id }
    }

    private var displayedStops: [DayPlanStop] {
        var list = plan.stops
        for ghost in lingering where !list.contains(where: { $0.id == ghost.id }) {
            list.insert(ghost.stop, at: min(ghost.index, list.count))
        }
        return list
    }

    private var isEvening: Bool { Formatting.calendar.component(.hour, from: now) >= 16 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PFSectionHeader(L10n.t(plan.isSuggested ? "dashboard.route.suggestTitle" : "dashboard.route.title"))
            if plan.isSuggested {
                Text(L10n.t("dashboard.route.suggestIntro"))
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMuted)
                    .padding(.bottom, PFSpace.xs)
            }
            if plan.stops.isEmpty {
                endOfDay
            } else {
                stopsCard
                if isEvening, !plan.isSuggested {
                    PFButton(L10n.t("today.endOfDay"), systemImage: "moon", kind: .ghost, size: .small) {
                        withAnimation(PFMotion.snappy) { model.router.todayMode = .dayClose }
                    }
                    .padding(.top, PFSpace.xs)
                }
            }
        }
        .onAppear { previousStops = plan.stops }
        .onChange(of: plan.stops) { old, new in trackCompletions(old: old, new: new) }
    }

    private var stopsCard: some View {
        PFRowCard {
            ForEach(displayedStops) { stop in
                TodayStopRow(stop: stop)
                    .transition(.asymmetric(insertion: .opacity, removal: .opacity.combined(with: .move(edge: .leading))))
            }
            if plan.moreCount > 0 { moreRow }
        }
        .animation(PFMotion.respecting(PFMotion.snappy), value: displayedStops.map(\.id))
    }

    private var moreRow: some View {
        Button {
            PFHaptics.selection()
            model.router.select(.work)
        } label: {
            HStack {
                Text(L10n.plural("today.more", plan.moreCount)).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                Spacer()
                Image(systemName: "arrow.right").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textMuted)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 48)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }

    /// Nothing is planned for today.
    private var endOfDay: some View {
        HStack(spacing: PFSpace.s) {
            PFGlyphBadge("moon.stars", tint: PFColor.textMuted, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(L10n.t("dashboard.route.end.title")).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                Text(L10n.t("dashboard.route.end.clear")).pfText(.meta).foregroundStyle(PFColor.textMuted)
            }
            Spacer()
            if plan.moreCount > 0 {
                Button { model.router.select(.work) } label: {
                    Text(L10n.plural("today.more", plan.moreCount)).pfText(.metaStrong).foregroundStyle(PFColor.textMain)
                }
                .buttonStyle(.pfPressable)
            }
        }
        .padding(PFSpace.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pfCard()
    }

    /// A stop that disappears because it was completed lingers for a beat, so the green check is seen
    /// before the row slides out (the band segment and the headline number react immediately).
    private func trackCompletions(old: [DayPlanStop], new: [DayPlanStop]) {
        let newIds = Set(new.map(\.id))
        for (index, stop) in old.enumerated() where !newIds.contains(stop.id) {
            guard let workspace = model.workspace, let item = TodayPlanner.item(for: stop, workspace: workspace), item.isCompleted else { continue }
            lingering.append(LingeringStop(stop: stop, index: index))
            let id = stop.id
            Task {
                try? await Task.sleep(for: .milliseconds(750))
                lingering.removeAll { $0.id == id }
            }
        }
        previousStops = new
    }
}

/// One stop of the plan.
struct TodayStopRow: View {
    let stop: DayPlanStop
    @Environment(AppModel.self) private var model

    var body: some View {
        if let workspace = model.workspace, let item = TodayPlanner.item(for: stop, workspace: workspace) {
            WorkItemRow(
                item: displayItem(item), showsProject: false, dashed: stop.proposed,
                subtitleOverride: TodayText.subtitle(stop), trailingAccessory: accessory(for: item)
            )
        } else {
            initiativeRow
        }
    }

    /// Follow-ups read "Nachhaken: Titel".
    private func displayItem(_ item: WorkItem) -> WorkItem {
        guard stop.kind == .followUp, case .task(var task) = item else { return item }
        task.title = TodayText.title(stop)
        return .task(task)
    }

    private func accessory(for item: WorkItem) -> AnyView? {
        if let focus = model.profile?.focus, focus.itemId == item.rawId, focus.status == .active, !item.isCompleted {
            return AnyView(PFPulseDot().frame(width: 28, height: 28).accessibilityLabel(L10n.t("today.inFocus")))
        }
        if stop.proposed {
            return AnyView(
                Button {
                    PFHaptics.tap()
                    Task { await WorkItemActions(model: model).planToday(item) }
                } label: {
                    Text(L10n.t("today.forToday")).pfText(.buttonSmall).foregroundStyle(PFColor.textMain)
                        .padding(.horizontal, 12).frame(minHeight: 32)
                        .background(PFColor.raised, in: .capsule)
                }
                .buttonStyle(.pfPressable)
            )
        }
        if stop.canFocus, !item.isCompleted {
            return AnyView(
                PFIconButton("scope", label: L10n.t("common.startFocus"), style: .raised, size: 32) {
                    Task { await WorkItemActions(model: model).startFocus(item) }
                }
            )
        }
        return nil
    }

    /// A focused initiative: not a task, so it gets a plain row.
    private var initiativeRow: some View {
        Button {
            if let projectId = stop.projectId {
                model.router.push(.initiative(tenantId: stop.tenantId ?? model.workspace?.tenantId ?? "", projectId: projectId, initiativeId: stop.taskId))
            }
        } label: {
            HStack(spacing: PFSpace.s) {
                PFPulseDot().frame(width: 28, height: 28)
                VStack(alignment: .leading, spacing: 3) {
                    Text(stop.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2)
                    Text(TodayText.subtitle(stop)).pfText(.meta).foregroundStyle(PFColor.textMuted).lineLimit(1)
                }
                Spacer()
            }
            .padding(PFSpace.m)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }
}

// MARK: - Waiting on me

/// "Wartet auf dich": people hanging on my open tasks, plus my own blocked tasks.
struct TodayWaitingSection: View {
    let plan: DayPlan
    @Environment(AppModel.self) private var model
    @State private var expanded = false

    private var visible: [DayPlanWaitingEntry] { expanded ? plan.waitingOnMe : Array(plan.waitingOnMe.prefix(3)) }

    var body: some View {
        if !plan.waitingOnMe.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                PFSectionHeader(L10n.t("dashboard.waiting.title")) { PFCountPill(plan.waitingOnMe.count) }
                PFRowCard {
                    ForEach(visible) { entry in TodayWaitingRow(entry: entry) }
                }
                if plan.waitingOnMe.count > 3 {
                    Button {
                        withAnimation(PFMotion.respecting(PFMotion.snappy)) { expanded.toggle() }
                    } label: {
                        Text(expanded ? L10n.t("today.waiting.showLess") : L10n.t("today.waiting.showAll", ["count": plan.waitingOnMe.count]))
                            .pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                            .padding(.top, PFSpace.xs).padding(.horizontal, 4).frame(minHeight: 36)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .animation(PFMotion.respecting(PFMotion.snappy), value: plan.waitingOnMe.map(\.id))
        }
    }
}

private struct TodayWaitingRow: View {
    let entry: DayPlanWaitingEntry
    @Environment(AppModel.self) private var model

    private var workspace: WorkspaceStore? { model.workspace }
    private var person: Person? { workspace?.person(entry.assigneeIds.first) }

    var body: some View {
        PFSwipeRow(trailing: swipeActions) {
            HStack(spacing: PFSpace.s) {
                leading
                VStack(alignment: .leading, spacing: 3) {
                    Text(entry.title).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2)
                    Text(subtitle).pfText(.meta).foregroundStyle(entry.kind == .blocked ? PFColor.dangerText : PFColor.textMuted).lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if entry.kind == .dependent {
                    PFButton(L10n.t("common.open"), kind: .secondary, size: .small) { open() }
                }
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, 12)
            .frame(minHeight: 60)
            .contentShape(.rect)
            .onTapGesture { open() }
        }
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var leading: some View {
        if entry.kind == .dependent, let person {
            PFAvatar(name: person.displayName, seed: person.id, imageURL: person.photoURL, size: 30)
        } else if entry.kind == .dependent {
            PFGlyphBadge("person.fill", tint: PFColor.textMuted, size: 30)
        } else {
            PFGlyphBadge("exclamationmark.octagon", tint: PFColor.danger, size: 30)
        }
    }

    private var subtitle: String {
        switch entry.kind {
        case .dependent:
            let text = L10n.t("dashboard.waiting.dependent", ["blocker": entry.blockerTitle ?? ""])
            guard let name = person?.displayName.split(separator: " ").first else { return text }
            return "\(name) \(text)"
        case .blocked:
            if let note = entry.note { return note }
            if let blocker = entry.blockerTitle { return L10n.t("dashboard.today.blockedRail.dependency", ["title": blocker]) }
            return L10n.t("dashboard.today.blockedRail.fallback")
        }
    }

    /// Swipe = "Mach ich heute": plan the task they are waiting on.
    private var swipeActions: [PFSwipeAction] {
        guard entry.kind == .dependent, let blockerId = entry.blockerTaskId, let task = workspace?.task(blockerId) else { return [] }
        return [PFSwipeAction(L10n.t("today.waiting.takeToday"), systemImage: "sun.max", tint: PFColor.primary, foreground: PFColor.onPrimary) {
            Task { await WorkItemActions(model: model).planToday(.task(task)) }
        }]
    }

    private func open() {
        guard let projectId = entry.projectId, let tenantId = workspace?.tenantId else { return }
        model.router.push(.task(TaskRef(tenantId: tenantId, projectId: projectId, taskId: entry.taskId)))
    }
}

// MARK: - Week

/// "Diese Woche": seven days with their load; a tap opens the week in Arbeit.
struct TodayWeekSection: View {
    let plan: DayPlan
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PFSectionHeader(L10n.t("dashboard.thisWeek.title"))
            PFWeekStrip(days: plan.week.days.map(strip)) { day in
                WorkNavigator.shared.openWeek(on: day.id)
                model.router.select(.work)
            }
            Text(TodayText.message(plan.week.badge))
                .pfText(.meta)
                .foregroundStyle(PFColor.textMuted)
                .padding(.top, PFSpace.xs)
                .padding(.horizontal, 4)
        }
    }

    private func strip(_ day: DayPlanWeekDay) -> PFWeekStrip.Day {
        let calendar = Formatting.calendar
        let symbols = calendar.veryShortWeekdaySymbols
        let number = Int(day.date.suffix(2)) ?? 0
        let longDate = DayString.longDate(day.date)
        return PFWeekStrip.Day(
            id: day.date, weekday: symbols[(day.weekday + 1) % 7], number: String(number), count: day.count,
            isToday: day.isToday, isWeekend: day.isWeekend,
            accessibilityLabel: L10n.plural("today.week.dayLabel", day.count, ["day": longDate])
        )
    }
}

// MARK: - Overnight

/// "Über Nacht": the last 24 hours — done, new, became overdue.
struct TodayNightSection: View {
    let plan: DayPlan
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PFSectionHeader(L10n.t("dashboard.night.title"))
            if plan.overnight.isEmpty {
                Text(L10n.t("dashboard.night.quiet"))
                    .pfText(.meta)
                    .foregroundStyle(PFColor.textMuted)
                    .padding(.horizontal, 4)
            } else {
                PFRowCard(dividerInset: 56) {
                    ForEach(plan.overnight.reversed()) { entry in row(entry) }
                }
            }
        }
    }

    private func row(_ entry: DayPlanNightEntry) -> some View {
        Button { open(entry) } label: {
            HStack(spacing: PFSpace.s) {
                glyph(entry)
                Text(text(entry)).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if entry.kind != .overdue {
                    Text(entry.time).pfText(.meta).foregroundStyle(PFColor.textMuted)
                }
            }
            .padding(.horizontal, PFSpace.m)
            .padding(.vertical, 12)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
    }

    @ViewBuilder private func glyph(_ entry: DayPlanNightEntry) -> some View {
        switch entry.kind {
        case .done: PFGlyphBadge("checkmark", tint: PFColor.success)
        case .new: PFGlyphBadge("plus", tint: PFColor.statusBase(.inProgress))
        case .overdue: PFGlyphBadge("exclamationmark", tint: PFColor.warning)
        }
    }

    private func text(_ entry: DayPlanNightEntry) -> String {
        switch entry.kind {
        case .done: L10n.t("today.night.done", ["title": entry.title])
        case .new: L10n.t("today.night.new", ["title": entry.title])
        case .overdue: L10n.t("dashboard.night.becameOverdue", ["title": entry.title])
        }
    }

    private func open(_ entry: DayPlanNightEntry) {
        guard let workspace = model.workspace else { return }
        if entry.key.contains("personal:") {
            model.router.push(.personalTask(tenantId: workspace.tenantId, id: entry.taskId))
        } else if let task = workspace.task(entry.taskId) {
            model.router.push(.task(task.ref))
        }
    }
}
