import SwiftUI
import PFData
import PFDesign
import PFDomain
import PFModel

/// Arbeit (concept §5.4): everything that is mine — project tasks and personal tasks — as a list
/// grouped by due date, or as a week to plan into. The complete counterpart to the curated Heute.
struct WorkScreen: View {
    @Environment(AppModel.self) private var model
    private let nav = WorkNavigator.shared

    @State private var filters = WorkFilters()
    @State private var scrollOffset: CGFloat = 0
    @State private var now = Date()
    @State private var showCompletedGroup = false

    private var collapse: CGFloat { min(max((scrollOffset - 36) / 40, 0), 1) }

    private var allItems: [WorkItem] {
        guard let workspace = model.workspace else { return [] }
        return workspace.myTasks.map(WorkItem.task) + workspace.personalTasks.map(WorkItem.personal)
    }

    var body: some View {
        let isReady = model.workspace?.isReady == true
        let all = allItems
        let visible = all.filter(filters.matches)
        ZStack(alignment: .top) {
            PFCanvas()
            if !isReady {
                scrolling { WorkSkeleton() }
            } else if all.isEmpty {
                scrolling {
                    WorkHeader(filters: filters, summary: nil, showsFilters: false)
                    PFEmptyState(systemImage: "checklist", title: L10n.t("work.empty.title"), message: L10n.t("work.empty.message"),
                                 actionTitle: L10n.t("work.empty.action")) { CaptureLauncher.present(model: model) }
                        .padding(.top, PFSpace.xl)
                }
            } else if nav.mode == .week {
                WorkWeekView(items: visible, now: now, scrollOffset: $scrollOffset) {
                    WorkHeader(filters: filters, summary: summary(visible), showsFilters: true)
                }
            } else if nav.mode == .month {
                WorkMonthView(items: visible, now: now, scrollOffset: $scrollOffset) {
                    WorkHeader(filters: filters, summary: summary(visible), showsFilters: true)
                }
            } else {
                scrolling {
                    WorkHeader(filters: filters, summary: summary(visible), showsFilters: true)
                    listContent(visible)
                }
            }
        }
        .overlay(alignment: .top) {
            // Compact bar only appears once the large title has scrolled away.
            WorkTopBar(collapse: collapse)
                .background(alignment: .top) { topFade }
                .opacity(Double(collapse))
                .allowsHitTesting(collapse > 0.5)
        }
        .task { await tick() }
        .onChange(of: nav.mode) { _, _ in scrollOffset = 0 }
    }

    // MARK: Chrome

    private func scrolling<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) { content() }
                .padding(.bottom, 140)
        }
        .scrollIndicators(.hidden)
        .pfScrollOffset { scrollOffset = $0 }
    }

    private var topFade: some View {
        LinearGradient(
            stops: [.init(color: PFColor.canvas, location: 0), .init(color: PFColor.canvas, location: 0.74),
                    .init(color: PFColor.canvas.opacity(0), location: 1)],
            startPoint: .top, endPoint: .bottom
        )
        .padding(.bottom, -40)
        .ignoresSafeArea(edges: .top)
        .opacity(Double(min(max(scrollOffset / 24, 0), 1)))
        .allowsHitTesting(false)
    }

    private func tick() async {
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(30))
            now = .now
        }
    }

    private var dueContext: DueContext {
        DueContext(now: DateLike(now), timeZone: Formatting.timeZone.identifier)
    }

    /// "12 offen · 2 überfällig · 1 heute · 4 diese Woche"
    private func summary(_ items: [WorkItem]) -> [WorkHeader.SummaryPart] {
        let sum = DueBuckets.summarize(items, context: dueContext)
        var parts = [WorkHeader.SummaryPart(id: "open", text: L10n.t("work.summary.open", ["count": sum.open]), tone: .neutral)]
        if sum.overdue > 0 { parts.append(.init(id: "overdue", text: L10n.t("dashboard.band.overdue", ["count": sum.overdue]), tone: .danger)) }
        if sum.today > 0 { parts.append(.init(id: "today", text: L10n.t("dashboard.band.due", ["count": sum.today]), tone: .warning)) }
        if sum.week > 0 { parts.append(.init(id: "week", text: L10n.t("work.summary.week", ["count": sum.week]), tone: .neutral)) }
        return parts
    }

    // MARK: List

    @ViewBuilder private func listContent(_ items: [WorkItem]) -> some View {
        let groups = DueBuckets.group(items, context: dueContext, locale: L10n.locale)
        if groups.isEmpty {
            PFEmptyState(
                systemImage: "line.3.horizontal.decrease.circle", title: L10n.t("work.emptyFiltered.title"),
                message: L10n.t("work.emptyFiltered.message"), actionTitle: L10n.t("work.filter.reset")
            ) { withAnimation(PFMotion.snappy) { filters.reset() } }
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.xl)
        } else {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(groups, id: \.key) { group in
                    VStack(alignment: .leading, spacing: 0) {
                        let isDone = group.key == .done
                        GroupHeader(
                            title: groupTitle(group.key), color: groupColor(group.key), count: group.tasks.count,
                            collapsed: isDone ? !showCompletedGroup : nil,
                            onToggle: isDone ? { withAnimation(PFMotion.respecting(PFMotion.snappy)) { showCompletedGroup.toggle() } } : nil
                        )
                        .padding(.horizontal, PFSpace.page)
                        if !isDone || showCompletedGroup {
                            PFRowCard {
                                ForEach(group.tasks) { item in
                                    WorkItemRow(item: item).transition(.opacity)
                                }
                            }
                            .padding(.horizontal, PFSpace.page)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }
                }
            }
            .animation(PFMotion.respecting(PFMotion.snappy), value: groups.map { "\($0.key.rawValue):\($0.tasks.map(\.id).joined(separator: ","))" })
        }
    }

    private func groupTitle(_ key: DueGroupKey) -> String {
        key == .done ? L10n.t("work.group.done") : L10n.t("work.group.due.\(key.rawValue)")
    }

    private func groupColor(_ key: DueGroupKey) -> Color {
        switch key {
        case .overdue: PFColor.danger
        case .today: PFColor.warning
        case .week: PFColor.primary
        case .later: PFColor.textMuted
        case .undated: PFColor.textSubtle
        case .done: PFColor.success
        }
    }
}

