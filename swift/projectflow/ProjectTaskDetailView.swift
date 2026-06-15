import SwiftUI

// MARK: - ProjectTaskDetailView — Companion V2
//
// Restyled onto PFKit. Same data flow and capabilities (subtasks, assignees,
// labels, comments, pin/focus, linked initiative, codex, edit/delete).

struct ProjectTaskDetailView: View {
    @State var task: ProjectTask
    let tenantId: String
    let permissions: PermissionContext

    @StateObject private var tasksStore = TasksStore()
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss

    @State private var showingEditor = false
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = ""
    @State private var draftPriority = ""
    @State private var showingDeleteConfirm = false
    @State private var newSubtaskTitle = ""
    @State private var showingAssigneePicker = false
    @State private var showingLabelPicker = false
    @StateObject private var teamStore = ProjectTeamStore()
    @StateObject private var labelsStore = LabelsStore()
    @StateObject private var commentsStore = CommentsStore()
    @EnvironmentObject private var appSession: AppSession
    @State private var linkedInitiative: Initiative?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let twoColumns = [GridItem(.flexible(), spacing: PFSpacing.sm), GridItem(.flexible(), spacing: PFSpacing.sm)]

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    taskHero
                    taskMetaGrid
                    descriptionCard
                    labelsSection
                    subtasksSection
                    assigneesSection
                    initiativeSection
                    codexSection
                    CommentsSection(
                        tenantId: tenantId,
                        projectId: task.projectId ?? "",
                        targetId: task.id,
                        targetType: CommentTargetType.task.rawValue,
                        permissions: permissions,
                        store: commentsStore
                    )
                    if canEdit { actionButtons }
                }
                .pfScreenPadding(vertical: PFSpacing.md)
                .pfTabBarClearance()
            }
        }
        .navigationTitle(L10n.tr("quickCreate.type.task", fallback: "Task"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button { focusTask() } label: {
                    Image(systemName: "scope").foregroundStyle(colors.textMain)
                }
                if canEdit {
                    Button { beginEdit() } label: {
                        Image(systemName: "square.and.pencil").foregroundStyle(colors.textMain)
                    }
                }
            }
        }
        .onAppear {
            tasksStore.start(tenantId: tenantId, projectId: task.projectId)
            if let projectId = task.projectId {
                commentsStore.listen(
                    tenantId: tenantId,
                    projectId: projectId,
                    targetId: task.id,
                    targetType: CommentTargetType.task.rawValue
                )
                loadInitiative(tenantId: tenantId, projectId: projectId)
            }
            teamStore.start(tenantId: tenantId)
            teamStore.ensureProfiles(for: task.assigneeIds)
            labelsStore.start(tenantId: tenantId, projectId: task.projectId)
        }
        .sheet(isPresented: $showingEditor) {
            TaskEditorSheet(
                title: $draftTitle,
                description: $draftDescription,
                status: $draftStatus,
                priority: $draftPriority,
                onSave: { await saveTask() }
            )
        }
        .sheet(isPresented: $showingAssigneePicker) {
            MultiAssigneePicker(
                selectedIds: Binding(
                    get: { task.assigneeIds },
                    set: { nextIds in Task { await updateAssignees(nextIds) } }
                ),
                profiles: Array(teamStore.profilesById.values)
            )
        }
        .sheet(isPresented: $showingLabelPicker) {
            MultiLabelPicker(
                selectedIds: Binding(
                    get: { task.labelIds },
                    set: { nextIds in Task { await updateLabels(nextIds) } }
                ),
                labels: labelsStore.labels
            )
        }
        .confirmationDialog(L10n.tr("task.delete", fallback: "Delete task"), isPresented: $showingDeleteConfirm, titleVisibility: .visible) {
            Button(L10n.tr("common.delete", fallback: "Delete"), role: .destructive) {
                Task {
                    await tasksStore.deleteTask(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, permissions: permissions)
                    dismiss()
                }
            }
            Button(L10n.tr("common.cancel", fallback: "Cancel"), role: .cancel) {}
        }
    }

    // MARK: Hero

    private var taskHero: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    PFIconTile(
                        icon: task.isCompleted ? "checkmark.circle.fill" : "checklist",
                        tint: task.isCompleted ? colors.success : priorityColor,
                        size: 42
                    )
                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: PFSpacing.xs) {
                            PFStatusChip(status: task.status.isEmpty ? "Open" : task.status)
                            if !task.priority.isEmpty { PFPriorityChip(priority: task.priority) }
                        }
                        Text(task.title)
                            .font(PFFont.title)
                            .foregroundStyle(colors.textMain)
                            .lineLimit(3)
                    }
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private var taskMetaGrid: some View {
        LazyVGrid(columns: twoColumns, spacing: PFSpacing.sm) {
            TaskMetaTile(title: L10n.tr("quickCreate.status", fallback: "Status"), value: task.status.isEmpty ? "Open" : task.status, icon: "circle.dashed", tint: PFSemantic.statusTint(task.status, colors: colors))
            TaskMetaTile(title: L10n.tr("quickCreate.priority", fallback: "Priority"), value: task.priority.isEmpty ? "Medium" : task.priority, icon: "flag", tint: priorityColor)
            TaskMetaTile(title: L10n.tr("task.assignees", fallback: "Assignees"), value: task.assigneeIds.isEmpty ? L10n.tr("common.none", fallback: "None") : "\(task.assigneeIds.count)", icon: "person.2", tint: colors.primaryLight)
            TaskMetaTile(title: L10n.tr("task.due", fallback: "Due"), value: dueStateLabel, icon: "calendar", tint: dueTint)
        }
    }

    private var descriptionCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(title: L10n.tr("task.notes", fallback: "Notes"))
                Text(task.description.isEmpty ? L10n.tr("task.notes.empty", fallback: "No description provided.") : task.description)
                    .font(PFFont.body)
                    .foregroundStyle(task.description.isEmpty ? colors.textMuted : colors.textMain)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: Labels

    private var labelsSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: L10n.tr("task.labels", fallback: "Labels"), actionTitle: L10n.tr("common.edit", fallback: "Edit"), action: { showingLabelPicker = true })
            if !task.labelIds.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(task.labelIds, id: \.self) { labelId in
                        if let label = labelsStore.labels.first(where: { $0.id == labelId }) {
                            PFTag(text: label.title, tint: Color(hex: label.color))
                        }
                    }
                }
            } else {
                Text(L10n.tr("task.labels.empty", fallback: "No labels."))
                    .font(PFFont.body)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }

    // MARK: Subtasks

    private var subtasksSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(
                title: L10n.tr("task.subtasks", fallback: "Subtasks"),
                subtitle: "\(task.subtasks.filter { $0.isCompleted }.count)/\(task.subtasks.count)"
            )
            PFCard {
                VStack(alignment: .leading, spacing: 0) {
                    if task.subtasks.isEmpty {
                        Text(L10n.tr("task.subtasks.empty", fallback: "No subtasks yet."))
                            .font(PFFont.body)
                            .foregroundStyle(colors.textMuted)
                            .padding(.vertical, PFSpacing.sm)
                    } else {
                        ForEach(task.subtasks) { subtask in
                            HStack(spacing: PFSpacing.sm) {
                                Button { toggleSubtask(subtask) } label: {
                                    Image(systemName: subtask.isCompleted ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(subtask.isCompleted ? colors.success : colors.textMuted)
                                }
                                .buttonStyle(.plain)
                                Text(subtask.title)
                                    .font(PFFont.body)
                                    .foregroundStyle(subtask.isCompleted ? colors.textMuted : colors.textMain)
                                    .strikethrough(subtask.isCompleted)
                                Spacer()
                                Button { deleteSubtask(subtask) } label: {
                                    Image(systemName: "xmark").font(.caption2).foregroundStyle(colors.textSubtle)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.vertical, PFSpacing.sm)
                            if subtask.id != task.subtasks.last?.id { Divider() }
                        }
                    }
                    Divider()
                    HStack {
                        TextField(L10n.tr("task.subtask.add", fallback: "Add a subtask…"), text: $newSubtaskTitle)
                            .font(PFFont.body)
                            .onSubmit { addSubtask() }
                        if !newSubtaskTitle.isEmpty {
                            Button { addSubtask() } label: {
                                Image(systemName: "plus.circle.fill").foregroundStyle(colors.primary)
                            }
                        }
                    }
                    .padding(.top, PFSpacing.sm)
                }
            }
        }
    }

    // MARK: Assignees

    private var assigneesSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: L10n.tr("task.assignees", fallback: "Assignees"), actionTitle: L10n.tr("common.add", fallback: "Add"), action: { showingAssigneePicker = true })
            PFCard {
                VStack(alignment: .leading, spacing: 0) {
                    if task.assigneeIds.isEmpty {
                        Text(L10n.tr("task.assignees.empty", fallback: "No one assigned."))
                            .font(PFFont.body)
                            .foregroundStyle(colors.textMuted)
                            .padding(.vertical, PFSpacing.sm)
                    } else {
                        ForEach(task.assigneeIds, id: \.self) { userId in
                            HStack(spacing: PFSpacing.sm) {
                                UserAvatar(
                                    name: teamStore.profilesById[userId]?.displayName,
                                    url: URL(string: teamStore.profilesById[userId]?.photoURL ?? ""),
                                    size: 32
                                )
                                Text(teamStore.profilesById[userId]?.displayName ?? "…")
                                    .font(PFFont.body)
                                    .foregroundStyle(colors.textMain)
                                Spacer()
                            }
                            .padding(.vertical, PFSpacing.sm)
                            if userId != task.assigneeIds.last { Divider() }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var initiativeSection: some View {
        if let initiativeId = task.initiativeId, !initiativeId.isEmpty {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    PFFieldLabel(text: L10n.tr("quickCreate.type.initiative", fallback: "Initiative"))
                    if let linkedInitiative {
                        NavigationLink {
                            ProjectInitiativeDetailView(initiative: linkedInitiative, tenantId: tenantId, permissions: permissions)
                        } label: {
                            PFListRow(title: linkedInitiative.title, icon: "flag", iconTint: PFSemantic.healthTint(linkedInitiative.health, colors: colors))
                        }
                        .buttonStyle(.plain)
                    } else {
                        Text(initiativeId).font(PFFont.body).foregroundStyle(colors.textMuted)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var codexSection: some View {
        if let sessionId = task.codexSessionId, !sessionId.isEmpty {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    PFFieldLabel(text: "Codex")
                    Text(task.codexSessionExternalKey ?? sessionId)
                        .font(PFFont.body)
                        .foregroundStyle(colors.textMain)
                }
            }
        }
    }

    private var actionButtons: some View {
        VStack(spacing: PFSpacing.sm) {
            PFSecondaryButton(title: L10n.tr("task.edit", fallback: "Edit task"), icon: "square.and.pencil") { beginEdit() }
            Button(role: .destructive) { showingDeleteConfirm = true } label: {
                Text(L10n.tr("task.delete", fallback: "Delete task"))
                    .font(PFFont.rowTitle)
                    .foregroundStyle(colors.error)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, PFSpacing.sm)
                    .background(colors.error.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            }
        }
        .padding(.top, PFSpacing.sm)
    }

    // MARK: Mutations (unchanged logic)

    private func updateLabels(_ nextIds: [String]) async {
        await tasksStore.updateTaskFields(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, updates: ["labelIds": nextIds], permissions: permissions)
        if tasksStore.errorMessage == nil { task.labelIds = nextIds }
    }

    private func updateAssignees(_ nextIds: [String]) async {
        await tasksStore.updateTaskFields(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, updates: ["assigneeIds": nextIds], permissions: permissions)
        if tasksStore.errorMessage == nil {
            task.assigneeIds = nextIds
            teamStore.ensureProfiles(for: nextIds)
        }
    }

    private func addSubtask() {
        guard !newSubtaskTitle.isEmpty else { return }
        let title = newSubtaskTitle
        newSubtaskTitle = ""
        Task {
            await tasksStore.addSubtask(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, title: title, subtasks: task.subtasks, permissions: permissions)
            if tasksStore.errorMessage == nil { task.subtasks.append(ProjectSubtask(title: title)) }
        }
    }

    private func toggleSubtask(_ subtask: ProjectSubtask) {
        Task {
            await tasksStore.toggleSubtask(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, subtaskId: subtask.id, subtasks: task.subtasks, permissions: permissions)
            if tasksStore.errorMessage == nil, let index = task.subtasks.firstIndex(where: { $0.id == subtask.id }) {
                task.subtasks[index].isCompleted.toggle()
            }
        }
    }

    private func deleteSubtask(_ subtask: ProjectSubtask) {
        Task {
            await tasksStore.deleteSubtask(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, subtaskId: subtask.id, subtasks: task.subtasks, permissions: permissions)
            if tasksStore.errorMessage == nil { task.subtasks.removeAll { $0.id == subtask.id } }
        }
    }

    // MARK: Derived

    private var dueStateLabel: String {
        guard !task.dueDate.isEmpty else { return L10n.tr("task.due.none", fallback: "No due date") }
        guard let date = parseTaskDate(task.dueDate) else { return task.dueDate }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return L10n.tr("task.due.today", fallback: "Today") }
        if calendar.isDateInTomorrow(date) { return L10n.tr("task.due.tomorrow", fallback: "Tomorrow") }
        if date < calendar.startOfDay(for: Date()) { return L10n.tr("task.due.overdue", fallback: "Overdue") }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private var isDueToday: Bool {
        guard let date = parseTaskDate(task.dueDate) else { return false }
        return Calendar.current.isDateInToday(date)
    }
    private var isOverdue: Bool {
        guard let date = parseTaskDate(task.dueDate) else { return false }
        return date < Calendar.current.startOfDay(for: Date())
    }
    private var dueTint: Color {
        if task.isCompleted || task.status == "Done" { return colors.success }
        if task.status == "Blocked" || isOverdue { return colors.error }
        if isDueToday { return colors.warning }
        return colors.primary
    }
    private func parseTaskDate(_ value: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: value) { return date }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }
    private var priorityColor: Color { PFSemantic.priorityTint(task.priority, colors: colors) }
    private var canEdit: Bool { PermissionEvaluator(context: permissions).allows(PermissionNode.tasksEdit) }

    private func beginEdit() {
        draftTitle = task.title
        draftDescription = task.description
        draftStatus = task.status
        draftPriority = task.priority
        showingEditor = true
    }

    private func focusTask() {
        guard let projectId = task.projectId else { return }
        let item = PinnedItem(id: task.id, type: FocusItemType.task.rawValue, title: task.title, projectId: projectId, tenantId: tenantId, priority: task.priority, isCompleted: task.isCompleted)
        appSession.pinnedTasksStore.startFocus(item: item)
    }

    private func loadInitiative(tenantId: String, projectId: String) {
        guard let initiativeId = task.initiativeId else { return }
        Task {
            linkedInitiative = try? await InitiativeRepository().getInitiative(tenantId: tenantId, projectId: projectId, initiativeId: initiativeId)
        }
    }

    private func saveTask() async {
        await tasksStore.updateTask(tenantId: tenantId, projectId: task.projectId ?? "", taskId: task.id, title: draftTitle, description: draftDescription, status: draftStatus, priority: draftPriority, permissions: permissions)
        if tasksStore.errorMessage == nil {
            task.title = draftTitle
            task.description = draftDescription
            task.status = draftStatus
            task.priority = draftPriority
            task.isCompleted = draftStatus == "Done"
            showingEditor = false
        }
    }
}

// MARK: - Meta tile

private struct TaskMetaTile: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            HStack(spacing: PFSpacing.sm) {
                PFIconTile(icon: icon, tint: tint, size: 30, corner: PFRadius.sm)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(PFFont.chip).foregroundStyle(colors.textMuted)
                    Text(value).font(PFFont.rowTitle).foregroundStyle(colors.textMain).lineLimit(1).minimumScaleFactor(0.75)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

// MARK: - Edit sheet

private struct TaskEditorSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Binding var title: String
    @Binding var description: String
    @Binding var status: String
    @Binding var priority: String
    let onSave: () async -> Void
    @State private var isSaving = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Open", "In Progress", "Blocked", "On Hold", "Done"]
    private let priorities = ["Low", "Medium", "High", "Urgent"]

    var body: some View {
        PFSheetScaffold(
            title: L10n.tr("task.edit", fallback: "Edit task"),
            canSave: !title.trimmingCharacters(in: .whitespaces).isEmpty,
            isSaving: isSaving,
            onCancel: { dismiss() },
            onSave: { Task { isSaving = true; await onSave(); isSaving = false; dismiss() } }
        ) {
            VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                PFFieldLabel(text: L10n.tr("quickCreate.titlePlaceholder", fallback: "Title"))
                PFTextField(placeholder: L10n.tr("quickCreate.titlePlaceholder", fallback: "Title"), text: $title)
            }
            VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                PFFieldLabel(text: L10n.tr("quickCreate.descriptionPlaceholder", fallback: "Description"))
                PFTextField(placeholder: L10n.tr("quickCreate.descriptionPlaceholder", fallback: "Description"), text: $description, axis: .vertical)
            }
            VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                PFFieldLabel(text: L10n.tr("quickCreate.status", fallback: "Status"))
                PFChoiceChips(options: statuses, selection: $status, tintProvider: { PFSemantic.statusTint($0, colors: colors) })
            }
            VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                PFFieldLabel(text: L10n.tr("quickCreate.priority", fallback: "Priority"))
                PFChoiceChips(options: priorities, selection: $priority, tintProvider: { PFSemantic.priorityTint($0, colors: colors) })
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
