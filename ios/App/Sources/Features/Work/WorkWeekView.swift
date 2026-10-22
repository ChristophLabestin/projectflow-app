import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Woche: seven days (today first) with what is planned on them, and the "Ungeplant" tray on top.
/// Press and hold a task, drag it onto a day to plan it (it snaps with a haptic tick), drop it on
/// the tray to take it out of the plan again. No `List`: a plain scroll view and a custom drag.
struct WorkWeekView<Header: View>: View {
    let items: [WorkItem]
    let now: Date
    @Binding var scrollOffset: CGFloat
    @ViewBuilder let header: Header

    @Environment(AppModel.self) private var model
    private let nav = WorkNavigator.shared

    @State private var coordinator = PFDragCoordinator()
    @State private var weekOffset = 0
    @State private var trayExpanded = true
    @State private var trayShowsAll = false
    @State private var position = ScrollPosition(edge: .top)
    @State private var scrollY: CGFloat = 0
    @State private var size: CGSize = .zero

    private let space = "pf.work.week"
    private let trayId = "tray"

    // MARK: Model

    private var zone: TimeZone { Formatting.timeZone }
    private var today: String { ZonedDate.toDay(DateLike(now), in: zone) ?? "" }

    private var windowDays: [String] {
        let start = ZonedDate.addDays(today, weekOffset * 7)
        return (0..<7).map { ZonedDate.addDays(start, $0) }
    }

    /// The day an item sits on: planned day, else due day.
    private func placement(_ item: WorkItem) -> String? {
        let scheduled = DateLike(item.scheduledDate)
        return ZonedDate.toDay(scheduled.isTruthy ? scheduled : DateLike(item.dueDate), in: zone)
    }

    private func sorted(_ list: [WorkItem]) -> [WorkItem] {
        list.enumerated().sorted { lhs, rhs in
            let order = DueBuckets.compareWork(lhs.element, rhs.element, zone: zone, locale: L10n.locale)
            return order < 0 || (order == 0 && lhs.offset < rhs.offset)
        }.map(\.element)
    }

    private var byDay: [String: [WorkItem]] {
        var result: [String: [WorkItem]] = [:]
        for item in items {
            if let day = placement(item) { result[day, default: []].append(item) }
        }
        return result.mapValues(sorted)
    }

    /// Open work without a day (or whose day has passed): what still needs a place.
    private var tray: [WorkItem] {
        sorted(items.filter { item in
            guard !item.isCompleted else { return false }
            guard let day = placement(item) else { return true }
            return ZonedDate.daysBetween(today, day) < 0
        })
    }

    // MARK: Body

