import SwiftUI

struct TasksView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var tasksStore = TasksStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @State private var selectedProjectId: String?
    @State private var showingEditor = false
    @State private var editingTask: Task?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = "Open"
    @State private var draftPriority = "Medium"
    @State private var deletingTask: Task?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var selectedProject: Project? {
        projectsStore.projects.first { $0.id == selectedProjectId }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                HStack {
                    Text("Tasks")
                        .font(.largeTitle)
                        .foregroundStyle(colors.textMain)

                    Spacer()

                    Button {
                        beginCreate()
                    } label: {
                        Label("New", systemImage: "plus")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.primaryText)
                            .padding(.horizontal, PFSpacing.md)
                            .padding(.vertical, PFSpacing.xs)
                            .background(colors.primary)
                            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                    }
                    .disabled(selectedProjectId == nil || tasksStore.isLoading)
                }

                projectPicker

                if tasksStore.isLoading || tenantStore.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                }

                if let error = tasksStore.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(colors.error)
                }

                if let project = selectedProject, tasksStore.tasks.isEmpty && !tasksStore.isLoading {
                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("No tasks in \(project.title) yet.")
                                .font(.headline)
                                .foregroundStyle(colors.textMain)
                            Text("Create the first task to start tracking progress.")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                } else {
                    VStack(spacing: PFSpacing.md) {
                        ForEach(tasksStore.tasks) { task in
                            taskRow(task)
                        }
                    }
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
        .onAppear {
            tenantStore.update(for: session.user)
            pinnedTasksStore.start()
        }
        .onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        }
        .onChange(of: tenantStore.activeTenantId) { _, tenantId in
            if let tenantId {
                projectsStore.start(tenantId: tenantId)
            } else {
                projectsStore.stop()
            }
        }
        .onChange(of: projectsStore.projects) { _, projects in
            if selectedProjectId == nil {
                selectedProjectId = projects.first?.id
            }
        }
        .onChange(of: selectedProjectId) { _, projectId in
            guard let tenantId = tenantStore.activeTenantId, let projectId else {
                tasksStore.stop()
                return
            }
            tasksStore.start(tenantId: tenantId, projectId: projectId)
        }
        .onDisappear {
            tasksStore.stop()
            projectsStore.stop()
            tenantStore.stop()
            pinnedTasksStore.stop()
        }
        .sheet(isPresented: $showingEditor) {
            TaskEditorView(
                isEditing: editingTask != nil,
                title: $draftTitle,
                description: $draftDescription,
                status: $draftStatus,
                priority: $draftPriority
            ) {
                await saveTask()
            } onCancel: {
                showingEditor = false
            }
        }
        .confirmationDialog(
            "Delete Task?",
            isPresented: Binding(
                get: { deletingTask != nil },
                set: { if !$0 { deletingTask = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let task = deletingTask else { return }
                Task {
                    await deleteTask(task)
                    deletingTask = nil
                }
            }
            Button("Cancel", role: .cancel) {
                deletingTask = nil
            }
        } message: {
            Text("This will permanently remove the task.")
        }
    }

    private var projectPicker: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Project")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)

                if projectsStore.projects.isEmpty {
                    Text("No projects available.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                } else {
                    Picker("Project", selection: Binding(
                        get: { selectedProjectId ?? projectsStore.projects.first?.id ?? "" },
                        set: { selectedProjectId = $0 }
                    )) {
                        ForEach(projectsStore.projects) { project in
                            Text(project.title).tag(project.id)
                        }
                    }
                    .pickerStyle(.menu)
                }
            }
        }
    }

    private func taskRow(_ task: Task) -> some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                Button {
                    Task {
                        await toggleComplete(task)
                    }
                } label: {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(task.isCompleted ? colors.primary : colors.textMuted)
                        .font(.title3)
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text(task.title)
                        .font(.headline)
                        .foregroundStyle(colors.textMain)

                    if !task.description.isEmpty {
                        Text(task.description)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(2)
                    }

                    Text("\(task.status) • \(task.priority) priority")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }

                Spacer()

                Menu {
                    Button("Edit") {
                        beginEdit(task)
                    }

                    Button("Delete", role: .destructive) {
                        deletingTask = task
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(colors.textMuted)
                        .padding(6)
                        .background(colors.surfacePaper)
                        .clipShape(Circle())
                }

                Button {
                    togglePin(task)
                } label: {
                    Image(systemName: pinnedTasksStore.isPinned(task.id) ? "pin.fill" : "pin")
                        .foregroundStyle(colors.textMuted)
                        .padding(6)
                        .background(colors.surfacePaper)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func beginCreate() {
        editingTask = nil
        draftTitle = ""
        draftDescription = ""
        draftStatus = "Open"
        draftPriority = "Medium"
        showingEditor = true
    }

    private func beginEdit(_ task: Task) {
        editingTask = task
        draftTitle = task.title
        draftDescription = task.description
        draftStatus = task.status
        draftPriority = task.priority
        showingEditor = true
    }

    private func saveTask() async {
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)

        if let task = editingTask {
            await tasksStore.updateTask(
                tenantId: tenantId,
                projectId: projectId,
                taskId: task.id,
                title: draftTitle,
                description: draftDescription,
                status: draftStatus,
                priority: draftPriority,
                permissions: permissions
            )
        } else {
            await tasksStore.createTask(
                tenantId: tenantId,
                projectId: projectId,
                title: draftTitle,
                description: draftDescription,
                status: draftStatus,
                priority: draftPriority,
                permissions: permissions
            )
        }

        if tasksStore.errorMessage == nil {
            showingEditor = false
        }
    }

    private func deleteTask(_ task: Task) async {
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)
        await tasksStore.deleteTask(
            tenantId: tenantId,
            projectId: projectId,
            taskId: task.id,
            permissions: permissions
        )
    }

    private func toggleComplete(_ task: Task) async {
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)
        await tasksStore.toggleComplete(
            tenantId: tenantId,
            projectId: projectId,
            task: task,
            permissions: permissions
        )
    }

    private func togglePin(_ task: Task) {
        guard let tenantId = tenantStore.activeTenantId else { return }
        if pinnedTasksStore.isPinned(task.id) {
            pinnedTasksStore.unpin(itemId: task.id)
        } else {
            let pinned = PinnedItem(
                id: task.id,
                type: "task",
                title: task.title,
                projectId: task.projectId ?? "",
                tenantId: tenantId,
                priority: task.priority,
                isCompleted: task.isCompleted
            )
            pinnedTasksStore.pin(item: pinned)
        }
    }
}

