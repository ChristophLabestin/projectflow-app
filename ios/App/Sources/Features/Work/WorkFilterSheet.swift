import SwiftUI
import PFDesign
import PFModel

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

/// Everything that narrows the Work list, as one compact list: project and priority expand in place into a
/// checklist (one at a time), personal and completed tasks are switches. Smart planning sits below.
struct WorkFiltersSheet: View {
    private enum Section { case project, priority }

    let filters: WorkFilters
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @Environment(\.pfSideRegionWidth) private var sideRegion
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var expanded: Section?
    /// Row heights grow with Dynamic Type; the reserved space follows.
    @ScaledMetric(relativeTo: .body) private var optionHeight: CGFloat = 44
    @ScaledMetric(relativeTo: .body) private var rowHeight: CGFloat = 52

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
                pickerRow(.project, "square.stack.3d.up", L10n.t("work.filter.project"), value: projectValue)
                if expanded == .project { projectOptions }
                PFRowDivider()
                pickerRow(.priority, "chart.bar", L10n.t("work.filter.priority"), value: priorityValue)
                if expanded == .priority { priorityOptions }
                PFRowDivider()
                switchRow("lock", L10n.t("work.filter.personalSwitch"), isOn: $filters.includePersonal)
                PFRowDivider()
                switchRow("checkmark.circle", L10n.t("work.filter.completedSwitch"), isOn: $filters.showCompleted)
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
            .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
            // The sheet keeps one height: room for the larger opened section is reserved up front, so opening and
            // closing animate inside the sheet instead of fighting the system sheet's own resize (which can't be
            // synced with SwiftUI animations and made the rows jump).
            .frame(minHeight: reservedHeight, alignment: .top)

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

    /// Four rows plus the taller of the two opened sections (projects show at most five rows, then scroll).
    private var reservedHeight: CGFloat {
        let projectRows = projects.isEmpty ? 0.7 : CGFloat(min(projects.count, 5))
        let opened = max(projectRows, 4) * optionHeight + PFSpace.xs
        return 4 * rowHeight + 3 + opened
    }

    // MARK: Rows

    private func icon(_ name: String) -> some View {
        Image(systemName: name)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(PFColor.textMuted)
            .frame(width: 24)
            .accessibilityHidden(true)
    }

    private func pickerRow(_ section: Section, _ systemImage: String, _ title: String, value: String) -> some View {
        let isOpen = expanded == section
        return Button {
            PFHaptics.tap()
            withAnimation(reduceMotion ? nil : PFMotion.smooth) { expanded = isOpen ? nil : section }
        } label: {
            HStack(spacing: PFSpace.s) {
                icon(systemImage)
                Text(title).pfText(.rowTitle).foregroundStyle(PFColor.textMain)
                Spacer(minLength: PFSpace.s)
                Text(value).pfText(.body).foregroundStyle(PFColor.textMuted).lineLimit(1)
                Image(systemName: "chevron.down").font(.system(size: 12, weight: .bold)).foregroundStyle(PFColor.textSubtle)
                    .rotationEffect(.degrees(isOpen ? 180 : 0))
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 52)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityValue(value)
        .accessibilityHint(L10n.t(isOpen ? "work.filter.collapse" : "work.filter.expand"))
    }

    /// One checkable option inside an expanded section, indented under the row's title.
    private func optionRow<Leading: View>(_ label: String, selected: Bool, @ViewBuilder leading: () -> Leading,
                                         toggle: @escaping () -> Void) -> some View {
        Button {
            PFHaptics.selection()
            withAnimation(PFMotion.respecting(PFMotion.fast)) { toggle() }
        } label: {
            HStack(spacing: PFSpace.s) {
                leading().frame(width: 24)
                Text(label).pfText(.body).foregroundStyle(PFColor.textMain).lineLimit(1)
                Spacer(minLength: PFSpace.s)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(selected ? PFColor.textMain : PFColor.hairlineStrong)
            }
            .padding(.leading, PFSpace.m + 24 + PFSpace.s)
            .padding(.trailing, PFSpace.m)
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }

    @ViewBuilder private var projectOptions: some View {
        let filters = filters
        if projects.isEmpty {
            Text(L10n.t("work.filter.noProjects")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                .padding(.leading, PFSpace.m + 24 + PFSpace.s).padding(.bottom, PFSpace.s)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(projects) { project in
                        optionRow(project.title, selected: filters.projectIds.contains(project.id)) {
                            Text(project.monogram).pfText(.caption).foregroundStyle(PFColor.onPrimary)
                                .frame(width: 22, height: 22)
                                .background(PFColor.primary, in: .rect(cornerRadius: 6, style: .continuous))
                        } toggle: {
                            if filters.projectIds.contains(project.id) { filters.projectIds.remove(project.id) } else { filters.projectIds.insert(project.id) }
                        }
                    }
                }
                .padding(.bottom, PFSpace.xs)
            }
            .frame(maxHeight: optionHeight * 5)
            .scrollBounceBehavior(.basedOnSize)
            .transition(.opacity)
        }
    }

    private var priorityOptions: some View {
        let filters = filters
        return VStack(spacing: 0) {
            ForEach([TaskPriority.urgent, .high, .medium, .low], id: \.self) { priority in
                optionRow(priority.label, selected: filters.priorities.contains(priority)) {
                    PFPrioritySignal(priority)
                } toggle: {
                    if filters.priorities.contains(priority) { filters.priorities.remove(priority) } else { filters.priorities.insert(priority) }
                }
            }
        }
        .padding(.bottom, PFSpace.xs)
        .transition(.opacity)
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
