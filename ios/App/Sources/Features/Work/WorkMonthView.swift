import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Monat: a month grid with a dot per planned task, the selected day's tasks below and the "Ungeplant"
/// tray. Press and hold a task, drag it onto a day to plan it (haptic tick on snap), drop it on the tray to
/// take it out of the plan. Same drag grammar as the week.
struct WorkMonthView<Header: View>: View {
    let items: [WorkItem]
    let now: Date
    @Binding var scrollOffset: CGFloat
    @ViewBuilder let header: Header

    @Environment(AppModel.self) private var model

    @State private var coordinator = PFDragCoordinator()
    @State private var monthOffset = 0
    @State private var selectedDay: String?
    @State private var position = ScrollPosition(edge: .top)
    @State private var scrollY: CGFloat = 0
    @State private var size: CGSize = .zero
    @State private var trayShowsAll = false

    private let space = "pf.work.month"
    private let trayId = "tray"

    // MARK: Calendar maths (civil days, Monday first)

    private var zone: TimeZone { Formatting.timeZone }
    private var today: String { ZonedDate.toDay(DateLike(now), in: zone) ?? "" }
    private var selected: String { selectedDay ?? today }

    /// "YYYY-MM-01" of the shown month.
    private var monthStart: String {
        let parts = today.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return today }
        let index = parts[0] * 12 + (parts[1] - 1) + monthOffset
        return ZonedDate.formatDay(year: index / 12, month: index % 12 + 1, day: 1)
    }

    private var daysInMonth: Int {
        let parts = monthStart.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return 30 }
        let next = parts[1] == 12 ? ZonedDate.formatDay(year: parts[0] + 1, month: 1, day: 1) : ZonedDate.formatDay(year: parts[0], month: parts[1] + 1, day: 1)
        return ZonedDate.daysBetween(monthStart, next)
    }

    /// Grid cells: leading blanks, then every day of the month.
    private var cells: [String?] {
        let blanks = ZonedDate.weekdayIndex(monthStart)
        var list: [String?] = Array(repeating: nil, count: blanks)
        list += (0..<daysInMonth).map { ZonedDate.addDays(monthStart, $0) }
        while list.count % 7 != 0 { list.append(nil) }
        return list
    }

    private var monthTitle: String {
        DayString.date(monthStart)?.formatted(.dateTime.month(.wide).year().locale(L10n.locale)) ?? monthStart
    }

    private var weekdayInitials: [String] {
        let symbols = Formatting.calendar.veryShortStandaloneWeekdaySymbols   // Sunday first
        return (0..<7).map { symbols[($0 + 1) % 7] }
    }

    // MARK: Items

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
                    monthHeader.padding(.horizontal, PFSpace.page).padding(.top, PFSpace.l)
                    grid(grouped).padding(.horizontal, PFSpace.page).padding(.top, PFSpace.s)
                    dayList(grouped[selected] ?? [])
                    trayView(trayItems)
                }
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
        .animation(PFMotion.respecting(PFMotion.snappy), value: grouped.mapValues { $0.map(\.id) })
    }

    // MARK: Month header and grid

    private var monthHeader: some View {
        HStack(spacing: PFSpace.xs) {
            VStack(alignment: .leading, spacing: 2) {
                Text(monthTitle).pfText(.section).foregroundStyle(PFColor.textMain)
            }
            Spacer(minLength: PFSpace.s)
            if monthOffset != 0 {
                PFButton(L10n.t("common.today"), kind: .ghost, size: .small) {
                    withAnimation(PFMotion.snappy) { monthOffset = 0; selectedDay = nil }
                }
            }
            PFIconButton("chevron.left", label: L10n.t("work.month.previous"), style: .raised, size: 40) {
                withAnimation(PFMotion.snappy) { monthOffset -= 1; selectedDay = nil }
            }
            PFIconButton("chevron.right", label: L10n.t("work.month.next"), style: .raised, size: 40) {
                withAnimation(PFMotion.snappy) { monthOffset += 1; selectedDay = nil }
            }
        }
    }

    private func grid(_ grouped: [String: [WorkItem]]) -> some View {
        let cells = cells
        return VStack(spacing: 4) {
            HStack(spacing: 4) {
                ForEach(Array(weekdayInitials.enumerated()), id: \.offset) { _, symbol in
                    Text(symbol).pfText(.caption).foregroundStyle(PFColor.textMuted).frame(maxWidth: .infinity)
                }
            }
            .accessibilityHidden(true)
            ForEach(0..<(cells.count / 7), id: \.self) { row in
                HStack(spacing: 4) {
                    ForEach(0..<7, id: \.self) { column in
                        if let day = cells[row * 7 + column] {
                            cell(day, items: grouped[day] ?? [])
                        } else {
                            Color.clear.frame(maxWidth: .infinity, minHeight: 50)
                        }
                    }
                }
            }
        }
        .padding(8)
        .pfCard()
    }

    private func cell(_ day: String, items dayItems: [WorkItem]) -> some View {
        let isToday = day == today
        let isSelected = day == selected
        let hovered = coordinator.isDragging && coordinator.hoverTarget == AnyHashable(day)
        let open = dayItems.filter { !$0.isCompleted }
        let number = Int(day.suffix(2)) ?? 0
        return Button {
            PFHaptics.selection()
            withAnimation(PFMotion.fast) { selectedDay = day }
        } label: {
            VStack(spacing: 4) {
                Text("\(number)")
                    .pfText(.metaStrong)
                    .foregroundStyle(isToday ? PFColor.onPrimary : PFColor.textMain)
                    .frame(width: 26, height: 26)
                    .background(isToday ? PFColor.primary : Color.clear, in: .circle)
                HStack(spacing: 3) {
                    ForEach(Array(open.prefix(3).enumerated()), id: \.offset) { _, item in
                        Circle().fill(PFColor.severity(item.severity)).frame(width: 5, height: 5)
                    }
                    if open.isEmpty && !dayItems.isEmpty {
                        Image(systemName: "checkmark").font(.system(size: 6, weight: .heavy)).foregroundStyle(PFColor.success)
                    }
                }
                .frame(height: 6)
            }
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(hovered ? PFColor.raised : (isSelected ? PFColor.raisedSoft : Color.clear), in: .rect(cornerRadius: 10, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(hovered ? PFColor.primary.opacity(0.6) : (isSelected ? PFColor.hairlineStrong : .clear), lineWidth: hovered ? 1.5 : 1)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .pfDropTarget(day, coordinator: coordinator, space: space)
        .accessibilityLabel("\(DayString.longDate(day)), \(L10n.plural("planning.tasks.count", dayItems.count))")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: Day list and tray

    private func dayList(_ dayItems: [WorkItem]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(selected == today ? L10n.t("common.today") : DayString.weekdayName(selected)).pfText(.section).foregroundStyle(PFColor.textMain)
                Text(DayString.shortDate(selected)).pfText(.meta).foregroundStyle(PFColor.textMuted)
                Spacer()
                if !dayItems.isEmpty { PFCountPill(dayItems.count) }
            }
            .padding(.top, PFSpace.l)
            .padding(.bottom, PFSpace.xs)
            .accessibilityAddTraits(.isHeader)
            if dayItems.isEmpty {
                Text(coordinator.isDragging ? L10n.t("work.week.dropHint") : L10n.t("work.week.empty"))
                    .pfText(.meta).foregroundStyle(PFColor.textMuted)
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background {
                        RoundedRectangle(cornerRadius: PFRadius.card, style: .continuous)
                            .strokeBorder(PFColor.hairlineStrong, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                    }
            } else {
                PFRowCard { ForEach(dayItems) { item in row(item) } }
            }
        }
        .padding(.horizontal, PFSpace.page)
    }

    private func trayView(_ list: [WorkItem]) -> some View {
        let hovered = coordinator.isDragging && coordinator.hoverTarget == AnyHashable(trayId)
        let visible = trayShowsAll ? list : Array(list.prefix(4))
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Text(L10n.t("work.week.unplanned")).pfText(.section).foregroundStyle(PFColor.textMain)
                Spacer()
                if !list.isEmpty { PFCountPill(list.count) }
            }
            .padding(.top, PFSpace.l)
            .padding(.bottom, PFSpace.xs)
            if list.isEmpty {
                Text(L10n.t("work.week.unplanned.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.vertical, PFSpace.xs)
            } else {
                PFRowCard {
                    ForEach(visible) { item in row(item) }
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
            if hovered {
                Text(L10n.t("work.week.dropHint.tray")).pfText(.metaStrong).foregroundStyle(PFColor.textMain).padding(.top, 6)
            }
        }
        .padding(.horizontal, PFSpace.page)
        .background {
            RoundedRectangle(cornerRadius: PFRadius.card + 6, style: .continuous)
                .fill(PFColor.raised.opacity(hovered ? 0.8 : 0))
        }
        .pfDropTarget(trayId, coordinator: coordinator, space: space)
    }

    // MARK: Rows and drag

    @ViewBuilder private func row(_ item: WorkItem) -> some View {
        let content = WeekRowContent(item: item) { Task { await WorkItemActions(model: model).toggleComplete(item) } }
            .contentShape(.rect)
            .onTapGesture { model.router.push(item.route) }
        if item.isCompleted {
            content
        } else {
            content.pfDragSource(AnyHashable(item.id), coordinator: coordinator, space: space, onRelease: { peek(item) }) { target in
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
        guard !(item.scheduledDate != nil && placement(item) == day) else { return }
        let actions = WorkItemActions(model: model)
        let previous = item.scheduledDate
        PFHaptics.success()
        withAnimation(PFMotion.fast) { selectedDay = day }
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

    /// While a task is lifted and the finger nears the top or bottom edge, the page scrolls.
    private func autoScroll() async {
        guard coordinator.isDragging else { return }
        while coordinator.isDragging, !Task.isCancelled {
            let step = coordinator.edgeScroll(viewportTop: 120, viewportBottom: size.height - 120, inset: 70, maxStep: 10)
            if step != 0 { position.scrollTo(y: max(0, scrollY + step)) }
            try? await Task.sleep(for: .milliseconds(16))
        }
    }
}