// MARK: - Header

/// Large title, summary, mode switch and filter chips — shared by list and week.
struct WorkHeader: View {
    struct SummaryPart: Identifiable {
        let id: String
        let text: String
        let tone: DayPlanTone
    }

    let filters: WorkFilters
    let summary: [SummaryPart]?
    let showsFilters: Bool

    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var nav = WorkNavigator.shared
        VStack(alignment: .leading, spacing: 0) {
            // Title + summary share one row with the capture button, so the "+" sits level with the title block.
            HStack(alignment: .center, spacing: PFSpace.s) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(L10n.t("work.title"))
                        .pfText(.displayLarge)
                        .foregroundStyle(PFColor.textMain)
                        .accessibilityAddTraits(.isHeader)
                    if let summary, !summary.isEmpty {
                        HStack(spacing: 6) {
                            ForEach(Array(summary.enumerated()), id: \.element.id) { index, part in
                                if index > 0 { Text("·").foregroundStyle(PFColor.textMuted) }
                                Text(part.text).foregroundStyle(color(part.tone))
                            }
                        }
                        .pfText(.metaStrong)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                    }
                }
                Spacer(minLength: 0)
                PFIconButton("plus", label: L10n.t("today.capture")) { CaptureLauncher.present(model: model) }
            }
            .padding(.horizontal, PFSpace.page)
            .padding(.top, PFSpace.s)
            if showsFilters {
                PFSegmented([(value: WorkNavigator.Mode.list, label: L10n.t("work.mode.list")),
                             (value: WorkNavigator.Mode.week, label: L10n.t("work.mode.week")),
                             (value: WorkNavigator.Mode.month, label: L10n.t("work.mode.month"))], selection: $nav.mode)
                    .padding(.horizontal, PFSpace.page)
                    .padding(.top, PFSpace.m)
                chips.padding(.top, PFSpace.xs)
            }
        }
    }

    private func color(_ tone: DayPlanTone) -> Color {
        switch tone {
        case .danger: PFColor.dangerText
        case .warning: PFColor.warningText
        default: PFColor.textMuted
        }
    }

    private var chips: some View {
        PFChipRow {
            PFChip(projectLabel, systemImage: "square.stack.3d.up", isSet: !filters.projectIds.isEmpty, showsChevron: true) { presentProjects() }
            PFChip(priorityLabel, systemImage: "chart.bar", isSet: !filters.priorities.isEmpty, showsChevron: true) { presentPriorities() }
            PFChip(L10n.t("work.filter.personal"), systemImage: "lock", isSet: filters.includePersonal) {
                withAnimation(PFMotion.snappy) { filters.includePersonal.toggle() }
            }
            PFChip(L10n.t("work.filter.completed"), systemImage: "checkmark.circle", isSet: filters.showCompleted) {
                withAnimation(PFMotion.snappy) { filters.showCompleted.toggle() }
            }
            PFChip(L10n.t("work.smart.chip"), systemImage: "wand.and.stars") { SmartSchedule.present(model: model) }
            if filters.isActive {
                PFChip(L10n.t("work.filter.reset"), systemImage: "xmark") { withAnimation(PFMotion.snappy) { filters.reset() } }
            }
        }
    }

    private var projectLabel: String {
        switch filters.projectIds.count {
        case 0: L10n.t("work.filter.project")
        case 1: model.workspace?.project(filters.projectIds.first)?.title ?? L10n.t("work.filter.project")
        default: L10n.t("work.filter.projects", ["count": filters.projectIds.count])
        }
    }

    private var priorityLabel: String {
        switch filters.priorities.count {
        case 0: L10n.t("work.filter.priority")
        case 1: filters.priorities.first?.label ?? L10n.t("work.filter.priority")
        default: L10n.t("work.filter.priorities", ["count": filters.priorities.count])
        }
    }

    private func presentProjects() {
        let filters = filters
        let projects = (model.workspace?.projects ?? []).filter { $0.status.lifecycle != .closed }
        model.presenter.present(detents: [.fit]) {
            WorkMultiSelectSheet(
                title: L10n.t("work.filter.project"), emptyText: L10n.t("work.filter.noProjects"),
                options: projects.map { project in
                    WorkMultiSelectSheet.Option(id: project.id, label: project.title) {
                        Text(project.monogram).pfText(.buttonSmall).foregroundStyle(PFColor.onPrimary)
                            .frame(width: 26, height: 26)
                            .background(PFColor.primary, in: .rect(cornerRadius: 8, style: .continuous))
                    }
                },
                isSelected: { filters.projectIds.contains($0) },
                toggle: { id in
                    if filters.projectIds.contains(id) { filters.projectIds.remove(id) } else { filters.projectIds.insert(id) }
                },
                clear: { filters.projectIds = [] }
            )
        }
    }

    private func presentPriorities() {
        let filters = filters
        model.presenter.present(detents: [.fit]) {
            WorkMultiSelectSheet(
                title: L10n.t("common.priority"), emptyText: "",
                options: [TaskPriority.urgent, .high, .medium, .low].map { priority in
                    WorkMultiSelectSheet.Option(id: priority.rawValue, label: priority.label) { PFPrioritySignal(priority) }
                },
                isSelected: { id in TaskPriority(rawValue: id).map { filters.priorities.contains($0) } ?? false },
                toggle: { id in
                    guard let priority = TaskPriority(rawValue: id) else { return }
                    if filters.priorities.contains(priority) { filters.priorities.remove(priority) } else { filters.priorities.insert(priority) }
                },
                clear: { filters.priorities = [] }
            )
        }
    }
}