    var body: some View {
        let grouped = byDay
        let trayItems = tray
        ZStack(alignment: .top) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    weekNavigator.padding(.horizontal, PFSpace.page).padding(.top, PFSpace.l)
                    trayView(trayItems)
                    ForEach(windowDays, id: \.self) { day in dayView(day, items: grouped[day] ?? []) }
                }
                .scrollTargetLayout()
                .padding(.bottom, 160)
            }
            .scrollIndicators(.hidden)
            .scrollPosition($position)
            .scrollDisabled(coordinator.isDragging)
            .pfScrollOffset { scrollY = $0; scrollOffset = $0 }
        }
        .coordinateSpace(name: space)
        .overlay {
            PFDragGhost(coordinator: coordinator) { payload in
                if let id = payload.base as? String, let item = items.first(where: { $0.id == id }) {
                    WeekRowContent(item: item, onToggle: nil)
                }
            }
        }
        .onGeometryChange(for: CGSize.self) { $0.size } action: { size = $0 }
        .task(id: coordinator.isDragging) { await autoScroll() }
        .task(id: nav.requestToken) { await jumpToRequestedDay() }
        .animation(PFMotion.respecting(PFMotion.snappy), value: grouped.mapValues { $0.map(\.id) })
    }

    // MARK: Week navigation

    private var weekNavigator: some View {
        let days = windowDays
        return HStack(spacing: PFSpace.xs) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(DayString.shortDate(days[0])) – \(DayString.shortDate(days[6]))")
                    .pfText(.section).foregroundStyle(PFColor.textMain)
                Text(L10n.t("work.week.hint")).pfText(.meta).foregroundStyle(PFColor.textMuted).fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: PFSpace.s)
            PFIconButton("chevron.left", label: L10n.t("work.week.previous"), style: .raised, size: 40) {
                withAnimation(PFMotion.snappy) { weekOffset = max(0, weekOffset - 1) }
            }
            .opacity(weekOffset == 0 ? 0.35 : 1)
            .disabled(weekOffset == 0)
            PFIconButton("chevron.right", label: L10n.t("work.week.next"), style: .raised, size: 40) {
                withAnimation(PFMotion.snappy) { weekOffset += 1 }
            }
        }
    }

    // MARK: Tray

    private func trayView(_ list: [WorkItem]) -> some View {
        let hovered = coordinator.hoverTarget == AnyHashable(trayId)
        let visible = trayShowsAll ? list : Array(list.prefix(4))
        return VStack(alignment: .leading, spacing: 0) {
            GroupHeader(title: L10n.t("work.week.unplanned"), color: PFColor.textMuted, count: list.count,
                        collapsed: !trayExpanded) {
                withAnimation(PFMotion.respecting(PFMotion.snappy)) { trayExpanded.toggle() }
            }
            if trayExpanded {
                if list.isEmpty {
                    Text(L10n.t("work.week.unplanned.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.vertical, PFSpace.xs)
                } else {
                    PFRowCard {
                        ForEach(visible) { item in weekRow(item) }
                        if list.count > 4 {
                            Button {
                                withAnimation(PFMotion.respecting(PFMotion.snappy)) { trayShowsAll.toggle() }
                            } label: {
                                Text(trayShowsAll ? L10n.t("work.week.less") : L10n.t("work.week.more", ["count": list.count - 4]))
                                    .pfText(.metaStrong).foregroundStyle(PFColor.textMuted)
                                    .frame(maxWidth: .infinity, minHeight: 44)
                                    .contentShape(.rect)
                            }
                            .buttonStyle(.pfPressable)
                        }
                    }
                }
                if hovered && coordinator.isDragging {
                    Text(L10n.t("work.week.dropHint.tray")).pfText(.metaStrong).foregroundStyle(PFColor.textMain).padding(.top, 6)
                }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .modifier(DropHighlight(isHovered: hovered && coordinator.isDragging))
        .pfDropTarget(trayId, coordinator: coordinator, space: space)
    }

    // MARK: Days

    private func dayView(_ day: String, items dayItems: [WorkItem]) -> some View {
        let isToday = day == today
        let hovered = coordinator.hoverTarget == AnyHashable(day) && coordinator.isDragging
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(dayTitle(day)).pfText(.section).foregroundStyle(PFColor.textMain)
                Text(DayString.shortDate(day)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                Spacer()
                if !dayItems.isEmpty { PFCountPill(dayItems.count, tint: isToday ? PFColor.primary : nil) }
            }
            .padding(.top, PFSpace.l)
            .padding(.bottom, PFSpace.xs)
            .accessibilityAddTraits(.isHeader)

            if dayItems.isEmpty {
                emptyDay(hovered: hovered)
            } else {
                PFRowCard { ForEach(dayItems) { item in weekRow(item) } }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .modifier(DropHighlight(isHovered: hovered))
        .pfDropTarget(day, coordinator: coordinator, space: space)
        .id(day)
    }

    private func emptyDay(hovered: Bool) -> some View {
        Text(coordinator.isDragging ? L10n.t("work.week.dropHint") : L10n.t("work.week.empty"))
            .pfText(.meta)
            .foregroundStyle(hovered ? PFColor.textMain : PFColor.textMuted)
            .frame(maxWidth: .infinity, minHeight: 60)
            .background {
                RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous)
                    .strokeBorder(PFColor.hairlineStrong, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
    }

    private func dayTitle(_ day: String) -> String {
        let offset = ZonedDate.daysBetween(today, day)
        switch offset {
        case 0: return L10n.t("common.today")
        case 1: return L10n.t("common.tomorrow")
        default: return DayString.weekdayName(day)
        }
    }

    // MARK: Rows and drag

    @ViewBuilder private func weekRow(_ item: WorkItem) -> some View {
        let row = WeekRowContent(item: item) { Task { await WorkItemActions(model: model).toggleComplete(item) } }
            .contentShape(.rect)
            .onTapGesture { model.router.push(item.route) }
        if item.isCompleted {
            row
        } else {
            row.pfDragSource(AnyHashable(item.id), coordinator: coordinator, space: space, onRelease: { peek(item) }) { target in
                drop(item, on: target?.base as? String)
            }
        }
    }

    private func peek(_ item: WorkItem) {
        let actions = WorkItemActions(model: model)
        model.presenter.showPeek(actions: actions.peekActions(item)) { WorkItemPeek(item: item) }
    }

    private func drop(_ item: WorkItem, on target: String?) {
        guard let target else { return }
        if target == trayId { unplan(item) } else { plan(item, on: target) }
    }

    private func plan(_ item: WorkItem, on day: String) {
        guard let date = DayString.flexDate(day) else { return }
        let alreadyThere = item.scheduledDate != nil && placement(item) == day
        guard !alreadyThere else { return }
        let actions = WorkItemActions(model: model)
        let previous = item.scheduledDate
        PFHaptics.success()
        Task { await actions.setScheduled(item, date) }
        let label = DayString.longDate(day)
        if item.severity == .overdue {
            model.toasts.show(PFToast(L10n.t("work.planned.overdue", ["date": label]), actionTitle: L10n.t("work.planned.moveDue")) {
                Task { await actions.setDue(item, date) }
            })
        } else {
            model.toasts.show(PFToast(L10n.t("work.planned", ["date": label]), actionTitle: L10n.t("common.undo")) {
                Task { await actions.setScheduled(item, previous) }
            })
        }
    }

    private func unplan(_ item: WorkItem) {
        guard item.scheduledDate != nil else { return }
        let actions = WorkItemActions(model: model)
        let previous = item.scheduledDate
        PFHaptics.success()
        Task { await actions.setScheduled(item, nil) }
        model.toasts.show(PFToast(L10n.t("work.unplanned"), actionTitle: L10n.t("common.undo")) {
            Task { await actions.setScheduled(item, previous) }
        })
    }

    // MARK: Scrolling

    /// While a task is lifted and the finger nears the top or bottom edge, the week scrolls.
    private func autoScroll() async {
        guard coordinator.isDragging else { return }
        while coordinator.isDragging, !Task.isCancelled {
            let step = coordinator.edgeScroll(viewportTop: 110, viewportBottom: size.height - 130)
            if step != 0 { position.scrollTo(y: max(0, scrollY + step)) }
            try? await Task.sleep(for: .milliseconds(16))
        }
    }

    /// Today's week strip opens the week at a day.
    private func jumpToRequestedDay() async {
        guard nav.mode == .week, let day = nav.consumeRequestedDay() else { return }
        weekOffset = 0
        try? await Task.sleep(for: .milliseconds(160))
        guard windowDays.contains(day) else { return }
        withAnimation(PFMotion.smooth) { position.scrollTo(id: day, anchor: .top) }
    }
}

// MARK: - Pieces

/// Subtle tint and dashed outline behind the drop target under the finger.
private struct DropHighlight: ViewModifier {
    let isHovered: Bool

    func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: PFRadius.card + 6, style: .continuous)
                    .fill(PFColor.raised.opacity(isHovered ? 0.8 : 0))
                    .overlay {
                        RoundedRectangle(cornerRadius: PFRadius.card + 6, style: .continuous)
                            .strokeBorder(PFColor.primary.opacity(isHovered ? 0.55 : 0), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 2)
            }
            .animation(PFMotion.respecting(PFMotion.fast), value: isHovered)
    }
}

/// A task in the week: ring check · title · due/project · priority. The same row is the drag ghost.
private struct WeekRowContent: View {
    let item: WorkItem
    let onToggle: (() -> Void)?
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(alignment: .top, spacing: 2) {
            PFRingCheck(isOn: item.isCompleted, severity: item.severity == .done ? .neutral : item.severity,
                        label: item.isCompleted ? L10n.t("common.reopen") : L10n.t("common.complete")) { onToggle?() }
                .padding(.leading, 3)
                .allowsHitTesting(onToggle != nil)
            HStack(spacing: PFSpace.s) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.title)
                        .pfText(.rowTitle)
                        .foregroundStyle(item.isCompleted ? PFColor.textMuted : PFColor.textMain)
                        .strikethrough(item.isCompleted, color: PFColor.textMuted)
                        .multilineTextAlignment(.leading)
                        .lineLimit(2)
                    meta
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                PFPrioritySignal(item.priority)
            }
            .padding(.vertical, 12)
            .padding(.trailing, PFSpace.m)
        }
        .frame(minHeight: 54)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    @ViewBuilder private var meta: some View {
        let due = Formatting.dueText(item.dueDate)
        HStack(spacing: 4) {
            if let due {
                Text(due).foregroundStyle(PFColor.severityText(item.isCompleted ? .neutral : item.severity))
                Text("·").foregroundStyle(PFColor.textMuted)
            }
            if item.isPersonal {
                Image(systemName: "lock.fill").font(.system(size: 10, weight: .semibold))
                Text(L10n.t("common.personal"))
            } else if let project = model.workspace?.project(item.projectId) {
                Text(project.title)
            }
        }
        .pfText(.meta)
        .foregroundStyle(PFColor.textMuted)
        .lineLimit(1)
    }
}