private struct TaskEditorView: View {
    @Environment(\.colorScheme) private var colorScheme
    let isEditing: Bool
    @Binding var title: String
    @Binding var description: String
    @Binding var status: String
    @Binding var priority: String
    let onSave: () async -> Void
    let onCancel: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Open", "In Progress", "Blocked", "On Hold", "Done"]
    private let priorities = ["Low", "Medium", "High", "Urgent"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text(isEditing ? "Edit Task" : "New Task")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                PFInputField(
                    title: "Title",
                    placeholder: "Task title",
                    text: $title,
                    isSecure: false,
                    keyboardType: .default
                )

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Description")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    TextEditor(text: $description)
                        .frame(minHeight: 120)
                        .padding(PFSpacing.sm)
                        .background(colors.surfacePaper)
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                                .stroke(colors.surfaceBorder, lineWidth: 1)
                        )
                }

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Status")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    Picker("Status", selection: $status) {
                        ForEach(statuses, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Priority")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    Picker("Priority", selection: $priority) {
                        ForEach(priorities, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                }

                PFPrimaryButton(title: isEditing ? "Save Changes" : "Create Task") {
                    Task {
                        await onSave()
                    }
                }

                PFSecondaryButton(title: "Cancel") {
                    onCancel()
                }
            }
            .padding(PFSpacing.lg)
        }
        .background(colors.surfaceBg.ignoresSafeArea())
    }
}