/// Compact chrome row: the title fades in once the large one has scrolled away; capture on the right.
private struct WorkTopBar: View {
    let collapse: CGFloat
    @Environment(AppModel.self) private var model

    var body: some View {
        HStack(spacing: PFSpace.xs) {
            Text(L10n.t("work.title"))
                .pfText(.section)
                .foregroundStyle(PFColor.textMain)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .pfGlass(in: .capsule, interactive: false)
                .opacity(Double(collapse))
            Spacer()
            PFIconButton("plus", label: L10n.t("today.capture")) { CaptureLauncher.present(model: model) }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.vertical, 6)
    }
}

/// Placeholder while the workspace loads.
private struct WorkSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(L10n.t("work.title")).pfText(.displayLarge).foregroundStyle(PFColor.textMain)
                .padding(.horizontal, PFSpace.page).padding(.top, PFSpace.xs)
            PFSkeleton(height: 12, radius: 6).frame(width: 180).padding(.horizontal, PFSpace.page).padding(.top, 10)
            PFSkeleton(height: 40, radius: 20).padding(.horizontal, PFSpace.page).padding(.top, PFSpace.m)
            PFSkeleton(height: 12, radius: 6).frame(width: 110).padding(.horizontal, PFSpace.page).padding(.top, PFSpace.xl)
            VStack(spacing: 0) {
                ForEach(0..<5, id: \.self) { index in
                    if index > 0 { PFRowDivider() }
                    HStack(spacing: PFSpace.s) {
                        PFSkeleton(height: 22, radius: 11).frame(width: 22)
                        VStack(alignment: .leading, spacing: 6) {
                            PFSkeleton(height: 15, radius: 6).padding(.trailing, CGFloat(index % 3) * 30)
                            PFSkeleton(height: 11, radius: 5).padding(.trailing, 100)
                        }
                    }
                    .padding(PFSpace.m)
                }
            }
            .pfCard()
            .padding(.horizontal, PFSpace.page)
            .padding(.top, PFSpace.s)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(L10n.t("work.loading"))
    }
}
