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

/// Everything that narrows the Work list: projects, priorities, personal and completed tasks, plus smart planning.
struct WorkFiltersSheet: View {
    let filters: WorkFilters
    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter

    private var projects: [Project] {
        (model.workspace?.projects ?? []).filter { $0.status.lifecycle != .closed }
    }

    var body: some View {
        @Bindable var filters = filters
        VStack(alignment: .leading, spacing: PFSpace.l) {
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

            section(L10n.t("work.filter.project")) {
                if projects.isEmpty {
                    Text(L10n.t("work.filter.noProjects")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                } else {
                    ScrollView {
                        FlowLayout(spacing: 8) {
                            ForEach(projects) { project in
                                PFChip(project.title, isSet: filters.projectIds.contains(project.id)) {
                                    toggle(&filters.projectIds, project.id)
                                }
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .frame(maxHeight: 132)
                    .scrollBounceBehavior(.basedOnSize)
                }
            }

            section(L10n.t("common.priority")) {
                FlowLayout(spacing: 8) {
                    ForEach([TaskPriority.urgent, .high, .medium, .low], id: \.self) { priority in
                        PFChip(priority.label, isSet: filters.priorities.contains(priority)) {
                            toggle(&filters.priorities, priority)
                        }
                    }
                }
            }

            VStack(spacing: 0) {
                PFSwitch(L10n.t("work.filter.personalSwitch"), isOn: $filters.includePersonal)
                    .padding(.horizontal, PFSpace.m).frame(minHeight: 52)
                PFRowDivider()
                PFSwitch(L10n.t("work.filter.completedSwitch"), isOn: $filters.showCompleted)
                    .padding(.horizontal, PFSpace.m).frame(minHeight: 52)
            }
            .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))

            HStack(spacing: PFSpace.xs) {
                PFButton(L10n.t("work.smart.chip"), systemImage: "wand.and.stars", kind: .secondary, size: .large, fullWidth: true) {
                    presenter.dismiss()
                    SmartSchedule.present(model: model)
                }
                PFButton(L10n.t("common.done"), size: .large, fullWidth: true) { presenter.dismiss() }
            }
        }
        .padding(.horizontal, PFSpace.page)
        .padding(.bottom, PFSpace.l)
    }

    private func section<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(title)
            content()
        }
    }

    private func toggle<Value: Hashable>(_ set: inout Set<Value>, _ value: Value) {
        withAnimation(PFMotion.respecting(PFMotion.fast)) {
            if set.contains(value) { set.remove(value) } else { set.insert(value) }
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
