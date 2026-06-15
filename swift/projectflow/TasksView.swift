import SwiftUI

// MARK: - TasksView — Companion V2 (embedded in WorkView)
//
// A lean task list across projects: project filter + status segment, glanceable
// rows with complete / pin / edit / delete. Create is handled by WorkView's
// global "+". The web app keeps the heavy board / labels / assignee depth.

enum TaskFilter: String, CaseIterable, Identifiable {
    case all
    case active
    case completed
    var id: String { rawValue }
}

struct TasksView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var tasksStore = TasksStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()

    @State private var selectedProjectId: String? = nil
    @State private var filter: TaskFilter = .active
    @State private var editingTask: ProjectTask?
    @State private var deletingTask: ProjectTask?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var activeTenantId: String? { tenantStore.activeTenantId }

    private var selectedProject: Project? {
        guard let id = selectedProjectId else { return nil }
        return projectsStore.projects.first { $0.id == id }
    }

    private var filteredTasks: [ProjectTask] {
        var result = tasksStore.tasks
        switch filter {
        case .active: result = result.filter { !$0.isCompleted }
        case .completed: result = result.filter { $0.isCompleted }
        case .all: break
        }
        return result.sorted {
            let d1 = $0.dueDate, d2 = $1.dueDate
            if d1.isEmpty { return false }
            if d2.isEmpty { return true }
            return d1 < d2
        }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                filterRow
                if tasksStore.isLoading && tasksStore.tasks.isEmpty {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, PFSpacing.xl)
                } else if filteredTasks.isEmpty {
                    PFEmptyState(
                        icon: "checklist",
                        title: L10n.tr("work.empty.tasks", fallback: "No tasks yet"),
                        message: L10n.tr("work.empty.tasks.message", fallback: "Tasks you create across projects show up here.")
                    )
                    .padding(.top, PFSpacing.lg)
                } else {
                    VStack(spacing: PFSpacing.sm) {
                        ForEach(filteredTasks) { task in
                            NavigationLink {
                                ProjectTaskDetailView(
                                    task: task,
                                    tenantId: activeTenantId ?? "",
                                    permissions: permissions(for: task)
                                )
                            } label: {
                                taskRow(task)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .pfScreenPadding(vertical: PFSpacing.sm)
            .pfTabBarClearance()
            .tabBarScrollShrink()
        }
        .sheet(item: $editingTask) { task in
            CompanionTaskEditSheet(task: task) { title, description, status, priority in
                await saveEdit(task: task, title: title, description: description, status: status, priority: priority)
            }
        }
        .confirmationDialog(
            L10n.tr("common.delete", fallback: "Delete"),
            isPresented: Binding(get: { deletingTask != nil }, set: { if !$0 { deletingTask = nil } }),
            titleVisibility: .visible
        ) {
            Button(L10n.tr("common.delete", fallback: "Delete"), role: .destructive) {
                if let task = deletingTask { Task { await delete(task); deletingTask = nil } }
            }
            Button(L10n.tr("common.cancel", fallback: "Cancel"), role: .cancel) { deletingTask = nil }
        }
        .onAppear {
            tenantStore.update(for: session.user)
            pinnedTasksStore.start()
            if let tenantId = activeTenantId {
                projectsStore.start(tenantId: tenantId)
                tasksStore.start(tenantId: tenantId, projectId: selectedProjectId)
            }
        }
        .onChange(of: session.user) { _, user in tenantStore.update(for: user) }
        .onChange(of: tenantStore.activeTenantId) { _, tenantId in
            if let tenantId {
                projectsStore.start(tenantId: tenantId)
                tasksStore.start(tenantId: tenantId, projectId: selectedProjectId)
            } else {
                projectsStore.stop(); tasksStore.stop()
            }
        }
        .onChange(of: selectedProjectId) { _, projectId in
            guard let tenantId = activeTenantId else { return }
            tasksStore.start(tenantId: tenantId, projectId: projectId)
        }
        .onDisappear {
            tasksStore.stop(); projectsStore.stop(); tenantStore.stop(); pinnedTasksStore.stop()
        }
    }

    // MARK: Filter row

    private var filterRow: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            Menu {
                Button(L10n.tr("common.all", fallback: "All projects")) { selectedProjectId = nil }
                ForEach(projectsStore.projects) { project in
                    Button(project.title) { selectedProjectId = project.id }
                }
            } label: {
                HStack(spacing: PFSpacing.xs) {
                    Image(systemName: "square.stack.3d.down.forward").font(.caption.weight(.semibold))
                    Text(selectedProject?.title ?? L10n.tr("common.all", fallback: "All projects"))
                        .font(PFFont.chip)
                        .lineLimit(1)
                    Image(systemName: "chevron.down").font(.caption2.weight(.bold))
                }
                .foregroundStyle(colors.textMain)
                .padding(.horizontal, PFSpacing.sm + 2)
                .padding(.vertical, PFSpacing.xs + 2)
                .background(colors.surfaceCard)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(colors.surfaceBorder, lineWidth: 1))
            }

            PFSegmentedControl(
                segments: [
                    .init(id: TaskFilter.all.rawValue, title: L10n.tr("common.all", fallback: "All")),
                    .init(id: TaskFilter.active.rawValue, title: L10n.tr("work.open", fallback: "Open")),
                    .init(id: TaskFilter.completed.rawValue, title: L10n.tr("work.completed", fallback: "Completed"))
                ],
                selection: Binding(
                    get: { filter.rawValue },
                    set: { if let next = TaskFilter(rawValue: $0) { filter = next } }
                )
            )
        }
    }

    // MARK: Row

    private func taskRow(_ task: ProjectTask) -> some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                Button {
                    Task { await toggleComplete(task) }
                } label: {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(task.isCompleted ? colors.success : colors.textMuted)
                        .font(.title3)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 6) {
                    Text(task.title)
                        .font(PFFont.rowTitle)
                        .foregroundStyle(task.isCompleted ? colors.textMuted : colors.textMain)
                        .strikethrough(task.isCompleted)
                        .lineLimit(2)

                    HStack(spacing: PFSpacing.xs) {
                        PFStatusChip(status: task.status)
                        if !task.priority.isEmpty { PFPriorityChip(priority: task.priority) }
                    }

                    if selectedProjectId == nil,
                       let projectId = task.projectId,
                       let project = projectsStore.projects.first(where: { $0.id == projectId }) {
                        Text(project.title)
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)

                VStack(spacing: PFSpacing.sm) {
                    Button { togglePin(task) } label: {
                        Image(systemName: pinnedTasksStore.isPinned(task.id) ? "pin.fill" : "pin")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                    }
                    .buttonStyle(.plain)

                    Menu {
                        Button(L10n.tr("common.edit", fallback: "Edit")) { editingTask = task }
                        Button(L10n.tr("common.delete", fallback: "Delete"), role: .destructive) { deletingTask = task }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }
        }
    }

    // MARK: Actions

    private func permissions(for task: ProjectTask) -> PermissionContext {
        let ownerId = projectsStore.projects.first(where: { $0.id == task.projectId })?.ownerId
        return tenantStore.permissionContext(projectOwnerId: ownerId)
    }

    private func toggleComplete(_ task: ProjectTask) async {
        guard let tenantId = activeTenantId else { return }
        await tasksStore.toggleComplete(
            tenantId: tenantId,
            projectId: task.projectId ?? "",
            task: task,
            permissions: permissions(for: task)
        )
    }

    private func saveEdit(task: ProjectTask, title: String, description: String, status: String, priority: String) async {
        guard let tenantId = activeTenantId else { return }
        await tasksStore.updateTask(
            tenantId: tenantId,
            projectId: task.projectId ?? "",
            taskId: task.id,
            title: title,
            description: description,
            status: status,
            priority: priority,
            permissions: permissions(for: task)
        )
    }

    private func delete(_ task: ProjectTask) async {
        guard let tenantId = activeTenantId else { return }
        await tasksStore.deleteTask(
            tenantId: tenantId,
            projectId: task.projectId ?? "",
            taskId: task.id,
            permissions: permissions(for: task)
        )
    }

    private func togglePin(_ task: ProjectTask) {
        guard let tenantId = activeTenantId else { return }
        if pinnedTasksStore.isPinned(task.id) {
            pinnedTasksStore.unpin(itemId: task.id)
        } else {
            pinnedTasksStore.pin(item: PinnedItem(
                id: task.id,
                type: "task",
                title: task.title,
                projectId: task.projectId ?? "",
                tenantId: tenantId,
                priority: task.priority,
                isCompleted: task.isCompleted
            ))
        }
    }
}

// MARK: - Task edit sheet

private struct CompanionTaskEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let task: ProjectTask
    let onSave: (String, String, String, String) async -> Void

    @State private var title: String
    @State private var description: String
    @State private var status: String
    @State private var priority: String
    @State private var isSaving = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Open", "In Progress", "Blocked", "On Hold", "Done"]
    private let priorities = ["Low", "Medium", "High", "Urgent"]

    init(task: ProjectTask, onSave: @escaping (String, String, String, String) async -> Void) {
        self.task = task
        self.onSave = onSave
        _title = State(initialValue: task.title)
        _description = State(initialValue: task.description)
        _status = State(initialValue: task.status)
        _priority = State(initialValue: task.priority)
    }

    var body: some View {
        PFSheetScaffold(
            title: L10n.tr("common.edit", fallback: "Edit"),
            canSave: !title.trimmingCharacters(in: .whitespaces).isEmpty,
            isSaving: isSaving,
            onCancel: { dismiss() },
            onSave: {
                Task {
                    isSaving = true
                    await onSave(
                        title.trimmingCharacters(in: .whitespaces),
                        description.trimmingCharacters(in: .whitespaces),
                        status,
                        priority
                    )
                    isSaving = false
                    dismiss()
                }
            }
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
