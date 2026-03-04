import SwiftUI
import FirebaseCore

enum TaskFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case active = "Active"
    case completed = "Completed"
    var id: String { rawValue }
}

enum TaskSort: String, CaseIterable, Identifiable {
    case dueDate = "Due Date"
    case priority = "Priority"
    case newest = "Newest"
    case title = "Title"
    var id: String { rawValue }
}

enum TaskViewMode: String, CaseIterable, Identifiable {
    case list = "List"
    case board = "Board"
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .list: return "list.bullet"
        case .board: return "square.grid.3x2"
        }
    }
}

struct TasksView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var tasksStore = TasksStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @StateObject private var teamStore = ProjectTeamStore()
    @StateObject private var labelsStore = LabelsStore()
    
    @State private var selectedProjectId: String? = nil // Nil means All Projects
    @State private var showingEditor = false
    @State private var editingTask: ProjectTask?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = "Open"
    @State private var draftPriority = "Medium"
    @State private var deletingTask: ProjectTask?
    
    @State private var searchText = ""
    @State private var filter: TaskFilter = .active
    @State private var sortBy: TaskSort = .dueDate
    @State private var viewMode: TaskViewMode = .list
    @State private var showingFilterSheet = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    private var selectedProject: Project? {
        guard let id = selectedProjectId else { return nil }
        return projectsStore.projects.first { $0.id == id }
    }
    
    private var activeTenantId: String? {
        tenantStore.activeTenantId
    }
    
    private var filteredTasks: [ProjectTask] {
        var result = tasksStore.tasks
        
        // Search
        if !searchText.isEmpty {
            result = result.filter { $0.title.localizedCaseInsensitiveContains(searchText) || $0.description.localizedCaseInsensitiveContains(searchText) }
        }
        
        // Filter by status
        switch filter {
        case .active:
            result = result.filter { !$0.isCompleted }
        case .completed:
            result = result.filter { $0.isCompleted }
        case .all:
            break
        }
        
        // Sort
        switch sortBy {
        case .dueDate:
            result.sort {
                let d1 = $0.dueDate
                let d2 = $1.dueDate
                if d1.isEmpty { return false }
                if d2.isEmpty { return true }
                return d1 < d2
            }
        case .newest:
            result.sort { ($0.createdAt?.dateValue() ?? Date.distantPast) > ($1.createdAt?.dateValue() ?? Date.distantPast) }
        case .priority:
            result.sort { taskPriorityValue($0.priority) > taskPriorityValue($1.priority) }
        case .title:
            result.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }
        
        return result
    }
    
    private func taskPriorityValue(_ p: String) -> Int {
        switch p {
        case "Urgent": return 4
        case "High": return 3
        case "Medium": return 2
        default: return 1
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                
                if viewMode == .list {
                    ScrollView {
                        content
                    }
                } else {
                    TaskBoardView(
                        tasks: filteredTasks,
                        tenantId: activeTenantId ?? "",
                        permissions: tenantStore.permissionContext(),
                        teamStore: teamStore,
                        labelsStore: labelsStore,
                        onToggleComplete: { task in
                            guard let tenantId = activeTenantId else { return }
                            let taskProjectId = task.projectId ?? ""
                            let projectOwnerId = projectsStore.projects.first(where: { $0.id == taskProjectId })?.ownerId
                            let permissions = tenantStore.permissionContext(projectOwnerId: projectOwnerId)
                            _Concurrency.Task {
                                await tasksStore.toggleComplete(tenantId: tenantId, projectId: taskProjectId, task: task, permissions: permissions)
                            }
                        },
                        onEdit: { beginEdit($0) },
                        onDelete: { deletingTask = $0 }
                    )
                }
            }
            .navigationTitle("Tasks")
            .searchable(text: $searchText, prompt: "Search tasks...")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("View Mode", selection: $viewMode) {
                        ForEach(TaskViewMode.allCases) { mode in
                            Image(systemName: mode.icon).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 80)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingFilterSheet = true
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .foregroundStyle(colors.textMain)
                    }
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        beginCreate()
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(colors.textMain)
                    }
                    .disabled(tasksStore.isLoading)
                }
            }
            .sheet(isPresented: $showingFilterSheet) {
                TaskFilterSheet(filter: $filter, sortBy: $sortBy)
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
                titleVisibility: SwiftUI.Visibility.visible
            ) {
                Button("Delete", role: .destructive) {
                    guard let task = deletingTask else { return }
                    _Concurrency.Task {
                        let taskProjectId = task.projectId ?? ""
                        let projectOwnerId = projectsStore.projects.first(where: { $0.id == taskProjectId })?.ownerId
                        let permissions = tenantStore.permissionContext(projectOwnerId: projectOwnerId)
                        await tasksStore.deleteTask(tenantId: activeTenantId ?? "", projectId: taskProjectId, taskId: task.id, permissions: permissions)
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
        .onAppear {
            tenantStore.update(for: session.user)
            pinnedTasksStore.start()
        }
        .onDisappear {
            tasksStore.stop()
            projectsStore.stop()
            tenantStore.stop()
            pinnedTasksStore.stop()
            teamStore.stop()
            labelsStore.stop()
        }
        .onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        }
        .onChange(of: tenantStore.activeTenantId) { _, tenantId in
            if let tenantId {
                projectsStore.start(tenantId: tenantId)
                tasksStore.start(tenantId: tenantId, projectId: selectedProjectId)
                teamStore.start(tenantId: tenantId)
                labelsStore.start(tenantId: tenantId, projectId: selectedProjectId)
            } else {
                projectsStore.stop()
                tasksStore.stop()
                teamStore.stop()
                labelsStore.stop()
            }
        }
        .onChange(of: selectedProjectId) { _, projectId in
            guard let tenantId = activeTenantId else { return }
            tasksStore.start(tenantId: tenantId, projectId: projectId)
            labelsStore.start(tenantId: tenantId, projectId: projectId)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            projectFilterPicker
            loadingSection
            errorSection
            listSection
        }
        .padding(PFSpacing.lg)
    }

    @ViewBuilder
    private var loadingSection: some View {
        if tasksStore.isLoading || tenantStore.isLoading {
            ProgressView()
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let error = tasksStore.errorMessage {
            Text(error)
                .font(.footnote)
                .foregroundStyle(colors.error)
        }
    }

    @ViewBuilder
    private var listSection: some View {
        let label = selectedProject?.title ?? "All Projects"
        if filteredTasks.isEmpty && !tasksStore.isLoading {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    Text(searchText.isEmpty ? "No tasks in \(label) yet." : "No matches found.")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Text(searchText.isEmpty ? "Create the first task to start tracking progress." : "Try adjusting your search or filters.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                }
            }
        } else {
            VStack(spacing: PFSpacing.md) {
                ForEach(filteredTasks) { task in
                    NavigationLink(destination: ProjectTaskDetailView(
                        task: task,
                        tenantId: activeTenantId ?? "",
                        permissions: tenantStore.permissionContext(projectOwnerId: projectsStore.projects.first(where: { $0.id == task.projectId })?.ownerId)
                    )) {
                        taskRow(task)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var projectFilterPicker: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Filter by Project")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)

                Picker("Project", selection: $selectedProjectId) {
                    Text("All Projects").tag(String?.none)
                    ForEach(projectsStore.projects) { project in
                        Text(project.title).tag(String?.some(project.id))
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    private func taskRow(_ task: ProjectTask) -> some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                Button {
                    _Concurrency.Task {
                        let taskProjectId = task.projectId ?? ""
                        let projectOwnerId = projectsStore.projects.first(where: { $0.id == taskProjectId })?.ownerId
                        let permissions = tenantStore.permissionContext(projectOwnerId: projectOwnerId)
                        await tasksStore.toggleComplete(tenantId: activeTenantId ?? "", projectId: taskProjectId, task: task, permissions: permissions)
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
                        .foregroundStyle(task.isCompleted ? colors.textMuted : colors.textMain)

                    if !task.description.isEmpty {
                        Text(task.description)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(2)
                    }
                    
                    HStack(spacing: PFSpacing.xs) {
                        Text("\(task.status) • \(task.priority) priority")
                        
                        if selectedProjectId == nil, let projectId = task.projectId {
                            if let project = projectsStore.projects.first(where: { $0.id == projectId }) {
                                Text("• \(project.title)")
                                    .foregroundStyle(colors.primary)
                            }
                        }
                    }
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

    private func beginEdit(_ task: ProjectTask) {
        editingTask = task
        draftTitle = task.title
        draftDescription = task.description
        draftStatus = task.status
        draftPriority = task.priority
        showingEditor = true
    }

    private func saveTask() async {
        guard let tenantId = activeTenantId else { return }
        
        // For new tasks, we need a project. If none selected, default to first available.
        let targetProjectId = selectedProjectId ?? taskProjectFallback()
        guard let projectId = targetProjectId else { return }
        
        let projectOwnerId = projectsStore.projects.first(where: { $0.id == projectId })?.ownerId
        let permissions = tenantStore.permissionContext(projectOwnerId: projectOwnerId)

        if let task = editingTask {
            await tasksStore.updateTask(
                tenantId: tenantId,
                projectId: task.projectId ?? projectId,
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
    
    private func taskProjectFallback() -> String? {
        projectsStore.projects.first?.id
    }

    private func togglePin(_ task: ProjectTask) {
        guard let tenantId = activeTenantId else { return }
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
                        .shadow(color: colors.shadowSm, radius: 4, x: 0, y: 2)
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
                    _Concurrency.Task {
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

struct TaskFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Binding var filter: TaskFilter
    @Binding var sortBy: TaskSort
    
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Filter") {
                    Picker("Status", selection: $filter) {
                        ForEach(TaskFilter.allCases) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                }
                
                Section("Sort By") {
                    Picker("Sort", selection: $sortBy) {
                        ForEach(TaskSort.allCases) { option in
                            Text(option.rawValue).tag(option)
                        }
                    }
                    .pickerStyle(.inline)
                }
            }
            .navigationTitle("Filter & Sort")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .background(colors.surfaceBg)
            .scrollContentBackground(.hidden)
        }
    }
}

struct TaskBoardView: View {
    let tasks: [ProjectTask]
    let tenantId: String
    let permissions: PermissionContext
    @ObservedObject var teamStore: ProjectTeamStore
    @ObservedObject var labelsStore: LabelsStore
    let onToggleComplete: (ProjectTask) -> Void
    let onEdit: (ProjectTask) -> Void
    let onDelete: (ProjectTask) -> Void
    
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    private let statuses = ["Open", "In Progress", "Blocked", "On Hold", "Done"]
    
    var body: some View {
        TabView {
            ForEach(statuses, id: \.self) { status in
                boardColumn(status: status)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .indexViewStyle(.page(backgroundDisplayMode: .always))
    }
    
    private func boardColumn(status: String) -> some View {
        let columnTasks = tasks.filter { $0.status == status }
        
        return VStack(alignment: .leading, spacing: PFSpacing.md) {
            HStack {
                Text(status.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMuted)
                    .tracking(1)
                
                Spacer()
                
                Text("\(columnTasks.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textSubtle)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(colors.surfaceHover)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, PFSpacing.lg)
            .padding(.top, PFSpacing.md)
            
            ScrollView {
                VStack(spacing: PFSpacing.md) {
                    if columnTasks.isEmpty {
                        Text("No tasks")
                            .font(.subheadline)
                            .foregroundStyle(colors.textSubtle)
                            .padding(.top, 40)
                    } else {
                        ForEach(columnTasks) { task in
                            NavigationLink(destination: ProjectTaskDetailView(
                                task: task,
                                tenantId: tenantId,
                                permissions: permissions
                            )) {
                                boardCard(task: task)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(PFSpacing.lg)
            }
        }
    }
    
    private func boardCard(task: ProjectTask) -> some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack(alignment: .top) {
                    Button {
                        onToggleComplete(task)
                    } label: {
                        Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                            .foregroundStyle(task.isCompleted ? colors.primary : colors.textMuted)
                            .font(.subheadline)
                    }
                    .buttonStyle(.plain)
                    
                    Text(task.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(task.isCompleted ? colors.textMuted : colors.textMain)
                        .strikethrough(task.isCompleted)
                        .lineLimit(2)
                    
                    Spacer()
                    
                    Menu {
                        Button("Edit") { onEdit(task) }
                        Button("Delete", role: .destructive) { onDelete(task) }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                
                if !task.description.isEmpty {
                    Text(task.description)
                        .font(.caption)
                        .foregroundStyle(colors.textSubtle)
                        .lineLimit(2)
                }
                
                // Labels
                if !task.labelIds.isEmpty {
                    FlowLayout(spacing: 4) {
                        ForEach(task.labelIds, id: \.self) { labelId in
                            if let label = labelsStore.labels.first(where: { $0.id == labelId }) {
                                Circle()
                                    .fill(Color(hex: label.color))
                                    .frame(width: 8, height: 8)
                            }
                        }
                    }
                }
                
                HStack {
                    priorityBadge(task.priority)
                    
                    if !task.subtasks.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "checklist")
                                .font(.system(size: 10))
                            Text("\(task.subtasks.filter { $0.isCompleted }.count)/\(task.subtasks.count)")
                                .font(.system(size: 10, weight: .bold))
                        }
                        .foregroundStyle(colors.textMuted)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(colors.surfaceHover)
                        .cornerRadius(4)
                    }
                    
                    Spacer()
                    
                    // Assignees
                    if !task.assigneeIds.isEmpty {
                        HStack(spacing: -8) {
                            ForEach(task.assigneeIds.prefix(3), id: \.self) { userId in
                                UserAvatar(
                                    name: teamStore.profilesById[userId]?.displayName,
                                    url: URL(string: teamStore.profilesById[userId]?.photoURL ?? ""),
                                    size: 20
                                )
                                .overlay(Circle().stroke(colors.surfaceCard, lineWidth: 1))
                            }
                        }
                    }
                }
            }
        }
    }
    
    @ViewBuilder
    private func priorityBadge(_ priority: String) -> some View {
        let color: Color = {
            switch priority {
            case "Urgent": return colors.error
            case "High": return .orange
            case "Medium": return .blue
            default: return colors.textSubtle
            }
        }()
        
        Text(priority)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}
