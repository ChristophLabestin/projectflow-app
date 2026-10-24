import SwiftUI
import PFData
import PFDesign
import PFModel

// Planning fields of the task detail: labels, groups, milestone, sprint, initiative and the AI description draft.

extension TaskDetailScreen {
    func plan(_ work: @escaping (PlanningActions) async throws -> Void) {
        guard let actions = model.planning else { return }
        Task {
            if await model.perform({ try await work(actions) }) { PFHaptics.success() }
        }
    }

    // MARK: Rows

    @ViewBuilder
    func planningRows(_ task: WorkTask) -> some View {
        labelsRow(task)
        groupsRow(task)
        milestoneRow(task)
        sprintRow(task)
        initiativeRow(task)
    }

    private func emptyValue() -> some View { Text("—").foregroundStyle(PFColor.textSubtle) }

    @ViewBuilder private func labelsRow(_ task: WorkTask) -> some View {
        if canEdit || !task.categories.isEmpty {
            PFDetailRow(L10n.t("taskDetail.labels.title"), showsChevron: canEdit, action: canEdit ? { presentLabels(task) } : nil) {
                if task.categories.isEmpty {
                    emptyValue()
                } else {
                    FlowLayout(spacing: 6) {
                        ForEach(task.categories, id: \.self) { name in
                            PFPill(name, tone: .custom(PFColor.hex(labelStore.color(of: name)) ?? PFColor.textMuted), compact: true) {
                                PFDot(PFColor.hex(labelStore.color(of: name)) ?? PFColor.textMuted, size: 6)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder private func groupsRow(_ task: WorkTask) -> some View {
        if !groupStore.groups.isEmpty || !task.assignedGroupIds.isEmpty {
            let names = task.assignedGroupIds.compactMap { id in groupStore.groups.first { $0.id == id }?.name }
            PFDetailRow(L10n.t("taskDetail.groups.label"), showsChevron: canEdit, action: canEdit ? { presentGroups(task) } : nil) {
                if names.isEmpty { emptyValue() } else { Text(names.joined(separator: ", ")).lineLimit(2) }
            }
        }
    }

    @ViewBuilder private func milestoneRow(_ task: WorkTask) -> some View {
        let milestone = project.milestones.first { $0.linkedTaskIds.contains(task.id) }
        if canEdit && !project.milestones.isEmpty || milestone != nil {
            PFDetailRow(L10n.t("taskDetail.details.milestone"), showsChevron: canEdit, action: canEdit ? { presentMilestones(task, current: milestone) } : nil) {
                if let milestone { Text(milestone.title).lineLimit(1) } else { emptyValue() }
            }
        }
    }

    @ViewBuilder private func sprintRow(_ task: WorkTask) -> some View {
        let sprint = task.sprintId.flatMap { id in project.sprints.first { $0.id == id } }
        if canEdit && !project.sprints.isEmpty || sprint != nil {
            PFDetailRow(L10n.t("taskDetail.details.sprint"), showsChevron: canEdit, action: canEdit ? { presentSprints(task) } : nil) {
                if let sprint { Text(sprint.name).lineLimit(1) } else { emptyValue() }
            }
        }
    }

    @ViewBuilder private func initiativeRow(_ task: WorkTask) -> some View {
        if canEdit && !project.initiatives.isEmpty || initiative != nil {
            PFDetailRow(L10n.t("taskDetail.details.initiative"), showsChevron: true, action: {
                if canEdit {
                    presentInitiatives(task)
                } else if let initiative {
                    model.router.push(.initiative(tenantId: ref.tenantId, projectId: ref.projectId, initiativeId: initiative.id))
                }
            }) {
                if let initiative { Text(initiative.title).lineLimit(1) } else { emptyValue() }
            }
        }
    }

    // MARK: Sheets

    func presentLabels(_ task: WorkTask) {
        let store = labelStore
        let ref = ref
        presenter.present(detents: [.large]) {
            TaskLabelsSheet(store: store, projectId: ref.projectId, initial: task.categories) { names in
                plan { try await $0.setLabels(ref, names) }
            }
        }
    }

    func presentGroups(_ task: WorkTask) {
        let ref = ref
        let options = groupStore.groups.map {
            PlanningOption(id: $0.id, title: $0.name, subtitle: L10n.plural("taskDetail.groups.members", $0.memberIds.count), tint: PFColor.hex($0.color) ?? PFColor.textMuted)
        }
        presenter.present(detents: [.fit]) {
            PlanningMultiSheet(eyebrow: L10n.t("taskDetail.groups.label"), title: task.title, options: options,
                               initial: Set(task.assignedGroupIds), emptyText: L10n.t("taskDetail.groups.none")) { ids in
                plan { try await $0.setAssignedGroups(ref, ids) }
            }
        }
    }

    func presentMilestones(_ task: WorkTask, current: Milestone?) {
        let ref = ref
        let milestones = project.milestones
        presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("taskDetail.details.milestone"), title: task.title,
                                options: milestones.map { PlanningOption(id: $0.id, title: $0.title, subtitle: $0.dueDate.map { Formatting.shortDate($0) }, symbol: "flag") },
                                selection: current?.id, noneTitle: L10n.t("planning.none"), emptyText: L10n.t("taskDetail.milestone.none")) { id in
                plan { try await $0.setTaskMilestone(projectId: ref.projectId, taskId: ref.taskId, milestoneId: id, all: milestones) }
            }
        }
    }

    func presentSprints(_ task: WorkTask) {
        let ref = ref
        let current = task.sprintId
        let sprints = project.sprints
            .filter { $0.statusRaw == "Active" || $0.statusRaw == "Planning" || $0.id == current }
            .sorted { ($0.startDate?.instant ?? .distantFuture) < ($1.startDate?.instant ?? .distantFuture) }
        presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("taskDetail.details.sprint"), title: task.title,
                                options: sprints.map { PlanningOption(id: $0.id, title: $0.name, subtitle: L10n.t("planning.sprint.status.\($0.statusRaw == "Active" ? "Active" : "Planning")"),
                                                                      symbol: $0.statusRaw == "Active" ? "bolt.fill" : "bolt") },
                                selection: current, noneTitle: L10n.t("taskDetail.sprint.backlog"), emptyText: L10n.t("planning.sprints.none")) { id in
                plan { try await $0.setSprint(ref, id) }
            }
        }
    }

    func presentInitiatives(_ task: WorkTask) {
        let ref = ref
        let initiatives = project.initiatives
        let current = task.initiativeId
        presenter.present(detents: [.fit]) {
            PlanningChoiceSheet(eyebrow: L10n.t("taskDetail.details.initiative"), title: task.title,
                                options: initiatives.map { PlanningOption(id: $0.id, title: $0.title, subtitle: $0.statusLabel, tint: PFColor.hex($0.color) ?? PFColor.statusBase($0.tone)) },
                                selection: current, noneTitle: L10n.t("planning.none"), emptyText: L10n.t("planning.initiatives.empty")) { id in
                plan { try await $0.setInitiative(ref, id) }
            }
        }
    }

    // MARK: AI draft

    private static func escape(_ text: String) -> String {
        text.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\n", with: "<br>")
    }
}

// MARK: - Labels sheet

/// Pick a task's labels from the project's label set and create new ones (name + colour).
struct TaskLabelsSheet: View {
    let store: ProjectLabelsStore
    let projectId: String
    let initial: [String]
    let onSave: ([String]) -> Void

    @Environment(AppModel.self) private var model
    @Environment(PFPresenter.self) private var presenter
    @State private var selected: [String] = []
    @State private var newName = ""
    @State private var newColor: String? = PlanningPalette.swatches[0]
    @State private var isAdding = false

    /// Project labels plus labels the task carries that are not in the set (legacy names).
    private var names: [String] {
        var list = store.labels.map(\.name)
        for name in initial + selected where !list.contains(name) { list.append(name) }
        return list
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpace.s) {
            PFSheetHeader(L10n.t("taskDetail.labels.title"))
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpace.m) {
                    if names.isEmpty {
                        Text(L10n.t("taskDetail.labels.empty")).pfText(.meta).foregroundStyle(PFColor.textMuted)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(names.enumerated()), id: \.element) { index, name in
                                if index > 0 { PFRowDivider(leadingInset: 48) }
                                row(name)
                            }
                        }
                        .background(PFColor.sheetGroup, in: .rect(cornerRadius: PFRadius.card, style: .continuous))
                    }
                    newLabel
                }
                .padding(.horizontal, PFSpace.m)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            PFButton(L10n.t("common.save"), fullWidth: true) {
                onSave(names.filter(selected.contains))
                presenter.dismiss()
            }
            .padding(.horizontal, PFSpace.page)
        }
        .padding(.bottom, PFSpace.l)
        .onAppear { selected = initial }
    }

    private func row(_ name: String) -> some View {
        let isOn = selected.contains(name)
        let color = PFColor.hex(store.color(of: name)) ?? PFColor.textMuted
        return Button {
            PFHaptics.selection()
            if isOn { selected.removeAll { $0 == name } } else { selected.append(name) }
        } label: {
            HStack(spacing: PFSpace.s) {
                Circle().fill(color).frame(width: 12, height: 12).accessibilityHidden(true)
                Text(name).pfText(.rowTitle).foregroundStyle(PFColor.textMain).lineLimit(1)
                Spacer(minLength: 0)
                Image(systemName: isOn ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundStyle(isOn ? PFColor.success : PFColor.textSubtle)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, PFSpace.m)
            .frame(minHeight: 50)
            .contentShape(.rect)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isOn ? [.isButton, .isSelected] : .isButton)
    }

    private var newLabel: some View {
        VStack(alignment: .leading, spacing: PFSpace.xs) {
            PFEyebrow(L10n.t("taskDetail.labels.new"))
            PFTextField(L10n.t("taskDetail.labels.namePlaceholder"), text: $newName, systemImage: "tag", onSubmit: add)
            PlanningSwatchRow(selection: $newColor)
            PFButton(L10n.t("taskDetail.labels.add"), systemImage: "plus", kind: .secondary, size: .small, action: add)
                .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty || isAdding)
                .opacity(newName.trimmingCharacters(in: .whitespaces).isEmpty ? 0.45 : 1)
        }
        .padding(.horizontal, PFSpace.xxs)
    }

    private func add() {
        let name = newName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, !isAdding, let actions = model.planning else { return }
        isAdding = true
        let color = newColor ?? PlanningPalette.swatches[0]
        Task {
            var created: String?
            let ok = await model.perform { created = try await actions.createLabel(projectId: projectId, name: name, color: color) }
            isAdding = false
            guard ok, let created else { return }
            newName = ""
            if !selected.contains(created) { selected.append(created) }
        }
    }
}
