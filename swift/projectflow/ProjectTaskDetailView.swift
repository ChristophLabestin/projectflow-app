import SwiftUI

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
    @State private var isAddingSubtask = false
    @State private var showingAssigneePicker = false
    @State private var showingLabelPicker = false
    @StateObject private var teamStore = ProjectTeamStore()
    @StateObject private var labelsStore = LabelsStore()

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    taskHero
                    taskNowPanel
                    taskMetaGrid
                    descriptionCard
                    labelsSection
                    subtasksSection
                    assigneesSection
                    
                    if canEdit {
                        VStack(spacing: PFSpacing.md) {
                            PFSecondaryButton(title: "Edit Task", icon: "square.and.pencil") {
                                beginEdit()
                            }
                            
                            Button(role: .destructive) {
                                showingDeleteConfirm = true
                            } label: {
                                Text("Delete Task")
                                    .font(.headline)
                                    .foregroundStyle(colors.error)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, PFSpacing.sm)
                                    .background(colors.error.opacity(0.1))
                                    .cornerRadius(PFRadius.md)
                            }
                        }
                        .padding(.top, PFSpacing.sm)
                    }
                }
                .pfScreenPadding(vertical: PFSpacing.md)
                .padding(.bottom, PFSpacing.xl)
            }
        }
        .navigationTitle("Task Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if canEdit {
                    Button {
                        beginEdit()
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .foregroundStyle(colors.textMain)
                    }
                }
            }
        }
        .onAppear {
            tasksStore.start(tenantId: tenantId, projectId: task.projectId)
            teamStore.start(tenantId: tenantId)
            teamStore.ensureProfiles(for: task.assigneeIds)
            labelsStore.start(tenantId: tenantId, projectId: task.projectId)
        }
        .sheet(isPresented: $showingEditor) {
            TaskEditorView(
                isEditing: true,
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
        .sheet(isPresented: $showingAssigneePicker) {
            MultiAssigneePicker(
                selectedIds: Binding(
                    get: { task.assigneeIds },
                    set: { nextIds in
                        _Concurrency.Task {
                            await updateAssignees(nextIds)
                        }
                    }
                ),
                profiles: Array(teamStore.profilesById.values)
            )
        }
        .sheet(isPresented: $showingLabelPicker) {
            MultiLabelPicker(
                selectedIds: Binding(
                    get: { task.labelIds },
                    set: { nextIds in
                        _Concurrency.Task {
                            await updateLabels(nextIds)
                        }
                    }
                ),
                labels: labelsStore.labels
            )
        }
        .confirmationDialog("Delete Task?", isPresented: $showingDeleteConfirm, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                _Concurrency.Task {
                    await tasksStore.deleteTask(
                        tenantId: tenantId,
                        projectId: task.projectId ?? "",
                        taskId: task.id,
                        permissions: permissions
                    )
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
    }

    private var subtasksSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text("Subtasks")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                Spacer()
                
                Text("\(task.subtasks.filter { $0.isCompleted }.count)/\(task.subtasks.count)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMuted)
            }
            
            PFCard {
                VStack(alignment: .leading, spacing: 0) {
                    if task.subtasks.isEmpty {
                        Text("No subtasks yet.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .padding(PFSpacing.md)
                    } else {
                        ForEach(task.subtasks) { subtask in
                            HStack {
                                Button {
                                    toggleSubtask(subtask)
                                } label: {
                                    Image(systemName: subtask.isCompleted ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(subtask.isCompleted ? colors.success : colors.textMuted)
                                }
                                .buttonStyle(.plain)
                                
                                Text(subtask.title)
                                    .font(.subheadline)
                                    .foregroundStyle(subtask.isCompleted ? colors.textMuted : colors.textMain)
                                    .strikethrough(subtask.isCompleted)
                                
                                Spacer()
                                
                                Button {
                                    deleteSubtask(subtask)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                        .foregroundStyle(colors.textSubtle)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(PFSpacing.md)
                            
                            if subtask.id != task.subtasks.last?.id {
                                Divider().padding(.leading, PFSpacing.xl)
                            }
                        }
                    }
                    
                    Divider()
                    
                    HStack {
                        TextField("Add a subtask...", text: $newSubtaskTitle)
                            .font(.subheadline)
                            .onSubmit {
                                addSubtask()
                            }
                        
                        if !newSubtaskTitle.isEmpty {
                            Button {
                                addSubtask()
                            } label: {
                                Image(systemName: "plus.circle.fill")
                                    .foregroundStyle(colors.primary)
                            }
                        }
                    }
                    .padding(PFSpacing.md)
                }
            }
        }
    }

    private var assigneesSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text("Assignees")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                Spacer()
                
                Button {
                    // We need to fetch all tenant members first
                    // For now, let's just show the picker
                    showingAssigneePicker = true
                } label: {
                    Image(systemName: "person.badge.plus")
                        .foregroundStyle(colors.primary)
                }
            }
            
            PFCard {
                VStack(alignment: .leading, spacing: 0) {
                    if task.assigneeIds.isEmpty {
                        Text("No one assigned.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .padding(PFSpacing.md)
                    } else {
                        ForEach(task.assigneeIds, id: \.self) { userId in
                            HStack {
                                UserAvatar(
                                    name: teamStore.profilesById[userId]?.displayName,
                                    url: URL(string: teamStore.profilesById[userId]?.photoURL ?? ""),
                                    size: 32
                                )
                                Text(teamStore.profilesById[userId]?.displayName ?? "Loading...")
                                    .font(.subheadline)
                                    .foregroundStyle(colors.textMain)
                                Spacer()
                            }
                            .padding(PFSpacing.md)
                            
                            if userId != task.assigneeIds.last {
                                Divider().padding(.leading, 50)
                            }
                        }
                    }
                }
            }
        }
    }

    private var labelsSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text("Labels")
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                
                Spacer()
                
                Button {
                    showingLabelPicker = true
                } label: {
                    Image(systemName: "tag")
                        .foregroundStyle(colors.primary)
                }
            }
            
            if !task.labelIds.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(task.labelIds, id: \.self) { labelId in
                        if let label = labelsStore.labels.first(where: { $0.id == labelId }) {
                            Text(label.title)
                                .font(.caption.weight(.medium))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(hex: label.color).opacity(0.15))
                                .foregroundStyle(Color(hex: label.color))
                                .cornerRadius(4)
                        }
                    }
                }
            } else {
                Text("No labels.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }

    private func updateLabels(_ nextIds: [String]) async {
        await tasksStore.updateTaskFields(
            tenantId: tenantId,
            projectId: task.projectId ?? "",
            taskId: task.id,
            updates: ["labelIds": nextIds],
            permissions: permissions
        )
        if tasksStore.errorMessage == nil {
            task.labelIds = nextIds
        }
    }

    private func updateAssignees(_ nextIds: [String]) async {
        await tasksStore.updateTaskFields(
            tenantId: tenantId,
            projectId: task.projectId ?? "",
            taskId: task.id,
            updates: ["assigneeIds": nextIds],
            permissions: permissions
        )
        if tasksStore.errorMessage == nil {
            task.assigneeIds = nextIds
            teamStore.ensureProfiles(for: nextIds)
        }
    }

    private func addSubtask() {
        guard !newSubtaskTitle.isEmpty else { return }
        let title = newSubtaskTitle
        newSubtaskTitle = ""
        
        _Concurrency.Task {
            await tasksStore.addSubtask(
                tenantId: tenantId,
                projectId: task.projectId ?? "",
                taskId: task.id,
                title: title,
                subtasks: task.subtasks,
                permissions: permissions
            )
            // Update local state if successful
            if tasksStore.errorMessage == nil {
                task.subtasks.append(ProjectSubtask(title: title))
            }
        }
    }

    private func toggleSubtask(_ subtask: ProjectSubtask) {
        _Concurrency.Task {
            await tasksStore.toggleSubtask(
                tenantId: tenantId,
                projectId: task.projectId ?? "",
                taskId: task.id,
                subtaskId: subtask.id,
                subtasks: task.subtasks,
                permissions: permissions
            )
            if tasksStore.errorMessage == nil {
                if let index = task.subtasks.firstIndex(where: { $0.id == subtask.id }) {
                    task.subtasks[index].isCompleted.toggle()
                }
            }
        }
    }

    private func deleteSubtask(_ subtask: ProjectSubtask) {
        _Concurrency.Task {
            await tasksStore.deleteSubtask(
                tenantId: tenantId,
                projectId: task.projectId ?? "",
                taskId: task.id,
                subtaskId: subtask.id,
                subtasks: task.subtasks,
                permissions: permissions
            )
            if tasksStore.errorMessage == nil {
                task.subtasks.removeAll { $0.id == subtask.id }
            }
        }
    }

    private var taskHero: some View {
        TaskDetailHeroCard(
            task: task,
            priorityColor: priorityColor,
            dueLabel: dueStateLabel,
            dueTint: dueTint
        )
    }

    private var taskNowPanel: some View {
        TaskDetailNowCard(
            headline: taskNowHeadline,
            detail: taskNowDetail,
            icon: taskNowIcon,
            tint: dueTint,
            task: task,
            completedSubtasks: completedSubtaskCount
        )
    }

    private var taskMetaGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: PFSpacing.sm) {
            TaskMetaTile(title: "Status", value: task.status.isEmpty ? "Open" : task.status, icon: "circle.dashed", tint: colors.primary)
            TaskMetaTile(title: "Priority", value: task.priority.isEmpty ? "Medium" : task.priority, icon: "flag", tint: priorityColor)
            TaskMetaTile(title: "Assignees", value: task.assigneeIds.isEmpty ? "None" : "\(task.assigneeIds.count)", icon: "person.2", tint: colors.primaryLight)
            TaskMetaTile(title: "Due", value: dueStateLabel, icon: "calendar", tint: dueTint)
        }
    }

    private var descriptionCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: "Notes", subtitle: "Task context")

                Text(task.description.isEmpty ? "No description provided." : task.description)
                    .font(.body)
                    .foregroundStyle(task.description.isEmpty ? colors.textMuted : colors.textMain)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var completedSubtaskCount: Int {
        task.subtasks.filter { $0.isCompleted }.count
    }

    private var taskNowHeadline: String {
        if task.isCompleted || task.status == "Done" {
            return "This task is complete"
        }
        if task.status == "Blocked" {
            return "Blocked: decide the next unlock"
        }
        if isOverdue {
            return "Overdue: recover this first"
        }
        if isDueToday {
            return "Due today"
        }
        return "Ready for the next focused step"
    }

    private var taskNowDetail: String {
        if task.isCompleted || task.status == "Done" {
            return "Completed work stays out of the active queue."
        }
        if task.status == "Blocked" {
            return "Use the detail view to keep the blocker visible instead of hiding it in a long task list."
        }
        if isOverdue {
            return "Recover this before opening broader project metadata."
        }
        if isDueToday {
            return "Handle this before lower-priority work."
        }
        return "Check subtasks, assignment, and due date before moving on."
    }

    private var taskNowIcon: String {
        if task.isCompleted || task.status == "Done" { return "checkmark.circle.fill" }
        if task.status == "Blocked" { return "xmark.octagon.fill" }
        if isOverdue { return "calendar.badge.exclamationmark" }
        if isDueToday { return "calendar" }
        return "scope"
    }

    private var dueStateLabel: String {
        guard !task.dueDate.isEmpty else { return "No due date" }
        guard let date = parseTaskDate(task.dueDate) else { return task.dueDate }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInTomorrow(date) { return "Tomorrow" }
        if date < calendar.startOfDay(for: Date()) { return "Overdue" }

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
        if let date = isoFormatter.date(from: value) {
            return date
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            HStack {
                Text(task.priority.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(priorityColor)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(priorityColor.opacity(0.1))
                    .cornerRadius(4)
                
                Spacer()
                
                Text(task.status)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMain)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(colors.surfaceHover)
                    .clipShape(Capsule())
            }
            
            Text(task.title)
                .font(.title2.weight(.bold))
                .foregroundStyle(colors.textMain)
        }
    }

    private var description: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text("Description")
                .font(.headline)
                .foregroundStyle(colors.textMain)
            
            Text(task.description.isEmpty ? "No description provided." : task.description)
                .font(.body)
                .foregroundStyle(colors.textSubtle)
        }
    }

    private var details: some View {
        PFCard {
            VStack(spacing: PFSpacing.md) {
                detailRow(label: "Due Date", value: task.dueDate.isEmpty ? "Not set" : task.dueDate)
                Divider()
                detailRow(label: "Assignees", value: task.assigneeIds.isEmpty ? "Unassigned" : "\(task.assigneeIds.count) assigned")
            }
            .padding(PFSpacing.md)
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(colors.textMain)
        }
    }

    private var priorityColor: Color {
        switch task.priority.lowercased() {
        case "urgent": return colors.error
        case "high": return colors.warning
        case "medium": return .blue
        case "low": return colors.success
        default: return colors.textMuted
        }
    }
    
    private var canEdit: Bool {
        PermissionEvaluator(context: permissions).allows(PermissionNode.tasksEdit)
    }
    
    private func beginEdit() {
        draftTitle = task.title
        draftDescription = task.description
        draftStatus = task.status
        draftPriority = task.priority
        showingEditor = true
    }
    
    private func saveTask() async {
        await tasksStore.updateTask(
            tenantId: tenantId,
            projectId: task.projectId ?? "",
            taskId: task.id,
            title: draftTitle,
            description: draftDescription,
            status: draftStatus,
            priority: draftPriority,
            permissions: permissions
        )
        
        if tasksStore.errorMessage == nil {
            // Update local state to reflect changes
            task.title = draftTitle
            task.description = draftDescription
            task.status = draftStatus
            task.priority = draftPriority
            task.isCompleted = draftStatus == "Done"
            showingEditor = false
        }
    }
}

