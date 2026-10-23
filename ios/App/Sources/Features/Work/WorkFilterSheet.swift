import SwiftUI
import PFDesign
import PFModel

/// Multi-select list in a custom sheet (project and priority filters). Stays open while choosing.
struct WorkMultiSelectSheet: View {
    struct Option: Identifiable {
        let id: String
        let label: String
        let leading: AnyView

        init<Leading: View>(id: String, label: String, @ViewBuilder leading: () -> Leading) {
            self.id = id
            self.label = label
            self.leading = AnyView(leading())
        }
    }

    let title: String
    let emptyText: String
    let options: [Option]
    let isSelected: (String) -> Bool
    let toggle: (String) -> Void
    let clear: () -> Void

    @Environment(PFPresenter.self) private var presenter

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            HStack {
                PFEyebrow(title)
                Spacer()
                if options.contains(where: { isSelected($0.id) }) {
                    Button { PFHaptics.selection(); clear() } label: {
                        Text(L10n.t("work.filter.reset")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted).frame(minHeight: 32)
                    }
                    .buttonStyle(.pfPressable)
                }
            }
            .padding(.horizontal, PFSpace.page)

            if options.isEmpty {
                Text(emptyText).pfText(.meta).foregroundStyle(PFColor.textMuted).padding(.horizontal, PFSpace.page)
            } else {
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
                            if index > 0 { PFRowDivider() }
                            row(option)
                        }
                    }
                    .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    .padding(.horizontal, PFSpace.m)
                }
                .frame(maxHeight: 420)
                .scrollIndicators(.hidden)
            }
            PFButton(L10n.t("common.done"), fullWidth: true) { presenter.dismiss() }
                .padding(.horizontal, PFSpace.page)
                .padding(.top, PFSpace.xs)
        }
        .padding(.bottom, PFSpace.l)
    }

    private func row(_ option: Option) -> some View {
        let selected = isSelected(option.id)
        return Button {
            PFHaptics.selection()
            withAnimation(PFMotion.respecting(PFMotion.fast)) { toggle(option.id) }
        } label: {
            HStack(spacing: PFSpace.s) {
                option.leading.frame(minWidth: 26)
                Text(option.label).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                Spacer()
                ZStack {
                    Circle().strokeBorder(selected ? PFColor.primary : PFColor.hairlineStrong, lineWidth: 2)
                    if selected {
                        Circle().fill(PFColor.primary)
                        Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(PFColor.onPrimary)
                    }
                }
                .frame(width: 22, height: 22)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Filter button and sheet

/// Round filter button for the root actions (iPhone: left of capture; Duo outer display: above it in the rail).
/// A dot marks active filters.
struct WorkFilterButton: View {
    let filters: WorkFilters
    @Environment(AppModel.self) private var model

    var body: some View {
        PFIconButton("line.3.horizontal.decrease", label: L10n.t("work.filter.title")) {
            let filters = filters
            model.presenter.present(detents: [.fit]) { WorkFiltersSheet(filters: filters) }
        }
        .overlay(alignment: .topTrailing) {
            if filters.isActive {
                Circle().fill(PFColor.primary)
                    .frame(width: 10, height: 10)
                    .overlay(Circle().stroke(PFColor.canvas, lineWidth: 2))
                    .offset(x: -2, y: 2)
                    .accessibilityHidden(true)
            }
        }
        .accessibilityValue(filters.isActive ? L10n.t("work.filter.active") : "")
    }
}

/// Everything that narrows the Work list, as one compact list: project and priority open a checklist on top,
/// personal and completed tasks are switches. Smart planning sits below.
struct WorkFiltersSheet: View {
    let filters: WorkFilters
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @Environment(\.pfSideRegionWidth) private var sideRegion

    private var projects: [Project] {
        (model.workspace?.projects ?? []).filter { $0.status.lifecycle != .closed }
    }

    var body: some View {
        @Bindable var filters = filters
        VStack(alignment: .leading, spacing: PFSpace.m) {
            HStack {
                Text(L10n.t("work.filter.title")).pfText(.section).foregroundStyle(PFColor.textMain)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                if filters.isActive {
                    Button { PFHaptics.selection(); withAnimation(PFMotion.snappy) { filters.reset() } } label: {
                        Text(L10n.t("work.filter.reset")).pfText(.metaStrong).foregroundStyle(PFColor.textMuted).frame(minHeight: 32)
                    }
                    .buttonStyle(.pfPressable)
                }
            }

            VStack(spacing: 0) {
                pickerRow("square.stack.3d.up", L10n.t("work.filter.project"), value: projectValue) { presentProjects() }
                PFRowDivider()
                pickerRow("chart.bar", L10n.t("work.filter.priority"), value: priorityValue) { presentPriorities() }
                PFRowDivider()
                switchRow("lock", L10n.t("work.filter.personalSwitch"), isOn: $filters.includePersonal)
                PFRowDivider()
                switchRow("checkmark.circle", L10n.t("work.filter.completedSwitch"), isOn: $filters.showCompleted)
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))

            // Filters apply live. iPhone: smart planning + Done. Duo outer display: the sheet's close button in the side
            // region already closes it, so only smart planning remains, full width on the close button's line.
            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("work.smart.chip"), systemImage: "wand.and.stars", kind: .secondary, size: .large, fullWidth: true) {
                    presenter.dismiss()
                    SmartSchedule.present(model: model)
                }
                if sideRegion == 0 {
                    PFButton(L10n.t("common.done"), size: .large, fullWidth: true) { presenter.dismiss() }
                }
            }
            .padding(.top, PFSpace.xs)
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
    }

    // MARK: Rows

    private func icon(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(PFColor.textMuted)
            .frame(width: 24)
            .accessibilityHidden(true)
    }

    private func pickerRow(_ systemImage: String, _ title: String, value: String, action: @escaping () -> Void) -> some View {
        Button { PFHaptics.tap(); action() } label: {
            HStack(spacing: PFSpace.s) {
                icon(systemImage)
                Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                Spacer(minLength: PFSpace.s)
                Text(value).pfText(.body).foregroundStyle(PFColor.textMuted).lineLimit(1)
                Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textSubtle)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityValue(value)
    }

    private func switchRow(_ systemImage: String, _ title: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: PFSpace.s) {
            icon(systemImage)
            PFSwitch(title, isOn: isOn)
        }
        .padding(.horizontal, PFSpace.m)
        .frame(minHeight: 52)
    }

    private var projectValue: String {
        switch filters.projectIds.count {
        case 0: L10n.t("work.filter.all")
        case 1: model.workspace?.project(filters.projectIds.first)?.title ?? L10n.t("work.filter.all")
        default: L10n.t("work.filter.projects", ["count": filters.projectIds.count])
        }
    }

    private var priorityValue: String {
        switch filters.priorities.count {
        case 0: L10n.t("work.filter.all")
        case 1: filters.priorities.first?.label ?? L10n.t("work.filter.all")
        default: L10n.t("work.filter.priorities", ["count": filters.priorities.count])
        }
    }

    // MARK: Checklists (stacked on top of this sheet)

    private func presentProjects() {
        let filters = filters
        let projects = projects
        presenter.present(detents: [.fit]) {
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
        presenter.present(detents: [.fit]) {
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

// MARK: - Mode switch

/// List · week · month as a compact icon switch in the title row (replaces the full-width segmented control).
struct WorkModeSwitch: View {
    @Binding var mode: WorkNavigator.Mode
    @Namespace private var thumb

    private let options: [(mode: WorkNavigator.Mode, icon: String, key: String)] = [
        (.list, "list.bullet", "work.mode.list"),
        (.week, "calendar.day.timeline.left", "work.mode.week"),
        (.month, "calendar", "work.mode.month"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.key) { option in
                let selected = mode == option.mode
                Button {
                    PFHaptics.selection()
                    withAnimation(PFMotion.respecting(PFMotion.snappy)) { mode = option.mode }
                } label: {
                    Image(systemName: option.icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(selected ? PFColor.textMain : PFColor.textMuted)
                        .frame(width: 38, height: 34)
                        .background {
                            if selected {
                                Capsule().fill(PFColor.card)
                                    .pfElevation(.card, radius: 100)
                                    .matchedGeometryEffect(id: "thumb", in: thumb)
                            }
                        }
                        .contentShape(.capsule)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(L10n.t(option.key))
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
            }
        }
        .padding(3)
        .background(PFColor.raised, in: .capsule)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(L10n.t("work.mode.label"))
    }
}