private struct TaskDetailHeroCard: View {
    let task: ProjectTask
    let priorityColor: Color
    let dueLabel: String
    let dueTint: Color

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "checklist")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(task.isCompleted ? colors.success : priorityColor)
                        .frame(width: 42, height: 42)
                        .background((task.isCompleted ? colors.success : priorityColor).opacity(colorScheme == .dark ? 0.18 : 0.1))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))

                    VStack(alignment: .leading, spacing: 6) {
                        HStack(spacing: PFSpacing.xs) {
                            TaskChip(text: task.status.isEmpty ? "Open" : task.status, tint: colors.primary)
                            TaskChip(text: task.priority.isEmpty ? "Medium" : task.priority, tint: priorityColor)
                        }

                        Text(task.title)
                            .font(.title3.weight(.bold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(3)
                    }

                    Spacer(minLength: 0)
                }

                HStack(spacing: PFSpacing.sm) {
                    TaskHeroMetric(title: "Due", value: dueLabel, icon: "calendar", tint: dueTint)
                    TaskHeroMetric(title: "Subtasks", value: "\(task.subtasks.filter { $0.isCompleted }.count)/\(task.subtasks.count)", icon: "list.bullet.rectangle", tint: colors.primary)
                }
            }
        }
    }
}

private struct TaskDetailNowCard: View {
    let headline: String
    let detail: String
    let icon: String
    let tint: Color
    let task: ProjectTask
    let completedSubtasks: Int

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    Image(systemName: icon)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(tint)
                        .frame(width: 40, height: 40)
                        .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))

                    VStack(alignment: .leading, spacing: 3) {
                        Text("IMPORTANT NOW")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.textMuted)

                        Text(headline)
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)

                        Text(detail)
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    Spacer(minLength: 0)
                }

                HStack(spacing: PFSpacing.sm) {
                    TaskNowMetric(title: "Labels", value: "\(task.labelIds.count)")
                    TaskNowMetric(title: "People", value: "\(task.assigneeIds.count)")
                    TaskNowMetric(title: "Done", value: "\(completedSubtasks)")
                }
            }
        }
    }
}

private struct TaskHeroMetric: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            Image(systemName: icon)
                .font(.caption.weight(.semibold))
                .foregroundStyle(tint)
                .frame(width: 28, height: 28)
                .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
                Text(value)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .padding(PFSpacing.sm)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

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
                Image(systemName: icon)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 30, height: 30)
                    .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.1))
                    .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm, style: .continuous))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(colors.textMuted)
                    Text(value)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(colors.textMain)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                Spacer(minLength: 0)
            }
        }
    }
}

private struct TaskNowMetric: View {
    let title: String
    let value: String

    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundStyle(colors.textMain)
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(PFSpacing.sm)
        .background(colors.surfaceHover)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct TaskChip: View {
    let text: String
    let tint: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(tint.opacity(0.12))
            .clipShape(Capsule())
            .lineLimit(1)
    }
}

// Reusable TaskEditorView (internal to this file or shared)
// Copied from TasksView.swift but made internal here for now or I should move it to UIComponents
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
